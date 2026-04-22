import { useRef, useState } from "react";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";

export type SidebarState = "expanded" | "compact" | "hidden";
type VisibleSidebarState = Exclude<SidebarState, "hidden">;

const CYCLE_ORDER: Record<SidebarState, SidebarState> = {
  expanded: "compact",
  compact: "hidden",
  hidden: "expanded",
};

function readInitialState(): SidebarState {
  return storageGetRaw(SK.JOURNAL_SIDEBAR_STATE, "expanded") as SidebarState;
}

export function useSidebarState() {
  const [sidebarState, setSidebarStateInternal] = useState<SidebarState>(readInitialState);
  const lastVisibleStateRef = useRef<VisibleSidebarState>(
    sidebarState === "hidden" ? "expanded" : sidebarState,
  );

  const setSidebarState = (state: SidebarState): SidebarState => {
    if (state !== "hidden") {
      lastVisibleStateRef.current = state;
    }

    setSidebarStateInternal(state);
    storageSetRaw(SK.JOURNAL_SIDEBAR_STATE, state);

    return state;
  };

  const toggleSidebar = (): SidebarState => setSidebarState(CYCLE_ORDER[sidebarState]);

  const restoreSidebar = (): VisibleSidebarState => {
    const nextState = lastVisibleStateRef.current;
    setSidebarState(nextState);
    return nextState;
  };

  const toggleSidebarVisibility = (): SidebarState => {
    if (sidebarState === "hidden") {
      return restoreSidebar();
    }

    return setSidebarState("hidden");
  };

  const toggleSidebarCollapsed = (): VisibleSidebarState => {
    if (sidebarState === "expanded") {
      setSidebarState("compact");
      return "compact";
    }

    if (sidebarState === "compact") {
      setSidebarState("expanded");
      return "expanded";
    }

    return restoreSidebar();
  };

  const isExpanded = sidebarState === "expanded";
  const isCompact = sidebarState === "compact";
  const isHidden = sidebarState === "hidden";
  const isVisible = !isHidden;

  return {
    sidebarState,
    setSidebarState,
    toggleSidebar,
    restoreSidebar,
    toggleSidebarVisibility,
    toggleSidebarCollapsed,
    isExpanded,
    isCompact,
    isHidden,
    isVisible,
  };
}
