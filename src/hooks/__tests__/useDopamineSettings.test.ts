import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDopamineSettings } from "@/hooks/useDopamineSettings";
import { updateDopamineSettings } from "@/lib/dopamineSettings";
import { SK } from "@/lib/storageKeys";

describe("useDopamineSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  it("merges a stored partial preference with safe defaults", () => {
    localStorage.setItem(
      SK.DOPAMINE_SETTINGS,
      JSON.stringify({ intensity: "minimal", animations: false }),
    );

    const { result } = renderHook(() => useDopamineSettings());

    expect(result.current).toMatchObject({
      intensity: "minimal",
      animations: false,
      sounds: true,
      haptics: false,
      confetti: true,
    });
  });

  it("updates mounted consumers after a same-tab preference change", () => {
    const { result } = renderHook(() => useDopamineSettings());

    act(() => {
      updateDopamineSettings({ animations: false, confetti: false });
    });

    expect(result.current.animations).toBe(false);
    expect(result.current.confetti).toBe(false);
  });

  it("adopts a valid cross-tab storage event", () => {
    const { result } = renderHook(() => useDopamineSettings());
    const next = {
      ...result.current,
      intensity: "adhd" as const,
      haptics: true,
    };

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SK.DOPAMINE_SETTINGS,
          newValue: JSON.stringify(next),
        }),
      );
    });

    expect(result.current).toEqual(next);
  });
});
