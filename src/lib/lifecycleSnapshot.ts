import { safeLocalStorageSet, storageReadRaw, storageRemove } from "./safeJson";
import { SK } from "./storageKeys";

export const LIFECYCLE_SNAPSHOT_VERSION = 1 as const;

export type LifecycleSnapshotPhase = "before-unload" | "hidden";

export interface LifecycleSnapshotMarker {
  version: typeof LIFECYCLE_SNAPSHOT_VERSION;
  code: "ZF_LIFECYCLE_PENDING";
  phase: LifecycleSnapshotPhase;
  pendingActionCount: number;
}

export type LifecycleSnapshotReadResult =
  | { status: "absent" }
  | { status: "unavailable" }
  | { status: "invalid-removed" }
  | { status: "invalid-retained" }
  | { status: "valid"; marker: LifecycleSnapshotMarker };

function isLifecycleSnapshotMarker(value: unknown): value is LifecycleSnapshotMarker {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const marker = value as Record<string, unknown>;
  return (
    marker.version === LIFECYCLE_SNAPSHOT_VERSION &&
    marker.code === "ZF_LIFECYCLE_PENDING" &&
    (marker.phase === "before-unload" || marker.phase === "hidden") &&
    Number.isSafeInteger(marker.pendingActionCount) &&
    (marker.pendingActionCount as number) >= 0
  );
}

/**
 * Writes only a count and fixed lifecycle codes. Queue payloads, record IDs,
 * account IDs, prose, tokens, and error text remain in their authoritative stores.
 */
export function writeLifecycleSnapshot(input: {
  phase: LifecycleSnapshotPhase;
  pendingActionCount: number;
}): boolean {
  if (!Number.isSafeInteger(input.pendingActionCount) || input.pendingActionCount < 0) {
    return false;
  }

  const marker: LifecycleSnapshotMarker = {
    version: LIFECYCLE_SNAPSHOT_VERSION,
    code: "ZF_LIFECYCLE_PENDING",
    phase: input.phase,
    pendingActionCount: input.pendingActionCount,
  };
  return safeLocalStorageSet(SK.LAST_STATE, marker);
}

/**
 * A retained marker is advisory only. Invalid bytes are removed instead of
 * being interpreted as recovery success or used to reconstruct durable data.
 */
export function readLifecycleSnapshot(): LifecycleSnapshotReadResult {
  const stored = storageReadRaw(SK.LAST_STATE);
  if (!stored.ok) return { status: "unavailable" };
  if (stored.value === null) return { status: "absent" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored.value);
  } catch {
    return storageRemove(SK.LAST_STATE)
      ? { status: "invalid-removed" }
      : { status: "invalid-retained" };
  }

  if (!isLifecycleSnapshotMarker(parsed)) {
    return storageRemove(SK.LAST_STATE)
      ? { status: "invalid-removed" }
      : { status: "invalid-retained" };
  }
  return { status: "valid", marker: parsed };
}
