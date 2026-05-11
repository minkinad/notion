import test from 'node:test';
import assert from 'node:assert/strict';

import { areBlocksEqual, createBlock, isEmptyBlock, normalizeBlockPositions, toBlockInputs } from '../src/utils/blocks.js';
import type { BlockRecord } from '../src/types/domain.js';

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

test('createBlock creates a text block by default', () => {
  const created = createBlock();

  assert.equal(created.type, 'text');
  assert.equal(created.content, '');
  assert.ok(created.id.startsWith('block_'));
});

test('normalizeBlockPositions rewrites page id and sequential positions', () => {
  const normalized = normalizeBlockPositions('page-2', [
    block({ id: 'a', pageId: 'old', position: 4 }),
    block({ id: 'b', pageId: 'old', position: 9 }),
  ]);

  assert.deepEqual(
    normalized.map((item) => ({ id: item.id, pageId: item.pageId, position: item.position })),
    [
      { id: 'a', pageId: 'page-2', position: 0 },
      { id: 'b', pageId: 'page-2', position: 1 },
    ],
  );
});

test('toBlockInputs strips persistence-only fields', () => {
  const inputs = toBlockInputs([block({ id: 'a', content: 'hello', checked: true })]);

  assert.deepEqual(inputs, [
    {
      id: 'a',
      type: 'text',
      content: 'hello',
      checked: true,
    },
  ]);
});

test('areBlocksEqual compares content-level equality', () => {
  assert.equal(
    areBlocksEqual([block({ id: 'a', content: 'same' })], [block({ id: 'a', content: 'same' })]),
    true,
  );
  assert.equal(
    areBlocksEqual([block({ id: 'a', content: 'same' })], [block({ id: 'a', content: 'changed' })]),
    false,
  );
});

test('isEmptyBlock treats divider as empty and text with content as non-empty', () => {
  assert.equal(isEmptyBlock(block({ type: 'divider' })), true);
  assert.equal(isEmptyBlock(block({ content: 'notes' })), false);
});
