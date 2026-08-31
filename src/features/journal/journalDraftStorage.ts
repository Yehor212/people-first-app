import { logger } from "@/lib/logger";
import { safeJsonParse, storageGetRaw, storageRemove } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { settingsRepo } from "@/storage/db";
import { deleteSettingFromCloud } from "@/storage/realtimeSync";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import type { MoodType } from "@/types";
import {
  getJournalContentVaultKey,
  getJournalContentVaultRevision,
} from "./journalContentSession";
import { runWithJournalSecurityWriteLock } from "./journalSecurityWriteLock";
import { getJournalVaultKeyForWrite } from "./journalWriteSecurity";
import {
  decryptJournalContentIfNeeded,
  encryptJournalContent,
  isEncryptedJournalContent,
} from "./journalCrypto";
import type {
  BackgroundIntensity,
  DiaryBgPattern,
  DiaryFontName,
  DiaryThemeName,
  FontSizeName,
  PaperColor,
  PaperTexture,
  ParticleSpeed,
} from "./types";
import {
  MAX_AUDIO_PER_ENTRY,
  MAX_PHOTOS_PER_ENTRY,
  MAX_STICKERS_PER_ENTRY,
} from "./types";
import { isCanonicalJournalDate } from "./journalDateUtils";
import { normalizeJournalPhotoLayout } from "./photoLayout";
import { normalizeJournalStyleFields } from "./journalStyleFields";
import {
  normalizeJournalVaultRevision,
  requireSafeJournalVaultRevision,
} from "./journalVaultEpoch";

export interface JournalDraftData {
  title: string;
  date: string;
  content: string;
  stickers: string[];
  photoIds: string[];
  audioIds?: string[];
  mood?: MoodType;
  tags: string[];
  habitSnapshot?: {
    habitId: string;
    habitName: string;
    habitIcon: string;
    completed: boolean;
  }[];
  savedAt: number;
  theme?: DiaryThemeName;
  font?: DiaryFontName;
  inkColor?: string;
  paperTexture?: PaperTexture;
  paperColor?: PaperColor;
  bgIntensity?: BackgroundIntensity;
  particleSpeed?: ParticleSpeed;
  bgPattern?: DiaryBgPattern;
  fontSize?: FontSizeName;
  photoLayout?: Record<
    string,
    { x: number; y: number; width: number; description?: string }
  >;
  /** Exact journal vault epoch for protected storage; absent for plaintext. */
  vaultRevision?: number;
}

const JOURNAL_DRAFT_KEY_PREFIX = SK.journalDraft("");
export const JOURNAL_DRAFT_WRITER_LEASE_TTL_MS = 120_000;
const JOURNAL_MOODS = new Set<MoodType>(["great", "good", "okay", "bad", "terrible"]);

interface JournalDraftWriterLease {
  writerId: string;
  heartbeatAt: number;
}

function normalizeUniqueStrings(value: unknown, maxLength?: number): string[] {
  if (!Array.isArray(value)) return [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
    if (maxLength !== undefined && normalized.length >= maxLength) break;
  }
  return normalized;
}

function normalizeJournalDraftData(value: unknown): JournalDraftData | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.content !== "string") return null;

  const photoIds = normalizeUniqueStrings(raw.photoIds, MAX_PHOTOS_PER_ENTRY);
  const audioIds =
    raw.audioIds === undefined
      ? undefined
      : normalizeUniqueStrings(raw.audioIds, MAX_AUDIO_PER_ENTRY);
  const habitSnapshot = Array.isArray(raw.habitSnapshot)
    ? raw.habitSnapshot.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const habit = item as Record<string, unknown>;
        if (
          typeof habit.habitId !== "string" ||
          !habit.habitId.trim() ||
          typeof habit.habitName !== "string" ||
          typeof habit.habitIcon !== "string" ||
          typeof habit.completed !== "boolean"
        ) {
          return [];
        }
        return [{
          habitId: habit.habitId,
          habitName: habit.habitName,
          habitIcon: habit.habitIcon,
          completed: habit.completed,
        }];
      })
    : undefined;
  const style = normalizeJournalStyleFields(raw);
  const mood =
    typeof raw.mood === "string" && JOURNAL_MOODS.has(raw.mood as MoodType)
      ? (raw.mood as MoodType)
      : undefined;
  const photoLayout = normalizeJournalPhotoLayout(raw.photoLayout, photoIds);

  const vaultRevision = normalizeJournalVaultRevision(raw.vaultRevision);
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    date:
      typeof raw.date === "string" && isCanonicalJournalDate(raw.date)
        ? raw.date
        : "",
    content: raw.content,
    stickers: normalizeUniqueStrings(raw.stickers, MAX_STICKERS_PER_ENTRY),
    photoIds,
    ...(audioIds !== undefined ? { audioIds } : {}),
    ...(mood ? { mood } : {}),
    tags: normalizeUniqueStrings(raw.tags),
    ...(habitSnapshot !== undefined ? { habitSnapshot } : {}),
    savedAt:
      typeof raw.savedAt === "number" && Number.isFinite(raw.savedAt) && raw.savedAt >= 0
        ? raw.savedAt
        : 0,
    ...style,
    ...(photoLayout ? { photoLayout } : {}),
    ...(vaultRevision !== null ? { vaultRevision } : {}),
  };
}

function withoutDraftVaultRevision(data: JournalDraftData): JournalDraftData {
  const { vaultRevision: _vaultRevision, ...plaintext } = data;
  return plaintext;
}

function getJournalDraftWriterLease(value: unknown): JournalDraftWriterLease | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<JournalDraftWriterLease>;
  if (typeof candidate.writerId !== "string" || candidate.writerId.length === 0) return null;
  if (typeof candidate.heartbeatAt !== "number" || !Number.isFinite(candidate.heartbeatAt)) {
    return null;
  }
  return { writerId: candidate.writerId, heartbeatAt: candidate.heartbeatAt };
}

export class JournalDraftInUseError extends Error {
  readonly code = "JOURNAL_DRAFT_IN_USE";

  constructor(readonly draftKey: string) {
    super("This diary draft is open in another window");
    this.name = "JournalDraftInUseError";
  }
}

export async function acquireJournalDraftWriter(
  key: string,
  writerId: string,
  now = Date.now(),
): Promise<void> {
  await runWithJournalSecurityWriteLock(async () => {
    const leaseKey = SK.journalDraftLease(key);
    const current = getJournalDraftWriterLease((await settingsRepo.get(leaseKey))?.value);
    const isAnotherLiveWriter =
      current &&
      current.writerId !== writerId &&
      now - current.heartbeatAt <= JOURNAL_DRAFT_WRITER_LEASE_TTL_MS;
    if (isAnotherLiveWriter) throw new JournalDraftInUseError(key);
    await settingsRepo.put({ key: leaseKey, value: { writerId, heartbeatAt: now } });
  });
}

export async function touchJournalDraftWriter(
  key: string,
  writerId: string,
  now = Date.now(),
): Promise<boolean> {
  return runWithJournalSecurityWriteLock(async () => {
    const leaseKey = SK.journalDraftLease(key);
    const current = getJournalDraftWriterLease((await settingsRepo.get(leaseKey))?.value);
    if (!current || current.writerId !== writerId) return false;
    await settingsRepo.put({ key: leaseKey, value: { writerId, heartbeatAt: now } });
    return true;
  });
}

export async function releaseJournalDraftWriter(
  key: string,
  writerId: string,
): Promise<void> {
  await runWithJournalSecurityWriteLock(async () => {
    const leaseKey = SK.journalDraftLease(key);
    const current = getJournalDraftWriterLease((await settingsRepo.get(leaseKey))?.value);
    if (current?.writerId === writerId) await settingsRepo.delete(leaseKey);
  });
}

export function getJournalDraftKey(entryId: string | null): string {
  return SK.journalDraft(entryId || "new");
}

async function syncDraftDelete(key: string, expectedOwnerUserId: string | null): Promise<void> {
  if (!expectedOwnerUserId) return;
  try {
    await deleteSettingFromCloud(key, expectedOwnerUserId);
  } catch (error) {
    logger.warn("[Journal]", "Draft cloud delete failed:", error);
  }
}

async function protectDraftForStorage(
  data: JournalDraftData,
  vaultKey: string | null,
  vaultRevision?: number,
): Promise<JournalDraftData> {
  if (!vaultKey) return withoutDraftVaultRevision(data);
  const revision = requireSafeJournalVaultRevision(
    vaultRevision ?? getJournalContentVaultRevision(),
    "draft",
  );
  if (data.content && isEncryptedJournalContent(data.content)) {
    await decryptJournalContentIfNeeded(data.content, vaultKey);
  }

  return {
    ...data,
    content:
      data.content && !isEncryptedJournalContent(data.content)
        ? await encryptJournalContent(data.content, vaultKey)
        : data.content,
    vaultRevision: revision,
  };
}

export function getDraftDataFromSetting(record: {
  key: string;
  value: unknown;
}): JournalDraftData | null {
  if (!record.key.startsWith(JOURNAL_DRAFT_KEY_PREFIX)) return null;
  return normalizeJournalDraftData(record.value);
}

export async function encryptJournalDraftSettingForStorage(
  record: { key: string; value: unknown },
  vaultKey: string,
  vaultRevision: number,
): Promise<{ key: string; value: JournalDraftData } | null> {
  const data = getDraftDataFromSetting(record);
  if (!data) return null;
  return {
    key: record.key,
    value: await protectDraftForStorage(data, vaultKey, vaultRevision),
  };
}

export async function decryptJournalDraftSettingForStorage(
  record: { key: string; value: unknown },
  vaultKey: string
): Promise<{ key: string; value: JournalDraftData } | null> {
  const data = getDraftDataFromSetting(record);
  if (!data) return null;
  return {
    key: record.key,
    value: withoutDraftVaultRevision({
      ...data,
      content:
        data.content && isEncryptedJournalContent(data.content)
          ? await decryptJournalContentIfNeeded(data.content, vaultKey)
          : data.content,
    }),
  };
}

async function transformJournalDrafts(
  vaultKey: string,
  shouldTransform: (content: string) => boolean,
  transform: (content: string, vaultKey: string) => Promise<string>,
  vaultRevision?: number,
): Promise<number> {
  const records = await settingsRepo.toArray();
  const drafts = records.flatMap((record) => {
    const data = getDraftDataFromSetting(record);
    return data && shouldTransform(data.content) ? [{ record, data }] : [];
  });
  if (drafts.length === 0) return 0;

  const updates = await Promise.all(
    drafts.map(async ({ record, data }) => {
      const transformed = {
        ...data,
        content: await transform(data.content, vaultKey),
      };
      return {
        key: record.key,
        value:
          vaultRevision === undefined
            ? withoutDraftVaultRevision(transformed)
            : { ...transformed, vaultRevision },
      };
    })
  );
  await settingsRepo.bulkPut(updates);
  return updates.length;
}

export async function hasEncryptedJournalDrafts(): Promise<boolean> {
  const records = await settingsRepo.toArray();
  return records.some((record) => {
    const data = getDraftDataFromSetting(record);
    return Boolean(data?.content && isEncryptedJournalContent(data.content));
  });
}

export async function decryptEncryptedJournalDrafts(vaultKey: string): Promise<number> {
  return transformJournalDrafts(
    vaultKey,
    (content) => Boolean(content) && isEncryptedJournalContent(content),
    decryptJournalContentIfNeeded,
    undefined,
  );
}

export async function encryptPlaintextJournalDrafts(vaultKey: string): Promise<number> {
  return transformJournalDrafts(
    vaultKey,
    (content) => Boolean(content) && !isEncryptedJournalContent(content),
    encryptJournalContent,
    requireSafeJournalVaultRevision(getJournalContentVaultRevision(), "draft"),
  );
}

async function revealDraftFromStorage(data: JournalDraftData): Promise<JournalDraftData | null> {
  if (!data.content || !isEncryptedJournalContent(data.content)) return data;

  const vaultKey = getJournalContentVaultKey();
  if (!vaultKey) {
    logger.warn("[Journal] Protected draft is locked until the diary is unlocked");
    return null;
  }

  return {
    ...data,
    content: await decryptJournalContentIfNeeded(data.content, vaultKey),
  };
}

export async function saveJournalDraft(
  key: string,
  data: JournalDraftData,
  writerId?: string,
): Promise<void> {
  try {
    await runWithJournalSecurityWriteLock(async () => {
      const vaultKey = await getJournalVaultKeyForWrite();
      const protectedDraft = await protectDraftForStorage(data, vaultKey);
      if (!writerId) {
        await settingsRepo.put({ key, value: protectedDraft });
        return;
      }

      const leaseKey = SK.journalDraftLease(key);
      const current = getJournalDraftWriterLease((await settingsRepo.get(leaseKey))?.value);
      if (!current || current.writerId !== writerId) throw new JournalDraftInUseError(key);
      await settingsRepo.bulkPut([
        { key, value: protectedDraft },
        { key: leaseKey, value: { writerId, heartbeatAt: Date.now() } },
      ]);
    });
  } catch (error) {
    // Unsaved diary drafts can contain private text; keep failures local-only
    // instead of exposing raw draft HTML through localStorage or cloud sync.
    logger.warn("[Journal]", "Draft IndexedDB save failed:", error);
    throw error;
  }
}

async function loadLegacyJournalDraft(key: string): Promise<JournalDraftData | null> {
  const raw = storageGetRaw(key);
  if (!raw) return null;
  const data = normalizeJournalDraftData(safeJsonParse<unknown>(raw, null));
  if (!data) {
    storageRemove(key);
    return null;
  }
  let protectedDraft: JournalDraftData;
  try {
    protectedDraft = await runWithJournalSecurityWriteLock(async () => {
      const vaultKey = await getJournalVaultKeyForWrite();
      const nextDraft = await protectDraftForStorage(data, vaultKey);
      await settingsRepo.put({ key, value: nextDraft });
      return nextDraft;
    });
  } catch (error) {
    // Preserve the legacy record for a later unlocked migration. Returning its
    // plaintext here would bypass active persistent protection.
    logger.warn("[Journal]", "Legacy draft migration blocked:", error);
    return null;
  }

  storageRemove(key);
  try {
    return await revealDraftFromStorage(protectedDraft);
  } catch (error) {
    logger.warn("[Journal]", "Migrated draft could not be revealed:", error);
    return null;
  }
}

export async function loadJournalDraft(key: string): Promise<JournalDraftData | null> {
  let indexedDbReadError: unknown = null;
  try {
    const record = await settingsRepo.get(key);
    if (record?.value) {
      const data = getDraftDataFromSetting(record);
      if (!data) {
        logger.warn("[Journal] Draft record could not be recovered safely");
        return null;
      }
      return revealDraftFromStorage(data);
    }
  } catch (error) {
    logger.warn("[Journal]", "Draft IndexedDB load failed:", error);
    indexedDbReadError = error;
  }

  const legacyDraft = await loadLegacyJournalDraft(key);
  if (legacyDraft) return legacyDraft;
  if (indexedDbReadError) {
    if (indexedDbReadError instanceof Error) throw indexedDbReadError;
    const normalizedError = new Error(
      indexedDbReadError instanceof DOMException
        ? indexedDbReadError.message
        : "Diary draft storage could not be read",
    );
    Object.defineProperty(normalizedError, "cause", {
      configurable: true,
      value: indexedDbReadError,
    });
    if (indexedDbReadError instanceof DOMException) {
      normalizedError.name = indexedDbReadError.name;
    }
    throw normalizedError;
  }
  return null;
}

export async function clearJournalDraft(key: string): Promise<void> {
  const expectedOwnerUserId = await getCurrentSessionUserId();
  await runWithJournalSecurityWriteLock(async () => {
    await settingsRepo.delete(key);
    storageRemove(key);
    await syncDraftDelete(key, expectedOwnerUserId);
  });
}
