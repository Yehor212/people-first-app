import Dexie from "dexie";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { offlineQueue } from "@/lib/offlineQueue";
import { logger } from "@/lib/logger";
import { generateSecureRandom } from "@/lib/validation";
import { SK } from "@/lib/storageKeys";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { syncSetting } from "@/storage/sync/syncSettings";
import { syncJournalAudio, syncJournalEntry, syncJournalPhoto } from "@/storage/realtimeSync";
import {
  deleteJournalMediaStoragePath,
  downloadAsBase64,
  readJournalMediaStorageIdentity,
  uploadAudio,
  uploadEncryptedAudio,
  uploadEncryptedPhoto,
  uploadPhoto,
} from "@/storage/journalStorageService";
import {
  beginRemoteJournalPasswordRemoval,
  finalizeRemoteJournalPasswordRemoval,
  patchJournalBackupForPasswordRemoval,
  verifyRemoteJournalIsUnprotected,
  type JournalPasswordRemovalInventory,
} from "@/storage/sync/journalRemovalRemote";
import {
  decryptJournalContentIfNeeded,
  encryptJournalContent,
  isEncryptedJournalContent,
} from "./journalCrypto";
import {
  decryptJournalMediaDataUrlIfNeeded,
  encryptedJournalMediaFromStorageDataUrl,
  encryptedJournalMediaToStorageBlob,
  encryptJournalMediaDataUrl,
  isEncryptedJournalMediaData,
} from "./journalMediaCrypto";
import {
  getJournalContentVaultKey,
  getJournalContentVaultRevision,
  setJournalContentVaultKey,
} from "./journalContentSession";
import type {
  JournalAudio,
  JournalEntry,
  JournalPassword,
  JournalPhoto,
  JournalSpace,
  JournalSpaceCapture,
  JournalVaultKeySetting,
} from "./types";
import { JOURNAL_PASSWORD_KEY, JOURNAL_VAULT_KEY_SETTING_KEY } from "./types";
import { runWithJournalSecurityWriteLock } from "./journalSecurityWriteLock";
import {
  decryptJournalDraftSettingForStorage,
  encryptJournalDraftSettingForStorage,
} from "./journalDraftStorage";
import {
  decryptJournalSpaceCaptureForStorage,
  decryptJournalSpaceForStorage,
  encryptJournalSpaceCaptureForStorage,
  encryptJournalSpaceForStorage,
} from "./journalHubStorage";
import {
  assertDataWriteBoundaryGeneration,
  captureDataWriteBoundaryGeneration,
  runWithDataWriteBarrier,
} from "@/hooks/useIndexedDB";
import {
  JournalPasswordRemovalBlockedError,
  normalizeJournalSecurityDiagnosticCode,
  type JournalPasswordRemovalPreflight,
  type JournalProtectionBlockerCode,
  type JournalSecurityDiagnosticCode,
} from "./journalSecurityErrors";
import type { JournalMediaStorageIdentity } from "@/storage/journalStorageService";

export const JOURNAL_SECURITY_MIGRATION_EVENT = "zenflow:journal-security-migration-updated";

interface JournalSecurityMediaIntent {
  id: string;
  previousStoragePath?: string;
}

export interface JournalSecurityMigrationIntent {
  version: 1;
  revision: string;
  ownerUserId: string;
  createdAt: number;
  status: "pending" | "queued" | "enqueue-failed";
  lastError?: JournalSecurityDiagnosticCode;
  vaultSettingPending: boolean;
  backupPending: boolean;
  entryIds: string[];
  photos: JournalSecurityMediaIntent[];
  audios: JournalSecurityMediaIntent[];
}

interface JournalSecurityRemovalIntentV1 {
  version: 1;
  revision: string;
  ownerUserId: string;
  createdAt: number;
  status: "pending" | "queued" | "enqueue-failed";
  lastError?: unknown;
  photos?: JournalSecurityMediaIntent[];
  audios?: JournalSecurityMediaIntent[];
}

export type NativeCredentialCleanupState =
  | { status: "not-started" }
  | { status: "not-applicable" }
  | { status: "pending"; attemptCount: number }
  | { status: "complete" }
  | { status: "failed" | "owner-changed"; attemptCount: number };

export interface JournalMediaCleanupItem extends JournalSecurityMediaIntent {
  replacementStoragePath?: string;
  replacementUploaded: boolean;
  metadataCommitted: boolean;
  previousBlobDeleted: boolean;
}

export interface JournalCloudCleanupState {
  status: "not-started" | "pending" | "complete" | "blocked";
  stage:
    | "entries"
    | "photos"
    | "audio"
    | "backup"
    | "verify-protected-objects"
    | "delete-vault"
    | "complete";
  entryIds: string[];
  photos: JournalMediaCleanupItem[];
  audios: JournalMediaCleanupItem[];
  backupPending: boolean;
  attemptCount: number;
  blocker?: "offline" | "remote-state-changed" | "remote-protected-data" | "storage-failed";
}

export interface JournalSecurityRemovalIntent {
  version: 2;
  /** Compatibility alias for queue payloads and pre-v2 callers. */
  revision: string;
  operationRevision: string;
  expectedVaultRevision: number;
  ownerUserId: string;
  createdAt: number;
  updatedAt: number;
  phase:
    | "preflight-pending"
    | "remote-fenced"
    | "blocked"
    | "remote-recovery"
    | "local-committed"
    | "cleanup-pending";
  blocker?: JournalProtectionBlockerCode;
  attemptCount: number;
  nativeCleanup: NativeCredentialCleanupState;
  cloudCleanup: JournalCloudCleanupState;
  /** Compatibility status retained while the offline queue reads v1-shaped fields. */
  status: "pending" | "queued" | "enqueue-failed";
  lastError?: JournalSecurityDiagnosticCode;
  /** Compatibility mirrors; v2 authority is cloudCleanup. */
  photos: JournalMediaCleanupItem[];
  audios: JournalMediaCleanupItem[];
}

const LOCAL_INSTALLATION_REMOVAL_OWNER = "installation-local";
const JOURNAL_REMOVAL_PREFLIGHT_BATCH_SIZE = 16;

export class JournalSecurityRemovalIntentParseError extends Error {
  constructor() {
    super("Diary protection removal state is unsupported or malformed");
    this.name = "JournalSecurityRemovalIntentParseError";
  }
}

export interface ActivateJournalPasswordProtectionInput {
  passwordData: JournalPassword;
  vaultSetting: JournalVaultKeySetting;
  vaultKey: string;
}

function storedVaultRevision(value: unknown): number | null {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

function nextVaultRevision(previous: unknown, candidate: number): number {
  const previousRevision = storedVaultRevision(previous) ?? 0;
  const candidateRevision = Number.isFinite(candidate) ? Math.max(0, Math.trunc(candidate)) : 0;
  return Math.max(candidateRevision, previousRevision + 1);
}

export interface JournalSecurityBoundary {
  generation: number;
  sessionOwnerUserId: string | null;
  localOwnerUserId: string | null;
}

export async function captureJournalSecurityBoundary(): Promise<JournalSecurityBoundary> {
  const generation = captureDataWriteBoundaryGeneration();
  const [sessionOwnerUserId, localOwnerUserId] = await Promise.all([
    getCurrentSessionUserId(),
    getLocalDataOwnerId(),
  ]);
  assertDataWriteBoundaryGeneration(generation);
  return { generation, sessionOwnerUserId, localOwnerUserId };
}

export async function assertJournalSecurityBoundary(
  boundary: JournalSecurityBoundary
): Promise<void> {
  assertDataWriteBoundaryGeneration(boundary.generation);
  const [sessionOwnerUserId, localOwnerUserId] = await Promise.all([
    getCurrentSessionUserId(),
    getLocalDataOwnerId(),
  ]);
  assertDataWriteBoundaryGeneration(boundary.generation);
  if (
    sessionOwnerUserId !== boundary.sessionOwnerUserId ||
    localOwnerUserId !== boundary.localOwnerUserId
  ) {
    throw new Error("Account boundary changed during diary protection");
  }
}

export function journalSecurityRemovalIntentMatchesBoundary(
  intent: Pick<JournalSecurityRemovalIntent, "ownerUserId">,
  boundary: JournalSecurityBoundary,
): boolean {
  if (intent.ownerUserId === LOCAL_INSTALLATION_REMOVAL_OWNER) {
    return boundary.sessionOwnerUserId === null && boundary.localOwnerUserId === null;
  }
  return (
    boundary.sessionOwnerUserId === intent.ownerUserId &&
    boundary.localOwnerUserId === intent.ownerUserId
  );
}

export async function runWithJournalSecurityBoundary<T>(
  boundary: JournalSecurityBoundary,
  operation: () => Promise<T>
): Promise<T> {
  return runWithDataWriteBarrier(async () => {
    await assertJournalSecurityBoundary(boundary);
    return runWithJournalSecurityWriteLock(async () => {
      await assertJournalSecurityBoundary(boundary);
      const result = await operation();
      await assertJournalSecurityBoundary(boundary);
      return result;
    });
  });
}

function isMigrationIntent(value: unknown): value is JournalSecurityMigrationIntent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JournalSecurityMigrationIntent>;
  return (
    candidate.version === 1 &&
    typeof candidate.revision === "string" &&
    typeof candidate.ownerUserId === "string" &&
    Array.isArray(candidate.entryIds) &&
    Array.isArray(candidate.photos) &&
    Array.isArray(candidate.audios)
  );
}

function normalizeMigrationIntent(
  intent: JournalSecurityMigrationIntent,
): JournalSecurityMigrationIntent {
  return {
    ...intent,
    lastError: normalizeJournalSecurityDiagnosticCode(intent.lastError),
  };
}

function isRemovalIntentV1(value: unknown): value is JournalSecurityRemovalIntentV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JournalSecurityRemovalIntentV1>;
  return (
    candidate.version === 1 &&
    typeof candidate.revision === "string" &&
    typeof candidate.ownerUserId === "string" &&
    typeof candidate.createdAt === "number" &&
    (candidate.photos === undefined || Array.isArray(candidate.photos)) &&
    (candidate.audios === undefined || Array.isArray(candidate.audios)) &&
    (candidate.status === "pending" ||
      candidate.status === "queued" ||
      candidate.status === "enqueue-failed")
  );
}

function isRemovalIntentV2(value: unknown): value is JournalSecurityRemovalIntent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JournalSecurityRemovalIntent>;
  return (
    candidate.version === 2 &&
    typeof candidate.revision === "string" &&
    candidate.revision.length > 0 &&
    candidate.operationRevision === candidate.revision &&
    typeof candidate.expectedVaultRevision === "number" &&
    Number.isSafeInteger(candidate.expectedVaultRevision) &&
    candidate.expectedVaultRevision >= 0 &&
    typeof candidate.ownerUserId === "string" &&
    candidate.ownerUserId.length > 0 &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number" &&
    typeof candidate.attemptCount === "number" &&
    Boolean(candidate.nativeCleanup) &&
    Boolean(candidate.cloudCleanup) &&
    Array.isArray(candidate.cloudCleanup?.entryIds) &&
    Array.isArray(candidate.cloudCleanup?.photos) &&
    Array.isArray(candidate.cloudCleanup?.audios) &&
    Array.isArray(candidate.photos) &&
    Array.isArray(candidate.audios) &&
    (candidate.phase === "preflight-pending" ||
      candidate.phase === "remote-fenced" ||
      candidate.phase === "blocked" ||
      candidate.phase === "remote-recovery" ||
      candidate.phase === "local-committed" ||
      candidate.phase === "cleanup-pending") &&
    (candidate.status === "pending" ||
      candidate.status === "queued" ||
      candidate.status === "enqueue-failed")
  );
}

function isRemovalIntent(
  value: unknown
): value is JournalSecurityRemovalIntentV1 | JournalSecurityRemovalIntent {
  return isRemovalIntentV1(value) || isRemovalIntentV2(value);
}

function createMediaCleanupItems(
  media: JournalSecurityMediaIntent[] | undefined
): JournalMediaCleanupItem[] {
  return (media ?? []).map((item) => ({
    ...item,
    replacementUploaded: false,
    metadataCommitted: false,
    previousBlobDeleted: false,
  }));
}

function normalizeRemovalIntent(
  intent: JournalSecurityRemovalIntentV1 | JournalSecurityRemovalIntent,
  expectedVaultRevision: number
): JournalSecurityRemovalIntent {
  if (isRemovalIntentV2(intent)) {
    return {
      ...intent,
      lastError: normalizeJournalSecurityDiagnosticCode(intent.lastError),
    };
  }
  const photos = createMediaCleanupItems(intent.photos);
  const audios = createMediaCleanupItems(intent.audios);
  return {
    version: 2,
    revision: intent.revision,
    operationRevision: intent.revision,
    expectedVaultRevision,
    ownerUserId: intent.ownerUserId,
    createdAt: intent.createdAt,
    updatedAt: intent.createdAt,
    phase: "cleanup-pending",
    attemptCount: 0,
    nativeCleanup: { status: "pending", attemptCount: 0 },
    cloudCleanup: {
      status: "pending",
      stage: "entries",
      entryIds: [],
      photos,
      audios,
      backupPending: true,
      attemptCount: 0,
    },
    status: intent.status,
    lastError: normalizeJournalSecurityDiagnosticCode(intent.lastError),
    photos,
    audios,
  };
}

function emitMigrationUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(JOURNAL_SECURITY_MIGRATION_EVENT));
  }
}

export async function getJournalSecurityMigrationIntent(): Promise<JournalSecurityMigrationIntent | null> {
  const record = await db.settings.get(SK.JOURNAL_SECURITY_MIGRATION);
  return isMigrationIntent(record?.value)
    ? normalizeMigrationIntent(record.value)
    : null;
}

export async function getJournalSecurityRemovalIntent(): Promise<JournalSecurityRemovalIntent | null> {
  const [record, revisionRecord] = await Promise.all([
    db.settings.get(SK.JOURNAL_SECURITY_REMOVAL),
    db.settings.get(SK.JOURNAL_VAULT_REVISION),
  ]);
  if (!record) return null;
  if (!isRemovalIntent(record.value)) {
    throw new JournalSecurityRemovalIntentParseError();
  }
  return normalizeRemovalIntent(
    record.value,
    storedVaultRevision(revisionRecord?.value) ?? 0
  );
}

export async function hasPendingJournalSecurityMigrationForOwner(
  ownerUserId: string
): Promise<boolean> {
  return (await getPendingJournalSecurityMigrationRevisionForOwner(ownerUserId)) !== null;
}

/**
 * Stable identity for consent/account-boundary checks. A different revision is
 * a newer migration and must never inherit a prior discard decision.
 */
export async function getPendingJournalSecurityMigrationRevisionForOwner(
  ownerUserId: string,
): Promise<string | null> {
  if (!ownerUserId) return null;
  const intent = await getJournalSecurityMigrationIntent();
  return intent?.ownerUserId === ownerUserId ? intent.revision : null;
}

export async function getPendingJournalSecurityRemovalRevisionForOwner(
  ownerUserId: string
): Promise<string | null> {
  if (!ownerUserId) return null;
  const record = await db.settings.get(SK.JOURNAL_SECURITY_REMOVAL);
  if (!record) return null;
  if (!isRemovalIntent(record.value)) {
    return "unsupported-removal-intent";
  }
  const intent = normalizeRemovalIntent(record.value, 0);
  return intent.ownerUserId === ownerUserId
    ? intent.operationRevision
    : `owner-conflict:${intent.operationRevision}`;
}

export async function hasPendingJournalSecurityRemovalForOwner(
  ownerUserId: string
): Promise<boolean> {
  return (await getPendingJournalSecurityRemovalRevisionForOwner(ownerUserId)) !== null;
}

/**
 * Blocks account adoption while an ownerless installation still has a durable
 * removal operation. Malformed state is treated as pending because binding it
 * to an authenticated account would destroy the only trustworthy boundary.
 */
export async function hasPendingInstallationJournalSecurityRemoval(): Promise<boolean> {
  const record = await db.settings.get(SK.JOURNAL_SECURITY_REMOVAL);
  if (!record) return false;
  if (!isRemovalIntent(record.value)) return true;
  return normalizeRemovalIntent(record.value, 0).ownerUserId ===
    LOCAL_INSTALLATION_REMOVAL_OWNER;
}

export async function recordOrphanedRemoteJournalPasswordRemoval(
  input: {
    operationRevision: string;
    vaultRevision: number;
    remoteStatus: "manual-recovery-required" | "complete";
  },
  boundary: JournalSecurityBoundary,
): Promise<"recorded" | "stale"> {
  const ownerUserId = boundary.sessionOwnerUserId;
  if (
    !/^[0-9]+:[a-z0-9]+$/.test(input.operationRevision) ||
    !Number.isSafeInteger(input.vaultRevision) ||
    input.vaultRevision < 0 ||
    !ownerUserId ||
    boundary.localOwnerUserId !== ownerUserId
  ) {
    throw new Error("Diary removal recovery metadata is invalid or ownerless");
  }

  return runWithJournalSecurityBoundary(boundary, async () => {
    const [current, snapshot] = await Promise.all([
      getJournalSecurityRemovalIntent(),
      readLocalJournalProtectionSnapshot(),
    ]);
    const localVaultRevision = readLocalJournalVaultRevision(snapshot);
    if (
      localVaultRevision !== null &&
      localVaultRevision > input.vaultRevision
    ) {
      return "stale";
    }

    const cloudComplete = input.remoteStatus === "complete";
    const hasLocalProtection = localJournalSnapshotHasProtection(snapshot);
    const recoveryBlocker: JournalProtectionBlockerCode | undefined =
      hasLocalProtection &&
      localVaultRevision !== null &&
      localVaultRevision < input.vaultRevision
        ? "vault-revision-mismatch"
        : hasLocalProtection
          ? "unlock-required"
          : cloudComplete
            ? undefined
            : "removal-pending";

    if (current) {
      if (
        current.operationRevision === input.operationRevision &&
        current.expectedVaultRevision === input.vaultRevision &&
        current.ownerUserId === ownerUserId
      ) {
        const localCleanupStarted =
          current.phase === "local-committed" || current.phase === "cleanup-pending";
        const nextCloudCleanup = localCleanupStarted
          ? cloudComplete
            ? {
                ...current.cloudCleanup,
                status: "complete" as const,
                stage: "complete" as const,
                blocker: undefined,
              }
            : current.cloudCleanup
          : {
              ...emptyRemovalCloudCleanup(),
              status: cloudComplete ? ("complete" as const) : ("blocked" as const),
              stage: cloudComplete
                ? ("complete" as const)
                : ("verify-protected-objects" as const),
              blocker: cloudComplete ? undefined : ("remote-state-changed" as const),
            };
        await persistRemovalIntent(
          {
            ...current,
            updatedAt: Date.now(),
            phase: localCleanupStarted ? current.phase : "remote-recovery",
            blocker: localCleanupStarted ? current.blocker : recoveryBlocker,
            cloudCleanup: nextCloudCleanup,
          },
          current.operationRevision,
        );
        return "recorded";
      }
      if (current.expectedVaultRevision > input.vaultRevision) return "stale";
      throw new Error("A different diary removal operation is already pending");
    }
    const now = Date.now();
    await persistRemovalIntent({
      version: 2,
      revision: input.operationRevision,
      operationRevision: input.operationRevision,
      expectedVaultRevision: input.vaultRevision,
      ownerUserId,
      createdAt: now,
      updatedAt: now,
      phase: "remote-recovery",
      blocker: recoveryBlocker,
      attemptCount: 0,
      nativeCleanup: { status: "not-started" },
      cloudCleanup: {
        ...emptyRemovalCloudCleanup(),
        status: cloudComplete ? "complete" : "blocked",
        stage: cloudComplete ? "complete" : "verify-protected-objects",
        blocker: cloudComplete ? undefined : "remote-state-changed",
      },
      status: "pending",
      photos: [],
      audios: [],
    });
    return "recorded";
  });
}

/**
 * Owner-bound, read-only classification used by orphan-fence recovery. Any
 * ciphertext marker, encrypted blob path, password, or vault record keeps the
 * device in explicit-unlock recovery instead of assuming local conversion.
 */
export async function hasLocalJournalProtectionArtifacts(
  boundary: JournalSecurityBoundary,
): Promise<boolean> {
  return runWithJournalSecurityBoundary(boundary, async () => {
    return localJournalSnapshotHasProtection(
      await readLocalJournalProtectionSnapshot(),
    );
  });
}

interface LocalJournalProtectionSnapshot {
  entries: JournalEntry[];
  photos: JournalPhoto[];
  audios: JournalAudio[];
  settings: JournalSettingRow[];
  spaces: JournalSpaceRow[];
  captures: JournalCaptureRow[];
}

async function readLocalJournalProtectionSnapshot(): Promise<LocalJournalProtectionSnapshot> {
  const [entries, photos, audios, settings, spaces, captures] = await Promise.all([
    db.journalEntries.toArray(),
    db.journalPhotos.toArray(),
    db.journalAudio.toArray(),
    db.settings.toArray(),
    db.journalSpaces.toArray(),
    db.journalSpaceCaptures.toArray(),
  ]);
  return { entries, photos, audios, settings, spaces, captures };
}

function readLocalJournalVaultRevision(
  snapshot: LocalJournalProtectionSnapshot,
): number | null {
  const revisionRecord = snapshot.settings.find(
    (setting) => setting.key === SK.JOURNAL_VAULT_REVISION,
  );
  const vaultRecord = snapshot.settings.find(
    (setting) => setting.key === JOURNAL_VAULT_KEY_SETTING_KEY,
  );
  const persistedRevision = storedVaultRevision(revisionRecord?.value);
  const vaultRevision =
    vaultRecord?.value && typeof vaultRecord.value === "object"
      ? storedVaultRevision(
          (vaultRecord.value as { updatedAt?: unknown }).updatedAt,
        )
      : null;
  if (persistedRevision === null) return vaultRevision;
  if (vaultRevision === null) return persistedRevision;
  return Math.max(persistedRevision, vaultRevision);
}

function localJournalSnapshotHasProtection(
  snapshot: LocalJournalProtectionSnapshot,
): boolean {
  const { entries, photos, audios, settings, spaces, captures } = snapshot;
  const hasProtectionRecord = settings.some(
    (setting) =>
      (setting.key === JOURNAL_PASSWORD_KEY ||
        setting.key === JOURNAL_VAULT_KEY_SETTING_KEY) &&
      setting.value !== null &&
      setting.value !== undefined,
  );
  const hasProtectedDraft = settings.some((setting) => {
    if (!setting.key.startsWith(SK.journalDraft(""))) return false;
    const draft = setting.value as { content?: unknown } | undefined;
    return typeof draft?.content === "string" && isEncryptedJournalContent(draft.content);
  });
  return (
    hasProtectionRecord ||
    hasProtectedDraft ||
    entries.some(
      (entry) =>
        typeof entry.content === "string" && isEncryptedJournalContent(entry.content),
    ) ||
    photos.some(
      (photo) =>
        Boolean(photo.storagePath?.endsWith(".bin")) ||
        Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
        Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail)),
    ) ||
    audios.some(
      (audio) =>
        Boolean(audio.storagePath?.endsWith(".bin")) ||
        Boolean(audio.data && isEncryptedJournalMediaData(audio.data)),
    ) ||
    spaces.some(
      (space) =>
        Boolean(space.name && isEncryptedJournalContent(space.name)) ||
        Boolean(space.description && isEncryptedJournalContent(space.description)),
    ) ||
    captures.some(
      (capture) =>
        isEncryptedJournalContent(capture.spaceName) ||
        isEncryptedJournalContent(capture.title) ||
        capture.fields.some(
          (field) =>
            isEncryptedJournalContent(field.prompt) ||
            isEncryptedJournalContent(field.value),
        ),
    )
  );
}

function localJournalSnapshotIsFullyProtected(
  snapshot: LocalJournalProtectionSnapshot,
): boolean {
  const nonEmptyIsEncrypted = (value: string | undefined): boolean =>
    !value || isEncryptedJournalContent(value);
  return (
    snapshot.entries.every((entry) => nonEmptyIsEncrypted(entry.content)) &&
    snapshot.photos.every(
      (photo) =>
        (!photo.data || isEncryptedJournalMediaData(photo.data)) &&
        (!photo.thumbnail || isEncryptedJournalMediaData(photo.thumbnail)),
    ) &&
    snapshot.audios.every(
      (audio) => !audio.data || isEncryptedJournalMediaData(audio.data),
    ) &&
    snapshot.settings.every((setting) => {
      if (!setting.key.startsWith(SK.journalDraft(""))) return true;
      const draft = setting.value as { content?: unknown } | undefined;
      return (
        typeof draft?.content !== "string" ||
        draft.content.length === 0 ||
        isEncryptedJournalContent(draft.content)
      );
    }) &&
    snapshot.spaces.every(
      (space) =>
        nonEmptyIsEncrypted(space.name) && nonEmptyIsEncrypted(space.description),
    ) &&
    snapshot.captures.every(
      (capture) =>
        nonEmptyIsEncrypted(capture.spaceName) &&
        nonEmptyIsEncrypted(capture.title) &&
        capture.fields.every(
          (field) =>
            nonEmptyIsEncrypted(field.prompt) && nonEmptyIsEncrypted(field.value),
        ),
    )
  );
}

function validJournalVaultSetting(value: unknown): value is JournalVaultKeySetting {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JournalVaultKeySetting>;
  return (
    typeof candidate.wrappedKey === "string" &&
    candidate.wrappedKey.length > 0 &&
    Number.isFinite(candidate.createdAt) &&
    Number.isSafeInteger(candidate.updatedAt) &&
    Number(candidate.updatedAt) >= 0
  );
}

/**
 * Reconstructs the missing cloud-migration intent after a user deliberately
 * adopts an owner-null local realm. The vault is then committed before any
 * ciphertext row or general cloud merge is admitted.
 */
export async function ensureOwnerBoundJournalSecurityMigration(
  ownerUserId: string,
): Promise<JournalSecurityMigrationIntent | null> {
  if (!ownerUserId) throw new Error("Diary protection adoption requires an owner");
  const boundary = await captureJournalSecurityBoundary();
  if (
    boundary.sessionOwnerUserId !== ownerUserId ||
    boundary.localOwnerUserId !== ownerUserId
  ) {
    throw new Error("Diary protection adoption owner boundary is not established");
  }

  let created = false;
  const intent = await runWithJournalSecurityBoundary(boundary, async () =>
    db.transaction(
      "rw",
      [
        db.settings,
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
        db.journalSpaces,
        db.journalSpaceCaptures,
      ],
      async () => {
        const [entries, photos, audios, settings, spaces, captures] = await Promise.all([
          db.journalEntries.toArray(),
          db.journalPhotos.toArray(),
          db.journalAudio.toArray(),
          db.settings.toArray(),
          db.journalSpaces.toArray(),
          db.journalSpaceCaptures.toArray(),
        ]);
        const migrationRecord = settings.find(
          (setting) => setting.key === SK.JOURNAL_SECURITY_MIGRATION,
        );
        if (migrationRecord) {
          if (!isMigrationIntent(migrationRecord.value)) {
            throw new Error("Diary protection migration state is unsupported or malformed");
          }
          const current = normalizeMigrationIntent(migrationRecord.value);
          if (current.ownerUserId !== ownerUserId) {
            throw new Error("Diary protection migration belongs to another account");
          }
          return current;
        }
        if (settings.some((setting) => setting.key === SK.JOURNAL_SECURITY_REMOVAL)) {
          throw new Error("Diary protection removal must settle before account adoption");
        }

        const snapshot = { entries, photos, audios, settings, spaces, captures };
        if (!localJournalSnapshotHasProtection(snapshot)) return null;

        const passwordRecord = settings.find(
          (setting) => setting.key === JOURNAL_PASSWORD_KEY,
        );
        const vaultRecord = settings.find(
          (setting) => setting.key === JOURNAL_VAULT_KEY_SETTING_KEY,
        );
        const revisionRecord = settings.find(
          (setting) => setting.key === SK.JOURNAL_VAULT_REVISION,
        );
        if (
          !passwordRecord?.value ||
          !validJournalVaultSetting(vaultRecord?.value) ||
          storedVaultRevision(revisionRecord?.value) !== vaultRecord.value.updatedAt ||
          !localJournalSnapshotIsFullyProtected(snapshot)
        ) {
          throw new Error("Diary protection local state cannot be adopted safely");
        }

        const now = Date.now();
        const next: JournalSecurityMigrationIntent = {
          version: 1,
          revision: `${vaultRecord.value.updatedAt}:${now}`,
          ownerUserId,
          createdAt: now,
          status: "pending",
          vaultSettingPending: true,
          backupPending: true,
          entryIds: entries
            .filter(
              (entry) =>
                typeof entry.content === "string" &&
                isEncryptedJournalContent(entry.content),
            )
            .map((entry) => entry.id),
          photos: photos
            .filter(
              (photo) =>
                Boolean(photo.storagePath?.endsWith(".bin")) ||
                Boolean(photo.data && isEncryptedJournalMediaData(photo.data)),
            )
            .map((photo) => ({ id: photo.id, previousStoragePath: photo.storagePath })),
          audios: audios
            .filter(
              (audio) =>
                Boolean(audio.storagePath?.endsWith(".bin")) ||
                Boolean(audio.data && isEncryptedJournalMediaData(audio.data)),
            )
            .map((audio) => ({ id: audio.id, previousStoragePath: audio.storagePath })),
        };
        await db.settings.put({ key: SK.JOURNAL_SECURITY_MIGRATION, value: next });
        created = true;
        return next;
      },
    ),
  );
  if (created) emitMigrationUpdate();
  return intent;
}

function isJournalSecurityMigrationComplete(
  intent: JournalSecurityMigrationIntent,
): boolean {
  return (
    !intent.vaultSettingPending &&
    !intent.backupPending &&
    intent.entryIds.length === 0 &&
    intent.photos.length === 0 &&
    intent.audios.length === 0
  );
}

async function pruneDeletedJournalArtifactsInCurrentTransaction(input: {
  entryIds?: string[];
  photoIds?: string[];
  audioIds?: string[];
}): Promise<boolean> {
  const entryIds = new Set(input.entryIds ?? []);
  const photoIds = new Set(input.photoIds ?? []);
  const audioIds = new Set(input.audioIds ?? []);
  const [migrationRecord, removalRecord, revisionRecord] = await Promise.all([
    db.settings.get(SK.JOURNAL_SECURITY_MIGRATION),
    db.settings.get(SK.JOURNAL_SECURITY_REMOVAL),
    db.settings.get(SK.JOURNAL_VAULT_REVISION),
  ]);
  let changed = false;

  if (isMigrationIntent(migrationRecord?.value)) {
    const intent = migrationRecord.value;
    const nextIntent: JournalSecurityMigrationIntent = {
      ...intent,
      entryIds: intent.entryIds.filter((id) => !entryIds.has(id)),
      photos: intent.photos.filter(({ id }) => !photoIds.has(id)),
      audios: intent.audios.filter(({ id }) => !audioIds.has(id)),
    };
    if (isJournalSecurityMigrationComplete(nextIntent)) {
      await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    } else {
      await db.settings.put({ key: SK.JOURNAL_SECURITY_MIGRATION, value: nextIntent });
    }
    changed = true;
  }

  if (isRemovalIntent(removalRecord?.value)) {
    const intent = normalizeRemovalIntent(
      removalRecord.value,
      storedVaultRevision(revisionRecord?.value) ?? 0,
    );
    const photos = intent.cloudCleanup.photos.filter(({ id }) => !photoIds.has(id));
    const audios = intent.cloudCleanup.audios.filter(({ id }) => !audioIds.has(id));
    const nextIntent: JournalSecurityRemovalIntent = {
      ...intent,
      updatedAt: Date.now(),
      cloudCleanup: {
        ...intent.cloudCleanup,
        entryIds: intent.cloudCleanup.entryIds.filter((id) => !entryIds.has(id)),
        photos,
        audios,
      },
      photos,
      audios,
    };
    await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: nextIntent });
    changed = true;
  }

  return changed;
}

export async function removeDeletedJournalArtifactsFromSecurityMigration(input: {
  entryIds?: string[];
  photoIds?: string[];
  audioIds?: string[];
}): Promise<void> {
  const currentTransaction = Dexie.currentTransaction;
  if (
    currentTransaction?.active &&
    currentTransaction.db === db &&
    currentTransaction.storeNames.includes(db.settings.name)
  ) {
    const changed = await pruneDeletedJournalArtifactsInCurrentTransaction(input);
    if (changed) {
      currentTransaction.on("complete", emitMigrationUpdate);
    }
    return;
  }

  let changed = false;
  await db.transaction("rw", db.settings, async () => {
    changed = await pruneDeletedJournalArtifactsInCurrentTransaction(input);
  });
  if (changed) emitMigrationUpdate();
}

async function persistIntent(
  intent: JournalSecurityMigrationIntent | null,
  expectedRevision?: string
): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    if (expectedRevision) {
      const current = await db.settings.get(SK.JOURNAL_SECURITY_MIGRATION);
      if (!isMigrationIntent(current?.value) || current.value.revision !== expectedRevision) {
        throw new Error("Diary protection migration changed before it could be updated");
      }
    }
    if (intent) {
      await db.settings.put({ key: SK.JOURNAL_SECURITY_MIGRATION, value: intent });
    } else {
      await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    }
  });
  emitMigrationUpdate();
}

async function persistRemovalIntent(
  intent: JournalSecurityRemovalIntent | null,
  expectedRevision?: string
): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    if (expectedRevision) {
      const current = await db.settings.get(SK.JOURNAL_SECURITY_REMOVAL);
      if (!isRemovalIntent(current?.value) || current.value.revision !== expectedRevision) {
        throw new Error("Diary protection removal changed before it could be updated");
      }
    }
    if (intent) {
      await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: intent });
    } else {
      await db.settings.delete(SK.JOURNAL_SECURITY_REMOVAL);
    }
  });
  emitMigrationUpdate();
}

async function encryptEntry(
  entry: JournalEntry,
  vaultKey: string,
  updatedAt: number,
  vaultRevision: number,
): Promise<JournalEntry> {
  const isAlreadyEncrypted = isEncryptedJournalContent(entry.content);
  if (isAlreadyEncrypted) {
    await decryptJournalContentIfNeeded(entry.content, vaultKey);
  }
  return {
    ...entry,
    // An authenticated envelope for the empty string distinguishes a valid
    // protected title/media-only entry from plaintext written by a stale
    // client. The server fence can then enforce one representation reliably.
    content: isAlreadyEncrypted
      ? entry.content
      : await encryptJournalContent(entry.content, vaultKey),
    updatedAt: isAlreadyEncrypted ? entry.updatedAt : updatedAt,
    vaultRevision,
  };
}

async function encryptPhoto(
  photo: JournalPhoto,
  vaultKey: string,
  vaultRevision: number,
): Promise<JournalPhoto> {
  for (const value of [photo.data, photo.thumbnail]) {
    if (value && isEncryptedJournalMediaData(value)) {
      await decryptJournalMediaDataUrlIfNeeded(value, vaultKey);
    }
  }
  return {
    ...photo,
    data:
      photo.data && !isEncryptedJournalMediaData(photo.data)
        ? await encryptJournalMediaDataUrl(photo.data, vaultKey)
        : photo.data,
    thumbnail:
      photo.thumbnail && !isEncryptedJournalMediaData(photo.thumbnail)
        ? await encryptJournalMediaDataUrl(photo.thumbnail, vaultKey)
        : photo.thumbnail,
    vaultRevision,
  };
}

async function encryptAudio(
  audio: JournalAudio,
  vaultKey: string,
  vaultRevision: number,
): Promise<JournalAudio> {
  if (audio.data && isEncryptedJournalMediaData(audio.data)) {
    await decryptJournalMediaDataUrlIfNeeded(audio.data, vaultKey);
  }
  return {
    ...audio,
    data:
      audio.data && !isEncryptedJournalMediaData(audio.data)
        ? await encryptJournalMediaDataUrl(audio.data, vaultKey)
        : audio.data,
    vaultRevision,
  };
}

export interface JournalVaultNormalizationResult {
  changedCount: number;
  unboundMediaCount: number;
  cloudMigrationPending: boolean;
}

type PreparedJournalMedia<T> =
  | { source: T; update: T; unbound: false }
  | { source: T; update: null; unbound: true };

async function preparePhotoForActiveVault(
  photo: JournalPhoto,
  vaultKey: string,
  vaultRevision: number,
  boundary: JournalSecurityBoundary,
): Promise<PreparedJournalMedia<JournalPhoto>> {
  let candidate = photo;
  let downloaded = false;
  if (!photo.data && photo.storagePath) {
    if (!boundary.sessionOwnerUserId) {
      return { source: photo, update: null, unbound: true };
    }
    try {
      const data = await downloadAsBase64(
        "journal-photos",
        photo.storagePath,
        boundary.sessionOwnerUserId,
      );
      if (!data) return { source: photo, update: null, unbound: true };
      candidate = {
        ...photo,
        data: encryptedJournalMediaFromStorageDataUrl(data),
      };
      downloaded = true;
      await assertJournalSecurityBoundary(boundary);
    } catch {
      return { source: photo, update: null, unbound: true };
    }
  }

  try {
    return {
      source: photo,
      update: await encryptPhoto(candidate, vaultKey, vaultRevision),
      unbound: false,
    };
  } catch (error) {
    // A remote-only blob that cannot be authenticated stays explicitly
    // unbound. Locally retained ciphertext is stronger evidence of a key/epoch
    // mismatch and aborts the whole normalization before any mutation.
    if (downloaded) return { source: photo, update: null, unbound: true };
    throw error;
  }
}

async function prepareAudioForActiveVault(
  audio: JournalAudio,
  vaultKey: string,
  vaultRevision: number,
  boundary: JournalSecurityBoundary,
): Promise<PreparedJournalMedia<JournalAudio>> {
  let candidate = audio;
  let downloaded = false;
  if (!audio.data && audio.storagePath) {
    if (!boundary.sessionOwnerUserId) {
      return { source: audio, update: null, unbound: true };
    }
    try {
      const data = await downloadAsBase64(
        "journal-audio",
        audio.storagePath,
        boundary.sessionOwnerUserId,
      );
      if (!data) return { source: audio, update: null, unbound: true };
      candidate = {
        ...audio,
        data: encryptedJournalMediaFromStorageDataUrl(data),
      };
      downloaded = true;
      await assertJournalSecurityBoundary(boundary);
    } catch {
      return { source: audio, update: null, unbound: true };
    }
  }

  try {
    return {
      source: audio,
      update: await encryptAudio(candidate, vaultKey, vaultRevision),
      unbound: false,
    };
  } catch (error) {
    if (downloaded) return { source: audio, update: null, unbound: true };
    throw error;
  }
}

function mergeMigrationMedia(
  current: JournalSecurityMediaIntent[],
  additions: JournalSecurityMediaIntent[],
): JournalSecurityMediaIntent[] {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of additions) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }
  return [...merged.values()];
}

/**
 * Validates every locally available protected value with the unlocked key
 * before binding it to an explicit vault epoch. All locally provable changes
 * commit in one owner-bound transaction. Remote-only media that cannot be
 * downloaded or authenticated remains unbound and is retried on a later
 * unlock; it is never stamped from path/metadata alone.
 */
export async function normalizeJournalDataForActiveVault(
  vaultKey: string,
  vaultRevisionInput: number,
  boundary: JournalSecurityBoundary,
): Promise<JournalVaultNormalizationResult> {
  const vaultRevision = storedVaultRevision(vaultRevisionInput);
  if (!vaultKey || vaultRevision === null) {
    throw new Error("Diary vault normalization requires an exact active epoch");
  }

  await assertJournalSecurityBoundary(boundary);
  const [entries, photos, audios, settings, spaces, captures] = await Promise.all([
    db.journalEntries.toArray(),
    db.journalPhotos.toArray(),
    db.journalAudio.toArray(),
    db.settings.toArray(),
    db.journalSpaces.toArray(),
    db.journalSpaceCaptures.toArray(),
  ]);
  const removalRecord = settings.find(
    (setting) => setting.key === SK.JOURNAL_SECURITY_REMOVAL,
  );
  const revisionRecord = settings.find(
    (setting) => setting.key === SK.JOURNAL_VAULT_REVISION,
  );
  const storedRevisionMarker = storedVaultRevision(revisionRecord?.value);
  if (revisionRecord && storedRevisionMarker === null) {
    throw new Error("Diary vault revision marker is malformed");
  }
  if (
    storedRevisionMarker !== null &&
    storedRevisionMarker !== vaultRevision
  ) {
    throw new Error("Diary vault revision marker does not match the active epoch");
  }
  const revisionMarkerNeedsRepair = storedRevisionMarker === null;
  if (removalRecord) {
    if (!isRemovalIntent(removalRecord.value)) {
      throw new JournalSecurityRemovalIntentParseError();
    }
    throw new Error("Diary protection removal is still pending");
  }

  const currentMigrationRecord = settings.find(
    (setting) => setting.key === SK.JOURNAL_SECURITY_MIGRATION,
  );
  const currentMigration = currentMigrationRecord
    ? isMigrationIntent(currentMigrationRecord.value)
      ? normalizeMigrationIntent(currentMigrationRecord.value)
      : null
    : null;
  if (currentMigrationRecord && !currentMigration) {
    throw new Error("Diary protection migration state is unsupported or malformed");
  }
  if (
    currentMigration &&
    (currentMigration.ownerUserId !== boundary.sessionOwnerUserId ||
      !currentMigration.revision.startsWith(`${vaultRevision}:`))
  ) {
    throw new Error("Diary protection migration belongs to another vault epoch");
  }

  const updatedAt = Date.now();
  const [preparedEntries, preparedPhotos, preparedAudios, preparedDrafts, preparedSpaces, preparedCaptures] =
    await Promise.all([
      Promise.all(
        entries.map((entry) => encryptEntry(entry, vaultKey, updatedAt, vaultRevision)),
      ),
      Promise.all(
        photos.map((photo) =>
          preparePhotoForActiveVault(photo, vaultKey, vaultRevision, boundary),
        ),
      ),
      Promise.all(
        audios.map((audio) =>
          prepareAudioForActiveVault(audio, vaultKey, vaultRevision, boundary),
        ),
      ),
      Promise.all(
        settings.map((setting) =>
          encryptJournalDraftSettingForStorage(setting, vaultKey, vaultRevision),
        ),
      ),
      Promise.all(
        spaces.map((space) =>
          encryptJournalSpaceForStorage(space, vaultKey, vaultRevision),
        ),
      ),
      Promise.all(
        captures.map((capture) =>
          encryptJournalSpaceCaptureForStorage(capture, vaultKey, vaultRevision),
        ),
      ),
    ]);
  await assertJournalSecurityBoundary(boundary);

  const entryUpdates = preparedEntries.filter(
    (entry, index) => !structurallyEqual(entry, entries[index]),
  );
  const photoUpdates = preparedPhotos.flatMap((prepared) =>
    prepared.update && !structurallyEqual(prepared.update, prepared.source)
      ? [prepared.update]
      : [],
  );
  const audioUpdates = preparedAudios.flatMap((prepared) =>
    prepared.update && !structurallyEqual(prepared.update, prepared.source)
      ? [prepared.update]
      : [],
  );
  const draftUpdates = preparedDrafts.filter(
    (draft): draft is NonNullable<typeof draft> => {
      if (!draft) return false;
      const source = settings.find((setting) => setting.key === draft.key);
      return !source || !structurallyEqual(source.value, draft.value);
    },
  );
  const spaceUpdates = preparedSpaces.filter(
    (space, index) => !structurallyEqual(space, spaces[index]),
  );
  const captureUpdates = preparedCaptures.filter(
    (capture, index) => !structurallyEqual(capture, captures[index]),
  );
  const unboundMediaCount =
    preparedPhotos.filter((prepared) => prepared.unbound).length +
    preparedAudios.filter((prepared) => prepared.unbound).length;
  const changedCount =
    entryUpdates.length +
    photoUpdates.length +
    audioUpdates.length +
    draftUpdates.length +
    spaceUpdates.length +
    captureUpdates.length;

  let nextMigration = currentMigration;
  if (
    changedCount > 0 &&
    isCloudSyncEnabled() &&
    boundary.sessionOwnerUserId
  ) {
    const entryIds = entryUpdates
      .filter((entry) => Boolean(entry.content && isEncryptedJournalContent(entry.content)))
      .map((entry) => entry.id);
    const migrationPhotos = photoUpdates
      .filter((photo) => Boolean(photo.data && isEncryptedJournalMediaData(photo.data)))
      .map((photo) => ({ id: photo.id, previousStoragePath: photo.storagePath }));
    const migrationAudios = audioUpdates
      .filter((audio) => Boolean(audio.data && isEncryptedJournalMediaData(audio.data)))
      .map((audio) => ({ id: audio.id, previousStoragePath: audio.storagePath }));
    nextMigration = currentMigration
      ? {
          ...currentMigration,
          status: "pending",
          vaultSettingPending: true,
          backupPending: true,
          entryIds: [...new Set([...currentMigration.entryIds, ...entryIds])],
          photos: mergeMigrationMedia(currentMigration.photos, migrationPhotos),
          audios: mergeMigrationMedia(currentMigration.audios, migrationAudios),
        }
      : {
          version: 1,
          revision: `${vaultRevision}:${updatedAt}`,
          ownerUserId: boundary.sessionOwnerUserId,
          createdAt: updatedAt,
          status: "pending",
          vaultSettingPending: true,
          backupPending: true,
          entryIds,
          photos: migrationPhotos,
          audios: migrationAudios,
        };
  }

  if (
    changedCount > 0 ||
    revisionMarkerNeedsRepair ||
    nextMigration !== currentMigration
  ) {
    await runWithJournalSecurityBoundary(boundary, async () => {
      await db.transaction(
        "rw",
        [
          db.settings,
          db.journalEntries,
          db.journalPhotos,
          db.journalAudio,
          db.journalSpaces,
          db.journalSpaceCaptures,
        ],
        async () => {
          assertDataWriteBoundaryGeneration(boundary.generation);
          const [
            ownerRecord,
            vaultRecord,
            revisionRecord,
            latestRemoval,
            latestMigration,
            latestEntries,
            latestPhotos,
            latestAudios,
            latestSettings,
            latestSpaces,
            latestCaptures,
          ] = await Promise.all([
            db.settings.get(SK.DATA_OWNER_ID),
            db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
            db.settings.get(SK.JOURNAL_VAULT_REVISION),
            db.settings.get(SK.JOURNAL_SECURITY_REMOVAL),
            db.settings.get(SK.JOURNAL_SECURITY_MIGRATION),
            db.journalEntries.toArray(),
            db.journalPhotos.toArray(),
            db.journalAudio.toArray(),
            db.settings.toArray(),
            db.journalSpaces.toArray(),
            db.journalSpaceCaptures.toArray(),
          ]);
          const transactionOwnerUserId =
            typeof ownerRecord?.value === "string" && ownerRecord.value.trim()
              ? ownerRecord.value
              : null;
          const vaultValue = vaultRecord?.value as Partial<JournalVaultKeySetting> | undefined;
          const transactionRevisionMarker = storedVaultRevision(revisionRecord?.value);
          if (
            transactionOwnerUserId !== boundary.localOwnerUserId ||
            vaultValue?.updatedAt !== vaultRevision ||
            Boolean(revisionRecord && transactionRevisionMarker === null) ||
            (transactionRevisionMarker !== null &&
              transactionRevisionMarker !== vaultRevision) ||
            latestRemoval ||
            !structurallyEqual(latestMigration?.value, currentMigrationRecord?.value) ||
            !structurallyEqual(latestEntries, entries) ||
            !structurallyEqual(latestPhotos, photos) ||
            !structurallyEqual(latestAudios, audios) ||
            !structurallyEqual(latestSpaces, spaces) ||
            !structurallyEqual(latestCaptures, captures)
          ) {
            throw new Error("Diary vault changed during epoch normalization");
          }
          const originalDrafts = settings.filter((setting) =>
            setting.key.startsWith(SK.journalDraft("")),
          );
          const latestDrafts = latestSettings.filter((setting) =>
            setting.key.startsWith(SK.journalDraft("")),
          );
          if (!structurallyEqual(latestDrafts, originalDrafts)) {
            throw new Error("Diary draft changed during epoch normalization");
          }

          if (entryUpdates.length) await db.journalEntries.bulkPut(entryUpdates);
          if (photoUpdates.length) await db.journalPhotos.bulkPut(photoUpdates);
          if (audioUpdates.length) await db.journalAudio.bulkPut(audioUpdates);
          if (draftUpdates.length) await db.settings.bulkPut(draftUpdates);
          if (spaceUpdates.length) await db.journalSpaces.bulkPut(spaceUpdates);
          if (captureUpdates.length) await db.journalSpaceCaptures.bulkPut(captureUpdates);
          if (transactionRevisionMarker === null) {
            await db.settings.put({
              key: SK.JOURNAL_VAULT_REVISION,
              value: vaultRevision,
            });
          }
          if (nextMigration && !structurallyEqual(nextMigration, currentMigration)) {
            await db.settings.put({
              key: SK.JOURNAL_SECURITY_MIGRATION,
              value: nextMigration,
            });
          }

          const finalSessionOwnerUserId = await Dexie.waitFor(getCurrentSessionUserId());
          assertDataWriteBoundaryGeneration(boundary.generation);
          if (finalSessionOwnerUserId !== boundary.sessionOwnerUserId) {
            throw new Error("Account boundary changed during diary epoch normalization");
          }
        },
      );
    });
    emitMigrationUpdate();
  }

  if (nextMigration && !structurallyEqual(nextMigration, currentMigration)) {
    try {
      await ensureJournalSecurityMigrationQueued(nextMigration);
    } catch (error) {
      logger.warn(
        "[Journal]",
        "Diary epoch normalization remains pending for online completion:",
        error,
      );
    }
  }
  if (unboundMediaCount > 0) {
    logger.warn(
      "[Journal]",
      "Diary media remains unbound to the active vault epoch:",
      { count: unboundMediaCount },
    );
  }

  return {
    changedCount,
    unboundMediaCount,
    cloudMigrationPending: Boolean(nextMigration),
  };
}

/**
 * Atomically installs local password material and ciphertext. Cloud replacement
 * is represented by a durable owner-bound intent in the same Dexie transaction,
 * so a crash or full queue can never turn a partial migration into a false PASS.
 */
async function activateJournalPasswordProtectionUnlocked(
  { passwordData, vaultSetting, vaultKey }: ActivateJournalPasswordProtectionInput,
  boundary: JournalSecurityBoundary
): Promise<{ cloudMigrationPending: boolean; vaultRevision: number }> {
  const [entries, photos, audios, settings, spaces, captures] = await Promise.all([
    db.journalEntries.toArray(),
    db.journalPhotos.toArray(),
    db.journalAudio.toArray(),
    db.settings.toArray(),
    db.journalSpaces.toArray(),
    db.journalSpaceCaptures.toArray(),
  ]);
  const updatedAt = Date.now();
  const pendingRemovalRecord = settings.find(
    (setting) => setting.key === SK.JOURNAL_SECURITY_REMOVAL
  );
  if (pendingRemovalRecord) {
    if (!isRemovalIntent(pendingRemovalRecord.value)) {
      throw new JournalSecurityRemovalIntentParseError();
    }
    throw new Error("Diary protection removal is still pending online completion.");
  }
  const revisionRecord = settings.find(
    (setting) => setting.key === SK.JOURNAL_VAULT_REVISION
  );
  const vaultRevision = nextVaultRevision(revisionRecord?.value, vaultSetting.updatedAt);
  const activatedVaultSetting: JournalVaultKeySetting = {
    ...vaultSetting,
    updatedAt: vaultRevision,
  };
  const [encryptedEntries, encryptedPhotos, encryptedAudios, preparedDrafts, encryptedSpaces, encryptedCaptures] = await Promise.all([
    Promise.all(entries.map((entry) => encryptEntry(entry, vaultKey, updatedAt, vaultRevision))),
    Promise.all(photos.map((photo) => encryptPhoto(photo, vaultKey, vaultRevision))),
    Promise.all(audios.map((audio) => encryptAudio(audio, vaultKey, vaultRevision))),
    Promise.all(settings.map((setting) =>
      encryptJournalDraftSettingForStorage(setting, vaultKey, vaultRevision)
    )),
    Promise.all(spaces.map((space) =>
      encryptJournalSpaceForStorage(space, vaultKey, vaultRevision)
    )),
    Promise.all(
      captures.map((capture) =>
        encryptJournalSpaceCaptureForStorage(capture, vaultKey, vaultRevision)
      )
    ),
  ]);
  const encryptedDrafts = preparedDrafts.filter(
    (draft): draft is NonNullable<typeof draft> => draft !== null
  );

  await assertJournalSecurityBoundary(boundary);
  const ownerUserId = isCloudSyncEnabled() ? boundary.sessionOwnerUserId : null;

  const intent: JournalSecurityMigrationIntent | null = ownerUserId
    ? {
        version: 1,
        revision: `${vaultRevision}:${updatedAt}`,
        ownerUserId,
        createdAt: updatedAt,
        status: "pending",
        vaultSettingPending: true,
        backupPending: true,
        entryIds: encryptedEntries
          .filter((entry) => Boolean(entry.content))
          .map((entry) => entry.id),
        photos: encryptedPhotos
          .filter((photo) => Boolean(photo.data))
          .map((photo) => ({ id: photo.id, previousStoragePath: photo.storagePath })),
        audios: encryptedAudios
          .filter((audio) => Boolean(audio.data))
          .map((audio) => ({ id: audio.id, previousStoragePath: audio.storagePath })),
      }
    : null;

  await db.transaction(
    "rw",
    [
      db.settings,
      db.journalEntries,
      db.journalPhotos,
      db.journalAudio,
      db.journalSpaces,
      db.journalSpaceCaptures,
    ],
    async () => {
      assertDataWriteBoundaryGeneration(boundary.generation);
      const [ownerRecord, currentRemoval] = await Promise.all([
        db.settings.get(SK.DATA_OWNER_ID),
        db.settings.get(SK.JOURNAL_SECURITY_REMOVAL),
      ]);
      const transactionOwnerUserId =
        typeof ownerRecord?.value === "string" && ownerRecord.value.trim()
          ? ownerRecord.value
          : null;
      if (transactionOwnerUserId !== boundary.localOwnerUserId) {
        throw new Error("Account boundary changed during diary protection");
      }
      if (currentRemoval) {
        if (!isRemovalIntent(currentRemoval.value)) {
          throw new JournalSecurityRemovalIntentParseError();
        }
        throw new Error("Diary protection removal is still pending online completion.");
      }
      await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: passwordData });
      await db.settings.put({
        key: JOURNAL_VAULT_KEY_SETTING_KEY,
        value: activatedVaultSetting,
      });
      await db.settings.put({ key: SK.JOURNAL_VAULT_REVISION, value: vaultRevision });
      if (encryptedDrafts.length) await db.settings.bulkPut(encryptedDrafts);
      for (const entry of encryptedEntries) await db.journalEntries.put(entry);
      for (const photo of encryptedPhotos) await db.journalPhotos.put(photo);
      for (const audio of encryptedAudios) await db.journalAudio.put(audio);
      if (encryptedSpaces.length) await db.journalSpaces.bulkPut(encryptedSpaces);
      if (encryptedCaptures.length) await db.journalSpaceCaptures.bulkPut(encryptedCaptures);
      if (intent) {
        await db.settings.put({ key: SK.JOURNAL_SECURITY_MIGRATION, value: intent });
      }
      const finalSessionOwnerUserId = await Dexie.waitFor(getCurrentSessionUserId());
      assertDataWriteBoundaryGeneration(boundary.generation);
      if (finalSessionOwnerUserId !== boundary.sessionOwnerUserId) {
        throw new Error("Account boundary changed during diary protection");
      }
    }
  );

  setJournalContentVaultKey(vaultKey, vaultRevision);
  if (!intent) return { cloudMigrationPending: false, vaultRevision };

  try {
    await ensureJournalSecurityMigrationQueued(intent);
  } catch (error) {
    const failedIntent: JournalSecurityMigrationIntent = {
      ...intent,
      status: "enqueue-failed",
      lastError: "enqueue-failed",
    };
    await persistIntent(failedIntent, intent.revision);
    logger.error("[Journal] Diary protection cloud migration could not be queued:", error);
  }

  return { cloudMigrationPending: true, vaultRevision };
}

export async function activateJournalPasswordProtection(
  input: ActivateJournalPasswordProtectionInput,
  boundary: JournalSecurityBoundary
): Promise<{ cloudMigrationPending: boolean; vaultRevision: number }> {
  return runWithJournalSecurityBoundary(boundary, () =>
    activateJournalPasswordProtectionUnlocked(input, boundary)
  );
}

function structurallyEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true;
  try {
    return JSON.stringify(first) === JSON.stringify(second);
  } catch {
    return false;
  }
}

async function decryptEntryForRemoval(
  entry: JournalEntry,
  vaultKey: string,
  updatedAt: number
): Promise<JournalEntry> {
  if (!entry.content || !isEncryptedJournalContent(entry.content)) return entry;
  return {
    ...entry,
    content: await decryptJournalContentIfNeeded(entry.content, vaultKey),
    updatedAt,
    vaultRevision: undefined,
  };
}

async function decryptPhotoForRemoval(
  photo: JournalPhoto,
  vaultKey: string
): Promise<JournalPhoto> {
  const protectedPayload = Boolean(
    (photo.data && isEncryptedJournalMediaData(photo.data)) ||
      (photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail))
  );
  if (!protectedPayload) return photo;
  return {
    ...photo,
    data:
      photo.data && isEncryptedJournalMediaData(photo.data)
        ? await decryptJournalMediaDataUrlIfNeeded(photo.data, vaultKey)
        : photo.data,
    thumbnail:
      photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail)
        ? await decryptJournalMediaDataUrlIfNeeded(photo.thumbnail, vaultKey)
        : photo.thumbnail,
    storagePath: undefined,
    storageUrl: undefined,
    vaultRevision: undefined,
  };
}

async function decryptAudioForRemoval(
  audio: JournalAudio,
  vaultKey: string
): Promise<JournalAudio> {
  if (!audio.data || !isEncryptedJournalMediaData(audio.data)) return audio;
  return {
    ...audio,
    data: await decryptJournalMediaDataUrlIfNeeded(audio.data, vaultKey),
    storagePath: undefined,
    storageUrl: undefined,
    vaultRevision: undefined,
  };
}

type JournalSettingRow = { key: string; value: unknown };
type JournalSpaceRow = JournalSpace;
type JournalCaptureRow = JournalSpaceCapture;

interface PreparedJournalPasswordRemoval {
  preflight: Extract<JournalPasswordRemovalPreflight, { status: "ready" }>;
  source: {
    entries: JournalEntry[];
    photos: JournalPhoto[];
    audios: JournalAudio[];
    settings: JournalSettingRow[];
    spaces: JournalSpaceRow[];
    captures: JournalCaptureRow[];
  };
  decrypted: {
    entries: JournalEntry[];
    photos: JournalPhoto[];
    audios: JournalAudio[];
    drafts: JournalSettingRow[];
    spaces: JournalSpaceRow[];
    captures: JournalCaptureRow[];
  };
  storageObjects: JournalMediaStorageIdentity[];
}

type JournalPasswordRemovalPreparation =
  | PreparedJournalPasswordRemoval
  | Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>;

function removalBlocked(
  status: Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>["status"],
  recoveryAction: Exclude<
    JournalPasswordRemovalPreflight,
    { status: "ready" }
  >["recoveryAction"]
): Exclude<JournalPasswordRemovalPreflight, { status: "ready" }> {
  return { status, recoveryAction };
}

async function mapJournalRemovalPreflightBatches<T, Result>(
  items: readonly T[],
  mapper: (item: T) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = [];
  for (let index = 0; index < items.length; index += JOURNAL_REMOVAL_PREFLIGHT_BATCH_SIZE) {
    const batch = items.slice(index, index + JOURNAL_REMOVAL_PREFLIGHT_BATCH_SIZE);
    results.push(...(await Promise.all(batch.map(mapper))));
    if (index + JOURNAL_REMOVAL_PREFLIGHT_BATCH_SIZE < items.length) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
    }
  }
  return results;
}

function compareCanonicalJournalInventoryKeys(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const sharedLength = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) {
      return leftBytes[index] - rightBytes[index];
    }
  }
  return leftBytes.length - rightBytes.length;
}

export function canonicalJournalInventoryJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Diary removal inventory contains a non-finite number");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJournalInventoryJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareCanonicalJournalInventoryKeys(left, right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJournalInventoryJson(item)}`)
      .join(",")}}`;
  }
  throw new Error("Diary removal inventory contains an unsupported value");
}

async function journalInventorySha256(value: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Diary removal inventory hashing is unavailable");
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJournalInventoryJson(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type JournalInventorySecurityProjectionKind =
  | "entry-row"
  | "photo-row"
  | "audio-row"
  | "entry-backup"
  | "photo-backup"
  | "audio-backup"
  | "space-backup"
  | "capture-backup";

function journalInventoryRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Diary removal inventory ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function journalInventoryString(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string") {
    throw new Error(`Diary removal inventory ${label} must be a string`);
  }
  return value;
}

function journalInventoryNullableString(
  value: unknown,
  label: string,
): string | null {
  if (value === undefined || value === null) return null;
  return journalInventoryString(value, label);
}

function journalInventoryVaultRevision(
  value: unknown,
  label: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Diary removal inventory ${label} is invalid`);
  }
  return value.toString(10);
}

/**
 * Cross-runtime password-removal receipts intentionally hash only fields that
 * affect decryption, owner relationships, encrypted blob identity, or the
 * vault epoch. UI layout, timestamps, dimensions, and other numeric metadata
 * remain outside this freshness fence: JavaScript and PostgreSQL can serialize
 * equivalent floating-point JSON differently, which must not strand an owner
 * in a false coverage mismatch.
 */
export function journalInventorySecurityProjection(
  kind: JournalInventorySecurityProjectionKind,
  value: unknown,
): Record<string, unknown> {
  const item = journalInventoryRecord(value, kind);
  const id = journalInventoryString(item.id, `${kind}.id`);

  switch (kind) {
    case "entry-row":
      return {
        id,
        content: journalInventoryString(item.content, `${kind}.content`),
        vault_revision: journalInventoryVaultRevision(
          item.vaultRevision,
          `${kind}.vaultRevision`,
        ),
      };
    case "photo-row":
    case "audio-row":
      return {
        id,
        entry_id: journalInventoryString(item.entryId, `${kind}.entryId`),
        storage_path: journalInventoryNullableString(
          item.storagePath,
          `${kind}.storagePath`,
        ),
        vault_revision: journalInventoryVaultRevision(
          item.vaultRevision,
          `${kind}.vaultRevision`,
        ),
      };
    case "entry-backup":
      return {
        id,
        content: journalInventoryString(item.content, `${kind}.content`),
        vaultRevision: journalInventoryVaultRevision(
          item.vaultRevision,
          `${kind}.vaultRevision`,
        ),
      };
    case "photo-backup":
      return {
        id,
        entryId: journalInventoryString(item.entryId, `${kind}.entryId`),
        data: journalInventoryNullableString(item.data, `${kind}.data`),
        thumbnail: journalInventoryNullableString(
          item.thumbnail,
          `${kind}.thumbnail`,
        ),
        storagePath: journalInventoryNullableString(
          item.storagePath,
          `${kind}.storagePath`,
        ),
        vaultRevision: journalInventoryVaultRevision(
          item.vaultRevision,
          `${kind}.vaultRevision`,
        ),
      };
    case "audio-backup":
      return {
        id,
        entryId: journalInventoryString(item.entryId, `${kind}.entryId`),
        data: journalInventoryNullableString(item.data, `${kind}.data`),
        storagePath: journalInventoryNullableString(
          item.storagePath,
          `${kind}.storagePath`,
        ),
        vaultRevision: journalInventoryVaultRevision(
          item.vaultRevision,
          `${kind}.vaultRevision`,
        ),
      };
    case "space-backup":
      return {
        id,
        name: journalInventoryNullableString(item.name, `${kind}.name`),
        description: journalInventoryNullableString(
          item.description,
          `${kind}.description`,
        ),
        vaultRevision: journalInventoryVaultRevision(
          item.vaultRevision,
          `${kind}.vaultRevision`,
        ),
      };
    case "capture-backup": {
      if (!Array.isArray(item.fields)) {
        throw new Error(`Diary removal inventory ${kind}.fields must be an array`);
      }
      return {
        id,
        spaceId: journalInventoryString(item.spaceId, `${kind}.spaceId`),
        spaceName: journalInventoryString(item.spaceName, `${kind}.spaceName`),
        title: journalInventoryString(item.title, `${kind}.title`),
        fields: item.fields.map((field, index) => {
          const captureField = journalInventoryRecord(
            field,
            `${kind}.fields[${index}]`,
          );
          return {
            prompt: journalInventoryString(
              captureField.prompt,
              `${kind}.fields[${index}].prompt`,
            ),
            value: journalInventoryString(
              captureField.value,
              `${kind}.fields[${index}].value`,
            ),
          };
        }),
        entryId: journalInventoryNullableString(item.entryId, `${kind}.entryId`),
        vaultRevision: journalInventoryVaultRevision(
          item.vaultRevision,
          `${kind}.vaultRevision`,
        ),
      };
    }
  }
}

async function buildJournalPasswordRemovalInventory(
  source: PreparedJournalPasswordRemoval["source"],
  storageObjects: JournalMediaStorageIdentity[],
): Promise<JournalPasswordRemovalInventory> {
  const photoOwners = new Map(source.photos.map((photo) => [photo.id, photo.entryId]));
  const audioOwners = new Map(source.audios.map((audio) => [audio.id, audio.entryId]));
  const normalizedEntries = source.entries.map((entry) => ({
    ...entry,
    photoIds: [...new Set(entry.photoIds)].filter(
      (photoId) => photoOwners.get(photoId) === entry.id,
    ),
    audioIds: entry.audioIds
      ? [...new Set(entry.audioIds)].filter(
          (audioId) => audioOwners.get(audioId) === entry.id,
        )
      : entry.audioIds,
  }));
  const entryIds = new Set(normalizedEntries.map((entry) => entry.id));
  const spaceIds = new Set(source.spaces.map((space) => space.id));
  const normalizedCaptures = source.captures
    .filter((capture) => spaceIds.has(capture.spaceId))
    .map((capture) =>
      capture.entryId && !entryIds.has(capture.entryId)
        ? { ...capture, entryId: undefined }
        : capture,
    );

  const protectedEntries = normalizedEntries.filter(
    (entry) => isEncryptedJournalContent(entry.content) || entry.vaultRevision !== undefined,
  );
  const protectedPhotos = source.photos.filter(
    (photo) =>
      Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
      Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail)) ||
      photo.storagePath?.endsWith(".bin") === true ||
      photo.vaultRevision !== undefined,
  );
  const protectedAudios = source.audios.filter(
    (audio) =>
      Boolean(audio.data && isEncryptedJournalMediaData(audio.data)) ||
      audio.storagePath?.endsWith(".bin") === true ||
      audio.vaultRevision !== undefined,
  );
  const protectedSpaces = source.spaces.filter(
    (space) =>
      Boolean(space.name && isEncryptedJournalContent(space.name)) ||
      Boolean(space.description && isEncryptedJournalContent(space.description)) ||
      space.vaultRevision !== undefined,
  );
  const protectedCaptures = normalizedCaptures.filter(
    (capture) =>
      isEncryptedJournalContent(capture.spaceName) ||
      isEncryptedJournalContent(capture.title) ||
      capture.fields.some(
        (field) =>
          isEncryptedJournalContent(field.prompt) ||
          isEncryptedJournalContent(field.value),
      ) ||
      capture.vaultRevision !== undefined,
  );

  return {
    version: 1,
    entries: await Promise.all(
      protectedEntries.map(async (entry) => ({
        id: entry.id,
        rowSha256: await journalInventorySha256(
          journalInventorySecurityProjection("entry-row", entry),
        ),
        backupSha256: await journalInventorySha256(
          journalInventorySecurityProjection("entry-backup", entry),
        ),
      })),
    ),
    photos: await Promise.all(
      protectedPhotos.map(async (photo) => ({
        id: photo.id,
        rowSha256: await journalInventorySha256(
          journalInventorySecurityProjection("photo-row", photo),
        ),
        backupSha256: await journalInventorySha256(
          journalInventorySecurityProjection("photo-backup", photo),
        ),
      })),
    ),
    audios: await Promise.all(
      protectedAudios.map(async (audio) => ({
        id: audio.id,
        rowSha256: await journalInventorySha256(
          journalInventorySecurityProjection("audio-row", audio),
        ),
        backupSha256: await journalInventorySha256(
          journalInventorySecurityProjection("audio-backup", audio),
        ),
      })),
    ),
    spaces: await Promise.all(
      protectedSpaces.map(async (space) => ({
        id: space.id,
        backupSha256: await journalInventorySha256(
          journalInventorySecurityProjection("space-backup", space),
        ),
      })),
    ),
    captures: await Promise.all(
      protectedCaptures.map(async (capture) => ({
        id: capture.id,
        backupSha256: await journalInventorySha256(
          journalInventorySecurityProjection("capture-backup", capture),
        ),
      })),
    ),
    storageObjects,
  };
}

function emptyRemovalCloudCleanup(): JournalCloudCleanupState {
  return {
    status: "not-started",
    stage: "entries",
    entryIds: [],
    photos: [],
    audios: [],
    backupPending: false,
    attemptCount: 0,
  };
}

function removalOwnerForBoundary(boundary: JournalSecurityBoundary): string {
  return (
    boundary.sessionOwnerUserId ??
    boundary.localOwnerUserId ??
    LOCAL_INSTALLATION_REMOVAL_OWNER
  );
}

async function startOrResumeJournalPasswordRemovalAttempt(
  boundary: JournalSecurityBoundary,
): Promise<JournalSecurityRemovalIntent | Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>> {
  let migrationIntent: JournalSecurityMigrationIntent | null;
  let existingIntent: JournalSecurityRemovalIntent | null;
  let vaultRecord: { value?: unknown } | undefined;
  let revisionRecord: { value?: unknown } | undefined;
  try {
    [migrationIntent, existingIntent, vaultRecord, revisionRecord] = await Promise.all([
      getJournalSecurityMigrationIntent(),
      getJournalSecurityRemovalIntent(),
      db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
      db.settings.get(SK.JOURNAL_VAULT_REVISION),
    ]);
  } catch {
    return removalBlocked("storage-failed", "retry");
  }

  if (migrationIntent) {
    return removalBlocked("activation-pending", "wait-for-activation");
  }

  const ownerUserId = removalOwnerForBoundary(boundary);
  if (existingIntent) {
    if (!journalSecurityRemovalIntentMatchesBoundary(existingIntent, boundary)) {
      return removalBlocked("owner-changed", "stay-signed-in");
    }
    if (
      existingIntent.phase === "local-committed" ||
      existingIntent.phase === "cleanup-pending"
    ) {
      return removalBlocked("removal-pending", "retry");
    }
    const resumed: JournalSecurityRemovalIntent = {
      ...existingIntent,
      updatedAt: Date.now(),
      phase:
        existingIntent.phase === "remote-fenced"
          ? "remote-fenced"
          : "preflight-pending",
      blocker: undefined,
      attemptCount: existingIntent.attemptCount + 1,
      nativeCleanup: { status: "not-started" },
      cloudCleanup: emptyRemovalCloudCleanup(),
      status: "pending",
      lastError: undefined,
      photos: [],
      audios: [],
    };
    try {
      await persistRemovalIntent(resumed, existingIntent.operationRevision);
      return resumed;
    } catch {
      return removalBlocked("storage-failed", "retry");
    }
  }

  const vaultRevision = storedVaultRevision(
    (vaultRecord?.value as { updatedAt?: unknown } | undefined)?.updatedAt,
  );
  const markerRevision = storedVaultRevision(revisionRecord?.value);
  const expectedVaultRevision = vaultRevision ?? markerRevision ?? 0;
  const createdAt = Date.now();
  const operationRevision = `${createdAt}:${generateSecureRandom(24)}`;
  const intent: JournalSecurityRemovalIntent = {
    version: 2,
    revision: operationRevision,
    operationRevision,
    expectedVaultRevision,
    ownerUserId,
    createdAt,
    updatedAt: createdAt,
    phase: "preflight-pending",
    blocker: undefined,
    attemptCount: 0,
    nativeCleanup: { status: "not-started" },
    cloudCleanup: emptyRemovalCloudCleanup(),
    status: "pending",
    photos: [],
    audios: [],
  };
  try {
    await persistRemovalIntent(intent);
    return intent;
  } catch {
    return removalBlocked("storage-failed", "retry");
  }
}

async function persistBlockedRemovalAttempt(
  intent: JournalSecurityRemovalIntent,
  blocker: JournalProtectionBlockerCode,
): Promise<void> {
  await persistRemovalIntent(
    {
      ...intent,
      updatedAt: Date.now(),
      phase: "blocked",
      blocker,
      nativeCleanup: { status: "not-started" },
      cloudCleanup: emptyRemovalCloudCleanup(),
      status: "pending",
      lastError: blocker === "storage-failed" ? "storage-failed" : undefined,
      photos: [],
      audios: [],
    },
    intent.operationRevision,
  );
}

async function prepareJournalPasswordRemoval(
  vaultKey: string | null,
  boundary: JournalSecurityBoundary,
  expectedRemovalRevision?: string,
  requireRemoteFenceIdentity = false,
): Promise<JournalPasswordRemovalPreparation> {
  try {
    await assertJournalSecurityBoundary(boundary);
  } catch {
    return removalBlocked("owner-changed", "stay-signed-in");
  }

  let migrationIntent: JournalSecurityMigrationIntent | null;
  let removalIntent: JournalSecurityRemovalIntent | null;
  let entries: JournalEntry[];
  let photos: JournalPhoto[];
  let audios: JournalAudio[];
  let settings: JournalSettingRow[];
  let spaces: JournalSpaceRow[];
  let captures: JournalCaptureRow[];
  try {
    [migrationIntent, removalIntent] = await Promise.all([
      getJournalSecurityMigrationIntent(),
      getJournalSecurityRemovalIntent(),
    ]);
    if (migrationIntent) {
      return removalBlocked("activation-pending", "wait-for-activation");
    }
    if (
      removalIntent &&
      (removalIntent.operationRevision !== expectedRemovalRevision ||
        (removalIntent.phase !== "preflight-pending" &&
          removalIntent.phase !== "remote-fenced" &&
          removalIntent.phase !== "blocked"))
    ) {
      return removalBlocked("removal-pending", "retry");
    }
    [entries, photos, audios, settings, spaces, captures] = await Promise.all([
      db.journalEntries.toArray(),
      db.journalPhotos.toArray(),
      db.journalAudio.toArray(),
      db.settings.toArray(),
      db.journalSpaces.toArray(),
      db.journalSpaceCaptures.toArray(),
    ]);
  } catch {
    return removalBlocked("storage-failed", "retry");
  }

  const passwordRecord = settings.find((setting) => setting.key === JOURNAL_PASSWORD_KEY);
  const vaultRecord = settings.find(
    (setting) => setting.key === JOURNAL_VAULT_KEY_SETTING_KEY
  );
  const markerRecord = settings.find(
    (setting) => setting.key === SK.JOURNAL_VAULT_REVISION
  );
  const persistedVaultRevision = Number(
    (vaultRecord?.value as { updatedAt?: unknown } | undefined)?.updatedAt
  );
  const markerRevision = storedVaultRevision(markerRecord?.value);
  if (
    (passwordRecord?.value && !vaultRecord?.value) ||
    (vaultRecord?.value &&
      (!Number.isSafeInteger(persistedVaultRevision) ||
        markerRevision === null ||
        markerRevision !== persistedVaultRevision))
  ) {
    return removalBlocked("vault-revision-mismatch", "reload");
  }
  if (
    vaultRecord?.value &&
    vaultKey &&
    (getJournalContentVaultKey() !== vaultKey ||
      getJournalContentVaultRevision() !== persistedVaultRevision)
  ) {
    return removalBlocked("unlock-required", "unlock");
  }

  const sourcePhotos = photos;
  const sourceAudios = audios;
  const storageObjects: JournalMediaStorageIdentity[] = [];
  const hasEncryptedContent =
    entries.some((entry) => Boolean(entry.content && isEncryptedJournalContent(entry.content))) ||
    photos.some(
      (photo) =>
        Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
        Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail))
    ) ||
    audios.some((audio) => Boolean(audio.data && isEncryptedJournalMediaData(audio.data))) ||
    photos.some((photo) => Boolean(photo.storagePath?.endsWith(".bin"))) ||
    audios.some((audio) => Boolean(audio.storagePath?.endsWith(".bin"))) ||
    settings.some((setting) => {
      const draft = setting.key.startsWith(SK.journalDraft(""))
        ? (setting.value as { content?: unknown } | undefined)
        : undefined;
      return Boolean(
        typeof draft?.content === "string" && isEncryptedJournalContent(draft.content)
      );
    }) ||
    spaces.some(
      (space) =>
        Boolean(space.name && isEncryptedJournalContent(space.name)) ||
        Boolean(space.description && isEncryptedJournalContent(space.description))
    ) ||
    captures.some(
      (capture) =>
        isEncryptedJournalContent(capture.spaceName) ||
        isEncryptedJournalContent(capture.title) ||
        capture.fields.some(
          (field) =>
            isEncryptedJournalContent(field.prompt) ||
            isEncryptedJournalContent(field.value)
        )
    );
  if (hasEncryptedContent && !vaultKey) {
    return removalBlocked("unlock-required", "unlock");
  }

  if (vaultKey) {
    try {
      photos = await mapJournalRemovalPreflightBatches(
        photos,
        async (photo) => {
          if (!photo.storagePath?.endsWith(".bin")) return photo;
          if (!boundary.sessionOwnerUserId) throw new Error("owner unavailable");
          if (!requireRemoteFenceIdentity && photo.data) return photo;
          const identityBefore = requireRemoteFenceIdentity
            ? await readJournalMediaStorageIdentity(
                "journal-photos",
                photo.storagePath,
                boundary.sessionOwnerUserId,
              )
            : null;
          const downloaded = await downloadAsBase64(
            "journal-photos",
            photo.storagePath,
            boundary.sessionOwnerUserId
          );
          if (!downloaded) throw new Error("photo unavailable");
          if (requireRemoteFenceIdentity) {
            const identityAfter = await readJournalMediaStorageIdentity(
              "journal-photos",
              photo.storagePath,
              boundary.sessionOwnerUserId,
            );
            if (!identityBefore || !identityAfter || !structurallyEqual(identityBefore, identityAfter)) {
              throw new Error("photo changed during removal preflight");
            }
            storageObjects.push(identityAfter);
          }
          return {
            ...photo,
            data: encryptedJournalMediaFromStorageDataUrl(downloaded),
          };
        },
      );
      audios = await mapJournalRemovalPreflightBatches(
        audios,
        async (audio) => {
          if (!audio.storagePath?.endsWith(".bin")) return audio;
          if (!boundary.sessionOwnerUserId) throw new Error("owner unavailable");
          if (!requireRemoteFenceIdentity && audio.data) return audio;
          const identityBefore = requireRemoteFenceIdentity
            ? await readJournalMediaStorageIdentity(
                "journal-audio",
                audio.storagePath,
                boundary.sessionOwnerUserId,
              )
            : null;
          const downloaded = await downloadAsBase64(
            "journal-audio",
            audio.storagePath,
            boundary.sessionOwnerUserId
          );
          if (!downloaded) throw new Error("audio unavailable");
          if (requireRemoteFenceIdentity) {
            const identityAfter = await readJournalMediaStorageIdentity(
              "journal-audio",
              audio.storagePath,
              boundary.sessionOwnerUserId,
            );
            if (!identityBefore || !identityAfter || !structurallyEqual(identityBefore, identityAfter)) {
              throw new Error("audio changed during removal preflight");
            }
            storageObjects.push(identityAfter);
          }
          return {
            ...audio,
            data: encryptedJournalMediaFromStorageDataUrl(downloaded),
          };
        },
      );
    } catch {
      return removalBlocked("decrypt-media", "retry");
    }
  }

  const updatedAt = Date.now();
  let decryptedEntries = entries;
  let decryptedPhotos = photos;
  let decryptedAudios = audios;
  let decryptedDrafts: JournalSettingRow[] = [];
  let decryptedSpaces = spaces;
  let decryptedCaptures = captures;
  if (vaultKey) {
    try {
      decryptedEntries = await mapJournalRemovalPreflightBatches(
        entries,
        (entry) => decryptEntryForRemoval(entry, vaultKey, updatedAt),
      );
    } catch {
      return removalBlocked("decrypt-entry", "retry");
    }
    try {
      [decryptedPhotos, decryptedAudios] = await Promise.all([
        mapJournalRemovalPreflightBatches(photos, (photo) =>
          decryptPhotoForRemoval(photo, vaultKey)
        ),
        mapJournalRemovalPreflightBatches(audios, (audio) =>
          decryptAudioForRemoval(audio, vaultKey)
        ),
      ]);
    } catch {
      return removalBlocked("decrypt-media", "retry");
    }
    try {
      const preparedDrafts = await mapJournalRemovalPreflightBatches(
        settings,
        (setting) =>
          decryptJournalDraftSettingForStorage(setting, vaultKey)
      );
      decryptedDrafts = preparedDrafts.filter(
        (draft): draft is NonNullable<typeof draft> => draft !== null
      );
    } catch {
      return removalBlocked("decrypt-draft", "retry");
    }
    try {
      decryptedSpaces = await mapJournalRemovalPreflightBatches(
        spaces,
        (space) => decryptJournalSpaceForStorage(space, vaultKey),
      );
    } catch {
      return removalBlocked("decrypt-space", "retry");
    }
    try {
      decryptedCaptures = await mapJournalRemovalPreflightBatches(
        captures,
        (capture) =>
          decryptJournalSpaceCaptureForStorage(capture, vaultKey)
      );
    } catch {
      return removalBlocked("decrypt-capture", "retry");
    }
  }

  try {
    await assertJournalSecurityBoundary(boundary);
  } catch {
    return removalBlocked("owner-changed", "stay-signed-in");
  }

  return {
    preflight: {
      status: "ready",
      expectedVaultRevision:
        vaultRecord?.value !== undefined
          ? persistedVaultRevision
          : removalIntent && removalIntent.operationRevision === expectedRemovalRevision
            ? removalIntent.expectedVaultRevision
            : 0,
      coverage: {
        entries: entries.length,
        media: photos.length + audios.length,
        drafts: decryptedDrafts.length,
        spaces: spaces.length,
        captures: captures.length,
      },
    },
    source: {
      entries,
      photos: sourcePhotos,
      audios: sourceAudios,
      settings,
      spaces,
      captures,
    },
    decrypted: {
      entries: decryptedEntries,
      photos: decryptedPhotos,
      audios: decryptedAudios,
      drafts: decryptedDrafts,
      spaces: decryptedSpaces,
      captures: decryptedCaptures,
    },
    storageObjects,
  };
}

export async function preflightJournalPasswordRemoval(
  vaultKey: string | null,
  boundary: JournalSecurityBoundary
): Promise<JournalPasswordRemovalPreflight> {
  const preparation = await prepareJournalPasswordRemoval(vaultKey, boundary);
  return "preflight" in preparation ? preparation.preflight : preparation;
}

/**
 * Prepares every decryption before opening IndexedDB, then commits plaintext,
 * removal metadata, and password/vault deletion in one transaction. A crypto,
 * ownership, process, or IndexedDB failure therefore cannot persist a mixed
 * local protection state.
 */
export async function removeJournalPasswordProtectionAtomically(
  vaultKey: string | null,
  boundary: JournalSecurityBoundary
): Promise<{ cloudMigrationPending: boolean; removalRevision?: string }> {
  return runWithJournalSecurityBoundary(boundary, async () => {
    const attempt = await startOrResumeJournalPasswordRemovalAttempt(boundary);
    if (!("operationRevision" in attempt)) {
      throw new JournalPasswordRemovalBlockedError(attempt);
    }
    // Any authenticated owner may already have a remote vault, even while the
    // local owner marker is still being adopted. Only a signed-out installation
    // is eligible for a local-only removal.
    const requiresRemoteFence = Boolean(boundary.sessionOwnerUserId);
    const preparation = await prepareJournalPasswordRemoval(
      vaultKey,
      boundary,
      attempt.operationRevision,
      requiresRemoteFence,
    );
    if (!("preflight" in preparation)) {
      if (preparation.status !== "owner-changed") {
        try {
          await persistBlockedRemovalAttempt(attempt, preparation.status);
        } catch {
          throw new JournalPasswordRemovalBlockedError(
            removalBlocked("storage-failed", "retry"),
          );
        }
      }
      throw new JournalPasswordRemovalBlockedError(preparation);
    }
    let fencedAttempt = attempt;
    let fenceStatus: "ready" | "complete" | "not-required" = "not-required";
    if (requiresRemoteFence) {
      try {
        const inventory = await buildJournalPasswordRemovalInventory(
          preparation.source,
          preparation.storageObjects,
        );
        fenceStatus = await beginRemoteJournalPasswordRemoval({
          expectedOwnerUserId: boundary.sessionOwnerUserId!,
          expectedVaultRevision: preparation.preflight.expectedVaultRevision,
          operationRevision: attempt.operationRevision,
          inventory,
        });
        fencedAttempt = {
          ...attempt,
          expectedVaultRevision: preparation.preflight.expectedVaultRevision,
          updatedAt: Date.now(),
          phase: "remote-fenced",
          blocker: undefined,
        };
        await persistRemovalIntent(fencedAttempt, attempt.operationRevision);
      } catch {
        try {
          await persistBlockedRemovalAttempt(attempt, "storage-failed");
        } catch {
          // The preflight intent remains durable and still prevents unsafe cleanup.
        }
        throw new JournalPasswordRemovalBlockedError(
          removalBlocked("storage-failed", "retry"),
        );
      }
    }

    const { source, decrypted } = preparation;
    if (requiresRemoteFence) {
      source.settings = source.settings.map((setting) =>
        setting.key === SK.JOURNAL_SECURITY_REMOVAL
          ? { key: setting.key, value: fencedAttempt }
          : setting,
      );
    }
    const { entries, photos, audios, settings, spaces, captures } = source;
    const passwordRecord = settings.find((setting) => setting.key === JOURNAL_PASSWORD_KEY);
    const vaultRecord = settings.find(
      (setting) => setting.key === JOURNAL_VAULT_KEY_SETTING_KEY
    );
    const updatedAt = Date.now();
    const {
      entries: decryptedEntries,
      photos: decryptedPhotos,
      audios: decryptedAudios,
      drafts: decryptedDrafts,
      spaces: decryptedSpaces,
      captures: decryptedCaptures,
    } = decrypted;
    const cloudCleanupPending = fenceStatus === "ready";
    const removalPhotos = createMediaCleanupItems(
      photos
        .filter((photo) => Boolean(photo.storagePath))
        .map((photo) => ({ id: photo.id, previousStoragePath: photo.storagePath }))
    );
    const removalAudios = createMediaCleanupItems(
      audios
        .filter((audio) => Boolean(audio.storagePath))
        .map((audio) => ({ id: audio.id, previousStoragePath: audio.storagePath }))
    );
    const removalIntent: JournalSecurityRemovalIntent = {
      ...fencedAttempt,
      expectedVaultRevision: preparation.preflight.expectedVaultRevision,
      updatedAt,
      phase: "local-committed",
      blocker: undefined,
      nativeCleanup: { status: "pending", attemptCount: 0 },
      cloudCleanup: {
        status: cloudCleanupPending ? "pending" : "complete",
        stage: cloudCleanupPending ? "entries" : "complete",
        entryIds: cloudCleanupPending ? entries.map((entry) => entry.id) : [],
        photos: cloudCleanupPending ? removalPhotos : [],
        audios: cloudCleanupPending ? removalAudios : [],
        backupPending: cloudCleanupPending,
        attemptCount: 0,
      },
      status: "pending",
      lastError: undefined,
      photos: cloudCleanupPending ? removalPhotos : [],
      audios: cloudCleanupPending ? removalAudios : [],
    };

    await assertJournalSecurityBoundary(boundary);
    try {
      await db.transaction(
        "rw",
        [
          db.settings,
          db.journalEntries,
          db.journalPhotos,
          db.journalAudio,
          db.journalSpaces,
          db.journalSpaceCaptures,
        ],
        async () => {
        assertDataWriteBoundaryGeneration(boundary.generation);
        const [
          ownerRecord,
          currentPassword,
          currentVault,
          currentEntries,
          currentPhotos,
          currentAudios,
          currentSettings,
          currentSpaces,
          currentCaptures,
        ] = await Promise.all([
          db.settings.get(SK.DATA_OWNER_ID),
          db.settings.get(JOURNAL_PASSWORD_KEY),
          db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
          db.journalEntries.toArray(),
          db.journalPhotos.toArray(),
          db.journalAudio.toArray(),
          db.settings.toArray(),
          db.journalSpaces.toArray(),
          db.journalSpaceCaptures.toArray(),
        ]);
        const transactionOwnerUserId =
          typeof ownerRecord?.value === "string" && ownerRecord.value.trim()
            ? ownerRecord.value
            : null;
        if (transactionOwnerUserId !== boundary.localOwnerUserId) {
          throw new Error("Account boundary changed during diary protection");
        }
        if (
          !structurallyEqual(currentPassword?.value, passwordRecord?.value) ||
          !structurallyEqual(currentVault?.value, vaultRecord?.value) ||
          !structurallyEqual(currentEntries, entries) ||
          !structurallyEqual(currentPhotos, photos) ||
          !structurallyEqual(currentAudios, audios) ||
          !structurallyEqual(currentSettings, settings) ||
          !structurallyEqual(currentSpaces, spaces) ||
          !structurallyEqual(currentCaptures, captures)
        ) {
          throw new JournalPasswordRemovalBlockedError(
            removalBlocked("vault-revision-mismatch", "reload")
          );
        }

        if (decryptedEntries.length) await db.journalEntries.bulkPut(decryptedEntries);
        if (decryptedPhotos.length) await db.journalPhotos.bulkPut(decryptedPhotos);
        if (decryptedAudios.length) await db.journalAudio.bulkPut(decryptedAudios);
        if (decryptedDrafts.length) await db.settings.bulkPut(decryptedDrafts);
        if (decryptedSpaces.length) await db.journalSpaces.bulkPut(decryptedSpaces);
        if (decryptedCaptures.length) {
          await db.journalSpaceCaptures.bulkPut(decryptedCaptures);
        }
        await db.settings.bulkDelete([
          JOURNAL_PASSWORD_KEY,
          JOURNAL_VAULT_KEY_SETTING_KEY,
          SK.JOURNAL_BIOMETRIC,
          SK.JOURNAL_PASSWORD_COOLDOWN,
        ]);
          await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: removalIntent });

        const finalSessionOwnerUserId = await Dexie.waitFor(getCurrentSessionUserId());
        assertDataWriteBoundaryGeneration(boundary.generation);
        if (finalSessionOwnerUserId !== boundary.sessionOwnerUserId) {
          throw new Error("Account boundary changed during diary protection");
        }
        },
      );
    } catch (error) {
      const blocker =
        error instanceof JournalPasswordRemovalBlockedError
          ? error.code
          : "storage-failed";
      try {
        await persistBlockedRemovalAttempt(fencedAttempt, blocker);
      } catch {
        // The preflight-pending intent remains durable and still blocks cleanup.
      }
      throw error;
    }
    emitMigrationUpdate();
    return {
      cloudMigrationPending: removalIntent.cloudCleanup.status === "pending",
      removalRevision: removalIntent.operationRevision,
    };
  });
}

export async function ensureJournalSecurityRemovalQueued(
  suppliedIntent?: JournalSecurityRemovalIntent
): Promise<boolean> {
  const intent = suppliedIntent ?? (await getJournalSecurityRemovalIntent());
  if (
    !intent ||
    (intent.cloudCleanup.status !== "pending" &&
      intent.cloudCleanup.status !== "blocked")
  ) {
    return false;
  }
  await validateSyncOwner(intent.ownerUserId, "Diary protection removal enqueue");
  try {
    await offlineQueue.enqueue(
      "MIGRATE_JOURNAL_SECURITY",
      `journal-security-removal:${intent.revision}`,
      { mode: "remove", revision: intent.revision },
      {
        expectedOwnerUserId: intent.ownerUserId,
        priority: "critical",
        maxRetries: 5,
      }
    );
  } catch (error) {
    await persistRemovalIntent(
      {
        ...intent,
        status: "enqueue-failed",
        updatedAt: Date.now(),
        attemptCount: intent.attemptCount + 1,
        cloudCleanup: {
          ...intent.cloudCleanup,
          status: "blocked",
          blocker: "storage-failed",
          attemptCount: intent.cloudCleanup.attemptCount + 1,
        },
        lastError: "storage-failed",
      },
      intent.revision
    );
    throw error;
  }
  const current = await getJournalSecurityRemovalIntent();
  if (current?.revision === intent.revision) {
    await persistRemovalIntent(
      {
        ...current,
        status: "queued",
        updatedAt: Date.now(),
        cloudCleanup: {
          ...current.cloudCleanup,
          status: "pending",
          blocker: undefined,
        },
        lastError: undefined,
      },
      current.revision
    );
  }
  return true;
}

function removalCleanupComplete(intent: JournalSecurityRemovalIntent): boolean {
  return (
    (intent.nativeCleanup.status === "complete" ||
      intent.nativeCleanup.status === "not-applicable") &&
    intent.cloudCleanup.status === "complete"
  );
}

export async function recordJournalSecurityRemovalNativeCleanup(
  operationRevision: string | undefined,
  outcome: "complete" | "not-applicable" | "failed" | "owner-changed"
): Promise<void> {
  if (!operationRevision) return;
  await db.transaction("rw", db.settings, async () => {
    const [record, revisionRecord] = await Promise.all([
      db.settings.get(SK.JOURNAL_SECURITY_REMOVAL),
      db.settings.get(SK.JOURNAL_VAULT_REVISION),
    ]);
    if (!record) return;
    if (!isRemovalIntent(record.value)) {
      throw new JournalSecurityRemovalIntentParseError();
    }
    const current = normalizeRemovalIntent(
      record.value,
      storedVaultRevision(revisionRecord?.value) ?? 0
    );
    if (current.operationRevision !== operationRevision) {
      throw new Error("Diary protection removal changed before native cleanup acknowledgement");
    }
    const priorAttempts =
      "attemptCount" in current.nativeCleanup
        ? current.nativeCleanup.attemptCount
        : 0;
    const next: JournalSecurityRemovalIntent = {
      ...current,
      updatedAt: Date.now(),
      phase: "cleanup-pending",
      nativeCleanup:
        outcome === "complete" || outcome === "not-applicable"
          ? { status: outcome }
          : { status: outcome, attemptCount: priorAttempts + 1 },
    };
    if (removalCleanupComplete(next)) {
      await db.settings.delete(SK.JOURNAL_SECURITY_REMOVAL);
    } else {
      await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: next });
    }
  });
  emitMigrationUpdate();
}

export async function ensureJournalSecurityMigrationQueued(
  suppliedIntent?: JournalSecurityMigrationIntent
): Promise<boolean> {
  const intent = suppliedIntent ?? (await getJournalSecurityMigrationIntent());
  if (!intent) return false;
  await validateSyncOwner(intent.ownerUserId, "Diary protection migration enqueue");
  await offlineQueue.enqueue(
    "MIGRATE_JOURNAL_SECURITY",
    `journal-security:${intent.revision}`,
    { revision: intent.revision },
    {
      expectedOwnerUserId: intent.ownerUserId,
      priority: "critical",
      maxRetries: 5,
    }
  );
  // The durable intent predates enqueue. If the queue starts immediately it
  // may already have advanced or completed the migration, so update only the
  // latest still-present revision and never overwrite step acknowledgements.
  const current = await getJournalSecurityMigrationIntent();
  if (current?.revision === intent.revision) {
    await persistIntent({ ...current, status: "queued", lastError: undefined }, current.revision);
  }
  return true;
}

function revisionFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const revision = (payload as { revision?: unknown }).revision;
  return typeof revision === "string" && revision.length > 0 ? revision : null;
}

function isRemovalPayload(payload: unknown): boolean {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as { mode?: unknown }).mode === "remove"
  );
}

async function loadCurrentRemovalIntent(
  payload: unknown,
  ownerUserId: string
): Promise<JournalSecurityRemovalIntent> {
  const revision = revisionFromPayload(payload);
  const intent = await getJournalSecurityRemovalIntent();
  if (!revision || !intent || intent.revision !== revision || intent.ownerUserId !== ownerUserId) {
    throw new Error(
      "Diary protection removal intent is missing or belongs to another account"
    );
  }
  return intent;
}

async function runJournalSecurityRemoval(
  payload: unknown,
  ownerUserId: string
): Promise<void> {
  let intent = await loadCurrentRemovalIntent(payload, ownerUserId);
  await validateSyncOwner(ownerUserId, "Diary protection removal backup");
  await runWithJournalSecurityWriteLock(async () => {
    await validateSyncOwner(ownerUserId, "Diary protection removal local preflight");
    await loadCurrentRemovalIntent(payload, ownerUserId);
    const [passwordRecord, vaultRecord] = await Promise.all([
      db.settings.get(JOURNAL_PASSWORD_KEY),
      db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
    ]);
    if (passwordRecord?.value || vaultRecord?.value) {
      throw new Error(
        "Diary protection was re-enabled before cloud removal completed"
      );
    }
  });

  const saveCloudProgress = async (
    next: JournalSecurityRemovalIntent
  ): Promise<JournalSecurityRemovalIntent> => {
    const persisted: JournalSecurityRemovalIntent = {
      ...next,
      updatedAt: Date.now(),
      phase: "cleanup-pending",
      status: "queued",
      cloudCleanup: {
        ...next.cloudCleanup,
        status: "pending",
        blocker: undefined,
      },
      photos: next.cloudCleanup.photos,
      audios: next.cloudCleanup.audios,
    };
    await persistRemovalIntent(persisted, intent.operationRevision);
    intent = persisted;
    return persisted;
  };

  const acknowledgeCloudCompletion = async (): Promise<void> => {
    const completed: JournalSecurityRemovalIntent = {
      ...intent,
      updatedAt: Date.now(),
      cloudCleanup: {
        ...intent.cloudCleanup,
        status: "complete",
        stage: "complete",
        entryIds: [],
        backupPending: false,
        blocker: undefined,
      },
      photos: intent.cloudCleanup.photos,
      audios: intent.cloudCleanup.audios,
    };
    await persistRemovalIntent(
      removalCleanupComplete(completed) ? null : completed,
      intent.operationRevision,
    );
  };

  for (const entryId of [...intent.cloudCleanup.entryIds]) {
    const entry = await db.journalEntries.get(entryId);
    if (!entry || (entry.content && isEncryptedJournalContent(entry.content))) {
      throw new Error("Plaintext diary entry is unavailable for remote acknowledgement");
    }
    await syncJournalEntry(entry, {
      expectedOwnerUserId: ownerUserId,
      requireRemoteCommit: true,
    });
    await saveCloudProgress({
      ...intent,
      cloudCleanup: {
        ...intent.cloudCleanup,
        stage: "entries",
        entryIds: intent.cloudCleanup.entryIds.filter((id) => id !== entryId),
      },
    });
  }

  for (const photoProgress of [...intent.cloudCleanup.photos]) {
    let progress = intent.cloudCleanup.photos.find(({ id }) => id === photoProgress.id);
    let photo = await db.journalPhotos.get(photoProgress.id);
    if (!progress || !photo?.data || isEncryptedJournalMediaData(photo.data)) {
      throw new Error("Plaintext diary photo is unavailable for remote acknowledgement");
    }
    if (!progress.replacementUploaded) {
      const upload = await uploadPhoto(photo.id, photo.data, ownerUserId);
      if (!upload) throw new Error("Plaintext diary photo upload was not acknowledged");
      await validateSyncOwner(ownerUserId, "Diary protection photo replacement");
      await db.journalPhotos.update(photo.id, {
        storagePath: upload.path,
        storageUrl: undefined,
      });
      progress = {
        ...progress,
        replacementUploaded: true,
        replacementStoragePath: upload.path,
      };
      await saveCloudProgress({
        ...intent,
        cloudCleanup: {
          ...intent.cloudCleanup,
          stage: "photos",
          photos: intent.cloudCleanup.photos.map((item) =>
            item.id === progress!.id ? progress! : item
          ),
        },
      });
      photo = await db.journalPhotos.get(photo.id);
    }
    if (!photo || !progress.replacementStoragePath) {
      throw new Error("Plaintext diary photo replacement state is unavailable");
    }
    if (!progress.metadataCommitted) {
      await syncJournalPhoto(
        { ...photo, storagePath: progress.replacementStoragePath },
        { expectedOwnerUserId: ownerUserId, requireRemoteCommit: true }
      );
      progress = { ...progress, metadataCommitted: true };
      await saveCloudProgress({
        ...intent,
        cloudCleanup: {
          ...intent.cloudCleanup,
          stage: "photos",
          photos: intent.cloudCleanup.photos.map((item) =>
            item.id === progress!.id ? progress! : item
          ),
        },
      });
    }
    if (!progress.previousBlobDeleted) {
      await validateSyncOwner(ownerUserId, "Diary protection removal photo cleanup");
      if (
        progress.previousStoragePath &&
        progress.previousStoragePath !== progress.replacementStoragePath
      ) {
        await deleteJournalMediaStoragePath(
          "journal-photos",
          progress.previousStoragePath,
          ownerUserId
        );
      }
      progress = { ...progress, previousBlobDeleted: true };
      await saveCloudProgress({
        ...intent,
        cloudCleanup: {
          ...intent.cloudCleanup,
          stage: "photos",
          photos: intent.cloudCleanup.photos.map((item) =>
            item.id === progress!.id ? progress! : item
          ),
        },
      });
    }
  }

  for (const audioProgress of [...intent.cloudCleanup.audios]) {
    let progress = intent.cloudCleanup.audios.find(({ id }) => id === audioProgress.id);
    let audio = await db.journalAudio.get(audioProgress.id);
    if (!progress || !audio?.data || isEncryptedJournalMediaData(audio.data)) {
      throw new Error("Plaintext diary audio is unavailable for remote acknowledgement");
    }
    if (!progress.replacementUploaded) {
      const upload = await uploadAudio(
        audio.id,
        audio.data,
        audio.mimeType,
        ownerUserId
      );
      if (!upload) throw new Error("Plaintext diary audio upload was not acknowledged");
      await validateSyncOwner(ownerUserId, "Diary protection audio replacement");
      await db.journalAudio.update(audio.id, {
        storagePath: upload.path,
        storageUrl: undefined,
      });
      progress = {
        ...progress,
        replacementUploaded: true,
        replacementStoragePath: upload.path,
      };
      await saveCloudProgress({
        ...intent,
        cloudCleanup: {
          ...intent.cloudCleanup,
          stage: "audio",
          audios: intent.cloudCleanup.audios.map((item) =>
            item.id === progress!.id ? progress! : item
          ),
        },
      });
      audio = await db.journalAudio.get(audio.id);
    }
    if (!audio || !progress.replacementStoragePath) {
      throw new Error("Plaintext diary audio replacement state is unavailable");
    }
    if (!progress.metadataCommitted) {
      await syncJournalAudio(
        { ...audio, storagePath: progress.replacementStoragePath },
        { expectedOwnerUserId: ownerUserId, requireRemoteCommit: true }
      );
      progress = { ...progress, metadataCommitted: true };
      await saveCloudProgress({
        ...intent,
        cloudCleanup: {
          ...intent.cloudCleanup,
          stage: "audio",
          audios: intent.cloudCleanup.audios.map((item) =>
            item.id === progress!.id ? progress! : item
          ),
        },
      });
    }
    if (!progress.previousBlobDeleted) {
      await validateSyncOwner(ownerUserId, "Diary protection removal audio cleanup");
      if (
        progress.previousStoragePath &&
        progress.previousStoragePath !== progress.replacementStoragePath
      ) {
        await deleteJournalMediaStoragePath(
          "journal-audio",
          progress.previousStoragePath,
          ownerUserId
        );
      }
      progress = { ...progress, previousBlobDeleted: true };
      await saveCloudProgress({
        ...intent,
        cloudCleanup: {
          ...intent.cloudCleanup,
          stage: "audio",
          audios: intent.cloudCleanup.audios.map((item) =>
            item.id === progress!.id ? progress! : item
          ),
        },
      });
    }
  }

  await patchJournalBackupForPasswordRemoval({
    expectedOwnerUserId: ownerUserId,
    operationRevision: intent.operationRevision,
  });
  await saveCloudProgress({
    ...intent,
    cloudCleanup: {
      ...intent.cloudCleanup,
      stage: "verify-protected-objects",
      backupPending: false,
    },
  });
  await verifyRemoteJournalIsUnprotected({
    expectedOwnerUserId: ownerUserId,
    operationRevision: intent.operationRevision,
  });
  await saveCloudProgress({
    ...intent,
    cloudCleanup: { ...intent.cloudCleanup, stage: "delete-vault" },
  });

  await validateSyncOwner(ownerUserId, "Diary protection removal vault delete");
  await runWithJournalSecurityWriteLock(async () => {
    await validateSyncOwner(ownerUserId, "Diary protection removal delete preflight");
    const current = await loadCurrentRemovalIntent(payload, ownerUserId);
    const [passwordRecord, vaultRecord] = await Promise.all([
      db.settings.get(JOURNAL_PASSWORD_KEY),
      db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
    ]);
    if (passwordRecord?.value || vaultRecord?.value) {
      throw new Error(
        "Diary protection was re-enabled before cloud removal completed"
      );
    }
    if (current.revision !== intent.revision) {
      throw new Error("Diary protection removal changed during cloud completion");
    }
  });
  await finalizeRemoteJournalPasswordRemoval({
    expectedOwnerUserId: ownerUserId,
    expectedVaultRevision: intent.expectedVaultRevision,
    operationRevision: intent.operationRevision,
  });
  await acknowledgeCloudCompletion();
}

async function loadCurrentIntent(
  payload: unknown,
  ownerUserId: string
): Promise<JournalSecurityMigrationIntent> {
  const revision = revisionFromPayload(payload);
  const intent = await getJournalSecurityMigrationIntent();
  if (!revision || !intent || intent.revision !== revision || intent.ownerUserId !== ownerUserId) {
    throw new Error("Diary protection migration intent is missing or belongs to another account");
  }
  return intent;
}

async function saveProgress(intent: JournalSecurityMigrationIntent): Promise<void> {
  const complete = isJournalSecurityMigrationComplete(intent);
  await persistIntent(complete ? null : intent, intent.revision);
}

async function runJournalSecurityMigrationLocalStepsUnlocked(
  payload: unknown,
  ownerUserId: string
): Promise<void> {
  let intent = await loadCurrentIntent(payload, ownerUserId);
  await validateSyncOwner(ownerUserId, "Diary protection migration");

  if (intent.vaultSettingPending) {
    const vaultRecord = await db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY);
    if (!vaultRecord?.value) throw new Error("Wrapped diary key is missing");
    await syncSetting(
      JOURNAL_VAULT_KEY_SETTING_KEY,
      vaultRecord.value,
      ownerUserId,
      { requireRemoteCommit: true }
    );
    intent = { ...intent, vaultSettingPending: false };
    await saveProgress(intent);
  }

  for (const entryId of [...intent.entryIds]) {
    const entry = await db.journalEntries.get(entryId);
    if (!entry || !entry.content || !isEncryptedJournalContent(entry.content)) {
      throw new Error(`Encrypted diary entry is unavailable: ${entryId}`);
    }
    await syncJournalEntry(entry, ownerUserId);
    intent = { ...intent, entryIds: intent.entryIds.filter((id) => id !== entryId) };
    await saveProgress(intent);
  }

  for (const mediaIntent of [...intent.photos]) {
    const photo = await db.journalPhotos.get(mediaIntent.id);
    if (!photo?.data || !isEncryptedJournalMediaData(photo.data)) {
      throw new Error(`Encrypted diary photo is unavailable: ${mediaIntent.id}`);
    }
    const photoVaultRevision = storedVaultRevision(photo.vaultRevision);
    if (photoVaultRevision === null) {
      throw new Error(`Encrypted diary photo epoch is unavailable: ${mediaIntent.id}`);
    }
    const upload = await uploadEncryptedPhoto(
      photo.id,
      encryptedJournalMediaToStorageBlob(photo.data),
      ownerUserId,
      photoVaultRevision,
    );
    if (!upload) throw new Error(`Encrypted diary photo upload failed: ${photo.id}`);
    await validateSyncOwner(ownerUserId, "Diary photo migration commit");
    await syncJournalPhoto(
      { ...photo, storagePath: upload.path },
      { expectedOwnerUserId: ownerUserId, requireRemoteCommit: true },
    );
    await validateSyncOwner(ownerUserId, "Diary photo migration local commit");
    await db.journalPhotos.update(photo.id, { storagePath: upload.path });
    if (mediaIntent.previousStoragePath && mediaIntent.previousStoragePath !== upload.path) {
      await deleteJournalMediaStoragePath(
        "journal-photos",
        mediaIntent.previousStoragePath,
        ownerUserId
      );
    }
    intent = { ...intent, photos: intent.photos.filter(({ id }) => id !== photo.id) };
    await saveProgress(intent);
  }

  for (const mediaIntent of [...intent.audios]) {
    const audio = await db.journalAudio.get(mediaIntent.id);
    if (!audio?.data || !isEncryptedJournalMediaData(audio.data)) {
      throw new Error(`Encrypted diary audio is unavailable: ${mediaIntent.id}`);
    }
    const audioVaultRevision = storedVaultRevision(audio.vaultRevision);
    if (audioVaultRevision === null) {
      throw new Error(`Encrypted diary audio epoch is unavailable: ${mediaIntent.id}`);
    }
    const upload = await uploadEncryptedAudio(
      audio.id,
      encryptedJournalMediaToStorageBlob(audio.data),
      ownerUserId,
      audioVaultRevision,
    );
    if (!upload) throw new Error(`Encrypted diary audio upload failed: ${audio.id}`);
    await validateSyncOwner(ownerUserId, "Diary audio migration commit");
    await syncJournalAudio(
      { ...audio, storagePath: upload.path },
      { expectedOwnerUserId: ownerUserId, requireRemoteCommit: true },
    );
    await validateSyncOwner(ownerUserId, "Diary audio migration local commit");
    await db.journalAudio.update(audio.id, { storagePath: upload.path });
    if (mediaIntent.previousStoragePath && mediaIntent.previousStoragePath !== upload.path) {
      await deleteJournalMediaStoragePath(
        "journal-audio",
        mediaIntent.previousStoragePath,
        ownerUserId
      );
    }
    intent = { ...intent, audios: intent.audios.filter(({ id }) => id !== audio.id) };
    await saveProgress(intent);
  }
}

export async function runJournalSecurityMigration(
  payload: unknown,
  ownerUserId: string
): Promise<void> {
  if (isRemovalPayload(payload)) {
    await runJournalSecurityRemoval(payload, ownerUserId);
    return;
  }
  await runWithJournalSecurityWriteLock(() =>
    runJournalSecurityMigrationLocalStepsUnlocked(payload, ownerUserId)
  );

  const intent = await loadCurrentIntent(payload, ownerUserId);
  if (!intent.backupPending) return;
  await validateSyncOwner(ownerUserId, "Diary protection backup migration");
  if (!getJournalContentVaultKey()) {
    throw new Error("Unlock the diary to replace its online backup safely");
  }

  // Backup merge may import protected diary rows and therefore acquire the
  // journal write lock itself. Run it after releasing the local migration lock.
  const { syncWithCloud } = await import("@/storage/cloudSync");
  const result = await syncWithCloud("merge", ownerUserId);
  if (result.status === "aborted") {
    throw new Error("Diary backup migration was interrupted");
  }

  await runWithJournalSecurityWriteLock(async () => {
    const current = await loadCurrentIntent(payload, ownerUserId);
    await validateSyncOwner(ownerUserId, "Diary protection backup commit");
    if (current.backupPending) {
      await saveProgress({ ...current, backupPending: false });
    }
  });
}
