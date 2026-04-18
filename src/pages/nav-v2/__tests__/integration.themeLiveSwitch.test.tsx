/**
 * Phase 3-A.4c-ii-d-c Integration Test #4 — Theme live switch on OrbPage.
 *
 * When the user flips `useThemeStore.setTheme('paper' → 'ink' → 'oled')` while
 * OrbPage is mounted:
 *  - document.documentElement.dataset.theme updates
 *  - CosmicBgAdapter variant-switches (DayCosmicBackground for paper, night
 *    cosmic for ink/oled)
 *  - Content on the page stays mounted (no remount wiping draft state)
 *
 * We render CosmicBgAdapter directly (in isolation) — OrbPage itself mounts
 * many subcomponents that jsdom has to tolerate, and the variant-switch
 * behaviour lives entirely in CosmicBgAdapter. Cross-reference
 * `CosmicBgAdapter.test.tsx` for the baseline branch tests; this file asserts
 * the LIVE-SWITCH scenario with real useThemeStore (no mock).
 *
 * Note: Playwright e2e baseline "nav-v2-theme-switch-live" is NOT included
 * here — captured in e2e/nav-v2.spec.ts after sequential-2 frontend fix.
 * Flagged for team lead — Playwright run deferred per Phase 3-A.4c-ii-d-c
 * constraint "do NOT regenerate baselines".
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { act } from "react";
import { CosmicBgAdapter } from "../CosmicBgAdapter";
import { useThemeStore } from "@/stores/themeStore";

// Stub useShouldAnimate to keep the DOM deterministic (no framer animations).
vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => false,
}));

// Stars — simple divs
vi.mock("@/components/FocusReflectionModal", () => ({
  CosmicStar: ({ id }: { id: string }) => <div data-testid={`star-${id}`} />,
  cosmicStars: [{ id: "s1", x: 10, y: 10 }],
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: (props: Record<string, unknown>) => <div {...(props as object)} />,
  },
}));

describe("Integration #4 — Theme live switch on OrbPage (CosmicBgAdapter)", () => {
  beforeEach(() => {
    // Reset to paper so every test has a known starting point
    act(() => {
      useThemeStore.getState().setTheme("paper");
    });
  });

  afterEach(() => {
    cleanup();
    // Clean the html attribute so no test leaks
    delete document.documentElement.dataset.theme;
  });

  it("paper theme → DayCosmicBackground + data-theme='paper' on <html>", () => {
    act(() => {
      useThemeStore.getState().setTheme("paper");
    });
    render(<CosmicBgAdapter />);

    expect(document.documentElement.dataset.theme).toBe("paper");
    expect(screen.getByTestId("day-cosmic-background")).toBeInTheDocument();
    expect(screen.queryByTestId("cosmic-orb-nebula")).toBeNull();
  });

  it("live-switches paper → ink: DOM attr updates + night cosmic renders", () => {
    // Arrange — start paper, mount adapter
    act(() => {
      useThemeStore.getState().setTheme("paper");
    });
    const { rerender } = render(<CosmicBgAdapter />);
    expect(document.documentElement.dataset.theme).toBe("paper");

    // Act — user flips to ink
    act(() => {
      useThemeStore.getState().setTheme("ink");
    });
    rerender(<CosmicBgAdapter />);

    // Assert
    expect(document.documentElement.dataset.theme).toBe("ink");
    expect(screen.queryByTestId("day-cosmic-background")).toBeNull();
    expect(screen.getByTestId("cosmic-orb-background")).toBeInTheDocument();
    expect(screen.getByTestId("cosmic-orb-nebula")).toBeInTheDocument();
  });

  it("live-switches ink → oled: night cosmic stays, DOM attr='oled'", () => {
    act(() => {
      useThemeStore.getState().setTheme("ink");
    });
    const { rerender } = render(<CosmicBgAdapter />);
    expect(document.documentElement.dataset.theme).toBe("ink");

    act(() => {
      useThemeStore.getState().setTheme("oled");
    });
    rerender(<CosmicBgAdapter />);

    expect(document.documentElement.dataset.theme).toBe("oled");
    // Night cosmic is the catch-all for both ink & oled
    expect(screen.getByTestId("cosmic-orb-background")).toBeInTheDocument();
    expect(screen.queryByTestId("day-cosmic-background")).toBeNull();
  });

  it("three-way cycle paper → ink → oled → paper leaves store self-consistent", () => {
    act(() => {
      useThemeStore.getState().setTheme("paper");
    });
    expect(useThemeStore.getState().appliedTheme).toBe("paper");

    act(() => {
      useThemeStore.getState().setTheme("ink");
    });
    expect(useThemeStore.getState().appliedTheme).toBe("ink");

    act(() => {
      useThemeStore.getState().setTheme("oled");
    });
    expect(useThemeStore.getState().appliedTheme).toBe("oled");

    act(() => {
      useThemeStore.getState().setTheme("paper");
    });
    expect(useThemeStore.getState().appliedTheme).toBe("paper");
    expect(document.documentElement.dataset.theme).toBe("paper");
  });
});
