import { useState } from "react";

import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";

export type SidebarState = "expanded" | "collapsed";

function normalizeSidebarState(raw: unknown): SidebarState {
  if (raw === "expanded") {
    return "expanded";
  }

  if (raw === "compact" || raw === "hidden" || raw === "collapsed") {
    return "collapsed";
  }

  return "expanded";
}

function readInitialState(): SidebarState {
  const raw = storageGetRaw(SK.JOURNAL_SIDEBAR_STATE, "expanded");
  const normalized = normalizeSidebarState(raw);

  if (raw !== normalized) {
    storageSetRaw(SK.JOURNAL_SIDEBAR_STATE, normalized);
  }

  return normalized;
}

export function useSidebarState() {
  const [sidebarState, setSidebarStateInternal] = useState<SidebarState>(readInitialState);

  const setSidebarState = (state: SidebarState): SidebarState => {
    setSidebarStateInternal(state);
    storageSetRaw(SK.JOURNAL_SIDEBAR_STATE, state);
    return state;
  };

  const toggleSidebar = (): SidebarState =>
    setSidebarState(sidebarState === "expanded" ? "collapsed" : "expanded");

  return {
    sidebarState,
    setSidebarState,
    toggleSidebar,
    toggleSidebarCollapsed: toggleSidebar,
    isExpanded: sidebarState === "expanded",
    isCollapsed: sidebarState === "collapsed",
  };
}
