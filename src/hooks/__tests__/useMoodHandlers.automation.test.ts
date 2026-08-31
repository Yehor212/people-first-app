import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTriggerSync = vi.fn();
const mockSyncMood = vi.fn(async (..._args: unknown[]) => undefined);
const mockMoodTracked = vi.fn();

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: (...args: unknown[]) => mockTriggerSync(...args),
}));

vi.mock("@/storage/realtimeSync", () => ({
  syncMood: (...args: unknown[]) => mockSyncMood(...args),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { moodSaved: "moodSaved" },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { moodTracked: (...args: unknown[]) => mockMoodTracked(...args) },
}));

vi.mock("@/lib/audioManager", () => ({
  playSound: vi.fn(),
}));

import { commitMoodEntry } from "../useMoodHandlers";
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";
import type { MoodEntry } from "@/types";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("mood connected-record persistence order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes and rewards only after the durable mood plus source intent commit", async () => {
    const persistence = deferred<{
      accountBoundaryGeneration: string;
      intentId: string | null;
      syncOutboxPersisted?: boolean;
    }>();
    const persistMoodEntry = vi.fn(() => persistence.promise);
    const setMoods = vi.fn();
    const rewardUser = vi.fn();
    const updateChallengeProgress = vi.fn();
    const assertAccountBoundaryGeneration = vi.fn();
    const entry: MoodEntry = {
      id: "mood-source-1",
      mood: "good" as const,
      note: "A user-authored note",
      date: "2026-08-08",
      timestamp: 120,
      updatedAt: 120,
    };

    const commit = Promise.resolve(
      commitMoodEntry(entry, {
        setMoods,
        rewardUser,
        updateChallengeProgress,
        persistMoodEntry,
        assertAccountBoundaryGeneration,
      }),
    );

    expect(persistMoodEntry).toHaveBeenCalledWith(entry);
    expect(setMoods).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
    expect(updateChallengeProgress).not.toHaveBeenCalled();
    expect(mockTriggerSync).not.toHaveBeenCalled();
    expect(mockSyncMood).not.toHaveBeenCalled();

    persistence.resolve({
      accountBoundaryGeneration: "boundary-a",
      intentId: "source_pending:source-key",
      syncOutboxPersisted: true,
    });
    await commit;

    expect(setMoods).toHaveBeenCalledTimes(1);
    expect(assertAccountBoundaryGeneration).toHaveBeenCalledWith("boundary-a");
    expect(rewardUser).toHaveBeenCalledTimes(1);
    expect(updateChallengeProgress).toHaveBeenCalledTimes(1);
    expect(mockTriggerSync).toHaveBeenCalledTimes(1);
    expect(mockSyncMood).not.toHaveBeenCalled();
  });

  it("publishes one mood for an idempotent duplicate retry", async () => {
    const entry = {
      id: "mood-source-retry",
      mood: "good" as const,
      date: "2026-08-08",
      timestamp: 140,
      updatedAt: 140,
    };
    let moods: MoodEntry[] = [];
    const setMoods = vi.fn(
      (value: MoodEntry[] | ((previous: MoodEntry[]) => MoodEntry[])) => {
        moods = typeof value === "function" ? value(moods) : value;
      },
    );
    const dependencies = {
      setMoods,
      rewardUser: vi.fn(),
      updateChallengeProgress: vi.fn(),
      persistMoodEntry: vi.fn(async () => ({
        accountBoundaryGeneration: "boundary-a",
        intentId: "source_pending:source-key",
        syncOutboxPersisted: true,
      })),
      assertAccountBoundaryGeneration: vi.fn(),
    };

    await commitMoodEntry(entry, dependencies);
    await commitMoodEntry(entry, dependencies);

    expect(moods).toEqual([entry]);
    expect(dependencies.rewardUser).toHaveBeenCalledTimes(1);
    expect(mockSyncMood).not.toHaveBeenCalled();
  });

  it("rejects a stale account generation before UI success publication", async () => {
    const setMoods = vi.fn();
    const rewardUser = vi.fn();
    const dependencies = {
      setMoods,
      rewardUser,
      updateChallengeProgress: vi.fn(),
      persistMoodEntry: vi.fn(async () => ({
        accountBoundaryGeneration: "stale-boundary",
        intentId: null,
      })),
      assertAccountBoundaryGeneration: vi.fn(() => {
        throw new Error("account boundary changed");
      }),
    };

    await expect(
      commitMoodEntry(
        {
          id: "mood-source-stale",
          mood: "okay",
          date: "2026-08-08",
          timestamp: 150,
          updatedAt: 150,
        },
        dependencies,
      ),
    ).rejects.toThrow("account boundary changed");

    expect(setMoods).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
    expect(mockSyncMood).not.toHaveBeenCalled();
  });

  it("rejects an ABA session transition before UI success publication", async () => {
    const setMoods = vi.fn();
    const rewardUser = vi.fn();

    await expect(
      commitMoodEntry(
        {
          id: "mood-source-session-stale",
          mood: "okay",
          date: "2026-08-08",
          timestamp: 151,
          updatedAt: 151,
        },
        {
          setMoods,
          rewardUser,
          updateChallengeProgress: vi.fn(),
          persistMoodEntry: vi.fn(async () => {
            notifyAccountSessionTransition();
            notifyAccountSessionTransition();
            return { accountBoundaryGeneration: "boundary-a", intentId: null };
          }),
          assertAccountBoundaryGeneration: vi.fn(),
        },
      ),
    ).rejects.toThrow(/account boundary|session changed/i);

    expect(setMoods).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
    expect(mockSyncMood).not.toHaveBeenCalled();
  });

  it("does not publish success side effects when the durable commit fails", async () => {
    const persistMoodEntry = vi.fn(async () => {
      throw new Error("storage unavailable");
    });
    const setMoods = vi.fn();
    const rewardUser = vi.fn();
    const updateChallengeProgress = vi.fn();
    const entry = {
      id: "mood-source-2",
      mood: "okay" as const,
      date: "2026-08-08",
      timestamp: 130,
      updatedAt: 130,
    };

    await expect(
      Promise.resolve(
        commitMoodEntry(entry, {
          setMoods,
          rewardUser,
          updateChallengeProgress,
          persistMoodEntry,
        }),
      ),
    ).rejects.toThrow("storage unavailable");

    expect(setMoods).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
    expect(updateChallengeProgress).not.toHaveBeenCalled();
    expect(mockMoodTracked).not.toHaveBeenCalled();
    expect(mockTriggerSync).not.toHaveBeenCalled();
    expect(mockSyncMood).not.toHaveBeenCalled();
  });
});
