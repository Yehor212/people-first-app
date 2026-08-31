import Dexie, { type Table, type Transaction } from "dexie";
import { db } from "@/storage/db";
import { FocusSession, GratitudeEntry, Habit, MoodEntry } from "@/types";
import {
  MAX_AUDIO_PER_ENTRY,
  MAX_AUDIO_DURATION_SEC,
  MAX_PHOTOS_PER_ENTRY,
  type JournalAudio,
  type JournalEntry,
  type JournalEntryLink,
  type JournalHubPreferences,
  type JournalPhoto,
  type JournalPracticeSession,
  type JournalSpace,
  type JournalSpaceCapture,
} from "@/features/journal/types";
import {
  assertValidJournalAudio,
  normalizeJournalAudioMimeType,
} from "@/features/journal/journalAudioValidation";
import {
  consumeJournalReplaceAuthorization,
  getJournalContentVaultKey,
  getJournalContentVaultRevision,
  type JournalReplaceAuthorization,
} from "@/lib/journalContentSession";
import {
  decryptJournalContentIfNeeded,
  encryptJournalContent,
  isEncryptedJournalContent,
} from "@/features/journal/journalCrypto";
import {
  decryptJournalMediaDataUrlIfNeeded,
  encryptedJournalMediaFromStorageDataUrl,
  encryptJournalMediaDataUrl,
  isEncryptedJournalMediaData,
} from "@/features/journal/journalMediaCrypto";
import { normalizeJournalStyleFields } from "@/features/journal/journalStyleFields";
import { normalizeJournalPhotoLayout } from "@/features/journal/photoLayout";
import { generateId } from "@/lib/utils";
import { SK } from "@/lib/storageKeys";
import {
  sanitizeObject,
  moodEntrySchema,
  habitSchema,
  focusSessionSchema,
  gratitudeEntrySchema,
  settingSchema,
  safeValidate,
} from "@/lib/validation";
import {
  DELETION_TRACKER_KEYS,
  getDeletedFocusSessionIds,
  getDeletedGratitudeIds,
  getDeletedHabitIds,
  getDeletedJournalEntryIds,
  getDeletedMoodIds,
  mergeDeletionTrackerIdsInCurrentTransaction,
} from "@/storage/deletionTracker";
import { isAccountSyncedSettingKey } from "@/storage/sync/settingSyncPolicy";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { requireSafeJournalVaultRevision } from "@/features/journal/journalVaultEpoch";
import { runWithJournalSecurityWriteLock } from "@/features/journal/journalSecurityWriteLock";
import {
  serializePortableBackupWithinLimit,
  type SerializedPortableBackup,
} from "@/storage/backupCapacity";
import {
  automationHistoryMarkerSchema,
  automationRecordRevisionStoreRowSchema,
  automationSourceIntentSchema,
  automationTransactionSchema,
  type AutomationHistoryMarker,
  type AutomationTransactionStoreRow,
  type AutomationTransactionTableRow,
} from "@/features/automation/types";
import { decryptAutomationRevision } from "@/features/automation/revisionCrypto";
import { canonicalizeAutomationValue } from "@/features/automation/canonicalJson";
import { captureOriginAccountBoundaryGeneration } from "@/storage/accountBoundaryRuntime";

export type ImportMode = "merge" | "replace";

export type BackupImportBlockCode =
  | "JOURNAL_UNLOCK_REQUIRED"
  | "JOURNAL_REPLACE_AUTHORIZATION_REQUIRED"
  | "JOURNAL_BACKUP_UNREADABLE"
  | "BACKUP_DELETION_HISTORY_INVALID"
  | "AUTOMATION_HISTORY_INVALID"
  | "AUTOMATION_HISTORY_DUPLICATE"
  | "AUTOMATION_HISTORY_TOO_LARGE"
  | "AUTOMATION_HISTORY_OWNER_REQUIRED"
  | "AUTOMATION_HISTORY_OWNER_MISMATCH"
  | "AUTOMATION_HISTORY_STALE";

export type BackupExportBlockCode =
  | "JOURNAL_UNLOCK_REQUIRED"
  | "JOURNAL_DECRYPTION_FAILED"
  | "JOURNAL_MEDIA_UNAVAILABLE"
  | "BACKUP_TOO_LARGE"
  | "AUTOMATION_HISTORY_INVALID"
  | "AUTOMATION_HISTORY_DUPLICATE"
  | "AUTOMATION_HISTORY_TOO_LARGE"
  | "AUTOMATION_HISTORY_OWNER_MISMATCH";

export class BackupImportBlockedError extends Error {
  readonly code: BackupImportBlockCode;

  constructor(code: BackupImportBlockCode) {
    super(code);
    this.name = "BackupImportBlockedError";
    this.code = code;
  }
}

export class BackupExportBlockedError extends Error {
  readonly code: BackupExportBlockCode;

  constructor(code: BackupExportBlockCode) {
    super(code);
    this.name = "BackupExportBlockedError";
    this.code = code;
  }
}

// Settings entry type - value can be any JSON-serializable data
export interface SettingsEntry {
  key: string;
  value: unknown;
}

export interface BackupPayloadV1 {
  schemaVersion: 1;
  exportedAt: string;
  data: {
    moods: MoodEntry[];
    habits: Habit[];
    focusSessions: FocusSession[];
    gratitudeEntries: GratitudeEntry[];
    settings: SettingsEntry[];
  };
}

export interface BackupPayloadV2 {
  schemaVersion: 2;
  createdAt: string;
  deviceId: string;
  exportedAt?: string;
  data: {
    moods: MoodEntry[];
    habits: Habit[];
    focusSessions: FocusSession[];
    gratitudeEntries: GratitudeEntry[];
    settings: SettingsEntry[];
  };
}

export interface BackupPayloadV3 {
  schemaVersion: 3;
  createdAt: string;
  deviceId: string;
  exportedAt?: string;
  data: {
    moods: MoodEntry[];
    habits: Habit[];
    focusSessions: FocusSession[];
    gratitudeEntries: GratitudeEntry[];
    settings: SettingsEntry[];
    journalEntries?: JournalEntry[];
    journalPhotos?: JournalPhoto[];
    journalAudio?: JournalAudio[];
    journalHubPreferences?: JournalHubPreferences[];
    journalSpaces?: JournalSpace[];
    journalPracticeSessions?: JournalPracticeSession[];
    journalEntryLinks?: JournalEntryLink[];
    journalSpaceCaptures?: JournalSpaceCapture[];
  };
  /** Habit IDs deleted by this device — other devices must respect these deletions */
  deletedHabitIds?: string[];
  /** Journal entry IDs deleted by this device */
  deletedJournalEntryIds?: string[];
  /** Mood IDs deleted by this device */
  deletedMoodIds?: string[];
  /** Focus session IDs deleted by this device */
  deletedFocusSessionIds?: string[];
  /** Gratitude entry IDs deleted by this device */
  deletedGratitudeIds?: string[];
}

export interface BackupPayloadV4 {
  schemaVersion: 4;
  createdAt: string;
  deviceId: string;
  exportedAt?: string;
  data: BackupPayloadV3["data"] & {
    automationTransactions?: AutomationTransactionTableRow[];
    automationHistoryMarkers?: AutomationHistoryMarker[];
  };
  deletedHabitIds?: string[];
  deletedJournalEntryIds?: string[];
  deletedMoodIds?: string[];
  deletedFocusSessionIds?: string[];
  deletedGratitudeIds?: string[];
}

export type BackupPayload = BackupPayloadV1 | BackupPayloadV2 | BackupPayloadV3 | BackupPayloadV4;

export interface PortableBackupArtifact extends SerializedPortableBackup {
  payload: BackupPayloadV4;
}

export interface ImportReportEntry {
  added: number;
  updated: number;
  skipped: number;
}

export interface ImportReport {
  mode: ImportMode;
  moods: ImportReportEntry;
  habits: ImportReportEntry;
  focusSessions: ImportReportEntry;
  gratitudeEntries: ImportReportEntry;
  settings: ImportReportEntry;
  journalEntries?: ImportReportEntry;
  journalPhotos?: ImportReportEntry;
  journalAudio?: ImportReportEntry;
  journalHubPreferences?: ImportReportEntry;
  journalSpaces?: ImportReportEntry;
  journalPracticeSessions?: ImportReportEntry;
  journalEntryLinks?: ImportReportEntry;
  journalSpaceCaptures?: ImportReportEntry;
  automationTransactions?: ImportReportEntry;
  automationHistoryMarkers?: ImportReportEntry;
}

export interface ImportBackupOptions {
  journalReplaceAuthorization?: JournalReplaceAuthorization;
  /** Deterministic clock seam for authorization tests. */
  now?: number;
  /** Account that authorized a cloud/settings import. Local file-only callers may omit it. */
  expectedOwnerUserId?: string;
  /** Non-IndexedDB realm check safe to await through `Dexie.waitFor()`. */
  assertExternalOwnerRealmCurrent?: () => Promise<void>;
  /** IndexedDB owner check called directly from the active import transaction. */
  assertDataOwnerRealmCurrent?: () => Promise<void>;
  /** Keeps auth/session invalidation armed until the transaction commits. */
  subscribeOwnerRealmInvalidation?: (listener: () => void) => () => void;
}

export const BACKUP_SCHEMA_VERSION = 4;
const MAX_DELETION_TOMBSTONES_PER_COLLECTION = 100000;
const MAX_JOURNAL_IMPORT_ITEMS_PER_COLLECTION = 100000;
const MAX_AUTOMATION_BACKUP_ROWS = 128;
const MAX_AUTOMATION_HISTORY_MARKERS = 1;
const MAX_AUTOMATION_BACKUP_CIPHERTEXT_BYTES = 8 * 1024 * 1024;

function readDeletionHistoryField(
  payload: BackupPayload,
  field:
    | "deletedHabitIds"
    | "deletedJournalEntryIds"
    | "deletedMoodIds"
    | "deletedFocusSessionIds"
    | "deletedGratitudeIds"
): string[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(payload, field)) return undefined;
  const value = (payload as unknown as Record<string, unknown>)[field];
  // Internal sync payloads preserve optional fields as explicit `undefined`.
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > MAX_DELETION_TOMBSTONES_PER_COLLECTION ||
    !value.every((id) => typeof id === "string" && id.length > 0 && id.length <= 100)
  ) {
    throw new BackupImportBlockedError("BACKUP_DELETION_HISTORY_INVALID");
  }
  return value;
}

function sanitizeRecord(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== "object") return null;
  return sanitizeObject(item as Record<string, unknown>);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateImportedJournalEntry(item: unknown): JournalEntry | null {
  const entry = sanitizeRecord(item);
  if (!entry) return null;
  if (
    typeof entry.id !== "string" ||
    typeof entry.date !== "string" ||
    typeof entry.content !== "string" ||
    typeof entry.createdAt !== "number" ||
    !isStringArray(entry.stickers) ||
    !isStringArray(entry.photoIds) ||
    !isStringArray(entry.tags) ||
    (entry.audioIds !== undefined && !isStringArray(entry.audioIds))
  ) {
    return null;
  }

  const normalizedEntry = { ...entry };
  for (const field of [
    "theme",
    "font",
    "inkColor",
    "paperTexture",
    "bgPattern",
    "paperColor",
    "bgIntensity",
    "particleSpeed",
    "fontSize",
    "photoLayout",
  ]) {
    delete normalizedEntry[field];
  }
  const styleFields = normalizeJournalStyleFields(entry);
  const photoLayout = normalizeJournalPhotoLayout(entry.photoLayout, entry.photoIds);

  return {
    ...(normalizedEntry as unknown as JournalEntry),
    ...styleFields,
    ...(photoLayout ? { photoLayout } : {}),
    title: typeof entry.title === "string" ? entry.title : "",
    stickers: entry.stickers,
    photoIds: entry.photoIds,
    audioIds: entry.audioIds,
    tags: entry.tags,
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : entry.createdAt,
  };
}

function validateImportedJournalPhoto(item: unknown): JournalPhoto | null {
  const photo = sanitizeRecord(item);
  if (!photo) return null;
  if (
    typeof photo.id !== "string" ||
    typeof photo.entryId !== "string" ||
    typeof photo.data !== "string" ||
    typeof photo.thumbnail !== "string" ||
    typeof photo.width !== "number" ||
    typeof photo.height !== "number" ||
    typeof photo.createdAt !== "number" ||
    (photo.storagePath !== undefined && typeof photo.storagePath !== "string") ||
    (photo.storageUrl !== undefined && typeof photo.storageUrl !== "string")
  ) {
    return null;
  }
  return photo as unknown as JournalPhoto;
}

function validateImportedJournalAudio(item: unknown): JournalAudio | null {
  const audio = sanitizeRecord(item);
  if (!audio) return null;
  if (
    typeof audio.id !== "string" ||
    typeof audio.entryId !== "string" ||
    typeof audio.data !== "string" ||
    typeof audio.duration !== "number" ||
    !Number.isFinite(audio.duration) ||
    audio.duration < 0 ||
    audio.duration > MAX_AUDIO_DURATION_SEC ||
    typeof audio.mimeType !== "string" ||
    !normalizeJournalAudioMimeType(audio.mimeType) ||
    typeof audio.createdAt !== "number" ||
    (audio.storagePath !== undefined && typeof audio.storagePath !== "string") ||
    (audio.storageUrl !== undefined && typeof audio.storageUrl !== "string")
  ) {
    return null;
  }
  if (!isEncryptedJournalMediaData(audio.data)) {
    try {
      assertValidJournalAudio(audio.data, audio.duration, audio.mimeType);
    } catch {
      return null;
    }
  }
  return audio as unknown as JournalAudio;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isStringFrom(value: unknown, allowed: ReadonlySet<string>): value is string {
  return typeof value === "string" && allowed.has(value);
}

const JOURNAL_HUB_VIEWS = new Set(["today", "entries", "spaces", "practices", "library"]);
const JOURNAL_HUB_ACTIONS = new Set([
  "write",
  "quickNote",
  "photo",
  "gratitude",
  "resetThought",
  "focusNote",
  "template",
]);
const JOURNAL_HUB_DENSITIES = new Set(["compact", "balanced", "calm"]);
const JOURNAL_HUB_MOTIONS = new Set(["system", "quiet", "expressive"]);
const JOURNAL_HUB_BACKGROUNDS = new Set(["clean", "grain", "depth"]);
const JOURNAL_SPACE_ICONS = new Set([
  "bookOpen",
  "briefcase",
  "compass",
  "feather",
  "flame",
  "folder",
  "heart",
  "leaf",
  "lightbulb",
  "moon",
  "penLine",
  "sparkles",
  "sprout",
  "target",
  "timer",
  "waves",
]);
const JOURNAL_SPACE_ACCENTS = new Set(["primary", "mint", "amber", "rose", "violet", "sky"]);
const JOURNAL_SPACE_KINDS = new Set(["user", "system"]);
const JOURNAL_ENTRY_LINK_TARGETS = new Set(["space", "practice", "template", "project"]);

function validateImportedJournalHubPreferences(item: unknown): JournalHubPreferences | null {
  const preferences = sanitizeRecord(item);
  if (
    !preferences ||
    preferences.id !== "default" ||
    !isStringFrom(preferences.homeView, JOURNAL_HUB_VIEWS) ||
    !Array.isArray(preferences.visibleViews) ||
    !preferences.visibleViews.every((view) => isStringFrom(view, JOURNAL_HUB_VIEWS)) ||
    !Array.isArray(preferences.dockActions) ||
    !preferences.dockActions.every((action) => isStringFrom(action, JOURNAL_HUB_ACTIONS)) ||
    !isStringFrom(preferences.density, JOURNAL_HUB_DENSITIES) ||
    !isStringFrom(preferences.motion, JOURNAL_HUB_MOTIONS) ||
    !isStringFrom(preferences.background, JOURNAL_HUB_BACKGROUNDS) ||
    !isFiniteNumber(preferences.updatedAt)
  ) {
    return null;
  }
  return preferences as unknown as JournalHubPreferences;
}

function validateImportedJournalSpace(item: unknown): JournalSpace | null {
  const space = sanitizeRecord(item);
  if (
    !space ||
    typeof space.id !== "string" ||
    !isOptionalString(space.nameKey) ||
    !isOptionalString(space.name) ||
    !isOptionalString(space.descriptionKey) ||
    !isOptionalString(space.description) ||
    !isStringFrom(space.iconKey, JOURNAL_SPACE_ICONS) ||
    !isStringFrom(space.accent, JOURNAL_SPACE_ACCENTS) ||
    typeof space.private !== "boolean" ||
    (space.kind !== undefined && !isStringFrom(space.kind, JOURNAL_SPACE_KINDS)) ||
    !isOptionalString(space.coverKey) ||
    !isOptionalString(space.coverImage) ||
    (space.autoSource !== undefined && space.autoSource !== "gratitude") ||
    (space.locked !== undefined && typeof space.locked !== "boolean") ||
    !isOptionalString(space.pinnedTemplateId) ||
    (space.pinnedAction !== undefined && !isStringFrom(space.pinnedAction, JOURNAL_HUB_ACTIONS)) ||
    !isFiniteNumber(space.sortOrder) ||
    !isFiniteNumber(space.createdAt) ||
    !isFiniteNumber(space.updatedAt)
  ) {
    return null;
  }
  return space as unknown as JournalSpace;
}

function validateImportedJournalPracticeSession(item: unknown): JournalPracticeSession | null {
  const session = sanitizeRecord(item);
  if (
    !session ||
    typeof session.id !== "string" ||
    typeof session.practiceId !== "string" ||
    !isOptionalString(session.entryId) ||
    !isOptionalFiniteNumber(session.durationSeconds) ||
    !isFiniteNumber(session.startedAt) ||
    !isOptionalFiniteNumber(session.completedAt)
  ) {
    return null;
  }
  return session as unknown as JournalPracticeSession;
}

function validateImportedJournalEntryLink(item: unknown): JournalEntryLink | null {
  const link = sanitizeRecord(item);
  if (
    !link ||
    typeof link.id !== "string" ||
    typeof link.entryId !== "string" ||
    !isStringFrom(link.targetType, JOURNAL_ENTRY_LINK_TARGETS) ||
    typeof link.targetId !== "string" ||
    !isFiniteNumber(link.createdAt)
  ) {
    return null;
  }
  return link as unknown as JournalEntryLink;
}

function validateImportedJournalSpaceCapture(item: unknown): JournalSpaceCapture | null {
  const capture = sanitizeRecord(item);
  if (
    !capture ||
    typeof capture.id !== "string" ||
    typeof capture.spaceId !== "string" ||
    typeof capture.spaceName !== "string" ||
    typeof capture.mode !== "string" ||
    typeof capture.title !== "string" ||
    !Array.isArray(capture.fields) ||
    !capture.fields.every(
      (field) =>
        field !== null &&
        typeof field === "object" &&
        typeof (field as { prompt?: unknown }).prompt === "string" &&
        typeof (field as { value?: unknown }).value === "string"
    ) ||
    typeof capture.date !== "string" ||
    !isFiniteNumber(capture.createdAt) ||
    !isFiniteNumber(capture.updatedAt) ||
    !isOptionalString(capture.entryId) ||
    (capture.sourceType !== undefined && capture.sourceType !== "gratitude") ||
    !isOptionalString(capture.sourceId)
  ) {
    return null;
  }
  return capture as unknown as JournalSpaceCapture;
}

function validateJournalCollection<T>(items: unknown, validator: (item: unknown) => T | null): T[] {
  const list = Array.isArray(items) ? items : [];
  if (list.length > MAX_JOURNAL_IMPORT_ITEMS_PER_COLLECTION) {
    throw new Error(
      `Backup file too large (max ${MAX_JOURNAL_IMPORT_ITEMS_PER_COLLECTION} journal items per collection)`
    );
  }
  return list.flatMap((item) => {
    const validated = validator(item);
    return validated ? [validated] : [];
  });
}

async function mapSequentially<T, R>(
  items: readonly T[],
  transform: (item: T) => Promise<R>
): Promise<R[]> {
  const transformed: R[] = [];
  for (const item of items) {
    transformed.push(await transform(item));
  }
  return transformed;
}

async function encryptImportedJournalEntryForStorage(
  entry: JournalEntry,
  vaultKey: string | null,
  vaultRevision?: number
): Promise<JournalEntry> {
  if (!vaultKey) return { ...entry, vaultRevision: undefined };
  const revision = requireSafeJournalVaultRevision(vaultRevision, "backup entry");
  if (!entry.content) return { ...entry, vaultRevision: revision };
  if (isEncryptedJournalContent(entry.content)) {
    try {
      await decryptJournalContentIfNeeded(entry.content, vaultKey);
      return { ...entry, vaultRevision: revision };
    } catch {
      throw new BackupImportBlockedError("JOURNAL_BACKUP_UNREADABLE");
    }
  }
  return {
    ...entry,
    content: await encryptJournalContent(entry.content, vaultKey),
    vaultRevision: revision,
  };
}

async function encryptImportedJournalMediaData(
  data: string | undefined,
  vaultKey: string | null
): Promise<string> {
  if (!data) return "";
  let normalized: string;
  try {
    normalized = encryptedJournalMediaFromStorageDataUrl(data);
  } catch {
    throw new BackupImportBlockedError("JOURNAL_BACKUP_UNREADABLE");
  }
  if (isEncryptedJournalMediaData(normalized)) {
    if (!vaultKey) throw new BackupImportBlockedError("JOURNAL_BACKUP_UNREADABLE");
    try {
      await decryptJournalMediaDataUrlIfNeeded(normalized, vaultKey);
      return normalized;
    } catch {
      throw new BackupImportBlockedError("JOURNAL_BACKUP_UNREADABLE");
    }
  }
  if (!vaultKey) return normalized;
  return encryptJournalMediaDataUrl(normalized, vaultKey);
}

async function encryptImportedJournalPhotoForStorage(
  photo: JournalPhoto,
  vaultKey: string | null,
  vaultRevision?: number
): Promise<JournalPhoto> {
  if (!vaultKey) return { ...photo, vaultRevision: undefined };
  return {
    ...photo,
    data: await encryptImportedJournalMediaData(photo.data, vaultKey),
    thumbnail: await encryptImportedJournalMediaData(photo.thumbnail, vaultKey),
    vaultRevision: requireSafeJournalVaultRevision(vaultRevision, "backup photo"),
  };
}

async function encryptImportedJournalAudioForStorage(
  audio: JournalAudio,
  vaultKey: string | null,
  vaultRevision?: number
): Promise<JournalAudio> {
  if (!vaultKey) return { ...audio, vaultRevision: undefined };
  return {
    ...audio,
    data: await encryptImportedJournalMediaData(audio.data, vaultKey),
    vaultRevision: requireSafeJournalVaultRevision(vaultRevision, "backup audio"),
  };
}

function isEncryptedJournalMediaStoragePath(path: string | undefined): boolean {
  return Boolean(path?.toLowerCase().endsWith(".bin"));
}

function isBackupPortableSettingKey(key: string): boolean {
  return isAccountSyncedSettingKey(key) && key !== SK.JOURNAL_VAULT_KEY;
}

async function protectImportedJournalString(
  value: string | undefined,
  vaultKey: string | null
): Promise<string | undefined> {
  if (value === undefined || value.length === 0) return value;
  if (isEncryptedJournalContent(value)) {
    if (!vaultKey) throw new BackupImportBlockedError("JOURNAL_BACKUP_UNREADABLE");
    try {
      await decryptJournalContentIfNeeded(value, vaultKey);
      return value;
    } catch {
      throw new BackupImportBlockedError("JOURNAL_BACKUP_UNREADABLE");
    }
  }
  return vaultKey ? encryptJournalContent(value, vaultKey) : value;
}

async function protectImportedJournalSpace(
  space: JournalSpace,
  vaultKey: string | null,
  vaultRevision?: number
): Promise<JournalSpace> {
  return {
    ...space,
    name: await protectImportedJournalString(space.name, vaultKey),
    description: await protectImportedJournalString(space.description, vaultKey),
    vaultRevision: vaultKey
      ? requireSafeJournalVaultRevision(vaultRevision, "backup space")
      : undefined,
  };
}

async function protectImportedJournalSpaceCapture(
  capture: JournalSpaceCapture,
  vaultKey: string | null,
  vaultRevision?: number
): Promise<JournalSpaceCapture> {
  return {
    ...capture,
    spaceName: (await protectImportedJournalString(capture.spaceName, vaultKey)) || "",
    title: (await protectImportedJournalString(capture.title, vaultKey)) || "",
    fields: await Promise.all(
      capture.fields.map(async (field) => ({
        prompt: (await protectImportedJournalString(field.prompt, vaultKey)) || "",
        value: (await protectImportedJournalString(field.value, vaultKey)) || "",
      }))
    ),
    vaultRevision: vaultKey
      ? requireSafeJournalVaultRevision(vaultRevision, "backup capture")
      : undefined,
  };
}

function isPortableProtectedString(value: string | undefined): boolean {
  return !value || isEncryptedJournalContent(value);
}

function canImportJournalSpaceWhileLocked(space: JournalSpace): boolean {
  return isPortableProtectedString(space.name) && isPortableProtectedString(space.description);
}

function canImportJournalSpaceCaptureWhileLocked(capture: JournalSpaceCapture): boolean {
  return (
    isPortableProtectedString(capture.spaceName) &&
    isPortableProtectedString(capture.title) &&
    capture.fields.every(
      (field) => isPortableProtectedString(field.prompt) && isPortableProtectedString(field.value)
    )
  );
}

function hasUnreadableEncryptedJournalRows(input: {
  entries: JournalEntry[];
  photos: JournalPhoto[];
  audio: JournalAudio[];
  spaces: JournalSpace[];
  captures: JournalSpaceCapture[];
}): boolean {
  const isEncryptedMedia = (value: string): boolean => {
    try {
      return isEncryptedJournalMediaData(encryptedJournalMediaFromStorageDataUrl(value));
    } catch {
      return true;
    }
  };
  return (
    input.entries.some((entry) => isEncryptedJournalContent(entry.content)) ||
    input.photos.some(
      (photo) => isEncryptedMedia(photo.data) || isEncryptedMedia(photo.thumbnail)
    ) ||
    input.audio.some((audio) => isEncryptedMedia(audio.data)) ||
    input.spaces.some(
      (space) =>
        isEncryptedJournalContent(space.name || "") ||
        isEncryptedJournalContent(space.description || "")
    ) ||
    input.captures.some(
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

function canImportJournalEntryWhileLocked(entry: JournalEntry): boolean {
  return !entry.content || isEncryptedJournalContent(entry.content);
}

function canImportJournalMediaWhileLocked(media: {
  storagePath?: string;
  data?: string;
  thumbnail?: string;
}): boolean {
  const dataValues = [media.data, media.thumbnail].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  if (dataValues.some((value) => !isEncryptedJournalMediaData(value))) return false;
  if (media.storagePath && !isEncryptedJournalMediaStoragePath(media.storagePath)) return false;
  return true;
}

const getOrCreateDeviceId = async () => {
  const existing = await db.settings.get("zenflow-device-id");
  if (typeof existing?.value === "string" && existing.value.trim().length > 0) {
    return existing.value;
  }
  const deviceId = `device_${generateId()}`;
  await db.settings.put({ key: "zenflow-device-id", value: deviceId });
  return deviceId;
};

async function decryptPortableJournalString(
  value: string | undefined,
  vaultKey: string | null
): Promise<string | undefined> {
  if (value === undefined || !isEncryptedJournalContent(value)) return value;
  if (!vaultKey) throw new BackupExportBlockedError("JOURNAL_UNLOCK_REQUIRED");
  try {
    return await decryptJournalContentIfNeeded(value, vaultKey);
  } catch {
    throw new BackupExportBlockedError("JOURNAL_DECRYPTION_FAILED");
  }
}

async function decryptPortableJournalMedia(
  value: string,
  vaultKey: string | null
): Promise<string> {
  let normalized: string;
  try {
    normalized = encryptedJournalMediaFromStorageDataUrl(value);
  } catch {
    throw new BackupExportBlockedError("JOURNAL_DECRYPTION_FAILED");
  }
  if (!isEncryptedJournalMediaData(normalized)) return normalized;
  if (!vaultKey) throw new BackupExportBlockedError("JOURNAL_UNLOCK_REQUIRED");
  try {
    return await decryptJournalMediaDataUrlIfNeeded(normalized, vaultKey);
  } catch {
    throw new BackupExportBlockedError("JOURNAL_DECRYPTION_FAILED");
  }
}

async function makePortableJournalPhoto(
  photo: JournalPhoto,
  vaultKey: string | null
): Promise<JournalPhoto> {
  const data = await decryptPortableJournalMedia(photo.data, vaultKey);
  const thumbnail = await decryptPortableJournalMedia(photo.thumbnail, vaultKey);
  if (!data) {
    throw new BackupExportBlockedError("JOURNAL_MEDIA_UNAVAILABLE");
  }
  const {
    storagePath: _storagePath,
    storageUrl: _storageUrl,
    vaultRevision: _vaultRevision,
    ...portable
  } = photo;
  return { ...portable, data, thumbnail };
}

async function makePortableJournalAudio(
  audio: JournalAudio,
  vaultKey: string | null
): Promise<JournalAudio> {
  const data = await decryptPortableJournalMedia(audio.data, vaultKey);
  if (!data) {
    throw new BackupExportBlockedError("JOURNAL_MEDIA_UNAVAILABLE");
  }
  const {
    storagePath: _storagePath,
    storageUrl: _storageUrl,
    vaultRevision: _vaultRevision,
    ...portable
  } = audio;
  return { ...portable, data };
}

async function makePortableJournalSpace(
  space: JournalSpace,
  vaultKey: string | null
): Promise<JournalSpace> {
  return {
    ...space,
    name: await decryptPortableJournalString(space.name, vaultKey),
    description: await decryptPortableJournalString(space.description, vaultKey),
    vaultRevision: undefined,
  };
}

async function makePortableJournalSpaceCapture(
  capture: JournalSpaceCapture,
  vaultKey: string | null
): Promise<JournalSpaceCapture> {
  return {
    ...capture,
    spaceName: (await decryptPortableJournalString(capture.spaceName, vaultKey)) || "",
    title: (await decryptPortableJournalString(capture.title, vaultKey)) || "",
    fields: await Promise.all(
      capture.fields.map(async (field) => ({
        prompt: (await decryptPortableJournalString(field.prompt, vaultKey)) || "",
        value: (await decryptPortableJournalString(field.value, vaultKey)) || "",
      }))
    ),
    vaultRevision: undefined,
  };
}

/**
 * Export backup atomically using Dexie transaction.
 * Ensures data doesn't change mid-export by using a read transaction.
 * This prevents race conditions where user edits data during sync.
 */
const exportBackupWithinJournalSecurityLock = async (
  portable: boolean
): Promise<BackupPayloadV4> => {
  const deviceId = await getOrCreateDeviceId();
  const snapshot = await db.transaction(
    "r",
    [
      db.moods,
      db.habits,
      db.focusSessions,
      db.gratitudeEntries,
      db.settings,
      db.journalEntries,
      db.journalPhotos,
      db.journalAudio,
      db.journalHubPreferences,
      db.journalSpaces,
      db.journalPracticeSessions,
      db.journalEntryLinks,
      db.journalSpaceCaptures,
      db.automationTransactions,
      db.automationHistoryMarkers,
    ],
    async () => {
      const [
        moods,
        habits,
        focusSessions,
        gratitudeEntries,
        settings,
        journalEntries,
        journalPhotos,
        journalAudio,
        journalHubPreferences,
        journalSpaces,
        journalPracticeSessions,
        journalEntryLinks,
        journalSpaceCaptures,
        automationTransactions,
        automationHistoryMarkers,
        deletedHabitSet,
        deletedJournalEntrySet,
        deletedMoodSet,
        deletedFocusSessionSet,
        deletedGratitudeSet,
      ] = await Promise.all([
        db.moods.toArray(),
        db.habits.toArray(),
        db.focusSessions.toArray(),
        db.gratitudeEntries.toArray(),
        db.settings.toArray(),
        db.journalEntries.toArray(),
        db.journalPhotos.toArray(),
        db.journalAudio.toArray(),
        db.journalHubPreferences.toArray(),
        db.journalSpaces.toArray(),
        db.journalPracticeSessions.toArray(),
        db.journalEntryLinks.toArray(),
        db.journalSpaceCaptures.toArray(),
        db.automationTransactions.toArray(),
        db.automationHistoryMarkers.toArray(),
        getDeletedHabitIds(),
        getDeletedJournalEntryIds(),
        getDeletedMoodIds(),
        getDeletedFocusSessionIds(),
        getDeletedGratitudeIds(),
      ]);

      const deletedHabitIds = [...deletedHabitSet];
      const deletedJournalEntryIds = [...deletedJournalEntrySet];
      const deletedMoodIds = [...deletedMoodSet];
      const deletedFocusSessionIds = [...deletedFocusSessionSet];
      const deletedGratitudeIds = [...deletedGratitudeSet];

      const accountSyncedSettings = settings.filter((setting) =>
        isBackupPortableSettingKey(setting.key)
      );
      const exportedJournalEntries = journalEntries.filter(
        (entry) => !deletedJournalEntrySet.has(entry.id)
      );
      const exportedEntryById = new Map(exportedJournalEntries.map((entry) => [entry.id, entry]));
      const validatedAutomation = validateAutomationBackupForExport(
        automationTransactions.filter(
          (row) =>
            row.kind !== "purge_pending" &&
            (row.kind !== "transaction" || row.status === "committed" || row.status === "undone")
        ),
        automationHistoryMarkers
      );
      return {
        data: {
          moods: moods.filter((mood) => !deletedMoodSet.has(mood.id)),
          habits: habits.filter((habit) => !deletedHabitSet.has(habit.id)),
          focusSessions: focusSessions.filter((session) => !deletedFocusSessionSet.has(session.id)),
          gratitudeEntries: gratitudeEntries.filter((entry) => !deletedGratitudeSet.has(entry.id)),
          settings: accountSyncedSettings,
          journalEntries: exportedJournalEntries,
          journalPhotos: journalPhotos.filter((photo) => {
            const owner = exportedEntryById.get(photo.entryId);
            return Boolean(owner?.photoIds.includes(photo.id));
          }),
          journalAudio: journalAudio.filter((audio) => {
            const owner = exportedEntryById.get(audio.entryId);
            return Boolean(owner?.audioIds?.includes(audio.id));
          }),
          journalHubPreferences,
          journalSpaces,
          journalPracticeSessions,
          journalEntryLinks,
          journalSpaceCaptures,
          automationTransactions: validatedAutomation.rows,
          automationHistoryMarkers: validatedAutomation.markers,
        },
        deletedHabitIds,
        deletedJournalEntryIds,
        deletedMoodIds,
        deletedFocusSessionIds,
        deletedGratitudeIds,
      };
    }
  );

  let exportedEntries = snapshot.data.journalEntries;
  let exportedPhotos = snapshot.data.journalPhotos;
  let exportedAudio = snapshot.data.journalAudio;
  let exportedSpaces = snapshot.data.journalSpaces;
  let exportedCaptures = snapshot.data.journalSpaceCaptures;
  if (portable) {
    const vaultKey = getJournalContentVaultKey();
    if (
      !vaultKey &&
      hasUnreadableEncryptedJournalRows({
        entries: snapshot.data.journalEntries,
        photos: snapshot.data.journalPhotos,
        audio: snapshot.data.journalAudio,
        spaces: snapshot.data.journalSpaces,
        captures: snapshot.data.journalSpaceCaptures,
      })
    ) {
      throw new BackupExportBlockedError("JOURNAL_UNLOCK_REQUIRED");
    }
    [exportedEntries, exportedPhotos, exportedAudio, exportedSpaces, exportedCaptures] =
      await Promise.all([
        Promise.all(
          snapshot.data.journalEntries.map(async (entry) => ({
            ...entry,
            content: (await decryptPortableJournalString(entry.content, vaultKey)) || "",
            vaultRevision: undefined,
          }))
        ),
        Promise.all(
          snapshot.data.journalPhotos.map((photo) => makePortableJournalPhoto(photo, vaultKey))
        ),
        Promise.all(
          snapshot.data.journalAudio.map((audio) => makePortableJournalAudio(audio, vaultKey))
        ),
        Promise.all(
          snapshot.data.journalSpaces.map((space) => makePortableJournalSpace(space, vaultKey))
        ),
        Promise.all(
          snapshot.data.journalSpaceCaptures.map((capture) =>
            makePortableJournalSpaceCapture(capture, vaultKey)
          )
        ),
      ]);
  }

  const portablePhotoOwners = new Map(exportedPhotos.map((photo) => [photo.id, photo.entryId]));
  const portableAudioOwners = new Map(exportedAudio.map((audio) => [audio.id, audio.entryId]));
  const normalizedEntries = exportedEntries.map((entry) => ({
    ...entry,
    photoIds: [...new Set(entry.photoIds)].filter(
      (photoId) => portablePhotoOwners.get(photoId) === entry.id
    ),
    audioIds: entry.audioIds
      ? [...new Set(entry.audioIds)].filter(
          (audioId) => portableAudioOwners.get(audioId) === entry.id
        )
      : entry.audioIds,
  }));
  const entryIds = new Set(normalizedEntries.map((entry) => entry.id));
  const spaceIds = new Set(exportedSpaces.map((space) => space.id));
  const normalizedPracticeSessions = snapshot.data.journalPracticeSessions.map((session) =>
    session.entryId && !entryIds.has(session.entryId) ? { ...session, entryId: undefined } : session
  );
  const normalizedEntryLinks = snapshot.data.journalEntryLinks.filter(
    (link) =>
      entryIds.has(link.entryId) && (link.targetType !== "space" || spaceIds.has(link.targetId))
  );
  const normalizedCaptures = exportedCaptures
    .filter((capture) => spaceIds.has(capture.spaceId))
    .map((capture) =>
      capture.entryId && !entryIds.has(capture.entryId)
        ? { ...capture, entryId: undefined }
        : capture
    );

  const data: BackupPayloadV4["data"] = {
    ...snapshot.data,
    journalEntries: normalizedEntries,
    journalPhotos: exportedPhotos,
    journalAudio: exportedAudio,
    journalSpaces: exportedSpaces,
    journalPracticeSessions: normalizedPracticeSessions,
    journalEntryLinks: normalizedEntryLinks,
    journalSpaceCaptures: normalizedCaptures,
  };

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    deviceId,
    data,
    deletedHabitIds: snapshot.deletedHabitIds.length > 0 ? snapshot.deletedHabitIds : undefined,
    deletedJournalEntryIds:
      snapshot.deletedJournalEntryIds.length > 0 ? snapshot.deletedJournalEntryIds : undefined,
    deletedMoodIds: snapshot.deletedMoodIds.length > 0 ? snapshot.deletedMoodIds : undefined,
    deletedFocusSessionIds:
      snapshot.deletedFocusSessionIds.length > 0 ? snapshot.deletedFocusSessionIds : undefined,
    deletedGratitudeIds:
      snapshot.deletedGratitudeIds.length > 0 ? snapshot.deletedGratitudeIds : undefined,
  };
};

export const exportBackup = (): Promise<BackupPayloadV4> =>
  runWithJournalSecurityWriteLock(() => exportBackupWithinJournalSecurityLock(false));

export const exportPortableBackupArtifact = (): Promise<PortableBackupArtifact> =>
  runWithJournalSecurityWriteLock(async () => {
    const payload = await exportBackupWithinJournalSecurityLock(true);
    return { payload, ...serializePortableBackupWithinLimit(payload) };
  });

export const exportPortableBackup = async (): Promise<BackupPayloadV4> =>
  (await exportPortableBackupArtifact()).payload;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const normalizeBackup = (payload: BackupPayload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid backup payload.");
  }
  const version = (payload as { schemaVersion?: number }).schemaVersion;
  if (version !== 1 && version !== 2 && version !== 3 && version !== BACKUP_SCHEMA_VERSION) {
    throw new Error("Unsupported backup version.");
  }
  if (!("data" in payload) || !isPlainRecord(payload.data)) {
    throw new Error("Backup payload missing data.");
  }
  const rawData = payload.data as unknown as Record<string, unknown>;
  for (const collection of ["moods", "habits", "focusSessions", "gratitudeEntries", "settings"]) {
    if (!Array.isArray(rawData[collection])) {
      throw new Error(`Invalid backup collection: ${collection} must be an array.`);
    }
  }
  for (const collection of [
    "journalEntries",
    "journalPhotos",
    "journalAudio",
    "journalHubPreferences",
    "journalSpaces",
    "journalPracticeSessions",
    "journalEntryLinks",
    "journalSpaceCaptures",
    "automationTransactions",
    "automationHistoryMarkers",
  ]) {
    if (collection in rawData && !Array.isArray(rawData[collection])) {
      throw new Error(`Invalid backup collection: ${collection} must be an array.`);
    }
  }
  if (version === 1) {
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: (payload as BackupPayloadV1).exportedAt || new Date().toISOString(),
      deviceId: "legacy",
      data: {
        ...payload.data,
        journalEntries: [] as JournalEntry[],
        journalPhotos: [] as JournalPhoto[],
        journalAudio: [] as JournalAudio[],
        journalHubPreferences: [] as JournalHubPreferences[],
        journalSpaces: [] as JournalSpace[],
        journalPracticeSessions: [] as JournalPracticeSession[],
        journalEntryLinks: [] as JournalEntryLink[],
        journalSpaceCaptures: [] as JournalSpaceCapture[],
        automationTransactions: [] as AutomationTransactionTableRow[],
        automationHistoryMarkers: [] as AutomationHistoryMarker[],
      },
      collectionPresence: {
        journalEntries: false,
        journalPhotos: false,
        journalAudio: false,
        journalHubPreferences: false,
        journalSpaces: false,
        journalPracticeSessions: false,
        journalEntryLinks: false,
        journalSpaceCaptures: false,
        automationTransactions: false,
        automationHistoryMarkers: false,
      },
    };
  }
  const p = payload as BackupPayloadV2 | BackupPayloadV3 | BackupPayloadV4;
  const isV3OrNewer = version === 3 || version === BACKUP_SCHEMA_VERSION;
  const isV4 = version === BACKUP_SCHEMA_VERSION;
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: p.createdAt || p.exportedAt || new Date().toISOString(),
    deviceId: p.deviceId || "unknown",
    data: {
      ...p.data,
      journalEntries: ("journalEntries" in p.data ? p.data.journalEntries : undefined) || [],
      journalPhotos: ("journalPhotos" in p.data ? p.data.journalPhotos : undefined) || [],
      journalAudio: ("journalAudio" in p.data ? p.data.journalAudio : undefined) || [],
      journalHubPreferences:
        ("journalHubPreferences" in p.data ? p.data.journalHubPreferences : undefined) || [],
      journalSpaces: ("journalSpaces" in p.data ? p.data.journalSpaces : undefined) || [],
      journalPracticeSessions:
        ("journalPracticeSessions" in p.data ? p.data.journalPracticeSessions : undefined) || [],
      journalEntryLinks:
        ("journalEntryLinks" in p.data ? p.data.journalEntryLinks : undefined) || [],
      journalSpaceCaptures:
        ("journalSpaceCaptures" in p.data ? p.data.journalSpaceCaptures : undefined) || [],
      automationTransactions:
        ("automationTransactions" in p.data ? p.data.automationTransactions : undefined) || [],
      automationHistoryMarkers:
        ("automationHistoryMarkers" in p.data ? p.data.automationHistoryMarkers : undefined) || [],
    },
    collectionPresence: {
      journalEntries: isV3OrNewer && "journalEntries" in p.data,
      journalPhotos: isV3OrNewer && "journalPhotos" in p.data,
      journalAudio: isV3OrNewer && "journalAudio" in p.data,
      journalHubPreferences: isV3OrNewer && "journalHubPreferences" in p.data,
      journalSpaces: isV3OrNewer && "journalSpaces" in p.data,
      journalPracticeSessions: isV3OrNewer && "journalPracticeSessions" in p.data,
      journalEntryLinks: isV3OrNewer && "journalEntryLinks" in p.data,
      journalSpaceCaptures: isV3OrNewer && "journalSpaceCaptures" in p.data,
      automationTransactions: isV4 && "automationTransactions" in p.data,
      automationHistoryMarkers: isV4 && "automationHistoryMarkers" in p.data,
    },
  };
};

interface ValidatedAutomationBackup {
  rows: AutomationTransactionTableRow[];
  markers: AutomationHistoryMarker[];
}

function automationImportError(code: BackupImportBlockCode): never {
  throw new BackupImportBlockedError(code);
}

function validateAutomationBackupCollections(
  rowsValue: unknown,
  markersValue: unknown,
  expectedOwnerUserId: string | undefined
): ValidatedAutomationBackup {
  if (!Array.isArray(rowsValue) || !Array.isArray(markersValue)) {
    return automationImportError("AUTOMATION_HISTORY_INVALID");
  }
  if (
    rowsValue.length > MAX_AUTOMATION_BACKUP_ROWS ||
    markersValue.length > MAX_AUTOMATION_HISTORY_MARKERS
  ) {
    return automationImportError("AUTOMATION_HISTORY_INVALID");
  }
  if ((rowsValue.length > 0 || markersValue.length > 0) && !expectedOwnerUserId) {
    return automationImportError("AUTOMATION_HISTORY_OWNER_REQUIRED");
  }

  const rows: AutomationTransactionTableRow[] = [];
  const rowIds = new Set<string>();
  let cumulativeCiphertextBytes = 0;
  const addRow = (row: AutomationTransactionTableRow): void => {
    if (rowIds.has(row.id)) {
      automationImportError("AUTOMATION_HISTORY_DUPLICATE");
    }
    rowIds.add(row.id);
    rows.push(row);
  };
  for (const rawRow of rowsValue) {
    if (!isPlainRecord(rawRow)) {
      return automationImportError("AUTOMATION_HISTORY_INVALID");
    }
    if (rawRow.kind === "source_pending") {
      const parsed = automationSourceIntentSchema.safeParse(rawRow);
      if (!parsed.success) return automationImportError("AUTOMATION_HISTORY_INVALID");
      addRow(parsed.data);
      continue;
    }
    if (rawRow.kind === "transaction") {
      const { kind: _kind, ...metadata } = rawRow;
      const parsed = automationTransactionSchema.safeParse(metadata);
      if (!parsed.success) return automationImportError("AUTOMATION_HISTORY_INVALID");
      cumulativeCiphertextBytes += new TextEncoder().encode(
        parsed.data.revisionCiphertext
      ).byteLength;
      addRow({ kind: "transaction", ...parsed.data });
      continue;
    }
    if (rawRow.kind === "record_revision") {
      const parsed = automationRecordRevisionStoreRowSchema.safeParse(rawRow);
      if (!parsed.success) return automationImportError("AUTOMATION_HISTORY_INVALID");
      addRow(parsed.data);
      continue;
    }
    return automationImportError("AUTOMATION_HISTORY_INVALID");
  }
  if (cumulativeCiphertextBytes > MAX_AUTOMATION_BACKUP_CIPHERTEXT_BYTES) {
    return automationImportError("AUTOMATION_HISTORY_TOO_LARGE");
  }

  const markers: AutomationHistoryMarker[] = [];
  for (const rawMarker of markersValue) {
    const parsed = automationHistoryMarkerSchema.safeParse(rawMarker);
    if (!parsed.success) return automationImportError("AUTOMATION_HISTORY_INVALID");
    markers.push(parsed.data);
  }

  if (
    expectedOwnerUserId &&
    [...rows, ...markers].some((item) => item.ownerUserId !== expectedOwnerUserId)
  ) {
    return automationImportError("AUTOMATION_HISTORY_OWNER_MISMATCH");
  }

  const transactionRows = rows.filter(
    (row): row is AutomationTransactionStoreRow => row.kind === "transaction"
  );
  const authoritativeSequences = new Set<number>();
  for (const row of transactionRows) {
    if (row.serverSequence === undefined) continue;
    if (authoritativeSequences.has(row.serverSequence)) {
      return automationImportError("AUTOMATION_HISTORY_DUPLICATE");
    }
    authoritativeSequences.add(row.serverSequence);
  }
  if (transactionRows.length > 0 && markers.length !== 1) {
    return automationImportError("AUTOMATION_HISTORY_INVALID");
  }
  const marker = markers[0];
  if (
    marker &&
    transactionRows.some(
      (row) =>
        row.historyGeneration === undefined ||
        row.historyGeneration !== marker.historyGeneration ||
        row.serverSequence === undefined ||
        row.serverSequence > marker.lastAppliedServerSequence
    )
  ) {
    return automationImportError("AUTOMATION_HISTORY_INVALID");
  }

  return { rows, markers };
}

function validateAutomationBackupForExport(
  rows: AutomationTransactionTableRow[],
  markers: AutomationHistoryMarker[]
): ValidatedAutomationBackup {
  const ownerIds = new Set([...rows, ...markers].map((item) => item.ownerUserId));
  if (ownerIds.size > 1) {
    throw new BackupExportBlockedError("AUTOMATION_HISTORY_OWNER_MISMATCH");
  }
  const expectedOwnerUserId = ownerIds.values().next().value;
  try {
    return validateAutomationBackupCollections(rows, markers, expectedOwnerUserId);
  } catch (error) {
    if (!(error instanceof BackupImportBlockedError)) throw error;
    const code: BackupExportBlockCode =
      error.code === "AUTOMATION_HISTORY_OWNER_MISMATCH"
        ? "AUTOMATION_HISTORY_OWNER_MISMATCH"
        : error.code === "AUTOMATION_HISTORY_DUPLICATE"
          ? "AUTOMATION_HISTORY_DUPLICATE"
          : error.code === "AUTOMATION_HISTORY_TOO_LARGE"
            ? "AUTOMATION_HISTORY_TOO_LARGE"
            : "AUTOMATION_HISTORY_INVALID";
    throw new BackupExportBlockedError(code);
  }
}

async function authenticateAutomationBackupRows(
  rows: readonly AutomationTransactionTableRow[],
  vaultKey: string | null
): Promise<void> {
  const transactionRows = rows.filter(
    (row): row is AutomationTransactionStoreRow => row.kind === "transaction"
  );
  if (transactionRows.length > 0 && !vaultKey) {
    automationImportError("JOURNAL_UNLOCK_REQUIRED");
  }
  for (const row of transactionRows) {
    try {
      await decryptAutomationRevision(row.revisionCiphertext, vaultKey || "", {
        schemaVersion: 1,
        transactionId: row.id,
        ownerUserId: row.ownerUserId,
        consentEpoch: row.consentEpoch,
        sourceKey: row.sourceKey,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        ruleId: row.ruleId,
        ruleVersion: row.ruleVersion,
      });
    } catch {
      automationImportError("AUTOMATION_HISTORY_INVALID");
    }
  }
}

function mergeAutomationHistoryMarkers(
  local: AutomationHistoryMarker | undefined,
  incoming: AutomationHistoryMarker | undefined,
  mode: ImportMode
): AutomationHistoryMarker | undefined {
  if (!incoming) return local;
  if (!local) return incoming;
  if (incoming.historyGeneration !== local.historyGeneration) {
    if (mode === "replace" && incoming.historyGeneration > local.historyGeneration) {
      return incoming;
    }
    automationImportError("AUTOMATION_HISTORY_STALE");
  }

  const purgedTransactionIds = [
    ...new Set([...(local.purgedTransactionIds ?? []), ...(incoming.purgedTransactionIds ?? [])]),
  ].sort();
  return automationHistoryMarkerSchema.parse({
    ...incoming,
    snapshotSequence: Math.max(local.snapshotSequence, incoming.snapshotSequence),
    lastAppliedServerSequence: Math.max(
      local.lastAppliedServerSequence,
      incoming.lastAppliedServerSequence
    ),
    bootstrapCompletedAt:
      local.bootstrapCompletedAt === null
        ? incoming.bootstrapCompletedAt
        : incoming.bootstrapCompletedAt === null
          ? local.bootstrapCompletedAt
          : Math.max(local.bootstrapCompletedAt, incoming.bootstrapCompletedAt),
    purgedTransactionIds,
    allHistoryPurgedAt:
      local.allHistoryPurgedAt === undefined
        ? incoming.allHistoryPurgedAt
        : incoming.allHistoryPurgedAt === undefined
          ? local.allHistoryPurgedAt
          : Math.max(local.allHistoryPurgedAt, incoming.allHistoryPurgedAt),
    updatedAt: Math.max(local.updatedAt, incoming.updatedAt),
  });
}

async function applyAutomationBackupInCurrentTransaction(args: {
  rows: AutomationTransactionTableRow[];
  markers: AutomationHistoryMarker[];
  rowsPresent: boolean;
  markersPresent: boolean;
  expectedOwnerUserId: string | undefined;
  mode: ImportMode;
}): Promise<{
  transactions?: ImportReportEntry;
  markers?: ImportReportEntry;
}> {
  const { rows, markers, rowsPresent, markersPresent, expectedOwnerUserId, mode } = args;
  if (!rowsPresent && !markersPresent) return {};
  if (rows.length === 0 && markers.length === 0) {
    if (mode === "replace" && expectedOwnerUserId) {
      if (rowsPresent) {
        await db.automationTransactions.where("ownerUserId").equals(expectedOwnerUserId).delete();
      }
      if (markersPresent) {
        await db.automationHistoryMarkers.delete(expectedOwnerUserId);
      }
    }
    const emptyReport = { added: 0, updated: 0, skipped: 0 };
    return {
      transactions: rowsPresent ? emptyReport : undefined,
      markers: markersPresent ? emptyReport : undefined,
    };
  }
  if (!expectedOwnerUserId) automationImportError("AUTOMATION_HISTORY_OWNER_REQUIRED");

  const localMarker = await db.automationHistoryMarkers.get(expectedOwnerUserId);
  const mergedMarker = mergeAutomationHistoryMarkers(localMarker, markers[0], mode);
  const purgedIds = new Set(mergedMarker?.purgedTransactionIds ?? []);
  const currentBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const existingRows = await db.automationTransactions
    .where("ownerUserId")
    .equals(expectedOwnerUserId)
    .toArray();
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  const rowsToWrite: AutomationTransactionTableRow[] = [];
  const rowsToDelete = new Set<string>();
  const acceptedIncomingIds = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  const acceptIncoming = (row: AutomationTransactionTableRow): void => {
    acceptedIncomingIds.add(row.id);
    rowsToWrite.push(row);
    if (mode === "replace" || !existingById.has(row.id)) added += 1;
    else updated += 1;
  };
  const sameRow = (
    left: AutomationTransactionTableRow,
    right: AutomationTransactionTableRow
  ): boolean => canonicalizeAutomationValue(left) === canonicalizeAutomationValue(right);

  const finalTransactions = new Map<string, AutomationTransactionStoreRow>();
  if (mode === "merge") {
    for (const row of existingRows) {
      if (row.kind !== "transaction") continue;
      if (purgedIds.has(row.id)) {
        rowsToDelete.add(row.id);
        continue;
      }
      const isAccepted = row.status === "committed" || row.status === "undone";
      if (isAccepted && mergedMarker && row.historyGeneration !== mergedMarker.historyGeneration) {
        rowsToDelete.add(row.id);
        continue;
      }
      finalTransactions.set(row.id, row);
    }
  }

  const incomingTransactions = rows
    .filter((row): row is AutomationTransactionStoreRow => row.kind === "transaction")
    .sort(
      (left, right) =>
        (left.serverSequence ?? Number.MAX_SAFE_INTEGER) -
          (right.serverSequence ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id)
    );
  for (const row of incomingTransactions) {
    const incomingGeneration = row.historyGeneration;
    const incomingSequence = row.serverSequence;
    if (
      (row.status !== "committed" && row.status !== "undone") ||
      incomingGeneration === undefined ||
      incomingGeneration !== mergedMarker?.historyGeneration ||
      incomingSequence === undefined ||
      purgedIds.has(row.id)
    ) {
      skipped += 1;
      continue;
    }
    const local = finalTransactions.get(row.id);
    if (mode === "merge" && local) {
      const localGeneration = local.historyGeneration ?? 0;
      const localSequence = local.serverSequence ?? 0;
      if (
        localGeneration > incomingGeneration ||
        (localGeneration === incomingGeneration && localSequence > incomingSequence)
      ) {
        skipped += 1;
        continue;
      }
      if (localGeneration === incomingGeneration && localSequence === incomingSequence) {
        if (!sameRow(local, row)) automationImportError("AUTOMATION_HISTORY_INVALID");
        skipped += 1;
        continue;
      }
    }
    finalTransactions.set(row.id, row);
    acceptIncoming(row);
  }

  for (const row of rows) {
    if (row.kind !== "source_pending") continue;
    if (row.accountBoundaryGeneration !== currentBoundaryGeneration) {
      skipped += 1;
      continue;
    }
    const local = existingById.get(row.id);
    if (mode === "merge" && local) {
      if (local.kind !== "source_pending") automationImportError("AUTOMATION_HISTORY_INVALID");
      if (local.updatedAt > row.updatedAt) {
        skipped += 1;
        continue;
      }
      if (local.updatedAt === row.updatedAt) {
        if (!sameRow(local, row)) automationImportError("AUTOMATION_HISTORY_INVALID");
        skipped += 1;
        continue;
      }
    }
    acceptIncoming(row);
  }

  const retainedTransactionIds = new Set(finalTransactions.keys());
  for (const row of rows) {
    if (row.kind !== "record_revision") continue;
    const normalized =
      row.transactionId !== null && !retainedTransactionIds.has(row.transactionId)
        ? automationRecordRevisionStoreRowSchema.parse({ ...row, transactionId: null })
        : row;
    const local = existingById.get(row.id);
    if (mode === "merge" && local) {
      if (local.kind !== "record_revision") automationImportError("AUTOMATION_HISTORY_INVALID");
      if (
        local.mutationGeneration > normalized.mutationGeneration ||
        (local.mutationGeneration === normalized.mutationGeneration &&
          local.updatedAt > normalized.updatedAt)
      ) {
        skipped += 1;
        continue;
      }
      if (
        local.mutationGeneration === normalized.mutationGeneration &&
        local.updatedAt === normalized.updatedAt
      ) {
        if (!sameRow(local, normalized)) automationImportError("AUTOMATION_HISTORY_INVALID");
        skipped += 1;
        continue;
      }
    }
    acceptIncoming(normalized);
  }

  if (mode === "merge") {
    for (const row of existingRows) {
      if (
        row.kind !== "record_revision" ||
        row.transactionId === null ||
        retainedTransactionIds.has(row.transactionId) ||
        acceptedIncomingIds.has(row.id)
      ) {
        continue;
      }
      rowsToWrite.push(
        automationRecordRevisionStoreRowSchema.parse({ ...row, transactionId: null })
      );
    }
  }

  if (mode === "replace" && rowsPresent) {
    await db.automationTransactions.where("ownerUserId").equals(expectedOwnerUserId).delete();
  }
  if (rowsToDelete.size > 0) {
    await db.automationTransactions.bulkDelete([...rowsToDelete]);
  }
  if (rowsToWrite.length > 0) {
    await db.automationTransactions.bulkPut(rowsToWrite);
  }
  if (markersPresent) {
    if (mergedMarker) {
      await db.automationHistoryMarkers.put(mergedMarker);
    } else {
      await db.automationHistoryMarkers.delete(expectedOwnerUserId);
    }
  }

  return {
    transactions: rowsPresent
      ? {
          added,
          updated,
          skipped,
        }
      : undefined,
    markers: markersPresent
      ? {
          added: mergedMarker && !localMarker ? 1 : 0,
          updated: mergedMarker && localMarker ? 1 : 0,
          skipped: markers.length - (mergedMarker ? 1 : 0),
        }
      : undefined,
  };
}

/**
 * Merge incoming items with local by timestamp. Keeps newer per-item.
 * Items in deletedIds are skipped (prevent re-import of deleted data).
 */
export async function mergeByTimestamp<T extends { id: string }>(
  table: import("dexie").Table<T, string>,
  incoming: T[],
  getTime: (item: T) => number,
  deletedIds?: Set<string>,
  initialSkipped = 0
): Promise<ImportReportEntry> {
  // Always issue a Dexie request, even for an empty collection. This helper is
  // awaited from the larger import transaction; returning an already-resolved
  // promise here lets IndexedDB auto-commit before the next collection write.
  const localItems = await table.toArray();
  if (!incoming.length) {
    return { added: 0, updated: 0, skipped: initialSkipped };
  }
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const rowsToWrite: T[] = [];
  let added = 0;
  let updated = 0;
  let skipped = initialSkipped;

  for (const remote of incoming) {
    if (deletedIds?.has(remote.id)) {
      skipped += 1;
      continue;
    }
    const local = localMap.get(remote.id);
    if (!local) {
      rowsToWrite.push(remote);
      added += 1;
      continue;
    }

    const localTime = getTime(local);
    const remoteTime = getTime(remote);
    const safeLocal = Number.isFinite(localTime) ? localTime : 0;
    const safeRemote = Number.isFinite(remoteTime) ? remoteTime : 0;
    if (safeLocal > safeRemote) {
      skipped += 1;
      continue;
    }
    rowsToWrite.push(remote);
    updated += 1;
  }

  if (rowsToWrite.length) await table.bulkPut(rowsToWrite);
  return { added, updated, skipped };
}

interface ImportDeletionSets {
  moods: Set<string>;
  habits: Set<string>;
  focusSessions: Set<string>;
  gratitudeEntries: Set<string>;
  journalEntries: Set<string>;
}

async function deleteLocalRowsMatchingTombstones<T>(
  table: Table<T, string>,
  tombstones: Set<string>
): Promise<string[]> {
  if (tombstones.size === 0) return [];

  const matchingLocalIds = (await table.toCollection().primaryKeys()).filter(
    (key): key is string => typeof key === "string" && tombstones.has(key)
  );
  if (matchingLocalIds.length) await table.bulkDelete(matchingLocalIds);
  return matchingLocalIds;
}

async function purgeTombstonedImportRows(deleted: ImportDeletionSets): Promise<void> {
  if (deleted.moods.size) {
    await deleteLocalRowsMatchingTombstones(db.moods, deleted.moods);
  }
  if (deleted.habits.size) {
    await deleteLocalRowsMatchingTombstones(db.habits, deleted.habits);
  }
  if (deleted.focusSessions.size) {
    await deleteLocalRowsMatchingTombstones(db.focusSessions, deleted.focusSessions);
  }
  if (deleted.gratitudeEntries.size) {
    await deleteLocalRowsMatchingTombstones(db.gratitudeEntries, deleted.gratitudeEntries);
  }
  const journalEntryIds = deleted.journalEntries.size
    ? await deleteLocalRowsMatchingTombstones(db.journalEntries, deleted.journalEntries)
    : [];
  if (!journalEntryIds.length) return;

  const photoIds = await db.journalPhotos.where("entryId").anyOf(journalEntryIds).primaryKeys();
  if (photoIds.length) await db.journalPhotos.bulkDelete(photoIds);
  const audioIds = await db.journalAudio.where("entryId").anyOf(journalEntryIds).primaryKeys();
  if (audioIds.length) await db.journalAudio.bulkDelete(audioIds);
}

const importBackupWithinJournalSecurityLock = async (
  payload: BackupPayload,
  mode: ImportMode,
  options: ImportBackupOptions = {}
): Promise<ImportReport> => {
  const assertExternalImportOwner = async () => {
    if (options.expectedOwnerUserId) {
      await validateSyncOwner(options.expectedOwnerUserId, "Backup import");
    }
    if (options.assertExternalOwnerRealmCurrent) {
      await options.assertExternalOwnerRealmCurrent();
    }
  };
  await assertExternalImportOwner();
  if (options.assertDataOwnerRealmCurrent) {
    await options.assertDataOwnerRealmCurrent();
  }
  const normalized = normalizeBackup(payload);
  const remoteDeletedHabitIds = readDeletionHistoryField(payload, "deletedHabitIds");
  const remoteDeletedJournalIds = readDeletionHistoryField(payload, "deletedJournalEntryIds");
  const remoteDeletedMoodIds = readDeletionHistoryField(payload, "deletedMoodIds");
  const remoteDeletedFocusIds = readDeletionHistoryField(payload, "deletedFocusSessionIds");
  const remoteDeletedGratitudeIds = readDeletionHistoryField(payload, "deletedGratitudeIds");

  const {
    moods,
    habits,
    focusSessions,
    gratitudeEntries,
    settings,
    journalEntries,
    journalPhotos,
    journalAudio,
    journalHubPreferences,
    journalSpaces,
    journalPracticeSessions,
    journalEntryLinks,
    journalSpaceCaptures,
    automationTransactions,
    automationHistoryMarkers,
  } = normalized.data;
  const backupCollectionPresence = normalized.collectionPresence;
  if (
    backupCollectionPresence.automationTransactions !==
    backupCollectionPresence.automationHistoryMarkers
  ) {
    automationImportError("AUTOMATION_HISTORY_INVALID");
  }

  // Type-safe validation using Zod schemas
  const validateAndSanitize = <T>(
    items: unknown[] | undefined,
    schema: Parameters<typeof safeValidate>[0],
    maxItems = 100000
  ): { valid: T[]; skipped: number } => {
    const list = items || [];
    // Limit array size to prevent DOS attacks
    if (list.length > maxItems) {
      throw new Error(`Backup file too large (max ${maxItems} items per collection)`);
    }

    const valid: T[] = [];
    let skipped = 0;

    for (const item of list) {
      // First sanitize to prevent prototype pollution
      const sanitized = sanitizeObject(item as Record<string, unknown>);
      // Then validate against schema
      const validated = safeValidate(schema, sanitized);
      if (validated) {
        valid.push(validated as T);
      } else {
        skipped++;
      }
    }

    return { valid, skipped };
  };

  // Validate each collection with strict type checking
  const validMoods = validateAndSanitize<MoodEntry>(moods, moodEntrySchema);
  const validHabits = validateAndSanitize<Habit>(habits, habitSchema);
  const validFocus = validateAndSanitize<FocusSession>(focusSessions, focusSessionSchema);
  const validGratitude = validateAndSanitize<GratitudeEntry>(
    gratitudeEntries,
    gratitudeEntrySchema
  );
  const rawValidSettings = validateAndSanitize<{ key: string; value: unknown }>(
    settings,
    settingSchema
  );
  const accountSyncedValidSettings = rawValidSettings.valid.filter((setting) =>
    isBackupPortableSettingKey(setting.key)
  );
  const validSettings = {
    valid: accountSyncedValidSettings,
    skipped:
      rawValidSettings.skipped +
      (rawValidSettings.valid.length - accountSyncedValidSettings.length),
  };

  let validJournalEntries = validateJournalCollection<JournalEntry>(
    journalEntries,
    validateImportedJournalEntry
  );
  let validJournalPhotos = validateJournalCollection<JournalPhoto>(
    journalPhotos,
    validateImportedJournalPhoto
  );
  let validJournalAudio = validateJournalCollection<JournalAudio>(
    journalAudio,
    validateImportedJournalAudio
  );
  const validJournalHubPreferences = validateJournalCollection<JournalHubPreferences>(
    journalHubPreferences,
    validateImportedJournalHubPreferences
  );
  let validJournalSpaces = validateJournalCollection<JournalSpace>(
    journalSpaces,
    validateImportedJournalSpace
  );
  const validJournalPracticeSessions = validateJournalCollection<JournalPracticeSession>(
    journalPracticeSessions,
    validateImportedJournalPracticeSession
  );
  const validJournalEntryLinks = validateJournalCollection<JournalEntryLink>(
    journalEntryLinks,
    validateImportedJournalEntryLink
  );
  let validJournalSpaceCaptures = validateJournalCollection<JournalSpaceCapture>(
    journalSpaceCaptures,
    validateImportedJournalSpaceCapture
  );
  const validAutomation = validateAutomationBackupCollections(
    automationTransactions,
    automationHistoryMarkers,
    options.expectedOwnerUserId
  );

  const journalVaultKey = getJournalContentVaultKey();
  const journalVaultRevision = journalVaultKey
    ? requireSafeJournalVaultRevision(getJournalContentVaultRevision(), "backup import")
    : undefined;
  await authenticateAutomationBackupRows(validAutomation.rows, journalVaultKey);
  const [
    journalPasswordSetting,
    journalVaultSetting,
    localAutomationRowCount,
    localAutomationMarker,
  ] = await Promise.all([
    db.settings.get(SK.JOURNAL_PASSWORD),
    db.settings.get(SK.JOURNAL_VAULT_KEY),
    options.expectedOwnerUserId
      ? db.automationTransactions.where("ownerUserId").equals(options.expectedOwnerUserId).count()
      : Promise.resolve(0),
    options.expectedOwnerUserId
      ? db.automationHistoryMarkers.get(options.expectedOwnerUserId)
      : Promise.resolve(undefined),
  ]);
  const hasProtectedLocalJournal = Boolean(
    journalPasswordSetting?.value || journalVaultSetting?.value
  );
  const hasLockedLocalJournal = hasProtectedLocalJournal && !journalVaultKey;
  if (
    !hasProtectedLocalJournal &&
    !journalVaultKey &&
    hasUnreadableEncryptedJournalRows({
      entries: validJournalEntries,
      photos: validJournalPhotos,
      audio: validJournalAudio,
      spaces: validJournalSpaces,
      captures: validJournalSpaceCaptures,
    })
  ) {
    throw new BackupImportBlockedError("JOURNAL_BACKUP_UNREADABLE");
  }
  if (mode === "replace" && hasLockedLocalJournal) {
    throw new BackupImportBlockedError("JOURNAL_UNLOCK_REQUIRED");
  }
  if (
    hasLockedLocalJournal &&
    hasUnreadableEncryptedJournalRows({
      entries: validJournalEntries,
      photos: validJournalPhotos,
      audio: validJournalAudio,
      spaces: validJournalSpaces,
      captures: validJournalSpaceCaptures,
    })
  ) {
    // Ciphertext cannot be authenticated against this diary while its vault
    // key is unavailable. Keep the whole import atomic and ask for unlock.
    throw new BackupImportBlockedError("JOURNAL_UNLOCK_REQUIRED");
  }
  const automationReplaceTouchesHistory =
    mode === "replace" &&
    (backupCollectionPresence.automationTransactions ||
      backupCollectionPresence.automationHistoryMarkers) &&
    (validAutomation.rows.length > 0 ||
      validAutomation.markers.length > 0 ||
      localAutomationRowCount > 0 ||
      localAutomationMarker !== undefined);
  let replaceAuthorizationAccepted = false;
  if (mode === "replace" && (hasProtectedLocalJournal || automationReplaceTouchesHistory)) {
    const vaultSetting = journalVaultSetting?.value;
    const vaultRevision =
      vaultSetting && typeof vaultSetting === "object" && "updatedAt" in vaultSetting
        ? Number(vaultSetting.updatedAt)
        : Number.NaN;
    const isAuthorized =
      Number.isFinite(vaultRevision) &&
      consumeJournalReplaceAuthorization(
        options.journalReplaceAuthorization,
        vaultRevision,
        options.now ?? Date.now()
      );
    if (!isAuthorized) {
      throw new BackupImportBlockedError("JOURNAL_REPLACE_AUTHORIZATION_REQUIRED");
    }
    replaceAuthorizationAccepted = true;
  }
  if (hasLockedLocalJournal) {
    const incomingEntryIds = new Set(validJournalEntries.map((entry) => entry.id));
    const safeEntries = validJournalEntries.filter(canImportJournalEntryWhileLocked);
    const safeEntryIds = new Set(safeEntries.map((entry) => entry.id));
    validJournalEntries = safeEntries;
    validJournalPhotos = validJournalPhotos.filter(
      (photo) =>
        canImportJournalMediaWhileLocked(photo) &&
        (incomingEntryIds.size === 0 || safeEntryIds.has(photo.entryId))
    );
    validJournalAudio = validJournalAudio.filter(
      (audio) =>
        canImportJournalMediaWhileLocked(audio) &&
        (incomingEntryIds.size === 0 || safeEntryIds.has(audio.entryId))
    );
    validJournalSpaces = validJournalSpaces.filter(canImportJournalSpaceWhileLocked);
    validJournalSpaceCaptures = validJournalSpaceCaptures.filter(
      canImportJournalSpaceCaptureWhileLocked
    );
  } else if (journalVaultKey) {
    // Portable backups can contain base64 media near the file-size limit.
    // Encrypt sequentially so WebCrypto does not retain several large input
    // and output buffers at once on memory-constrained mobile WebViews.
    validJournalEntries = await mapSequentially(validJournalEntries, (entry) =>
      encryptImportedJournalEntryForStorage(entry, journalVaultKey, journalVaultRevision)
    );
    validJournalPhotos = await mapSequentially(validJournalPhotos, (photo) =>
      encryptImportedJournalPhotoForStorage(photo, journalVaultKey, journalVaultRevision)
    );
    validJournalAudio = await mapSequentially(validJournalAudio, (audio) =>
      encryptImportedJournalAudioForStorage(audio, journalVaultKey, journalVaultRevision)
    );
    validJournalSpaces = await mapSequentially(validJournalSpaces, (space) =>
      protectImportedJournalSpace(space, journalVaultKey, journalVaultRevision)
    );
    validJournalSpaceCaptures = await mapSequentially(validJournalSpaceCaptures, (capture) =>
      protectImportedJournalSpaceCapture(capture, journalVaultKey, journalVaultRevision)
    );
  }

  let importTransaction: Transaction | null = null;
  let ownerRealmInvalidated = false;
  let externalOwnerAssertionInFlight = false;
  const abortInvalidatedImport = (): never => {
    if (importTransaction?.active) importTransaction.abort();
    throw new Error("Backup import owner realm changed during transaction");
  };
  const unsubscribeOwnerRealmInvalidation = options.subscribeOwnerRealmInvalidation?.(() => {
    ownerRealmInvalidated = true;
    // Dexie documents that the current transaction may be temporarily
    // inactive while a Dexie.waitFor() promise is executing. Defer abort to
    // the first active continuation in that case; otherwise abort now so the
    // guard remains armed through the native IndexedDB commit event.
    if (importTransaction?.active && !externalOwnerAssertionInFlight) {
      importTransaction.abort();
    }
  });
  try {
    await assertExternalImportOwner();
    if (options.assertDataOwnerRealmCurrent) {
      await options.assertDataOwnerRealmCurrent();
    }
    return await db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.focusSessions,
        db.gratitudeEntries,
        db.settings,
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
        db.journalHubPreferences,
        db.journalSpaces,
        db.journalPracticeSessions,
        db.journalEntryLinks,
        db.journalSpaceCaptures,
        db.automationTransactions,
        db.automationHistoryMarkers,
      ],
      async () => {
        importTransaction = Dexie.currentTransaction;
        if (!importTransaction) {
          throw new Error("Backup import transaction is unavailable");
        }
        if (ownerRealmInvalidated) {
          abortInvalidatedImport();
        }
        if (options.assertDataOwnerRealmCurrent) {
          await options.assertDataOwnerRealmCurrent();
        }
        const createExternalOwnerAssertion = (): Promise<void> => {
          externalOwnerAssertionInFlight = true;
          return assertExternalImportOwner().finally(() => {
            externalOwnerAssertionInFlight = false;
          });
        };
        if (
          mode === "replace" &&
          !replaceAuthorizationAccepted &&
          options.expectedOwnerUserId &&
          (backupCollectionPresence.automationTransactions ||
            backupCollectionPresence.automationHistoryMarkers)
        ) {
          const [currentAutomationRows, currentAutomationMarker] = await Promise.all([
            db.automationTransactions
              .where("ownerUserId")
              .equals(options.expectedOwnerUserId)
              .count(),
            db.automationHistoryMarkers.get(options.expectedOwnerUserId),
          ]);
          if (
            validAutomation.rows.length > 0 ||
            validAutomation.markers.length > 0 ||
            currentAutomationRows > 0 ||
            currentAutomationMarker !== undefined
          ) {
            throw new BackupImportBlockedError("JOURNAL_REPLACE_AUTHORIZATION_REQUIRED");
          }
        }
        const automationReports = await applyAutomationBackupInCurrentTransaction({
          rows: validAutomation.rows,
          markers: validAutomation.markers,
          rowsPresent: backupCollectionPresence.automationTransactions,
          markersPresent: backupCollectionPresence.automationHistoryMarkers,
          expectedOwnerUserId: options.expectedOwnerUserId,
          mode,
        });
        const deleted: ImportDeletionSets = {
          moods: await mergeDeletionTrackerIdsInCurrentTransaction(
            DELETION_TRACKER_KEYS.mood,
            remoteDeletedMoodIds ?? []
          ),
          habits: await mergeDeletionTrackerIdsInCurrentTransaction(
            DELETION_TRACKER_KEYS.habit,
            remoteDeletedHabitIds ?? []
          ),
          focusSessions: await mergeDeletionTrackerIdsInCurrentTransaction(
            DELETION_TRACKER_KEYS.focus,
            remoteDeletedFocusIds ?? []
          ),
          gratitudeEntries: await mergeDeletionTrackerIdsInCurrentTransaction(
            DELETION_TRACKER_KEYS.gratitude,
            remoteDeletedGratitudeIds ?? []
          ),
          journalEntries: await mergeDeletionTrackerIdsInCurrentTransaction(
            DELETION_TRACKER_KEYS.journal,
            remoteDeletedJournalIds ?? []
          ),
        };

        const existingJournalEntries =
          mode === "merge" || !backupCollectionPresence.journalEntries
            ? await db.journalEntries.toArray()
            : [];
        const candidateJournalEntries = validJournalEntries.filter(
          (entry) => !deleted.journalEntries.has(entry.id)
        );
        const existingJournalEntryMap = new Map(
          existingJournalEntries.map((entry) => [entry.id, entry])
        );
        const rejectedJournalEntryIds = new Set<string>();
        const mergeableJournalEntries = candidateJournalEntries.filter((entry) => {
          if (mode !== "merge") return true;
          const local = existingJournalEntryMap.get(entry.id);
          if (!local) return true;

          const localUpdatedAt = Number.isFinite(local.updatedAt) ? local.updatedAt : 0;
          const remoteUpdatedAt = Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0;
          const remoteWins = remoteUpdatedAt > localUpdatedAt;
          if (!remoteWins) rejectedJournalEntryIds.add(entry.id);
          return remoteWins;
        });
        const candidateJournalEntryIds = new Set(mergeableJournalEntries.map((entry) => entry.id));
        const importableJournalEntryIds = new Set(mergeableJournalEntries.map((entry) => entry.id));
        existingJournalEntries.forEach((entry) => {
          if (!deleted.journalEntries.has(entry.id)) {
            importableJournalEntryIds.add(entry.id);
          }
        });

        const importMoods = validMoods.valid.filter((item) => !deleted.moods.has(item.id));
        const importHabits = validHabits.valid.filter((item) => !deleted.habits.has(item.id));
        const importFocus = validFocus.valid.filter((item) => !deleted.focusSessions.has(item.id));
        const importGratitude = validGratitude.valid.filter(
          (item) => !deleted.gratitudeEntries.has(item.id)
        );
        const candidateJournalPhotos = validJournalPhotos.filter(
          (photo) =>
            !rejectedJournalEntryIds.has(photo.entryId) &&
            importableJournalEntryIds.has(photo.entryId) &&
            !deleted.journalEntries.has(photo.entryId)
        );
        const candidateJournalAudio = validJournalAudio.filter(
          (audio) =>
            !rejectedJournalEntryIds.has(audio.entryId) &&
            importableJournalEntryIds.has(audio.entryId) &&
            !deleted.journalEntries.has(audio.entryId)
        );
        const existingJournalPhotos =
          mode === "merge" || !backupCollectionPresence.journalPhotos
            ? await db.journalPhotos.toArray()
            : [];
        const existingJournalAudio =
          mode === "merge" || !backupCollectionPresence.journalAudio
            ? await db.journalAudio.toArray()
            : [];
        const committedPhotoOwners = new Map<string, string>();
        for (const photo of existingJournalPhotos) {
          if (importableJournalEntryIds.has(photo.entryId)) {
            committedPhotoOwners.set(photo.id, photo.entryId);
          }
        }
        for (const photo of candidateJournalPhotos) {
          committedPhotoOwners.set(photo.id, photo.entryId);
        }
        const committedAudioOwners = new Map<string, string>();
        for (const audio of existingJournalAudio) {
          if (importableJournalEntryIds.has(audio.entryId)) {
            committedAudioOwners.set(audio.id, audio.entryId);
          }
        }
        for (const audio of candidateJournalAudio) {
          committedAudioOwners.set(audio.id, audio.entryId);
        }
        const importJournalEntries = mergeableJournalEntries.map((entry) => {
          const photoIds = [...new Set(entry.photoIds)]
            .filter((photoId) => committedPhotoOwners.get(photoId) === entry.id)
            .slice(0, MAX_PHOTOS_PER_ENTRY);
          const photoLayout = normalizeJournalPhotoLayout(entry.photoLayout, photoIds);
          const { photoLayout: _discardedPhotoLayout, ...entryWithoutPhotoLayout } = entry;
          return {
            ...entryWithoutPhotoLayout,
            photoIds,
            ...(photoLayout ? { photoLayout } : {}),
            audioIds: entry.audioIds
              ? [...new Set(entry.audioIds)]
                  .filter((audioId) => committedAudioOwners.get(audioId) === entry.id)
                  .slice(0, MAX_AUDIO_PER_ENTRY)
              : entry.audioIds,
          };
        });
        const importedPhotoIds = new Set(importJournalEntries.flatMap((entry) => entry.photoIds));
        const importJournalPhotos = candidateJournalPhotos.filter(
          (photo) => !candidateJournalEntryIds.has(photo.entryId) || importedPhotoIds.has(photo.id)
        );
        const importedAudioIds = new Set(
          importJournalEntries.flatMap((entry) => entry.audioIds ?? [])
        );
        const importJournalAudio = candidateJournalAudio.filter(
          (audio) => !candidateJournalEntryIds.has(audio.entryId) || importedAudioIds.has(audio.id)
        );

        const existingJournalSpaces =
          mode === "merge" || !backupCollectionPresence.journalSpaces
            ? await db.journalSpaces.toArray()
            : [];
        const importJournalSpaces = validJournalSpaces;
        const importableJournalSpaceIds = new Set(existingJournalSpaces.map((space) => space.id));
        importJournalSpaces.forEach((space) => importableJournalSpaceIds.add(space.id));
        const importJournalPracticeSessions = validJournalPracticeSessions.map((session) =>
          session.entryId && !importableJournalEntryIds.has(session.entryId)
            ? { ...session, entryId: undefined }
            : session
        );
        const importJournalEntryLinks = validJournalEntryLinks.filter(
          (link) =>
            importableJournalEntryIds.has(link.entryId) &&
            (link.targetType !== "space" || importableJournalSpaceIds.has(link.targetId))
        );
        const importJournalSpaceCaptures = validJournalSpaceCaptures
          .filter((capture) => importableJournalSpaceIds.has(capture.spaceId))
          .map((capture) =>
            capture.entryId && !importableJournalEntryIds.has(capture.entryId)
              ? { ...capture, entryId: undefined }
              : capture
          );
        const importJournalHubPreferences = validJournalHubPreferences;

        if (mode === "replace") {
          await db.moods.clear();
          await db.habits.clear();
          await db.focusSessions.clear();
          await db.gratitudeEntries.clear();
          const existingAccountSyncedSettingKeys = (
            await db.settings.toCollection().primaryKeys()
          ).filter(
            (key): key is string => typeof key === "string" && isBackupPortableSettingKey(key)
          );
          if (existingAccountSyncedSettingKeys.length) {
            await db.settings.bulkDelete(existingAccountSyncedSettingKeys);
          }
          if (backupCollectionPresence.journalEntries) await db.journalEntries.clear();
          if (backupCollectionPresence.journalPhotos) await db.journalPhotos.clear();
          if (backupCollectionPresence.journalAudio) await db.journalAudio.clear();
          if (backupCollectionPresence.journalHubPreferences) {
            await db.journalHubPreferences.clear();
          }
          if (backupCollectionPresence.journalSpaces) await db.journalSpaces.clear();
          if (backupCollectionPresence.journalPracticeSessions) {
            await db.journalPracticeSessions.clear();
          }
          if (backupCollectionPresence.journalEntryLinks) {
            await db.journalEntryLinks.clear();
          }
          if (backupCollectionPresence.journalSpaceCaptures) {
            await db.journalSpaceCaptures.clear();
          }

          if (importMoods.length) await db.moods.bulkAdd(importMoods);
          if (importHabits.length) await db.habits.bulkAdd(importHabits);
          if (importFocus.length) await db.focusSessions.bulkAdd(importFocus);
          if (importGratitude.length) await db.gratitudeEntries.bulkAdd(importGratitude);
          if (validSettings.valid.length) await db.settings.bulkAdd(validSettings.valid);
          if (backupCollectionPresence.journalEntries && importJournalEntries.length) {
            await db.journalEntries.bulkAdd(importJournalEntries);
          }
          if (backupCollectionPresence.journalPhotos && importJournalPhotos.length) {
            await db.journalPhotos.bulkAdd(importJournalPhotos);
          }
          if (backupCollectionPresence.journalAudio && importJournalAudio.length) {
            await db.journalAudio.bulkAdd(importJournalAudio);
          }
          if (
            backupCollectionPresence.journalHubPreferences &&
            importJournalHubPreferences.length
          ) {
            await db.journalHubPreferences.bulkAdd(importJournalHubPreferences);
          }
          if (backupCollectionPresence.journalSpaces && importJournalSpaces.length) {
            await db.journalSpaces.bulkAdd(importJournalSpaces);
          }
          if (
            backupCollectionPresence.journalPracticeSessions &&
            importJournalPracticeSessions.length
          ) {
            await db.journalPracticeSessions.bulkAdd(importJournalPracticeSessions);
          }
          if (backupCollectionPresence.journalEntryLinks && importJournalEntryLinks.length) {
            await db.journalEntryLinks.bulkAdd(importJournalEntryLinks);
          }
          if (backupCollectionPresence.journalSpaceCaptures && importJournalSpaceCaptures.length) {
            await db.journalSpaceCaptures.bulkAdd(importJournalSpaceCaptures);
          }

          await Dexie.waitFor(createExternalOwnerAssertion());
          if (ownerRealmInvalidated) abortInvalidatedImport();
          if (options.assertDataOwnerRealmCurrent) {
            await options.assertDataOwnerRealmCurrent();
          }
          await purgeTombstonedImportRows(deleted);
          await Dexie.waitFor(createExternalOwnerAssertion());
          if (ownerRealmInvalidated) abortInvalidatedImport();
          if (options.assertDataOwnerRealmCurrent) {
            await options.assertDataOwnerRealmCurrent();
          }

          return {
            mode,
            moods: {
              added: importMoods.length,
              updated: 0,
              skipped: validMoods.skipped + (validMoods.valid.length - importMoods.length),
            },
            habits: {
              added: importHabits.length,
              updated: 0,
              skipped: validHabits.skipped + (validHabits.valid.length - importHabits.length),
            },
            focusSessions: {
              added: importFocus.length,
              updated: 0,
              skipped: validFocus.skipped + (validFocus.valid.length - importFocus.length),
            },
            gratitudeEntries: {
              added: importGratitude.length,
              updated: 0,
              skipped:
                validGratitude.skipped + (validGratitude.valid.length - importGratitude.length),
            },
            settings: {
              added: validSettings.valid.length,
              updated: 0,
              skipped: validSettings.skipped,
            },
            journalEntries: {
              added: importJournalEntries.length,
              updated: 0,
              skipped: (journalEntries || []).length - importJournalEntries.length,
            },
            journalPhotos: {
              added: importJournalPhotos.length,
              updated: 0,
              skipped: (journalPhotos || []).length - importJournalPhotos.length,
            },
            journalAudio: {
              added: importJournalAudio.length,
              updated: 0,
              skipped: (journalAudio || []).length - importJournalAudio.length,
            },
            journalHubPreferences: {
              added: importJournalHubPreferences.length,
              updated: 0,
              skipped: (journalHubPreferences || []).length - importJournalHubPreferences.length,
            },
            journalSpaces: {
              added: importJournalSpaces.length,
              updated: 0,
              skipped: (journalSpaces || []).length - importJournalSpaces.length,
            },
            journalPracticeSessions: {
              added: importJournalPracticeSessions.length,
              updated: 0,
              skipped:
                (journalPracticeSessions || []).length - importJournalPracticeSessions.length,
            },
            journalEntryLinks: {
              added: importJournalEntryLinks.length,
              updated: 0,
              skipped: (journalEntryLinks || []).length - importJournalEntryLinks.length,
            },
            journalSpaceCaptures: {
              added: importJournalSpaceCaptures.length,
              updated: 0,
              skipped: (journalSpaceCaptures || []).length - importJournalSpaceCaptures.length,
            },
            automationTransactions: automationReports.transactions,
            automationHistoryMarkers: automationReports.markers,
          };
        }

        const [settingsKeys, journalEntryKeys, journalPhotoKeys, journalAudioKeys] =
          await Promise.all([
            db.settings.toCollection().primaryKeys(),
            db.journalEntries.toCollection().primaryKeys(),
            db.journalPhotos.toCollection().primaryKeys(),
            db.journalAudio.toCollection().primaryKeys(),
          ]);

        const countMergeRows = (
          rows: Array<{ id: string }>,
          existingKeys: Set<unknown>,
          skipped: number
        ): ImportReportEntry => {
          const added = rows.filter((row) => !existingKeys.has(row.id)).length;
          return { added, updated: rows.length - added, skipped };
        };

        const moodReport = await mergeByTimestamp(
          db.moods,
          importMoods,
          (mood) => mood.updatedAt || mood.timestamp || 0,
          deleted.moods,
          validMoods.skipped + (validMoods.valid.length - importMoods.length)
        );
        const habitReport = await mergeByTimestamp(
          db.habits,
          importHabits,
          (habit) => (habit.updatedAt ? new Date(habit.updatedAt).getTime() : 0),
          deleted.habits,
          validHabits.skipped + (validHabits.valid.length - importHabits.length)
        );
        const focusReport = await mergeByTimestamp(
          db.focusSessions,
          importFocus,
          (focus) => focus.updatedAt || focus.completedAt || 0,
          deleted.focusSessions,
          validFocus.skipped + (validFocus.valid.length - importFocus.length)
        );
        const gratitudeReport = await mergeByTimestamp(
          db.gratitudeEntries,
          importGratitude,
          (gratitude) => gratitude.updatedAt || gratitude.timestamp || 0,
          deleted.gratitudeEntries,
          validGratitude.skipped + (validGratitude.valid.length - importGratitude.length)
        );
        if (validSettings.valid.length) await db.settings.bulkPut(validSettings.valid);
        if (importJournalEntries.length) await db.journalEntries.bulkPut(importJournalEntries);
        if (importJournalPhotos.length) await db.journalPhotos.bulkPut(importJournalPhotos);
        if (importJournalAudio.length) await db.journalAudio.bulkPut(importJournalAudio);
        const journalHubPreferencesReport = await mergeByTimestamp(
          db.journalHubPreferences,
          importJournalHubPreferences,
          (preferences) => preferences.updatedAt,
          undefined,
          (journalHubPreferences || []).length - importJournalHubPreferences.length
        );
        const journalSpacesReport = await mergeByTimestamp(
          db.journalSpaces,
          importJournalSpaces,
          (space) => space.updatedAt,
          undefined,
          (journalSpaces || []).length - importJournalSpaces.length
        );
        const journalPracticeSessionsReport = await mergeByTimestamp(
          db.journalPracticeSessions,
          importJournalPracticeSessions,
          (session) => session.completedAt || session.startedAt,
          undefined,
          (journalPracticeSessions || []).length - importJournalPracticeSessions.length
        );
        const journalEntryLinksReport = await mergeByTimestamp(
          db.journalEntryLinks,
          importJournalEntryLinks,
          (link) => link.createdAt,
          undefined,
          (journalEntryLinks || []).length - importJournalEntryLinks.length
        );
        const journalSpaceCapturesReport = await mergeByTimestamp(
          db.journalSpaceCaptures,
          importJournalSpaceCaptures,
          (capture) => capture.updatedAt,
          undefined,
          (journalSpaceCaptures || []).length - importJournalSpaceCaptures.length
        );

        await Dexie.waitFor(createExternalOwnerAssertion());
        if (ownerRealmInvalidated) abortInvalidatedImport();
        if (options.assertDataOwnerRealmCurrent) {
          await options.assertDataOwnerRealmCurrent();
        }
        await purgeTombstonedImportRows(deleted);
        await Dexie.waitFor(createExternalOwnerAssertion());
        if (ownerRealmInvalidated) abortInvalidatedImport();
        if (options.assertDataOwnerRealmCurrent) {
          await options.assertDataOwnerRealmCurrent();
        }

        const settingsKeySet = new Set<unknown>(settingsKeys);
        const settingsAdded = validSettings.valid.filter(
          (setting) => !settingsKeySet.has(setting.key)
        ).length;

        return {
          mode,
          moods: moodReport,
          habits: habitReport,
          focusSessions: focusReport,
          gratitudeEntries: gratitudeReport,
          settings: {
            added: settingsAdded,
            updated: validSettings.valid.length - settingsAdded,
            skipped: validSettings.skipped,
          },
          journalEntries: countMergeRows(
            importJournalEntries,
            new Set<unknown>(journalEntryKeys),
            (journalEntries || []).length - importJournalEntries.length
          ),
          journalPhotos: countMergeRows(
            importJournalPhotos,
            new Set<unknown>(journalPhotoKeys),
            (journalPhotos || []).length - importJournalPhotos.length
          ),
          journalAudio: countMergeRows(
            importJournalAudio,
            new Set<unknown>(journalAudioKeys),
            (journalAudio || []).length - importJournalAudio.length
          ),
          journalHubPreferences: journalHubPreferencesReport,
          journalSpaces: journalSpacesReport,
          journalPracticeSessions: journalPracticeSessionsReport,
          journalEntryLinks: journalEntryLinksReport,
          journalSpaceCaptures: journalSpaceCapturesReport,
          automationTransactions: automationReports.transactions,
          automationHistoryMarkers: automationReports.markers,
        };
      }
    );
  } finally {
    importTransaction = null;
    unsubscribeOwnerRealmInvalidation?.();
  }
};

/**
 * Diary protection changes and backup ingress share one write lock so the
 * encryption decision and the IndexedDB commit observe the same vault state.
 */
export const importBackup = (
  payload: BackupPayload,
  mode: ImportMode,
  options: ImportBackupOptions = {}
): Promise<ImportReport> =>
  runWithJournalSecurityWriteLock(() =>
    importBackupWithinJournalSecurityLock(payload, mode, options)
  );
