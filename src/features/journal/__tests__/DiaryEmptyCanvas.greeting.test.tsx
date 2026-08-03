import { fireEvent, render, screen } from "@testing-library/react";
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
    journalUsePrompt: "Use a prompt",
    journalReflectionPrompt2: "Write one true sentence about today.",
    journalReflectionPromptPast: "Write one true sentence you remember about this day.",
    journalReflectionQuoteLabel: "A quiet quote",
    quoteJournal2: "Journal writing is a voyage to the interior.",
    quoteJournal3: "The act of writing is the act of discovering what you believe.",
    quoteJournal8: "A personal journal is a place where you can become yourself.",
    quoteJournal13: "There is no greater agony than bearing an untold story inside you.",
  },
  uk: {
    diaryStartFirstEntry: "Почніть з однієї маленької деталі.",
    journalNewEntry: "Новий запис",
    journalPrompt: "Підказка",
    journalUsePrompt: "Обрати підказку",
    journalReflectionPrompt2: "Напишіть одне правдиве речення про сьогодні.",
    journalReflectionPromptPast: "Напишіть одне правдиве речення, яке пам’ятаєте про цей день.",
    journalReflectionQuoteLabel: "Тиха цитата",
    quoteJournal2: "Ведення щоденника — це подорож усередину себе.",
    quoteJournal3: "Писати — означає відкривати, у що ти насправді віриш.",
    quoteJournal8: "Особистий щоденник — місце, де можна ставати собою.",
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
  vi.setSystemTime(new Date(2026, 5, 12, 23, 0, 0));

  render(
    <DiaryEmptyCanvas
      onNewEntry={vi.fn()}
      onNewEntryWithPrompt={vi.fn()}
      showWallpaper={false}
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
    expect(screen.getByTestId("diary-reflection-quote")).toHaveTextContent(
      "A personal journal is a place where you can become yourself.",
    );
    expect(screen.queryByText("There is no greater agony than bearing an untold story inside you.")).not.toBeInTheDocument();
    expect(screen.queryByText("Still up?")).not.toBeInTheDocument();
  });

  it("renders the calm Ukrainian night greeting instead of pressure copy", () => {
    renderEmptyCanvas("uk");

    expect(screen.getByRole("heading", { name: "Тиха ніч" })).toBeVisible();
    expect(screen.getByTestId("diary-reflection-quote")).toHaveTextContent(
      "Особистий щоденник — місце, де можна ставати собою.",
    );
    expect(screen.queryByText("Немає більшого болю, ніж носити нерозказану історію в собі.")).not.toBeInTheDocument();
    expect(screen.queryByText("Ще не спиш?")).not.toBeInTheDocument();
  });

  it("labels blank writing and guided writing as distinct actions", () => {
    const onNewEntry = vi.fn();
    const onNewEntryWithPrompt = vi.fn();
    languageState.language = "en";
    vi.setSystemTime(new Date(2026, 5, 17, 10, 0, 0));

    render(
      <DiaryEmptyCanvas
        onNewEntry={onNewEntry}
        onNewEntryWithPrompt={onNewEntryWithPrompt}
        showWallpaper={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New entry" }));
    fireEvent.click(screen.getByRole("button", { name: "Use a prompt" }));

    expect(onNewEntry).toHaveBeenCalledTimes(1);
    expect(onNewEntryWithPrompt).toHaveBeenCalledTimes(1);
  });

  it("reflows both writing actions without clipping at enlarged narrow text sizes", () => {
    renderEmptyCanvas("en");

    const canvas = screen.getByTestId("diary-empty-canvas");
    const actions = screen.getByTestId("diary-empty-actions");
    const newEntry = screen.getByRole("button", { name: "New entry" });
    const prompt = screen.getByRole("button", { name: "Use a prompt" });
    const quote = screen.getByTestId("diary-reflection-quote");

    expect(canvas).toHaveClass("overflow-x-hidden");
    expect(canvas).not.toHaveClass("overflow-hidden");
    expect(quote.className).toContain("[@media(max-height:700px)]:hidden");
    expect(actions).toHaveClass("zf-auto-fit-grid-10");
    for (const button of [newEntry, prompt]) {
      expect(button).toHaveClass("w-full", "min-w-0", "whitespace-normal");
      const label = button.querySelector("span");
      expect(label).toHaveClass("min-w-0", "break-words");
      expect(label?.className).toContain("[hyphens:manual]");
      expect(label?.className).toContain("[overflow-wrap:normal]");
    }
  });

  it("uses date-neutral prompt copy when writing for a past selected day", () => {
    languageState.language = "en";
    vi.setSystemTime(new Date(2026, 5, 17, 10, 0, 0));
    const onNewEntryWithPrompt = vi.fn();

    render(
      <DiaryEmptyCanvas
        onNewEntry={vi.fn()}
        onNewEntryWithPrompt={onNewEntryWithPrompt}
        selectedDate="2026-06-12"
        showWallpaper={false}
      />,
    );

    expect(screen.getByText("Write one true sentence you remember about this day.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Use a prompt" }));
    expect(onNewEntryWithPrompt).toHaveBeenCalledWith(
      "Write one true sentence you remember about this day.",
    );
  });
});
