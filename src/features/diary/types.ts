/** Diary feature types & constants */

// ── Theme ──

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
  dark:   { '--diary-bg': '#1A1A2E', '--diary-text': '#E8E8E8', '--diary-accent': '#7B68EE', '--diary-muted': '#888888', '--diary-border': 'rgba(255,255,255,0.08)' },
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

// ── Widgets ──

export type WidgetType = 'burn' | 'breathing';

export type WidgetState =
  | { type: 'burn'; text: string; burned: boolean }
  | { type: 'breathing'; pattern: string; completedAt?: number };

// ── Entry ──

export interface DiaryEntry {
  id: string;
  date: string;                                // "YYYY-MM-DD"
  htmlContent: string;                         // Sanitized HTML (widgets are inert placeholders)
  plainText: string;                           // Stripped text for search/preview
  theme: DiaryThemeName;
  font: DiaryFontName;
  widgetStates: Record<string, WidgetState>;   // Widget ID → structured state sidecar
  imageIds: string[];
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

// ── Constants ──

export const MAX_DIARY_IMAGES = 5;
export const MAX_DIARY_WIDGETS = 10;
export const DIARY_THEME_NAMES: DiaryThemeName[] = ['light', 'dark', 'sepia', 'forest', 'ocean', 'sunset'];
export const DIARY_FONT_NAMES: DiaryFontName[] = ['caveat', 'cormorant', 'outfit'];
