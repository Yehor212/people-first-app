import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInputMethod } from "./useInputMethod";

const mockPointer = (coarse: boolean, hover: boolean) => {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("coarse") ? coarse : query.includes("hover: hover") ? hover : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe("useInputMethod", () => {
  afterEach(() => vi.restoreAllMocks());

  it("detects mouse (fine pointer + hover)", () => {
    mockPointer(false, true);
    const { result } = renderHook(() => useInputMethod());
    expect(result.current.method).toBe("mouse");
    expect(result.current.isMouse).toBe(true);
    expect(result.current.canHover).toBe(true);
  });
  it("detects touch (coarse pointer + no hover)", () => {
    mockPointer(true, false);
    const { result } = renderHook(() => useInputMethod());
    expect(result.current.method).toBe("touch");
    expect(result.current.isTouch).toBe(true);
  });
});
