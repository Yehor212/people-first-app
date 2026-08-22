import { logger } from "@/lib/logger";
import {
  offlineQueue,
  persistCriticalOfflineActionInCurrentTransaction,
} from "@/lib/offlineQueue";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { scheduleEventSchema } from "@/lib/schemas";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  assertAccountSessionTransitionGeneration,
  assertOriginAccountBoundaryGeneration,
  captureAccountSessionTransitionGeneration,
  captureOriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";
import { settingSyncRevisionKey } from "@/storage/sync/settingSyncPolicy";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import type { ScheduleEvent } from "@/types";
import { z } from "zod";

import { detachAutomationRecordRevisionInCurrentTransaction } from "./automationRepository";

export const SCHEDULE_EVENTS_SETTING_KEY = "zenflow-schedule-events";

const scheduleEventsSchema = z.array(scheduleEventSchema).max(4096);

export interface PersistedManualScheduleEvents {
  readonly events: ScheduleEvent[];
  readonly updatedAt: number;
  readonly accountBoundaryGeneration: string;
  readonly syncOutboxPersisted: boolean;
}

function readSettingRevision(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

/**
 * Commits one manual schedule mutation, its local LWW fence, automation-owner
 * detachment and the durable remote outbox in the same owner-scoped Dexie turn.
 */
export async function persistManualScheduleEvents(
  update: (current: ScheduleEvent[]) => ScheduleEvent[],
  fallbackCurrent: readonly ScheduleEvent[]
): Promise<PersistedManualScheduleEvents> {
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const accountSessionGeneration = captureAccountSessionTransitionGeneration();
  const assertBoundary = () => {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    assertAccountSessionTransitionGeneration(accountSessionGeneration);
  };
  assertBoundary();
  const ownerUserId = await validateSyncOwner(undefined, "Manual schedule persistence");
  assertBoundary();

  const result = await runWithOriginExclusiveLock(
    ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
    async () => {
      assertBoundary();
      if (ownerUserId) {
        const currentOwner = await validateSyncOwner(ownerUserId, "Manual schedule persistence");
        if (currentOwner !== ownerUserId) throw new Error("Manual schedule owner changed");
      }
      assertBoundary();
      return db.transaction(
        "rw",
        [db.settings, db.automationTransactions, db.offlineQueue],
        async () => {
          assertBoundary();
          const stored = await db.settings.get(SCHEDULE_EVENTS_SETTING_KEY);
          const parsedStored = scheduleEventsSchema.safeParse(stored?.value);
          const current = parsedStored.success
            ? (parsedStored.data as ScheduleEvent[])
            : (scheduleEventsSchema.parse(fallbackCurrent) as ScheduleEvent[]);
          const events = scheduleEventsSchema.parse(update([...current])) as ScheduleEvent[];
          const revisionKey = settingSyncRevisionKey(SCHEDULE_EVENTS_SETTING_KEY);
          const currentRevision = readSettingRevision((await db.settings.get(revisionKey))?.value);
          if (currentRevision >= Number.MAX_SAFE_INTEGER) {
            throw new Error("Manual schedule revision cannot advance safely");
          }
          const updatedAt = Math.max(Date.now(), currentRevision + 1);
          await db.settings.bulkPut([
            { key: SCHEDULE_EVENTS_SETTING_KEY, value: events },
            { key: revisionKey, value: updatedAt },
          ]);
          await detachAutomationRecordRevisionInCurrentTransaction(
            "setting",
            SCHEDULE_EVENTS_SETTING_KEY
          );
          if (ownerUserId) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "UPDATE_SETTINGS",
              SCHEDULE_EVENTS_SETTING_KEY,
              {
                key: SCHEDULE_EVENTS_SETTING_KEY,
                value: events,
                updatedAt: new Date(updatedAt).toISOString(),
              },
              ownerUserId
            );
          }
          assertBoundary();
          return {
            events,
            updatedAt,
            accountBoundaryGeneration,
            syncOutboxPersisted: ownerUserId !== null,
          };
        }
      );
    }
  );

  assertBoundary();
  if (ownerUserId) {
    const currentOwner = await validateSyncOwner(ownerUserId, "Manual schedule persistence");
    if (currentOwner !== ownerUserId) throw new Error("Manual schedule owner changed");
  }
  if (result.syncOutboxPersisted) {
    try {
      await offlineQueue.wakeFromDurableStorage();
    } catch {
      logger.warn("[Automation] Durable schedule queue wake deferred");
    }
  }
  return result;
}
