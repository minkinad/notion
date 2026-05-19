import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPagePath, buildPageTree, getDescendantPageIds, pickNextActivePageId, searchPages } from '../src/services/pageTree.js';
import type { BlockRecord, PageRecord, PageTreeNode } from '../src/types/domain.js';

const pages = Object.fromEntries(
  [
    {
      id: 'root',
      parentId: null,
      title: 'Workspace',
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'child-a',
      parentId: 'root',
      title: 'Alpha',
      position: 0,
      createdAt: '2026-01-01T00:00:01.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
    },
    {
      id: 'child-b',
      parentId: 'root',
      title: 'Beta',
      position: 1,
      createdAt: '2026-01-01T00:00:02.000Z',
      updatedAt: '2026-01-01T00:00:05.000Z',
    },
    {
      id: 'grandchild',
      parentId: 'child-a',
      title: 'Gamma',
      position: 0,
      createdAt: '2026-01-01T00:00:03.000Z',
      updatedAt: '2026-01-01T00:00:03.000Z',
    },
  ].map((page) => [page.id, page as PageRecord]),
);

const blocksByPageId: Record<string, BlockRecord[]> = {
  root: [
    {
      id: 'block-root',
      pageId: 'root',
      type: 'text',
      content: 'Workspace summary for quarterly planning',
      checked: false,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  'child-a': [
    {
      id: 'block-child-a',
      pageId: 'child-a',
      type: 'text',
      content: 'Notes about editorial workflows',
      checked: false,
      position: 0,
      createdAt: '2026-01-01T00:00:01.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
    },
  ],
  'child-b': [
    {
      id: 'block-child-b',
      pageId: 'child-b',
      type: 'text',
      content: 'Launch checklist and release notes',
      checked: false,
      position: 0,
      createdAt: '2026-01-01T00:00:02.000Z',
      updatedAt: '2026-01-01T00:00:05.000Z',
    },
  ],
  grandchild: [
    {
      id: 'block-grandchild',
      pageId: 'grandchild',
      type: 'text',
      content: 'Research notes on automation and collaboration',
      checked: false,
      position: 0,
      createdAt: '2026-01-01T00:00:03.000Z',
      updatedAt: '2026-01-01T00:00:03.000Z',
    },
  ],
};

test('buildPageTree preserves nesting and page order', () => {
  const tree = buildPageTree(pages);

  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.page.id, 'root');
  assert.deepEqual(
    tree[0]?.children.map((node: PageTreeNode) => node.page.id),
    ['child-a', 'child-b'],
  );
  assert.deepEqual(
    tree[0]?.children[0]?.children.map((node: PageTreeNode) => node.page.id),
    ['grandchild'],
  );
});

test('getDescendantPageIds includes subtree ids', () => {
  assert.deepEqual(getDescendantPageIds('child-a', pages), ['child-a', 'grandchild']);
});

test('buildPagePath returns root to leaf path', () => {
  assert.deepEqual(buildPagePath('grandchild', pages), ['Workspace', 'Alpha', 'Gamma']);
});

test('searchPages prioritizes updated documents when query is empty', () => {
  const results = searchPages(pages, blocksByPageId, '');

  assert.deepEqual(
    results.map((result) => result.page.id).slice(0, 2),
    ['child-b', 'grandchild'],
  );
});

test('searchPages matches title, path, and content with sensible ranking', () => {
  const titleResults = searchPages(pages, blocksByPageId, 'alpha');
  assert.deepEqual(
    titleResults.map((result) => result.page.id),
    ['child-a', 'grandchild'],
  );
  assert.equal(titleResults[0]?.matchedIn, 'title');
  assert.equal(titleResults[1]?.matchedIn, 'path');

  const contentResults = searchPages(pages, blocksByPageId, 'release');
  assert.equal(contentResults[0]?.page.id, 'child-b');
  assert.equal(contentResults[0]?.matchedIn, 'content');
  assert.ok(/release notes/i.test(contentResults[0]?.preview ?? ''));
});

test('pickNextActivePageId returns another available page', () => {
  assert.equal(pickNextActivePageId(['root'], pages), 'child-a');
});

test('pickNextActivePageId skips descendants scheduled for deletion', () => {
  assert.equal(pickNextActivePageId(['child-a', 'grandchild'], pages), 'root');
});
