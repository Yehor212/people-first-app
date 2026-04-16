import { useState } from 'react';
import { SK } from '@/lib/storageKeys';
import { storageGetRaw, storageSetRaw } from '@/lib/safeJson';

export type SidebarState = 'expanded' | 'compact' | 'hidden';

const CYCLE_ORDER: Record<SidebarState, SidebarState> = {
  expanded: 'compact',
  compact: 'hidden',
  hidden: 'expanded',
};

export function useSidebarState() {
  const [sidebarState, setSidebarStateInternal] = useState<SidebarState>(
    () => storageGetRaw(SK.JOURNAL_SIDEBAR_STATE, 'expanded') as SidebarState,
  );

  const setSidebarState = (state: SidebarState) => {
    setSidebarStateInternal(state);
    storageSetRaw(SK.JOURNAL_SIDEBAR_STATE, state);
  };

  const toggleSidebar = () => {
    setSidebarState(CYCLE_ORDER[sidebarState]);
  };

  const isExpanded = sidebarState === 'expanded';
  const isCompact = sidebarState === 'compact';
  const isHidden = sidebarState === 'hidden';

  return {
    sidebarState,
    setSidebarState,
    toggleSidebar,
    isExpanded,
    isCompact,
    isHidden,
  };
}
