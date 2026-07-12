import {
  applyDelta,
  fetchAllDeltas,
  getLastSeq,
  getPersistentDeviceId,
  getServerMaxSeq,
  saveLastSeq,
  type PullAndApplyDeltaResult,
} from "@/storage/eventSync";
import { pullFromCloud } from "@/storage/realtimeSync";
import { validateSyncOwner } from "@/storage/sync/syncOwner";

/**
 * First enablement mirrors Telegram's snapshot + difference model:
 * take a durable snapshot baseline first, then apply events that arrived after
 * the baseline. Advancing an empty cursor without a snapshot can skip history.
 */
export async function bootstrapSnapshotThenDelta(
  signal?: AbortSignal,
  expectedOwnerUserId?: string
): Promise<PullAndApplyDeltaResult> {
  const ownerUserId = await validateSyncOwner(
    expectedOwnerUserId,
    "Initial delta bootstrap"
  );
  if (!ownerUserId) {
    throw new Error("[InitialDeltaSync] User not authenticated");
  }
  const assertOwnerCurrent = async () => {
    await validateSyncOwner(ownerUserId, "Initial delta bootstrap");
  };

  const localSeq = await getLastSeq();
  await assertOwnerCurrent();
  if (localSeq > 0) {
    const events = await fetchAllDeltas(localSeq, signal);
    await assertOwnerCurrent();
    if (events.length === 0) {
      return { fetched: 0, applied: 0, lastSeq: localSeq };
    }

    const deviceId = await getPersistentDeviceId();
    await assertOwnerCurrent();
    const applied = await applyDelta(events, deviceId, {
      expectedOwnerUserId: ownerUserId,
      assertOwnerCurrent,
    });
    await assertOwnerCurrent();
    return { fetched: events.length, applied, lastSeq: events[events.length - 1].seq };
  }

  const baselineSeq = await getServerMaxSeq(ownerUserId);
  await assertOwnerCurrent();
  const snapshotApplied = await pullFromCloud(ownerUserId);
  await assertOwnerCurrent();
  if (!snapshotApplied) {
    throw new Error("[InitialDeltaSync] Snapshot bootstrap failed");
  }

  const tailEvents = await fetchAllDeltas(baselineSeq, signal);
  await assertOwnerCurrent();
  if (tailEvents.length === 0) {
    await assertOwnerCurrent();
    await saveLastSeq(baselineSeq, {
      expectedOwnerUserId: ownerUserId,
      assertOwnerCurrent,
    });
    return { fetched: 0, applied: 0, lastSeq: baselineSeq };
  }

  const deviceId = await getPersistentDeviceId();
  await assertOwnerCurrent();
  const applied = await applyDelta(tailEvents, deviceId, {
    expectedOwnerUserId: ownerUserId,
    assertOwnerCurrent,
  });
  await assertOwnerCurrent();
  return { fetched: tailEvents.length, applied, lastSeq: tailEvents[tailEvents.length - 1].seq };
}
