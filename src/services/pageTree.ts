import type { PageRecord, PageTreeNode } from '../types/domain';

export function sortPages(a: PageRecord, b: PageRecord): number {
  if (a.position !== b.position) {
    return a.position - b.position;
  }

  return a.createdAt.localeCompare(b.createdAt);
}

export function buildPageTree(pagesById: Record<string, PageRecord>): PageTreeNode[] {
  const allPages = Object.values(pagesById).sort(sortPages);
  const childrenMap = new Map<string | null, PageRecord[]>();

  for (const page of allPages) {
    const key = page.parentId;
    const bucket = childrenMap.get(key) ?? [];
    bucket.push(page);
    childrenMap.set(key, bucket);
  }

  const buildNodes = (parentId: string | null): PageTreeNode[] =>
    (childrenMap.get(parentId) ?? []).map((page) => ({
      page,
      children: buildNodes(page.id),
    }));

  return buildNodes(null);
}

export function getDescendantPageIds(
  pageId: string,
  pagesById: Record<string, PageRecord>,
): string[] {
  const ids = [pageId];

  for (const page of Object.values(pagesById)) {
    if (page.parentId === pageId) {
      ids.push(...getDescendantPageIds(page.id, pagesById));
    }
  }

  return ids;
}

export function pickNextActivePageId(
  pageId: string,
  pagesById: Record<string, PageRecord>,
): string | null {
  const remaining = Object.values(pagesById)
    .filter((page) => page.id !== pageId)
    .sort(sortPages);

  return remaining[0]?.id ?? null;
}

export function searchPages(
  pagesById: Record<string, PageRecord>,
  query: string,
): PageRecord[] {
  const normalizedQuery = query.trim().toLowerCase();
  const pages = Object.values(pagesById).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (!normalizedQuery) {
    return pages;
  }

  return pages.filter((page) => page.title.toLowerCase().includes(normalizedQuery));
}

export function buildPagePath(
  pageId: string,
  pagesById: Record<string, PageRecord>,
): string[] {
  const labels: string[] = [];
  let current: PageRecord | undefined = pagesById[pageId];

  while (current) {
    labels.unshift(current.title);
    current = current.parentId ? pagesById[current.parentId] : undefined;
  }

  return labels;
}
