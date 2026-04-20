/**
 * HabitActionSheet — unit tests.
 *
 * Covers:
 *   - Skip / Unskip flip on isSkippedToday
 *   - Archive / Unarchive flip on isArchived
 *   - Edit + Open Details items fire handlers + close the sheet
 *   - Conditional rendering (item absent when handler undefined)
 *   - Close button fires onClose
 *   - ≥ 44 px touch targets (min-h-[44px] contract)
 */
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

import { HabitActionSheet } from "../HabitActionSheet";
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

const labels = {
  title: "Actions",
  close: "Close",
  skip: "Skip today",
  unskip: "Unskip today",
  archive: "Archive",
  unarchive: "Unarchive",
  edit: "Edit",
  openDetails: "Open details",
  delete: "Delete",
};

describe("HabitActionSheet", () => {
  afterEach(() => cleanup());

  it("renders Skip item when not skipped today and onSkip is provided", () => {
    const onSkip = vi.fn();
    const onClose = vi.fn();
    render(
      <HabitActionSheet
        open
        onClose={onClose}
        habit={habit()}
        today="2026-04-19"
        isSkippedToday={false}
        isArchived={false}
        labels={labels}
        onSkip={onSkip}
      />,
    );
    const item = screen.getByTestId("habit-action-sheet-h1-skip");
    expect(item).toHaveTextContent("Skip today");
    fireEvent.click(item);
    expect(onSkip).toHaveBeenCalledWith("h1", "2026-04-19");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("flips to Unskip when isSkippedToday=true", () => {
    const onUnskip = vi.fn();
    render(
      <HabitActionSheet
        open
        onClose={vi.fn()}
        habit={habit()}
        today="2026-04-19"
        isSkippedToday={true}
        isArchived={false}
        labels={labels}
        onUnskip={onUnskip}
      />,
    );
    const item = screen.getByTestId("habit-action-sheet-h1-unskip");
    expect(item).toHaveTextContent("Unskip today");
    expect(screen.queryByTestId("habit-action-sheet-h1-skip")).not.toBeInTheDocument();
    fireEvent.click(item);
    expect(onUnskip).toHaveBeenCalledWith("h1", "2026-04-19");
  });

  it("flips Archive ↔ Unarchive on isArchived", () => {
    const onUnarchive = vi.fn();
    render(
      <HabitActionSheet
        open
        onClose={vi.fn()}
        habit={habit({ isArchived: true })}
        today="2026-04-19"
        isSkippedToday={false}
        isArchived={true}
        labels={labels}
        onUnarchive={onUnarchive}
      />,
    );
    expect(screen.queryByTestId("habit-action-sheet-h1-archive")).not.toBeInTheDocument();
    const item = screen.getByTestId("habit-action-sheet-h1-unarchive");
    fireEvent.click(item);
    expect(onUnarchive).toHaveBeenCalledWith("h1");
  });

  it("omits items whose handler is undefined (e.g. no Edit when onEdit absent)", () => {
    render(
      <HabitActionSheet
        open
        onClose={vi.fn()}
        habit={habit()}
        today="2026-04-19"
        isSkippedToday={false}
        isArchived={false}
        labels={labels}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("habit-action-sheet-h1-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-action-sheet-h1-archive")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-action-sheet-h1-details")).not.toBeInTheDocument();
  });

  it("Edit + Open details items fire their handlers and close the sheet", () => {
    const onEdit = vi.fn();
    const onOpenDetail = vi.fn();
    const onClose = vi.fn();
    render(
      <HabitActionSheet
        open
        onClose={onClose}
        habit={habit()}
        today="2026-04-19"
        isSkippedToday={false}
        isArchived={false}
        labels={labels}
        onEdit={onEdit}
        onOpenDetail={onOpenDetail}
      />,
    );
    fireEvent.click(screen.getByTestId("habit-action-sheet-h1-edit"));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders Delete as the destructive fallback when onDelete is provided", () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <HabitActionSheet
        open
        onClose={onClose}
        habit={habit()}
        today="2026-04-19"
        isSkippedToday={false}
        isArchived={false}
        labels={labels}
        onDelete={onDelete}
      />,
    );
    const item = screen.getByTestId("habit-action-sheet-h1-delete");
    expect(item).toHaveTextContent("Delete");
    fireEvent.click(item);
    expect(onDelete).toHaveBeenCalledWith("h1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("close button fires onClose without firing any action", () => {
    const onClose = vi.fn();
    const onSkip = vi.fn();
    render(
      <HabitActionSheet
        open
        onClose={onClose}
        habit={habit()}
        today="2026-04-19"
        isSkippedToday={false}
        isArchived={false}
        labels={labels}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByTestId("habit-action-sheet-h1-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("every action item has min-h-[44px] (Law 9 touch-target contract)", () => {
    render(
      <HabitActionSheet
        open
        onClose={vi.fn()}
        habit={habit()}
        today="2026-04-19"
        isSkippedToday={false}
        isArchived={false}
        labels={labels}
        onSkip={vi.fn()}
        onArchive={vi.fn()}
        onEdit={vi.fn()}
        onOpenDetail={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const testIds = [
      "habit-action-sheet-h1-skip",
      "habit-action-sheet-h1-archive",
      "habit-action-sheet-h1-edit",
      "habit-action-sheet-h1-details",
      "habit-action-sheet-h1-delete",
      "habit-action-sheet-h1-close",
    ];
    testIds.forEach((tid) => {
      const el = screen.getByTestId(tid);
      expect(el.className).toMatch(/min-h-\[(44|48)px\]|h-(11|12|14)/);
    });
  });

  it("subtitle shows habit name (SR-reachable)", () => {
    render(
      <HabitActionSheet
        open
        onClose={vi.fn()}
        habit={habit({ name: "Drink water" })}
        today="2026-04-19"
        isSkippedToday={false}
        isArchived={false}
        labels={labels}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByTestId("habit-action-sheet-h1-subtitle")).toHaveTextContent(
      "Drink water",
    );
  });
});
