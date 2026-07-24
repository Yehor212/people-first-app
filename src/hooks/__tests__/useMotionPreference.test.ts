import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  listener: null as null | ((preference: { reduceMotion: boolean }) => void),
  mutateOnSubscribe: false,
  reduceMotion: false,
}));

const unsubscribe = vi.hoisted(() => vi.fn());
const getMotionPreference = vi.hoisted(() => vi.fn(() => ({ reduceMotion: harness.reduceMotion })));
const subscribeMotionPreference = vi.hoisted(() =>
  vi.fn((listener: (preference: { reduceMotion: boolean }) => void) => {
    harness.listener = listener;
    if (harness.mutateOnSubscribe) {
      // Simulate another same-origin tab persisting the preference after the
      // render snapshot but before this component finishes subscribing.
      harness.reduceMotion = true;
    }
    return unsubscribe;
  })
);

vi.mock("@/lib/motionPreference", () => ({
  DEFAULT_MOTION_PREFERENCE: { reduceMotion: false },
  getMotionPreference,
  subscribeMotionPreference,
}));

import { useMotionPreference } from "../useMotionPreference";

describe("useMotionPreference", () => {
  beforeEach(() => {
    harness.listener = null;
    harness.mutateOnSubscribe = false;
    harness.reduceMotion = false;
    getMotionPreference.mockClear();
    subscribeMotionPreference.mockClear();
    unsubscribe.mockClear();
  });

  it("rechecks the persisted value after subscribing so a mount-boundary change is not lost", async () => {
    harness.mutateOnSubscribe = true;

    const { result } = renderHook(() => useMotionPreference());

    await waitFor(() => expect(result.current).toEqual({ reduceMotion: true }));
    expect(subscribeMotionPreference).toHaveBeenCalledTimes(1);
    expect(getMotionPreference.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("updates from preference events and unsubscribes on unmount", () => {
    const { result, unmount } = renderHook(() => useMotionPreference());
    expect(result.current).toEqual({ reduceMotion: false });

    act(() => {
      harness.reduceMotion = true;
      harness.listener?.({ reduceMotion: true });
    });
    expect(result.current).toEqual({ reduceMotion: true });

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
