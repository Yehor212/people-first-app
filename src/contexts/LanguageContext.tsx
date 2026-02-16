import { createContext, useContext, ReactNode, useEffect, useRef, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Language, Translations, translations } from '@/i18n/translations';
import { SK } from '@/lib/storageKeys';
import { storageGetRaw } from '@/lib/safeJson';

// Extend Navigator for IE compatibility (userLanguage property)
declare global {
  interface Navigator {
    userLanguage?: string;
  }
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const SUPPORTED_LANGUAGES: Language[] = ['en', 'uk', 'es', 'de', 'fr', 'ja', 'ar', 'he'];

// RTL languages
const RTL_LANGUAGES: Language[] = ['ar', 'he'];

function detectBrowserLanguage(): Language {
  try {
    // Get browser language
    const browserLang = navigator.language || navigator.userLanguage;

    // Guard against null/undefined browserLang
    if (!browserLang || typeof browserLang !== 'string') {
      return 'en';
    }

    // Extract language code (e.g., "en-US" -> "en")
    const langCode = browserLang.split('-')[0]?.toLowerCase() || 'en';

    // Check if it's in our supported languages
    if (SUPPORTED_LANGUAGES.includes(langCode as Language)) {
      return langCode as Language;
    }

    // Fallback to English
    return 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const detectedLang = detectBrowserLanguage();
  const [language, setLanguageRaw] = useLocalStorage<Language>('zenflow-language', detectedLang);

  // Guard: if stored language was removed (e.g. 'ru' after v1.7.0), fall back to English
  const validLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';

  // Wrap setLanguage to also persist the validated value if it was corrected
  const setLanguage = useMemo(() => (lang: Language) => {
    setLanguageRaw(lang);
  }, [setLanguageRaw]);

  // Ref to ensure auto-detection only runs once
  const hasAutoDetectedRef = useRef(false);

  // If stored language is unsupported, overwrite it immediately
  useEffect(() => {
    if (language !== validLanguage) {
      setLanguageRaw(validLanguage);
    }
  }, [language, validLanguage, setLanguageRaw]);

  // Check if current language is RTL
  const isRTL = RTL_LANGUAGES.includes(validLanguage);

  // Apply RTL direction to document
  useEffect(() => {
    const dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', validLanguage);
  }, [validLanguage, isRTL]);

  // Auto-detect language on first load
  useEffect(() => {
    // Only run once
    if (hasAutoDetectedRef.current) return;
    hasAutoDetectedRef.current = true;

    const hasSelectedLanguage = storageGetRaw(SK.LANGUAGE_SELECTED);
    if (!hasSelectedLanguage) {
      // User hasn't manually selected a language yet, use detected language
      const detected = detectBrowserLanguage();
      if (detected !== validLanguage) {
        setLanguageRaw(detected);
      }
    }
  }, [validLanguage, setLanguageRaw]);

  const t = translations[validLanguage];

  // Memoize provider value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    language: validLanguage,
    setLanguage,
    t,
    isRTL,
  }), [validLanguage, setLanguage, t, isRTL]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
