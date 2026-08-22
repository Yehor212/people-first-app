import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform", () => ({
  isAndroid: true,
}));

vi.mock("../logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../validation", () => ({
  isAbortError: vi.fn(() => false),
}));

vi.mock("@/lib/env", () => ({
  BASE_URL: "/",
}));

import { setupAudioUnlock } from "../ambientSounds";

const EAGER_AUDIO_UNLOCK_EVENTS = new Set([
  "touchstart",
  "touchend",
  "touchmove",
  "touchcancel",
  "keydown",
]);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Android ambient audio unlock", () => {
  it("does not arm ambient audio from unrelated interface taps", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");

    setupAudioUnlock();

    const registeredUnlockEvents = addEventListener.mock.calls
      .map(([eventName]) => eventName)
      .filter((eventName) => EAGER_AUDIO_UNLOCK_EVENTS.has(eventName));

    expect(registeredUnlockEvents).toEqual([]);
  });
});
