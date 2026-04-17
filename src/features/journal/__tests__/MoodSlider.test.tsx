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
