import type { BlockRecord, PageRecord } from '../../types/domain';
import { BlockEditor } from './BlockEditor';

interface EditorPaneProps {
  page: PageRecord;
  blocks: BlockRecord[];
  canUndo: boolean;
  canRedo: boolean;
  onRenamePage: (pageId: string, title: string) => void;
  onBlocksChange: (pageId: string, blocks: BlockRecord[]) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function EditorPane({
  page,
  blocks,
  canUndo,
  canRedo,
  onRenamePage,
  onBlocksChange,
  onUndo,
  onRedo,
}: EditorPaneProps) {
  return (
    <section className="editor-pane">
      <div className="editor-pane__header">
        <div className="editor-pane__title-wrap">
          <span className="editor-pane__eyebrow">Document</span>
          <input
            className="editor-pane__title"
            value={page.title}
            onChange={(event) => onRenamePage(page.id, event.target.value)}
          />
        </div>

        <div className="editor-pane__actions">
          <button type="button" className="secondary-button" onClick={onUndo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" className="secondary-button" onClick={onRedo} disabled={!canRedo}>
            Redo
          </button>
        </div>
      </div>

      <div className="editor-pane__meta">
        <span>{blocks.length} blocks</span>
        <span>Type / for commands</span>
        <span>Alt+Arrow to move</span>
      </div>

      <BlockEditor pageId={page.id} blocks={blocks} onBlocksChange={(nextBlocks) => onBlocksChange(page.id, nextBlocks)} />
    </section>
  );
}
