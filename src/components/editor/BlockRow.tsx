import type { KeyboardEvent } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useLayoutEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';

import { blockTypeLabel } from '../../services/editorCatalog';
import type { BlockRecord, BlockType } from '../../types/domain';
import { SlashMenu } from './SlashMenu';

interface BlockRowProps {
  block: BlockRecord;
  isSlashMenuVisible: boolean;
  slashQuery: string;
  onSelectSlashCommand: (type: BlockType) => void;
  onChange: (nextContent: string) => void;
  onToggleTodo: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>, block: BlockRecord) => void;
  onFocus: () => void;
  focusToken: number;
  slashActiveIndex: number;
  onSlashActiveIndexChange: (index: number) => void;
}

export function BlockRow({
  block,
  isSlashMenuVisible,
  slashQuery,
  onSelectSlashCommand,
  onChange,
  onToggleTodo,
  onKeyDown,
  onFocus,
  focusToken,
  slashActiveIndex,
  onSlashActiveIndexChange,
}: BlockRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node || block.type === 'divider') {
      return;
    }

    node.style.height = '0px';
    node.style.height = `${Math.max(node.scrollHeight, 28)}px`;
  }, [block.content, block.type, focusToken]);

  useLayoutEffect(() => {
    if (focusToken === 0 || block.type === 'divider') {
      return;
    }

    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(block.content.length, block.content.length);
  }, [block.content.length, block.type, focusToken]);

  const textAreaClassName = [
    'block-row__input',
    `block-row__input--${block.type}`,
    block.type === 'todo' ? 'block-row__input--todo' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`block-row ${isDragging ? 'block-row--dragging' : ''}`}
      onFocus={onFocus}
    >
      <div className="block-row__rail">
        <button
          type="button"
          className="block-row__handle"
          aria-label={`Move ${blockTypeLabel(block.type)} block`}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <span className="block-row__type">{blockTypeLabel(block.type)}</span>
      </div>

      <div className="block-row__body">
        {block.type === 'divider' ? (
          <button
            type="button"
            className="block-row__divider"
            onClick={() => onSelectSlashCommand('text')}
            onFocus={onFocus}
          >
            <span />
          </button>
        ) : (
          <label className="block-row__content">
            {block.type === 'todo' ? (
              <input
                className="block-row__checkbox"
                type="checkbox"
                checked={block.checked}
                onChange={onToggleTodo}
              />
            ) : null}
            {block.type === 'list' ? <span className="block-row__list-marker">•</span> : null}
            <textarea
              ref={textareaRef}
              spellCheck={block.type !== 'code'}
              rows={1}
              value={block.content}
              className={textAreaClassName}
              placeholder={placeholderFor(block.type)}
              onFocus={onFocus}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => onKeyDown(event, block)}
            />
          </label>
        )}

        {isSlashMenuVisible ? (
          <SlashMenu
            query={slashQuery}
            activeIndex={slashActiveIndex}
            onActiveIndexChange={onSlashActiveIndexChange}
            onSelect={onSelectSlashCommand}
          />
        ) : null}
      </div>
    </div>
  );
}

function placeholderFor(type: BlockType): string {
  switch (type) {
    case 'heading':
      return 'Heading';
    case 'todo':
      return 'To-do';
    case 'list':
      return 'List item';
    case 'quote':
      return 'Quote';
    case 'code':
      return 'Code snippet';
    default:
      return 'Type / for blocks';
  }
}
