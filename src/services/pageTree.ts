import type { BlockRecord, PageRecord, PageSearchResult, PageTreeNode } from '../types/domain.js';

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
  blocksByPageId: Record<string, BlockRecord[]>,
  query: string,
): PageSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  const pages = Object.values(pagesById).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (!normalizedQuery) {
    return pages.map((page) => ({
      page,
      path: buildPagePath(page.id, pagesById),
      matchedIn: 'title',
      preview: page.parentId ? 'Recently updated in nested workspace' : 'Recently updated top-level page',
    }));
  }

  return pages
    .map((page) => {
      const path = buildPagePath(page.id, pagesById);
      const joinedPath = path.join(' / ');
      const titleMatches = page.title.toLowerCase().includes(normalizedQuery);
      const pathMatches = joinedPath.toLowerCase().includes(normalizedQuery);
      const blockMatch = (blocksByPageId[page.id] ?? []).find((block) =>
        block.content.trim().length > 0 && block.content.toLowerCase().includes(normalizedQuery),
      );

      if (!titleMatches && !pathMatches && !blockMatch) {
        return null;
      }

      const matchedIn = titleMatches ? 'title' : pathMatches ? 'path' : 'content';
      const score = (titleMatches ? 300 : 0) + (pathMatches ? 120 : 0) + (blockMatch ? 180 : 0);

      return {
        page,
        path,
        matchedIn,
        preview: blockMatch
          ? createSearchPreview(blockMatch.content, normalizedQuery)
          : pathMatches
            ? `Path: ${joinedPath}`
            : page.parentId
              ? `Inside ${path.slice(0, -1).join(' / ')}`
              : 'Top-level page',
        score,
      };
    })
    .filter((result): result is PageSearchResult & { score: number } => Boolean(result))
    .sort((a, b) => b.score - a.score || b.page.updatedAt.localeCompare(a.page.updatedAt))
    .map(({ score: _score, ...result }) => result);
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

function createSearchPreview(content: string, normalizedQuery: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return 'Empty block';
  }

  const normalizedContent = compact.toLowerCase();
  const matchIndex = normalizedContent.indexOf(normalizedQuery);

  if (matchIndex === -1 || compact.length <= 96) {
    return compact;
  }

  const start = Math.max(0, matchIndex - 28);
  const end = Math.min(compact.length, matchIndex + normalizedQuery.length + 44);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < compact.length ? '…' : '';

  return `${prefix}${compact.slice(start, end)}${suffix}`;
}
