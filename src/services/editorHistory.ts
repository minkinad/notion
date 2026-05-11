import type { BlockRecord } from '../types/domain.js';
import { cloneBlocks } from '../utils/blocks.js';

const HISTORY_LIMIT = 60;

export interface PageHistory {
  past: BlockRecord[][];
  future: BlockRecord[][];
}

export function createEmptyHistory(): PageHistory {
  return {
    past: [],
    future: [],
  };
}

export function pushHistory(history: PageHistory, snapshot: BlockRecord[]): PageHistory {
  const nextPast = [...history.past, cloneBlocks(snapshot)];

  return {
    past: nextPast.slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function undoHistory(
  history: PageHistory,
  current: BlockRecord[],
): { history: PageHistory; blocks: BlockRecord[] | null } {
  const previous = history.past.at(-1);
  if (!previous) {
    return { history, blocks: null };
  }

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [cloneBlocks(current), ...history.future].slice(0, HISTORY_LIMIT),
    },
    blocks: cloneBlocks(previous),
  };
}

export function redoHistory(
  history: PageHistory,
  current: BlockRecord[],
): { history: PageHistory; blocks: BlockRecord[] | null } {
  const next = history.future[0];
  if (!next) {
    return { history, blocks: null };
  }

  return {
    history: {
      past: [...history.past, cloneBlocks(current)].slice(-HISTORY_LIMIT),
      future: history.future.slice(1),
    },
    blocks: cloneBlocks(next),
  };
}
