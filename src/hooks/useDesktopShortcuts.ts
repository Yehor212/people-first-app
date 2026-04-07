import { useEffect, useRef } from "react";
import { isWeb } from "@/lib/platform";

export interface ShortcutConfig {
  /** Key to match (case-insensitive), e.g. "b", "k", "1" */
  key: string;
  /** Require Ctrl (Windows/Linux) or Cmd (Mac) */
  ctrl?: boolean;
  /** Require Shift */
  shift?: boolean;
  /** Handler invoked when shortcut fires */
  handler: () => void;
  /** Human-readable description (for future help overlay) */
  description: string;
}

/**
 * Registers global keyboard shortcuts on desktop web only.
 *
 * - Skipped entirely on native (Capacitor Android/iOS).
 * - Ignores events originating from INPUT, TEXTAREA, or contentEditable elements.
 * - Supports Ctrl (Win/Linux) / Cmd (Mac) modifier via `ctrl` flag.
 *
 * @example
 * useDesktopShortcuts([
 *   { key: '1', ctrl: true, handler: () => setTab('home'), description: 'Go to Home' },
 * ]);
 */
export function useDesktopShortcuts(shortcuts: ShortcutConfig[]): void {
  // Stable ref so the listener always sees the latest shortcuts
  // without re-registering on every render.
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!isWeb) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Don't intercept when user is typing in form fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      for (const shortcut of shortcutsRef.current) {
        const ctrlMatch = shortcut.ctrl ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // stable — reads from ref
}
