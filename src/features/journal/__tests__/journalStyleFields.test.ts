import { describe, expect, it } from "vitest";

import {
  journalStyleFieldsToCloud,
  normalizeJournalStyleFields,
  normalizeJournalStyleFieldsFromCloud,
} from "../journalStyleFields";
import { DIARY_FONTS } from "../types";

describe("journalStyleFields", () => {
  it("uses four distinct offline-safe font presentations", () => {
    const configurations = Object.values(DIARY_FONTS);
    const bundledFamilies = [
      "Caveat Variable",
      "Fraunces Variable",
      "Literata Variable",
      "Inter Variable",
    ];

    expect(configurations).toHaveLength(4);
    expect(
      new Set(configurations.map((font) => `${font.family}|${font.style}`)).size,
    ).toBe(4);
    expect(configurations.every((font) => !("url" in font))).toBe(true);
    expect(
      configurations.every((font) =>
        bundledFamilies.some((family) => font.family.includes(family)),
      ),
    ).toBe(true);
  });

  it("normalizes supported local entry style fields", () => {
    expect(
      normalizeJournalStyleFields({
        theme: "ocean",
        font: "outfit",
        inkColor: "#34d399",
        paperTexture: "linen",
        bgPattern: "aurora",
        paperColor: "milky",
        bgIntensity: "dim",
        particleSpeed: "drift",
        fontSize: "large",
      })
    ).toEqual({
      theme: "ocean",
      font: "outfit",
      inkColor: "#34d399",
      paperTexture: "linen",
      bgPattern: "aurora",
      paperColor: "milky",
      bgIntensity: "dim",
      particleSpeed: "drift",
      fontSize: "large",
    });
  });

  it("maps cloud style fields and drops unsupported values", () => {
    expect(
      normalizeJournalStyleFieldsFromCloud({
        theme: "midnight",
        font: "sans",
        ink_color: "url(javascript:bad)",
        paper_texture: "linen",
        bg_pattern: "unknown-scene",
        paper_color: "milky",
        bg_intensity: "dim",
        particle_speed: "too-fast",
        font_size: "large",
      })
    ).toEqual({
      theme: "midnight",
      paperTexture: "linen",
      paperColor: "milky",
      bgIntensity: "dim",
      fontSize: "large",
    });
  });

  it("rejects malformed five- and seven-digit hex ink colors", () => {
    expect(normalizeJournalStyleFields({ inkColor: "#12345" })).toEqual({});
    expect(normalizeJournalStyleFields({ inkColor: "#1234567" })).toEqual({});
  });

  it("serializes style fields to Supabase columns with nulls for defaults", () => {
    expect(
      journalStyleFieldsToCloud({
        id: "entry-1",
        date: "2026-07-09",
        title: "Styled",
        content: "A quiet page",
        stickers: [],
        photoIds: [],
        tags: [],
        theme: "forest",
        font: "cormorant",
        inkColor: "#243936",
        paperTexture: "linen",
        bgPattern: "stardust",
        paperColor: "white",
        bgIntensity: "dim",
        particleSpeed: "drift",
        fontSize: "small",
        createdAt: 1,
        updatedAt: 2,
      })
    ).toEqual({
      theme: "forest",
      font: "cormorant",
      ink_color: "#243936",
      paper_texture: "linen",
      bg_pattern: "stardust",
      paper_color: "white",
      bg_intensity: "dim",
      particle_speed: "drift",
      font_size: "small",
    });
  });
});
