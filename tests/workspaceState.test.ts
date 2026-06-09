import test from 'node:test';
import assert from 'node:assert/strict';

import type { BlockRecord, PageRecord, WorkspaceSnapshot } from '../src/types/domain.js';
import { initialWorkspaceState, normalizeWorkspaceSnapshot, workspaceReducer } from '../src/services/workspaceState.js';

function page(overrides: Partial<PageRecord> = {}): PageRecord {
  return {
    id: overrides.id ?? 'page-1',
    parentId: overrides.parentId ?? null,
    title: overrides.title ?? 'Page',
    position: overrides.position ?? 0,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

function block(overrides: Partial<BlockRecord> = {}): BlockRecord {
  return {
    id: overrides.id ?? 'block-1',
    pageId: overrides.pageId ?? 'page-1',
    type: overrides.type ?? 'text',
    content: overrides.content ?? '',
    checked: overrides.checked ?? false,
    position: overrides.position ?? 0,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

test('normalizeWorkspaceSnapshot indexes pages, blocks, and filters stale navigation state', () => {
  const snapshot: WorkspaceSnapshot = {
    pages: [page({ id: 'page-1' }), page({ id: 'page-2', position: 1 })],
    blocks: [block({ id: 'block-1', pageId: 'page-1', content: 'hello' })],
    activePageId: 'missing',
    recentPageIds: ['missing', 'page-2', 'page-1'],
  };

  const state = normalizeWorkspaceSnapshot(snapshot);

  assert.equal(state.status, 'ready');
  assert.equal(state.activePageId, 'page-1');
  assert.deepEqual(state.recentPageIds, ['page-2', 'page-1']);
  assert.equal(state.blocksByPageId['page-1']?.[0]?.content, 'hello');
  assert.deepEqual(state.blocksByPageId['page-2'], []);
});

test('workspaceReducer keeps recent pages unique and capped', () => {
  const state = {
    ...initialWorkspaceState,
    pagesById: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`page-${index}`, page({ id: `page-${index}` })])),
    recentPageIds: ['page-1', 'page-2', 'page-3', 'page-4', 'page-5', 'page-6', 'page-7', 'page-8'],
    status: 'ready' as const,
  };

  const next = workspaceReducer(state, { type: 'set-active-page', payload: 'page-9' });

  assert.equal(next.activePageId, 'page-9');
  assert.deepEqual(next.recentPageIds, ['page-9', 'page-1', 'page-2', 'page-3', 'page-4', 'page-5', 'page-6', 'page-7']);
});

test('workspaceReducer records history when block edits are tracked', () => {
  const original = block({ id: 'block-1', content: 'before' });
  const state = {
    ...initialWorkspaceState,
    blocksByPageId: {
      'page-1': [original],
    },
    status: 'ready' as const,
  };

  const next = workspaceReducer(state, {
    type: 'set-page-blocks',
    payload: {
      pageId: 'page-1',
      blocks: [block({ id: 'block-1', content: 'after' })],
      trackHistory: true,
    },
  });

  assert.equal(next.saveState, 'saving');
  assert.equal(next.blocksByPageId['page-1']?.[0]?.content, 'after');
  assert.equal(next.historiesByPageId['page-1']?.past[0]?.[0]?.content, 'before');
});
