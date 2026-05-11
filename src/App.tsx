import { startTransition, useDeferredValue, useRef, useState } from 'react';

import { EditorPane } from './components/editor/EditorPane';
import { Sidebar } from './components/layout/Sidebar';
import { TitleBar } from './components/layout/TitleBar';
import { EmptyState } from './components/ui/EmptyState';
import { useHotkeys } from './hooks/useHotkeys';
import { useWindowStatePersistence } from './hooks/useWindowStatePersistence';
import { useWorkspace } from './hooks/useWorkspace';

export default function App() {
  const workspace = useWorkspace();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const deferredQuery = useDeferredValue(workspace.state.searchQuery);

  useWindowStatePersistence();

  useHotkeys([
    {
      key: 'k',
      meta: true,
      handler: (event) => {
        event.preventDefault();
        searchRef.current?.focus();
      },
    },
    {
      key: 'k',
      ctrl: true,
      handler: (event) => {
        event.preventDefault();
        searchRef.current?.focus();
      },
    },
    {
      key: 'n',
      meta: true,
      handler: (event) => {
        event.preventDefault();
        void workspace.createPage(workspace.currentPage?.parentId ?? null);
      },
    },
    {
      key: 'n',
      ctrl: true,
      handler: (event) => {
        event.preventDefault();
        void workspace.createPage(workspace.currentPage?.parentId ?? null);
      },
    },
    {
      key: 'z',
      meta: true,
      handler: (event) => {
        event.preventDefault();
        workspace.undoPage();
      },
    },
    {
      key: 'z',
      ctrl: true,
      handler: (event) => {
        event.preventDefault();
        workspace.undoPage();
      },
    },
    {
      key: 'z',
      meta: true,
      shift: true,
      handler: (event) => {
        event.preventDefault();
        workspace.redoPage();
      },
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      handler: (event) => {
        event.preventDefault();
        workspace.redoPage();
      },
    },
  ]);

  const currentPageTitle = workspace.currentPage?.title ?? 'No page selected';

  return (
    <div className="app-shell">
      <TitleBar
        pageTitle={currentPageTitle}
        saveState={workspace.state.saveState}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((current) => !current)}
      />

      <div className="workspace-layout">
        <Sidebar
          ref={searchRef}
          pagesById={workspace.state.pagesById}
          activePageId={workspace.state.activePageId}
          recentPageIds={workspace.state.recentPageIds}
          searchQuery={workspace.state.searchQuery}
          searchResultsQuery={deferredQuery}
          sidebarOpen={sidebarOpen}
          onSearchQueryChange={workspace.setSearchQuery}
          onSelectPage={(pageId) => {
            startTransition(() => {
              workspace.setActivePage(pageId);
              setSidebarOpen(false);
            });
          }}
          onCreateRootPage={() => void workspace.createPage(null)}
          onCreateNestedPage={(pageId) => void workspace.createPage(pageId)}
          onRenamePage={workspace.renamePage}
          onDeletePage={(pageId) => void workspace.deletePage(pageId)}
        />

        <main className="workspace-main">
          {workspace.state.status === 'loading' ? (
            <EmptyState
              eyebrow="Loading"
              title="Opening workspace"
              description="Initializing shell, restoring state and loading local documents."
            />
          ) : workspace.state.status === 'error' ? (
            <EmptyState
              eyebrow="Error"
              title="Workspace failed to load"
              description={workspace.state.errorMessage ?? 'An unknown error interrupted startup.'}
            />
          ) : workspace.currentPage ? (
            <EditorPane
              page={workspace.currentPage}
              blocks={workspace.currentBlocks}
              canUndo={workspace.canUndo}
              canRedo={workspace.canRedo}
              onRenamePage={workspace.renamePage}
              onBlocksChange={workspace.setPageBlocks}
              onUndo={workspace.undoPage}
              onRedo={workspace.redoPage}
            />
          ) : (
            <EmptyState
              eyebrow="Quiet"
              title="Select a document"
              description="Choose a page from the sidebar or create a new one to begin writing."
              action={
                <button type="button" className="primary-button" onClick={() => void workspace.createPage(null)}>
                  New page
                </button>
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
