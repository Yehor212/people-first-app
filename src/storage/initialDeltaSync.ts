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

/**
 * First enablement mirrors Telegram's snapshot + difference model:
 * take a durable snapshot baseline first, then apply events that arrived after
 * the baseline. Advancing an empty cursor without a snapshot can skip history.
 */
export async function bootstrapSnapshotThenDelta(
  signal?: AbortSignal
): Promise<PullAndApplyDeltaResult> {
  const localSeq = await getLastSeq();
  if (localSeq > 0) {
    const events = await fetchAllDeltas(localSeq, signal);
    if (events.length === 0) {
      return { fetched: 0, applied: 0, lastSeq: localSeq };
    }

    const deviceId = await getPersistentDeviceId();
    const applied = await applyDelta(events, deviceId);
    return { fetched: events.length, applied, lastSeq: events[events.length - 1].seq };
  }

  const baselineSeq = await getServerMaxSeq();
  const snapshotApplied = await pullFromCloud();
  if (!snapshotApplied) {
    throw new Error("[InitialDeltaSync] Snapshot bootstrap failed");
  }

  const tailEvents = await fetchAllDeltas(baselineSeq, signal);
  if (tailEvents.length === 0) {
    await saveLastSeq(baselineSeq);
    return { fetched: 0, applied: 0, lastSeq: baselineSeq };
  }

  const deviceId = await getPersistentDeviceId();
  const applied = await applyDelta(tailEvents, deviceId);
  return { fetched: tailEvents.length, applied, lastSeq: tailEvents[tailEvents.length - 1].seq };
}
