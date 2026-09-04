import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { BlockRecord } from '../types/domain';
import { createEmptyHistory, redoHistory, undoHistory } from '../services/editorHistory';
import { LatestWriteQueue } from '../services/latestWriteQueue';
import { getDescendantPageIds, pickNextActivePageId } from '../services/pageTree';
import {
  bootstrapWorkspace,
  createPage as createPageRequest,
  deletePage as deletePageRequest,
  renamePage as renamePageRequest,
  savePageBlocks as savePageBlocksRequest,
  updateWorkspaceContext,
} from '../services/tauriApi';
import { initialWorkspaceState, workspaceReducer } from '../services/workspaceState';
import { cloneBlocks, normalizeBlockPositions, toBlockInputs } from '../utils/blocks';

const BLOCK_SAVE_DELAY_MS = 320;
const TITLE_SAVE_DELAY_MS = 220;

type WorkspaceWrite =
  | { kind: 'blocks'; pageId: string; blocks: BlockRecord[] }
  | { kind: 'title'; pageId: string; title: string };

function persistenceKey(kind: WorkspaceWrite['kind'], pageId: string): string {
  return `${kind}:${pageId}`;
}

function copyWorkspaceWrite(write: WorkspaceWrite): WorkspaceWrite {
  return write.kind === 'blocks' ? { ...write, blocks: cloneBlocks(write.blocks) } : { ...write };
}

async function persistWorkspaceWrite(write: WorkspaceWrite): Promise<void> {
  if (write.kind === 'blocks') {
    await savePageBlocksRequest(write.pageId, toBlockInputs(write.blocks));
    return;
  }

  await renamePageRequest(write.pageId, write.title);
}

export function useWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const activePageIdsRef = useRef(new Set<string>());
  const persistenceQueueRef = useRef<LatestWriteQueue<WorkspaceWrite> | null>(null);

  useEffect(() => {
    const persistenceQueue = new LatestWriteQueue<WorkspaceWrite>({
      write: persistWorkspaceWrite,
      copy: copyWorkspaceWrite,
      onError: (error, write) => {
        if (!activePageIdsRef.current.has(write.pageId)) {
          return;
        }

        dispatch({
          type: 'set-save-error',
          payload:
            error instanceof Error
              ? error.message
              : write.kind === 'blocks'
                ? 'Failed to save blocks'
                : 'Failed to rename page',
        });
      },
      onIdle: (hasErrors) => {
        if (!hasErrors) {
          dispatch({ type: 'set-save-state', payload: 'saved' });
        }
      },
    });
    persistenceQueueRef.current = persistenceQueue;

    bootstrapWorkspace()
      .then((snapshot) => {
        dispatch({ type: 'hydrate', payload: snapshot });
      })
      .catch((error: unknown) => {
        dispatch({
          type: 'set-load-error',
          payload: error instanceof Error ? error.message : 'Failed to load workspace',
        });
      });

    return () => {
      persistenceQueue.dispose();
      if (persistenceQueueRef.current === persistenceQueue) {
        persistenceQueueRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    activePageIdsRef.current = new Set(Object.keys(state.pagesById));
  }, [state.pagesById]);

  useEffect(() => {
    if (state.status !== 'ready') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateWorkspaceContext({
        activePageId: state.activePageId,
        recentPageIds: state.recentPageIds,
      });
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [state.activePageId, state.recentPageIds, state.status]);

  const scheduleBlockPersist = useCallback((pageId: string, blocks: BlockRecord[]) => {
    persistenceQueueRef.current?.schedule(
      persistenceKey('blocks', pageId),
      { kind: 'blocks', pageId, blocks },
      BLOCK_SAVE_DELAY_MS,
    );
  }, []);

  const scheduleTitlePersist = useCallback((pageId: string, title: string) => {
    persistenceQueueRef.current?.schedule(
      persistenceKey('title', pageId),
      { kind: 'title', pageId, title: title.trim() || 'Untitled' },
      TITLE_SAVE_DELAY_MS,
    );
  }, []);

  const clearPagePersistence = useCallback((pageIds: string[]) => {
    persistenceQueueRef.current?.cancel(
      pageIds.flatMap((pageId) => [persistenceKey('blocks', pageId), persistenceKey('title', pageId)]),
    );
  }, []);

  const setActivePage = useCallback((pageId: string | null) => {
    dispatch({ type: 'set-active-page', payload: pageId });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'set-search-query', payload: query });
  }, []);

  const createPage = useCallback(async (parentId: string | null) => {
    try {
      const response = await createPageRequest(parentId);
      dispatch({ type: 'create-page', payload: response });
      return response.page.id;
    } catch (error) {
      dispatch({
        type: 'set-save-error',
        payload: error instanceof Error ? error.message : 'Failed to create page',
      });
      return null;
    }
  }, []);

  const deletePage = useCallback(
    async (pageId: string) => {
      const pageIds = getDescendantPageIds(pageId, state.pagesById);
      const nextActivePageId =
        state.activePageId && pageIds.includes(state.activePageId)
          ? pickNextActivePageId(pageIds, state.pagesById)
          : state.activePageId;

      try {
        await deletePageRequest(pageId);
        clearPagePersistence(pageIds);
        dispatch({
          type: 'delete-pages',
          payload: {
            pageIds,
            nextActivePageId,
          },
        });
      } catch (error) {
        dispatch({
          type: 'set-save-error',
          payload: error instanceof Error ? error.message : 'Failed to delete page',
        });
      }
    },
    [clearPagePersistence, state.activePageId, state.pagesById],
  );

  const renamePage = useCallback(
    (pageId: string, title: string) => {
      dispatch({ type: 'set-save-state', payload: 'saving' });
      dispatch({
        type: 'rename-page-local',
        payload: {
          pageId,
          title,
        },
      });
      scheduleTitlePersist(pageId, title);
    },
    [scheduleTitlePersist],
  );

  const setPageBlocks = useCallback(
    (pageId: string, blocks: BlockRecord[], trackHistory = true) => {
      const normalizedBlocks = normalizeBlockPositions(pageId, blocks);
      dispatch({
        type: 'set-page-blocks',
        payload: {
          pageId,
          blocks: normalizedBlocks,
          trackHistory,
        },
      });
      scheduleBlockPersist(pageId, normalizedBlocks);
    },
    [scheduleBlockPersist],
  );

  const undoPage = useCallback(() => {
    if (!state.activePageId) {
      return;
    }

    const currentBlocks = state.blocksByPageId[state.activePageId] ?? [];
    const history = state.historiesByPageId[state.activePageId] ?? createEmptyHistory();
    const result = undoHistory(history, currentBlocks);
    if (!result.blocks) {
      return;
    }

    dispatch({ type: 'undo-page', payload: state.activePageId });
    scheduleBlockPersist(state.activePageId, normalizeBlockPositions(state.activePageId, cloneBlocks(result.blocks)));
  }, [scheduleBlockPersist, state.activePageId, state.blocksByPageId, state.historiesByPageId]);

  const redoPage = useCallback(() => {
    if (!state.activePageId) {
      return;
    }

    const currentBlocks = state.blocksByPageId[state.activePageId] ?? [];
    const history = state.historiesByPageId[state.activePageId] ?? createEmptyHistory();
    const result = redoHistory(history, currentBlocks);
    if (!result.blocks) {
      return;
    }

    dispatch({ type: 'redo-page', payload: state.activePageId });
    scheduleBlockPersist(state.activePageId, normalizeBlockPositions(state.activePageId, cloneBlocks(result.blocks)));
  }, [scheduleBlockPersist, state.activePageId, state.blocksByPageId, state.historiesByPageId]);

  const currentPage = state.activePageId ? state.pagesById[state.activePageId] ?? null : null;
  const currentBlocks = currentPage ? state.blocksByPageId[currentPage.id] ?? [] : [];
  const currentHistory = currentPage ? state.historiesByPageId[currentPage.id] ?? createEmptyHistory() : createEmptyHistory();

  return {
    state,
    currentPage,
    currentBlocks,
    canUndo: currentHistory.past.length > 0,
    canRedo: currentHistory.future.length > 0,
    setActivePage,
    setSearchQuery,
    createPage,
    deletePage,
    renamePage,
    setPageBlocks,
    undoPage,
    redoPage,
  };
}
