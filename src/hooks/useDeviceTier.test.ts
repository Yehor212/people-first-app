import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDeviceTier } from "./useDeviceTier";

const mockMatchMedia = (width: number) => {
  window.matchMedia = vi.fn((query: string) => {
    const min = query.match(/min-width:\s*(\d+)px/);
    return {
      matches: min ? width >= parseInt(min[1]) : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
};

describe("useDeviceTier", () => {
  it("phone for 375px", () => {
    mockMatchMedia(375);
    const { result } = renderHook(() => useDeviceTier());
    expect(result.current.tier).toBe("phone");
    expect(result.current.isDesktopClass).toBe(false);
  });
  it("tablet for 900px", () => {
    mockMatchMedia(900);
    const { result } = renderHook(() => useDeviceTier());
    expect(result.current.tier).toBe("tablet");
  });
  it("laptop for 1200px", () => {
    mockMatchMedia(1200);
    const { result } = renderHook(() => useDeviceTier());
    expect(result.current.tier).toBe("laptop");
    expect(result.current.isDesktopClass).toBe(true);
    expect(result.current.supportsMultiPanel).toBe(true);
  });
  it("desktop for 1920px", () => {
    mockMatchMedia(1920);
    const { result } = renderHook(() => useDeviceTier());
    expect(result.current.tier).toBe("desktop");
  });
});
