import type { MoodType } from '@/types';

/** A single journal/diary entry */
export interface JournalEntry {
  id: string;
  date: string;           // "YYYY-MM-DD"
  title: string;
  content: string;
  stickers: string[];     // emoji array, max 5
  photoIds: string[];     // JournalPhoto.id refs, max 5
  audioIds?: string[];    // JournalAudio.id refs, max 3
  mood?: MoodType;
  tags: string[];
  templateId?: string;    // template used to create entry
  habitSnapshot?: { habitId: string; habitName: string; habitIcon: string; completed: boolean }[];
  createdAt: number;
  updatedAt: number;
}

/** Compressed photo attached to a journal entry */
export interface JournalPhoto {
  id: string;
  entryId: string;
  data: string;           // base64 JPEG (~100-200KB)
  thumbnail: string;      // base64 thumbnail (~5-10KB)
  width: number;
  height: number;
  createdAt: number;
}

/** PBKDF2-hashed password stored in settings table */
export interface JournalPassword {
  hash: string;           // base64 derived key
  salt: string;           // base64 random salt
  iterations: number;     // 100_000
  createdAt: number;
}

/** Audio recording attached to a journal entry */
export interface JournalAudio {
  id: string;
  entryId: string;
  data: string;           // base64 audio (webm/mp4, ~64kbps)
  duration: number;       // seconds
  mimeType: string;       // 'audio/webm' or 'audio/mp4'
  createdAt: number;
}

export const MAX_PHOTOS_PER_ENTRY = 5;
export const MAX_STICKERS_PER_ENTRY = 5;
export const MAX_AUDIO_PER_ENTRY = 3;
export const MAX_AUDIO_DURATION_SEC = 300; // 5 minutes
export const JOURNAL_PASSWORD_KEY = 'journal_password';

/** Count words in text. Handles empty/whitespace strings. */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
