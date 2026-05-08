import { describe, expect, it } from "vitest";

import { getDiaryAura, getDiaryMoodValence } from "../journalAura";

function hueOf(hsl: string): number {
  return Number(hsl.split(" ")[0]);
}

describe("journalAura", () => {
  it("uses the same diary valence mapping as the mini orb", () => {
    expect(getDiaryMoodValence("great")).toBe(0.9);
    expect(getDiaryMoodValence("good")).toBe(0.55);
    expect(getDiaryMoodValence("okay")).toBe(0);
    expect(getDiaryMoodValence("bad")).toBe(-0.55);
    expect(getDiaryMoodValence("terrible")).toBe(-0.9);
  });

  it("maps bad mood to the cool orb hue instead of the old warm badge color", () => {
    const aura = getDiaryAura("bad");

    expect(aura).not.toBeNull();
    expect(hueOf(aura?.hsl ?? "0 0% 0%")).toBeGreaterThan(240);
    expect(hueOf(aura?.hsl ?? "0 0% 0%")).toBeLessThan(290);
  });

  it("omits aura when the entry has no mood", () => {
    expect(getDiaryAura(null)).toBeNull();
  });
});
