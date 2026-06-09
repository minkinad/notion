import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { BlockRecord } from '../types/domain';
import { createEmptyHistory, redoHistory, undoHistory } from '../services/editorHistory';
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

function clearTimeoutMap(timeouts: Map<string, number>): void {
  for (const timeoutId of timeouts.values()) {
    window.clearTimeout(timeoutId);
  }
  timeouts.clear();
}

export function useWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const blockSaveTimeoutsRef = useRef(new Map<string, number>());
  const pendingBlockSavesRef = useRef(new Map<string, BlockRecord[]>());
  const blockSavesInFlightRef = useRef(new Set<string>());
  const titleSaveTimeoutsRef = useRef(new Map<string, number>());
  const pendingTitleSavesRef = useRef(new Map<string, string>());
  const titleSavesInFlightRef = useRef(new Set<string>());
  const activePageIdsRef = useRef(new Set<string>());

  useEffect(() => {
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
      clearTimeoutMap(blockSaveTimeoutsRef.current);
      clearTimeoutMap(titleSaveTimeoutsRef.current);
      pendingBlockSavesRef.current.clear();
      pendingTitleSavesRef.current.clear();
      blockSavesInFlightRef.current.clear();
      titleSavesInFlightRef.current.clear();
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

  const flushBlockPersist = useCallback(async (pageId: string) => {
    if (blockSavesInFlightRef.current.has(pageId)) {
      return;
    }

    const pendingBlocks = pendingBlockSavesRef.current.get(pageId);
    if (!pendingBlocks) {
      return;
    }

    pendingBlockSavesRef.current.delete(pageId);
    blockSavesInFlightRef.current.add(pageId);

    try {
      await savePageBlocksRequest(pageId, toBlockInputs(pendingBlocks));
      if (activePageIdsRef.current.has(pageId) && !pendingBlockSavesRef.current.has(pageId)) {
        dispatch({ type: 'set-save-state', payload: 'saved' });
      }
    } catch (error) {
      if (activePageIdsRef.current.has(pageId)) {
        dispatch({
          type: 'set-save-error',
          payload: error instanceof Error ? error.message : 'Failed to save blocks',
        });
      }
    } finally {
      blockSavesInFlightRef.current.delete(pageId);
      if (pendingBlockSavesRef.current.has(pageId)) {
        void flushBlockPersist(pageId);
      }
    }
  }, []);

  const scheduleBlockPersist = useCallback((pageId: string, blocks: BlockRecord[]) => {
    const activeTimeout = blockSaveTimeoutsRef.current.get(pageId);
    if (activeTimeout) {
      window.clearTimeout(activeTimeout);
    }

    pendingBlockSavesRef.current.set(pageId, cloneBlocks(blocks));

    const timeoutId = window.setTimeout(() => {
      blockSaveTimeoutsRef.current.delete(pageId);
      void flushBlockPersist(pageId);
    }, 320);

    blockSaveTimeoutsRef.current.set(pageId, timeoutId);
  }, [flushBlockPersist]);

  const flushTitlePersist = useCallback(async (pageId: string) => {
    if (titleSavesInFlightRef.current.has(pageId)) {
      return;
    }

    const pendingTitle = pendingTitleSavesRef.current.get(pageId);
    if (!pendingTitle) {
      return;
    }

    pendingTitleSavesRef.current.delete(pageId);
    titleSavesInFlightRef.current.add(pageId);

    try {
      await renamePageRequest(pageId, pendingTitle);
      if (activePageIdsRef.current.has(pageId) && !pendingTitleSavesRef.current.has(pageId)) {
        dispatch({ type: 'set-save-state', payload: 'saved' });
      }
    } catch (error) {
      if (activePageIdsRef.current.has(pageId)) {
        dispatch({
          type: 'set-save-error',
          payload: error instanceof Error ? error.message : 'Failed to rename page',
        });
      }
    } finally {
      titleSavesInFlightRef.current.delete(pageId);
      if (pendingTitleSavesRef.current.has(pageId)) {
        void flushTitlePersist(pageId);
      }
    }
  }, []);

  const scheduleTitlePersist = useCallback((pageId: string, title: string) => {
    const activeTimeout = titleSaveTimeoutsRef.current.get(pageId);
    if (activeTimeout) {
      window.clearTimeout(activeTimeout);
    }

    pendingTitleSavesRef.current.set(pageId, title.trim() || 'Untitled');

    const timeoutId = window.setTimeout(() => {
      titleSaveTimeoutsRef.current.delete(pageId);
      void flushTitlePersist(pageId);
    }, 220);

    titleSaveTimeoutsRef.current.set(pageId, timeoutId);
  }, [flushTitlePersist]);

  const clearPagePersistence = useCallback((pageIds: string[]) => {
    for (const pageId of pageIds) {
      const blockTimeout = blockSaveTimeoutsRef.current.get(pageId);
      if (blockTimeout) {
        window.clearTimeout(blockTimeout);
        blockSaveTimeoutsRef.current.delete(pageId);
      }

      const titleTimeout = titleSaveTimeoutsRef.current.get(pageId);
      if (titleTimeout) {
        window.clearTimeout(titleTimeout);
        titleSaveTimeoutsRef.current.delete(pageId);
      }

      pendingBlockSavesRef.current.delete(pageId);
      pendingTitleSavesRef.current.delete(pageId);
    }
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
