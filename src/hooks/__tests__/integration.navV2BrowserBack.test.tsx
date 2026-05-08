/**
 * Phase 3-A.4c-ii-d-c Integration Test #3 — Deep links & browser back/forward.
 *
 * useNavigationV2 writes to history.pushState on setActivePage and listens to
 * popstate to derive the active page from location.pathname. This test walks
 * Orb → Habits → Diary, then fires popstate after replacing the URL back to
 * /habits, and asserts activePage rewinds correctly.
 *
 * We mock `morph()` so the callback runs synchronously (real morph uses the
 * View Transitions API which jsdom doesn't implement).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNavigationV2 } from "../useNavigationV2";

vi.mock("@/lib/motion/morph", () => ({
  morph: (_name: string, run: () => void) => {
    run();
    return Promise.resolve();
  },
}));

describe("Integration #3 — useNavigationV2 browser back/forward sync", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    try {
      window.localStorage.removeItem("zen-nav-v2-last-page");
    } catch {
      // ignore
    }
  });

  it("pushState URL matches setActivePage target", () => {
    const { result } = renderHook(() => useNavigationV2());

    expect(result.current.activePage).toBe("orb");

    act(() => {
      result.current.setActivePage("habits");
    });
    expect(window.location.pathname).toBe("/habits");
    expect(result.current.activePage).toBe("habits");

    act(() => {
      result.current.setActivePage("diary");
    });
    expect(window.location.pathname).toBe("/diary");
    expect(result.current.activePage).toBe("diary");
  });

  it("popstate derives activePage from pathname (rewinds through history)", () => {
    const { result } = renderHook(() => useNavigationV2());

    act(() => {
      result.current.setActivePage("habits");
    });
    act(() => {
      result.current.setActivePage("diary");
    });
    expect(result.current.activePage).toBe("diary");

    // Simulate browser Back → URL goes to /habits, popstate fires
    act(() => {
      window.history.replaceState({}, "", "/habits");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.activePage).toBe("habits");

    // Simulate one more Back → URL to /orb
    act(() => {
      window.history.replaceState({}, "", "/orb");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.activePage).toBe("orb");
  });

  it("popstate to an unknown path keeps current page and marks Not Found", () => {
    const { result } = renderHook(() => useNavigationV2());
    act(() => {
      result.current.setActivePage("settings");
    });
    expect(result.current.activePage).toBe("settings");

    act(() => {
      window.history.replaceState({}, "", "/this-path-is-not-nav-v2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.activePage).toBe("settings");
    expect(result.current.unknownPath).toBe("/this-path-is-not-nav-v2");
  });

  it("preserves ?nav=v2 query string across setActivePage", () => {
    window.history.replaceState({}, "", "/?nav=v2");
    const { result } = renderHook(() => useNavigationV2());

    act(() => {
      result.current.setActivePage("habits");
    });
    expect(window.location.pathname).toBe("/habits");
    expect(window.location.search).toBe("?nav=v2");
  });
});
