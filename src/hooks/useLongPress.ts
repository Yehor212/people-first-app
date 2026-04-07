/**
 * useLongPress — Unified context menu trigger for mobile + desktop
 *
 * Mobile: long-press (500ms) triggers callback
 * Desktop: right-click (contextmenu event) triggers callback
 * Both: haptic feedback on trigger (mobile only)
 *
 * Usage:
 *   const longPress = useLongPress(() => openMenu(item));
 *   <div {...longPress}>...</div>
 */
import { useRef, useCallback } from "react";
import { haptics } from "@/lib/haptics";

interface UseLongPressOptions {
  /** Delay in ms before long-press fires (default: 500) */
  delay?: number;
  /** Disable the hook entirely */
  disabled?: boolean;
}

interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function useLongPress(
  callback: () => void,
  options: UseLongPressOptions = {}
): LongPressHandlers {
  const { delay = 500, disabled = false } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    clearTimeout(timerRef.current);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // Only trigger on touch (not mouse — mouse uses contextmenu)
      if (e.pointerType !== "touch") return;

      firedRef.current = false;
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        void haptics.medium();
        callback();
      }, delay);
    },
    [callback, delay, disabled]
  );

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerLeave = useCallback(() => {
    clear();
  }, [clear]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      // On touch, contextmenu fires after long-press — skip if already fired
      if (firedRef.current) return;
      callback();
    },
    [callback, disabled]
  );

  return { onPointerDown, onPointerUp, onPointerLeave, onContextMenu };
}
