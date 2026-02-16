import type { Language, Translations } from './types';
import { en } from './languages/en';
import { uk } from './languages/uk';
import { es } from './languages/es';
import { de } from './languages/de';
import { fr } from './languages/fr';
import { ja } from './languages/ja';
import { ar } from './languages/ar';
import { he } from './languages/he';

export type { Language, Translations };

export const translations: Record<Language, Translations> = {
  en, uk, es, de, fr, ja, ar, he,
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  uk: 'Українська',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  ja: '日本語',
  ar: 'العربية',
  he: 'עברית',
};

export const languageFlags: Record<Language, string> = {
  en: '🇬🇧',
  uk: '🇺🇦',
  es: '🇪🇸',
  de: '🇩🇪',
  fr: '🇫🇷',
  ja: '🇯🇵',
  ar: '🇸🇦',
  he: '🇮🇱',
};
