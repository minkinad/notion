import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { BlockRecord, CreatePageResponse, PageRecord, SaveState, WorkspaceSnapshot } from '../types/domain';
import { createEmptyHistory, pushHistory, redoHistory, type PageHistory, undoHistory } from '../services/editorHistory';
import { getDescendantPageIds, pickNextActivePageId } from '../services/pageTree';
import {
  bootstrapWorkspace,
  createPage as createPageRequest,
  deletePage as deletePageRequest,
  renamePage as renamePageRequest,
  savePageBlocks as savePageBlocksRequest,
  updateWorkspaceContext,
} from '../services/tauriApi';
import { areBlocksEqual, cloneBlocks, normalizeBlockPositions, toBlockInputs } from '../utils/blocks';

interface WorkspaceState {
  pagesById: Record<string, PageRecord>;
  blocksByPageId: Record<string, BlockRecord[]>;
  historiesByPageId: Record<string, PageHistory>;
  activePageId: string | null;
  recentPageIds: string[];
  searchQuery: string;
  status: 'loading' | 'ready' | 'error';
  saveState: SaveState;
  errorMessage: string | null;
}

type WorkspaceAction =
  | { type: 'hydrate'; payload: WorkspaceSnapshot }
  | { type: 'set-active-page'; payload: string | null }
  | { type: 'set-search-query'; payload: string }
  | { type: 'create-page'; payload: CreatePageResponse }
  | { type: 'rename-page-local'; payload: { pageId: string; title: string } }
  | { type: 'delete-pages'; payload: { pageIds: string[]; nextActivePageId: string | null } }
  | { type: 'set-page-blocks'; payload: { pageId: string; blocks: BlockRecord[]; trackHistory: boolean } }
  | { type: 'undo-page'; payload: string }
  | { type: 'redo-page'; payload: string }
  | { type: 'set-save-state'; payload: SaveState }
  | { type: 'set-load-error'; payload: string }
  | { type: 'set-save-error'; payload: string };

const RECENT_PAGE_LIMIT = 8;

const initialState: WorkspaceState = {
  pagesById: {},
  blocksByPageId: {},
  historiesByPageId: {},
  activePageId: null,
  recentPageIds: [],
  searchQuery: '',
  status: 'loading',
  saveState: 'idle',
  errorMessage: null,
};

function normalizeSnapshot(snapshot: WorkspaceSnapshot): WorkspaceState {
  const pagesById = Object.fromEntries(snapshot.pages.map((page) => [page.id, page]));
  const blocksByPageId = snapshot.blocks.reduce<Record<string, BlockRecord[]>>((acc, block) => {
    const bucket = acc[block.pageId] ?? [];
    bucket.push(block);
    acc[block.pageId] = bucket;
    return acc;
  }, {});

  for (const page of snapshot.pages) {
    blocksByPageId[page.id] ??= [];
  }

  const activePageId =
    (snapshot.activePageId && pagesById[snapshot.activePageId] ? snapshot.activePageId : null) ??
    snapshot.pages[0]?.id ??
    null;

  return {
    ...initialState,
    pagesById,
    blocksByPageId,
    activePageId,
    recentPageIds: snapshot.recentPageIds.filter((pageId) => Boolean(pagesById[pageId])),
    status: 'ready',
  };
}

function reducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'hydrate':
      return normalizeSnapshot(action.payload);

    case 'set-active-page': {
      if (!action.payload) {
        return {
          ...state,
          activePageId: null,
        };
      }

      const recentPageIds = [action.payload, ...state.recentPageIds.filter((pageId) => pageId !== action.payload)].slice(
        0,
        RECENT_PAGE_LIMIT,
      );

      return {
        ...state,
        activePageId: action.payload,
        recentPageIds,
      };
    }

    case 'set-search-query':
      return {
        ...state,
        searchQuery: action.payload,
      };

    case 'create-page': {
      const page = action.payload.page;
      const blocks = [action.payload.initialBlock];

      return {
        ...state,
        pagesById: {
          ...state.pagesById,
          [page.id]: page,
        },
        blocksByPageId: {
          ...state.blocksByPageId,
          [page.id]: blocks,
        },
        historiesByPageId: {
          ...state.historiesByPageId,
          [page.id]: createEmptyHistory(),
        },
        activePageId: page.id,
        recentPageIds: [page.id, ...state.recentPageIds.filter((pageId) => pageId !== page.id)].slice(
          0,
          RECENT_PAGE_LIMIT,
        ),
      };
    }

    case 'rename-page-local': {
      const page = state.pagesById[action.payload.pageId];
      if (!page) {
        return state;
      }

      return {
        ...state,
        pagesById: {
          ...state.pagesById,
          [page.id]: {
            ...page,
            title: action.payload.title,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }

    case 'delete-pages': {
      const pagesById = { ...state.pagesById };
      const blocksByPageId = { ...state.blocksByPageId };
      const historiesByPageId = { ...state.historiesByPageId };

      for (const pageId of action.payload.pageIds) {
        delete pagesById[pageId];
        delete blocksByPageId[pageId];
        delete historiesByPageId[pageId];
      }

      return {
        ...state,
        pagesById,
        blocksByPageId,
        historiesByPageId,
        activePageId: action.payload.nextActivePageId,
        recentPageIds: state.recentPageIds.filter((pageId) => !action.payload.pageIds.includes(pageId)),
      };
    }

    case 'set-page-blocks': {
      const currentBlocks = state.blocksByPageId[action.payload.pageId] ?? [];
      const normalizedBlocks = normalizeBlockPositions(action.payload.pageId, action.payload.blocks);

      if (areBlocksEqual(currentBlocks, normalizedBlocks)) {
        return state;
      }

      const history = state.historiesByPageId[action.payload.pageId] ?? createEmptyHistory();

      return {
        ...state,
        blocksByPageId: {
          ...state.blocksByPageId,
          [action.payload.pageId]: normalizedBlocks,
        },
        historiesByPageId: {
          ...state.historiesByPageId,
          [action.payload.pageId]: action.payload.trackHistory ? pushHistory(history, currentBlocks) : history,
        },
        saveState: action.payload.trackHistory ? 'saving' : state.saveState,
      };
    }

    case 'undo-page': {
      const pageId = action.payload;
      const currentBlocks = state.blocksByPageId[pageId] ?? [];
      const history = state.historiesByPageId[pageId] ?? createEmptyHistory();
      const result = undoHistory(history, currentBlocks);

      if (!result.blocks) {
        return state;
      }

      return {
        ...state,
        blocksByPageId: {
          ...state.blocksByPageId,
          [pageId]: normalizeBlockPositions(pageId, result.blocks),
        },
        historiesByPageId: {
          ...state.historiesByPageId,
          [pageId]: result.history,
        },
        saveState: 'saving',
      };
    }

    case 'redo-page': {
      const pageId = action.payload;
      const currentBlocks = state.blocksByPageId[pageId] ?? [];
      const history = state.historiesByPageId[pageId] ?? createEmptyHistory();
      const result = redoHistory(history, currentBlocks);

      if (!result.blocks) {
        return state;
      }

      return {
        ...state,
        blocksByPageId: {
          ...state.blocksByPageId,
          [pageId]: normalizeBlockPositions(pageId, result.blocks),
        },
        historiesByPageId: {
          ...state.historiesByPageId,
          [pageId]: result.history,
        },
        saveState: 'saving',
      };
    }

    case 'set-save-state':
      return {
        ...state,
        saveState: action.payload,
        errorMessage: action.payload === 'error' ? state.errorMessage : null,
      };

    case 'set-load-error':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload,
        saveState: 'error',
      };

    case 'set-save-error':
      return {
        ...state,
        saveState: 'error',
        errorMessage: action.payload,
      };

    default:
      return state;
  }
}

function clearTimeoutMap(timeouts: Map<string, number>): void {
  for (const timeoutId of timeouts.values()) {
    window.clearTimeout(timeoutId);
  }
  timeouts.clear();
}

export function useWorkspace() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const blockSaveTimeoutsRef = useRef(new Map<string, number>());
  const blockSaveVersionsRef = useRef(new Map<string, number>());
  const titleSaveTimeoutsRef = useRef(new Map<string, number>());

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
    };
  }, []);

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
    const activeTimeout = blockSaveTimeoutsRef.current.get(pageId);
    if (activeTimeout) {
      window.clearTimeout(activeTimeout);
    }

    const nextVersion = (blockSaveVersionsRef.current.get(pageId) ?? 0) + 1;
    blockSaveVersionsRef.current.set(pageId, nextVersion);

    const timeoutId = window.setTimeout(async () => {
      try {
        await savePageBlocksRequest(pageId, toBlockInputs(blocks));
        if (blockSaveVersionsRef.current.get(pageId) === nextVersion) {
          dispatch({ type: 'set-save-state', payload: 'saved' });
        }
      } catch (error) {
        dispatch({
          type: 'set-save-error',
          payload: error instanceof Error ? error.message : 'Failed to save blocks',
        });
      }
    }, 320);

    blockSaveTimeoutsRef.current.set(pageId, timeoutId);
  }, []);

  const scheduleTitlePersist = useCallback((pageId: string, title: string) => {
    const activeTimeout = titleSaveTimeoutsRef.current.get(pageId);
    if (activeTimeout) {
      window.clearTimeout(activeTimeout);
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await renamePageRequest(pageId, title.trim() || 'Untitled');
        dispatch({ type: 'set-save-state', payload: 'saved' });
      } catch (error) {
        dispatch({
          type: 'set-save-error',
          payload: error instanceof Error ? error.message : 'Failed to rename page',
        });
      }
    }, 220);

    titleSaveTimeoutsRef.current.set(pageId, timeoutId);
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
          ? pickNextActivePageId(pageId, state.pagesById)
          : state.activePageId;

      try {
        await deletePageRequest(pageId);
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
    [state.activePageId, state.pagesById],
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
