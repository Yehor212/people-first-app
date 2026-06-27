import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Stub morph() to run its callback synchronously — tests page state, not VT API.
vi.mock("@/lib/motion/morph", () => ({
  morph: vi.fn(async (_name: string, fn: () => void | Promise<void>) => {
    await fn();
  }),
  morphTiming: { durationMs: 420, ease: () => 0 },
}));

import { useNavigationV2, NAV_V2_PAGES, type NavV2Page } from "../useNavigationV2";
import { morph } from "@/lib/motion/morph";

const STORAGE_KEY = "zen-nav-v2-last-page";

function setPath(path: string): void {
  window.history.replaceState({}, "", path);
}

describe("useNavigationV2", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setPath("/");
    vi.mocked(morph).mockClear();
  });
  afterEach(() => {
    setPath("/");
  });

  describe("initial page derivation", () => {
    it("defaults to 'orb' when no URL and no storage", () => {
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.activePage).toBe<NavV2Page>("orb");
      expect(result.current.unknownPath).toBeNull();
    });

    it("derives initial page from URL path when one of the V2 routes matches", () => {
      setPath("/diary");
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.activePage).toBe<NavV2Page>("diary");
    });

    it("derives initial page from the Planning URL path", () => {
      setPath("/planning?nav=v2&navLayout=phone");
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.activePage).toBe<NavV2Page>("planning");
      expect(result.current.unknownPath).toBeNull();
    });

    it("derives initial page from GitHub Pages directory URLs with trailing slash", () => {
      setPath("/habits/");
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.activePage).toBe<NavV2Page>("habits");
      expect(result.current.unknownPath).toBeNull();
    });

    it("URL takes priority over localStorage", () => {
      window.localStorage.setItem(STORAGE_KEY, "settings");
      setPath("/habits");
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.activePage).toBe<NavV2Page>("habits");
    });

    it("falls back to stored page when URL is bare '/'", () => {
      window.localStorage.setItem(STORAGE_KEY, "settings");
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.activePage).toBe<NavV2Page>("settings");
    });

    it("ignores invalid stored values", () => {
      window.localStorage.setItem(STORAGE_KEY, "not-a-real-page");
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.activePage).toBe<NavV2Page>("orb");
    });

    it("flags unknown deep links instead of silently treating them as Orb", () => {
      setPath("/missing-route?nav=v2");
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.activePage).toBe<NavV2Page>("orb");
      expect(result.current.unknownPath).toBe("/missing-route");
    });

    it("treats bundled desktop index.html as the app root", () => {
      window.localStorage.setItem(STORAGE_KEY, "diary");
      setPath("/index.html");
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.activePage).toBe<NavV2Page>("diary");
      expect(result.current.unknownPath).toBeNull();
    });

    it("consumes a native diary deep-link override after the first route snapshot", async () => {
      const {
        hasPendingNativeDiaryDeepLink,
        markNativeDiaryDeepLinkRequested,
      } = await import("@/lib/nativeDiaryDeepLinkSignal");

      setPath("/settings");
      markNativeDiaryDeepLinkRequested();

      const first = renderHook(() => useNavigationV2());
      expect(first.result.current.activePage).toBe<NavV2Page>("diary");
      expect(hasPendingNativeDiaryDeepLink()).toBe(false);
      first.unmount();

      const second = renderHook(() => useNavigationV2());
      expect(second.result.current.activePage).toBe<NavV2Page>("settings");
      second.unmount();
    });
  });

  describe("setActivePage", () => {
    it("lets a phone drawer close paint on the next frame before mounting a skipped route", async () => {
      const rafCallbacks: FrameRequestCallback[] = [];
      const requestAnimationFrameSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback) => {
          rafCallbacks.push(callback);
          return rafCallbacks.length;
        });
      const cancelAnimationFrameSpy = vi
        .spyOn(window, "cancelAnimationFrame")
        .mockImplementation(() => undefined);

      try {
        const { result } = renderHook(() => useNavigationV2());

        act(() => result.current.openDrawer());
        expect(result.current.drawerOpen).toBe(true);

        await act(async () => {
          result.current.setActivePage("habits", { skipTransition: true });
        });

        expect(result.current.drawerOpen).toBe(false);
        expect(result.current.activePage).toBe<NavV2Page>("orb");
        expect(window.location.pathname).toBe("/");
        expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
          rafCallbacks.shift()?.(performance.now());
        });

        expect(result.current.activePage).toBe<NavV2Page>("habits");
        expect(window.location.pathname).toBe("/habits");
        expect(morph).not.toHaveBeenCalled();
      } finally {
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
      }
    });

    it("updates state, URL, and localStorage and wraps in morph()", async () => {
      const { result } = renderHook(() => useNavigationV2());
      await act(async () => {
        result.current.setActivePage("habits");
      });
      expect(result.current.activePage).toBe<NavV2Page>("habits");
      expect(result.current.unknownPath).toBeNull();
      expect(window.location.pathname).toBe("/habits");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("habits");
      expect(morph).toHaveBeenCalledWith("page-habits", expect.any(Function));
    });

    it("can skip morph for phone drawer navigation", async () => {
      const { result } = renderHook(() => useNavigationV2());
      await act(async () => {
        result.current.setActivePage("habits", { skipTransition: true });
      });
      expect(result.current.activePage).toBe<NavV2Page>("habits");
      expect(window.location.pathname).toBe("/habits");
      expect(morph).not.toHaveBeenCalled();
    });

    it("preserves existing query params across navigation", async () => {
      setPath("/orb?nav=v2&debug=1");
      const { result } = renderHook(() => useNavigationV2());
      await act(async () => {
        result.current.setActivePage("diary");
      });
      expect(window.location.pathname).toBe("/diary");
      expect(window.location.search).toContain("nav=v2");
    });

    it("closes drawer when navigating", async () => {
      const { result } = renderHook(() => useNavigationV2());
      act(() => result.current.openDrawer());
      expect(result.current.drawerOpen).toBe(true);
      await act(async () => {
        result.current.setActivePage("settings");
      });
      expect(result.current.drawerOpen).toBe(false);
    });

    it("visits all 5 pages in sequence without losing state", async () => {
      const { result } = renderHook(() => useNavigationV2());
      expect(NAV_V2_PAGES).toEqual(["orb", "habits", "diary", "planning", "settings"]);
      for (const page of NAV_V2_PAGES) {
        await act(async () => {
          result.current.setActivePage(page);
        });
        expect(result.current.activePage).toBe(page);
      }
    });
  });

  describe("sidebar rail mode", () => {
    it("starts expanded and toggles collapsed state", () => {
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.sidebarCollapsed).toBe(false);
      act(() => result.current.toggleSidebar());
      expect(result.current.sidebarCollapsed).toBe(true);
      act(() => result.current.toggleSidebar());
      expect(result.current.sidebarCollapsed).toBe(false);
    });
  });

  describe("drawer", () => {
    it("opens and closes via explicit actions", () => {
      const { result } = renderHook(() => useNavigationV2());
      expect(result.current.drawerOpen).toBe(false);
      act(() => result.current.openDrawer());
      expect(result.current.drawerOpen).toBe(true);
      act(() => result.current.closeDrawer());
      expect(result.current.drawerOpen).toBe(false);
    });
  });

  describe("handleBackButton (Android/hardware back precedence)", () => {
    it("returns true + closes drawer when drawer is open", () => {
      const { result } = renderHook(() => useNavigationV2());
      act(() => result.current.openDrawer());
      let handled = false;
      act(() => {
        handled = result.current.handleBackButton();
      });
      expect(handled).toBe(true);
      expect(result.current.drawerOpen).toBe(false);
    });

    it("returns true + closes command palette when palette is open", () => {
      const { result } = renderHook(() => useNavigationV2());
      act(() => result.current.setCommandPaletteOpen(true));
      let handled = false;
      act(() => {
        handled = result.current.handleBackButton();
      });
      expect(handled).toBe(true);
      expect(result.current.commandPaletteOpen).toBe(false);
    });

    it("returns false when nothing is open (caller handles page back)", () => {
      const { result } = renderHook(() => useNavigationV2());
      let handled = true;
      act(() => {
        handled = result.current.handleBackButton();
      });
      expect(handled).toBe(false);
    });

    it("drawer takes precedence over command palette", () => {
      const { result } = renderHook(() => useNavigationV2());
      act(() => {
        result.current.openDrawer();
        result.current.setCommandPaletteOpen(true);
      });
      act(() => {
        result.current.handleBackButton();
      });
      expect(result.current.drawerOpen).toBe(false);
      expect(result.current.commandPaletteOpen).toBe(true);
    });
  });

  describe("browser back/forward (popstate)", () => {
    it("updates activePage when URL changes via popstate", async () => {
      const { result } = renderHook(() => useNavigationV2());
      // Simulate browser back landing on /diary
      window.history.replaceState({}, "", "/diary");
      await act(async () => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(result.current.activePage).toBe<NavV2Page>("diary");
    });

    it("keeps active page but exposes Not Found state when URL is not a V2 page", async () => {
      const { result } = renderHook(() => useNavigationV2());
      const before = result.current.activePage;
      window.history.replaceState({}, "", "/some-unrelated-path");
      await act(async () => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(result.current.activePage).toBe(before);
      expect(result.current.unknownPath).toBe("/some-unrelated-path");
    });
  });
});
