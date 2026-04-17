import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBatteryState } from "../useBatteryState";

type BatteryMock = {
  level: number;
  charging: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

function mockBattery(
  initial: { level: number; charging: boolean },
): { battery: BatteryMock; dispatch: () => void } {
  const listeners = new Map<string, Set<() => void>>();
  const battery: BatteryMock = {
    level: initial.level,
    charging: initial.charging,
    addEventListener: vi.fn((type: string, handler: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    }),
    removeEventListener: vi.fn((type: string, handler: () => void) => {
      listeners.get(type)?.delete(handler);
    }),
  };
  const dispatch = () => {
    for (const set of listeners.values()) {
      set.forEach((h) => h());
    }
  };
  return { battery, dispatch };
}

describe("useBatteryState", () => {
  afterEach(() => {
    // Restore navigator to its original shape.
    if (Object.prototype.hasOwnProperty.call(navigator, "getBattery")) {
      delete (navigator as unknown as Record<string, unknown>).getBattery;
    }
    vi.restoreAllMocks();
  });

  it("returns null when getBattery is unavailable (Safari/iOS path)", () => {
    expect((navigator as unknown as Record<string, unknown>).getBattery).toBeUndefined();
    const { result } = renderHook(() => useBatteryState());
    expect(result.current).toBeNull();
  });

  it("returns the battery level and charging state when the API resolves", async () => {
    const { battery } = mockBattery({ level: 0.8, charging: false });
    (navigator as unknown as Record<string, unknown>).getBattery = vi.fn(() =>
      Promise.resolve(battery),
    );

    const { result } = renderHook(() => useBatteryState());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({ level: 0.8, charging: false });
  });

  it("updates when levelchange fires", async () => {
    const { battery, dispatch } = mockBattery({ level: 0.5, charging: false });
    (navigator as unknown as Record<string, unknown>).getBattery = vi.fn(() =>
      Promise.resolve(battery),
    );

    const { result } = renderHook(() => useBatteryState());
    await waitFor(() => expect(result.current).not.toBeNull());

    act(() => {
      battery.level = 0.1;
      dispatch();
    });
    expect(result.current?.level).toBeCloseTo(0.1);
  });

  it("detaches listeners on unmount (no leaks)", async () => {
    const { battery } = mockBattery({ level: 0.9, charging: true });
    (navigator as unknown as Record<string, unknown>).getBattery = vi.fn(() =>
      Promise.resolve(battery),
    );

    const { unmount, result } = renderHook(() => useBatteryState());
    await waitFor(() => expect(result.current).not.toBeNull());

    unmount();
    expect(battery.removeEventListener).toHaveBeenCalledWith("levelchange", expect.any(Function));
    expect(battery.removeEventListener).toHaveBeenCalledWith("chargingchange", expect.any(Function));
  });

  it("stays null when the Promise rejects (permission denied / hardware error)", async () => {
    (navigator as unknown as Record<string, unknown>).getBattery = vi.fn(() =>
      Promise.reject(new Error("Permission denied")),
    );

    const { result } = renderHook(() => useBatteryState());
    // Give the rejected promise a tick to settle.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBeNull();
  });
});
