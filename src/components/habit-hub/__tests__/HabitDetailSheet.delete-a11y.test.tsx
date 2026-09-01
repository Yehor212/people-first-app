import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { trySetReduceMotion } from "@/lib/motionPreference";
import type { Habit } from "@/types";

const androidBackHarness = vi.hoisted(() => {
  let latestCallback: (() => boolean) | undefined;
  const register = vi.fn((callback: () => boolean) => {
    latestCallback = callback;
    return () => {
      if (latestCallback === callback) latestCallback = undefined;
    };
  });

  return {
    register,
    invokeLatest: () => latestCallback?.(),
    reset: () => {
      latestCallback = undefined;
      register.mockClear();
    },
  };
});

// The component and its React children remain real. This is the native callback
// boundary needed to invoke the callback that Capacitor's Android Back bridge owns.
vi.mock("@/lib/androidBackHandler", () => ({
  registerModalCloseCallback: (callback: () => boolean) => androidBackHarness.register(callback),
}));

import { HabitDetailSheet } from "../HabitDetailSheet";

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-delete-a11y",
    name: "Read 10 pages",
    icon: "📚",
    color: 0,
    position: 0,
    createdAt: 0,
    habitType: "boolean",
    frequency: { numerator: 1, denominator: 1 },
    question: "Did you read today?",
    description: "",
    isArchived: false,
    targetValue: 1,
    targetType: "atLeast",
    unit: "",
    entries: {},
    reminders: [],
    ...overrides,
  };
}

function renderSheet(habitValue = habit()) {
  const callbacks = {
    onClose: vi.fn(),
    onEdit: vi.fn(),
    onUpdate: vi.fn(),
    onSkip: vi.fn(),
    onUnskip: vi.fn(),
    onDelete: vi.fn(),
  };

  render(
    <LanguageProvider>
      <HabitDetailSheet habit={habitValue} {...callbacks} />
    </LanguageProvider>
  );

  return callbacks;
}

async function openDeleteConfirmation() {
  const deleteTrigger = await screen.findByRole("button", { name: "Delete Habit" });
  deleteTrigger.focus();
  fireEvent.click(deleteTrigger);
  const cancel = await screen.findByRole("button", { name: "Cancel" });

  return { cancel, deleteTrigger };
}

describe("HabitDetailSheet destructive delete confirmation", () => {
  beforeEach(() => {
    androidBackHarness.reset();
    trySetReduceMotion(true);
  });

  afterEach(() => {
    androidBackHarness.reset();
    trySetReduceMotion(false);
  });

  it("moves focus to Cancel when the inline delete confirmation opens", async () => {
    renderSheet();

    const { cancel } = await openDeleteConfirmation();

    await waitFor(() => expect(cancel).toHaveFocus());
  });

  it("announces and associates the destructive confirmation with both actions", async () => {
    renderSheet();

    const { cancel } = await openDeleteConfirmation();
    const confirm = screen.getByRole("button", { name: "Delete" });
    const description = screen.getByRole("status");

    expect(description).toHaveTextContent("Are you sure? This cannot be undone.");
    expect(description).toHaveAttribute("aria-live", "polite");
    expect(cancel).toHaveAttribute("aria-describedby", description.id);
    expect(confirm).toHaveAttribute("aria-describedby", description.id);
  });

  it("cancels without deleting and restores focus to the Delete Habit trigger", async () => {
    const callbacks = renderSheet();

    const { cancel } = await openDeleteConfirmation();
    fireEvent.click(cancel);

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete Habit" })).toHaveFocus());
    expect(callbacks.onDelete).not.toHaveBeenCalled();
  });

  it("lets Android Back dismiss only the confirmation and restore its delete trigger", async () => {
    const callbacks = renderSheet();

    await openDeleteConfirmation();
    const confirmBack = androidBackHarness.invokeLatest;

    act(() => {
      expect(confirmBack()).toBe(true);
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete Habit" })).toHaveFocus());
    expect(callbacks.onDelete).not.toHaveBeenCalled();
    expect(callbacks.onClose).not.toHaveBeenCalled();
  });

  it("lets Escape cancel only the confirmation and restore the delete trigger", async () => {
    const callbacks = renderSheet();

    await openDeleteConfirmation();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete Habit" })).toHaveFocus());
    expect(callbacks.onDelete).not.toHaveBeenCalled();
    expect(callbacks.onClose).not.toHaveBeenCalled();
  });

  it("performs one explicit delete, closes the sheet, and blocks a duplicate activation", async () => {
    const callbacks = renderSheet();

    await openDeleteConfirmation();
    const confirm = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
    expect(callbacks.onDelete).toHaveBeenCalledWith("habit-delete-a11y");
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });

  it("isolates a long mixed-direction habit name in the sheet title", () => {
    renderSheet(habit({ name: "Read خطة 2026 — focus" }));

    expect(screen.getByRole("heading", { name: "Read خطة 2026 — focus" }).querySelector("bdi")).toHaveAttribute(
      "dir",
      "auto"
    );
  });
});

describe("HabitDetailSheet habit icon rendering", () => {
  beforeEach(() => {
    androidBackHarness.reset();
    trySetReduceMotion(true);
  });

  afterEach(() => {
    androidBackHarness.reset();
    trySetReduceMotion(false);
  });

  it("renders a stored V2 pictogram ID in both visual slots without exposing the ID as text", () => {
    renderSheet(habit({ icon: "drink-water" }));

    expect(screen.queryAllByText("drink-water")).toHaveLength(0);
    expect(document.querySelectorAll('[data-habit-pictogram="drink-water"]')).toHaveLength(2);
  });

  it("preserves the canonical pictogram mapping for a legacy emoji icon", () => {
    renderSheet(habit({ icon: "📚" }));

    expect(screen.queryAllByText("📚")).toHaveLength(0);
    expect(document.querySelectorAll('[data-habit-pictogram="read"]')).toHaveLength(2);
  });

  it("preserves the canonical identity visual for a named textual icon", () => {
    renderSheet(habit({ icon: "Brain" }));

    expect(screen.queryAllByText("Brain")).toHaveLength(0);
    expect(document.querySelectorAll("svg.lucide-brain")).toHaveLength(2);
  });
});
