import { describe, expect, it } from "vitest";

import { resolveHyperfocusAmbientVolume } from "../hyperfocusAudioVolume";

describe("Hyperfocus ambient volume", () => {
  it("preserves the app master gain instead of attenuating quiet mastered ambience twice", () => {
    expect(resolveHyperfocusAmbientVolume(0.3, false)).toBe(0.3);
    expect(resolveHyperfocusAmbientVolume(0.6, false)).toBe(0.6);
  });

  it("keeps mute authoritative and clamps malformed master gain", () => {
    expect(resolveHyperfocusAmbientVolume(0.6, true)).toBe(0);
    expect(resolveHyperfocusAmbientVolume(-1, false)).toBe(0);
    expect(resolveHyperfocusAmbientVolume(2, false)).toBe(1);
    expect(resolveHyperfocusAmbientVolume(Number.NaN, false)).toBe(0);
  });
});
