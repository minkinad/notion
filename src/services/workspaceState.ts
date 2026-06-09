import type { BlockRecord, CreatePageResponse, PageRecord, SaveState, WorkspaceSnapshot } from '../types/domain.js';
import { createEmptyHistory, pushHistory, redoHistory, type PageHistory, undoHistory } from './editorHistory.js';
import { areBlocksEqual, normalizeBlockPositions } from '../utils/blocks.js';

export interface WorkspaceState {
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

export type WorkspaceAction =
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

export const initialWorkspaceState: WorkspaceState = {
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

export function normalizeWorkspaceSnapshot(snapshot: WorkspaceSnapshot): WorkspaceState {
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
    ...initialWorkspaceState,
    pagesById,
    blocksByPageId,
    activePageId,
    recentPageIds: snapshot.recentPageIds.filter((pageId) => Boolean(pagesById[pageId])),
    status: 'ready',
  };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'hydrate':
      return normalizeWorkspaceSnapshot(action.payload);

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
