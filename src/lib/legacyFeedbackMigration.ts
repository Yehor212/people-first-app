import {
  storageGetRaw,
  storageReadRaw,
  storageRemove,
  storageSetRaw,
} from "@/lib/safeJson";
import { getHapticsPreference, trySetHapticsEnabled } from "@/lib/hapticsPreference";
import { getMotionPreference, trySetReduceMotion } from "@/lib/motionPreference";
import { SK } from "@/lib/storageKeys";

export const LEGACY_FEEDBACK_MIGRATION_COMPLETE = "complete";

type LegacyFeedbackRecord = Record<string, unknown>;

export type LegacyFeedbackMigrationResult =
  | { ok: true; migrated: boolean; cleanupPending?: false }
  | { ok: false; migrated: boolean; cleanupPending?: boolean; reason: string };

function parseObject(raw: string): LegacyFeedbackRecord | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as LegacyFeedbackRecord;
  } catch {
    return null;
  }
}

function ownBoolean(record: LegacyFeedbackRecord | null, key: string): boolean | null {
  if (!record || !Object.prototype.hasOwnProperty.call(record, key)) return null;
  return typeof record[key] === "boolean" ? record[key] : null;
}

function readValidTarget(
  key: string,
  property: "reduceMotion" | "enabled",
): { kind: "absent" } | { kind: "valid"; value: boolean } | { kind: "invalid" } {
  const raw = storageReadRaw(key);
  if (!raw.ok) return { kind: "invalid" };
  if (raw.value === null) return { kind: "absent" };
  const parsed = parseObject(raw.value);
  if (!parsed || typeof parsed[property] !== "boolean") return { kind: "invalid" };
  return { kind: "valid", value: parsed[property] };
}

function readLegacyAudioHapticsTrue(): boolean {
  const raw = storageReadRaw(SK.AUDIO_COMFORT);
  if (!raw.ok || raw.value === null) return false;
  const parsed = parseObject(raw.value);
  return parsed?.hapticsEnabled === true;
}

function cleanupLegacySource(): boolean {
  if (!storageRemove(SK.LEGACY_FEEDBACK_SETTINGS)) return false;
  return storageReadRaw(SK.LEGACY_FEEDBACK_SETTINGS).value === null;
}

/**
 * Bounded pre-render compatibility migration for the retired compound
 * feedback preset. Only explicit motion and haptic booleans are retained.
 * Existing purpose-named targets always win, making retries idempotent.
 */
export function migrateLegacyFeedbackSettings(): LegacyFeedbackMigrationResult {
  if (
    storageGetRaw(SK.LEGACY_FEEDBACK_MIGRATION) ===
    LEGACY_FEEDBACK_MIGRATION_COMPLETE
  ) {
    const legacy = storageReadRaw(SK.LEGACY_FEEDBACK_SETTINGS);
    if (!legacy.ok) {
      return { ok: false, migrated: false, reason: "legacy-source-unavailable" };
    }
    if (legacy.value === null || cleanupLegacySource()) {
      return { ok: true, migrated: false };
    }
    return {
      ok: false,
      migrated: false,
      cleanupPending: true,
      reason: "legacy-cleanup-failed",
    };
  }

  const legacyRead = storageReadRaw(SK.LEGACY_FEEDBACK_SETTINGS);
  if (!legacyRead.ok) {
    return { ok: false, migrated: false, reason: "legacy-source-unavailable" };
  }

  const legacyRecord = legacyRead.value === null ? null : parseObject(legacyRead.value);
  const reduceMotion = (() => {
    const animations = ownBoolean(legacyRecord, "animations");
    return animations === null ? null : !animations;
  })();
  const legacyHaptics = ownBoolean(legacyRecord, "haptics");
  const hapticsEnabled = legacyHaptics ?? (readLegacyAudioHapticsTrue() ? true : null);
  const hasMigrationSource = legacyRead.value !== null || hapticsEnabled === true;

  if (!hasMigrationSource) {
    return { ok: true, migrated: false };
  }

  const motionTarget = readValidTarget(SK.REDUCE_MOTION, "reduceMotion");
  const hapticsTarget = readValidTarget(SK.HAPTICS_ENABLED, "enabled");
  if (motionTarget.kind === "invalid") {
    return { ok: false, migrated: false, reason: "invalid-motion-target" };
  }
  if (hapticsTarget.kind === "invalid") {
    return { ok: false, migrated: false, reason: "invalid-haptics-target" };
  }

  let migrated = false;
  if (reduceMotion !== null && motionTarget.kind === "absent") {
    const result = trySetReduceMotion(reduceMotion);
    if (!result.ok || getMotionPreference().reduceMotion !== reduceMotion) {
      return { ok: false, migrated, reason: "motion-write-failed" };
    }
    migrated = true;
  }

  if (hapticsEnabled !== null && hapticsTarget.kind === "absent") {
    const result = trySetHapticsEnabled(hapticsEnabled);
    if (!result.ok || getHapticsPreference().enabled !== hapticsEnabled) {
      return { ok: false, migrated, reason: "haptics-write-failed" };
    }
    migrated = true;
  }

  if (
    !storageSetRaw(
      SK.LEGACY_FEEDBACK_MIGRATION,
      LEGACY_FEEDBACK_MIGRATION_COMPLETE,
    )
  ) {
    return { ok: false, migrated, reason: "migration-marker-write-failed" };
  }

  if (legacyRead.value !== null && !cleanupLegacySource()) {
    return {
      ok: false,
      migrated,
      cleanupPending: true,
      reason: "legacy-cleanup-failed",
    };
  }

  return { ok: true, migrated };
}
