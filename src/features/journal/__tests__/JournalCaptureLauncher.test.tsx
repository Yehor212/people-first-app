import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    isRTL: false,
    t: {
      close: "Close",
      journalBurnShort: "Burn",
      journalBurnAThought: "Burn a Thought",
      journalFabNewEntry: "New Entry",
      journalFocusSceneTitle: "Focus before writing",
      journalFocusSceneDescription: "Take one breath, then open a focused note.",
      journalFocusShort: "Focus",
      journalFocusStartEntry: "Open focused note",
      journalGratitudeShort: "Gratitude",
      journalGratitudeTitle: "Plant gratitude",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/lib/animationUtils", () => ({
  zenMotion: {
    gentle: { duration: 0.2 },
    snappy: { duration: 0.12 },
  },
}));

type MotionMockProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  children?: React.ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
};

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    button: ({
      children,
      initial,
      animate,
      exit,
      transition,
      whileHover,
      whileTap,
      ...rest
    }: MotionMockProps<HTMLButtonElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileHover;
      void whileTap;
      return <button {...rest}>{children}</button>;
    },
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      whileHover,
      whileTap,
      ...rest
    }: MotionMockProps<HTMLDivElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileHover;
      void whileTap;
      return <div {...rest}>{children}</div>;
    },
  },
  useReducedMotion: () => false,
}));

vi.mock("@/components/HyperfocusMode", () => ({
  HyperfocusMode: ({
    duration,
    onComplete,
    onExit,
  }: {
    duration: number;
    onComplete: () => void;
    onExit: () => void;
  }) => (
    <div data-testid="hyperfocus-mode" data-duration={duration}>
      <button type="button" data-testid="hyperfocus-complete" onClick={onComplete}>
        Complete
      </button>
      <button type="button" data-testid="hyperfocus-exit" onClick={onExit}>
        Exit
      </button>
    </div>
  ),
}));

vi.mock("../GratitudeBloomWidget", () => ({
  GratitudeBloomWidget: ({ onPlant }: { onPlant: (entry: { id: string; text: string }) => void }) => (
    <button type="button" data-testid="gratitude-widget" onClick={() => onPlant({ id: "g1", text: "thanks" })}>
      Plant
    </button>
  ),
}));

vi.mock("../BurnThoughtWidget", () => ({
  BurnThoughtWidget: ({
    onClose,
    onReleased,
  }: {
    onClose: () => void;
    onReleased?: () => void | Promise<void>;
  }) => (
    <button
      type="button"
      data-testid="burn-widget"
      onClick={() => {
        void onReleased?.();
        onClose();
      }}
    >
      Burn
    </button>
  ),
}));

import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";
import { JournalCaptureLauncher } from "../JournalCaptureLauncher";

describe("JournalCaptureLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the same action set for the floating diary launcher", () => {
    render(
      <JournalCaptureLauncher
        onNewEntry={vi.fn()}
        onAddGratitude={vi.fn()}
        onFocusEntry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("journal-entry-main-fab"));

    expect(screen.getByTestId("journal-fab-action-new-entry")).toBeInTheDocument();
    expect(screen.getByTestId("journal-fab-action-gratitude")).toBeInTheDocument();
    expect(screen.getByTestId("journal-fab-action-burn")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-fab-action-focus")).not.toBeInTheDocument();
  });

  it("renders an inline launcher for empty days", () => {
    render(<JournalCaptureLauncher variant="inline" onNewEntry={vi.fn()} onFocusEntry={vi.fn()} />);

    expect(screen.getByTestId("journal-capture-launcher-inline")).toBeInTheDocument();
    expect(screen.getByTestId("journal-entry-main-fab")).toBeInTheDocument();
  });

  it("opens the original gratitude bloom widget from the launcher", () => {
    const onAddGratitude = vi.fn();
    render(<JournalCaptureLauncher onNewEntry={vi.fn()} onAddGratitude={onAddGratitude} />);

    fireEvent.click(screen.getByTestId("journal-entry-main-fab"));
    fireEvent.click(screen.getByTestId("journal-fab-action-gratitude"));

    expect(screen.getByTestId("journal-quick-gratitude-scene")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("gratitude-widget"));

    expect(onAddGratitude).toHaveBeenCalledWith({ id: "g1", text: "thanks" });
  });

  it("opens the original burn widget from the launcher without a fixed scene", () => {
    render(<JournalCaptureLauncher onNewEntry={vi.fn()} />);

    fireEvent.click(screen.getByTestId("journal-entry-main-fab"));
    fireEvent.click(screen.getByTestId("journal-fab-action-burn"));

    expect(screen.queryByTestId("journal-quick-burn-scene")).not.toBeInTheDocument();
    expect(screen.getByTestId("burn-widget")).toBeInTheDocument();
  });

  it("passes quiet release completion from the burn widget without text payload", () => {
    const onReleaseThought = vi.fn();
    render(<JournalCaptureLauncher onNewEntry={vi.fn()} onReleaseThought={onReleaseThought} />);

    fireEvent.click(screen.getByTestId("journal-entry-main-fab"));
    fireEvent.click(screen.getByTestId("journal-fab-action-burn"));
    fireEvent.click(screen.getByTestId("burn-widget"));

    expect(onReleaseThought).toHaveBeenCalledTimes(1);
    expect(onReleaseThought).toHaveBeenCalledWith();
  });
});

describe("journal launcher short labels", () => {
  it("defines explicit short labels for all supported languages", () => {
    const languages = [en, uk, es, de, fr, ja, ar, he];

    for (const t of languages) {
      expect(t.journalBurnShort).toBeTruthy();
      expect(t.journalGratitudeShort).toBeTruthy();
      expect(t.diaryFocusShort).toBeTruthy();
      expect(t.diaryBreatheShort).toBeTruthy();
    }
  });
});
