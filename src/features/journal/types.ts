import type { MoodType } from '@/types';

// ── Diary Theme / Font ──

export type DiaryThemeName = 'light' | 'dark' | 'sepia' | 'forest' | 'ocean' | 'sunset';
export type DiaryFontName = 'caveat' | 'cormorant' | 'outfit';

export interface DiaryThemeConfig {
  '--diary-bg': string;
  '--diary-text': string;
  '--diary-accent': string;
  '--diary-muted': string;
  '--diary-border': string;
}

export const DIARY_THEMES: Record<DiaryThemeName, DiaryThemeConfig> = {
  light:  { '--diary-bg': '#FFFEF5', '--diary-text': '#2D2D2D', '--diary-accent': '#4A7C59', '--diary-muted': '#999999', '--diary-border': 'rgba(0,0,0,0.08)' },
  dark:   { '--diary-bg': '#020611', '--diary-text': '#f1f5f9', '--diary-accent': '#2dd4bf', '--diary-muted': '#94a3b8', '--diary-border': 'rgba(255,255,255,0.06)' },
  sepia:  { '--diary-bg': '#F4ECD8', '--diary-text': '#5B4636', '--diary-accent': '#8B6914', '--diary-muted': '#9E8B6E', '--diary-border': 'rgba(91,70,54,0.12)' },
  forest: { '--diary-bg': '#1B2D1B', '--diary-text': '#D4E7D4', '--diary-accent': '#6EBF8B', '--diary-muted': '#7A9E7A', '--diary-border': 'rgba(212,231,212,0.08)' },
  ocean:  { '--diary-bg': '#0F1B2D', '--diary-text': '#B8D4E3', '--diary-accent': '#4AA3DF', '--diary-muted': '#6B8FA3', '--diary-border': 'rgba(184,212,227,0.08)' },
  sunset: { '--diary-bg': '#2D1B1B', '--diary-text': '#F4D6C8', '--diary-accent': '#E8834A', '--diary-muted': '#B48D7A', '--diary-border': 'rgba(244,214,200,0.08)' },
};

export const DIARY_FONTS: Record<DiaryFontName, { family: string; url: string }> = {
  caveat:    { family: "'Caveat', cursive",              url: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap' },
  cormorant: { family: "'Cormorant Garamond', serif",    url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap' },
  outfit:    { family: "'Outfit', sans-serif",           url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap' },
};

export const DIARY_THEME_NAMES: DiaryThemeName[] = ['light', 'dark', 'sepia', 'forest', 'ocean', 'sunset'];
export const DIARY_FONT_NAMES: DiaryFontName[] = ['caveat', 'cormorant', 'outfit'];

// ── Background Intensity (canvas ambient engine) ──

export type BackgroundIntensity = 'full' | 'dim' | 'off';

// ── Particle Speed (canvas ambient engine) ──

export type ParticleSpeed = 'off' | 'slow' | 'drift';

// ── Paper Color (editor sheet background) ──

export type PaperColor = 'white' | 'dark' | 'milky';

export const PAPER_COLORS: Record<PaperColor, { bg: string; text: string; muted: string; border: string; label: string }> = {
  white: { bg: '#FFFFFF', text: '#1a1a2e', muted: '#6b7280', border: 'rgba(0,0,0,0.08)', label: 'White' },
  dark:  { bg: '#0D0D14', text: '#e2e8f0', muted: '#94a3b8', border: 'rgba(255,255,255,0.06)', label: 'Dark' },
  milky: { bg: '#FFFEF5', text: '#2D2D2D', muted: '#999999', border: 'rgba(0,0,0,0.06)', label: 'Paper' },
};

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
  theme?: DiaryThemeName;  // diary theme (optional, undefined = app default)
  font?: DiaryFontName;    // diary font (optional, undefined = app default)
  inkColor?: string;       // text color hex (optional, undefined = theme default)
  paperTexture?: 'clean' | 'dots'; // paper texture (optional, undefined = clean)
  paperColor?: PaperColor;   // editor sheet color (optional, undefined = dark)
  bgIntensity?: BackgroundIntensity; // canvas background (optional, undefined = full)
  particleSpeed?: ParticleSpeed; // particle movement speed (optional, undefined = slow)
  fontSize?: 'small' | 'medium' | 'large'; // editor font size preference
  photoLayout?: Record<string, { x: number; y: number; width: number }>; // free-form photo positions
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
  storagePath?: string;   // Supabase Storage path (e.g. "{userId}/{photoId}.jpg")
  storageUrl?: string;    // Signed URL for CDN access
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
  storagePath?: string;   // Supabase Storage path
  storageUrl?: string;    // Signed URL for access
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

/** Count words in HTML content (strips tags first). */
export function countWordsHtml(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  return countWords(text);
}

export const FONT_SIZES = { small: 15, medium: 18, large: 22 } as const;
export type FontSizeName = keyof typeof FONT_SIZES;
