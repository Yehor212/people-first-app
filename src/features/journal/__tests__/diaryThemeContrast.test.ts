import { describe, expect, it } from "vitest";
import { DIARY_THEMES, PAPER_COLORS } from "../types";

function parseHex(color: string): [number, number, number] {
  const value = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Unsupported test color: ${color}`);
  }
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [red, green, blue] = parseHex(hex).map(channelToLinear);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("diary theme contrast", () => {
  it("keeps muted normal text readable on every diary theme", () => {
    for (const [name, theme] of Object.entries(DIARY_THEMES)) {
      expect(
        contrastRatio(theme["--diary-muted"], theme["--diary-bg"]),
        `${name} muted text contrast`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps paper muted helper text readable on every paper color", () => {
    for (const [name, paper] of Object.entries(PAPER_COLORS)) {
      expect(
        contrastRatio(paper.muted, paper.bg),
        `${name} paper muted text contrast`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
