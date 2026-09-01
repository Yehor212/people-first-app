import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FocusTimer } from "../FocusTimer";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      focus: "التركيز",
      focusLabelPrompt: "عنوان الجلسة",
      focusLabelPlaceholder: "ما الذي تريد التركيز عليه؟",
      todayMinutes: "دقيقة اليوم",
    },
    language: "ar",
  }),
}));

vi.mock("@/hooks/useFocusTimer", () => ({
  presetColors: {},
  useFocusTimer: () => ({
    preset: "short",
    focusMinutes: 25,
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
    totalMinutesToday: 15,
    progress: 0,
    presets: [],
    throttledToggle: vi.fn(),
    throttledReset: vi.fn(),
    handlePresetSelect: vi.fn(),
    handleSaveReflection: vi.fn(),
    handleHyperfocusComplete: vi.fn(),
    handleFocusInputBlur: vi.fn(),
    handleBreakInputBlur: vi.fn(),
  }),
}));

vi.mock("../CosmicBackground", () => ({ CosmicBackground: () => null }));
vi.mock("../TimerRing", () => ({ TimerRing: () => null }));
vi.mock("../TimerControls", () => ({ TimerControls: () => null }));

describe("FocusTimer locale formatting", () => {
  it("formats and isolates today's minutes in Arabic", () => {
    render(<FocusTimer sessions={[]} onCompleteSession={vi.fn()} />);

    const summary = screen.getByText(/دقيقة اليوم/u);

    expect(summary.querySelector("bdi")).toHaveTextContent("١٥");
    expect(summary).not.toHaveTextContent("15");
  });
});
