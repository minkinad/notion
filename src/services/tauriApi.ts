import { invoke } from '@tauri-apps/api/core';

import type {
  BlockInput,
  CreatePageResponse,
  PageRecord,
  WorkspaceContextInput,
  WorkspaceSnapshot,
} from '../types/domain';

export async function bootstrapWorkspace(): Promise<WorkspaceSnapshot> {
  return invoke<WorkspaceSnapshot>('bootstrap_workspace');
}

export async function createPage(
  parentId: string | null,
  title?: string,
): Promise<CreatePageResponse> {
  return invoke<CreatePageResponse>('create_page', {
    parentId,
    title,
  });
}

export async function renamePage(pageId: string, title: string): Promise<PageRecord> {
  return invoke<PageRecord>('rename_page', {
    pageId,
    title,
  });
}

export async function deletePage(pageId: string): Promise<void> {
  return invoke('delete_page', { pageId });
}

export async function savePageBlocks(pageId: string, blocks: BlockInput[]): Promise<void> {
  return invoke('save_page_blocks', {
    pageId,
    blocks,
  });
}

export async function updateWorkspaceContext(input: WorkspaceContextInput): Promise<void> {
  return invoke('update_workspace_context', { input });
}
