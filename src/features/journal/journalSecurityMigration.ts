import Dexie from "dexie";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { offlineQueue } from "@/lib/offlineQueue";
import { logger } from "@/lib/logger";
import { generateSecureRandom } from "@/lib/validation";
import { SK } from "@/lib/storageKeys";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import { clearNativeJournalBiometricCredential } from "@/lib/journalBiometricCredentials";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { syncSetting } from "@/storage/sync/syncSettings";
import { syncJournalAudio, syncJournalEntry, syncJournalPhoto } from "@/storage/realtimeSync";
import {
  deleteJournalMediaStoragePath,
  downloadAsBase64,
  prepareAudioForPasswordRemovalUpload,
  preparePhotoForPasswordRemovalUpload,
  readJournalMediaStorageIdentity,
  uploadEncryptedAudio,
  uploadEncryptedPhoto,
  uploadPreparedJournalPasswordRemovalMedia,
  type JournalPasswordRemovalPreparedUpload,
} from "@/storage/journalStorageService";
import {
  abortRemoteJournalPasswordRemoval,
  beginRemoteJournalPasswordRemoval,
  commitRemoteJournalPasswordRemovalAudio,
  commitRemoteJournalPasswordRemovalEntry,
  commitRemoteJournalPasswordRemovalPhoto,
  deleteRemoteJournalPasswordRemovalArtifact,
  finalizeRemoteJournalPasswordRemoval,
  patchJournalBackupForPasswordRemoval,
  recoverRemoteJournalPasswordRemoval,
  reserveRemoteJournalPasswordRemovalMedia,
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
import { normalizeJournalAudioMimeType } from "./journalAudioValidation";
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
  isDataWriteBarrierPostCommitError,
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
import {
  journalInventorySecurityProjection,
  journalInventorySha256,
  type JournalInventorySecurityProjectionKind,
} from "./journalRemovalInventory";

export {
  canonicalJournalInventoryJson,
  journalInventorySecurityProjection,
  journalInventorySha256,
} from "./journalRemovalInventory";

export const JOURNAL_SECURITY_MIGRATION_EVENT = "zenflow:journal-security-migration-updated";

interface JournalSecurityMediaIntent {
  id: string;
  entryId?: string;
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
  replacementContentSha256?: string;
  replacementContentSize?: number;
  replacementMimeType?: string;
  replacementUploaded: boolean;
  metadataCommitted: boolean;
  previousBlobDeleted: boolean;
}

export interface JournalDeletedMediaCleanupItem {
  id: string;
  entryId: string;
  storagePaths: string[];
}

export interface JournalDeletedEntryCleanupItem {
  id: string;
  photoStoragePaths: string[];
  audioStoragePaths: string[];
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
  deletedEntries: JournalDeletedEntryCleanupItem[];
  deletedPhotos: JournalDeletedMediaCleanupItem[];
  deletedAudios: JournalDeletedMediaCleanupItem[];
  backupPending: boolean;
  attemptCount: number;
  maxRetries?: number;
  blocker?: "offline" | "remote-state-changed" | "remote-protected-data" | "storage-failed";
}

export interface JournalLocalCommitInventory {
  version: 1;
  entryIds: string[];
  photoIds: string[];
  audioIds: string[];
  spaceIds: string[];
  captureIds: string[];
  deletedEntryIds?: string[];
  deletedPhotoIds?: string[];
  deletedAudioIds?: string[];
  /** Exact plaintext backup projections produced by the atomic local commit. */
  postimages?: JournalLocalCommitPostimages;
}

export interface JournalLocalCommitPostimageReceipt {
  id: string;
  postimageBackupSha256: string;
}

export interface JournalLocalCommitPostimages {
  entries: JournalLocalCommitPostimageReceipt[];
  photos: JournalLocalCommitPostimageReceipt[];
  audios: JournalLocalCommitPostimageReceipt[];
  spaces: JournalLocalCommitPostimageReceipt[];
  captures: JournalLocalCommitPostimageReceipt[];
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
    | "abort-pending"
    | "blocked"
    | "remote-recovery"
    | "local-committed"
    | "cleanup-pending";
  blocker?: JournalProtectionBlockerCode;
  attemptCount: number;
  nativeCleanup: NativeCredentialCleanupState;
  cloudCleanup: JournalCloudCleanupState;
  /** Privacy-safe membership receipt written in the same local commit. */
  localCommitInventory?: JournalLocalCommitInventory;
  /** Compatibility status retained while the offline queue reads v1-shaped fields. */
  status: "pending" | "queued" | "enqueue-failed";
  lastError?: JournalSecurityDiagnosticCode;
  /** Set only when a supported version-1 marker is normalized for safe adoption. */
  legacyOrigin?: true;
  /** Durable proof that the one-time server recovery probe already ran. */
  legacyRecoveryChecked?: true;
  /** Cursor and exact storage identities make legacy adoption slice-resumable. */
  legacyMediaCursor?: number;
  legacyStorageObjects?: JournalMediaStorageIdentity[];
  /** Compatibility mirrors; v2 authority is cloudCleanup. */
  photos: JournalMediaCleanupItem[];
  audios: JournalMediaCleanupItem[];
}

const LOCAL_INSTALLATION_REMOVAL_OWNER = "installation-local";
// Keep preflight media decryption sequential so mobile WebViews do not retain
// several large blobs and encoded copies at once.
const JOURNAL_REMOVAL_PREFLIGHT_BATCH_SIZE = 1;
const JOURNAL_PASSWORD_REMOVAL_STAGE_TTL_MS = 30 * 60 * 1000;
const JOURNAL_PASSWORD_REMOVAL_OPERATION_LOCK = "zenflow:journal-password-removal-operation";

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
  boundary: JournalSecurityBoundary
): boolean {
  if (intent.ownerUserId === LOCAL_INSTALLATION_REMOVAL_OWNER) {
    return boundary.sessionOwnerUserId === null && boundary.localOwnerUserId === null;
  }
  return (
    boundary.sessionOwnerUserId === intent.ownerUserId &&
    boundary.localOwnerUserId === intent.ownerUserId
  );
}

/**
 * An authenticated account can establish the exact removal operation while an
 * owner-null local realm is still awaiting adoption. Active pre-commit
 * settlement may safely restore that account's remote fence; background
 * cleanup continues to use the stricter fully-adopted boundary above.
 */
function journalSecurityRemovalAttemptMatchesBoundary(
  intent: Pick<JournalSecurityRemovalIntent, "ownerUserId">,
  boundary: JournalSecurityBoundary
): boolean {
  if (intent.ownerUserId === LOCAL_INSTALLATION_REMOVAL_OWNER) {
    return boundary.sessionOwnerUserId === null && boundary.localOwnerUserId === null;
  }
  return (
    boundary.sessionOwnerUserId === intent.ownerUserId &&
    (boundary.localOwnerUserId === intent.ownerUserId || boundary.localOwnerUserId === null)
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
  intent: JournalSecurityMigrationIntent
): JournalSecurityMigrationIntent {
  return {
    ...intent,
    lastError: normalizeJournalSecurityDiagnosticCode(intent.lastError),
  };
}

function isRemovalIntentV1(value: unknown): value is JournalSecurityRemovalIntentV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<JournalSecurityRemovalIntentV1>;
  return (
    candidate.version === 1 &&
    isNonEmptyString(candidate.revision) &&
    isNonEmptyString(candidate.ownerUserId) &&
    isNonNegativeSafeInteger(candidate.createdAt) &&
    (candidate.photos === undefined ||
      (Array.isArray(candidate.photos) &&
        candidate.photos.every(isJournalSecurityMediaIntent) &&
        new Set(candidate.photos.map((item) => item.id)).size === candidate.photos.length)) &&
    (candidate.audios === undefined ||
      (Array.isArray(candidate.audios) &&
        candidate.audios.every(isJournalSecurityMediaIntent) &&
        new Set(candidate.audios.map((item) => item.id)).size === candidate.audios.length)) &&
    (candidate.status === "pending" ||
      candidate.status === "queued" ||
      candidate.status === "enqueue-failed")
  );
}

const JOURNAL_PROTECTION_BLOCKER_CODES = new Set<JournalProtectionBlockerCode>([
  "unlock-required",
  "activation-pending",
  "removal-pending",
  "vault-revision-mismatch",
  "decrypt-entry",
  "decrypt-media",
  "decrypt-draft",
  "decrypt-space",
  "decrypt-capture",
  "owner-adoption-pending",
  "owner-changed",
  "fresh-auth-required",
  "storage-failed",
]);
const JOURNAL_CLOUD_CLEANUP_BLOCKERS = new Set<NonNullable<JournalCloudCleanupState["blocker"]>>([
  "offline",
  "remote-state-changed",
  "remote-protected-data",
  "storage-failed",
]);

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isJournalSecurityMediaIntent(value: unknown): value is JournalSecurityMediaIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<JournalSecurityMediaIntent>;
  return (
    isNonEmptyString(candidate.id) &&
    (candidate.entryId === undefined || isNonEmptyString(candidate.entryId)) &&
    (candidate.previousStoragePath === undefined || isNonEmptyString(candidate.previousStoragePath))
  );
}

function isJournalMediaCleanupItem(value: unknown): value is JournalMediaCleanupItem {
  if (!isJournalSecurityMediaIntent(value)) return false;
  const candidate = value as Partial<JournalMediaCleanupItem>;
  const receiptFields = [
    candidate.replacementStoragePath,
    candidate.replacementContentSha256,
    candidate.replacementContentSize,
    candidate.replacementMimeType,
  ];
  const definedReceiptFields = receiptFields.filter((field) => field !== undefined).length;
  const hasExactReceipt =
    definedReceiptFields === 4 &&
    isNonEmptyString(candidate.replacementStoragePath) &&
    typeof candidate.replacementContentSha256 === "string" &&
    /^[0-9a-f]{64}$/.test(candidate.replacementContentSha256) &&
    isNonNegativeSafeInteger(candidate.replacementContentSize) &&
    candidate.replacementContentSize > 0 &&
    isNonEmptyString(candidate.replacementMimeType);
  return (
    (definedReceiptFields === 0 || hasExactReceipt) &&
    (candidate.replacementStoragePath === undefined ||
      isNonEmptyString(candidate.replacementStoragePath)) &&
    typeof candidate.replacementUploaded === "boolean" &&
    typeof candidate.metadataCommitted === "boolean" &&
    typeof candidate.previousBlobDeleted === "boolean" &&
    (!candidate.replacementUploaded || hasExactReceipt) &&
    (!candidate.metadataCommitted || candidate.replacementUploaded) &&
    (!candidate.previousBlobDeleted || candidate.metadataCommitted)
  );
}

function hasUniqueNonEmptyStrings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every(isNonEmptyString) && new Set(value).size === value.length
  );
}

function hasUniqueMediaCleanupItems(value: unknown): value is JournalMediaCleanupItem[] {
  return (
    Array.isArray(value) &&
    value.every(isJournalMediaCleanupItem) &&
    new Set(value.map((item) => item.id)).size === value.length
  );
}

function isUniqueStoragePathList(value: unknown): value is string[] {
  return hasUniqueNonEmptyStrings(value);
}

function hasUniqueDeletedEntryCleanupItems(
  value: unknown
): value is JournalDeletedEntryCleanupItem[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const candidate = item as Partial<JournalDeletedEntryCleanupItem>;
      return (
        isNonEmptyString(candidate.id) &&
        isUniqueStoragePathList(candidate.photoStoragePaths) &&
        isUniqueStoragePathList(candidate.audioStoragePaths)
      );
    }) &&
    new Set(value.map((item) => item.id)).size === value.length
  );
}

function hasUniqueDeletedMediaCleanupItems(
  value: unknown
): value is JournalDeletedMediaCleanupItem[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const candidate = item as Partial<JournalDeletedMediaCleanupItem>;
      return (
        isNonEmptyString(candidate.id) &&
        isNonEmptyString(candidate.entryId) &&
        isUniqueStoragePathList(candidate.storagePaths)
      );
    }) &&
    new Set(value.map((item) => item.id)).size === value.length
  );
}

function hasUniquePostimageReceipts(
  value: unknown
): value is JournalLocalCommitPostimageReceipt[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const candidate = item as Partial<JournalLocalCommitPostimageReceipt>;
      return (
        isNonEmptyString(candidate.id) &&
        typeof candidate.postimageBackupSha256 === "string" &&
        /^[0-9a-f]{64}$/.test(candidate.postimageBackupSha256)
      );
    }) &&
    new Set(value.map((item) => item.id)).size === value.length
  );
}

function isJournalLocalCommitPostimages(value: unknown): value is JournalLocalCommitPostimages {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<JournalLocalCommitPostimages>;
  return (
    hasUniquePostimageReceipts(candidate.entries) &&
    hasUniquePostimageReceipts(candidate.photos) &&
    hasUniquePostimageReceipts(candidate.audios) &&
    hasUniquePostimageReceipts(candidate.spaces) &&
    hasUniquePostimageReceipts(candidate.captures)
  );
}

function isJournalLocalCommitInventory(value: unknown): value is JournalLocalCommitInventory {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<JournalLocalCommitInventory>;
  return (
    candidate.version === 1 &&
    hasUniqueNonEmptyStrings(candidate.entryIds) &&
    hasUniqueNonEmptyStrings(candidate.photoIds) &&
    hasUniqueNonEmptyStrings(candidate.audioIds) &&
    hasUniqueNonEmptyStrings(candidate.spaceIds) &&
    hasUniqueNonEmptyStrings(candidate.captureIds) &&
    (candidate.deletedEntryIds === undefined ||
      hasUniqueNonEmptyStrings(candidate.deletedEntryIds)) &&
    (candidate.deletedPhotoIds === undefined ||
      hasUniqueNonEmptyStrings(candidate.deletedPhotoIds)) &&
    (candidate.deletedAudioIds === undefined ||
      hasUniqueNonEmptyStrings(candidate.deletedAudioIds)) &&
    (candidate.postimages === undefined || isJournalLocalCommitPostimages(candidate.postimages))
  );
}

function isJournalMediaStorageIdentity(value: unknown): value is JournalMediaStorageIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<JournalMediaStorageIdentity>;
  return (
    (candidate.bucket === "journal-photos" || candidate.bucket === "journal-audio") &&
    isNonEmptyString(candidate.path) &&
    isNonEmptyString(candidate.objectId) &&
    isNonEmptyString(candidate.version) &&
    (candidate.etag === null || isNonEmptyString(candidate.etag)) &&
    (candidate.size === null || isNonNegativeSafeInteger(candidate.size))
  );
}

function hasUniqueJournalMediaStorageIdentities(
  value: unknown
): value is JournalMediaStorageIdentity[] {
  return (
    Array.isArray(value) &&
    value.every(isJournalMediaStorageIdentity) &&
    new Set(value.map((identity) => `${identity.bucket}:${identity.path}`)).size === value.length
  );
}

function legacyMediaDescriptors(
  intent: Pick<JournalSecurityRemovalIntent, "photos" | "audios">
): Array<{ bucket: JournalMediaStorageIdentity["bucket"]; path: string }> {
  return [
    ...intent.photos.flatMap((media) =>
      media.previousStoragePath
        ? [{ bucket: "journal-photos" as const, path: media.previousStoragePath }]
        : []
    ),
    ...intent.audios.flatMap((media) =>
      media.previousStoragePath
        ? [{ bucket: "journal-audio" as const, path: media.previousStoragePath }]
        : []
    ),
  ];
}

function hasValidLegacyAdoptionProgress(candidate: Partial<JournalSecurityRemovalIntent>): boolean {
  if (candidate.legacyOrigin !== true) {
    return (
      candidate.legacyRecoveryChecked === undefined &&
      candidate.legacyMediaCursor === undefined &&
      candidate.legacyStorageObjects === undefined
    );
  }
  if (
    (candidate.legacyRecoveryChecked !== undefined && candidate.legacyRecoveryChecked !== true) ||
    (candidate.legacyMediaCursor !== undefined &&
      !isNonNegativeSafeInteger(candidate.legacyMediaCursor)) ||
    (candidate.legacyStorageObjects !== undefined &&
      !hasUniqueJournalMediaStorageIdentities(candidate.legacyStorageObjects))
  ) {
    return false;
  }
  const cursor = candidate.legacyMediaCursor ?? 0;
  const identities = candidate.legacyStorageObjects ?? [];
  const descriptors = legacyMediaDescriptors({
    photos: candidate.photos ?? [],
    audios: candidate.audios ?? [],
  });
  return (
    cursor === identities.length &&
    cursor <= descriptors.length &&
    (cursor === 0 || candidate.legacyRecoveryChecked === true) &&
    identities.every(
      (identity, index) =>
        identity.bucket === descriptors[index]?.bucket && identity.path === descriptors[index]?.path
    )
  );
}

function isNativeCredentialCleanupState(value: unknown): value is NativeCredentialCleanupState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<NativeCredentialCleanupState>;
  if (
    candidate.status === "not-started" ||
    candidate.status === "not-applicable" ||
    candidate.status === "complete"
  ) {
    return true;
  }
  return (
    (candidate.status === "pending" ||
      candidate.status === "failed" ||
      candidate.status === "owner-changed") &&
    isNonNegativeSafeInteger(candidate.attemptCount)
  );
}

function isJournalCloudCleanupState(value: unknown): value is JournalCloudCleanupState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<JournalCloudCleanupState>;
  const validStatus =
    candidate.status === "not-started" ||
    candidate.status === "pending" ||
    candidate.status === "complete" ||
    candidate.status === "blocked";
  const validStage =
    candidate.stage === "entries" ||
    candidate.stage === "photos" ||
    candidate.stage === "audio" ||
    candidate.stage === "backup" ||
    candidate.stage === "verify-protected-objects" ||
    candidate.stage === "delete-vault" ||
    candidate.stage === "complete";
  const validBlocker =
    candidate.blocker === undefined ||
    (typeof candidate.blocker === "string" &&
      JOURNAL_CLOUD_CLEANUP_BLOCKERS.has(
        candidate.blocker
      ));
  const validMaxRetries =
    candidate.maxRetries === undefined ||
    (isNonNegativeSafeInteger(candidate.maxRetries) && candidate.maxRetries > 0);
  if (
    !validStatus ||
    !validStage ||
    !hasUniqueNonEmptyStrings(candidate.entryIds) ||
    !hasUniqueMediaCleanupItems(candidate.photos) ||
    !hasUniqueMediaCleanupItems(candidate.audios) ||
    (candidate.deletedEntries !== undefined &&
      !hasUniqueDeletedEntryCleanupItems(candidate.deletedEntries)) ||
    (candidate.deletedPhotos !== undefined &&
      !hasUniqueDeletedMediaCleanupItems(candidate.deletedPhotos)) ||
    (candidate.deletedAudios !== undefined &&
      !hasUniqueDeletedMediaCleanupItems(candidate.deletedAudios)) ||
    typeof candidate.backupPending !== "boolean" ||
    !isNonNegativeSafeInteger(candidate.attemptCount) ||
    !validBlocker ||
    !validMaxRetries
  ) {
    return false;
  }
  if (candidate.status === "complete") {
    return (
      candidate.stage === "complete" &&
      candidate.entryIds.length === 0 &&
      candidate.photos.length === 0 &&
      candidate.audios.length === 0 &&
      (candidate.deletedEntries?.length ?? 0) === 0 &&
      (candidate.deletedPhotos?.length ?? 0) === 0 &&
      (candidate.deletedAudios?.length ?? 0) === 0 &&
      candidate.backupPending === false &&
      candidate.blocker === undefined
    );
  }
  if (candidate.status === "not-started") {
    return (
      candidate.stage === "entries" &&
      candidate.entryIds.length === 0 &&
      candidate.photos.length === 0 &&
      candidate.audios.length === 0 &&
      (candidate.deletedEntries?.length ?? 0) === 0 &&
      (candidate.deletedPhotos?.length ?? 0) === 0 &&
      (candidate.deletedAudios?.length ?? 0) === 0 &&
      candidate.backupPending === false
    );
  }
  return true;
}

function isRemovalIntentV2(value: unknown): value is JournalSecurityRemovalIntent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JournalSecurityRemovalIntent>;
  return (
    candidate.version === 2 &&
    isNonEmptyString(candidate.revision) &&
    candidate.operationRevision === candidate.revision &&
    isNonNegativeSafeInteger(candidate.expectedVaultRevision) &&
    isNonEmptyString(candidate.ownerUserId) &&
    isNonNegativeSafeInteger(candidate.createdAt) &&
    isNonNegativeSafeInteger(candidate.updatedAt) &&
    candidate.updatedAt >= candidate.createdAt &&
    isNonNegativeSafeInteger(candidate.attemptCount) &&
    isNativeCredentialCleanupState(candidate.nativeCleanup) &&
    isJournalCloudCleanupState(candidate.cloudCleanup) &&
    (candidate.localCommitInventory === undefined ||
      isJournalLocalCommitInventory(candidate.localCommitInventory)) &&
    hasUniqueMediaCleanupItems(candidate.photos) &&
    hasUniqueMediaCleanupItems(candidate.audios) &&
    structurallyEqual(candidate.photos, candidate.cloudCleanup.photos) &&
    structurallyEqual(candidate.audios, candidate.cloudCleanup.audios) &&
    (candidate.phase === "preflight-pending" ||
      candidate.phase === "remote-fenced" ||
      candidate.phase === "abort-pending" ||
      candidate.phase === "blocked" ||
      candidate.phase === "remote-recovery" ||
      candidate.phase === "local-committed" ||
      candidate.phase === "cleanup-pending") &&
    (candidate.status === "pending" ||
      candidate.status === "queued" ||
      candidate.status === "enqueue-failed") &&
      (candidate.blocker === undefined ||
      (typeof candidate.blocker === "string" &&
        JOURNAL_PROTECTION_BLOCKER_CODES.has(candidate.blocker))) &&
    (candidate.lastError === undefined ||
      normalizeJournalSecurityDiagnosticCode(candidate.lastError) !== undefined) &&
    (candidate.legacyOrigin === undefined || candidate.legacyOrigin === true) &&
    hasValidLegacyAdoptionProgress(candidate)
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

function journalRemovalPreparedUploadMatches(
  progress: JournalMediaCleanupItem,
  prepared: JournalPasswordRemovalPreparedUpload
): boolean {
  return (
    progress.replacementStoragePath === prepared.path &&
    progress.replacementContentSha256 === prepared.contentSha256 &&
    progress.replacementContentSize === prepared.contentSize &&
    progress.replacementMimeType === prepared.mimeType
  );
}

async function createLocalCommitInventory(snapshot: {
  entries: ReadonlyArray<{ id: string }>;
  photos: ReadonlyArray<{ id: string; postimageBackupSha256?: string }>;
  audios: ReadonlyArray<{ id: string; postimageBackupSha256?: string }>;
  spaces: ReadonlyArray<{ id: string }>;
  captures: ReadonlyArray<{ id: string }>;
}): Promise<JournalLocalCommitInventory> {
  const uniqueSortedIds = (items: ReadonlyArray<{ id: string }>): string[] =>
    [...new Set(items.map((item) => item.id))].sort();
  const postimages = async (
    kind: Extract<
      JournalInventorySecurityProjectionKind,
      "entry-backup" | "photo-backup" | "audio-backup" | "space-backup" | "capture-backup"
    >,
    items: ReadonlyArray<{ id: string; postimageBackupSha256?: string }>
  ): Promise<JournalLocalCommitPostimageReceipt[]> =>
    Promise.all(
      [...items]
        .sort((left, right) => compareCanonicalJournalInventoryKeys(left.id, right.id))
        .map(async (item) => ({
          id: item.id,
          postimageBackupSha256:
            item.postimageBackupSha256 ??
            (await journalInventorySha256(journalInventorySecurityProjection(kind, item))),
        }))
    );
  return {
    version: 1,
    entryIds: uniqueSortedIds(snapshot.entries),
    photoIds: uniqueSortedIds(snapshot.photos),
    audioIds: uniqueSortedIds(snapshot.audios),
    spaceIds: uniqueSortedIds(snapshot.spaces),
    captureIds: uniqueSortedIds(snapshot.captures),
    postimages: {
      entries: await postimages("entry-backup", snapshot.entries),
      photos: await postimages("photo-backup", snapshot.photos),
      audios: await postimages("audio-backup", snapshot.audios),
      spaces: await postimages("space-backup", snapshot.spaces),
      captures: await postimages("capture-backup", snapshot.captures),
    },
  };
}

function localSnapshotCoversCommitInventory(
  snapshot: Pick<
    LocalJournalProtectionSnapshot,
    "entries" | "photos" | "audios" | "spaces" | "captures"
  >,
  inventory: JournalLocalCommitInventory
): boolean {
  const covers = (expected: readonly string[], items: ReadonlyArray<{ id: string }>): boolean => {
    const current = new Set(items.map((item) => item.id));
    return expected.every((id) => current.has(id));
  };
  return (
    Boolean(inventory.postimages) &&
    covers(inventory.entryIds, snapshot.entries) &&
    covers(inventory.photoIds, snapshot.photos) &&
    covers(inventory.audioIds, snapshot.audios) &&
    covers(inventory.spaceIds, snapshot.spaces) &&
    covers(inventory.captureIds, snapshot.captures)
  );
}

function normalizeRemovalIntent(
  intent: JournalSecurityRemovalIntentV1 | JournalSecurityRemovalIntent,
  expectedVaultRevision: number
): JournalSecurityRemovalIntent {
  if (isRemovalIntentV2(intent)) {
    return {
      ...intent,
      cloudCleanup: {
        ...intent.cloudCleanup,
        deletedEntries: intent.cloudCleanup.deletedEntries ?? [],
        deletedPhotos: intent.cloudCleanup.deletedPhotos ?? [],
        deletedAudios: intent.cloudCleanup.deletedAudios ?? [],
      },
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
      deletedEntries: [],
      deletedPhotos: [],
      deletedAudios: [],
      backupPending: true,
      attemptCount: 0,
    },
    status: intent.status,
    lastError: normalizeJournalSecurityDiagnosticCode(intent.lastError),
    legacyOrigin: true,
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
  return isMigrationIntent(record?.value) ? normalizeMigrationIntent(record.value) : null;
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
  return normalizeRemovalIntent(record.value, storedVaultRevision(revisionRecord?.value) ?? 0);
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
  ownerUserId: string
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
  return normalizeRemovalIntent(record.value, 0).ownerUserId === LOCAL_INSTALLATION_REMOVAL_OWNER;
}

export type InstallationJournalRemovalRecoveryResult = "none" | "recovered" | "blocked";

/**
 * Settles a signed-out, installation-local removal before the first account
 * adopts an owner-null realm. This path never binds rows to the incoming
 * account, never touches remote data, and never deletes journal content.
 */
export async function recoverInstallationJournalSecurityRemovalBeforeAdoption(
  expectedSessionOwnerUserId: string
): Promise<InstallationJournalRemovalRecoveryResult> {
  if (!expectedSessionOwnerUserId) return "blocked";

  return runWithDataWriteBarrier(async () => {
    if (
      (await getCurrentSessionUserId()) !== expectedSessionOwnerUserId ||
      (await getLocalDataOwnerId()) !== null
    ) {
      return "blocked";
    }

    return runWithJournalSecurityWriteLock(async () => {
      if (
        (await getCurrentSessionUserId()) !== expectedSessionOwnerUserId ||
        (await getLocalDataOwnerId()) !== null
      ) {
        return "blocked";
      }

      const record = await db.settings.get(SK.JOURNAL_SECURITY_REMOVAL);
      if (!record) return "none";
      if (!isRemovalIntent(record.value)) return "blocked";
      const intent = normalizeRemovalIntent(record.value, 0);
      if (intent.ownerUserId !== LOCAL_INSTALLATION_REMOVAL_OWNER) return "none";

      if (intent.phase === "preflight-pending" || intent.phase === "blocked") {
        const localProtectionStillPresent =
          await readLocalJournalProtectionArtifactsWithoutBoundaryLock();
        if (
          !localProtectionStillPresent ||
          intent.cloudCleanup.status !== "not-started" ||
          intent.localCommitInventory !== undefined
        ) {
          return "blocked";
        }
        await clearJournalPasswordRemovalMediaStage(intent.operationRevision, intent.ownerUserId);
        await persistRemovalIntent(null, intent.operationRevision);
        return "recovered";
      }

      if (intent.phase === "local-committed" || intent.phase === "cleanup-pending") {
        if (
          intent.cloudCleanup.status !== "complete" ||
          (await readLocalJournalProtectionArtifactsWithoutBoundaryLock())
        ) {
          return "blocked";
        }
        try {
          await clearNativeJournalBiometricCredential();
        } catch {
          return "blocked";
        }
        if (
          (await getCurrentSessionUserId()) !== expectedSessionOwnerUserId ||
          (await getLocalDataOwnerId()) !== null
        ) {
          return "blocked";
        }
        await persistRemovalIntent(null, intent.operationRevision);
        return "recovered";
      }

      // A remote-fenced, abort-pending, or remote-recovery marker is
      // inconsistent with a signed-out local-only attempt. Preserve it for
      // explicit diagnosis rather than guessing that it can be cancelled.
      return "blocked";
    });
  });
}

export async function recordOrphanedRemoteJournalPasswordRemoval(
  input: {
    operationRevision: string;
    vaultRevision: number;
    remoteStatus: "abortable" | "manual-recovery-required" | "complete";
  },
  boundary: JournalSecurityBoundary
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
    if (localVaultRevision !== null && localVaultRevision > input.vaultRevision) {
      return "stale";
    }

    const cloudComplete = input.remoteStatus === "complete";
    const serverAbortable = input.remoteStatus === "abortable";
    const hasLocalProtection = localJournalSnapshotHasProtection(snapshot);
    const recoveryBlocker: JournalProtectionBlockerCode | undefined =
      hasLocalProtection && localVaultRevision !== null && localVaultRevision < input.vaultRevision
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
                ...emptyRemovalCloudCleanup(),
                status: "complete" as const,
                stage: "complete" as const,
                blocker: undefined,
              }
            : current.cloudCleanup
          : {
              ...emptyRemovalCloudCleanup(),
              status: cloudComplete ? ("complete" as const) : ("blocked" as const),
              stage: cloudComplete ? ("complete" as const) : ("verify-protected-objects" as const),
              blocker: cloudComplete ? undefined : ("remote-state-changed" as const),
            };
        const exactAbortCanResume = serverAbortable && hasLocalProtection && !localCleanupStarted;
        await persistRemovalIntent(
          {
            ...current,
            updatedAt: Date.now(),
            phase: localCleanupStarted
              ? current.phase
              : exactAbortCanResume
                ? "abort-pending"
                : "remote-recovery",
            blocker: localCleanupStarted
              ? current.blocker
              : exactAbortCanResume
                ? "storage-failed"
                : recoveryBlocker,
            cloudCleanup: exactAbortCanResume ? emptyRemovalCloudCleanup() : nextCloudCleanup,
            photos: exactAbortCanResume ? [] : nextCloudCleanup.photos,
            audios: exactAbortCanResume ? [] : nextCloudCleanup.audios,
          },
          current.operationRevision
        );
        return "recorded";
      }
      if (current.expectedVaultRevision > input.vaultRevision) return "stale";
      throw new Error("A different diary removal operation is already pending");
    }
    const now = Date.now();
    const exactAbortCanResume = serverAbortable && hasLocalProtection;
    await persistRemovalIntent({
      version: 2,
      revision: input.operationRevision,
      operationRevision: input.operationRevision,
      expectedVaultRevision: input.vaultRevision,
      ownerUserId,
      createdAt: now,
      updatedAt: now,
      phase: exactAbortCanResume ? "abort-pending" : "remote-recovery",
      blocker: exactAbortCanResume ? "storage-failed" : recoveryBlocker,
      attemptCount: 0,
      nativeCleanup: { status: "not-started" },
      cloudCleanup: exactAbortCanResume
        ? emptyRemovalCloudCleanup()
        : {
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
  boundary: JournalSecurityBoundary
): Promise<boolean> {
  return runWithJournalSecurityBoundary(boundary, async () => {
    return readLocalJournalProtectionArtifactsWithoutBoundaryLock();
  });
}

async function readLocalJournalProtectionArtifactsWithoutBoundaryLock(): Promise<boolean> {
  return localJournalSnapshotHasProtection(await readLocalJournalProtectionSnapshot());
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

function readLocalJournalVaultRevision(snapshot: LocalJournalProtectionSnapshot): number | null {
  const revisionRecord = snapshot.settings.find(
    (setting) => setting.key === SK.JOURNAL_VAULT_REVISION
  );
  const vaultRecord = snapshot.settings.find(
    (setting) => setting.key === JOURNAL_VAULT_KEY_SETTING_KEY
  );
  const persistedRevision = storedVaultRevision(revisionRecord?.value);
  const vaultRevision =
    vaultRecord?.value && typeof vaultRecord.value === "object"
      ? storedVaultRevision((vaultRecord.value as { updatedAt?: unknown }).updatedAt)
      : null;
  if (persistedRevision === null) return vaultRevision;
  if (vaultRevision === null) return persistedRevision;
  return Math.max(persistedRevision, vaultRevision);
}

function localJournalSnapshotHasProtection(snapshot: LocalJournalProtectionSnapshot): boolean {
  const { entries, photos, audios, settings, spaces, captures } = snapshot;
  const hasProtectionRecord = settings.some(
    (setting) =>
      (setting.key === JOURNAL_PASSWORD_KEY || setting.key === JOURNAL_VAULT_KEY_SETTING_KEY) &&
      setting.value !== null &&
      setting.value !== undefined
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
      (entry) => typeof entry.content === "string" && isEncryptedJournalContent(entry.content)
    ) ||
    photos.some(
      (photo) =>
        Boolean(photo.storagePath?.endsWith(".bin")) ||
        Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
        Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail))
    ) ||
    audios.some(
      (audio) =>
        Boolean(audio.storagePath?.endsWith(".bin")) ||
        Boolean(audio.data && isEncryptedJournalMediaData(audio.data))
    ) ||
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
            isEncryptedJournalContent(field.prompt) || isEncryptedJournalContent(field.value)
        )
    )
  );
}

function localJournalSnapshotIsFullyProtected(snapshot: LocalJournalProtectionSnapshot): boolean {
  const nonEmptyIsEncrypted = (value: string | undefined): boolean =>
    !value || isEncryptedJournalContent(value);
  return (
    snapshot.entries.every((entry) => nonEmptyIsEncrypted(entry.content)) &&
    snapshot.photos.every(
      (photo) =>
        (!photo.data || isEncryptedJournalMediaData(photo.data)) &&
        (!photo.thumbnail || isEncryptedJournalMediaData(photo.thumbnail))
    ) &&
    snapshot.audios.every((audio) => !audio.data || isEncryptedJournalMediaData(audio.data)) &&
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
      (space) => nonEmptyIsEncrypted(space.name) && nonEmptyIsEncrypted(space.description)
    ) &&
    snapshot.captures.every(
      (capture) =>
        nonEmptyIsEncrypted(capture.spaceName) &&
        nonEmptyIsEncrypted(capture.title) &&
        capture.fields.every(
          (field) => nonEmptyIsEncrypted(field.prompt) && nonEmptyIsEncrypted(field.value)
        )
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
  ownerUserId: string
): Promise<JournalSecurityMigrationIntent | null> {
  if (!ownerUserId) throw new Error("Diary protection adoption requires an owner");
  const boundary = await captureJournalSecurityBoundary();
  if (boundary.sessionOwnerUserId !== ownerUserId || boundary.localOwnerUserId !== ownerUserId) {
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
          (setting) => setting.key === SK.JOURNAL_SECURITY_MIGRATION
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

        const passwordRecord = settings.find((setting) => setting.key === JOURNAL_PASSWORD_KEY);
        const vaultRecord = settings.find(
          (setting) => setting.key === JOURNAL_VAULT_KEY_SETTING_KEY
        );
        const revisionRecord = settings.find(
          (setting) => setting.key === SK.JOURNAL_VAULT_REVISION
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
                typeof entry.content === "string" && isEncryptedJournalContent(entry.content)
            )
            .map((entry) => entry.id),
          photos: photos
            .filter(
              (photo) =>
                Boolean(photo.storagePath?.endsWith(".bin")) ||
                Boolean(photo.data && isEncryptedJournalMediaData(photo.data))
            )
            .map((photo) => ({ id: photo.id, previousStoragePath: photo.storagePath })),
          audios: audios
            .filter(
              (audio) =>
                Boolean(audio.storagePath?.endsWith(".bin")) ||
                Boolean(audio.data && isEncryptedJournalMediaData(audio.data))
            )
            .map((audio) => ({ id: audio.id, previousStoragePath: audio.storagePath })),
        };
        await db.settings.put({ key: SK.JOURNAL_SECURITY_MIGRATION, value: next });
        created = true;
        return next;
      }
    )
  );
  if (created) emitMigrationUpdate();
  return intent;
}

function isJournalSecurityMigrationComplete(intent: JournalSecurityMigrationIntent): boolean {
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
      storedVaultRevision(revisionRecord?.value) ?? 0
    );
    const removalHasLocalCommit =
      intent.phase === "local-committed" || intent.phase === "cleanup-pending";
    if (!removalHasLocalCommit) {
      return changed;
    }
    const frozenEntryIds = new Set([
      ...intent.cloudCleanup.entryIds,
      ...intent.cloudCleanup.deletedEntries.map(({ id }) => id),
      ...(intent.localCommitInventory?.entryIds ?? []),
      ...(intent.localCommitInventory?.deletedEntryIds ?? []),
    ]);
    const frozenPhotoIds = new Set([
      ...intent.cloudCleanup.photos.map(({ id }) => id),
      ...intent.cloudCleanup.deletedPhotos.map(({ id }) => id),
      ...(intent.localCommitInventory?.photoIds ?? []),
      ...(intent.localCommitInventory?.deletedPhotoIds ?? []),
    ]);
    const frozenAudioIds = new Set([
      ...intent.cloudCleanup.audios.map(({ id }) => id),
      ...intent.cloudCleanup.deletedAudios.map(({ id }) => id),
      ...(intent.localCommitInventory?.audioIds ?? []),
      ...(intent.localCommitInventory?.deletedAudioIds ?? []),
    ]);
    const removalEntryIds = new Set([...entryIds].filter((id) => frozenEntryIds.has(id)));
    const removalPhotoIds = new Set([...photoIds].filter((id) => frozenPhotoIds.has(id)));
    const removalAudioIds = new Set([...audioIds].filter((id) => frozenAudioIds.has(id)));
    if (removalEntryIds.size === 0 && removalPhotoIds.size === 0 && removalAudioIds.size === 0) {
      return changed;
    }
    const uniquePaths = (...paths: Array<string | undefined>): string[] =>
      [...new Set(paths.filter((path): path is string => Boolean(path)))].sort();
    const deletedEntryMap = new Map(
      intent.cloudCleanup.deletedEntries.map((item) => [item.id, item])
    );
    const deletedPhotoMap = new Map(
      intent.cloudCleanup.deletedPhotos.map((item) => [item.id, item])
    );
    const deletedAudioMap = new Map(
      intent.cloudCleanup.deletedAudios.map((item) => [item.id, item])
    );
    const photoProgressById = new Map(intent.cloudCleanup.photos.map((item) => [item.id, item]));
    const audioProgressById = new Map(intent.cloudCleanup.audios.map((item) => [item.id, item]));

    for (const entryId of removalEntryIds) {
      const entryPhotos = intent.cloudCleanup.photos.filter((item) => item.entryId === entryId);
      const entryAudios = intent.cloudCleanup.audios.filter((item) => item.entryId === entryId);
      for (const item of entryPhotos) removalPhotoIds.add(item.id);
      for (const item of entryAudios) removalAudioIds.add(item.id);
      const previous = deletedEntryMap.get(entryId);
      deletedEntryMap.set(entryId, {
        id: entryId,
        photoStoragePaths: uniquePaths(
          ...(previous?.photoStoragePaths ?? []),
          ...entryPhotos.flatMap((item) => [item.previousStoragePath, item.replacementStoragePath])
        ),
        audioStoragePaths: uniquePaths(
          ...(previous?.audioStoragePaths ?? []),
          ...entryAudios.flatMap((item) => [item.previousStoragePath, item.replacementStoragePath])
        ),
      });
    }

    for (const photoId of removalPhotoIds) {
      const progress = photoProgressById.get(photoId);
      if (!progress?.entryId) {
        throw new Error("Diary photo deletion cannot be bound to the active removal operation");
      }
      if (removalEntryIds.has(progress.entryId)) continue;
      const previous = deletedPhotoMap.get(photoId);
      deletedPhotoMap.set(photoId, {
        id: photoId,
        entryId: progress.entryId,
        storagePaths: uniquePaths(
          ...(previous?.storagePaths ?? []),
          progress.previousStoragePath,
          progress.replacementStoragePath
        ),
      });
    }

    for (const audioId of removalAudioIds) {
      const progress = audioProgressById.get(audioId);
      if (!progress?.entryId) {
        throw new Error("Diary audio deletion cannot be bound to the active removal operation");
      }
      if (removalEntryIds.has(progress.entryId)) continue;
      const previous = deletedAudioMap.get(audioId);
      deletedAudioMap.set(audioId, {
        id: audioId,
        entryId: progress.entryId,
        storagePaths: uniquePaths(
          ...(previous?.storagePaths ?? []),
          progress.previousStoragePath,
          progress.replacementStoragePath
        ),
      });
    }

    const photos = intent.cloudCleanup.photos.filter(({ id }) => !removalPhotoIds.has(id));
    const audios = intent.cloudCleanup.audios.filter(({ id }) => !removalAudioIds.has(id));
    const nextIntent: JournalSecurityRemovalIntent = {
      ...intent,
      updatedAt: Date.now(),
      cloudCleanup: {
        ...intent.cloudCleanup,
        entryIds: intent.cloudCleanup.entryIds.filter((id) => !removalEntryIds.has(id)),
        photos,
        audios,
        deletedEntries: [...deletedEntryMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
        deletedPhotos: [...deletedPhotoMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
        deletedAudios: [...deletedAudioMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
      },
      localCommitInventory: intent.localCommitInventory
        ? {
            ...intent.localCommitInventory,
            entryIds: intent.localCommitInventory.entryIds.filter((id) => !removalEntryIds.has(id)),
            photoIds: intent.localCommitInventory.photoIds.filter((id) => !removalPhotoIds.has(id)),
            audioIds: intent.localCommitInventory.audioIds.filter((id) => !removalAudioIds.has(id)),
            deletedEntryIds: [
              ...new Set([
                ...(intent.localCommitInventory.deletedEntryIds ?? []),
                ...removalEntryIds,
              ]),
            ].sort(),
            deletedPhotoIds: [
              ...new Set([
                ...(intent.localCommitInventory.deletedPhotoIds ?? []),
                ...removalPhotoIds,
              ]),
            ].sort(),
            deletedAudioIds: [
              ...new Set([
                ...(intent.localCommitInventory.deletedAudioIds ?? []),
                ...removalAudioIds,
              ]),
            ].sort(),
          }
        : undefined,
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

/**
 * Creates the operation identity without replacing a marker written by a
 * concurrent tab. The origin-wide lock is the primary single-flight guard;
 * this transaction is the durable compare-and-set backstop.
 */
async function persistNewRemovalIntent(intent: JournalSecurityRemovalIntent): Promise<boolean> {
  let created = false;
  await db.transaction("rw", db.settings, async () => {
    if (await db.settings.get(SK.JOURNAL_SECURITY_REMOVAL)) return;
    await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: intent });
    created = true;
  });
  if (created) emitMigrationUpdate();
  return created;
}

async function encryptEntry(
  entry: JournalEntry,
  vaultKey: string,
  updatedAt: number,
  vaultRevision: number
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
  vaultRevision: number
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
  vaultRevision: number
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
  boundary: JournalSecurityBoundary
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
        boundary.sessionOwnerUserId
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
  boundary: JournalSecurityBoundary
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
        boundary.sessionOwnerUserId
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
  additions: JournalSecurityMediaIntent[]
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
  boundary: JournalSecurityBoundary
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
  const removalRecord = settings.find((setting) => setting.key === SK.JOURNAL_SECURITY_REMOVAL);
  const revisionRecord = settings.find((setting) => setting.key === SK.JOURNAL_VAULT_REVISION);
  const storedRevisionMarker = storedVaultRevision(revisionRecord?.value);
  if (revisionRecord && storedRevisionMarker === null) {
    throw new Error("Diary vault revision marker is malformed");
  }
  if (storedRevisionMarker !== null && storedRevisionMarker !== vaultRevision) {
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
    (setting) => setting.key === SK.JOURNAL_SECURITY_MIGRATION
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
  const [
    preparedEntries,
    preparedPhotos,
    preparedAudios,
    preparedDrafts,
    preparedSpaces,
    preparedCaptures,
  ] = await Promise.all([
    Promise.all(entries.map((entry) => encryptEntry(entry, vaultKey, updatedAt, vaultRevision))),
    Promise.all(
      photos.map((photo) => preparePhotoForActiveVault(photo, vaultKey, vaultRevision, boundary))
    ),
    Promise.all(
      audios.map((audio) => prepareAudioForActiveVault(audio, vaultKey, vaultRevision, boundary))
    ),
    Promise.all(
      settings.map((setting) =>
        encryptJournalDraftSettingForStorage(setting, vaultKey, vaultRevision)
      )
    ),
    Promise.all(
      spaces.map((space) => encryptJournalSpaceForStorage(space, vaultKey, vaultRevision))
    ),
    Promise.all(
      captures.map((capture) =>
        encryptJournalSpaceCaptureForStorage(capture, vaultKey, vaultRevision)
      )
    ),
  ]);
  await assertJournalSecurityBoundary(boundary);

  const entryUpdates = preparedEntries.filter(
    (entry, index) => !structurallyEqual(entry, entries[index])
  );
  const photoUpdates = preparedPhotos.flatMap((prepared) =>
    prepared.update && !structurallyEqual(prepared.update, prepared.source) ? [prepared.update] : []
  );
  const audioUpdates = preparedAudios.flatMap((prepared) =>
    prepared.update && !structurallyEqual(prepared.update, prepared.source) ? [prepared.update] : []
  );
  const draftUpdates = preparedDrafts.filter((draft): draft is NonNullable<typeof draft> => {
    if (!draft) return false;
    const source = settings.find((setting) => setting.key === draft.key);
    return !source || !structurallyEqual(source.value, draft.value);
  });
  const spaceUpdates = preparedSpaces.filter(
    (space, index) => !structurallyEqual(space, spaces[index])
  );
  const captureUpdates = preparedCaptures.filter(
    (capture, index) => !structurallyEqual(capture, captures[index])
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
  if (changedCount > 0 && isCloudSyncEnabled() && boundary.sessionOwnerUserId) {
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

  if (changedCount > 0 || revisionMarkerNeedsRepair || nextMigration !== currentMigration) {
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
            (transactionRevisionMarker !== null && transactionRevisionMarker !== vaultRevision) ||
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
            setting.key.startsWith(SK.journalDraft(""))
          );
          const latestDrafts = latestSettings.filter((setting) =>
            setting.key.startsWith(SK.journalDraft(""))
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
        }
      );
    });
    emitMigrationUpdate();
  }

  if (nextMigration && !structurallyEqual(nextMigration, currentMigration)) {
    try {
      await ensureJournalSecurityMigrationQueued(nextMigration);
    } catch {
      logger.warn("[Journal]", "Diary epoch normalization remains pending");
    }
  }
  if (unboundMediaCount > 0) {
    logger.warn("[Journal]", "Diary media remains unbound to the active vault epoch:", {
      count: unboundMediaCount,
    });
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
  const revisionRecord = settings.find((setting) => setting.key === SK.JOURNAL_VAULT_REVISION);
  const vaultRevision = nextVaultRevision(revisionRecord?.value, vaultSetting.updatedAt);
  const activatedVaultSetting: JournalVaultKeySetting = {
    ...vaultSetting,
    updatedAt: vaultRevision,
  };
  const [
    encryptedEntries,
    encryptedPhotos,
    encryptedAudios,
    preparedDrafts,
    encryptedSpaces,
    encryptedCaptures,
  ] = await Promise.all([
    Promise.all(entries.map((entry) => encryptEntry(entry, vaultKey, updatedAt, vaultRevision))),
    Promise.all(photos.map((photo) => encryptPhoto(photo, vaultKey, vaultRevision))),
    Promise.all(audios.map((audio) => encryptAudio(audio, vaultKey, vaultRevision))),
    Promise.all(
      settings.map((setting) =>
        encryptJournalDraftSettingForStorage(setting, vaultKey, vaultRevision)
      )
    ),
    Promise.all(
      spaces.map((space) => encryptJournalSpaceForStorage(space, vaultKey, vaultRevision))
    ),
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
  } catch {
    const failedIntent: JournalSecurityMigrationIntent = {
      ...intent,
      status: "enqueue-failed",
      lastError: "enqueue-failed",
    };
    await persistIntent(failedIntent, intent.revision);
    logger.error("[Journal] Diary protection cloud migration could not be queued");
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

const JOURNAL_REMOVAL_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function journalRemovalDataUrlMimeType(value: string): string | null {
  const match = /^data:([^;,]+)(?:;[^,]*)?,/i.exec(value);
  return match?.[1]?.trim().toLowerCase() || null;
}

function assertJournalRemovalPhotoMimeType(value: string): void {
  const mimeType = journalRemovalDataUrlMimeType(value);
  if (!mimeType || !JOURNAL_REMOVAL_PHOTO_MIME_TYPES.has(mimeType)) {
    throw new Error("Diary photo MIME type is invalid after decryption");
  }
}

function assertJournalRemovalAudioMimeType(value: string, expectedMimeType: string): void {
  const expected = normalizeJournalAudioMimeType(expectedMimeType);
  const actual = journalRemovalDataUrlMimeType(value);
  if (!expected || !actual || normalizeJournalAudioMimeType(actual) !== expected) {
    throw new Error("Diary audio MIME type changed during decryption");
  }
}

async function decryptPhotoPayloadForRemoval(value: string, vaultKey: string): Promise<string> {
  const decrypted = await decryptJournalMediaDataUrlIfNeeded(value, vaultKey);
  assertJournalRemovalPhotoMimeType(decrypted);
  return decrypted;
}

async function decryptAudioPayloadForRemoval(
  value: string,
  vaultKey: string,
  expectedMimeType: string
): Promise<string> {
  const decrypted = await decryptJournalMediaDataUrlIfNeeded(value, vaultKey);
  assertJournalRemovalAudioMimeType(decrypted, expectedMimeType);
  return decrypted;
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
  const data =
    photo.data && isEncryptedJournalMediaData(photo.data)
      ? await decryptPhotoPayloadForRemoval(photo.data, vaultKey)
      : photo.data;
  const thumbnail =
    photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail)
      ? await decryptPhotoPayloadForRemoval(photo.thumbnail, vaultKey)
      : photo.thumbnail;
  return {
    ...photo,
    data,
    thumbnail,
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
  const data = await decryptAudioPayloadForRemoval(audio.data, vaultKey, audio.mimeType);
  return {
    ...audio,
    data,
    storagePath: undefined,
    storageUrl: undefined,
    vaultRevision: undefined,
  };
}

type JournalSettingRow = { key: string; value: unknown };
type JournalSpaceRow = JournalSpace;
type JournalCaptureRow = JournalSpaceCapture;

interface JournalPasswordRemovalMediaReceipt {
  kind: "photo" | "audio";
  id: string;
  entryId: string;
  previousStoragePath?: string;
  protected: boolean;
  sourceRecordSha256: string;
  rowSha256: string;
  backupSha256: string;
  postimageBackupSha256: string;
  remoteStageKey?: string;
  encryptedDataSha256?: string;
}

interface PreparedJournalPasswordRemoval {
  preflight: Extract<JournalPasswordRemovalPreflight, { status: "ready" }>;
  source: {
    entries: JournalEntry[];
    photos: JournalPasswordRemovalMediaReceipt[];
    audios: JournalPasswordRemovalMediaReceipt[];
    settings: JournalSettingRow[];
    spaces: JournalSpaceRow[];
    captures: JournalCaptureRow[];
  };
  decrypted: {
    entries: JournalEntry[];
    drafts: JournalSettingRow[];
    spaces: JournalSpaceRow[];
    captures: JournalCaptureRow[];
  };
  storageObjects: JournalMediaStorageIdentity[];
}

type JournalPasswordRemovalPreparation =
  | PreparedJournalPasswordRemoval
  | Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>;

function removalVaultRevisionMismatch(
  value: { vaultRevision?: unknown },
  expectedVaultRevision: number
): boolean {
  return (
    value.vaultRevision !== undefined &&
    storedVaultRevision(value.vaultRevision) !== expectedVaultRevision
  );
}

function nonEmptyProtectedTextIsInvalid(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  return typeof value !== "string" || !isEncryptedJournalContent(value);
}

function protectedMediaValueIsInvalid(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  return typeof value !== "string" || !isEncryptedJournalMediaData(value);
}

/**
 * Once activation is complete, a vault epoch and an authenticated envelope
 * must agree. A damaged prefix is not plaintext: treating it as such would
 * remove the password while leaving private bytes in an unreadable mixed
 * representation. Legacy ciphertext may omit vaultRevision, but any explicit
 * revision must match the active epoch.
 */
function validateJournalRemovalRepresentation(
  snapshot: Pick<LocalJournalProtectionSnapshot, "entries" | "settings" | "spaces" | "captures">,
  expectedVaultRevision: number
): JournalProtectionBlockerCode | null {
  const draftSettings = snapshot.settings.filter((setting) =>
    setting.key.startsWith(SK.journalDraft(""))
  );
  const draftValues = draftSettings.map((setting) =>
    setting.value && typeof setting.value === "object" && !Array.isArray(setting.value)
      ? (setting.value as { content?: unknown; vaultRevision?: unknown })
      : null
  );

  const revisionMismatch =
    snapshot.entries.some((entry) => removalVaultRevisionMismatch(entry, expectedVaultRevision)) ||
    draftValues.some(
      (draft) => draft && removalVaultRevisionMismatch(draft, expectedVaultRevision)
    ) ||
    snapshot.spaces.some((space) => removalVaultRevisionMismatch(space, expectedVaultRevision)) ||
    snapshot.captures.some((capture) =>
      removalVaultRevisionMismatch(capture, expectedVaultRevision)
    );
  if (revisionMismatch) return "vault-revision-mismatch";

  if (
    snapshot.entries.some(
      (entry) => typeof entry.content !== "string" || !isEncryptedJournalContent(entry.content)
    )
  ) {
    return "decrypt-entry";
  }
  if (
    draftValues.some(
      (draft) =>
        !draft ||
        typeof draft.content !== "string" ||
        (draft.content.length > 0 && !isEncryptedJournalContent(draft.content))
    )
  ) {
    return "decrypt-draft";
  }
  if (
    snapshot.spaces.some(
      (space) =>
        nonEmptyProtectedTextIsInvalid(space.name) ||
        nonEmptyProtectedTextIsInvalid(space.description)
    )
  ) {
    return "decrypt-space";
  }
  if (
    snapshot.captures.some(
      (capture) =>
        nonEmptyProtectedTextIsInvalid(capture.spaceName) ||
        nonEmptyProtectedTextIsInvalid(capture.title) ||
        !Array.isArray(capture.fields) ||
        capture.fields.some(
          (field) =>
            !field ||
            typeof field !== "object" ||
            nonEmptyProtectedTextIsInvalid(field.prompt) ||
            nonEmptyProtectedTextIsInvalid(field.value)
        )
    )
  ) {
    return "decrypt-capture";
  }
  return null;
}

function validateJournalRemovalPhotoRepresentation(
  photo: JournalPhoto,
  expectedVaultRevision: number
): JournalProtectionBlockerCode | null {
  if (removalVaultRevisionMismatch(photo, expectedVaultRevision)) {
    return "vault-revision-mismatch";
  }
  return protectedMediaValueIsInvalid(photo.data) ||
    protectedMediaValueIsInvalid(photo.thumbnail) ||
    (!photo.data && !photo.thumbnail && !photo.storagePath?.endsWith(".bin"))
    ? "decrypt-media"
    : null;
}

function validateJournalRemovalAudioRepresentation(
  audio: JournalAudio,
  expectedVaultRevision: number
): JournalProtectionBlockerCode | null {
  if (removalVaultRevisionMismatch(audio, expectedVaultRevision)) {
    return "vault-revision-mismatch";
  }
  return protectedMediaValueIsInvalid(audio.data) ||
    (!audio.data && !audio.storagePath?.endsWith(".bin"))
    ? "decrypt-media"
    : null;
}

function removalBlocked(
  status: Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>["status"],
  recoveryAction: Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>["recoveryAction"]
): Exclude<JournalPasswordRemovalPreflight, { status: "ready" }> {
  return { status, recoveryAction };
}

async function mapJournalRemovalPreflightBatches<T, Result>(
  items: readonly T[],
  mapper: (item: T) => Promise<Result>
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

async function buildJournalPasswordRemovalInventory(
  source: LocalJournalProtectionSnapshot,
  storageObjects: JournalMediaStorageIdentity[],
  includePlaintext = false,
  signal?: AbortSignal
): Promise<JournalPasswordRemovalInventory> {
  const assertActive = () => {
    if (!signal?.aborted) return;
    if (signal.reason instanceof Error) throw signal.reason;
    throw new DOMException("Diary removal inventory was aborted", "AbortError");
  };
  assertActive();
  const photoOwners = new Map(source.photos.map((photo) => [photo.id, photo.entryId]));
  const audioOwners = new Map(source.audios.map((audio) => [audio.id, audio.entryId]));
  const normalizedEntries = source.entries.map((entry) => ({
    ...entry,
    photoIds: [...new Set(entry.photoIds)].filter(
      (photoId) => photoOwners.get(photoId) === entry.id
    ),
    audioIds: entry.audioIds
      ? [...new Set(entry.audioIds)].filter((audioId) => audioOwners.get(audioId) === entry.id)
      : entry.audioIds,
  }));
  const entryIds = new Set(normalizedEntries.map((entry) => entry.id));
  const spaceIds = new Set(source.spaces.map((space) => space.id));
  const normalizedCaptures = source.captures
    .filter((capture) => spaceIds.has(capture.spaceId))
    .map((capture) =>
      capture.entryId && !entryIds.has(capture.entryId)
        ? { ...capture, entryId: undefined }
        : capture
    );

  const protectedEntries = normalizedEntries.filter(
    (entry) =>
      includePlaintext ||
      isEncryptedJournalContent(entry.content) ||
      entry.vaultRevision !== undefined
  );
  const protectedPhotos = source.photos.filter(
    (photo) =>
      includePlaintext ||
      Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
      Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail)) ||
      photo.storagePath?.endsWith(".bin") === true ||
      photo.vaultRevision !== undefined
  );
  const protectedAudios = source.audios.filter(
    (audio) =>
      includePlaintext ||
      Boolean(audio.data && isEncryptedJournalMediaData(audio.data)) ||
      audio.storagePath?.endsWith(".bin") === true ||
      audio.vaultRevision !== undefined
  );
  const protectedSpaces = source.spaces.filter(
    (space) =>
      includePlaintext ||
      Boolean(space.name && isEncryptedJournalContent(space.name)) ||
      Boolean(space.description && isEncryptedJournalContent(space.description)) ||
      space.vaultRevision !== undefined
  );
  const protectedCaptures = normalizedCaptures.filter(
    (capture) =>
      includePlaintext ||
      isEncryptedJournalContent(capture.spaceName) ||
      isEncryptedJournalContent(capture.title) ||
      capture.fields.some(
        (field) => isEncryptedJournalContent(field.prompt) || isEncryptedJournalContent(field.value)
      ) ||
      capture.vaultRevision !== undefined
  );

  return {
    version: 1,
    entries: await Promise.all(
      protectedEntries.map(async (entry) => {
        assertActive();
        return {
          id: entry.id,
          rowSha256: await journalInventorySha256(
            journalInventorySecurityProjection("entry-row", entry)
          ),
          backupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("entry-backup", entry)
          ),
          postimageBackupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("entry-backup", entry)
          ),
        };
      })
    ),
    photos: await Promise.all(
      protectedPhotos.map(async (photo) => {
        assertActive();
        return {
          id: photo.id,
          parentId: photo.entryId,
          rowSha256: await journalInventorySha256(
            journalInventorySecurityProjection("photo-row", photo)
          ),
          backupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("photo-backup", photo)
          ),
          postimageBackupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("photo-backup", photo)
          ),
        };
      })
    ),
    audios: await Promise.all(
      protectedAudios.map(async (audio) => {
        assertActive();
        return {
          id: audio.id,
          parentId: audio.entryId,
          rowSha256: await journalInventorySha256(
            journalInventorySecurityProjection("audio-row", audio)
          ),
          backupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("audio-backup", audio)
          ),
          postimageBackupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("audio-backup", audio)
          ),
        };
      })
    ),
    spaces: await Promise.all(
      protectedSpaces.map(async (space) => {
        assertActive();
        return {
          id: space.id,
          backupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("space-backup", space)
          ),
          postimageBackupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("space-backup", space)
          ),
        };
      })
    ),
    captures: await Promise.all(
      protectedCaptures.map(async (capture) => {
        assertActive();
        return {
          id: capture.id,
          backupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("capture-backup", capture)
          ),
          postimageBackupSha256: await journalInventorySha256(
            journalInventorySecurityProjection("capture-backup", capture)
          ),
        };
      })
    ),
    storageObjects,
  };
}

async function buildPreparedJournalPasswordRemovalInventory(
  preparation: PreparedJournalPasswordRemoval
): Promise<JournalPasswordRemovalInventory> {
  const { source, storageObjects } = preparation;
  const decryptedEntryById = new Map(
    preparation.decrypted.entries.map((entry) => [entry.id, entry])
  );
  const decryptedSpaceById = new Map(
    preparation.decrypted.spaces.map((space) => [space.id, space])
  );
  const decryptedCaptureById = new Map(
    preparation.decrypted.captures.map((capture) => [capture.id, capture])
  );
  const photoOwners = new Map(source.photos.map((photo) => [photo.id, photo.entryId]));
  const audioOwners = new Map(source.audios.map((audio) => [audio.id, audio.entryId]));
  const normalizedEntries = source.entries.map((entry) => ({
    ...entry,
    photoIds: [...new Set(entry.photoIds)].filter(
      (photoId) => photoOwners.get(photoId) === entry.id
    ),
    audioIds: entry.audioIds
      ? [...new Set(entry.audioIds)].filter((audioId) => audioOwners.get(audioId) === entry.id)
      : entry.audioIds,
  }));
  const entryIds = new Set(normalizedEntries.map((entry) => entry.id));
  const spaceIds = new Set(source.spaces.map((space) => space.id));
  const normalizedCaptures = source.captures
    .filter((capture) => spaceIds.has(capture.spaceId))
    .map((capture) =>
      capture.entryId && !entryIds.has(capture.entryId)
        ? { ...capture, entryId: undefined }
        : capture
    );

  const entries: JournalPasswordRemovalInventory["entries"] = [];
  for (const entry of normalizedEntries) {
    if (!isEncryptedJournalContent(entry.content) && entry.vaultRevision === undefined) continue;
    const decryptedEntry = decryptedEntryById.get(entry.id);
    if (!decryptedEntry) throw new Error("Diary removal entry postimage is unavailable");
    const postimageEntry = {
      ...decryptedEntry,
      photoIds: entry.photoIds,
      audioIds: entry.audioIds,
    };
    entries.push({
      id: entry.id,
      rowSha256: await journalInventorySha256(
        journalInventorySecurityProjection("entry-row", entry)
      ),
      backupSha256: await journalInventorySha256(
        journalInventorySecurityProjection("entry-backup", entry)
      ),
      postimageBackupSha256: await journalInventorySha256(
        journalInventorySecurityProjection("entry-backup", postimageEntry)
      ),
    });
  }

  const spaces: JournalPasswordRemovalInventory["spaces"] = [];
  for (const space of source.spaces) {
    if (
      space.vaultRevision === undefined &&
      !isEncryptedJournalContent(space.name ?? "") &&
      !isEncryptedJournalContent(space.description ?? "")
    ) {
      continue;
    }
    const decryptedSpace = decryptedSpaceById.get(space.id);
    if (!decryptedSpace) throw new Error("Diary removal space postimage is unavailable");
    spaces.push({
      id: space.id,
      backupSha256: await journalInventorySha256(
        journalInventorySecurityProjection("space-backup", space)
      ),
      postimageBackupSha256: await journalInventorySha256(
        journalInventorySecurityProjection("space-backup", decryptedSpace)
      ),
    });
  }

  const captures: JournalPasswordRemovalInventory["captures"] = [];
  for (const capture of normalizedCaptures) {
    const protectedCapture =
      capture.vaultRevision !== undefined ||
      isEncryptedJournalContent(capture.spaceName) ||
      isEncryptedJournalContent(capture.title) ||
      capture.fields.some(
        (field) => isEncryptedJournalContent(field.prompt) || isEncryptedJournalContent(field.value)
      );
    if (!protectedCapture) continue;
    const decryptedCapture = decryptedCaptureById.get(capture.id);
    if (!decryptedCapture) throw new Error("Diary removal capture postimage is unavailable");
    const postimageCapture =
      decryptedCapture.entryId && !entryIds.has(decryptedCapture.entryId)
        ? { ...decryptedCapture, entryId: undefined }
        : decryptedCapture;
    captures.push({
      id: capture.id,
      backupSha256: await journalInventorySha256(
        journalInventorySecurityProjection("capture-backup", capture)
      ),
      postimageBackupSha256: await journalInventorySha256(
        journalInventorySecurityProjection("capture-backup", postimageCapture)
      ),
    });
  }

  return {
    version: 1,
    entries,
    photos: source.photos
      .filter((photo) => photo.protected)
      .map((photo) => ({
        id: photo.id,
        parentId: photo.entryId,
        rowSha256: photo.rowSha256,
        backupSha256: photo.backupSha256,
        postimageBackupSha256: photo.postimageBackupSha256,
      })),
    audios: source.audios
      .filter((audio) => audio.protected)
      .map((audio) => ({
        id: audio.id,
        parentId: audio.entryId,
        rowSha256: audio.rowSha256,
        backupSha256: audio.backupSha256,
        postimageBackupSha256: audio.postimageBackupSha256,
      })),
    spaces,
    captures,
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
    deletedEntries: [],
    deletedPhotos: [],
    deletedAudios: [],
    backupPending: false,
    attemptCount: 0,
  };
}

function removalOwnerForBoundary(boundary: JournalSecurityBoundary): string {
  return (
    boundary.sessionOwnerUserId ?? boundary.localOwnerUserId ?? LOCAL_INSTALLATION_REMOVAL_OWNER
  );
}

async function startOrResumeJournalPasswordRemovalAttempt(
  boundary: JournalSecurityBoundary
): Promise<
  JournalSecurityRemovalIntent | Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>
> {
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

  // Authentication and local-owner adoption are distinct lifecycle steps.
  // Never create or resume a destructive intent while a signed-in account is
  // still being bound to this IndexedDB realm, and never treat account-owned
  // local data as an installation-only diary after sign-out.
  if (boundary.sessionOwnerUserId && boundary.localOwnerUserId === null) {
    return removalBlocked("owner-adoption-pending", "retry");
  }
  if (
    boundary.sessionOwnerUserId !== boundary.localOwnerUserId &&
    (boundary.sessionOwnerUserId !== null || boundary.localOwnerUserId !== null)
  ) {
    return removalBlocked("owner-changed", "stay-signed-in");
  }

  const ownerUserId = removalOwnerForBoundary(boundary);
  if (existingIntent) {
    if (!journalSecurityRemovalIntentMatchesBoundary(existingIntent, boundary)) {
      return removalBlocked("owner-changed", "stay-signed-in");
    }
    if (
      existingIntent.phase === "abort-pending" ||
      existingIntent.phase === "local-committed" ||
      existingIntent.phase === "cleanup-pending"
    ) {
      return removalBlocked("removal-pending", "retry");
    }
    const resumed: JournalSecurityRemovalIntent = {
      ...existingIntent,
      updatedAt: Date.now(),
      phase: existingIntent.phase === "remote-fenced" ? "remote-fenced" : "preflight-pending",
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
    (vaultRecord?.value as { updatedAt?: unknown } | undefined)?.updatedAt
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
    return (await persistNewRemovalIntent(intent))
      ? intent
      : removalBlocked("removal-pending", "retry");
  } catch {
    return removalBlocked("storage-failed", "retry");
  }
}

async function persistBlockedRemovalAttempt(
  intent: JournalSecurityRemovalIntent,
  blocker: JournalProtectionBlockerCode
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
    intent.operationRevision
  );
}

async function persistAbortPendingRemovalAttempt(
  intent: JournalSecurityRemovalIntent
): Promise<void> {
  await persistRemovalIntent(
    {
      ...intent,
      updatedAt: Date.now(),
      phase: "abort-pending",
      blocker: "storage-failed",
      nativeCleanup: { status: "not-started" },
      cloudCleanup: emptyRemovalCloudCleanup(),
      localCommitInventory: undefined,
      status: "pending",
      lastError: "storage-failed",
      photos: [],
      audios: [],
    },
    intent.operationRevision
  );
}

function journalPasswordRemovalMediaStageKey(
  operationRevision: string,
  kind: "photo" | "audio",
  mediaId: string
): string {
  return `${operationRevision}\u0000${kind}\u0000${mediaId}`;
}

async function clearJournalPasswordRemovalMediaStage(
  operationRevision: string,
  ownerUserId: string
): Promise<void> {
  const [operationKeys, ownerKeys] = await Promise.all([
    db.journalPasswordRemovalMediaStage
      .where("operationRevision")
      .equals(operationRevision)
      .primaryKeys(),
    db.journalPasswordRemovalMediaStage
      .where("[operationRevision+ownerUserId]")
      .equals([operationRevision, ownerUserId])
      .primaryKeys(),
  ]);
  if (
    !operationKeys.every((key): key is string => typeof key === "string") ||
    !ownerKeys.every((key): key is string => typeof key === "string") ||
    !structurallyEqual(
      [...operationKeys].sort(compareCanonicalJournalInventoryKeys),
      [...ownerKeys].sort(compareCanonicalJournalInventoryKeys)
    )
  ) {
    throw new Error("Diary removal staging owner boundary changed");
  }
  if (ownerKeys.length) {
    await db.journalPasswordRemovalMediaStage.bulkDelete(ownerKeys);
  }
}

async function journalMediaPrimaryKeys(kind: "photo" | "audio"): Promise<string[]> {
  const keys = await (kind === "photo" ? db.journalPhotos : db.journalAudio)
    .toCollection()
    .primaryKeys();
  if (!keys.every((key): key is string => typeof key === "string" && key.length > 0)) {
    throw new Error("Diary media contains an invalid primary key");
  }
  return [...keys].sort(compareCanonicalJournalInventoryKeys);
}

interface PreparedRemoteJournalMedia {
  encryptedData: string;
  identity?: JournalMediaStorageIdentity;
}

async function readRemoteJournalMediaForRemoval(input: {
  bucket: "journal-photos" | "journal-audio";
  path: string;
  inlineData?: string;
  boundary: JournalSecurityBoundary;
  requireRemoteFenceIdentity: boolean;
}): Promise<PreparedRemoteJournalMedia> {
  if (!input.path.endsWith(".bin") || (!input.requireRemoteFenceIdentity && input.inlineData)) {
    if (!input.inlineData) throw new Error("Diary media ciphertext is unavailable");
    return { encryptedData: input.inlineData };
  }
  const ownerUserId = input.boundary.sessionOwnerUserId;
  if (!ownerUserId) throw new Error("Diary media owner is unavailable");

  const identityBefore = input.requireRemoteFenceIdentity
    ? await readJournalMediaStorageIdentity(input.bucket, input.path, ownerUserId)
    : null;
  if (input.requireRemoteFenceIdentity && !identityBefore) {
    throw new Error("Diary media identity is unavailable");
  }
  const downloaded = await downloadAsBase64(input.bucket, input.path, ownerUserId);
  if (!downloaded) throw new Error("Diary media ciphertext is unavailable");
  const encryptedData = encryptedJournalMediaFromStorageDataUrl(downloaded);
  if (!isEncryptedJournalMediaData(encryptedData)) {
    throw new Error("Diary media ciphertext is malformed");
  }
  if (!input.requireRemoteFenceIdentity) return { encryptedData };

  const identityAfter = await readJournalMediaStorageIdentity(
    input.bucket,
    input.path,
    ownerUserId
  );
  if (!identityAfter || !structurallyEqual(identityBefore, identityAfter)) {
    throw new Error("Diary media changed during removal preflight");
  }
  return { encryptedData, identity: identityAfter };
}

async function stageRemoteJournalMediaForRemoval(input: {
  operationRevision: string;
  ownerUserId: string;
  kind: "photo" | "audio";
  mediaId: string;
  entryId: string;
  sourceRecordSha256: string;
  encryptedData: string;
}): Promise<{ key: string; encryptedDataSha256: string }> {
  if (!isEncryptedJournalMediaData(input.encryptedData)) {
    throw new Error("Diary removal staging accepts ciphertext only");
  }
  const key = journalPasswordRemovalMediaStageKey(
    input.operationRevision,
    input.kind,
    input.mediaId
  );
  const encryptedDataSha256 = await journalInventorySha256(input.encryptedData);
  await db.journalPasswordRemovalMediaStage.put({
    key,
    operationRevision: input.operationRevision,
    ownerUserId: input.ownerUserId,
    mediaKind: input.kind,
    mediaId: input.mediaId,
    entryId: input.entryId,
    sourceRecordSha256: input.sourceRecordSha256,
    encryptedDataSha256,
    encryptedData: input.encryptedData,
    createdAt: Date.now(),
  });
  return { key, encryptedDataSha256 };
}

/**
 * Removes crash-orphaned ciphertext staging without touching journal rows.
 * A row is reusable only for the exact active operation, owner, deterministic
 * key, authenticated envelope, and bounded retention window.
 */
export async function pruneJournalPasswordRemovalMediaStage(
  intent: JournalSecurityRemovalIntent | null,
  boundary: JournalSecurityBoundary,
  now = Date.now()
): Promise<number> {
  const keys = await db.journalPasswordRemovalMediaStage.toCollection().primaryKeys();
  if (!keys.every((key): key is string => typeof key === "string")) {
    throw new Error("Diary removal staging contains an invalid primary key");
  }
  const deleteKeys: string[] = [];
  for (const key of keys) {
    const row = await db.journalPasswordRemovalMediaStage.get(key);
    if (!row) continue;
    const expectedKey = journalPasswordRemovalMediaStageKey(
      row.operationRevision,
      row.mediaKind,
      row.mediaId
    );
    const age = now - row.createdAt;
    const encryptedDataDigestMatches =
      /^[0-9a-f]{64}$/.test(row.encryptedDataSha256) &&
      isEncryptedJournalMediaData(row.encryptedData) &&
      (await journalInventorySha256(row.encryptedData)) === row.encryptedDataSha256;
    const reusable =
      intent !== null &&
      journalSecurityRemovalIntentMatchesBoundary(intent, boundary) &&
      row.operationRevision === intent.operationRevision &&
      row.ownerUserId === intent.ownerUserId &&
      boundary.sessionOwnerUserId === row.ownerUserId &&
      boundary.localOwnerUserId === row.ownerUserId &&
      key === expectedKey &&
      row.entryId.length > 0 &&
      row.sourceRecordSha256.length > 0 &&
      encryptedDataDigestMatches &&
      Number.isSafeInteger(row.createdAt) &&
      age >= 0 &&
      age <= JOURNAL_PASSWORD_REMOVAL_STAGE_TTL_MS;
    if (!reusable) deleteKeys.push(key);
  }
  if (deleteKeys.length) {
    await db.journalPasswordRemovalMediaStage.bulkDelete(deleteKeys);
  }
  return deleteKeys.length;
}

async function prepareJournalPasswordRemoval(
  vaultKey: string | null,
  boundary: JournalSecurityBoundary,
  expectedRemovalRevision?: string,
  requireRemoteFenceIdentity = false
): Promise<JournalPasswordRemovalPreparation> {
  try {
    await assertJournalSecurityBoundary(boundary);
  } catch {
    return removalBlocked("owner-changed", "stay-signed-in");
  }

  let migrationIntent: JournalSecurityMigrationIntent | null;
  let removalIntent: JournalSecurityRemovalIntent | null;
  let entries: JournalEntry[];
  let settings: JournalSettingRow[];
  let spaces: JournalSpaceRow[];
  let captures: JournalCaptureRow[];
  let photoIds: string[];
  let audioIds: string[];
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
    [entries, settings, spaces, captures, photoIds, audioIds] = await Promise.all([
      db.journalEntries.toArray(),
      db.settings.toArray(),
      db.journalSpaces.toArray(),
      db.journalSpaceCaptures.toArray(),
      journalMediaPrimaryKeys("photo"),
      journalMediaPrimaryKeys("audio"),
    ]);
  } catch {
    return removalBlocked("storage-failed", "retry");
  }

  const passwordRecord = settings.find((setting) => setting.key === JOURNAL_PASSWORD_KEY);
  const vaultRecord = settings.find((setting) => setting.key === JOURNAL_VAULT_KEY_SETTING_KEY);
  const markerRecord = settings.find((setting) => setting.key === SK.JOURNAL_VAULT_REVISION);
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
  if (vaultRecord?.value) {
    const representationBlocker = validateJournalRemovalRepresentation(
      { entries, settings, spaces, captures },
      persistedVaultRevision
    );
    if (representationBlocker) {
      return removalBlocked(
        representationBlocker,
        representationBlocker === "vault-revision-mismatch" ? "reload" : "retry"
      );
    }
  }
  if (
    vaultRecord?.value &&
    vaultKey &&
    (getJournalContentVaultKey() !== vaultKey ||
      getJournalContentVaultRevision() !== persistedVaultRevision)
  ) {
    return removalBlocked("unlock-required", "unlock");
  }

  const stageOperationRevision = requireRemoteFenceIdentity ? expectedRemovalRevision : undefined;
  if (requireRemoteFenceIdentity && (!stageOperationRevision || !boundary.sessionOwnerUserId)) {
    return removalBlocked("owner-changed", "stay-signed-in");
  }
  if (stageOperationRevision) {
    try {
      await clearJournalPasswordRemovalMediaStage(
        stageOperationRevision,
        boundary.sessionOwnerUserId!
      );
    } catch {
      return removalBlocked("storage-failed", "retry");
    }
  }

  const cleanupStageAndBlock = async (
    blocker: JournalProtectionBlockerCode,
    recoveryAction: Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>["recoveryAction"]
  ): Promise<Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>> => {
    if (stageOperationRevision) {
      try {
        await clearJournalPasswordRemovalMediaStage(
          stageOperationRevision,
          boundary.sessionOwnerUserId!
        );
      } catch {
        return removalBlocked("storage-failed", "retry");
      }
    }
    return removalBlocked(blocker, recoveryAction);
  };

  const protectedNonMedia =
    entries.some((entry) => Boolean(entry.content && isEncryptedJournalContent(entry.content))) ||
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
            isEncryptedJournalContent(field.prompt) || isEncryptedJournalContent(field.value)
        )
    );
  if (protectedNonMedia && !vaultKey) {
    return cleanupStageAndBlock("unlock-required", "unlock");
  }

  const photoReceipts: JournalPasswordRemovalMediaReceipt[] = [];
  const audioReceipts: JournalPasswordRemovalMediaReceipt[] = [];
  const storageObjects: JournalMediaStorageIdentity[] = [];
  const seenRemoteObjects = new Set<string>();
  try {
    for (const photoId of photoIds) {
      const photo = await db.journalPhotos.get(photoId);
      if (!photo) throw new Error("Diary photo changed during preflight");
      if (vaultRecord?.value) {
        const blocker = validateJournalRemovalPhotoRepresentation(photo, persistedVaultRevision);
        if (blocker)
          return cleanupStageAndBlock(
            blocker,
            blocker === "vault-revision-mismatch" ? "reload" : "retry"
          );
      }
      const protectedPhoto =
        Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
        Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail)) ||
        photo.storagePath?.endsWith(".bin") === true ||
        photo.vaultRevision !== undefined;
      if (protectedPhoto && !vaultKey) {
        return cleanupStageAndBlock("unlock-required", "unlock");
      }

      const sourceRecordSha256 = await journalInventorySha256(photo);
      let remoteStageKey: string | undefined;
      let encryptedDataSha256: string | undefined;
      let sourceForPostimage = photo;
      if (vaultKey) {
        let encryptedData = photo.data;
        if (photo.storagePath?.endsWith(".bin")) {
          const objectKey = `journal-photos\u0000${photo.storagePath}`;
          if (seenRemoteObjects.has(objectKey)) {
            throw new Error("Diary media storage identity is duplicated");
          }
          seenRemoteObjects.add(objectKey);
          const remote = await readRemoteJournalMediaForRemoval({
            bucket: "journal-photos",
            path: photo.storagePath,
            inlineData: photo.data,
            boundary,
            requireRemoteFenceIdentity,
          });
          encryptedData = remote.encryptedData;
          if (remote.identity) storageObjects.push(remote.identity);
          await decryptPhotoPayloadForRemoval(encryptedData, vaultKey);
          if (stageOperationRevision) {
            const staged = await stageRemoteJournalMediaForRemoval({
              operationRevision: stageOperationRevision,
              ownerUserId: boundary.sessionOwnerUserId!,
              kind: "photo",
              mediaId: photo.id,
              entryId: photo.entryId,
              sourceRecordSha256,
              encryptedData,
            });
            remoteStageKey = staged.key;
            encryptedDataSha256 = staged.encryptedDataSha256;
          }
        } else if (encryptedData && isEncryptedJournalMediaData(encryptedData)) {
          await decryptPhotoPayloadForRemoval(encryptedData, vaultKey);
        }
        if (photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail)) {
          await decryptPhotoPayloadForRemoval(photo.thumbnail, vaultKey);
        }
        sourceForPostimage = { ...photo, data: encryptedData };
      }
      const photoPostimage = protectedPhoto
        ? await decryptPhotoForRemoval(sourceForPostimage, vaultKey!)
        : photo;
      photoReceipts.push({
        kind: "photo",
        id: photo.id,
        entryId: photo.entryId,
        previousStoragePath: photo.storagePath,
        protected: protectedPhoto,
        sourceRecordSha256,
        rowSha256: await journalInventorySha256(
          journalInventorySecurityProjection("photo-row", photo)
        ),
        backupSha256: await journalInventorySha256(
          journalInventorySecurityProjection("photo-backup", photo)
        ),
        postimageBackupSha256: await journalInventorySha256(
          journalInventorySecurityProjection("photo-backup", photoPostimage)
        ),
        remoteStageKey,
        encryptedDataSha256,
      });
    }

    for (const audioId of audioIds) {
      const audio = await db.journalAudio.get(audioId);
      if (!audio) throw new Error("Diary audio changed during preflight");
      if (vaultRecord?.value) {
        const blocker = validateJournalRemovalAudioRepresentation(audio, persistedVaultRevision);
        if (blocker)
          return cleanupStageAndBlock(
            blocker,
            blocker === "vault-revision-mismatch" ? "reload" : "retry"
          );
      }
      const protectedAudio =
        Boolean(audio.data && isEncryptedJournalMediaData(audio.data)) ||
        audio.storagePath?.endsWith(".bin") === true ||
        audio.vaultRevision !== undefined;
      if (protectedAudio && !vaultKey) {
        return cleanupStageAndBlock("unlock-required", "unlock");
      }

      const sourceRecordSha256 = await journalInventorySha256(audio);
      let remoteStageKey: string | undefined;
      let encryptedDataSha256: string | undefined;
      let sourceForPostimage = audio;
      if (vaultKey) {
        let encryptedData = audio.data;
        if (audio.storagePath?.endsWith(".bin")) {
          const objectKey = `journal-audio\u0000${audio.storagePath}`;
          if (seenRemoteObjects.has(objectKey)) {
            throw new Error("Diary media storage identity is duplicated");
          }
          seenRemoteObjects.add(objectKey);
          const remote = await readRemoteJournalMediaForRemoval({
            bucket: "journal-audio",
            path: audio.storagePath,
            inlineData: audio.data,
            boundary,
            requireRemoteFenceIdentity,
          });
          encryptedData = remote.encryptedData;
          if (remote.identity) storageObjects.push(remote.identity);
          await decryptAudioPayloadForRemoval(encryptedData, vaultKey, audio.mimeType);
          if (stageOperationRevision) {
            const staged = await stageRemoteJournalMediaForRemoval({
              operationRevision: stageOperationRevision,
              ownerUserId: boundary.sessionOwnerUserId!,
              kind: "audio",
              mediaId: audio.id,
              entryId: audio.entryId,
              sourceRecordSha256,
              encryptedData,
            });
            remoteStageKey = staged.key;
            encryptedDataSha256 = staged.encryptedDataSha256;
          }
        } else if (encryptedData && isEncryptedJournalMediaData(encryptedData)) {
          await decryptAudioPayloadForRemoval(encryptedData, vaultKey, audio.mimeType);
        }
        sourceForPostimage = { ...audio, data: encryptedData };
      }
      const audioPostimage = protectedAudio
        ? await decryptAudioForRemoval(sourceForPostimage, vaultKey!)
        : audio;
      audioReceipts.push({
        kind: "audio",
        id: audio.id,
        entryId: audio.entryId,
        previousStoragePath: audio.storagePath,
        protected: protectedAudio,
        sourceRecordSha256,
        rowSha256: await journalInventorySha256(
          journalInventorySecurityProjection("audio-row", audio)
        ),
        backupSha256: await journalInventorySha256(
          journalInventorySecurityProjection("audio-backup", audio)
        ),
        postimageBackupSha256: await journalInventorySha256(
          journalInventorySecurityProjection("audio-backup", audioPostimage)
        ),
        remoteStageKey,
        encryptedDataSha256,
      });
    }
  } catch {
    return cleanupStageAndBlock("decrypt-media", "retry");
  }

  const updatedAt = Date.now();
  let decryptedEntries = entries;
  let decryptedDrafts: JournalSettingRow[] = [];
  let decryptedSpaces = spaces;
  let decryptedCaptures = captures;
  if (vaultKey) {
    try {
      decryptedEntries = await mapJournalRemovalPreflightBatches(entries, (entry) =>
        decryptEntryForRemoval(entry, vaultKey, updatedAt)
      );
    } catch {
      return cleanupStageAndBlock("decrypt-entry", "retry");
    }
    try {
      const preparedDrafts = await mapJournalRemovalPreflightBatches(settings, (setting) =>
        decryptJournalDraftSettingForStorage(setting, vaultKey)
      );
      decryptedDrafts = preparedDrafts.filter(
        (draft): draft is NonNullable<typeof draft> => draft !== null
      );
    } catch {
      return cleanupStageAndBlock("decrypt-draft", "retry");
    }
    try {
      decryptedSpaces = await mapJournalRemovalPreflightBatches(spaces, (space) =>
        decryptJournalSpaceForStorage(space, vaultKey)
      );
    } catch {
      return cleanupStageAndBlock("decrypt-space", "retry");
    }
    try {
      decryptedCaptures = await mapJournalRemovalPreflightBatches(captures, (capture) =>
        decryptJournalSpaceCaptureForStorage(capture, vaultKey)
      );
    } catch {
      return cleanupStageAndBlock("decrypt-capture", "retry");
    }
  }

  try {
    await assertJournalSecurityBoundary(boundary);
  } catch {
    return cleanupStageAndBlock("owner-changed", "stay-signed-in");
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
        media: photoReceipts.length + audioReceipts.length,
        drafts: decryptedDrafts.length,
        spaces: spaces.length,
        captures: captures.length,
      },
    },
    source: {
      entries,
      photos: photoReceipts,
      audios: audioReceipts,
      settings,
      spaces,
      captures,
    },
    decrypted: {
      entries: decryptedEntries,
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

interface JournalPasswordProtectionAtomicResult {
  cloudMigrationPending: boolean;
  removalRevision?: string;
}

type FailedLocalCommitFenceSettlement =
  | { status: "aborted" | "pending" }
  | { status: "local-committed"; intent: JournalSecurityRemovalIntent };

function atomicRemovalResultFromIntent(
  intent: JournalSecurityRemovalIntent
): JournalPasswordProtectionAtomicResult {
  return {
    cloudMigrationPending: intent.cloudCleanup.status !== "complete",
    removalRevision: intent.operationRevision,
  };
}

/**
 * Re-reads the exact owner-bound operation under DATA -> JOURNAL before an
 * abort. A caught caller can be older than the transaction that actually
 * committed, so the in-memory phase is never sufficient evidence that an
 * abort remains safe.
 */
async function settleRemoteFenceAfterFailedLocalCommit(
  intent: JournalSecurityRemovalIntent,
  boundary: JournalSecurityBoundary
): Promise<FailedLocalCommitFenceSettlement> {
  return runWithJournalSecurityBoundary(boundary, async () => {
    let current: JournalSecurityRemovalIntent | null;
    try {
      current = await getJournalSecurityRemovalIntent();
    } catch {
      return { status: "pending" };
    }
    if (
      !current ||
      current.operationRevision !== intent.operationRevision ||
      current.ownerUserId !== intent.ownerUserId ||
      current.expectedVaultRevision !== intent.expectedVaultRevision ||
      !journalSecurityRemovalAttemptMatchesBoundary(current, boundary)
    ) {
      return { status: "pending" };
    }

    if (current.phase === "local-committed" || current.phase === "cleanup-pending") {
      return { status: "local-committed", intent: current };
    }

    const localProtectionStillPresent =
      await readLocalJournalProtectionArtifactsWithoutBoundaryLock();
    const phaseIsPreCommit =
      current.phase === "preflight-pending" ||
      current.phase === "remote-fenced" ||
      current.phase === "blocked" ||
      current.phase === "abort-pending";
    if (
      !phaseIsPreCommit ||
      !localProtectionStillPresent ||
      current.localCommitInventory !== undefined ||
      current.cloudCleanup.status !== "not-started"
    ) {
      // Absence of local protection is ambiguous here. Preserve the remote
      // fence for explicit recovery instead of guessing that no commit ran.
      return { status: "pending" };
    }

    let abortStatus: Awaited<ReturnType<typeof abortRemoteJournalPasswordRemoval>>;
    try {
      abortStatus = await abortRemoteJournalPasswordRemoval({
        expectedOwnerUserId: current.ownerUserId,
        expectedVaultRevision: current.expectedVaultRevision,
        operationRevision: current.operationRevision,
      });
    } catch {
      try {
        await persistAbortPendingRemovalAttempt(current);
      } catch {
        // The exact earlier marker still prevents cleanup from being guessed.
      }
      return { status: "pending" };
    }

    if (abortStatus !== "aborted") {
      try {
        await persistAbortPendingRemovalAttempt(current);
      } catch {
        // Preserve the existing exact operation if recovery metadata cannot advance.
      }
      return { status: "pending" };
    }

    try {
      await clearJournalPasswordRemovalMediaStage(current.operationRevision, current.ownerUserId);
      // Retire the operation revision only after the server restored protected
      // state. Reusing it could make a delayed worker look current on retry.
      await persistRemovalIntent(null, current.operationRevision);
    } catch {
      try {
        await persistAbortPendingRemovalAttempt(current);
      } catch {
        // The remaining exact marker is safer than reconstructing remote state.
      }
      return { status: "pending" };
    }
    return { status: "aborted" };
  });
}

export type JournalPasswordRemovalAbortRecoveryResult = "aborted" | "pending";

/**
 * Restores a server fence that was created before the local transaction but
 * could not be aborted because its acknowledgement was unavailable. The exact
 * operation remains durable across restarts and cannot enter cleanup.
 */
export async function recoverPendingJournalPasswordRemovalAbort(
  intent: JournalSecurityRemovalIntent,
  boundary: JournalSecurityBoundary
): Promise<JournalPasswordRemovalAbortRecoveryResult> {
  if (
    intent.phase !== "abort-pending" ||
    !journalSecurityRemovalIntentMatchesBoundary(intent, boundary)
  ) {
    return "pending";
  }

  return runWithJournalSecurityBoundary(boundary, async () => {
    // A pre-commit abort is safe only while local protection is still visibly
    // present. Absence or a partial state could mean the local commit crossed
    // the boundary despite an interrupted caller, so retain the fence.
    if (!(await readLocalJournalProtectionArtifactsWithoutBoundaryLock())) return "pending";
    const status = await abortRemoteJournalPasswordRemoval({
      expectedOwnerUserId: intent.ownerUserId,
      expectedVaultRevision: intent.expectedVaultRevision,
      operationRevision: intent.operationRevision,
    });
    if (status !== "aborted") return "pending";
    await clearJournalPasswordRemovalMediaStage(intent.operationRevision, intent.ownerUserId);
    await persistRemovalIntent(null, intent.operationRevision);
    return "aborted";
  });
}

/**
 * Prepares every decryption before opening IndexedDB, then commits plaintext,
 * removal metadata, and password/vault deletion in one transaction. A crypto,
 * ownership, process, or IndexedDB failure therefore cannot persist a mixed
 * local protection state.
 */
async function removeJournalPasswordProtectionAtomicallyInternal(
  vaultKey: string | null,
  boundary: JournalSecurityBoundary
): Promise<JournalPasswordProtectionAtomicResult> {
  await assertJournalSecurityBoundary(boundary);
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
    requiresRemoteFence
  );
  if (!("preflight" in preparation)) {
    if (preparation.status !== "owner-changed") {
      try {
        await persistBlockedRemovalAttempt(attempt, preparation.status);
      } catch {
        throw new JournalPasswordRemovalBlockedError(removalBlocked("storage-failed", "retry"));
      }
    }
    throw new JournalPasswordRemovalBlockedError(preparation);
  }
  let fencedAttempt = attempt;
  let fenceStatus: "ready" | "complete" | "not-required" = "not-required";
  let remoteFenceEstablished = false;
  if (requiresRemoteFence) {
    try {
      const inventory = await buildPreparedJournalPasswordRemovalInventory(preparation);
      const beginStatus = await beginRemoteJournalPasswordRemoval({
        expectedOwnerUserId: boundary.sessionOwnerUserId!,
        expectedVaultRevision: preparation.preflight.expectedVaultRevision,
        operationRevision: attempt.operationRevision,
        inventory,
      });
      if (
        beginStatus === "fresh-auth-required" ||
        beginStatus === "fresh-auth-required-no-fence" ||
        beginStatus === "fresh-auth-required-existing-fence"
      ) {
        if (beginStatus === "fresh-auth-required-no-fence") {
          // The server explicitly proved that no removal fence exists. Retire
          // only this local preflight so a later authenticated attempt starts
          // with a new operation identity.
          await clearJournalPasswordRemovalMediaStage(
            attempt.operationRevision,
            attempt.ownerUserId
          );
          await persistRemovalIntent(null, attempt.operationRevision);
        } else {
          // An exact remote fence may already exist. Preserve the operation and
          // its prepared ciphertext receipts so reauthentication resumes the
          // same paused server state. The legacy status is intentionally
          // treated as ambiguous and therefore fail-closed.
          fencedAttempt = {
            ...attempt,
            expectedVaultRevision: preparation.preflight.expectedVaultRevision,
            updatedAt: Date.now(),
            phase:
              beginStatus === "fresh-auth-required-existing-fence"
                ? "remote-fenced"
                : attempt.phase,
            blocker: "fresh-auth-required",
          };
          await persistRemovalIntent(fencedAttempt, attempt.operationRevision);
        }
        throw new JournalPasswordRemovalBlockedError(
          removalBlocked("fresh-auth-required", "reauthenticate")
        );
      }
      fenceStatus = beginStatus;
      remoteFenceEstablished = fenceStatus === "ready";
      fencedAttempt = {
        ...attempt,
        expectedVaultRevision: preparation.preflight.expectedVaultRevision,
        updatedAt: Date.now(),
        phase: "remote-fenced",
        blocker: undefined,
      };
      await persistRemovalIntent(fencedAttempt, attempt.operationRevision);
    } catch (error) {
      if (
        error instanceof JournalPasswordRemovalBlockedError &&
        error.code === "fresh-auth-required"
      ) {
        throw error;
      }
      let settlement: FailedLocalCommitFenceSettlement | null = null;
      if (remoteFenceEstablished) {
        try {
          settlement = await settleRemoteFenceAfterFailedLocalCommit(fencedAttempt, boundary);
        } catch {
          settlement = { status: "pending" };
        }
      }
      if (settlement?.status === "local-committed") {
        return atomicRemovalResultFromIntent(settlement.intent);
      }
      if (!remoteFenceEstablished) {
        try {
          await persistBlockedRemovalAttempt(attempt, "storage-failed");
        } catch {
          // The preflight intent remains durable and still prevents unsafe cleanup.
        }
        try {
          await clearJournalPasswordRemovalMediaStage(
            attempt.operationRevision,
            attempt.ownerUserId
          );
        } catch {
          // The staged rows contain ciphertext only and remain operation-bound.
        }
      }
      throw new JournalPasswordRemovalBlockedError(removalBlocked("storage-failed", "retry"));
    }
  }

  const { source, decrypted } = preparation;
  if (requiresRemoteFence) {
    source.settings = source.settings.map((setting) =>
      setting.key === SK.JOURNAL_SECURITY_REMOVAL
        ? { key: setting.key, value: fencedAttempt }
        : setting
    );
  }
  const {
    entries,
    photos: photoReceipts,
    audios: audioReceipts,
    settings,
    spaces,
    captures,
  } = source;
  const passwordRecord = settings.find((setting) => setting.key === JOURNAL_PASSWORD_KEY);
  const vaultRecord = settings.find((setting) => setting.key === JOURNAL_VAULT_KEY_SETTING_KEY);
  const updatedAt = Date.now();
  const {
    entries: decryptedEntries,
    drafts: decryptedDrafts,
    spaces: decryptedSpaces,
    captures: decryptedCaptures,
  } = decrypted;
  const cloudCleanupPending = fenceStatus === "ready";
  const removalPhotos = createMediaCleanupItems(
    photoReceipts.map((photo) => ({
      id: photo.id,
      entryId: photo.entryId,
      previousStoragePath: photo.previousStoragePath,
    }))
  );
  const removalAudios = createMediaCleanupItems(
    audioReceipts.map((audio) => ({
      id: audio.id,
      entryId: audio.entryId,
      previousStoragePath: audio.previousStoragePath,
    }))
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
      deletedEntries: [],
      deletedPhotos: [],
      deletedAudios: [],
      backupPending: cloudCleanupPending,
      attemptCount: 0,
    },
    localCommitInventory: await createLocalCommitInventory({
      entries: decryptedEntries,
      photos: photoReceipts,
      audios: audioReceipts,
      spaces: decryptedSpaces,
      captures: decryptedCaptures,
    }),
    status: "pending",
    lastError: undefined,
    photos: cloudCleanupPending ? removalPhotos : [],
    audios: cloudCleanupPending ? removalAudios : [],
  };

  let localTransactionCommitted = false;
  await assertJournalSecurityBoundary(boundary);
  try {
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
          db.journalPasswordRemovalMediaStage,
          db.offlineQueue,
        ],
        async () => {
          assertDataWriteBoundaryGeneration(boundary.generation);
          const [
            ownerRecord,
            currentPassword,
            currentVault,
            currentEntries,
            currentSettings,
            currentSpaces,
            currentCaptures,
            currentPhotoIds,
            currentAudioIds,
            operationStagedKeys,
            ownerStagedKeys,
          ] = await Promise.all([
            db.settings.get(SK.DATA_OWNER_ID),
            db.settings.get(JOURNAL_PASSWORD_KEY),
            db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
            db.journalEntries.toArray(),
            db.settings.toArray(),
            db.journalSpaces.toArray(),
            db.journalSpaceCaptures.toArray(),
            journalMediaPrimaryKeys("photo"),
            journalMediaPrimaryKeys("audio"),
            db.journalPasswordRemovalMediaStage
              .where("operationRevision")
              .equals(attempt.operationRevision)
              .primaryKeys(),
            db.journalPasswordRemovalMediaStage
              .where("[operationRevision+ownerUserId]")
              .equals([attempt.operationRevision, fencedAttempt.ownerUserId])
              .primaryKeys(),
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
            !structurallyEqual(
              currentPhotoIds,
              photoReceipts.map((photo) => photo.id).sort(compareCanonicalJournalInventoryKeys)
            ) ||
            !structurallyEqual(
              currentAudioIds,
              audioReceipts.map((audio) => audio.id).sort(compareCanonicalJournalInventoryKeys)
            ) ||
            !operationStagedKeys.every((key): key is string => typeof key === "string") ||
            !ownerStagedKeys.every((key): key is string => typeof key === "string") ||
            !structurallyEqual(
              [...operationStagedKeys].sort(compareCanonicalJournalInventoryKeys),
              [...ownerStagedKeys].sort(compareCanonicalJournalInventoryKeys)
            ) ||
            !structurallyEqual(
              [...ownerStagedKeys].sort(compareCanonicalJournalInventoryKeys),
              [...photoReceipts, ...audioReceipts]
                .flatMap((media) => (media.remoteStageKey ? [media.remoteStageKey] : []))
                .sort(compareCanonicalJournalInventoryKeys)
            ) ||
            !structurallyEqual(currentSettings, settings) ||
            !structurallyEqual(currentSpaces, spaces) ||
            !structurallyEqual(currentCaptures, captures)
          ) {
            throw new JournalPasswordRemovalBlockedError(
              removalBlocked("vault-revision-mismatch", "reload")
            );
          }

          if (decryptedEntries.length) {
            await db.journalEntries.bulkPut(decryptedEntries);
            const decryptedById = new Map(decryptedEntries.map((entry) => [entry.id, entry]));
            const queuedEntryUpserts = await db.offlineQueue
              .where("type")
              .equals("SYNC_JOURNAL_ENTRY")
              .and(
                (item) =>
                  item.ownerUserId === fencedAttempt.ownerUserId && decryptedById.has(item.entityId)
              )
              .toArray();
            for (const queued of queuedEntryUpserts) {
              const decryptedEntry = decryptedById.get(queued.entityId);
              if (!decryptedEntry) continue;
              await db.offlineQueue.update(queued.id, {
                payload: decryptedEntry,
                // Rotate the delivery identity so an already-running worker
                // holding the encrypted snapshot cannot acknowledge and erase
                // this newly authorized plaintext representation.
                operationId: `journal-removal:${generateSecureRandom(32)}`,
              });
            }
          }
          for (const receipt of photoReceipts) {
            const current = await db.journalPhotos.get(receipt.id);
            if (
              !current ||
              (await Dexie.waitFor(journalInventorySha256(current))) !== receipt.sourceRecordSha256
            ) {
              throw new JournalPasswordRemovalBlockedError(
                removalBlocked("vault-revision-mismatch", "reload")
              );
            }
            let sourceForDecryption = current;
            if (receipt.remoteStageKey) {
              const stage = await db.journalPasswordRemovalMediaStage.get(receipt.remoteStageKey);
              if (
                !stage ||
                stage.operationRevision !== attempt.operationRevision ||
                stage.ownerUserId !== fencedAttempt.ownerUserId ||
                stage.mediaKind !== "photo" ||
                stage.mediaId !== receipt.id ||
                stage.entryId !== receipt.entryId ||
                stage.sourceRecordSha256 !== receipt.sourceRecordSha256 ||
                !receipt.encryptedDataSha256 ||
                stage.encryptedDataSha256 !== receipt.encryptedDataSha256 ||
                !isEncryptedJournalMediaData(stage.encryptedData)
              ) {
                throw new JournalPasswordRemovalBlockedError(
                  removalBlocked("vault-revision-mismatch", "reload")
                );
              }
              const currentEncryptedDataSha256 = await Dexie.waitFor(
                journalInventorySha256(stage.encryptedData)
              );
              if (currentEncryptedDataSha256 !== receipt.encryptedDataSha256) {
                throw new JournalPasswordRemovalBlockedError(
                  removalBlocked("vault-revision-mismatch", "reload")
                );
              }
              sourceForDecryption = { ...current, data: stage.encryptedData };
            }
            if (receipt.protected) {
              if (!vaultKey) {
                throw new JournalPasswordRemovalBlockedError(
                  removalBlocked("unlock-required", "unlock")
                );
              }
              const decryptedPhoto = await Dexie.waitFor(
                decryptPhotoForRemoval(sourceForDecryption, vaultKey)
              );
              await db.journalPhotos.put(decryptedPhoto);
            }
          }
          for (const receipt of audioReceipts) {
            const current = await db.journalAudio.get(receipt.id);
            if (
              !current ||
              (await Dexie.waitFor(journalInventorySha256(current))) !== receipt.sourceRecordSha256
            ) {
              throw new JournalPasswordRemovalBlockedError(
                removalBlocked("vault-revision-mismatch", "reload")
              );
            }
            let sourceForDecryption = current;
            if (receipt.remoteStageKey) {
              const stage = await db.journalPasswordRemovalMediaStage.get(receipt.remoteStageKey);
              if (
                !stage ||
                stage.operationRevision !== attempt.operationRevision ||
                stage.ownerUserId !== fencedAttempt.ownerUserId ||
                stage.mediaKind !== "audio" ||
                stage.mediaId !== receipt.id ||
                stage.entryId !== receipt.entryId ||
                stage.sourceRecordSha256 !== receipt.sourceRecordSha256 ||
                !receipt.encryptedDataSha256 ||
                stage.encryptedDataSha256 !== receipt.encryptedDataSha256 ||
                !isEncryptedJournalMediaData(stage.encryptedData)
              ) {
                throw new JournalPasswordRemovalBlockedError(
                  removalBlocked("vault-revision-mismatch", "reload")
                );
              }
              const currentEncryptedDataSha256 = await Dexie.waitFor(
                journalInventorySha256(stage.encryptedData)
              );
              if (currentEncryptedDataSha256 !== receipt.encryptedDataSha256) {
                throw new JournalPasswordRemovalBlockedError(
                  removalBlocked("vault-revision-mismatch", "reload")
                );
              }
              sourceForDecryption = { ...current, data: stage.encryptedData };
            }
            if (receipt.protected) {
              if (!vaultKey) {
                throw new JournalPasswordRemovalBlockedError(
                  removalBlocked("unlock-required", "unlock")
                );
              }
              const decryptedAudio = await Dexie.waitFor(
                decryptAudioForRemoval(sourceForDecryption, vaultKey)
              );
              await db.journalAudio.put(decryptedAudio);
            }
          }
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
          await db.journalPasswordRemovalMediaStage
            .where("[operationRevision+ownerUserId]")
            .equals([attempt.operationRevision, fencedAttempt.ownerUserId])
            .delete();

          const finalSessionOwnerUserId = await Dexie.waitFor(getCurrentSessionUserId());
          assertDataWriteBoundaryGeneration(boundary.generation);
          if (finalSessionOwnerUserId !== boundary.sessionOwnerUserId) {
            throw new Error("Account boundary changed during diary protection");
          }
        }
      );
      localTransactionCommitted = true;
    });
  } catch (error) {
    if (isDataWriteBarrierPostCommitError(error) || localTransactionCommitted) {
      logger.error(
        "[Journal] Diary password removal committed locally; post-commit finalization remains pending",
        {
          issueKinds: isDataWriteBarrierPostCommitError(error)
            ? [...error.issueKinds]
            : ["boundary-finalization"],
        }
      );
    } else {
      const blocker =
        error instanceof JournalPasswordRemovalBlockedError ? error.code : "storage-failed";
      let settlement: FailedLocalCommitFenceSettlement | null = null;
      if (requiresRemoteFence && remoteFenceEstablished) {
        try {
          settlement = await settleRemoteFenceAfterFailedLocalCommit(fencedAttempt, boundary);
        } catch {
          settlement = { status: "pending" };
        }
      }
      if (settlement?.status === "local-committed") {
        return atomicRemovalResultFromIntent(settlement.intent);
      }
      if (!requiresRemoteFence || !remoteFenceEstablished) {
        try {
          await persistBlockedRemovalAttempt(fencedAttempt, blocker);
        } catch {
          // The durable intent still blocks cleanup and exposes recovery state.
        }
        try {
          await clearJournalPasswordRemovalMediaStage(
            attempt.operationRevision,
            attempt.ownerUserId
          );
        } catch {
          // The staged rows contain ciphertext only and remain operation-bound.
        }
      }
      throw error;
    }
  }
  emitMigrationUpdate();
  return atomicRemovalResultFromIntent(removalIntent);
}

/**
 * Serializes the complete removal attempt across same-origin tabs and
 * WebViews. This independent lock preserves the established DATA -> JOURNAL
 * lock order used by the transactional commit.
 */
export function removeJournalPasswordProtectionAtomically(
  vaultKey: string | null,
  boundary: JournalSecurityBoundary
): Promise<JournalPasswordProtectionAtomicResult> {
  return runWithOriginExclusiveLock(JOURNAL_PASSWORD_REMOVAL_OPERATION_LOCK, () =>
    removeJournalPasswordProtectionAtomicallyInternal(vaultKey, boundary)
  );
}

export async function ensureJournalSecurityRemovalQueued(
  suppliedIntent?: JournalSecurityRemovalIntent
): Promise<boolean> {
  const intent = suppliedIntent ?? (await getJournalSecurityRemovalIntent());
  if (
    !intent ||
    (intent.cloudCleanup.status !== "pending" && intent.cloudCleanup.status !== "blocked")
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
      "attemptCount" in current.nativeCleanup ? current.nativeCleanup.attemptCount : 0;
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
    payload && typeof payload === "object" && (payload as { mode?: unknown }).mode === "remove"
  );
}

const JOURNAL_SECURITY_QUEUE_SLICE_MAX_REMOTE_STEPS = 8;
const JOURNAL_SECURITY_QUEUE_SLICE_TIMEOUT_MS = 20_000;

export interface JournalSecurityMigrationRunOptions {
  maxRemoteSteps?: number;
  workBudgetMs?: number;
}

export type JournalSecurityMigrationRunResult = "complete" | "deferred";

class JournalSecurityWorkBudgetExhaustedError extends Error {
  constructor() {
    super("Diary security migration work slice is complete");
    this.name = "JournalSecurityWorkBudgetExhaustedError";
  }
}

interface JournalSecurityWorkContext {
  readonly signal?: AbortSignal;
  readonly budgetExhausted: () => boolean;
  assertActive(): void;
  consumeRemoteStep(): void;
  dispose(): void;
}

function createJournalSecurityWorkContext(
  externalSignal?: AbortSignal,
  options?: JournalSecurityMigrationRunOptions
): JournalSecurityWorkContext {
  const shouldBoundQueueWork = Boolean(externalSignal) || options !== undefined;
  const maxRemoteSteps =
    options?.maxRemoteSteps ??
    (shouldBoundQueueWork
      ? JOURNAL_SECURITY_QUEUE_SLICE_MAX_REMOTE_STEPS
      : Number.POSITIVE_INFINITY);
  const workBudgetMs =
    options?.workBudgetMs ??
    (shouldBoundQueueWork ? JOURNAL_SECURITY_QUEUE_SLICE_TIMEOUT_MS : Number.POSITIVE_INFINITY);
  if (
    !(
      maxRemoteSteps === Number.POSITIVE_INFINITY ||
      (Number.isSafeInteger(maxRemoteSteps) && maxRemoteSteps > 0)
    ) ||
    !(
      workBudgetMs === Number.POSITIVE_INFINITY ||
      (Number.isSafeInteger(workBudgetMs) && workBudgetMs > 0)
    )
  ) {
    throw new Error("Diary security migration requires a positive work budget");
  }

  const controller = new AbortController();
  let remainingRemoteSteps = maxRemoteSteps;
  let exhausted = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const forwardExternalAbort = () => {
    if (!controller.signal.aborted) controller.abort(externalSignal?.reason);
  };
  if (externalSignal?.aborted) {
    forwardExternalAbort();
  } else {
    externalSignal?.addEventListener("abort", forwardExternalAbort, { once: true });
  }
  if (workBudgetMs !== Number.POSITIVE_INFINITY) {
    timeoutId = setTimeout(() => {
      exhausted = true;
      if (!controller.signal.aborted) {
        controller.abort(new JournalSecurityWorkBudgetExhaustedError());
      }
    }, workBudgetMs);
  }

  const assertActive = () => {
    if (!controller.signal.aborted) return;
    if (controller.signal.reason instanceof Error) throw controller.signal.reason;
    throw new DOMException("Diary security migration was aborted", "AbortError");
  };

  return {
    signal: shouldBoundQueueWork ? controller.signal : externalSignal,
    budgetExhausted: () => exhausted,
    assertActive,
    consumeRemoteStep: () => {
      assertActive();
      if (remainingRemoteSteps <= 0) {
        exhausted = true;
        throw new JournalSecurityWorkBudgetExhaustedError();
      }
      remainingRemoteSteps -= 1;
    },
    dispose: () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", forwardExternalAbort);
    },
  };
}

function requiredJournalRemoteCommitOptions(ownerUserId: string, signal?: AbortSignal) {
  const base = {
    expectedOwnerUserId: ownerUserId,
    requireRemoteCommit: true as const,
  };
  return signal ? { ...base, signal } : base;
}

function journalRemovalFenceInput(
  intent: Pick<JournalSecurityRemovalIntent, "operationRevision" | "expectedVaultRevision">,
  ownerUserId: string,
  signal?: AbortSignal
) {
  const base = {
    expectedOwnerUserId: ownerUserId,
    expectedVaultRevision: intent.expectedVaultRevision,
    operationRevision: intent.operationRevision,
  };
  return signal ? { ...base, signal } : base;
}

function withJournalSecuritySignal<T extends object>(
  value: T,
  signal?: AbortSignal
): T & { signal?: AbortSignal } {
  return signal ? { ...value, signal } : value;
}

async function loadCurrentRemovalIntent(
  payload: unknown,
  ownerUserId: string
): Promise<JournalSecurityRemovalIntent> {
  const revision = revisionFromPayload(payload);
  const intent = await getJournalSecurityRemovalIntent();
  if (!revision || !intent || intent.revision !== revision || intent.ownerUserId !== ownerUserId) {
    throw new Error("Diary protection removal intent is missing or belongs to another account");
  }
  return intent;
}

async function runJournalSecurityRemoval(
  payload: unknown,
  ownerUserId: string,
  work: JournalSecurityWorkContext
): Promise<void> {
  work.assertActive();
  let intent = await loadCurrentRemovalIntent(payload, ownerUserId);
  await validateSyncOwner(ownerUserId, "Diary protection removal backup");
  work.assertActive();
  await runWithJournalSecurityWriteLock(async () => {
    work.assertActive();
    await validateSyncOwner(ownerUserId, "Diary protection removal local preflight");
    await loadCurrentRemovalIntent(payload, ownerUserId);
    const [passwordRecord, vaultRecord] = await Promise.all([
      db.settings.get(JOURNAL_PASSWORD_KEY),
      db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
    ]);
    if (passwordRecord?.value || vaultRecord?.value) {
      throw new Error("Diary protection was re-enabled before cloud removal completed");
    }
  });

  if (intent.legacyOrigin) {
    if (!intent.legacyRecoveryChecked) {
      work.consumeRemoteStep();
      const remoteRecovery = await recoverRemoteJournalPasswordRemoval(
        withJournalSecuritySignal({ expectedOwnerUserId: ownerUserId }, work.signal)
      );
      work.assertActive();
      if (remoteRecovery.status !== "not-pending") {
        if (
          remoteRecovery.operationRevision !== intent.operationRevision ||
          remoteRecovery.vaultRevision !== intent.expectedVaultRevision
        ) {
          throw new Error("Legacy diary removal recovery does not match the durable operation");
        }
        if (remoteRecovery.status === "complete") {
          const cloudCleanup: JournalCloudCleanupState = {
            ...emptyRemovalCloudCleanup(),
            status: "complete",
            stage: "complete",
          };
          await persistRemovalIntent(
            {
              ...intent,
              updatedAt: Date.now(),
              phase: "cleanup-pending",
              blocker: undefined,
              legacyOrigin: undefined,
              legacyRecoveryChecked: undefined,
              legacyMediaCursor: undefined,
              legacyStorageObjects: undefined,
              cloudCleanup,
              photos: [],
              audios: [],
            },
            intent.operationRevision
          );
          return;
        }
      }
      const recoveryChecked: JournalSecurityRemovalIntent = {
        ...intent,
        updatedAt: Date.now(),
        legacyRecoveryChecked: true,
        legacyMediaCursor: intent.legacyMediaCursor ?? 0,
        legacyStorageObjects: intent.legacyStorageObjects ?? [],
      };
      await persistRemovalIntent(recoveryChecked, intent.operationRevision);
      intent = recoveryChecked;
    }

    const snapshot = await readLocalJournalProtectionSnapshot();
    work.assertActive();
    if (localJournalSnapshotHasProtection(snapshot)) {
      throw new Error(
        "Legacy diary removal requires explicit unlock recovery before remote mutation"
      );
    }

    const descriptors = legacyMediaDescriptors(intent);
    let legacyMediaCursor = intent.legacyMediaCursor ?? 0;
    let storageObjects = [...(intent.legacyStorageObjects ?? [])];
    while (legacyMediaCursor < descriptors.length) {
      const media = descriptors[legacyMediaCursor];
      work.consumeRemoteStep();
      const identity = work.signal
        ? await readJournalMediaStorageIdentity(media.bucket, media.path, ownerUserId, work.signal)
        : await readJournalMediaStorageIdentity(media.bucket, media.path, ownerUserId);
      work.assertActive();
      if (!identity) {
        throw new Error("Legacy diary media identity is unavailable for exact recovery");
      }
      storageObjects = [...storageObjects, identity];
      legacyMediaCursor += 1;
      const identityProgress: JournalSecurityRemovalIntent = {
        ...intent,
        updatedAt: Date.now(),
        legacyRecoveryChecked: true,
        legacyMediaCursor,
        legacyStorageObjects: storageObjects,
      };
      await persistRemovalIntent(identityProgress, intent.operationRevision);
      intent = identityProgress;
    }

    const inventory = await buildJournalPasswordRemovalInventory(
      snapshot,
      storageObjects,
      true,
      work.signal
    );
    work.consumeRemoteStep();
    const fenceStatus = await beginRemoteJournalPasswordRemoval(
      withJournalSecuritySignal(
        {
          expectedOwnerUserId: ownerUserId,
          expectedVaultRevision: intent.expectedVaultRevision,
          operationRevision: intent.operationRevision,
          inventory,
        },
        work.signal
      )
    );
    work.assertActive();

    const legacyPhotos = createMediaCleanupItems(
      snapshot.photos.map((photo) => ({
        id: photo.id,
        entryId: photo.entryId,
        previousStoragePath:
          intent.photos.find((item) => item.id === photo.id)?.previousStoragePath ??
          photo.storagePath,
      }))
    );
    const legacyAudios = createMediaCleanupItems(
      snapshot.audios.map((audio) => ({
        id: audio.id,
        entryId: audio.entryId,
        previousStoragePath:
          intent.audios.find((item) => item.id === audio.id)?.previousStoragePath ??
          audio.storagePath,
      }))
    );
    const cloudCleanup: JournalCloudCleanupState =
      fenceStatus === "complete"
        ? {
            ...emptyRemovalCloudCleanup(),
            status: "complete",
            stage: "complete",
          }
        : {
            status: "pending",
            stage: "entries",
            entryIds: snapshot.entries.map((entry) => entry.id),
            photos: legacyPhotos,
            audios: legacyAudios,
            deletedEntries: [],
            deletedPhotos: [],
            deletedAudios: [],
            backupPending: true,
            attemptCount: intent.cloudCleanup.attemptCount,
          };
    const adopted: JournalSecurityRemovalIntent = {
      ...intent,
      updatedAt: Date.now(),
      phase: "cleanup-pending",
      blocker: undefined,
      legacyOrigin: undefined,
      legacyRecoveryChecked: undefined,
      legacyMediaCursor: undefined,
      legacyStorageObjects: undefined,
      cloudCleanup,
      localCommitInventory: await createLocalCommitInventory(snapshot),
      photos: cloudCleanup.photos,
      audios: cloudCleanup.audios,
    };
    await persistRemovalIntent(adopted, intent.operationRevision);
    intent = adopted;
  }

  const saveCloudProgress = async (
    next: JournalSecurityRemovalIntent
  ): Promise<JournalSecurityRemovalIntent> => {
    work.assertActive();
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
    work.assertActive();
    intent = persisted;
    return persisted;
  };

  const acknowledgeCloudCompletion = async (): Promise<void> => {
    work.assertActive();
    const completed: JournalSecurityRemovalIntent = {
      ...intent,
      updatedAt: Date.now(),
      cloudCleanup: {
        ...intent.cloudCleanup,
        status: "complete",
        stage: "complete",
        entryIds: [],
        photos: [],
        audios: [],
        deletedEntries: [],
        deletedPhotos: [],
        deletedAudios: [],
        backupPending: false,
        blocker: undefined,
      },
      photos: [],
      audios: [],
    };
    await persistRemovalIntent(
      removalCleanupComplete(completed) ? null : completed,
      intent.operationRevision
    );
    work.assertActive();
  };

  if (intent.cloudCleanup.status === "complete") {
    await acknowledgeCloudCompletion();
    return;
  }

  const deleteRemovalStoragePaths = async (
    bucket: "journal-photos" | "journal-audio",
    paths: readonly string[]
  ): Promise<void> => {
    for (const path of paths) {
      work.consumeRemoteStep();
      await deleteJournalMediaStoragePath(bucket, path, ownerUserId, work.signal);
      work.assertActive();
    }
  };

  for (const deletedEntry of [...intent.cloudCleanup.deletedEntries]) {
    work.consumeRemoteStep();
    await deleteRemoteJournalPasswordRemovalArtifact({
      ...journalRemovalFenceInput(intent, ownerUserId, work.signal),
      surface: "entry",
      entityId: deletedEntry.id,
    });
    work.assertActive();
    await deleteRemovalStoragePaths("journal-photos", deletedEntry.photoStoragePaths);
    await deleteRemovalStoragePaths("journal-audio", deletedEntry.audioStoragePaths);
    await saveCloudProgress({
      ...intent,
      cloudCleanup: {
        ...intent.cloudCleanup,
        stage: "entries",
        deletedEntries: intent.cloudCleanup.deletedEntries.filter(
          (item) => item.id !== deletedEntry.id
        ),
      },
    });
  }

  for (const deletedPhoto of [...intent.cloudCleanup.deletedPhotos]) {
    const parentEntry = await db.journalEntries.get(deletedPhoto.entryId);
    if (!parentEntry || parentEntry.photoIds.includes(deletedPhoto.id)) {
      throw new Error("Diary photo deletion parent state is unavailable");
    }
    work.consumeRemoteStep();
    await deleteRemoteJournalPasswordRemovalArtifact({
      ...journalRemovalFenceInput(intent, ownerUserId, work.signal),
      surface: "photo",
      entityId: deletedPhoto.id,
      parentEntry,
    });
    work.assertActive();
    await deleteRemovalStoragePaths("journal-photos", deletedPhoto.storagePaths);
    await saveCloudProgress({
      ...intent,
      cloudCleanup: {
        ...intent.cloudCleanup,
        stage: "photos",
        deletedPhotos: intent.cloudCleanup.deletedPhotos.filter(
          (item) => item.id !== deletedPhoto.id
        ),
      },
    });
  }

  for (const deletedAudio of [...intent.cloudCleanup.deletedAudios]) {
    const parentEntry = await db.journalEntries.get(deletedAudio.entryId);
    if (!parentEntry || parentEntry.audioIds?.includes(deletedAudio.id)) {
      throw new Error("Diary audio deletion parent state is unavailable");
    }
    work.consumeRemoteStep();
    await deleteRemoteJournalPasswordRemovalArtifact({
      ...journalRemovalFenceInput(intent, ownerUserId, work.signal),
      surface: "audio",
      entityId: deletedAudio.id,
      parentEntry,
    });
    work.assertActive();
    await deleteRemovalStoragePaths("journal-audio", deletedAudio.storagePaths);
    await saveCloudProgress({
      ...intent,
      cloudCleanup: {
        ...intent.cloudCleanup,
        stage: "audio",
        deletedAudios: intent.cloudCleanup.deletedAudios.filter(
          (item) => item.id !== deletedAudio.id
        ),
      },
    });
  }

  for (const entryId of [...intent.cloudCleanup.entryIds]) {
    work.assertActive();
    const entry = await db.journalEntries.get(entryId);
    if (!entry || (entry.content && isEncryptedJournalContent(entry.content))) {
      throw new Error("Plaintext diary entry is unavailable for remote acknowledgement");
    }
    work.consumeRemoteStep();
    await commitRemoteJournalPasswordRemovalEntry({
      ...journalRemovalFenceInput(intent, ownerUserId, work.signal),
      entry,
    });
    work.assertActive();
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
      const prepared = await preparePhotoForPasswordRemovalUpload(
        photo.id,
        photo.data,
        ownerUserId,
        intent.operationRevision,
        work.signal
      );
      if (!progress.replacementStoragePath) {
        progress = {
          ...progress,
          replacementStoragePath: prepared.path,
          replacementContentSha256: prepared.contentSha256,
          replacementContentSize: prepared.contentSize,
          replacementMimeType: prepared.mimeType,
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
      } else if (!journalRemovalPreparedUploadMatches(progress, prepared)) {
        throw new Error("Diary photo replacement receipt changed before retry");
      }
      work.consumeRemoteStep();
      await reserveRemoteJournalPasswordRemovalMedia({
        ...journalRemovalFenceInput(intent, ownerUserId, work.signal),
        bucket: "journal-photos",
        entityId: photo.id,
        storagePath: prepared.path,
        contentSha256: prepared.contentSha256,
        contentSize: prepared.contentSize,
        mimeType: prepared.mimeType,
      });
      work.assertActive();
      work.consumeRemoteStep();
      const upload = await uploadPreparedJournalPasswordRemovalMedia(
        prepared,
        ownerUserId,
        intent.operationRevision,
        work.signal
      );
      work.assertActive();
      if (!upload) throw new Error("Plaintext diary photo upload was not acknowledged");
      await validateSyncOwner(ownerUserId, "Diary protection photo replacement");
      await db.journalPhotos.update(photo.id, {
        storagePath: upload.path,
        storageUrl: undefined,
      });
      progress = {
        ...progress,
        replacementUploaded: true,
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
      work.consumeRemoteStep();
      await commitRemoteJournalPasswordRemovalPhoto({
        ...journalRemovalFenceInput(intent, ownerUserId, work.signal),
        photo: { ...photo, storagePath: progress.replacementStoragePath },
      });
      work.assertActive();
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
        work.consumeRemoteStep();
        if (work.signal) {
          await deleteJournalMediaStoragePath(
            "journal-photos",
            progress.previousStoragePath,
            ownerUserId,
            work.signal
          );
        } else {
          await deleteJournalMediaStoragePath(
            "journal-photos",
            progress.previousStoragePath,
            ownerUserId
          );
        }
        work.assertActive();
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
      const prepared = await prepareAudioForPasswordRemovalUpload(
        audio.id,
        audio.data,
        audio.mimeType,
        ownerUserId,
        intent.operationRevision,
        work.signal
      );
      if (!progress.replacementStoragePath) {
        progress = {
          ...progress,
          replacementStoragePath: prepared.path,
          replacementContentSha256: prepared.contentSha256,
          replacementContentSize: prepared.contentSize,
          replacementMimeType: prepared.mimeType,
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
      } else if (!journalRemovalPreparedUploadMatches(progress, prepared)) {
        throw new Error("Diary audio replacement receipt changed before retry");
      }
      work.consumeRemoteStep();
      await reserveRemoteJournalPasswordRemovalMedia({
        ...journalRemovalFenceInput(intent, ownerUserId, work.signal),
        bucket: "journal-audio",
        entityId: audio.id,
        storagePath: prepared.path,
        contentSha256: prepared.contentSha256,
        contentSize: prepared.contentSize,
        mimeType: prepared.mimeType,
      });
      work.assertActive();
      work.consumeRemoteStep();
      const upload = await uploadPreparedJournalPasswordRemovalMedia(
        prepared,
        ownerUserId,
        intent.operationRevision,
        work.signal
      );
      work.assertActive();
      if (!upload) throw new Error("Plaintext diary audio upload was not acknowledged");
      await validateSyncOwner(ownerUserId, "Diary protection audio replacement");
      await db.journalAudio.update(audio.id, {
        storagePath: upload.path,
        storageUrl: undefined,
      });
      progress = {
        ...progress,
        replacementUploaded: true,
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
      work.consumeRemoteStep();
      const parentEntry = await db.journalEntries.get(audio.entryId);
      if (!parentEntry) {
        throw new Error("Diary audio parent is unavailable for remote acknowledgement");
      }
      await commitRemoteJournalPasswordRemovalAudio({
        ...journalRemovalFenceInput(intent, ownerUserId, work.signal),
        audio: { ...audio, storagePath: progress.replacementStoragePath },
        parentEntry,
      });
      work.assertActive();
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
        work.consumeRemoteStep();
        if (work.signal) {
          await deleteJournalMediaStoragePath(
            "journal-audio",
            progress.previousStoragePath,
            ownerUserId,
            work.signal
          );
        } else {
          await deleteJournalMediaStoragePath(
            "journal-audio",
            progress.previousStoragePath,
            ownerUserId
          );
        }
        work.assertActive();
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

  if (intent.cloudCleanup.backupPending) {
    if (!intent.localCommitInventory) {
      throw new Error("Diary removal local commit inventory is unavailable");
    }
    const currentSnapshot = await readLocalJournalProtectionSnapshot();
    work.assertActive();
    if (!localSnapshotCoversCommitInventory(currentSnapshot, intent.localCommitInventory)) {
      throw new Error("Diary removal local commit inventory is incomplete");
    }
    work.consumeRemoteStep();
    await patchJournalBackupForPasswordRemoval(
      withJournalSecuritySignal(
        {
          expectedOwnerUserId: ownerUserId,
          expectedVaultRevision: intent.expectedVaultRevision,
          operationRevision: intent.operationRevision,
          localCommitInventory: intent.localCommitInventory,
        },
        work.signal
      )
    );
    work.assertActive();
  }
  await saveCloudProgress({
    ...intent,
    cloudCleanup: {
      ...intent.cloudCleanup,
      stage: "verify-protected-objects",
      backupPending: false,
    },
  });
  work.consumeRemoteStep();
  await verifyRemoteJournalIsUnprotected(
    withJournalSecuritySignal(
      {
        expectedOwnerUserId: ownerUserId,
        operationRevision: intent.operationRevision,
      },
      work.signal
    )
  );
  work.assertActive();
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
      throw new Error("Diary protection was re-enabled before cloud removal completed");
    }
    if (current.revision !== intent.revision) {
      throw new Error("Diary protection removal changed during cloud completion");
    }
  });
  work.consumeRemoteStep();
  await finalizeRemoteJournalPasswordRemoval(
    withJournalSecuritySignal(
      {
        expectedOwnerUserId: ownerUserId,
        expectedVaultRevision: intent.expectedVaultRevision,
        operationRevision: intent.operationRevision,
      },
      work.signal
    )
  );
  work.assertActive();
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
  ownerUserId: string,
  work: JournalSecurityWorkContext
): Promise<void> {
  work.assertActive();
  let intent = await loadCurrentIntent(payload, ownerUserId);
  await validateSyncOwner(ownerUserId, "Diary protection migration");
  work.assertActive();

  if (intent.vaultSettingPending) {
    const vaultRecord = await db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY);
    if (!vaultRecord?.value) throw new Error("Wrapped diary key is missing");
    work.consumeRemoteStep();
    await syncSetting(
      JOURNAL_VAULT_KEY_SETTING_KEY,
      vaultRecord.value,
      ownerUserId,
      withJournalSecuritySignal({ requireRemoteCommit: true }, work.signal)
    );
    work.assertActive();
    intent = { ...intent, vaultSettingPending: false };
    await saveProgress(intent);
  }

  for (const entryId of [...intent.entryIds]) {
    const entry = await db.journalEntries.get(entryId);
    if (!entry || !entry.content || !isEncryptedJournalContent(entry.content)) {
      throw new Error("Encrypted diary entry is unavailable");
    }
    work.consumeRemoteStep();
    await syncJournalEntry(entry, requiredJournalRemoteCommitOptions(ownerUserId, work.signal));
    work.assertActive();
    intent = { ...intent, entryIds: intent.entryIds.filter((id) => id !== entryId) };
    await saveProgress(intent);
  }

  for (const mediaIntent of [...intent.photos]) {
    const photo = await db.journalPhotos.get(mediaIntent.id);
    if (!photo?.data || !isEncryptedJournalMediaData(photo.data)) {
      throw new Error("Encrypted diary photo is unavailable");
    }
    const photoVaultRevision = storedVaultRevision(photo.vaultRevision);
    if (photoVaultRevision === null) {
      throw new Error("Encrypted diary photo epoch is unavailable");
    }
    work.consumeRemoteStep();
    const upload = work.signal
      ? await uploadEncryptedPhoto(
          photo.id,
          encryptedJournalMediaToStorageBlob(photo.data),
          ownerUserId,
          photoVaultRevision,
          work.signal
        )
      : await uploadEncryptedPhoto(
          photo.id,
          encryptedJournalMediaToStorageBlob(photo.data),
          ownerUserId,
          photoVaultRevision
        );
    work.assertActive();
    if (!upload) throw new Error("Encrypted diary photo upload failed");
    await validateSyncOwner(ownerUserId, "Diary photo migration commit");
    await syncJournalPhoto(
      { ...photo, storagePath: upload.path },
      requiredJournalRemoteCommitOptions(ownerUserId, work.signal)
    );
    work.assertActive();
    await validateSyncOwner(ownerUserId, "Diary photo migration local commit");
    await db.journalPhotos.update(photo.id, { storagePath: upload.path });
    if (mediaIntent.previousStoragePath && mediaIntent.previousStoragePath !== upload.path) {
      work.consumeRemoteStep();
      if (work.signal) {
        await deleteJournalMediaStoragePath(
          "journal-photos",
          mediaIntent.previousStoragePath,
          ownerUserId,
          work.signal
        );
      } else {
        await deleteJournalMediaStoragePath(
          "journal-photos",
          mediaIntent.previousStoragePath,
          ownerUserId
        );
      }
      work.assertActive();
    }
    intent = { ...intent, photos: intent.photos.filter(({ id }) => id !== photo.id) };
    await saveProgress(intent);
  }

  for (const mediaIntent of [...intent.audios]) {
    const audio = await db.journalAudio.get(mediaIntent.id);
    if (!audio?.data || !isEncryptedJournalMediaData(audio.data)) {
      throw new Error("Encrypted diary audio is unavailable");
    }
    const audioVaultRevision = storedVaultRevision(audio.vaultRevision);
    if (audioVaultRevision === null) {
      throw new Error("Encrypted diary audio epoch is unavailable");
    }
    work.consumeRemoteStep();
    const upload = work.signal
      ? await uploadEncryptedAudio(
          audio.id,
          encryptedJournalMediaToStorageBlob(audio.data),
          ownerUserId,
          audioVaultRevision,
          work.signal
        )
      : await uploadEncryptedAudio(
          audio.id,
          encryptedJournalMediaToStorageBlob(audio.data),
          ownerUserId,
          audioVaultRevision
        );
    work.assertActive();
    if (!upload) throw new Error("Encrypted diary audio upload failed");
    await validateSyncOwner(ownerUserId, "Diary audio migration commit");
    await syncJournalAudio(
      { ...audio, storagePath: upload.path },
      requiredJournalRemoteCommitOptions(ownerUserId, work.signal)
    );
    work.assertActive();
    await validateSyncOwner(ownerUserId, "Diary audio migration local commit");
    await db.journalAudio.update(audio.id, { storagePath: upload.path });
    if (mediaIntent.previousStoragePath && mediaIntent.previousStoragePath !== upload.path) {
      work.consumeRemoteStep();
      if (work.signal) {
        await deleteJournalMediaStoragePath(
          "journal-audio",
          mediaIntent.previousStoragePath,
          ownerUserId,
          work.signal
        );
      } else {
        await deleteJournalMediaStoragePath(
          "journal-audio",
          mediaIntent.previousStoragePath,
          ownerUserId
        );
      }
      work.assertActive();
    }
    intent = { ...intent, audios: intent.audios.filter(({ id }) => id !== audio.id) };
    await saveProgress(intent);
  }
}

async function runJournalSecurityMigrationInternal(
  payload: unknown,
  ownerUserId: string,
  externalSignal?: AbortSignal,
  options?: JournalSecurityMigrationRunOptions
): Promise<JournalSecurityMigrationRunResult> {
  const work = createJournalSecurityWorkContext(externalSignal, options);
  try {
    if (isRemovalPayload(payload)) {
      await runJournalSecurityRemoval(payload, ownerUserId, work);
      return "complete";
    }
    await runWithJournalSecurityWriteLock(() =>
      runJournalSecurityMigrationLocalStepsUnlocked(payload, ownerUserId, work)
    );

    const intent = await loadCurrentIntent(payload, ownerUserId);
    if (!intent.backupPending) return "complete";
    work.assertActive();
    await validateSyncOwner(ownerUserId, "Diary protection backup migration");
    if (!getJournalContentVaultKey()) {
      throw new Error("Unlock the diary to replace its online backup safely");
    }

    // Backup merge may import protected diary rows and therefore acquire the
    // journal write lock itself. Run it after releasing the local migration lock.
    const { syncWithCloud } = await import("@/storage/cloudSync");
    work.consumeRemoteStep();
    const result = work.signal
      ? await syncWithCloud("merge", ownerUserId, work.signal)
      : await syncWithCloud("merge", ownerUserId);
    work.assertActive();
    if (result.status === "aborted") {
      throw new Error("Diary backup migration was interrupted");
    }

    await runWithJournalSecurityWriteLock(async () => {
      work.assertActive();
      const current = await loadCurrentIntent(payload, ownerUserId);
      await validateSyncOwner(ownerUserId, "Diary protection backup commit");
      work.assertActive();
      if (current.backupPending) {
        await saveProgress({ ...current, backupPending: false });
      }
    });
    return "complete";
  } catch (error) {
    if (work.budgetExhausted() || error instanceof JournalSecurityWorkBudgetExhaustedError) {
      return "deferred";
    }
    throw error;
  } finally {
    work.dispose();
  }
}

let journalSecurityMigrationRunTail: Promise<void> = Promise.resolve();

export function runJournalSecurityMigration(
  payload: unknown,
  ownerUserId: string,
  externalSignal?: AbortSignal,
  options?: JournalSecurityMigrationRunOptions
): Promise<JournalSecurityMigrationRunResult> {
  const operation = journalSecurityMigrationRunTail.then(
    () => runJournalSecurityMigrationInternal(payload, ownerUserId, externalSignal, options),
    () => runJournalSecurityMigrationInternal(payload, ownerUserId, externalSignal, options)
  );
  journalSecurityMigrationRunTail = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}
