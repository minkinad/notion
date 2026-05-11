import { useEffect, useEffectEvent } from 'react';

interface Hotkey {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (event: KeyboardEvent) => void;
}

export function useHotkeys(hotkeys: Hotkey[]): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT')
    ) {
      return;
    }

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
  });

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);
}
