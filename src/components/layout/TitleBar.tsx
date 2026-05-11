import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import type { SaveState } from '../../types/domain';

interface TitleBarProps {
  pageTitle: string;
  saveState: SaveState;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const appWindow = getCurrentWindow();

export function TitleBar({ pageTitle, saveState, sidebarOpen, onToggleSidebar }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    void appWindow.isMaximized().then(setIsMaximized);
  }, []);

  const saveLabel = saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved' : 'Offline';

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar__leading" data-tauri-drag-region>
        <button
          type="button"
          className="ghost-button ghost-button--square mobile-only"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <span />
          <span />
          <span />
        </button>
        <span className="titlebar__product">Noir Note</span>
        <span className="titlebar__divider" />
        <span className="titlebar__page">{pageTitle || 'Workspace'}</span>
      </div>

      <div className="titlebar__meta" data-tauri-drag-region>
        <span className="titlebar__status">{saveLabel}</span>
        <span className="titlebar__hint">Ctrl/Cmd+K search</span>
      </div>

      <div className="titlebar__controls">
        <button
          type="button"
          className="window-control"
          onClick={() => void appWindow.minimize()}
          aria-label="Minimize window"
        >
          -
        </button>
        <button
          type="button"
          className="window-control"
          onClick={async () => {
            await appWindow.toggleMaximize();
            setIsMaximized(await appWindow.isMaximized());
          }}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        >
          {isMaximized ? '◱' : '□'}
        </button>
        <button
          type="button"
          className="window-control window-control--danger"
          onClick={() => void appWindow.close()}
          aria-label="Close window"
        >
          ×
        </button>
      </div>
    </header>
  );
}
