import type { MoodType } from '@/types';

/** A single journal/diary entry */
export interface JournalEntry {
  id: string;
  date: string;           // "YYYY-MM-DD"
  title: string;
  content: string;
  stickers: string[];     // emoji array, max 5
  photoIds: string[];     // JournalPhoto.id refs, max 5
  mood?: MoodType;
  tags: string[];
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

export const MAX_PHOTOS_PER_ENTRY = 5;
export const MAX_STICKERS_PER_ENTRY = 5;
export const JOURNAL_PASSWORD_KEY = 'journal_password';
