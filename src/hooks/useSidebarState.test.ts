import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { storageGetRaw, storageRemove, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

import { useSidebarState } from "./useSidebarState";

describe("useSidebarState", () => {
  beforeEach(() => {
    storageRemove(SK.JOURNAL_SIDEBAR_STATE);
  });

  afterEach(() => {
    storageRemove(SK.JOURNAL_SIDEBAR_STATE);
  });

  it("defaults to expanded", () => {
    const { result } = renderHook(() => useSidebarState());

    expect(result.current.sidebarState).toBe("expanded");
    expect(result.current.isExpanded).toBe(true);
    expect(result.current.isCollapsed).toBe(false);
  });

  it("migrates legacy compact state to collapsed", () => {
    storageSetRaw(SK.JOURNAL_SIDEBAR_STATE, "compact");

    const { result } = renderHook(() => useSidebarState());

    expect(result.current.sidebarState).toBe("collapsed");
    expect(storageGetRaw(SK.JOURNAL_SIDEBAR_STATE)).toBe("collapsed");
  });

  it("migrates legacy hidden state to collapsed", () => {
    storageSetRaw(SK.JOURNAL_SIDEBAR_STATE, "hidden");

    const { result } = renderHook(() => useSidebarState());

    expect(result.current.sidebarState).toBe("collapsed");
    expect(storageGetRaw(SK.JOURNAL_SIDEBAR_STATE)).toBe("collapsed");
  });

  it("toggles between expanded and collapsed only", () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.toggleSidebar();
    });

    expect(result.current.sidebarState).toBe("collapsed");
    expect(storageGetRaw(SK.JOURNAL_SIDEBAR_STATE)).toBe("collapsed");

    act(() => {
      result.current.toggleSidebar();
    });

    expect(result.current.sidebarState).toBe("expanded");
    expect(storageGetRaw(SK.JOURNAL_SIDEBAR_STATE)).toBe("expanded");
  });
});
