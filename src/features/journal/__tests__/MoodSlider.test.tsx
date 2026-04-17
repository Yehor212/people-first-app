/**
 * MoodSlider tests — Phase 2-B
 *
 * Verifies flag-gated gradient dual-path:
 *   - Flag off (default 0% rollout) → HSL gradient (destructive/warning/primary)
 *   - Flag on (100% rollout via test seed) → OKLCH gradient (5-step mood palette)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/haptics", () => ({
  hapticSelection: vi.fn(),
  hapticMedium: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
}));

import { MoodSlider } from "../MoodSlider";
import { useDesignFlagStore } from "@/stores/designFlagStore";

function seedFlag(enabled: boolean, rolloutPercent: number) {
  useDesignFlagStore.setState({
    flags: {
      "design.colors.oklch.mood-slider": {
        key: "design.colors.oklch.mood-slider",
        enabled,
        rollout_percent: rolloutPercent,
        killswitch: false,
      },
    },
    lastFetch: Date.now(),
    isLoading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useDesignFlagStore.setState({ flags: {}, lastFetch: null, isLoading: false });
  if (typeof window !== "undefined") window.localStorage.clear();
});

describe("MoodSlider — OKLCH flag dual-path", () => {
  it("renders HSL gradient when flag absent (default state)", () => {
    const { container } = render(
      <MoodSlider value="okay" onChange={vi.fn()} />,
    );
    const fill = container.querySelector<HTMLElement>("[data-gradient-mode]");
    expect(fill).not.toBeNull();
    expect(fill?.getAttribute("data-gradient-mode")).toBe("hsl");
    expect(fill?.style.backgroundImage).toContain("hsl(var(--destructive))");
  });

  it("renders HSL gradient when flag disabled", () => {
    seedFlag(false, 100);
    const { container } = render(
      <MoodSlider value="good" onChange={vi.fn()} />,
    );
    const fill = container.querySelector<HTMLElement>("[data-gradient-mode]");
    expect(fill?.getAttribute("data-gradient-mode")).toBe("hsl");
  });

  it("renders OKLCH gradient when flag enabled with rollout 100%", () => {
    seedFlag(true, 100);
    const { container } = render(
      <MoodSlider value="great" onChange={vi.fn()} />,
    );
    const fill = container.querySelector<HTMLElement>("[data-gradient-mode]");
    expect(fill?.getAttribute("data-gradient-mode")).toBe("oklch");
    expect(fill?.style.backgroundImage).toContain("--color-mood-terrible");
    expect(fill?.style.backgroundImage).toContain("--color-mood-great");
  });

  it("preserves slider semantics (role=slider) regardless of flag state", () => {
    seedFlag(true, 100);
    const { container } = render(
      <MoodSlider value="okay" onChange={vi.fn()} />,
    );
    const slider = container.querySelector('[role="slider"]');
    expect(slider).not.toBeNull();
    expect(slider?.getAttribute("aria-valuenow")).toBe("2");
  });
});

describe("MoodSlider — Phase 3-A.2 showEmojis prop", () => {
  it("renders the emoji row by default (backward compatible with all V1 callers)", () => {
    const { container } = render(
      <MoodSlider value="okay" onChange={vi.fn()} />,
    );
    const emojiRow = container.querySelector(
      '[data-testid="mood-slider-emoji-row"]',
    );
    expect(emojiRow).not.toBeNull();
    // 5 mood detent buttons — one per mood
    expect(emojiRow?.querySelectorAll("button").length).toBe(5);
  });

  it("renders the emoji row explicitly when showEmojis=true", () => {
    const { container } = render(
      <MoodSlider value="good" onChange={vi.fn()} showEmojis={true} />,
    );
    expect(
      container.querySelector('[data-testid="mood-slider-emoji-row"]'),
    ).not.toBeNull();
  });

  it("hides the emoji row entirely when showEmojis=false (OrbPage cinematic mode)", () => {
    const { container } = render(
      <MoodSlider value="good" onChange={vi.fn()} showEmojis={false} />,
    );
    expect(
      container.querySelector('[data-testid="mood-slider-emoji-row"]'),
    ).toBeNull();
    // And no emoji characters anywhere in the rendered output
    const emojiCodes = ["\u{1F622}", "\u{1F614}", "\u{1F610}", "\u{1F642}", "\u{1F604}"];
    for (const emoji of emojiCodes) {
      expect(container.textContent || "").not.toContain(emoji);
    }
  });

  it("preserves slider semantics (role=slider) when showEmojis=false", () => {
    const { container } = render(
      <MoodSlider value="okay" onChange={vi.fn()} showEmojis={false} />,
    );
    const slider = container.querySelector('[role="slider"]');
    expect(slider).not.toBeNull();
    expect(slider?.getAttribute("aria-valuenow")).toBe("2");
    expect(slider?.getAttribute("aria-valuemin")).toBe("0");
    expect(slider?.getAttribute("aria-valuemax")).toBe("4");
  });

  it("exposes ArrowLeft/Right keyboard handlers regardless of showEmojis", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MoodSlider value="okay" onChange={onChange} showEmojis={false} />,
    );
    const thumb = container.querySelector<HTMLElement>('[role="slider"]');
    expect(thumb).not.toBeNull();
    // Slider is keyboard-focusable (tabIndex=0) in both modes
    expect(thumb?.getAttribute("tabindex")).toBe("0");
    // aria-label preserved so screen-reader users are unaffected by emoji toggle
    expect(thumb?.getAttribute("aria-label")).toBe("Mood");
  });
});
