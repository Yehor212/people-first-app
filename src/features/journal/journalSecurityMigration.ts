import Dexie from "dexie";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { offlineQueue } from "@/lib/offlineQueue";
import { logger } from "@/lib/logger";
import { generateSecureRandom } from "@/lib/validation";
import { SK } from "@/lib/storageKeys";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { deleteSettingFromCloud, syncSetting } from "@/storage/sync/syncSettings";
import { syncJournalAudio, syncJournalEntry, syncJournalPhoto } from "@/storage/realtimeSync";
import {
  deleteJournalMediaStoragePath,
  uploadEncryptedAudio,
  uploadEncryptedPhoto,
} from "@/storage/journalStorageService";
import {
  decryptJournalContentIfNeeded,
  encryptJournalContent,
  isEncryptedJournalContent,
} from "./journalCrypto";
import {
  decryptJournalMediaDataUrlIfNeeded,
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
import { assertAutomationHistoryClearedForVaultRemoval } from "./journalAutomationVaultGuard";

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
  lastError?: string;
  vaultSettingPending: boolean;
  backupPending: boolean;
  entryIds: string[];
  photos: JournalSecurityMediaIntent[];
  audios: JournalSecurityMediaIntent[];
}

export interface JournalSecurityRemovalIntent {
  version: 1;
  revision: string;
  ownerUserId: string;
  createdAt: number;
  status: "pending" | "queued" | "enqueue-failed";
  lastError?: string;
  photos?: JournalSecurityMediaIntent[];
  audios?: JournalSecurityMediaIntent[];
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

function isRemovalIntent(value: unknown): value is JournalSecurityRemovalIntent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JournalSecurityRemovalIntent>;
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

function emitMigrationUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(JOURNAL_SECURITY_MIGRATION_EVENT));
  }
}

export async function getJournalSecurityMigrationIntent(): Promise<JournalSecurityMigrationIntent | null> {
  const record = await db.settings.get(SK.JOURNAL_SECURITY_MIGRATION);
  return isMigrationIntent(record?.value) ? record.value : null;
}

export async function getJournalSecurityRemovalIntent(): Promise<JournalSecurityRemovalIntent | null> {
  const record = await db.settings.get(SK.JOURNAL_SECURITY_REMOVAL);
  return isRemovalIntent(record?.value) ? record.value : null;
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
  const record = await db.settings.get(SK.JOURNAL_SECURITY_MIGRATION);
  if (!isMigrationIntent(record?.value)) return false;
  const intent = record.value;
  const entryIds = new Set(input.entryIds ?? []);
  const photoIds = new Set(input.photoIds ?? []);
  const audioIds = new Set(input.audioIds ?? []);
  const nextIntent: JournalSecurityMigrationIntent = {
    ...intent,
    entryIds: intent.entryIds.filter((id) => !entryIds.has(id)),
    photos: intent.photos.filter(({ id }) => !photoIds.has(id)),
    audios: intent.audios.filter(({ id }) => !audioIds.has(id)),
  };
  if (isJournalSecurityMigrationComplete(nextIntent)) {
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
  } else {
    await db.settings.put({
      key: SK.JOURNAL_SECURITY_MIGRATION,
      value: nextIntent,
    });
  }
  return true;
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
  updatedAt: number
): Promise<JournalEntry> {
  if (!entry.content || isEncryptedJournalContent(entry.content)) return entry;
  return {
    ...entry,
    content: await encryptJournalContent(entry.content, vaultKey),
    updatedAt,
  };
}

async function encryptPhoto(photo: JournalPhoto, vaultKey: string): Promise<JournalPhoto> {
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
  };
}

async function encryptAudio(audio: JournalAudio, vaultKey: string): Promise<JournalAudio> {
  return {
    ...audio,
    data:
      audio.data && !isEncryptedJournalMediaData(audio.data)
        ? await encryptJournalMediaDataUrl(audio.data, vaultKey)
        : audio.data,
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
  if (isRemovalIntent(pendingRemovalRecord?.value)) {
    throw new Error(
      "Diary protection removal is still pending online completion."
    );
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
    Promise.all(entries.map((entry) => encryptEntry(entry, vaultKey, updatedAt))),
    Promise.all(photos.map((photo) => encryptPhoto(photo, vaultKey))),
    Promise.all(audios.map((audio) => encryptAudio(audio, vaultKey))),
    Promise.all(settings.map((setting) => encryptJournalDraftSettingForStorage(setting, vaultKey))),
    Promise.all(spaces.map((space) => encryptJournalSpaceForStorage(space, vaultKey))),
    Promise.all(
      captures.map((capture) => encryptJournalSpaceCaptureForStorage(capture, vaultKey))
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
      if (isRemovalIntent(currentRemoval?.value)) {
        throw new Error(
          "Diary protection removal is still pending online completion."
        );
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
      lastError: error instanceof Error ? error.message : String(error),
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
  };
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
): Promise<{ cloudMigrationPending: boolean }> {
  return runWithJournalSecurityBoundary(boundary, async () => {
    if (await getJournalSecurityMigrationIntent()) {
      throw new Error(
        "Wait for the pending online diary protection update before removing the password."
      );
    }
    await assertAutomationHistoryClearedForVaultRemoval();

    const [entries, photos, audios, settings, spaces, captures] = await Promise.all([
      db.journalEntries.toArray(),
      db.journalPhotos.toArray(),
      db.journalAudio.toArray(),
      db.settings.toArray(),
      db.journalSpaces.toArray(),
      db.journalSpaceCaptures.toArray(),
    ]);
    const passwordRecord = settings.find((setting) => setting.key === JOURNAL_PASSWORD_KEY);
    const vaultRecord = settings.find(
      (setting) => setting.key === JOURNAL_VAULT_KEY_SETTING_KEY
    );
    const persistedVaultRevision = Number(
      (vaultRecord?.value as { updatedAt?: unknown } | undefined)?.updatedAt
    );
    if (
      vaultRecord?.value &&
      vaultKey &&
      (getJournalContentVaultKey() !== vaultKey ||
        getJournalContentVaultRevision() !== persistedVaultRevision)
    ) {
      throw new Error("Unlock your diary before removing password protection.");
    }
    const hasEncryptedContent =
      entries.some((entry) => Boolean(entry.content && isEncryptedJournalContent(entry.content))) ||
      photos.some(
        (photo) =>
          Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
          Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail))
      ) ||
      audios.some((audio) => Boolean(audio.data && isEncryptedJournalMediaData(audio.data))) ||
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
      throw new Error("Unlock your diary before removing password protection.");
    }

    const updatedAt = Date.now();
    const [decryptedEntries, decryptedPhotos, decryptedAudios, preparedDrafts, decryptedSpaces, decryptedCaptures] = vaultKey
      ? await Promise.all([
          Promise.all(entries.map((entry) => decryptEntryForRemoval(entry, vaultKey, updatedAt))),
          Promise.all(photos.map((photo) => decryptPhotoForRemoval(photo, vaultKey))),
          Promise.all(audios.map((audio) => decryptAudioForRemoval(audio, vaultKey))),
          Promise.all(
            settings.map((setting) =>
              decryptJournalDraftSettingForStorage(setting, vaultKey)
            )
          ),
          Promise.all(
            spaces.map((space) => decryptJournalSpaceForStorage(space, vaultKey))
          ),
          Promise.all(
            captures.map((capture) =>
              decryptJournalSpaceCaptureForStorage(capture, vaultKey)
            )
          ),
        ])
      : [entries, photos, audios, [], spaces, captures];
    const decryptedDrafts = preparedDrafts.filter(
      (draft): draft is NonNullable<typeof draft> => draft !== null
    );
    const ownerUserId = isCloudSyncEnabled() ? boundary.sessionOwnerUserId : null;
    const removalIntent: JournalSecurityRemovalIntent | null = ownerUserId
      ? {
          version: 1,
          revision: `${updatedAt}:${generateSecureRandom(24)}`,
          ownerUserId,
          createdAt: updatedAt,
          status: "pending",
          photos: photos
            .filter((photo) => Boolean(photo.storagePath))
            .map((photo) => ({ id: photo.id, previousStoragePath: photo.storagePath })),
          audios: audios
            .filter((audio) => Boolean(audio.storagePath))
            .map((audio) => ({ id: audio.id, previousStoragePath: audio.storagePath })),
        }
      : null;

    await assertJournalSecurityBoundary(boundary);
    await db.transaction(
      "rw",
      [
        db.settings,
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
        db.journalSpaces,
        db.journalSpaceCaptures,
        db.automationTransactions,
        db.automationRemoteEvents,
      ],
      async () => {
        assertDataWriteBoundaryGeneration(boundary.generation);
        const [ownerRecord, currentPassword, currentVault] = await Promise.all([
          db.settings.get(SK.DATA_OWNER_ID),
          db.settings.get(JOURNAL_PASSWORD_KEY),
          db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
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
          !structurallyEqual(currentVault?.value, vaultRecord?.value)
        ) {
          throw new Error("Diary protection changed during password removal");
        }
        await assertAutomationHistoryClearedForVaultRemoval();

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
        if (removalIntent) {
          await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: removalIntent });
        } else {
          await db.settings.delete(SK.JOURNAL_SECURITY_REMOVAL);
        }

        const finalSessionOwnerUserId = await Dexie.waitFor(getCurrentSessionUserId());
        assertDataWriteBoundaryGeneration(boundary.generation);
        if (finalSessionOwnerUserId !== boundary.sessionOwnerUserId) {
          throw new Error("Account boundary changed during diary protection");
        }
      }
    );
    emitMigrationUpdate();
    return { cloudMigrationPending: Boolean(removalIntent) };
  });
}

export async function ensureJournalSecurityRemovalQueued(
  suppliedIntent?: JournalSecurityRemovalIntent
): Promise<boolean> {
  const intent = suppliedIntent ?? (await getJournalSecurityRemovalIntent());
  if (!intent) return false;
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
        lastError: error instanceof Error ? error.message : String(error),
      },
      intent.revision
    );
    throw error;
  }
  const current = await getJournalSecurityRemovalIntent();
  if (current?.revision === intent.revision) {
    await persistRemovalIntent(
      { ...current, status: "queued", lastError: undefined },
      current.revision
    );
  }
  return true;
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
  const intent = await loadCurrentRemovalIntent(payload, ownerUserId);
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
  const { syncWithCloud } = await import("@/storage/cloudSync");
  const result = await syncWithCloud("merge", ownerUserId);
  if (result.status === "aborted") {
    throw new Error("Diary protection removal backup was interrupted");
  }

  let mediaIntent = await loadCurrentRemovalIntent(payload, ownerUserId);
  for (const photo of [...(mediaIntent.photos ?? [])]) {
    if (photo.previousStoragePath) {
      await validateSyncOwner(ownerUserId, "Diary protection removal photo cleanup");
      await deleteJournalMediaStoragePath(
        "journal-photos",
        photo.previousStoragePath,
        ownerUserId,
      );
    }
    mediaIntent = {
      ...mediaIntent,
      photos: (mediaIntent.photos ?? []).filter(({ id }) => id !== photo.id),
    };
    await persistRemovalIntent(mediaIntent, intent.revision);
  }
  for (const audio of [...(mediaIntent.audios ?? [])]) {
    if (audio.previousStoragePath) {
      await validateSyncOwner(ownerUserId, "Diary protection removal audio cleanup");
      await deleteJournalMediaStoragePath(
        "journal-audio",
        audio.previousStoragePath,
        ownerUserId,
      );
    }
    mediaIntent = {
      ...mediaIntent,
      audios: (mediaIntent.audios ?? []).filter(({ id }) => id !== audio.id),
    };
    await persistRemovalIntent(mediaIntent, intent.revision);
  }

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
  await deleteSettingFromCloud(JOURNAL_VAULT_KEY_SETTING_KEY, ownerUserId, {
    journalSecurityRemovalRevision: intent.revision,
    queueOnNetworkError: false,
  });
  await persistRemovalIntent(null, intent.revision);
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
    const upload = await uploadEncryptedPhoto(
      photo.id,
      encryptedJournalMediaToStorageBlob(photo.data),
      ownerUserId
    );
    if (!upload) throw new Error(`Encrypted diary photo upload failed: ${photo.id}`);
    if (mediaIntent.previousStoragePath && mediaIntent.previousStoragePath !== upload.path) {
      await deleteJournalMediaStoragePath(
        "journal-photos",
        mediaIntent.previousStoragePath,
        ownerUserId
      );
    }
    await validateSyncOwner(ownerUserId, "Diary photo migration commit");
    await db.journalPhotos.update(photo.id, { storagePath: upload.path });
    await syncJournalPhoto({ ...photo, storagePath: upload.path }, ownerUserId);
    intent = { ...intent, photos: intent.photos.filter(({ id }) => id !== photo.id) };
    await saveProgress(intent);
  }

  for (const mediaIntent of [...intent.audios]) {
    const audio = await db.journalAudio.get(mediaIntent.id);
    if (!audio?.data || !isEncryptedJournalMediaData(audio.data)) {
      throw new Error(`Encrypted diary audio is unavailable: ${mediaIntent.id}`);
    }
    const upload = await uploadEncryptedAudio(
      audio.id,
      encryptedJournalMediaToStorageBlob(audio.data),
      ownerUserId
    );
    if (!upload) throw new Error(`Encrypted diary audio upload failed: ${audio.id}`);
    if (mediaIntent.previousStoragePath && mediaIntent.previousStoragePath !== upload.path) {
      await deleteJournalMediaStoragePath(
        "journal-audio",
        mediaIntent.previousStoragePath,
        ownerUserId
      );
    }
    await validateSyncOwner(ownerUserId, "Diary audio migration commit");
    await db.journalAudio.update(audio.id, { storagePath: upload.path });
    await syncJournalAudio({ ...audio, storagePath: upload.path }, ownerUserId);
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
