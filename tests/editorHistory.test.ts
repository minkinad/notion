import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyHistory, pushHistory, redoHistory, undoHistory } from '../src/services/editorHistory.js';
import type { BlockRecord } from '../src/types/domain.js';

function block(id: string, content: string): BlockRecord {
  return {
    id,
    pageId: 'page',
    type: 'text',
    content,
    checked: false,
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

test('undoHistory returns previous snapshot and moves current into future', () => {
  const initial = [block('a', 'first')];
  const edited = [block('a', 'second')];
  const history = pushHistory(createEmptyHistory(), initial);

  const result = undoHistory(history, edited);

  assert.deepEqual(result.blocks?.map((item) => item.content), ['first']);
  assert.equal(result.history.future.length, 1);
  assert.deepEqual(result.history.future[0]?.map((item) => item.content), ['second']);
});

test('redoHistory replays future snapshot', () => {
  const initial = [block('a', 'first')];
  const edited = [block('a', 'second')];
  const history = pushHistory(createEmptyHistory(), initial);
  const undone = undoHistory(history, edited);

  const result = redoHistory(undone.history, initial);

  assert.deepEqual(result.blocks?.map((item) => item.content), ['second']);
});
