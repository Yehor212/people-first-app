import {
  reconcileReminderNotifications,
  type ReminderReconcileCopy,
  type ReminderReconcileOptions,
  type ReminderReconcileResult,
} from "@/lib/localNotifications";
import { readPersistedReminderSnapshot } from "@/storage/reminderPersistence";
import {
  assertVerifiedNotificationRealmCurrent,
  readVerifiedNotificationRealm,
} from "@/storage/notificationRealm";

type PersistedReminderReconcileOptions = Pick<ReminderReconcileOptions, "rollbackChannelId"> & {
  assertRequestCurrent?: () => void | Promise<void>;
};

let latestPersistedReminderReconcileRevision = 0;
let latestPersistedReminderReconcilePromise: Promise<ReminderReconcileResult> | null = null;

function supersededPersistedReminderResult(): ReminderReconcileResult {
  return { status: "superseded", scheduledCount: 0 };
}

export class ReminderReconcileOutcomeError extends Error {
  constructor(
    readonly nativeState: "restored" | "uncertain",
    readonly result: ReminderReconcileResult
  ) {
    super(
      nativeState === "restored"
        ? "The previous native reminder schedule was restored"
        : "The native reminder schedule could not be confirmed"
    );
    (this as Error & { cause?: unknown }).cause = "error" in result ? result.error : undefined;
    this.name = "ReminderReconcileOutcomeError";
  }
}

export function assertReminderReconcileApplied(result: ReminderReconcileResult): void {
  if (result.status === "scheduled" || result.status === "disabled") return;
  throw new ReminderReconcileOutcomeError(
    result.status === "native-restored" ? "restored" : "uncertain",
    result
  );
}

export function isReminderReconcileOutcomeError(
  error: unknown
): error is ReminderReconcileOutcomeError {
  return error instanceof ReminderReconcileOutcomeError;
}

/**
 * Rebuilds the native master schedule from IndexedDB, never from an optimistic
 * React/Zustand snapshot. The verified account realm is rechecked before the
 * native reconciler starts and again before every native read or mutation.
 */
async function runPersistedMasterReminderReconciliation(
  reconcileRevision: number,
  copy: ReminderReconcileCopy,
  options: PersistedReminderReconcileOptions,
): Promise<ReminderReconcileResult> {
  const isRequestCurrent = () =>
    reconcileRevision === latestPersistedReminderReconcileRevision;
  const assertRequestCurrent = async (): Promise<void> => {
    if (!isRequestCurrent()) {
      throw new Error("Persisted reminder reconciliation was superseded");
    }
    await options.assertRequestCurrent?.();
    if (!isRequestCurrent()) {
      throw new Error("Persisted reminder reconciliation was superseded");
    }
  };

  await assertRequestCurrent();
  const realm = await readVerifiedNotificationRealm();
  await assertRequestCurrent();

  const snapshot = await readPersistedReminderSnapshot();
  await assertRequestCurrent();

  const assertRealmCurrent = async (): Promise<void> => {
    await assertRequestCurrent();
    await assertVerifiedNotificationRealmCurrent(realm);
    await assertRequestCurrent();
  };

  await assertRealmCurrent();

  return reconcileReminderNotifications(
    snapshot.reminders,
    snapshot.reminders.enabled ? snapshot.habits : [],
    copy,
    {
      ...(options.rollbackChannelId ? { rollbackChannelId: options.rollbackChannelId } : {}),
      ownerUserId: realm.ownerUserId,
      moodActionsEnabled: realm.kind === "account",
      assertRealmCurrent,
    }
  );
}

/**
 * Rebuilds the native schedule from durable state and gives every overlapping
 * caller the result of the latest convergence attempt. This prevents a stale
 * Settings request from reporting failure after a newer lifecycle pass has
 * already become the owner of the same native schedule.
 */
export function reconcilePersistedMasterReminders(
  copy: ReminderReconcileCopy,
  options: PersistedReminderReconcileOptions = {},
): Promise<ReminderReconcileResult> {
  const reconcileRevision = ++latestPersistedReminderReconcileRevision;
  const operation = runPersistedMasterReminderReconciliation(
    reconcileRevision,
    copy,
    options,
  );
  const resultPromise: Promise<ReminderReconcileResult> = (async () => {
    try {
      const result = await operation;
      if (reconcileRevision === latestPersistedReminderReconcileRevision) {
        return result;
      }
    } catch (error) {
      if (reconcileRevision === latestPersistedReminderReconcileRevision) {
        throw error;
      }
    }

    const latestResult = latestPersistedReminderReconcilePromise;
    if (latestResult) {
      return latestResult;
    }
    return supersededPersistedReminderResult();
  })();
  latestPersistedReminderReconcilePromise = resultPromise;
  return resultPromise;
}
