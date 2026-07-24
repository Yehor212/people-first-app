import {
  isDataWriteBarrierPostCommitError,
  runWithDataWriteBarrier,
  runWithSettledDataRead,
  triggerDataRefresh,
  type DataWriteBarrierPostCommitIssueKind,
} from "@/hooks/useIndexedDB";
import { logger } from "@/lib/logger";
import {
  safeLocalStorageSet,
  storageReadRaw,
} from "@/lib/safeJson";
import { privacySettingsSchema } from "@/lib/schemas";
import { SK } from "@/lib/storageKeys";
import { userNameSchema } from "@/lib/validation";
import {
  assertOriginAccountBoundaryGeneration,
  isOriginAccountBoundaryGenerationCurrent,
  type OriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";
import { defaultPrivacySettings } from "@/stores/userDataStore";
import type { PrivacySettings } from "@/types";
import { z } from "zod";

const USER_NAME_KEY = "zenflow-username";
const USER_NAME_CUSTOM_KEY = "zenflow-username-custom";
const DEFAULT_PROFILE_PREFERENCE = { name: "Friend", userChosen: false } as const;

export interface ProfilePreference {
  name: string;
  userChosen: boolean;
}

export type AuthoritativeProfilePreference =
  | { kind: "complete"; profile: ProfilePreference }
  | { kind: "absent" }
  | { kind: "invalid" };

function parseAuthoritativeProfileRecords(
  nameRecord: { value?: unknown } | undefined,
  customRecord: { value?: unknown } | undefined,
): AuthoritativeProfilePreference {
  const hasName = nameRecord?.value !== undefined;
  const hasCustom = customRecord?.value !== undefined;
  if (!hasName && !hasCustom) return { kind: "absent" };
  if (!hasName || !hasCustom) return { kind: "invalid" };

  const name = userNameSchema.safeParse(nameRecord.value);
  if (!name.success || typeof customRecord.value !== "boolean") {
    return { kind: "invalid" };
  }
  return {
    kind: "complete",
    profile: { name: name.data, userChosen: customRecord.value },
  };
}

const profileRecoveryEnvelopeSchema = z
  .object({
    version: z.literal(1),
    name: userNameSchema,
    userChosen: z.boolean(),
  })
  .strict();

function parseRawJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function parseLegacyProfilePair(): ProfilePreference | null {
  const nameRead = storageReadRaw(USER_NAME_KEY);
  const customRead = storageReadRaw(USER_NAME_CUSTOM_KEY);
  if (!nameRead.ok || !customRead.ok || nameRead.value === null || customRead.value === null) {
    return null;
  }

  const name = userNameSchema.safeParse(parseRawJson(nameRead.value));
  const userChosen = parseRawJson(customRead.value);
  if (!name.success || typeof userChosen !== "boolean") return null;
  return { name: name.data, userChosen };
}

export function persistProfileRecoveryPreference(profile: ProfilePreference): boolean {
  const envelope = profileRecoveryEnvelopeSchema.parse({ version: 1, ...profile });
  const current = storageReadRaw(SK.PROFILE_RECOVERY);
  if (!current.ok) return false;
  if (current.value !== null) {
    const parsedCurrent = parseRawJson(current.value);
    if (
      parsedCurrent !== null &&
      typeof parsedCurrent === "object" &&
      !Array.isArray(parsedCurrent) &&
      typeof (parsedCurrent as { version?: unknown }).version === "number" &&
      (parsedCurrent as { version: number }).version !== 1
    ) {
      return false;
    }
    if (current.value === JSON.stringify(envelope)) return true;
  }
  return safeLocalStorageSet(SK.PROFILE_RECOVERY, envelope);
}

/**
 * Reads one coherent recovery pair. A field is never borrowed from a different
 * source. Unknown future envelopes are left byte-for-byte intact.
 */
export function readProfileRecoveryPreference(): ProfilePreference {
  const recoveryRead = storageReadRaw(SK.PROFILE_RECOVERY);
  if (recoveryRead.ok) {
    const envelope = profileRecoveryEnvelopeSchema.safeParse(
      parseRawJson(recoveryRead.value),
    );
    if (envelope.success) {
      return { name: envelope.data.name, userChosen: envelope.data.userChosen };
    }
  }

  const legacy = parseLegacyProfilePair();
  if (!legacy) return { ...DEFAULT_PROFILE_PREFERENCE };

  // Migrate only into an absent slot. Malformed and future envelopes are
  // preserved for a newer runtime or explicit recovery instead of overwritten.
  if (recoveryRead.ok && recoveryRead.value === null) {
    persistProfileRecoveryPreference(legacy);
  }
  return legacy;
}

/** Reads both IndexedDB fields in one settled transaction; partial pairs fail closed. */
export function readAuthoritativeProfilePreference(): Promise<AuthoritativeProfilePreference> {
  return runWithSettledDataRead(() =>
    db.transaction("r", db.settings, async () => {
      const [nameRecord, customRecord] = await db.settings.bulkGet([
        USER_NAME_KEY,
        USER_NAME_CUSTOM_KEY,
      ]);
      const snapshot = parseAuthoritativeProfileRecords(nameRecord, customRecord);
      if (snapshot.kind !== "complete") return snapshot;
      const { profile } = snapshot;
      if (!persistProfileRecoveryPreference(profile)) {
        logger.warn(
          "[settingsPreferencePersistence] Complete profile recovery mirror could not be updated",
        );
      }
      return { kind: "complete" as const, profile };
    }),
  );
}

export interface SettingsPostCommitIncidentEvent {
  issueKinds: readonly DataWriteBarrierPostCommitIssueKind[];
  retry?: () => void;
}

function publishSettingsPostCommitIncident(
  issueKinds: readonly DataWriteBarrierPostCommitIssueKind[],
  capturedOriginGeneration: string,
): void {
  if (typeof window === "undefined") return;

  const detail: SettingsPostCommitIncidentEvent = { issueKinds: [...issueKinds] };
  if (
    issueKinds.length > 0 &&
    issueKinds.every((kind) => kind === "mounted-refresh")
  ) {
    detail.retry = () => {
      if (!isOriginAccountBoundaryGenerationCurrent(capturedOriginGeneration)) {
        logger.warn(
          "[settingsPreferencePersistence] Ignored a stale post-commit refresh after an account change",
        );
        return;
      }
      void triggerDataRefresh().catch((error) => {
        logger.error(
          "[settingsPreferencePersistence] Post-commit mounted refresh retry failed:",
          error,
        );
      });
    };
  }

  window.dispatchEvent(
    new CustomEvent<SettingsPostCommitIncidentEvent>(
      "zenflow:settings-post-commit-incident",
      { detail },
    ),
  );
}

export function recoverCommittedSettingsValue<T>(error: unknown): T {
  if (!isDataWriteBarrierPostCommitError<T>(error)) throw error;
  assertOriginAccountBoundaryGeneration(error.capturedOriginGeneration);
  publishSettingsPostCommitIncident(
    error.issueKinds,
    error.capturedOriginGeneration,
  );
  return error.committedValue;
}

function parsePrivacySettings(value: unknown): PrivacySettings {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...defaultPrivacySettings, ...value }
      : { ...defaultPrivacySettings };
  return privacySettingsSchema.parse(candidate);
}

export async function commitPrivacySettingsUpdate(
  update: PrivacySettings | ((previous: PrivacySettings) => PrivacySettings)
): Promise<PrivacySettings> {
  try {
    return await runWithDataWriteBarrier(
      async () => {
        const next = await db.transaction("rw", db.settings, async () => {
          const record = await db.settings.get(SK.PRIVACY);
          const previous = parsePrivacySettings(record?.value);
          const candidate = typeof update === "function" ? update(previous) : update;
          const parsed = parsePrivacySettings(candidate);
          await db.settings.put({ key: SK.PRIVACY, value: parsed });
          return parsed;
        });
        if (!safeLocalStorageSet(SK.PRIVACY, next)) {
          logger.warn("[settingsPreferencePersistence] Privacy recovery copy could not be updated");
        }
        return next;
      },
    );
  } catch (error) {
    return recoverCommittedSettingsValue<PrivacySettings>(error);
  }
}

export async function commitProfileNameUpdate(
  name: string,
  userChosen: boolean,
  expectedOwnerGeneration?: OriginAccountBoundaryGeneration
): Promise<{ name: string; userChosen: boolean }> {
  return commitProfilePreferencePatch({ name, userChosen }, expectedOwnerGeneration);
}

export async function commitProfilePreferencePatch(
  patch: Partial<ProfilePreference>,
  expectedOwnerGeneration?: OriginAccountBoundaryGeneration,
): Promise<ProfilePreference> {
  const parsedName = patch.name === undefined ? undefined : userNameSchema.parse(patch.name);
  const parsedUserChosen = patch.userChosen === undefined
    ? undefined
    : z.boolean().parse(patch.userChosen);
  if (parsedName === undefined && parsedUserChosen === undefined) {
    throw new Error("Profile preference patch is empty");
  }

  try {
    return await runWithDataWriteBarrier(
      async () => {
        if (expectedOwnerGeneration !== undefined) {
          assertOriginAccountBoundaryGeneration(expectedOwnerGeneration);
        }
        const next = await db.transaction("rw", db.settings, async () => {
          const [nameRecord, customRecord] = await db.settings.bulkGet([
            USER_NAME_KEY,
            USER_NAME_CUSTOM_KEY,
          ]);
          const snapshot = parseAuthoritativeProfileRecords(nameRecord, customRecord);
          const previous = snapshot.kind === "complete"
            ? snapshot.profile
            : snapshot.kind === "absent"
              ? readProfileRecoveryPreference()
              : { ...DEFAULT_PROFILE_PREFERENCE };
          const candidate: ProfilePreference = {
            name: parsedName ?? previous.name,
            userChosen: parsedUserChosen ?? previous.userChosen,
          };
          await db.settings.bulkPut([
            { key: USER_NAME_KEY, value: candidate.name },
            { key: USER_NAME_CUSTOM_KEY, value: candidate.userChosen },
          ]);
          return candidate;
        });
        if (expectedOwnerGeneration !== undefined) {
          assertOriginAccountBoundaryGeneration(expectedOwnerGeneration);
        }
        if (!persistProfileRecoveryPreference(next)) {
          logger.warn(
            "[settingsPreferencePersistence] Profile recovery copy could not be updated",
          );
        }
        return next;
      },
    );
  } catch (error) {
    return recoverCommittedSettingsValue<ProfilePreference>(error);
  }
}
