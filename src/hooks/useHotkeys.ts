import { useEffect } from 'react';

interface Hotkey {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (event: KeyboardEvent) => void;
}

export function useHotkeys(hotkeys: Hotkey[]): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const hotkey of hotkeys) {
        const isMeta = hotkey.meta === undefined || hotkey.meta === event.metaKey;
        const isCtrl = hotkey.ctrl === undefined || hotkey.ctrl === event.ctrlKey;
        const isShift = hotkey.shift === undefined || hotkey.shift === event.shiftKey;
        const isAlt = hotkey.alt === undefined || hotkey.alt === event.altKey;
        const isKey = event.key.toLowerCase() === hotkey.key.toLowerCase();

        if (isMeta && isCtrl && isShift && isAlt && isKey) {
          hotkey.handler(event);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys]);
}
