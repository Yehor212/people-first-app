import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFontScale } from "../useFontScale";

describe("useFontScale", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--font-scale");
    vi.restoreAllMocks();
  });

  it("persists before committing the visible text scale", () => {
    const { result } = renderHook(() => useFontScale());
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });

    let saved = true;
    act(() => {
      saved = result.current.setFontScale(1.2);
    });

    expect(setItem).toHaveBeenCalled();
    expect(saved).toBe(false);
    expect(result.current.scale).toBe(1);
    expect(document.documentElement.style.getPropertyValue("--font-scale")).toBe("1");
  });

  it("returns success and applies a durable text scale immediately", () => {
    const { result } = renderHook(() => useFontScale());

    let saved = false;
    act(() => {
      saved = result.current.setFontScale(1.2);
    });

    expect(saved).toBe(true);
    expect(result.current.scale).toBe(1.2);
    expect(document.documentElement.style.getPropertyValue("--font-scale")).toBe("1.2");
  });
});
