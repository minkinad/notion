import test from 'node:test';
import assert from 'node:assert/strict';

import { LatestWriteQueue } from '../src/services/latestWriteQueue.js';

test('LatestWriteQueue coalesces pending writes and copies scheduled values', async () => {
  const writes: Array<{ value: string }> = [];
  const source = { value: 'first' };
  const queue = new LatestWriteQueue<{ value: string }>({
    write: async (value) => {
      writes.push(value);
    },
    copy: (value) => ({ ...value }),
    onError: () => undefined,
    onIdle: () => undefined,
  });

  queue.schedule('page', source, 60_000);
  source.value = 'mutated outside the queue';
  await queue.flush('page');

  queue.schedule('page', { value: 'stale' }, 60_000);
  queue.schedule('page', { value: 'latest' }, 60_000);
  await queue.flush('page');

  assert.deepEqual(writes, [{ value: 'first' }, { value: 'latest' }]);
  queue.dispose();
});

test('LatestWriteQueue persists a newer value after an in-flight write', async () => {
  const writes: string[] = [];
  let releaseFirstWrite: () => void = () => undefined;
  let markFirstWriteStarted: () => void = () => undefined;
  const firstWriteStarted = new Promise<void>((resolve) => {
    markFirstWriteStarted = resolve;
  });
  const firstWriteGate = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve;
  });
  const queue = new LatestWriteQueue<string>({
    write: async (value) => {
      writes.push(value);
      if (value === 'first') {
        markFirstWriteStarted();
        await firstWriteGate;
      }
    },
    copy: (value) => value,
    onError: () => undefined,
    onIdle: () => undefined,
  });

  queue.schedule('page', 'first', 60_000);
  const firstFlush = queue.flush('page');
  await firstWriteStarted;
  queue.schedule('page', 'latest', 60_000);
  releaseFirstWrite();
  await firstFlush;

  assert.deepEqual(writes, ['first', 'latest']);
  queue.dispose();
});

test('LatestWriteQueue reports failures without marking the queue healthy', async () => {
  const idleStates: boolean[] = [];
  const errors: unknown[] = [];
  const queue = new LatestWriteQueue<string>({
    write: async () => {
      throw new Error('disk unavailable');
    },
    copy: (value) => value,
    onError: (error) => errors.push(error),
    onIdle: (hasErrors) => idleStates.push(hasErrors),
  });

  queue.schedule('page', 'draft', 60_000);
  await queue.flush('page');

  assert.equal(errors.length, 1);
  assert.deepEqual(idleStates, [true]);
  queue.dispose();
});

test('LatestWriteQueue cancellation drops pending writes', async () => {
  const writes: string[] = [];
  const queue = new LatestWriteQueue<string>({
    write: async (value) => {
      writes.push(value);
    },
    copy: (value) => value,
    onError: () => undefined,
    onIdle: () => undefined,
  });

  queue.schedule('deleted-page', 'draft', 60_000);
  queue.cancel(['deleted-page']);
  await queue.flush('deleted-page');

  assert.deepEqual(writes, []);
  queue.dispose();
});
