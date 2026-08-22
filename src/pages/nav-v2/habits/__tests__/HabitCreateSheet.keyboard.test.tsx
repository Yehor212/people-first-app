import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const formMocks = vi.hoisted(() => ({
  form: {
    handleEditHabit: vi.fn(),
    resetForm: vi.fn(),
    setIsAdding: vi.fn(),
    setShowCustomForm: vi.fn(),
    showCustomForm: true,
    startFromTemplate: vi.fn(),
  },
}));
const backHandlerMock = vi.hoisted(() => vi.fn());

vi.mock("vaul", () => ({
  Drawer: {
    Root: ({
      children,
      open,
      repositionInputs,
    }: {
      children: ReactNode;
      open: boolean;
      repositionInputs?: boolean;
    }) =>
      open ? (
        <div
          data-testid="vaul-root"
          data-reposition-inputs={String(repositionInputs)}
        >
          {children}
        </div>
      ) : null,
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Overlay: () => <div />,
    Content: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      edit: "Edit",
      navV2HabitsCreate: "Create habit",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({ useBackHandler: backHandlerMock }));
vi.mock("@/hooks/useHabitForm", () => ({ useHabitForm: () => formMocks.form }));
vi.mock("@/components/habit-creation-form/HabitCreationForm", () => ({
  HabitCreationForm: () => <input autoFocus placeholder="Habit name..." />,
}));

import { HabitCreateSheet } from "../HabitCreateSheet";

describe("HabitCreateSheet keyboard visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formMocks.form.showCustomForm = true;
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      window.setTimeout(() => callback(performance.now()), 0),
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) =>
      window.clearTimeout(handle),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("corrects a late Android WebView auto-scroll after the IME has settled", async () => {
    render(
      <HabitCreateSheet
        open
        onClose={vi.fn()}
        habits={[]}
        onAddHabit={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Habit name...");
    const scrollRegion = screen.getByTestId("habits-create-sheet-scroll-region");

    Object.defineProperty(scrollRegion, "scrollTop", {
      configurable: true,
      value: 262.1025695800781,
      writable: true,
    });
    vi.spyOn(input, "getBoundingClientRect").mockImplementation(() => {
      const top = 106.82051086425781 - (scrollRegion.scrollTop - 262.1025695800781);
      return {
        bottom: top + 49.64102554321289,
        height: 49.64102554321289,
        left: 203.6923065185547,
        right: 648.4102630615234,
        top,
        width: 444.71795654296875,
        x: 203.6923065185547,
        y: top,
        toJSON: () => ({}),
      };
    });
    vi.spyOn(scrollRegion, "getBoundingClientRect").mockReturnValue({
      bottom: 187.48717498779297,
      height: 92.66666412353516,
      left: 0,
      right: 852.1025390625,
      top: 94.82051086425781,
      width: 852.1025390625,
      x: 0,
      y: 94.82051086425781,
      toJSON: () => ({}),
    });

    await act(async () => vi.runAllTimers());
    expect(scrollRegion.scrollTop).toBeCloseTo(262.1025695800781, 3);

    // Chromium performs this late scroll after focus/viewport callbacks.
    scrollRegion.scrollTop = 289.23077392578125;
    fireEvent.scroll(scrollRegion);
    await act(async () => vi.runAllTimers());

    expect(scrollRegion.scrollTop).toBeCloseTo(262.1025695800781, 3);

    // Once the bounded keyboard transition window has elapsed, a deliberate
    // user scroll must not be snapped back to the focused field.
    await act(async () => vi.advanceTimersByTime(1_600));
    scrollRegion.scrollTop = 310;
    fireEvent.scroll(scrollRegion);
    await act(async () => vi.runAllTimers());

    expect(scrollRegion.scrollTop).toBe(310);
  });

  it("returns from the custom form to Quick Add before closing the sheet", () => {
    const onClose = vi.fn();

    render(
      <HabitCreateSheet
        open
        onClose={onClose}
        habits={[]}
        onAddHabit={vi.fn()}
      />,
    );

    const [isRegistered, handleBack] = backHandlerMock.mock.calls.at(-1) ?? [];
    expect(isRegistered).toBe(true);

    const scrollRegion = screen.getByTestId("habits-create-sheet-scroll-region");
    scrollRegion.scrollTop = 262;

    act(() => {
      (handleBack as () => void)();
    });

    expect(formMocks.form.setShowCustomForm).toHaveBeenCalledWith(false);
    expect(scrollRegion.scrollTop).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves IME resizing to the visual-viewport scroll contract", () => {
    render(
      <HabitCreateSheet
        open
        onClose={vi.fn()}
        habits={[]}
        onAddHabit={vi.fn()}
      />,
    );

    expect(screen.getByTestId("vaul-root")).toHaveAttribute(
      "data-reposition-inputs",
      "false",
    );
  });
});
