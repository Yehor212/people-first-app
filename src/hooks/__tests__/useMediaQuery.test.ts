import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery } from "../useMediaQuery";

type MqlMock = {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  onchange: ((e: MediaQueryListEvent) => void) | null;
};

function mockMatchMedia(initial: boolean): { mql: MqlMock; restore: () => void } {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql: MqlMock = {
    matches: initial,
    media: "",
    addEventListener: vi.fn((_type: string, handler: (e: MediaQueryListEvent) => void) => {
      listeners.add(handler);
    }),
    removeEventListener: vi.fn((_type: string, handler: (e: MediaQueryListEvent) => void) => {
      listeners.delete(handler);
    }),
    onchange: null,
  };
  const originalMm = window.matchMedia;
  window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList) as typeof window.matchMedia;
  // Attach dispatcher for tests.
  (mql as MqlMock & { dispatchChange: (matches: boolean) => void }).dispatchChange = (matches: boolean) => {
    mql.matches = matches;
    listeners.forEach((h) => h({ matches } as MediaQueryListEvent));
  };
  return {
    mql,
    restore: () => {
      window.matchMedia = originalMm;
    },
  };
}

describe("useMediaQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the current match state on initial render", () => {
    const { restore } = mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(prefers-reduced-motion: reduce)"));
    expect(result.current).toBe(true);
    restore();
  });

  it("updates when the media query changes", () => {
    const { mql, restore } = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(prefers-reduced-motion: reduce)"));
    expect(result.current).toBe(false);

    act(() => {
      (mql as MqlMock & { dispatchChange: (matches: boolean) => void }).dispatchChange(true);
    });
    expect(result.current).toBe(true);
    restore();
  });

  it("removes the change listener on unmount (no leaks)", () => {
    const { mql, restore } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    restore();
  });

  it("returns false when matchMedia is unavailable (SSR-safe guard)", () => {
    const original = window.matchMedia;
    // Simulate SSR-like environment by removing matchMedia.
    (window as unknown as { matchMedia: unknown }).matchMedia = undefined;
    const { result } = renderHook(() => useMediaQuery("(prefers-reduced-motion: reduce)"));
    expect(result.current).toBe(false);
    window.matchMedia = original;
  });
});
