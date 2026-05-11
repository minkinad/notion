import type { KeyboardEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { filterSlashCommands } from '../../services/editorCatalog';
import type { BlockRecord, BlockType } from '../../types/domain';
import { createBlock, isEmptyBlock } from '../../utils/blocks';
import { BlockRow } from './BlockRow';

interface BlockEditorProps {
  pageId: string;
  blocks: BlockRecord[];
  onBlocksChange: (blocks: BlockRecord[]) => void;
}

export function BlockEditor({ pageId, blocks, onBlocksChange }: BlockEditorProps) {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(blocks[0]?.id ?? null);
  const [focusVersionById, setFocusVersionById] = useState<Record<string, number>>({});
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const focusedBlock = blocks.find((block) => block.id === focusedBlockId) ?? null;
  const slashQuery =
    focusedBlock && focusedBlock.type !== 'divider' && focusedBlock.content.startsWith('/')
      ? focusedBlock.content.slice(1)
      : null;
  const slashItems = filterSlashCommands(slashQuery ?? '');

  useEffect(() => {
    setSlashActiveIndex(0);
  }, [slashQuery, focusedBlockId]);

  useEffect(() => {
    setFocusedBlockId(blocks[0]?.id ?? null);
  }, [pageId]);

  useEffect(() => {
    if (focusedBlockId && blocks.some((block) => block.id === focusedBlockId)) {
      return;
    }

    setFocusedBlockId(blocks[0]?.id ?? null);
  }, [blocks, focusedBlockId]);

  const nextFocus = (blockId: string) => {
    setFocusedBlockId(blockId);
    setFocusVersionById((current) => ({
      ...current,
      [blockId]: (current[blockId] ?? 0) + 1,
    }));
  };

  const updateBlocks = (nextBlocks: BlockRecord[]) => {
    onBlocksChange(nextBlocks.map((block) => ({ ...block, pageId })));
  };

  const insertAfter = (blockId: string, type: BlockType = 'text') => {
    const index = blocks.findIndex((block) => block.id === blockId);
    const block = createBlock(type);
    const nextBlocks = [...blocks];
    nextBlocks.splice(index + 1, 0, { ...block, pageId });
    updateBlocks(nextBlocks);
    nextFocus(block.id);
  };

  const removeBlock = (blockId: string) => {
    if (blocks.length === 1) {
      const replacement = { ...createBlock('text'), pageId };
      updateBlocks([replacement]);
      nextFocus(replacement.id);
      return;
    }

    const index = blocks.findIndex((block) => block.id === blockId);
    const nextBlocks = blocks.filter((block) => block.id !== blockId);
    updateBlocks(nextBlocks);
    nextFocus(nextBlocks[Math.max(index - 1, 0)]?.id ?? nextBlocks[0].id);
  };

  const convertBlock = (blockId: string, type: BlockType) => {
    const nextBlocks = blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            type,
            content: type === 'divider' ? '' : block.content.replace(/^\/.*/, ''),
            checked: type === 'todo' ? block.checked : false,
          }
        : block,
    );
    updateBlocks(nextBlocks);
    nextFocus(blockId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    updateBlocks(arrayMove(blocks, oldIndex, newIndex));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, block: BlockRecord) => {
    if (slashQuery !== null && focusedBlockId === block.id) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashActiveIndex((current) => Math.min(current + 1, slashItems.length - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        const nextBlocks = blocks.map((item) =>
          item.id === block.id
            ? {
                ...item,
                content: '',
              }
            : item,
        );
        updateBlocks(nextBlocks);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey && block.type !== 'code') {
      event.preventDefault();

      if (slashQuery !== null) {
        convertBlock(block.id, slashItems[slashActiveIndex]?.type ?? 'text');
        return;
      }

      insertAfter(block.id, block.type === 'todo' || block.type === 'list' ? block.type : 'text');
      return;
    }

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && block.type === 'code') {
      event.preventDefault();
      insertAfter(block.id);
      return;
    }

    if (event.key === 'Backspace' && isEmptyBlock(block) && event.currentTarget.selectionStart === 0) {
      event.preventDefault();
      removeBlock(block.id);
      return;
    }

    if ((event.altKey || event.metaKey) && event.key === 'ArrowUp') {
      event.preventDefault();
      const index = blocks.findIndex((item) => item.id === block.id);
      if (index > 0) {
        updateBlocks(arrayMove(blocks, index, index - 1));
      }
      return;
    }

    if ((event.altKey || event.metaKey) && event.key === 'ArrowDown') {
      event.preventDefault();
      const index = blocks.findIndex((item) => item.id === block.id);
      if (index < blocks.length - 1) {
        updateBlocks(arrayMove(blocks, index, index + 1));
      }
    }
  };

  const items = useMemo(() => blocks.map((block) => block.id), [blocks]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="block-editor">
          {blocks.map((block) => (
            <BlockRow
              key={block.id}
              block={block}
              focusToken={focusVersionById[block.id] ?? 0}
              isSlashMenuVisible={focusedBlockId === block.id && slashQuery !== null}
              slashQuery={slashQuery ?? ''}
              onFocus={() => setFocusedBlockId(block.id)}
              slashActiveIndex={slashActiveIndex}
              onSlashActiveIndexChange={setSlashActiveIndex}
              onToggleTodo={() => {
                updateBlocks(
                  blocks.map((item) =>
                    item.id === block.id
                      ? {
                          ...item,
                          checked: !item.checked,
                        }
                      : item,
                  ),
                );
              }}
              onChange={(nextContent) => {
                updateBlocks(
                  blocks.map((item) =>
                    item.id === block.id
                      ? {
                          ...item,
                          content: nextContent,
                        }
                      : item,
                  ),
                );
              }}
              onKeyDown={handleKeyDown}
              onSelectSlashCommand={(type) => convertBlock(block.id, type)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
