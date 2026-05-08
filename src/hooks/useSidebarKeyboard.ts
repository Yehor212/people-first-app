import { useEffect } from 'react';
import type { SidebarState } from '@/hooks/useSidebarState';

/**
 * Keyboard shortcuts for diary sidebar toggling.
 * - Ctrl+\ or Cmd+\: toggles expanded ↔ collapsed
 * - Ctrl+Shift+\ or Cmd+Shift+\: same explicit disclosure toggle
 */
export function useSidebarKeyboard(
  sidebarState: SidebarState,
  toggleSidebar: () => SidebarState,
  setSidebarState: (s: SidebarState) => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '\\') return;
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();

      if (e.shiftKey) {
        setSidebarState(sidebarState === 'expanded' ? 'collapsed' : 'expanded');
      } else {
        toggleSidebar();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sidebarState, toggleSidebar, setSidebarState]);
}
