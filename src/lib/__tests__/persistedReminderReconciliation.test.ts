import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultReminderSettings } from "@/lib/reminders";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => ({
  reconcileReminderNotifications: vi.fn(),
  readPersistedReminderSnapshot: vi.fn(),
  readVerifiedNotificationRealm: vi.fn(),
  assertVerifiedNotificationRealmCurrent: vi.fn(),
}));

vi.mock("@/lib/localNotifications", () => ({
  reconcileReminderNotifications: mocks.reconcileReminderNotifications,
}));

vi.mock("@/storage/reminderPersistence", () => ({
  readPersistedReminderSnapshot: mocks.readPersistedReminderSnapshot,
}));

vi.mock("@/storage/notificationRealm", () => ({
  readVerifiedNotificationRealm: mocks.readVerifiedNotificationRealm,
  assertVerifiedNotificationRealmCurrent: mocks.assertVerifiedNotificationRealmCurrent,
}));

import {
  assertReminderReconcileApplied,
  isReminderReconcileOutcomeError,
  reconcilePersistedMasterReminders,
} from "../persistedReminderReconciliation";

describe("reconcilePersistedMasterReminders", () => {
  const copy = {
    mood: { title: "Mood", body: "Mood body" },
    habit: { title: "Habit", body: "Habit body" },
    focus: { title: "Focus", body: "Focus body" },
    quickMoodBody: "How are you?",
  };
  const durableSnapshot = {
    reminders: { ...defaultReminderSettings, enabled: true },
    habits: [{ id: "durable-habit" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readVerifiedNotificationRealm.mockResolvedValue({
      kind: "account",
      ownerUserId: "account-a",
      generation: 7,
    });
    mocks.readPersistedReminderSnapshot.mockResolvedValue(durableSnapshot);
    mocks.assertVerifiedNotificationRealmCurrent.mockResolvedValue(undefined);
    mocks.reconcileReminderNotifications.mockResolvedValue({
      status: "scheduled",
      scheduledCount: 1,
    });
  });

  it("reconciles only the durable reminder and habit snapshot with an account-bound guard", async () => {
    await expect(
      reconcilePersistedMasterReminders(copy, {
        rollbackChannelId: "zenflow_default_v4",
      }),
    ).resolves.toEqual({ status: "scheduled", scheduledCount: 1 });

    expect(mocks.readPersistedReminderSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.assertVerifiedNotificationRealmCurrent).toHaveBeenCalledTimes(1);
    expect(mocks.reconcileReminderNotifications).toHaveBeenCalledWith(
      durableSnapshot.reminders,
      durableSnapshot.habits,
      copy,
      expect.objectContaining({
        rollbackChannelId: "zenflow_default_v4",
        ownerUserId: "account-a",
        moodActionsEnabled: true,
        assertRealmCurrent: expect.any(Function),
      }),
    );

    const passedOptions = mocks.reconcileReminderNotifications.mock.calls[0]?.[3] as {
      assertRealmCurrent: () => Promise<void>;
    };
    await passedOptions.assertRealmCurrent();
    expect(mocks.assertVerifiedNotificationRealmCurrent).toHaveBeenCalledTimes(2);
  });

  it("omits habits when the durable master switch is off", async () => {
    mocks.readPersistedReminderSnapshot.mockResolvedValueOnce({
      ...durableSnapshot,
      reminders: { ...durableSnapshot.reminders, enabled: false },
    });

    await reconcilePersistedMasterReminders(copy);

    expect(mocks.reconcileReminderNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
      [],
      copy,
      expect.objectContaining({ ownerUserId: "account-a" }),
    );
  });

  it("never reconciles an older durable snapshot after a newer persisted request starts", async () => {
    const staleSnapshotRead = createDeferred<typeof durableSnapshot>();
    const latestSnapshot = {
      reminders: {
        ...durableSnapshot.reminders,
        moodTimeMorning: "11:45",
      },
      habits: [{ id: "latest-habit" }],
    };
    mocks.readPersistedReminderSnapshot
      .mockReturnValueOnce(staleSnapshotRead.promise)
      .mockResolvedValueOnce(latestSnapshot);

    const staleRequest = reconcilePersistedMasterReminders(copy);
    await vi.waitFor(() => expect(mocks.readPersistedReminderSnapshot).toHaveBeenCalledTimes(1));

    const latestRequest = reconcilePersistedMasterReminders(copy);
    await expect(latestRequest).resolves.toEqual({ status: "scheduled", scheduledCount: 1 });

    staleSnapshotRead.resolve(durableSnapshot);
    await expect(staleRequest).resolves.toEqual({ status: "scheduled", scheduledCount: 1 });

    expect(mocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.reconcileReminderNotifications).toHaveBeenCalledWith(
      latestSnapshot.reminders,
      latestSnapshot.habits,
      copy,
      expect.objectContaining({ ownerUserId: "account-a" }),
    );
  });

  it("returns the latest convergence result when an older native outcome completes late", async () => {
    const staleNativeResult = createDeferred<{
      status: "native-uncertain";
      scheduledCount: 0;
      error: Error;
    }>();
    mocks.reconcileReminderNotifications
      .mockReturnValueOnce(staleNativeResult.promise)
      .mockResolvedValueOnce({ status: "scheduled", scheduledCount: 1 });

    const settingsRequest = reconcilePersistedMasterReminders(copy, {
      rollbackChannelId: "zenflow_default_v4",
    });
    await vi.waitFor(() => expect(mocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1));

    const rootRequest = reconcilePersistedMasterReminders(copy);
    await expect(rootRequest).resolves.toEqual({ status: "scheduled", scheduledCount: 1 });

    staleNativeResult.resolve({
      status: "native-uncertain",
      scheduledCount: 0,
      error: new Error("obsolete native outcome"),
    });
    const convergedResult = await settingsRequest;

    expect(convergedResult).toEqual({ status: "scheduled", scheduledCount: 1 });
    expect(() => assertReminderReconcileApplied(convergedResult)).not.toThrow();
  });

  it("does not surface an obsolete native rejection after a newer request succeeds", async () => {
    const staleNativeResult = createDeferred<{ status: "scheduled"; scheduledCount: number }>();
    mocks.reconcileReminderNotifications
      .mockReturnValueOnce(staleNativeResult.promise)
      .mockResolvedValueOnce({ status: "scheduled", scheduledCount: 1 });

    const staleRequest = reconcilePersistedMasterReminders(copy);
    await vi.waitFor(() => expect(mocks.reconcileReminderNotifications).toHaveBeenCalledTimes(1));
    const latestRequest = reconcilePersistedMasterReminders(copy);
    await expect(latestRequest).resolves.toEqual({ status: "scheduled", scheduledCount: 1 });

    staleNativeResult.reject(new Error("obsolete native rejection"));
    await expect(staleRequest).resolves.toEqual({ status: "scheduled", scheduledCount: 1 });
  });

  it("keeps the caller's live boundary assertion inside every native realm guard", async () => {
    let boundaryInProgress = false;
    await reconcilePersistedMasterReminders(copy, {
      assertRequestCurrent: () => {
        if (boundaryInProgress) throw new Error("Account cleanup is still in progress");
      },
    });

    const passedOptions = mocks.reconcileReminderNotifications.mock.calls[0]?.[3] as {
      assertRealmCurrent: () => Promise<void>;
    };
    boundaryInProgress = true;

    await expect(passedOptions.assertRealmCurrent()).rejects.toThrow(
      "Account cleanup is still in progress",
    );
  });

  it("fails closed before native reconciliation when the verified realm changes", async () => {
    mocks.assertVerifiedNotificationRealmCurrent.mockRejectedValueOnce(
      new Error("notification realm changed"),
    );

    await expect(reconcilePersistedMasterReminders(copy)).rejects.toThrow(
      "notification realm changed",
    );
    expect(mocks.reconcileReminderNotifications).not.toHaveBeenCalled();
  });

  it("fails closed when the durable snapshot cannot be read", async () => {
    mocks.readPersistedReminderSnapshot.mockRejectedValueOnce(new Error("IndexedDB read failed"));

    await expect(reconcilePersistedMasterReminders(copy)).rejects.toThrow(
      "IndexedDB read failed",
    );
    expect(mocks.reconcileReminderNotifications).not.toHaveBeenCalled();
  });

  it("preserves the reconciler's restored-versus-uncertain native outcome", () => {
    for (const [status, nativeState] of [
      ["native-restored", "restored"],
      ["native-uncertain", "uncertain"],
      ["permission-required", "uncertain"],
    ] as const) {
      try {
        assertReminderReconcileApplied({
          status,
          scheduledCount: 0,
          ...(status.startsWith("native-") ? { error: new Error("native failed") } : {}),
        } as never);
        throw new Error(`Expected ${status} to be rejected`);
      } catch (error) {
        expect(isReminderReconcileOutcomeError(error)).toBe(true);
        if (isReminderReconcileOutcomeError(error)) {
          expect(error.nativeState).toBe(nativeState);
        }
      }
    }
  });
});
