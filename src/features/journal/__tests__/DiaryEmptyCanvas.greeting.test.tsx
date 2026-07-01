import { render, screen } from "@testing-library/react";
import type React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type TestLanguage = "en" | "uk";

const languageState = vi.hoisted<{ language: TestLanguage }>(() => ({
  language: "en",
}));

const translations = {
  en: {
    diaryStartFirstEntry: "Begin with one small detail.",
    journalNewEntry: "New entry",
    journalPrompt: "Prompt",
    journalReflectionPrompt2: "Write one true sentence about today.",
    journalReflectionQuoteLabel: "A quiet quote",
    quoteJournal13: "There is no greater agony than bearing an untold story inside you.",
  },
  uk: {
    diaryStartFirstEntry: "Почніть з однієї маленької деталі.",
    journalNewEntry: "Новий запис",
    journalPrompt: "Підказка",
    journalReflectionPrompt2: "Напишіть одне правдиве речення про сьогодні.",
    journalReflectionQuoteLabel: "Тиха цитата",
    quoteJournal13: "Немає більшого болю, ніж носити нерозказану історію в собі.",
  },
} as const;

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    isRTL: false,
    language: languageState.language,
    t: translations[languageState.language],
  }),
}));

vi.mock("framer-motion", () => {
  const passthrough = (Tag: keyof JSX.IntrinsicElements) =>
    ({ children, initial, animate, transition, whileHover, whileTap, variants, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => {
      void initial;
      void animate;
      void transition;
      void whileHover;
      void whileTap;
      void variants;
      return <Tag {...rest}>{children}</Tag>;
    };

  return {
    motion: {
      div: passthrough("div"),
      h2: passthrough("h2"),
      p: passthrough("p"),
      figure: passthrough("figure"),
      span: passthrough("span"),
      button: passthrough("button"),
    },
    useReducedMotion: () => true,
  };
});

vi.mock("@/components/state-of-mind/MiniValenceOrb", () => ({
  MiniValenceOrb: () => <div data-testid="mini-valence-orb" />,
}));

vi.mock("@/components/stats/ParticleBackground", () => ({
  ParticleBackground: () => <div data-testid="particle-background" />,
}));

vi.mock("../DiaryWallpaper", () => ({
  DiaryWallpaper: () => <div data-testid="journal-wallpaper" />,
}));

import { DiaryEmptyCanvas } from "../DiaryEmptyCanvas";

function renderEmptyCanvas(language: "en" | "uk") {
  languageState.language = language;
  vi.setSystemTime(new Date(2026, 5, 17, 23, 0, 0));

  render(
    <DiaryEmptyCanvas
      entriesThisWeek={0}
      onNewEntry={vi.fn()}
      onNewEntryWithPrompt={vi.fn()}
      showWallpaper={false}
      streak={0}
    />,
  );
}

describe("DiaryEmptyCanvas night greeting", () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    languageState.language = "en";
  });

  it("renders the calm English night greeting instead of pressure copy", () => {
    renderEmptyCanvas("en");

    expect(screen.getByRole("heading", { name: "Quiet night" })).toBeVisible();
    expect(
      screen.getByText("There is no greater agony than bearing an untold story inside you."),
    ).toBeVisible();
    expect(screen.queryByText("Still up?")).not.toBeInTheDocument();
  });

  it("renders the calm Ukrainian night greeting instead of pressure copy", () => {
    renderEmptyCanvas("uk");

    expect(screen.getByRole("heading", { name: "Тиха ніч" })).toBeVisible();
    expect(
      screen.getByText("Немає більшого болю, ніж носити нерозказану історію в собі."),
    ).toBeVisible();
    expect(screen.queryByText("Ще не спиш?")).not.toBeInTheDocument();
  });
});
