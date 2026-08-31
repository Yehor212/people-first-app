import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  wakeFromDurableStorage: vi.fn(async () => undefined),
  focusSessionCompleted: vi.fn(),
  updateAllQuestsProgress: vi.fn(() => []),
  playSound: vi.fn(),
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: { wakeFromDurableStorage: mocks.wakeFromDurableStorage },
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
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";
import type { FocusSession } from "@/types";

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
      primaryInserted: boolean;
      syncOutboxPersisted: boolean;
    }>();
    const persistFocusSession = vi.fn(() => persistence.promise);
    const setFocusSessions = vi.fn();
    const rewardUser = vi.fn();
    const updateChallengeProgress = vi.fn();
    const checkForFeatureUnlocks = vi.fn();
    const earnTreats = vi.fn();
    const assertAccountBoundaryGeneration = vi.fn();
    const session: FocusSession = {
      id: "focus-source-1",
      duration: 25,
      completedAt: 100,
      date: "2026-08-08",
      status: "completed" as const,
      updatedAt: 101,
    };

    const expectedBoundary = {
      ownerUserId: "owner-a",
      accountBoundaryGeneration: "boundary-a",
    };
    const commit = commitFocusSession(
      session,
      {
        setFocusSessions,
        rewardUser,
        updateChallengeProgress,
        checkForFeatureUnlocks,
        earnTreats,
        persistFocusSession,
        assertAccountBoundaryGeneration,
        rewardsEnabled: true,
      },
      expectedBoundary
    );

    expect(persistFocusSession).toHaveBeenCalledWith(session, expectedBoundary);
    expect(setFocusSessions).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
    expect(updateChallengeProgress).not.toHaveBeenCalled();
    expect(checkForFeatureUnlocks).not.toHaveBeenCalled();
    expect(mocks.wakeFromDurableStorage).not.toHaveBeenCalled();

    persistence.resolve({
      accountBoundaryGeneration: "boundary-a",
      intentId: "source_pending:source-key",
      primaryInserted: true,
      syncOutboxPersisted: true,
    });
    await commit;

    expect(setFocusSessions).toHaveBeenCalledTimes(1);
    expect(assertAccountBoundaryGeneration).toHaveBeenCalledWith("boundary-a");
    expect(rewardUser).toHaveBeenCalledTimes(1);
    expect(updateChallengeProgress).toHaveBeenCalledTimes(1);
    expect(checkForFeatureUnlocks).toHaveBeenCalledTimes(1);
    expect(mocks.wakeFromDurableStorage).toHaveBeenCalledTimes(1);
    expect(mocks.focusSessionCompleted).toHaveBeenCalledWith(25);
  });

  it("publishes one focus session for an idempotent duplicate retry", async () => {
    const session = {
      id: "focus-source-retry",
      duration: 25,
      completedAt: 120,
      date: "2026-08-08",
      status: "completed" as const,
      updatedAt: 120,
    };
    let sessions: FocusSession[] = [];
    const setFocusSessions = vi.fn(
      (
        value:
          | FocusSession[]
          | ((previous: FocusSession[]) => FocusSession[]),
      ) => {
        sessions = typeof value === "function" ? value(sessions) : value;
      },
    );
    const dependencies = {
      setFocusSessions,
      rewardUser: vi.fn(),
      earnTreats: vi.fn(),
      updateChallengeProgress: vi.fn(),
      checkForFeatureUnlocks: vi.fn(),
      persistFocusSession: vi.fn(async () => ({
        accountBoundaryGeneration: "boundary-a",
        intentId: "source_pending:source-key",
        primaryInserted: true,
        syncOutboxPersisted: true,
      })),
      assertAccountBoundaryGeneration: vi.fn(),
    };

    await commitFocusSession(session, dependencies);
    await commitFocusSession(session, dependencies);

    expect(sessions).toEqual([session]);
    expect(dependencies.rewardUser).toHaveBeenCalledTimes(1);
    expect(mocks.wakeFromDurableStorage).toHaveBeenCalledTimes(2);
  });

  it("rejects a stale account generation before focus success publication", async () => {
    const setFocusSessions = vi.fn();
    const rewardUser = vi.fn();
    const dependencies = {
      setFocusSessions,
      rewardUser,
      earnTreats: vi.fn(),
      updateChallengeProgress: vi.fn(),
      checkForFeatureUnlocks: vi.fn(),
      persistFocusSession: vi.fn(async () => ({
        accountBoundaryGeneration: "stale-boundary",
        intentId: null,
        primaryInserted: true,
        syncOutboxPersisted: false,
      })),
      assertAccountBoundaryGeneration: vi.fn(() => {
        throw new Error("account boundary changed");
      }),
    };

    await expect(
      commitFocusSession(
        {
          id: "focus-source-stale",
          duration: 25,
          completedAt: 130,
          date: "2026-08-08",
          status: "completed",
          updatedAt: 130,
        },
        dependencies,
      ),
    ).rejects.toThrow("account boundary changed");

    expect(setFocusSessions).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
    expect(mocks.wakeFromDurableStorage).not.toHaveBeenCalled();
  });

  it("rejects an ABA session transition before focus success publication", async () => {
    const setFocusSessions = vi.fn();
    const rewardUser = vi.fn();

    await expect(
      commitFocusSession(
        {
          id: "focus-source-session-stale",
          duration: 25,
          completedAt: 131,
          date: "2026-08-08",
          status: "completed",
          updatedAt: 131,
        },
        {
          setFocusSessions,
          rewardUser,
          earnTreats: vi.fn(),
          updateChallengeProgress: vi.fn(),
          checkForFeatureUnlocks: vi.fn(),
          persistFocusSession: vi.fn(async () => {
            notifyAccountSessionTransition();
            notifyAccountSessionTransition();
            return {
              accountBoundaryGeneration: "boundary-a",
              intentId: null,
              primaryInserted: true,
              syncOutboxPersisted: false,
            };
          }),
          assertAccountBoundaryGeneration: vi.fn(),
        },
      ),
    ).rejects.toThrow(/account boundary|session changed/i);

    expect(setFocusSessions).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
    expect(mocks.wakeFromDurableStorage).not.toHaveBeenCalled();
  });

  it("rejects an ABA session transition during the post-commit durable wake", async () => {
    mocks.wakeFromDurableStorage.mockImplementationOnce(async () => {
      notifyAccountSessionTransition();
      notifyAccountSessionTransition();
    });
    const setFocusSessions = vi.fn();
    const rewardUser = vi.fn();

    await expect(
      commitFocusSession(
        {
          id: "focus-source-wake-session-stale",
          duration: 25,
          completedAt: 132,
          date: "2026-08-08",
          status: "completed",
          updatedAt: 132,
        },
        {
          setFocusSessions,
          rewardUser,
          earnTreats: vi.fn(),
          updateChallengeProgress: vi.fn(),
          checkForFeatureUnlocks: vi.fn(),
          persistFocusSession: vi.fn(async () => ({
            accountBoundaryGeneration: "boundary-a",
            intentId: null,
            primaryInserted: true,
            syncOutboxPersisted: true,
          })),
          assertAccountBoundaryGeneration: vi.fn(),
        }
      )
    ).rejects.toThrow(/account boundary|session changed/i);

    expect(mocks.wakeFromDurableStorage).toHaveBeenCalledTimes(1);
    expect(setFocusSessions).not.toHaveBeenCalled();
    expect(rewardUser).not.toHaveBeenCalled();
  });

  it("does not publish success or rewards when durable focus persistence fails", async () => {
    const setFocusSessions = vi.fn();
    const rewardUser = vi.fn();
    const updateChallengeProgress = vi.fn();
    const checkForFeatureUnlocks = vi.fn();
    const session: FocusSession = {
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
    expect(mocks.wakeFromDurableStorage).not.toHaveBeenCalled();
    expect(mocks.focusSessionCompleted).not.toHaveBeenCalled();
  });

  it("does not repeat side effects when a cold retry finds the primary record in Dexie", async () => {
    const session: FocusSession = {
      id: "focus-source-cold-retry",
      duration: 25,
      completedAt: 140,
      date: "2026-08-08",
      status: "completed",
      updatedAt: 140,
    };
    let hydratedSessions: FocusSession[] = [];
    const setFocusSessions = vi.fn(
      (value: FocusSession[] | ((previous: FocusSession[]) => FocusSession[])) => {
        hydratedSessions =
          typeof value === "function" ? value(hydratedSessions) : value;
      }
    );
    const persistFocusSession = vi
      .fn()
      .mockResolvedValueOnce({
        accountBoundaryGeneration: "boundary-a",
        intentId: null,
        primaryInserted: true,
        syncOutboxPersisted: true,
      })
      .mockResolvedValueOnce({
        accountBoundaryGeneration: "boundary-a",
        intentId: null,
        primaryInserted: false,
        syncOutboxPersisted: true,
      });
    const dependencies = {
      setFocusSessions,
      rewardUser: vi.fn(),
      earnTreats: vi.fn(),
      updateChallengeProgress: vi.fn(),
      checkForFeatureUnlocks: vi.fn(),
      persistFocusSession,
      assertAccountBoundaryGeneration: vi.fn(),
    };

    await commitFocusSession(session, dependencies);
    hydratedSessions = [];
    await commitFocusSession(session, dependencies);

    expect(hydratedSessions).toEqual([session]);
    expect(dependencies.rewardUser).toHaveBeenCalledTimes(1);
    expect(dependencies.updateChallengeProgress).toHaveBeenCalledTimes(1);
    expect(dependencies.checkForFeatureUnlocks).toHaveBeenCalledTimes(1);
    expect(mocks.focusSessionCompleted).toHaveBeenCalledTimes(1);
    expect(mocks.wakeFromDurableStorage).toHaveBeenCalledTimes(2);
  });

  it("publishes a newer same-id reflection without repeating completion side effects", async () => {
    const first: FocusSession = {
      id: "focus-source-reflection-retry",
      duration: 25,
      completedAt: 150,
      date: "2026-08-08",
      status: "completed",
      reflection: 4,
      updatedAt: 150,
    };
    const newer = { ...first, reflection: 5 };
    let sessions: FocusSession[] = [];
    const setFocusSessions = vi.fn(
      (value: FocusSession[] | ((previous: FocusSession[]) => FocusSession[])) => {
        sessions = typeof value === "function" ? value(sessions) : value;
      }
    );
    const persistFocusSession = vi
      .fn()
      .mockResolvedValueOnce({
        accountBoundaryGeneration: "boundary-a",
        intentId: null,
        primaryInserted: true,
        syncOutboxPersisted: true,
      })
      .mockResolvedValueOnce({
        accountBoundaryGeneration: "boundary-a",
        intentId: null,
        primaryInserted: false,
        syncOutboxPersisted: true,
      });
    const dependencies = {
      setFocusSessions,
      rewardUser: vi.fn(),
      earnTreats: vi.fn(),
      updateChallengeProgress: vi.fn(),
      checkForFeatureUnlocks: vi.fn(),
      persistFocusSession,
      assertAccountBoundaryGeneration: vi.fn(),
    };

    await commitFocusSession(first, dependencies);
    await commitFocusSession(newer, dependencies);

    expect(sessions).toEqual([newer]);
    expect(dependencies.rewardUser).toHaveBeenCalledTimes(1);
    expect(dependencies.updateChallengeProgress).toHaveBeenCalledTimes(1);
    expect(dependencies.checkForFeatureUnlocks).toHaveBeenCalledTimes(1);
    expect(mocks.focusSessionCompleted).toHaveBeenCalledTimes(1);
    expect(mocks.wakeFromDurableStorage).toHaveBeenCalledTimes(2);
  });
});
