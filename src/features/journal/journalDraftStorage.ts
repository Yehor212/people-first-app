import { logger } from "@/lib/logger";
import { safeJsonParse, storageGetRaw, storageRemove } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { settingsRepo } from "@/storage/db";
import { deleteSettingFromCloud } from "@/storage/realtimeSync";
import type { MoodType } from "@/types";
import { getJournalContentVaultKey } from "./journalContentSession";
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

export function getJournalDraftKey(entryId: string | null): string {
  return SK.journalDraft(entryId || "new");
}

async function syncDraftDelete(key: string): Promise<void> {
  try {
    await deleteSettingFromCloud(key);
  } catch (error) {
    logger.warn("[Journal]", "Draft cloud delete failed:", error);
  }
}

function isExpiredDraft(data: JournalDraftData): boolean {
  return Date.now() - data.savedAt > JOURNAL_DRAFT_TTL_MS;
}

async function protectDraftForStorage(data: JournalDraftData): Promise<JournalDraftData> {
  const vaultKey = getJournalContentVaultKey();
  if (!vaultKey || !data.content || isEncryptedJournalContent(data.content)) return data;

  return {
    ...data,
    content: await encryptJournalContent(data.content, vaultKey),
  };
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
    await settingsRepo.put({ key, value: await protectDraftForStorage(data) });
  } catch (error) {
    // Unsaved diary drafts can contain private text; keep failures local-only
    // instead of exposing raw draft HTML through localStorage or cloud sync.
    logger.warn("[Journal]", "Draft IndexedDB save failed:", error);
    throw error;
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

    const raw = storageGetRaw(key);
    if (raw) {
      const data = safeJsonParse<JournalDraftData | null>(raw, null);
      if (!data) {
        storageRemove(key);
        return null;
      }
      if (isExpiredDraft(data)) {
        storageRemove(key);
        await syncDraftDelete(key);
        return null;
      }
      await settingsRepo.put({ key, value: await protectDraftForStorage(data) });
      storageRemove(key);
      return revealDraftFromStorage(data);
    }
    return null;
  } catch {
    try {
      const raw = storageGetRaw(key);
      if (!raw) return null;
      const data = safeJsonParse<JournalDraftData | null>(raw, null);
      if (!data) return null;
      if (isExpiredDraft(data)) {
        storageRemove(key);
        await syncDraftDelete(key);
        return null;
      }
      return revealDraftFromStorage(data);
    } catch {
      return null;
    }
  }
}

export async function clearJournalDraft(key: string): Promise<void> {
  try {
    await settingsRepo.delete(key);
  } catch {
    logger.warn("[Journal]", "Draft IndexedDB clear failed:", key);
  }
  storageRemove(key);
  await syncDraftDelete(key);
}
