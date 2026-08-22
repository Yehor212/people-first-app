import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  triggerSync: vi.fn(),
  queueFocusSessionSync: vi.fn(async () => undefined),
  focusSessionCompleted: vi.fn(),
  updateAllQuestsProgress: vi.fn(() => []),
  playSound: vi.fn(),
}));

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: mocks.triggerSync,
}));

vi.mock("@/lib/offlineQueueHandlers", () => ({
  queueFocusSessionSync: mocks.queueFocusSessionSync,
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { focusSessionCompleted: mocks.focusSessionCompleted },
}));

vi.mock("@/lib/randomQuests", () => ({
  updateAllQuestsProgress: mocks.updateAllQuestsProgress,
}));

vi.mock("@/lib/audioManager", () => ({
  playSound: mocks.playSound,
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { focusCompleted: "focusCompleted" },
}));

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { commitFocusSession } from "../useFocusHandlers";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("focus connected-record persistence order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes and rewards only after the durable focus plus source-intent commit", async () => {
    const persistence = deferred<{
      accountBoundaryGeneration: string;
      intentId: string | null;
    }>();
    const persistFocusSession = vi.fn(() => persistence.promise);
    const setFocusSessions = vi.fn();
    const rewardUser = vi.fn();
    const updateChallengeProgress = vi.fn();
    const checkForFeatureUnlocks = vi.fn();
    const earnTreats = vi.fn();
    const session = {
      id: "focus-source-1",
      duration: 25,
      completedAt: 100,
      date: "2026-08-08",
      status: "completed" as const,
      updatedAt: 101,
    };

    const commit = commitFocusSession(session, {
      setFocusSessions,
      rewardUser,
      updateChallengeProgress,
      checkForFeatureUnlocks,
      earnTreats,
      persistFocusSession,
      rewardsEnabled: true,
    });

    expect(persistFocusSession).toHaveBeenCalledWith(session);
    expect(setFocusSessions).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
    expect(updateChallengeProgress).not.toHaveBeenCalled();
    expect(checkForFeatureUnlocks).not.toHaveBeenCalled();
    expect(mocks.queueFocusSessionSync).not.toHaveBeenCalled();
    expect(mocks.triggerSync).not.toHaveBeenCalled();

    persistence.resolve({
      accountBoundaryGeneration: "boundary-a",
      intentId: "source_pending:source-key",
    });
    await commit;

    expect(setFocusSessions).toHaveBeenCalledTimes(1);
    expect(rewardUser).toHaveBeenCalledTimes(1);
    expect(updateChallengeProgress).toHaveBeenCalledTimes(1);
    expect(checkForFeatureUnlocks).toHaveBeenCalledTimes(1);
    expect(mocks.queueFocusSessionSync).toHaveBeenCalledWith(session);
    expect(mocks.triggerSync).toHaveBeenCalledTimes(1);
    expect(mocks.focusSessionCompleted).toHaveBeenCalledWith(25);
  });

  it("does not publish success or rewards when durable focus persistence fails", async () => {
    const setFocusSessions = vi.fn();
    const rewardUser = vi.fn();
    const updateChallengeProgress = vi.fn();
    const checkForFeatureUnlocks = vi.fn();
    const session = {
      id: "focus-source-2",
      duration: 10,
      completedAt: 110,
      date: "2026-08-08",
      status: "completed" as const,
      updatedAt: 110,
    };

    await expect(
      commitFocusSession(session, {
        setFocusSessions,
        rewardUser,
        updateChallengeProgress,
        checkForFeatureUnlocks,
        earnTreats: vi.fn(),
        persistFocusSession: vi.fn(async () => {
          throw new Error("storage unavailable");
        }),
        rewardsEnabled: true,
      }),
    ).rejects.toThrow("storage unavailable");

    expect(setFocusSessions).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
    expect(updateChallengeProgress).not.toHaveBeenCalled();
    expect(checkForFeatureUnlocks).not.toHaveBeenCalled();
    expect(mocks.queueFocusSessionSync).not.toHaveBeenCalled();
    expect(mocks.triggerSync).not.toHaveBeenCalled();
    expect(mocks.focusSessionCompleted).not.toHaveBeenCalled();
  });
});
