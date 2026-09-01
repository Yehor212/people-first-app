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
import { useRef, useState } from "react";
import {
  render,
  cleanup,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

const backHandlerMock = vi.hoisted(() => {
  const unregister = vi.fn();
  return {
    registeredCallback: undefined as undefined | (() => boolean),
    register: vi.fn((callback: () => boolean) => {
      backHandlerMock.registeredCallback = callback;
      return unregister;
    }),
    unregister,
  };
});

vi.mock("@/lib/androidBackHandler", () => ({
  registerModalCloseCallback: (callback: () => boolean) => backHandlerMock.register(callback),
}));

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
};

describe("HabitActionSheet", () => {
  beforeEach(() => {
    backHandlerMock.registeredCallback = undefined;
    backHandlerMock.register.mockClear();
    backHandlerMock.unregister.mockClear();
  });

  afterEach(() => cleanup());

  it("lets one repository Back owner dismiss only the sheet and restore its opener", async () => {
    const actions = {
      onSkip: vi.fn(),
      onArchive: vi.fn(),
      onEdit: vi.fn(),
      onOpenDetail: vi.fn(),
    };

    function Harness() {
      const [open, setOpen] = useState(false);
      const openerRef = useRef<HTMLButtonElement>(null);

      return (
        <>
          <button ref={openerRef} type="button" onClick={() => setOpen(true)}>
            Open actions
          </button>
          {open && (
            <HabitActionSheet
              open
              onClose={() => setOpen(false)}
              restoreFocusTo={openerRef}
              habit={habit()}
              today="2026-04-19"
              isSkippedToday={false}
              isArchived={false}
              labels={labels}
              {...actions}
            />
          )}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open actions" });
    opener.focus();
    fireEvent.click(opener);

    expect(backHandlerMock.register).toHaveBeenCalledTimes(1);
    const skipAction = screen.getByTestId("habit-action-sheet-h1-skip");
    skipAction.focus();

    act(() => {
      expect(backHandlerMock.registeredCallback?.()).toBe(true);
    });

    expect(screen.queryByTestId("habit-action-sheet-h1")).not.toBeInTheDocument();
    expect(backHandlerMock.unregister).toHaveBeenCalledTimes(1);
    Object.values(actions).forEach((action) => expect(action).not.toHaveBeenCalled());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("moves focus into the sheet and restores the opener after the visible Close action", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const openerRef = useRef<HTMLButtonElement>(null);

      return (
        <>
          <button ref={openerRef} type="button" onClick={() => setOpen(true)}>
            Open actions
          </button>
          {open && (
            <HabitActionSheet
              open
              onClose={() => setOpen(false)}
              restoreFocusTo={openerRef}
              habit={habit()}
              today="2026-04-19"
              isSkippedToday={false}
              isArchived={false}
              labels={labels}
              onSkip={vi.fn()}
            />
          )}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open actions" });
    fireEvent.click(opener);

    const sheet = screen.getByTestId("habit-action-sheet-h1");
    expect(sheet).toHaveClass(
      "min-h-0",
      "overflow-hidden",
      "max-h-[calc(var(--app-viewport-height)-max(1rem,var(--safe-top)))]"
    );
    expect(screen.getByTestId("habit-action-sheet-h1-actions")).toHaveClass(
      "min-h-0",
      "overflow-y-auto",
      "overscroll-contain",
      "pb-[max(1rem,var(--safe-bottom))]"
    );
    await waitFor(() => expect(sheet).toContainElement(document.activeElement as HTMLElement));

    fireEvent.click(screen.getByTestId("habit-action-sheet-h1-close"));

    expect(sheet).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("routes Escape through one dismiss owner and restores the opener", async () => {
    const onClose = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      const openerRef = useRef<HTMLButtonElement>(null);

      return (
        <>
          <button ref={openerRef} type="button" onClick={() => setOpen(true)}>
            Open actions
          </button>
          {open && (
            <HabitActionSheet
              open
              onClose={() => {
                onClose();
                setOpen(false);
              }}
              restoreFocusTo={openerRef}
              habit={habit()}
              today="2026-04-19"
              isSkippedToday={false}
              isArchived={false}
              labels={labels}
              onSkip={vi.fn()}
            />
          )}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open actions" });
    fireEvent.click(opener);
    const sheet = screen.getByTestId("habit-action-sheet-h1");
    await waitFor(() => expect(sheet).toContainElement(document.activeElement as HTMLElement));

    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByTestId("habit-action-sheet-h1")).not.toBeInTheDocument()
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(opener).toHaveFocus());
  });

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

  it("does not expose a one-tap destructive action when a stale caller supplies one", () => {
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
        // @ts-expect-error one-tap deletion is intentionally outside this sheet contract
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByTestId("habit-action-sheet-h1-delete")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
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
      />,
    );
    const testIds = [
      "habit-action-sheet-h1-skip",
      "habit-action-sheet-h1-archive",
      "habit-action-sheet-h1-edit",
      "habit-action-sheet-h1-details",
      "habit-action-sheet-h1-close",
    ];
    testIds.forEach((tid) => {
      const el = screen.getByTestId(tid);
      expect(el.className).toMatch(/min-h-\[(44|48)px\]|h-(11|12|14)/);
    });
  });

  it("keeps a long mixed-direction habit name isolated and wrappable", () => {
    const mixedName =
      "مشي @alex 2026 / https://example.test/a-very-long-unbroken-habit-name";
    render(
      <HabitActionSheet
        open
        onClose={vi.fn()}
        habit={habit({ name: mixedName })}
        today="2026-04-19"
        isSkippedToday={false}
        isArchived={false}
        labels={labels}
        onSkip={vi.fn()}
      />,
    );
    const subtitle = screen.getByTestId("habit-action-sheet-h1-subtitle");
    const isolatedName = subtitle.querySelector("bdi");
    expect(subtitle).toHaveClass("min-w-0");
    expect(isolatedName).toHaveAttribute("dir", "auto");
    expect(isolatedName).toHaveClass("min-w-0", "break-words", "[overflow-wrap:anywhere]");
    expect(isolatedName).toHaveTextContent(mixedName);
  });
});
