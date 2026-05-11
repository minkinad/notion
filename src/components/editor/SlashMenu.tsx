import type { BlockType } from '../../types/domain';
import { filterSlashCommands } from '../../services/editorCatalog';

interface SlashMenuProps {
  query: string;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (type: BlockType) => void;
}

export function SlashMenu({ query, activeIndex, onActiveIndexChange, onSelect }: SlashMenuProps) {
  const items = filterSlashCommands(query);

  if (items.length === 0) {
    return (
      <div className="slash-menu">
        <div className="slash-menu__empty">No block matches that command.</div>
      </div>
    );
  }

  return (
    <div className="slash-menu" role="listbox">
      {items.map((item, index) => (
        <button
          key={item.type}
          type="button"
          className={`slash-menu__item ${index === activeIndex ? 'slash-menu__item--active' : ''}`}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelect(item.type)}
        >
          <span className="slash-menu__title">{item.title}</span>
          <span className="slash-menu__description">{item.description}</span>
        </button>
      ))}
    </div>
  );
}
