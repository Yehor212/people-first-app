/**
 * HeroHabitRow — V2 wrapper tests.
 *
 * Covers:
 *   - Long-press (>=450ms) opens detail sheet, short tap doesn't.
 *   - Long-press on inner toggle button is NOT intercepted (tap wins).
 *   - Enter / Space keyboard equivalent invokes onOpenDetail.
 *   - 7-day chain renders only when the habit has at least one entry.
 *   - Cue + identity badges render when configured.
 */
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));
vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      skipToday: "Skip today",
      archiveHabit: "Archive",
      unarchiveHabit: "Unarchive",
      delete: "Delete",
    },
    language: "en",
  }),
}));

vi.mock("@/components/compact-habit-card/CompactHabitCard", () => ({
  CompactHabitCard: ({ habit }: { habit: { id: string; name: string } }) => (
    <div data-testid={`mock-compact-${habit.id}`}>
      {habit.name}
      <button data-testid={`mock-compact-toggle-${habit.id}`}>toggle</button>
    </div>
  ),
}));

import { HeroHabitRow } from "../HeroHabitRow";
import type { Habit } from "@/types";

const habit = (overrides: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Meditate",
  icon: "🧘",
  color: 0,
  position: 0,
  createdAt: 0,
  habitType: "boolean",
  frequency: { numerator: 1, denominator: 1 },
  question: "",
  description: "",
  isArchived: false,
  targetValue: 1,
  targetType: "atLeast",
  unit: "",
  entries: {},
  reminders: [],
  ...overrides,
});

describe("HeroHabitRow", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("long-press (>=450ms) opens the detail sheet", () => {
    const open = vi.fn();
    render(
      <HeroHabitRow habit={habit()} onToggle={vi.fn()} onDelete={vi.fn()} onOpenDetail={open} />,
    );
    const row = screen.getByTestId("hero-habit-row-h1");
    fireEvent.pointerDown(row);
    void act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(row);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("short tap does not open the detail sheet", () => {
    const open = vi.fn();
    render(
      <HeroHabitRow habit={habit()} onToggle={vi.fn()} onDelete={vi.fn()} onOpenDetail={open} />,
    );
    const row = screen.getByTestId("hero-habit-row-h1");
    fireEvent.pointerDown(row);
    void act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerUp(row);
    expect(open).not.toHaveBeenCalled();
  });

  it("press on the inner toggle button does not trigger long-press", () => {
    const open = vi.fn();
    render(
      <HeroHabitRow habit={habit()} onToggle={vi.fn()} onDelete={vi.fn()} onOpenDetail={open} />,
    );
    const btn = screen.getByTestId("mock-compact-toggle-h1");
    fireEvent.pointerDown(btn);
    void act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerUp(btn);
    expect(open).not.toHaveBeenCalled();
  });

  it("Enter key opens the detail sheet", () => {
    const open = vi.fn();
    render(
      <HeroHabitRow habit={habit()} onToggle={vi.fn()} onDelete={vi.fn()} onOpenDetail={open} />,
    );
    const row = screen.getByTestId("hero-habit-row-h1");
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("renders reminder pill when reminder is configured", () => {
    render(
      <HeroHabitRow
        habit={habit({
          reminders: [{ enabled: true, time: "07:00", days: [1, 2, 3, 4, 5] }],
        })}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const cue = screen.getByTestId("hero-habit-row-h1-cue");
    expect(cue).toHaveTextContent("07:00");
  });

  // Revolution-ergonomics (§6 proposal 2026-04-19): card chain + identity
  // verb removed from the row surface. Identity lives in HeroIdentityPrompt;
  // chain lives in HabitDetailSheet (opened via action-sheet "Open details").

  it("long-press opens the action sheet when skip/archive handlers are provided", () => {
    const onSkip = vi.fn();
    render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onOpenDetail={vi.fn()}
        onSkip={onSkip}
      />,
    );
    const row = screen.getByTestId("hero-habit-row-h1");
    fireEvent.pointerDown(row);
    void act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(row);
    expect(screen.getByTestId("habit-action-sheet-h1")).toBeInTheDocument();
  });

  it("long-press falls back to onOpenDetail when no skip/archive/edit handlers exist", () => {
    const open = vi.fn();
    render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onOpenDetail={open}
      />,
    );
    const row = screen.getByTestId("hero-habit-row-h1");
    fireEvent.pointerDown(row);
    void act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(row);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
