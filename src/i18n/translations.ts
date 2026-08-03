// Backward-compatible re-export — prefer importing from '@/i18n' directly
export {
  applyDocumentLanguage,
  getTranslations,
  isRtlLanguage,
  languageFlags,
  languageNames,
  loadLanguage,
  normalizeLanguage,
  resolveInitialLanguage,
  supportedLanguages,
  translations,
} from "./index";
export type { Language, Translations } from "./types";
