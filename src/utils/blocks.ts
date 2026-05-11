import type { BlockInput, BlockRecord, BlockType } from '../types/domain';

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createBlock(type: BlockType = 'text'): BlockRecord {
  const now = new Date().toISOString();

  return {
    id: createId('block'),
    pageId: '',
    type,
    content: '',
    checked: false,
    position: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneBlocks(blocks: BlockRecord[]): BlockRecord[] {
  return blocks.map((block) => ({ ...block }));
}

export function normalizeBlockPositions(pageId: string, blocks: BlockRecord[]): BlockRecord[] {
  const now = new Date().toISOString();

  return blocks.map((block, index) => ({
    ...block,
    pageId,
    position: index,
    updatedAt: now,
  }));
}

export function toBlockInputs(blocks: BlockRecord[]): BlockInput[] {
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    content: block.content,
    checked: block.checked,
  }));
}

export function areBlocksEqual(a: BlockRecord[], b: BlockRecord[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((block, index) => {
    const target = b[index];

    return (
      block.id === target.id &&
      block.type === target.type &&
      block.content === target.content &&
      block.checked === target.checked
    );
  });
}

export function isEmptyBlock(block: BlockRecord): boolean {
  if (block.type === 'divider') {
    return true;
  }

  return block.content.trim().length === 0;
}
