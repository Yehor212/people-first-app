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
    }>();
    const persistMoodEntry = vi.fn(() => persistence.promise);
    const setMoods = vi.fn();
    const rewardUser = vi.fn();
    const updateChallengeProgress = vi.fn();
    const entry = {
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
    });
    await commit;

    expect(setMoods).toHaveBeenCalledTimes(1);
    expect(rewardUser).toHaveBeenCalledTimes(1);
    expect(updateChallengeProgress).toHaveBeenCalledTimes(1);
    expect(mockTriggerSync).toHaveBeenCalledTimes(1);
    expect(mockSyncMood).toHaveBeenCalledWith(entry);
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
