import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoodScopeSelector } from "../MoodScopeSelector";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      orbScopeGroupLabel: "When?",
      orbScopeNow: "In this moment",
      orbScopeDay: "For the whole day",
      orbScopeSpecific: "At a specific time",
      orbScopeSpecificTimeLabel: "Pick a time",
    },
    language: "en",
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn() },
}));

describe("MoodScopeSelector", () => {
  beforeEach(() => {
    useMoodEntryDraftStore.getState().reset();
  });

  it("renders three scope chips", () => {
    render(<MoodScopeSelector />);
    expect(screen.getByTestId("mood-scope-chip-now")).toBeInTheDocument();
    expect(screen.getByTestId("mood-scope-chip-day")).toBeInTheDocument();
    expect(screen.getByTestId("mood-scope-chip-specific")).toBeInTheDocument();
  });

  it("marks 'now' as active by default", () => {
    render(<MoodScopeSelector />);
    const nowChip = screen.getByTestId("mood-scope-chip-now");
    expect(nowChip).toHaveAttribute("aria-checked", "true");
    expect(nowChip).toHaveAttribute("data-active", "true");
  });

  it("switches active chip when clicked", () => {
    render(<MoodScopeSelector />);
    fireEvent.click(screen.getByTestId("mood-scope-chip-day"));
    expect(screen.getByTestId("mood-scope-chip-day")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("mood-scope-chip-now")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(useMoodEntryDraftStore.getState().scope).toBe("day");
  });

  it("does not render time picker for 'now' scope", () => {
    render(<MoodScopeSelector />);
    expect(
      screen.queryByTestId("mood-scope-time-picker"),
    ).not.toBeInTheDocument();
  });

  it("reveals time picker when 'specific' is chosen", () => {
    render(<MoodScopeSelector />);
    fireEvent.click(screen.getByTestId("mood-scope-chip-specific"));
    expect(screen.getByTestId("mood-scope-time-picker")).toBeInTheDocument();
    expect(screen.getByTestId("mood-scope-time-input")).toBeInTheDocument();
  });

  it("updates draft.specificTime when time input changes", () => {
    render(<MoodScopeSelector />);
    fireEvent.click(screen.getByTestId("mood-scope-chip-specific"));
    const input = screen.getByTestId("mood-scope-time-input");
    fireEvent.change(input, { target: { value: "14:30" } });
    expect(useMoodEntryDraftStore.getState().specificTime).toBe("14:30");
  });

  it("uses role=radiogroup for a11y", () => {
    render(<MoodScopeSelector />);
    expect(screen.getByTestId("mood-scope-selector")).toHaveAttribute(
      "role",
      "radiogroup",
    );
  });

  it("i18n labels render correctly", () => {
    render(<MoodScopeSelector />);
    expect(screen.getByText("In this moment")).toBeInTheDocument();
    expect(screen.getByText("For the whole day")).toBeInTheDocument();
    expect(screen.getByText("At a specific time")).toBeInTheDocument();
  });
});
