import { useEffect } from 'react';
import { StateFlags, saveWindowState } from '@tauri-apps/plugin-window-state';

export function useWindowStatePersistence(): void {
  useEffect(() => {
    const persistWindowState = () => {
      void saveWindowState(StateFlags.ALL);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistWindowState();
      }
    };

    window.addEventListener('beforeunload', persistWindowState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', persistWindowState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
