import { forwardRef } from 'react';

import { buildPagePath, buildPageTree, searchPages } from '../../services/pageTree';
import type { PageRecord } from '../../types/domain';
import { EmptyState } from '../ui/EmptyState';
import { PageTreeItem } from './PageTreeItem';

interface SidebarProps {
  pagesById: Record<string, PageRecord>;
  activePageId: string | null;
  recentPageIds: string[];
  searchQuery: string;
  searchResultsQuery: string;
  sidebarOpen: boolean;
  onSearchQueryChange: (value: string) => void;
  onSelectPage: (pageId: string) => void;
  onCreateRootPage: () => void;
  onCreateNestedPage: (pageId: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onDeletePage: (pageId: string) => void;
}

export const Sidebar = forwardRef<HTMLInputElement, SidebarProps>(function Sidebar(
  {
    pagesById,
    activePageId,
    recentPageIds,
    searchQuery,
    searchResultsQuery,
    sidebarOpen,
    onSearchQueryChange,
    onSelectPage,
    onCreateRootPage,
    onCreateNestedPage,
    onRenamePage,
    onDeletePage,
  },
  searchRef,
) {
  const tree = buildPageTree(pagesById);
  const searchResults = searchPages(pagesById, searchResultsQuery);
  const recentPages = recentPageIds.map((pageId) => pagesById[pageId]).filter(Boolean);
  const hasPages = Object.keys(pagesById).length > 0;

  return (
    <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar__header">
        <div>
          <span className="sidebar__eyebrow">Workspace</span>
          <h1 className="sidebar__title">Documents</h1>
        </div>
        <button type="button" className="primary-button" onClick={onCreateRootPage}>
          New page
        </button>
      </div>

      <label className="search-field">
        <input
          ref={searchRef}
          value={searchQuery}
          placeholder="Search pages"
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
        <span>Ctrl/Cmd+K</span>
      </label>

      {!hasPages ? (
        <EmptyState
          eyebrow="Empty"
          title="Start with a page"
          description="Create a document and begin structuring your workspace."
          action={
            <button type="button" className="primary-button" onClick={onCreateRootPage}>
              Create first page
            </button>
          }
        />
      ) : searchResultsQuery.trim() ? (
        <div className="sidebar__section">
          <span className="sidebar__section-label">Search results</span>
          <div className="search-results">
            {searchResults.length > 0 ? (
              searchResults.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`search-result ${page.id === activePageId ? 'search-result--active' : ''}`}
                  onClick={() => onSelectPage(page.id)}
                >
                  <span className="search-result__title">{page.title}</span>
                  <span className="search-result__path">{buildPagePath(page.id, pagesById).join(' / ')}</span>
                </button>
              ))
            ) : (
              <div className="search-result search-result--empty">
                <span className="search-result__title">No pages found</span>
                <span className="search-result__path">Try a different title or create a new page.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="sidebar__section">
            <span className="sidebar__section-label">Pages</span>
            <div className="page-tree">
              {tree.map((node) => (
                <PageTreeItem
                  key={node.page.id}
                  node={node}
                  depth={0}
                  activePageId={activePageId}
                  onSelectPage={onSelectPage}
                  onCreateNestedPage={onCreateNestedPage}
                  onRenamePage={onRenamePage}
                  onDeletePage={onDeletePage}
                />
              ))}
            </div>
          </div>

          {recentPages.length > 0 ? (
            <div className="sidebar__section sidebar__section--recent">
              <span className="sidebar__section-label">Recent</span>
              <div className="search-results">
                {recentPages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className={`search-result ${page.id === activePageId ? 'search-result--active' : ''}`}
                    onClick={() => onSelectPage(page.id)}
                  >
                    <span className="search-result__title">{page.title}</span>
                    <span className="search-result__path">
                      {page.parentId ? buildPagePath(page.id, pagesById).slice(0, -1).join(' / ') : 'Top level'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
});
