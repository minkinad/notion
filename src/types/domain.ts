export type BlockType =
  | 'text'
  | 'heading'
  | 'todo'
  | 'list'
  | 'quote'
  | 'code'
  | 'divider';

export interface PageRecord {
  id: string;
  parentId: string | null;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlockRecord {
  id: string;
  pageId: string;
  type: BlockType;
  content: string;
  checked: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlockInput {
  id: string;
  type: BlockType;
  content: string;
  checked: boolean;
}

export interface WorkspaceSnapshot {
  pages: PageRecord[];
  blocks: BlockRecord[];
  activePageId: string | null;
  recentPageIds: string[];
}

export interface CreatePageResponse {
  page: PageRecord;
  initialBlock: BlockRecord;
}

export interface WorkspaceContextInput {
  activePageId: string | null;
  recentPageIds: string[];
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface PageTreeNode {
  page: PageRecord;
  children: PageTreeNode[];
}

export type PageSearchMatch = 'title' | 'path' | 'content';

export interface PageSearchResult {
  page: PageRecord;
  path: string[];
  matchedIn: PageSearchMatch;
  preview: string;
}
