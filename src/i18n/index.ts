import type { Language, Translations } from "./types";
import { en } from "./languages/en";
import { resolveTranslationPayload } from "./localeAssetRuntime";

export type { Language, Translations };

export const supportedLanguages: readonly Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const rtlLanguages = new Set<Language>(["ar", "he"]);

export function normalizeLanguage(value: unknown): Language {
  if (typeof value !== "string") return "en";
  const language = value.split("-")[0]?.toLowerCase() as Language;
  return supportedLanguages.includes(language) ? language : "en";
}

export function isRtlLanguage(language: Language): boolean {
  return rtlLanguages.has(language);
}

export function resolveInitialLanguage(
  storedLanguage: unknown,
  browserLanguage: unknown,
  hasSelectedLanguage: unknown,
): Language {
  return hasSelectedLanguage === true
    ? normalizeLanguage(storedLanguage)
    : normalizeLanguage(browserLanguage);
}

export function applyDocumentLanguage(language: Language): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.documentElement.dir = isRtlLanguage(language) ? "rtl" : "ltr";
}

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

/** Load and cache a language. Fail explicitly so callers cannot pair the target locale with English text. */
export async function loadLanguage(code: Language): Promise<Translations> {
  if (translations[code]) return translations[code];
  const loader = languageLoaders[code];
  if (!loader) throw new Error(`Unsupported language: ${code}`);
  const module = await loader();
  const loaded = await resolveTranslationPayload(
    module[code] || Object.values(module)[0],
    en,
    code,
  );
  translations[code] = loaded;
  return loaded;
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
