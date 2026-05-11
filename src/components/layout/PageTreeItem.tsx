import { useState } from 'react';

import type { PageTreeNode } from '../../types/domain';

interface PageTreeItemProps {
  node: PageTreeNode;
  depth: number;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onCreateNestedPage: (pageId: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onDeletePage: (pageId: string) => void;
}

export function PageTreeItem({
  node,
  depth,
  activePageId,
  onSelectPage,
  onCreateNestedPage,
  onRenamePage,
  onDeletePage,
}: PageTreeItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.page.title);

  const isActive = activePageId === node.page.id;

  return (
    <div className="page-tree-item">
      <div
        className={`page-tree-item__row ${isActive ? 'page-tree-item__row--active' : ''}`}
        style={{ paddingLeft: `${14 + depth * 14}px` }}
      >
        <button
          type="button"
          className="page-tree-item__button"
          onClick={() => onSelectPage(node.page.id)}
        >
          <span className="page-tree-item__bullet" />
          {isEditing ? (
            <input
              autoFocus
              value={draftTitle}
              className="page-tree-item__input"
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={() => {
                onRenamePage(node.page.id, draftTitle.trim() || 'Untitled');
                setIsEditing(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onRenamePage(node.page.id, draftTitle.trim() || 'Untitled');
                  setIsEditing(false);
                }

                if (event.key === 'Escape') {
                  setDraftTitle(node.page.title);
                  setIsEditing(false);
                }
              }}
            />
          ) : (
            <span className="page-tree-item__title">{node.page.title}</span>
          )}
        </button>

        <div className="page-tree-item__actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => onCreateNestedPage(node.page.id)}
            aria-label="Create nested page"
          >
            +
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setDraftTitle(node.page.title);
              setIsEditing(true);
            }}
            aria-label="Rename page"
          >
            ↲
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => onDeletePage(node.page.id)}
            aria-label="Delete page"
          >
            ×
          </button>
        </div>
      </div>

      {node.children.map((child) => (
        <PageTreeItem
          key={child.page.id}
          node={child}
          depth={depth + 1}
          activePageId={activePageId}
          onSelectPage={onSelectPage}
          onCreateNestedPage={onCreateNestedPage}
          onRenamePage={onRenamePage}
          onDeletePage={onDeletePage}
        />
      ))}
    </div>
  );
}
