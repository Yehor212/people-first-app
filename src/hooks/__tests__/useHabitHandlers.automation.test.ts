import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  syncHabitCompletion: vi.fn(async () => undefined),
  triggerSync: vi.fn(),
}));

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: mocks.triggerSync,
}));

vi.mock("@/storage/realtimeSync", () => ({
  deleteHabitFromCloud: vi.fn(async () => undefined),
  syncHabit: vi.fn(async () => undefined),
  syncHabitCompletion: mocks.syncHabitCompletion,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    sync: vi.fn(),
    warn: vi.fn(),
  },
}));

import { commitHabitEntry } from "../useHabitHandlers";
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";
import type { Habit } from "@/types";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function habit(): Habit {
  return {
    id: "habit-source-1",
    name: "Read",
    icon: "book",
    color: 0,
    position: 0,
    createdAt: 1,
    habitType: "boolean",
    frequency: { numerator: 1, denominator: 1 },
    question: "",
    description: "",
    isArchived: false,
    targetValue: 0,
    targetType: "atLeast",
    unit: "",
    entries: {
      "2026-08-08": {
        value: 2,
        loggedAt: "2026-08-08T12:00:00.000Z",
        source: "quickTap",
      },
    },
    reminders: [],
    updatedAt: "2026-08-08T12:00:00.000Z",
  };
}

describe("habit connected-record persistence order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes completion and runs rewards only after the durable habit plus source intent commit", async () => {
    const persistence = deferred<{
      accountBoundaryGeneration: string;
      intentId: string | null;
    }>();
    const persistHabit = vi.fn(() => persistence.promise);
    const setHabits = vi.fn();
    const onCompleted = vi.fn();
    const onCommitted = vi.fn();
    const assertAccountBoundaryGeneration = vi.fn();
    const nextHabit = habit();

    const commit = commitHabitEntry(nextHabit, "2026-08-08", {
      onCommitted,
      onCompleted,
      persistHabit,
      setHabits,
      assertAccountBoundaryGeneration,
    });

    expect(persistHabit).toHaveBeenCalledWith(nextHabit, "2026-08-08", undefined);
    expect(setHabits).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(onCommitted).not.toHaveBeenCalled();

    persistence.resolve({
      accountBoundaryGeneration: "boundary-a",
      intentId: "source_pending:source-key",
    });
    await commit;

    expect(setHabits).toHaveBeenCalledTimes(1);
    expect(assertAccountBoundaryGeneration).toHaveBeenCalledWith("boundary-a");
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledWith(nextHabit);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(onCommitted).toHaveBeenCalledWith(nextHabit);
  });

  it("publishes and rewards once for an idempotent duplicate completion retry", async () => {
    const nextHabit = habit();
    let habits: Habit[] = [
      {
        ...nextHabit,
        entries: {},
        updatedAt: "2026-08-08T11:59:00.000Z",
      },
    ];
    const setHabits = vi.fn(
      (
        value:
          | Habit[]
          | ((previous: Habit[]) => Habit[]),
      ) => {
        habits = typeof value === "function" ? value(habits) : value;
      },
    );
    const dependencies = {
      setHabits,
      onCompleted: vi.fn(),
      onCommitted: vi.fn(),
      persistHabit: vi.fn(async () => ({
        accountBoundaryGeneration: "boundary-a",
        intentId: "source_pending:source-key",
      })),
      assertAccountBoundaryGeneration: vi.fn(),
    };

    await commitHabitEntry(nextHabit, "2026-08-08", dependencies);
    await commitHabitEntry(nextHabit, "2026-08-08", dependencies);

    expect(habits).toEqual([nextHabit]);
    expect(dependencies.onCompleted).toHaveBeenCalledTimes(1);
    expect(dependencies.onCommitted).toHaveBeenCalledTimes(1);
  });

  it("publishes a distinct merged habit even when two commits share one timestamp", async () => {
    const currentHabit = habit();
    const mergedHabit: Habit = {
      ...currentHabit,
      entries: {
        ...currentHabit.entries,
        "2026-08-09": {
          value: 2,
          loggedAt: currentHabit.updatedAt,
          source: "quickTap",
        },
      },
    };
    let habits = [currentHabit];
    const setHabits = vi.fn((value: Habit[] | ((previous: Habit[]) => Habit[])) => {
      habits = typeof value === "function" ? value(habits) : value;
    });
    const onCompleted = vi.fn();
    const onCommitted = vi.fn();

    await commitHabitEntry(mergedHabit, "2026-08-09", {
      setHabits,
      onCompleted,
      onCommitted,
      persistHabit: vi.fn(async () => ({
        accountBoundaryGeneration: "boundary-a",
        habit: mergedHabit,
        intentId: "source_pending:source-key",
      })),
      assertAccountBoundaryGeneration: vi.fn(),
    });

    expect(habits).toEqual([mergedHabit]);
    expect(onCompleted).toHaveBeenCalledWith(mergedHabit);
    expect(onCommitted).toHaveBeenCalledWith(mergedHabit);
  });

  it("rejects a stale account generation before habit success publication", async () => {
    const setHabits = vi.fn();
    const dependencies = {
      setHabits,
      onCompleted: vi.fn(),
      onCommitted: vi.fn(),
      persistHabit: vi.fn(async () => ({
        accountBoundaryGeneration: "stale-boundary",
        intentId: null,
      })),
      assertAccountBoundaryGeneration: vi.fn(() => {
        throw new Error("account boundary changed");
      }),
    };

    await expect(
      commitHabitEntry(habit(), "2026-08-08", dependencies),
    ).rejects.toThrow("account boundary changed");

    expect(setHabits).not.toHaveBeenCalled();
    expect(dependencies.onCompleted).not.toHaveBeenCalled();
    expect(dependencies.onCommitted).not.toHaveBeenCalled();
  });

  it("rejects an ABA session transition before habit success publication", async () => {
    const setHabits = vi.fn();
    const onCompleted = vi.fn();
    const onCommitted = vi.fn();

    await expect(
      commitHabitEntry(habit(), "2026-08-08", {
        setHabits,
        onCompleted,
        onCommitted,
        persistHabit: vi.fn(async () => {
          notifyAccountSessionTransition();
          notifyAccountSessionTransition();
          return { accountBoundaryGeneration: "boundary-a", intentId: null };
        }),
        assertAccountBoundaryGeneration: vi.fn(),
      }),
    ).rejects.toThrow(/account boundary|session changed/i);

    expect(setHabits).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(onCommitted).not.toHaveBeenCalled();
  });

  it("does not publish, reward, or sync when durable persistence fails", async () => {
    const setHabits = vi.fn();
    const onCompleted = vi.fn();
    const onCommitted = vi.fn();

    await expect(
      commitHabitEntry(habit(), "2026-08-08", {
        onCommitted,
        onCompleted,
        persistHabit: vi.fn(async () => {
          throw new Error("storage unavailable");
        }),
        setHabits,
      }),
    ).rejects.toThrow("storage unavailable");

    expect(setHabits).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(onCommitted).not.toHaveBeenCalled();
    expect(mocks.syncHabitCompletion).not.toHaveBeenCalled();
    expect(mocks.triggerSync).not.toHaveBeenCalled();
  });
});
