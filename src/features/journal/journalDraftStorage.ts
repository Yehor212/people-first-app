import { logger } from "@/lib/logger";
import { safeJsonParse, storageGetRaw, storageRemove } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { settingsRepo } from "@/storage/db";
import { deleteSettingFromCloud } from "@/storage/realtimeSync";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import type { MoodType } from "@/types";
import { getJournalContentVaultKey } from "./journalContentSession";
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
  photoLayout?: Record<string, { x: number; y: number; width: number }>;
}

const JOURNAL_DRAFT_TTL_MS = 7 * 86400000;
const JOURNAL_DRAFT_KEY_PREFIX = SK.journalDraft("");

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

function isExpiredDraft(data: JournalDraftData): boolean {
  return Date.now() - data.savedAt > JOURNAL_DRAFT_TTL_MS;
}

async function protectDraftForStorage(
  data: JournalDraftData,
  vaultKey: string | null
): Promise<JournalDraftData> {
  if (!vaultKey || !data.content || isEncryptedJournalContent(data.content)) return data;

  return {
    ...data,
    content: await encryptJournalContent(data.content, vaultKey),
  };
}

export function getDraftDataFromSetting(record: {
  key: string;
  value: unknown;
}): JournalDraftData | null {
  if (!record.key.startsWith(JOURNAL_DRAFT_KEY_PREFIX)) return null;
  if (!record.value || typeof record.value !== "object") return null;
  const candidate = record.value as Partial<JournalDraftData>;
  return typeof candidate.content === "string" ? (record.value as JournalDraftData) : null;
}

export async function encryptJournalDraftSettingForStorage(
  record: { key: string; value: unknown },
  vaultKey: string
): Promise<{ key: string; value: JournalDraftData } | null> {
  const data = getDraftDataFromSetting(record);
  if (!data) return null;
  return {
    key: record.key,
    value: await protectDraftForStorage(data, vaultKey),
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
    value: {
      ...data,
      content:
        data.content && isEncryptedJournalContent(data.content)
          ? await decryptJournalContentIfNeeded(data.content, vaultKey)
          : data.content,
    },
  };
}

async function transformJournalDrafts(
  vaultKey: string,
  shouldTransform: (content: string) => boolean,
  transform: (content: string, vaultKey: string) => Promise<string>
): Promise<number> {
  const records = await settingsRepo.toArray();
  const drafts = records.flatMap((record) => {
    const data = getDraftDataFromSetting(record);
    return data && shouldTransform(data.content) ? [{ record, data }] : [];
  });
  if (drafts.length === 0) return 0;

  const updates = await Promise.all(
    drafts.map(async ({ record, data }) => ({
      key: record.key,
      value: {
        ...data,
        content: await transform(data.content, vaultKey),
      },
    }))
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
    decryptJournalContentIfNeeded
  );
}

export async function encryptPlaintextJournalDrafts(vaultKey: string): Promise<number> {
  return transformJournalDrafts(
    vaultKey,
    (content) => Boolean(content) && !isEncryptedJournalContent(content),
    encryptJournalContent
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

export async function saveJournalDraft(key: string, data: JournalDraftData): Promise<void> {
  try {
    await runWithJournalSecurityWriteLock(async () => {
      const vaultKey = await getJournalVaultKeyForWrite();
      await settingsRepo.put({ key, value: await protectDraftForStorage(data, vaultKey) });
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
  const data = safeJsonParse<JournalDraftData | null>(raw, null);
  if (!data) {
    storageRemove(key);
    return null;
  }
  if (isExpiredDraft(data)) {
    await clearJournalDraft(key);
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
  try {
    const record = await settingsRepo.get(key);
    if (record?.value) {
      const data = record.value as JournalDraftData;
      if (isExpiredDraft(data)) {
        await clearJournalDraft(key);
        return null;
      }
      return revealDraftFromStorage(data);
    }
  } catch (error) {
    logger.warn("[Journal]", "Draft IndexedDB load failed:", error);
  }
  return loadLegacyJournalDraft(key);
}

export async function clearJournalDraft(key: string): Promise<void> {
  const expectedOwnerUserId = await getCurrentSessionUserId();
  await runWithJournalSecurityWriteLock(async () => {
    try {
      await settingsRepo.delete(key);
    } catch {
      logger.warn("[Journal]", "Draft IndexedDB clear failed:", key);
    }
    storageRemove(key);
    await syncDraftDelete(key, expectedOwnerUserId);
  });
}
