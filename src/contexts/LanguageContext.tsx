import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Language, Translations, translations } from '@/i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const SUPPORTED_LANGUAGES: Language[] = ['en', 'ru', 'uk', 'es', 'de', 'fr'];

function detectBrowserLanguage(): Language {
  try {
    // Get browser language
    const browserLang = navigator.language || (navigator as any).userLanguage;

    // Extract language code (e.g., "en-US" -> "en")
    const langCode = browserLang.split('-')[0].toLowerCase();

    // Check if it's in our supported languages
    if (SUPPORTED_LANGUAGES.includes(langCode as Language)) {
      return langCode as Language;
    }

    // Fallback to English
    return 'en';
  } catch (e) {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const detectedLang = detectBrowserLanguage();
  const [language, setLanguage] = useLocalStorage<Language>('zenflow-language', detectedLang);

  // Auto-detect language on first load
  useEffect(() => {
    const hasSelectedLanguage = localStorage.getItem('zenflow-language-selected');
    if (!hasSelectedLanguage) {
      // User hasn't manually selected a language yet, use detected language
      const detected = detectBrowserLanguage();
      if (detected !== language) {
        setLanguage(detected);
      }
    }
  }, []);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
