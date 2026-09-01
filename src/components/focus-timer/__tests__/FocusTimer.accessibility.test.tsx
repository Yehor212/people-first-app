import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { FocusTimer } from "../FocusTimer";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      startHere: "Start here",
      focusLabelPrompt: "What are you focusing on?",
      focusLabelPlaceholder: "Name this focus",
      focusCustomWork: "Focus minutes",
      focusCustomBreak: "Break minutes",
      breakTime: "Break",
      focus: "Focus",
      todayMinutes: "minutes today",
      concentrate: "Focus time",
      takeRest: "Break time",
      pause: "Pause timer",
      start: "Start timer",
      resetTimer: "Reset timer",
      hyperfocusMode: "Hyperfocus mode",
    },
  }),
}));

vi.mock("@/hooks/useFocusTimer", async () => {
  const ReactModule = await import("react");

  return {
    presetColors: {
      "25": { bg: "", glow: "", ring: "" },
      "50": { bg: "", glow: "", ring: "" },
      custom: { bg: "", glow: "", ring: "" },
    },
    useFocusTimer: () => {
      const [preset, setPreset] = ReactModule.useState<"25" | "50" | "custom">("25");

      return {
        preset,
        focusMinutes: preset === "50" ? 50 : 25,
        focusInputValue: "25",
        breakInputValue: "5",
        label: "",
        setLabel: vi.fn(),
        setFocusInputValue: vi.fn(),
        setBreakInputValue: vi.fn(),
        timeLeft: 1500,
        isRunning: false,
        isBreak: false,
        showReflection: false,
        reflectionValue: null,
        setReflectionValue: vi.fn(),
        showHyperfocus: false,
        setShowHyperfocus: vi.fn(),
        totalMinutesToday: 0,
        progress: 0,
        presets: [
          { key: "25" as const, label: "25 / 5", focus: 25, break: 5 },
          { key: "50" as const, label: "50 / 10", focus: 50, break: 10 },
          { key: "custom" as const, label: "Custom", focus: 25, break: 5 },
        ],
        throttledToggle: vi.fn(),
        throttledReset: vi.fn(),
        handlePresetSelect: setPreset,
        handleSaveReflection: vi.fn(),
        handleHyperfocusComplete: vi.fn(),
        handleFocusInputBlur: vi.fn(),
        handleBreakInputBlur: vi.fn(),
      };
    },
  };
});

vi.mock("@/components/focus-timer/CosmicBackground", () => ({
  CosmicBackground: () => null,
}));

vi.mock("@/components/focus-timer/TimerRing", () => ({
  TimerRing: () => <div role="timer" />,
}));

vi.mock("@/components/focus-timer/TimerControls", () => ({
  TimerControls: () => null,
}));

vi.mock("@/components/FocusReflectionModal", () => ({
  FocusReflectionModal: () => null,
}));

vi.mock("@/components/HyperfocusMode", () => ({
  HyperfocusMode: () => null,
}));

describe("FocusTimer preset accessibility", () => {
  it("exposes exactly one pressed preset and moves it with the user's selection", () => {
    render(<FocusTimer sessions={[]} onCompleteSession={vi.fn()} />);

    expect(screen.getByRole("button", { name: "25 / 5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "50 / 10" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "50 / 10" }));

    expect(screen.getByRole("button", { name: "25 / 5" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "50 / 10" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-pressed") === "true"),
    ).toHaveLength(1);
  });

  it("uses semantic primary surfaces without raw palette or inline glow styling", () => {
    const { container } = render(
      <FocusTimer sessions={[]} onCompleteSession={vi.fn()} isPrimaryCTA />,
    );
    const classTokens = Array.from(container.querySelectorAll<HTMLElement>("[class]")).flatMap(
      (element) => (element.getAttribute("class") ?? "").split(/\s+/),
    );
    const forbiddenTokens = classTokens.filter(
      (token) =>
        token.startsWith("bg-gradient-") ||
        token.startsWith("from-") ||
        token.startsWith("to-") ||
        token.startsWith("backdrop-blur") ||
        token.startsWith("ring-violet") ||
        token.startsWith("shadow-violet") ||
        token.startsWith("text-slate") ||
        token.startsWith("dark:text-white"),
    );

    expect(forbiddenTokens).toEqual([]);
    expect(screen.getByRole("button", { name: "25 / 5" })).toHaveClass(
      "border-primary",
      "bg-primary/10",
      "text-foreground",
    );
    expect(
      Array.from(container.querySelectorAll<HTMLElement>("[style]")).some((element) =>
        element.style.cssText.includes("box-shadow"),
      ),
    ).toBe(false);
  });

  it("exposes the embedded focus workspace title at heading level two", () => {
    render(<FocusTimer sessions={[]} onCompleteSession={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 2, name: "Focus" })).toBeInTheDocument();
  });

  it("associates both visible custom-duration labels with stable named inputs", () => {
    const { container } = render(<FocusTimer sessions={[]} onCompleteSession={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    const focusMinutes = screen.getByLabelText("Focus minutes");
    const breakMinutes = screen.getByLabelText("Break minutes");

    expect(focusMinutes).toHaveAttribute("id", "focus-custom-work-minutes");
    expect(focusMinutes).toHaveAttribute("name", "focus-custom-work-minutes");
    expect(focusMinutes).toHaveAttribute("min", "5");
    expect(focusMinutes).toHaveAttribute("max", "120");
    expect(
      container.querySelector('label[for="focus-custom-work-minutes"]'),
    ).toHaveTextContent("Focus minutes");

    expect(breakMinutes).toHaveAttribute("id", "focus-custom-break-minutes");
    expect(breakMinutes).toHaveAttribute("name", "focus-custom-break-minutes");
    expect(breakMinutes).toHaveAttribute("min", "1");
    expect(breakMinutes).toHaveAttribute("max", "60");
    expect(
      container.querySelector('label[for="focus-custom-break-minutes"]'),
    ).toHaveTextContent("Break minutes");
  });
});
