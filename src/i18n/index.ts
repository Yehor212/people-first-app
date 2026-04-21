import type { Language, Translations } from "./types";
import { en } from "./languages/en";

export type { Language, Translations };

// Mutable cache — starts with English (always available), populated on demand
export const translations: Record<string, Translations> = { en };

// Dynamic loaders for code-split per-language chunks
const languageLoaders: Record<string, () => Promise<Record<string, Translations>>> = {
  uk: () => import("./languages/uk"),
  es: () => import("./languages/es"),
  de: () => import("./languages/de"),
  fr: () => import("./languages/fr"),
  ja: () => import("./languages/ja"),
  ar: () => import("./languages/ar"),
  he: () => import("./languages/he"),
};

/** Load a language dynamically and cache it. Returns English as fallback. */
export async function loadLanguage(code: Language): Promise<Translations> {
  if (translations[code]) return translations[code];
  const loader = languageLoaders[code];
  if (!loader) return en;
  try {
    const module = await loader();
    const loaded = module[code] || Object.values(module)[0];
    translations[code] = loaded;
    return loaded;
  } catch {
    return en;
  }
}

/** Synchronous access — returns cached translation or English fallback. */
export function getTranslations(code: Language): Translations {
  return translations[code] || en;
}

export const languageNames: Record<Language, string> = {
  en: "English",
  uk: "Українська",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  ja: "日本語",
  ar: "العربية",
  he: "עברית",
};

export const languageFlags: Record<Language, string> = {
  en: "🇬🇧",
  uk: "🇺🇦",
  es: "🇪🇸",
  de: "🇩🇪",
  fr: "🇫🇷",
  ja: "🇯🇵",
  ar: "🇸🇦",
  he: "🇮🇱",
};
