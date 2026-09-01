import { readFileSync } from "node:fs";
import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingFlow } from "@/components/OnboardingFlow";

const { setFlagMock } = vi.hoisted(() => ({
  setFlagMock: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      modulesOnboardingTitle: "Оберіть можливості",
      modulesOnboardingSubtitle: "Оберіть інструменти для початку",
      moduleFocus: "Фокус",
      moduleBreathing: "Дихання",
      moduleGratitude: "Вдячність",
      moduleQuests: "Цілі",
      moduleTasks: "Завдання",
      moduleChallenges: "Виклики",
      moduleGarden: "Сад",
      modulesSelected: "можливостей обрано",
      coreModulesNote: "Настрій і звички завжди доступні",
      skip: "Пропустити",
      getStarted: "Почати",
    },
  }),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({ setFlag: setFlagMock }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const readOnboardingFlow = () => readFileSync("src/components/OnboardingFlow.tsx", "utf8");
const readGlobalStyles = () => readFileSync("src/index.css", "utf8");

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("OnboardingFlow interaction contract", () => {
  it("clears selection feedback after 400ms and can animate the same module again", () => {
    vi.useFakeTimers();
    render(createElement(OnboardingFlow, { onComplete: vi.fn() }));
    const focusModule = screen.getByRole("checkbox", { name: "Фокус" });

    fireEvent.click(focusModule);
    expect(focusModule).toHaveClass("motion-safe:animate-selection-pop");

    act(() => {
      vi.advanceTimersByTime(401);
    });
    expect(focusModule).not.toHaveClass("motion-safe:animate-selection-pop");

    fireEvent.click(focusModule);
    expect(focusModule).toHaveClass("motion-safe:animate-selection-pop");
  });

  it("uses the existing Lucide module identity with a localized accessible name", () => {
    render(createElement(OnboardingFlow, { onComplete: vi.fn() }));
    const focusModule = screen.getByRole("checkbox", { name: "Фокус" });
    const identityIcon = focusModule.querySelector("svg.lucide-timer");

    expect(identityIcon).not.toBeNull();
    expect(identityIcon?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(focusModule).not.toHaveTextContent("🕐");
  });

  it("does not render decorative particles", () => {
    const { container } = render(createElement(OnboardingFlow, { onComplete: vi.fn() }));

    expect(
      container.querySelector('[class*="animate-float-particle"]'),
    ).not.toBeInTheDocument();
  });

  it("does not render sparkle chrome", () => {
    const { container } = render(createElement(OnboardingFlow, { onComplete: vi.fn() }));

    expect(container.querySelector("svg.lucide-sparkles")).not.toBeInTheDocument();
  });

  it("uses semantic selection surfaces without gradient, glass, or glow chrome", () => {
    const { container } = render(createElement(OnboardingFlow, { onComplete: vi.fn() }));
    const classTokens = Array.from(container.querySelectorAll<HTMLElement>("[class]")).flatMap(
      (element) => (element.getAttribute("class") ?? "").split(/\s+/),
    );
    const forbiddenTokens = classTokens.filter(
      (token) =>
        token.startsWith("bg-gradient-") ||
        token.startsWith("from-") ||
        token.startsWith("via-") ||
        token.startsWith("to-") ||
        token.startsWith("backdrop-blur") ||
        token === "shadow-lg" ||
        token === "shadow-2xl" ||
        token.startsWith("shadow-primary"),
    );

    expect(forbiddenTokens).toEqual([]);
    expect(screen.getByRole("checkbox", { name: "Фокус" })).toHaveClass(
      "border",
      "border-primary",
      "bg-primary/10",
    );
    expect(screen.getByRole("button", { name: "Почати" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
    );
  });

  it("preserves the selected modules payload when a module is deselected", () => {
    const onComplete = vi.fn();
    render(createElement(OnboardingFlow, { onComplete }));

    fireEvent.click(screen.getByRole("checkbox", { name: "Фокус" }));
    fireEvent.click(screen.getByRole("button", { name: "Почати" }));

    expect(onComplete).toHaveBeenCalledWith({
      modules: [
        "breathingExercise",
        "gratitudeJournal",
        "quests",
        "tasks",
        "challenges",
        "innerWorld",
      ],
    });
  });

  it("skipping preserves existing feature preferences instead of enabling every module", () => {
    const onComplete = vi.fn();
    render(createElement(OnboardingFlow, { onComplete }));

    fireEvent.click(screen.getByRole("button", { name: "Пропустити" }));

    expect(setFlagMock).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith({ skipped: true, modules: [] });
  });
});

describe("OnboardingFlow text reflow contract", () => {
  it("uses content-driven module tracks that respond to the in-app text scale", () => {
    const source = readOnboardingFlow();

    expect(source).toContain(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,calc(10rem*var(--font-scale,1))),1fr))]"
    );
    expect(source).not.toContain('className="grid grid-cols-2 gap-3');
    expect(source).not.toContain("text-[10px]");
    expect(source).toContain("min-w-0 whitespace-normal break-words");
  });

  it("stacks the onboarding actions on narrow screens", () => {
    const source = readOnboardingFlow();

    expect(source).toMatch(/flex[^"]*flex-col[^"]*gap-2[^"]*sm:flex-row/);
    expect(source).toContain("h-auto min-h-12 w-full min-w-0");
  });

  it("keeps fullscreen onboarding content inside lateral safe areas", () => {
    const css = readGlobalStyles();
    const overlayRule = css.slice(
      css.indexOf(".screen-overlay"),
      css.indexOf("/* Safe-area padding utilities"),
    );

    expect(overlayRule).toContain("padding-left: var(--safe-left)");
    expect(overlayRule).toContain("padding-right: var(--safe-right)");
  });
});
