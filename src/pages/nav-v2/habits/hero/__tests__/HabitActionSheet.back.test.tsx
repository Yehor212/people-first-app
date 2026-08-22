import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Habit } from "@/types";

const backHandlerMocks = vi.hoisted(() => ({
  registrations: [] as Array<{ isOpen: boolean; onClose: () => void }>,
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: (isOpen: boolean, onClose: () => void) => {
    backHandlerMocks.registrations.push({ isOpen, onClose });
  },
}));

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

import { HabitActionSheet } from "../HabitActionSheet";

const testHabit: Habit = {
  id: "habit-back-1",
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
};

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

describe("HabitActionSheet Android Back", () => {
  afterEach(() => {
    cleanup();
    backHandlerMocks.registrations.length = 0;
  });

  it("registers the open sheet as the Back owner and closes without invoking an action", () => {
    const onClose = vi.fn();
    const actions = {
      onSkip: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
      onOpenDetail: vi.fn(),
      onDelete: vi.fn(),
    };

    render(
      <HabitActionSheet
        open
        onClose={onClose}
        habit={testHabit}
        today="2026-08-08"
        isSkippedToday={false}
        isArchived={false}
        labels={labels}
        {...actions}
      />,
    );

    const registration = backHandlerMocks.registrations.at(-1);
    expect(registration).toBeDefined();
    expect(registration?.isOpen).toBe(true);

    registration?.onClose();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actions.onSkip).not.toHaveBeenCalled();
    expect(actions.onArchive).not.toHaveBeenCalled();
    expect(actions.onEdit).not.toHaveBeenCalled();
    expect(actions.onOpenDetail).not.toHaveBeenCalled();
    expect(actions.onDelete).not.toHaveBeenCalled();
  });
});
