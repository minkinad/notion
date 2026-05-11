import type { BlockType } from '../types/domain.js';

export interface SlashCommandItem {
  type: BlockType;
  title: string;
  description: string;
  shortcut?: string;
}

export const slashCommandItems: SlashCommandItem[] = [
  {
    type: 'text',
    title: 'Text',
    description: 'Plain paragraph for long-form writing.',
  },
  {
    type: 'heading',
    title: 'Heading',
    description: 'Section heading for structure and scanning.',
  },
  {
    type: 'todo',
    title: 'To-do',
    description: 'Checklist item with a persistent checkbox.',
  },
  {
    type: 'list',
    title: 'List',
    description: 'Bulleted list item for grouped notes.',
  },
  {
    type: 'quote',
    title: 'Quote',
    description: 'Indented quote or callout line.',
  },
  {
    type: 'code',
    title: 'Code',
    description: 'Monospaced code block for snippets.',
  },
  {
    type: 'divider',
    title: 'Divider',
    description: 'Subtle divider for section breaks.',
  },
];

export function filterSlashCommands(query: string): SlashCommandItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return slashCommandItems;
  }

  return slashCommandItems.filter((item) => {
    const haystack = `${item.title} ${item.description} ${item.type}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function blockTypeLabel(type: BlockType): string {
  return slashCommandItems.find((item) => item.type === type)?.title ?? type;
}
