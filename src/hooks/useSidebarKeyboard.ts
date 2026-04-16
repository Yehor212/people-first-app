import { useEffect } from 'react';
import type { SidebarState } from '@/hooks/useSidebarState';

/**
 * Keyboard shortcuts for sidebar state toggling.
 * - Ctrl+\ or Cmd+\: cycles through expanded → compact → hidden
 * - Ctrl+Shift+\ or Cmd+Shift+\: toggles between compact and hidden
 */
export function useSidebarKeyboard(
  sidebarState: SidebarState,
  toggleSidebar: () => void,
  setSidebarState: (s: SidebarState) => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '\\') return;
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();

      if (e.shiftKey) {
        // Ctrl+Shift+\ or Cmd+Shift+\: toggle between compact and hidden
        setSidebarState(sidebarState === 'hidden' ? 'compact' : 'hidden');
      } else {
        // Ctrl+\ or Cmd+\: cycle through states
        toggleSidebar();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sidebarState, toggleSidebar, setSidebarState]);
}
