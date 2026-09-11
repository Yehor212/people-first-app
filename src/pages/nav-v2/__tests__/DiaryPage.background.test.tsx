import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThemeStore } from "@/stores/themeStore";
import { cosmicStars } from "@/components/cosmic/CosmicStarField";
import { DiaryPage } from "../DiaryPage";
import { RetainedCosmicSceneProvider } from "../CosmicBgAdapter";
import {
  DAY_COSMIC_MOTES,
  DAY_COSMIC_PHOTONS,
  DAY_COSMIC_SUN_THREADS,
} from "../dayCosmicMotionModel";

const runtime = vi.hoisted(() => ({ animate: true, android: false }));

vi.mock("@/lib/platform", () => ({
  get isAndroid() {
    return runtime.android;
  },
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => runtime.animate,
}));

vi.mock("@/stores/themeStore", async () => {
  const { create } = await import("zustand");
  return { useThemeStore: create(() => ({ appliedTheme: "paper" })) };
});

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: { diary: "Diary", navV2Diary: "Diary" } }),
}));

vi.mock("@/stores/diaryDraftStore", () => ({
  useDiaryDraftStore: (selector: (state: unknown) => unknown) =>
    selector({
      pendingMoodContext: null,
      consumePendingMoodContext: vi.fn(),
    }),
}));

vi.mock("@/components/SplashScreen", () => ({
  SplashScreen: () => <div data-testid="diary-loading-boundary" />,
}));

// Keep the real scene and its lifecycle; isolate journal data at the feature boundary.
vi.mock("@/features/journal/JournalModule", () => ({
  JournalModule: ({ pageBackground }: { pageBackground?: ReactNode }) => (
    <section data-testid="journal-page-boundary">{pageBackground}</section>
  ),
}));

async function renderDiary(retained = false) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(retained ? (
      <RetainedCosmicSceneProvider enabled={runtime.android}><DiaryPage /></RetainedCosmicSceneProvider>
    ) : <DiaryPage />);
  });
  expect(screen.getByTestId("journal-page-boundary")).toBeInTheDocument();
  return result;
}

describe("DiaryPage canonical Orb background", () => {
  beforeEach(() => {
    runtime.animate = true;
    runtime.android = false;
    useThemeStore.setState({ appliedTheme: "paper" });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T10:00:00"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps page-owned flourishes in the stationary scene's paint context and disposes them on exit", async () => {
    runtime.android = true;
    vi.stubGlobal("CSS", { supports: () => true });
    const pendingFrames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      pendingFrames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => pendingFrames.delete(id));
    const { rerender } = await renderDiary(true);
    const day = screen.getByTestId("day-cosmic-background");
    const host = day.parentElement;
    const flourish = screen.getByTestId("orb-day-flourish").parentElement as HTMLElement;
    expect(host).toContainElement(flourish);
    expect(flourish).toHaveClass("cosmic-scene-flourish");
    expect(screen.getByTestId("diary-orb-background")).not.toContainElement(flourish);

    fireEvent(window, Object.assign(new Event("pointermove"), {
      pointerType: "mouse", clientX: window.innerWidth * 0.75, clientY: window.innerHeight * 0.25,
    }));
    act(() => {
      const callbacks = [...pendingFrames.values()];
      pendingFrames.clear();
      for (const callback of callbacks) callback(20);
    });
    expect(flourish.style.getPropertyValue("--parallax-x")).toBe("0.500");
    expect(flourish.style.getPropertyValue("--parallax-y")).toBe("-0.500");

    act(() => useThemeStore.setState({ appliedTheme: "ink" }));
    expect(screen.getByTestId("cosmic-orb-background").parentElement).toBe(host);
    expect(host).toContainElement(flourish);
    act(() => { vi.advanceTimersByTime(1_200); });
    expect(flourish).toContainElement(screen.getByTestId("shooting-star"));
    act(() => useThemeStore.setState({ appliedTheme: "paper" }));
    expect(screen.getByTestId("day-cosmic-background")).toBe(day);
    expect(flourish).toContainElement(screen.getByTestId("orb-day-flourish"));

    rerender(<RetainedCosmicSceneProvider enabled>{null}</RetainedCosmicSceneProvider>);
    expect(day.isConnected).toBe(true);
    expect(day).toHaveAttribute("data-android-day-active", "false");
    expect(flourish.isConnected).toBe(false);
    expect(screen.queryByTestId("journal-page-boundary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shooting-star")).not.toBeInTheDocument();
    expect(pendingFrames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the original flourish location when stationary placement is unsupported", async () => {
    runtime.android = true;
    vi.stubGlobal("CSS", { supports: () => false });
    await renderDiary(true);
    const background = screen.getByTestId("diary-orb-background");
    const flourish = screen.getByTestId("orb-day-flourish").parentElement;
    expect(flourish?.parentElement).toBe(background);
    expect(flourish).toHaveClass("z-0");
    expect(document.querySelector("[data-cosmic-scene-frame]")).toBeNull();
  });

  it("supplies one complete daylight scene instead of the mountain wallpaper", async () => {
    await renderDiary();
    const background = screen.getByTestId("diary-orb-background");
    const scene = within(background).getByTestId("day-cosmic-background");

    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(background).toHaveClass("pointer-events-none", "absolute", "inset-0", "z-0");
    expect(background).toHaveClass("orb-day-scope", "v2-readable-page--ambient");
    expect(scene).toHaveAttribute("data-daymode", "morning");
    expect(scene).toHaveAttribute("data-presentation", "orb");
    expect(scene).toHaveAttribute("data-animated", "true");
    expect(within(scene).getByTestId("day-cosmic-motes").children).toHaveLength(
      DAY_COSMIC_MOTES.length
    );
    expect(within(scene).getByTestId("day-cosmic-photon-field").children).toHaveLength(
      DAY_COSMIC_PHOTONS.length
    );
    expect(within(scene).getByTestId("day-cosmic-sun-threads").children).toHaveLength(
      DAY_COSMIC_SUN_THREADS.length
    );
    for (const layer of [
      "base",
      "solar-portal",
      "bokeh",
      "atmosphere",
      "horizon-glow",
      "light-curtain",
      "god-rays",
      "sun-shower",
      "prism-ribbon",
      "caustics",
      "glass-depth",
      "paper-grain",
      "vignette",
    ]) {
      expect(within(scene).getByTestId(`day-cosmic-${layer}`)).toBeInTheDocument();
    }
    expect(within(background).getByTestId("orb-day-flourish")).toBeInTheDocument();
    expect(screen.getAllByTestId("day-cosmic-background")).toHaveLength(1);
    expect(screen.queryByTestId("cosmic-orb-background")).not.toBeInTheDocument();
    expect(screen.queryByTestId("journal-wallpaper")).not.toBeInTheDocument();
  });

  it("keeps Paper on the Orb dusk palette instead of using a separate night clock", async () => {
    vi.setSystemTime(new Date("2026-09-08T21:00:00"));
    await renderDiary();
    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute("data-daymode", "dusk");
    expect(screen.queryByTestId("cosmic-orb-background")).not.toBeInTheDocument();
  });

  it.each(["ink", "oled"] as const)(
    "keeps the complete night sky and meteor in %s",
    async (appliedTheme) => {
      useThemeStore.setState({ appliedTheme });
      await renderDiary();
      const background = screen.getByTestId("diary-orb-background");
      expect(background).toHaveClass("dark", "orb-cosmic-scope");
      expect(within(background).getAllByTestId("cosmic-orb-background")).toHaveLength(1);
      expect(within(background).getByTestId("cosmic-orb-nebula")).toHaveAttribute(
        "data-animated",
        "true"
      );
      expect(background.querySelectorAll(".zen-particle")).toHaveLength(cosmicStars.length);
      expect(screen.queryByTestId("day-cosmic-background")).not.toBeInTheDocument();
      expect(screen.queryByTestId("orb-day-flourish")).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(1_200);
      });
      expect(within(background).getByTestId("shooting-star")).toBeInTheDocument();
      expect(within(background).getAllByTestId("shooting-star-dust")).toHaveLength(3);
    }
  );

  it("changes themes without duplicating the active scene", async () => {
    await renderDiary();
    const background = screen.getByTestId("diary-orb-background");
    act(() => {
      useThemeStore.setState({ appliedTheme: "ink" });
    });
    expect(screen.getByTestId("diary-orb-background")).toBe(background);
    expect(screen.queryByTestId("day-cosmic-background")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("cosmic-orb-background")).toHaveLength(1);
    act(() => {
      useThemeStore.setState({ appliedTheme: "paper" });
    });
    expect(screen.getAllByTestId("day-cosmic-background")).toHaveLength(1);
    expect(screen.queryByTestId("cosmic-orb-background")).not.toBeInTheDocument();
  });

  it.each(["paper", "ink"] as const)(
    "preserves the canonical reduced-motion scene in %s",
    async (appliedTheme) => {
      runtime.animate = false;
      useThemeStore.setState({ appliedTheme });
      await renderDiary();
      const scene = screen.getByTestId(
        appliedTheme === "paper" ? "day-cosmic-background" : "cosmic-orb-nebula"
      );
      expect(scene).toHaveAttribute("data-animated", "false");
      expect(screen.queryByTestId("orb-day-flourish")).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      expect(screen.queryByTestId("shooting-star")).not.toBeInTheDocument();
    }
  );

  it("releases Android daylight ownership when leaving Diary", async () => {
    runtime.android = true;
    runtime.animate = false;
    const result = await renderDiary();
    expect(document.body).toHaveClass("android-day-orb-opaque-surface");
    result.unmount();
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");
    expect(screen.queryByTestId("day-cosmic-background")).not.toBeInTheDocument();
  });

  it("cleans up the night meteor timer when leaving Diary", async () => {
    useThemeStore.setState({ appliedTheme: "ink" });
    const result = await renderDiary();
    // Heading focus schedules JSDOM's zero-delay selectionchange, not a scene timer.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByTestId("cosmic-orb-background")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    result.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.queryByTestId("diary-orb-background")).not.toBeInTheDocument();
  });
});
