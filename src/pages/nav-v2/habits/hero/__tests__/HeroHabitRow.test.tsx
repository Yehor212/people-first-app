/**
 * HeroHabitRow — V2 wrapper tests.
 *
 * Covers:
 *   - Long-press (>=450ms) opens detail sheet, short tap doesn't.
 *   - Long-press on inner toggle button is NOT intercepted (tap wins).
 *   - Explicit named action button replaces hidden Enter / Space group activation.
 *   - Reminder cue renders when configured.
 */
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));
vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2HabitsActions: "Actions",
      navV2HabitsOpenDetails: "Open details",
      cancel: "Cancel",
      edit: "Edit",
      skipToday: "Skip today",
      unskip: "Unskip today",
      archiveHabit: "Archive",
      unarchiveHabit: "Unarchive",
    },
    language: "en",
  }),
}));

vi.mock("../HeroWeeklyHabitCard", () => ({
  HeroWeeklyHabitCard: ({
    habit,
    initiallyCollapsed,
    onOpenActions,
    actionsLabel,
    actionsTriggerRef,
  }: {
    habit: { id: string; name: string };
    initiallyCollapsed?: boolean;
    onOpenActions?: () => void;
    actionsLabel?: string;
    actionsTriggerRef?: { current: HTMLButtonElement | null };
  }) => (
    <div
      data-testid={`mock-weekly-card-${habit.id}`}
      data-initially-collapsed={initiallyCollapsed ? "true" : "false"}
    >
      {habit.name}
      {onOpenActions && (
        <button
          ref={actionsTriggerRef}
          type="button"
          aria-label={actionsLabel}
          onClick={onOpenActions}
          data-testid={`hero-weekly-card-${habit.id}-actions`}
        >
          Actions
        </button>
      )}
      <div
        role="checkbox"
        aria-checked="false"
        tabIndex={0}
        data-testid={`mock-week-cell-${habit.id}`}
      >
        week-cell
      </div>
    </div>
  ),
}));

const actionSheetMocks = vi.hoisted(() => ({
  render: vi.fn(),
}));

vi.mock("../HabitActionSheet", () => ({
  HabitActionSheet: (props: {
    open: boolean;
    habit: { id: string; name: string };
  }) => {
    actionSheetMocks.render(props);
    if (!props.open) return null;
    return <div data-testid={`habit-action-sheet-${props.habit.id}`}>Action sheet</div>;
  },
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
  beforeEach(() => {
    vi.useFakeTimers();
    actionSheetMocks.render.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("long-press (>=450ms) opens the detail sheet", () => {
    const open = vi.fn();
    render(
      <HeroHabitRow habit={habit()} onToggle={vi.fn()} onOpenDetail={open} />,
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
      <HeroHabitRow habit={habit()} onToggle={vi.fn()} onOpenDetail={open} />,
    );
    const row = screen.getByTestId("hero-habit-row-h1");
    fireEvent.pointerDown(row);
    void act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerUp(row);
    expect(open).not.toHaveBeenCalled();
  });

  it("press on the inner week cell does not trigger long-press", () => {
    const open = vi.fn();
    render(
      <HeroHabitRow habit={habit()} onToggle={vi.fn()} onOpenDetail={open} />,
    );
    const btn = screen.getByTestId("mock-week-cell-h1");
    fireEvent.pointerDown(btn);
    void act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerUp(btn);
    expect(open).not.toHaveBeenCalled();
  });

  it("does not expose the non-interactive row group as a hidden keyboard action", () => {
    const open = vi.fn();
    render(
      <HeroHabitRow habit={habit()} onToggle={vi.fn()} onOpenDetail={open} />,
    );
    const row = screen.getByTestId("hero-habit-row-h1");
    expect(row).toHaveAttribute("role", "group");
    expect(row).not.toHaveAttribute("tabindex");
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(open).not.toHaveBeenCalled();
  });

  it("opens the action sheet from an explicitly named button when row actions are wired", () => {
    render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
        onOpenDetail={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: /Actions for.*Meditate/ });
    expect(trigger).toHaveAccessibleName("Actions for \u2068Meditate\u2069");
    fireEvent.click(trigger);
    expect(screen.getByTestId("habit-action-sheet-h1")).toBeInTheDocument();
    expect(
      actionSheetMocks.render.mock.lastCall?.[0]?.restoreFocusTo?.current,
    ).toBe(trigger);
  });

  it("notifies the native banner gate while the action sheet is open", () => {
    const onActionSheetOpenChange = vi.fn();
    const view = render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
        onOpenDetail={vi.fn()}
        onSkip={vi.fn()}
        onActionSheetOpenChange={onActionSheetOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Actions for.*Meditate/ }));

    expect(onActionSheetOpenChange).toHaveBeenLastCalledWith(true);
    view.unmount();
    expect(onActionSheetOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("does not mount the action sheet before native banner suppression resolves", async () => {
    let acknowledgeSuppression: (() => void) | undefined;
    const onBeforeActionSheetOpen = vi.fn(
      () => new Promise<boolean>((resolve) => {
        acknowledgeSuppression = () => resolve(true);
      }),
    );
    render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
        onSkip={vi.fn()}
        onBeforeActionSheetOpen={onBeforeActionSheetOpen}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Actions for.*Meditate/ });
    trigger.focus();
    fireEvent.click(trigger);

    expect(onBeforeActionSheetOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("habit-action-sheet-h1")).not.toBeInTheDocument();

    await act(async () => {
      acknowledgeSuppression?.();
      await Promise.resolve();
    });
    expect(screen.getByTestId("habit-action-sheet-h1")).toBeInTheDocument();
    expect(trigger).not.toHaveFocus();
  });

  it("keeps the action sheet closed when native banner suppression is not acknowledged", async () => {
    const onBeforeActionSheetOpen = vi.fn(() => Promise.resolve(false));
    render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
        onSkip={vi.fn()}
        onBeforeActionSheetOpen={onBeforeActionSheetOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Actions for.*Meditate/ }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("habit-action-sheet-h1")).not.toBeInTheDocument();
  });

  it("passes progressive collapse state into the weekly card", () => {
    render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
        initiallyCollapsed
      />,
    );

    expect(screen.getByTestId("mock-weekly-card-h1")).toHaveAttribute(
      "data-initially-collapsed",
      "true",
    );
  });

  it("does not mount the closed action sheet before secondary actions are requested", () => {
    render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
        onOpenDetail={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(actionSheetMocks.render).not.toHaveBeenCalled();
  });

  it("does not make a stale one-tap delete callback reachable from the row", () => {
    render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
        // @ts-expect-error one-tap deletion is intentionally outside the row action contract
        onDelete={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("hero-weekly-card-h1-actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-action-sheet-h1")).not.toBeInTheDocument();
  });

  it("renders reminder pill when reminder is configured", () => {
    render(
      <HeroHabitRow
        habit={habit({
          reminders: [{ enabled: true, time: "07:00", days: [1, 2, 3, 4, 5] }],
        })}
        onToggle={vi.fn()}
      />,
    );
    const cue = screen.getByTestId("hero-habit-row-h1-cue");
    expect(cue).toHaveTextContent("07:00");
  });

  // Revolution-ergonomics (§6 proposal 2026-04-19): card chain + identity
  // verb removed from the row surface. Identity lives in HeroIdentityPrompt.

  it("long-press opens the action sheet when skip/archive handlers are provided", () => {
    const onSkip = vi.fn();
    render(
      <HeroHabitRow
        habit={habit()}
        onToggle={vi.fn()}
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
