import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  applyDocumentLanguage,
  isRtlLanguage,
  loadLanguage,
  normalizeLanguage,
  translations,
  type Language,
  type Translations,
} from "@/i18n/translations";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { updateNativePushPresentation } from "@/lib/nativePushRealm";
import { syncNativeLocale } from "@/lib/nativeLocale";
import {
  safeLocalStorageSet,
  safeLocalStorageGet,
  storageReadRaw,
  storageRemove,
  storageSetRaw,
} from "@/lib/safeJson";

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
  pendingLanguage: Language | null;
  languageLoadError: Language | null;
  languageSaveError: Language | null;
  languagePushPresentationError: Language | null;
  retryLanguage: () => void;
  retryLanguagePushPresentation: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectBrowserLanguage(): Language {
  try {
    const browserLang = navigator.language || navigator.userLanguage;
    return normalizeLanguage(browserLang);
  } catch {
    return "en";
  }
}

function persistLanguageSelection(language: Language): boolean {
  const previousSelection = storageReadRaw(SK.LANGUAGE_SELECTED);
  if (!previousSelection.ok) return false;

  if (!storageSetRaw(SK.LANGUAGE_SELECTED, "true")) return false;
  if (safeLocalStorageSet(SK.LANGUAGE, language)) return true;

  const restored = previousSelection.value === null
    ? storageRemove(SK.LANGUAGE_SELECTED)
    : storageSetRaw(SK.LANGUAGE_SELECTED, previousSelection.value);
  if (!restored) {
    logger.error("[Language] Failed to restore the previous selection marker");
  }
  return false;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const detectedLang = detectBrowserLanguage();
  const [storedLanguage, setStoredLanguage] = useLocalStorage<Language>("zenflow-language", detectedLang);
  const hasSelectedLanguage = safeLocalStorageGet<boolean>(SK.LANGUAGE_SELECTED, false) === true;
  const initialTargetRef = useRef<Language>(
    hasSelectedLanguage ? normalizeLanguage(storedLanguage) : detectedLang,
  );
  const initialTarget = initialTargetRef.current;
  const initialTranslations = translations[initialTarget];
  const initialNeedsLoadRef = useRef(!initialTranslations);
  const [active, setActive] = useState<{ language: Language; t: Translations }>(() => ({
    language: initialTranslations ? initialTarget : "en",
    t: initialTranslations || translations.en,
  }));
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(
    initialTranslations ? null : initialTarget,
  );
  const [languageLoadError, setLanguageLoadError] = useState<Language | null>(null);
  const [languageSaveError, setLanguageSaveError] = useState<Language | null>(null);
  const [languagePushPresentationError, setLanguagePushPresentationError] =
    useState<Language | null>(null);
  const requestSequenceRef = useRef(0);
  const pushPresentationSequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const failedRequestRef = useRef<{
    language: Language;
    persistSelection: boolean;
  } | null>(null);

  const requestLanguage = useCallback(async (
    requestedLanguage: Language,
    persistSelection = true,
  ) => {
    const language = normalizeLanguage(requestedLanguage);
    const requestSequence = ++requestSequenceRef.current;
    failedRequestRef.current = null;
    setLanguageLoadError(null);
    setLanguageSaveError(null);

    const cached = translations[language];
    if (cached) {
      if (persistSelection && !persistLanguageSelection(language)) {
        logger.warn("[Language] Selection could not be saved", { language });
        failedRequestRef.current = { language, persistSelection };
        applyDocumentLanguage(language);
        setActive({ language, t: cached });
        setPendingLanguage(null);
        setLanguageSaveError(language);
        return;
      }
      applyDocumentLanguage(language);
      setActive({ language, t: cached });
      setPendingLanguage(null);
      setStoredLanguage(language);
      return;
    }

    setPendingLanguage(language);
    try {
      const loaded = await loadLanguage(language);
      if (!mountedRef.current || requestSequence !== requestSequenceRef.current) return;
      if (persistSelection && !persistLanguageSelection(language)) {
        logger.warn("[Language] Selection could not be saved", { language });
        failedRequestRef.current = { language, persistSelection };
        applyDocumentLanguage(language);
        setActive({ language, t: loaded });
        setPendingLanguage(null);
        setLanguageSaveError(language);
        return;
      }
      applyDocumentLanguage(language);
      setActive({ language, t: loaded });
      setPendingLanguage(null);
      setStoredLanguage(language);
    } catch (error) {
      logger.warn("[Language] Dictionary load failed", { language, error });
      if (!mountedRef.current || requestSequence !== requestSequenceRef.current) return;
      failedRequestRef.current = { language, persistSelection };
      setPendingLanguage(null);
      setLanguageLoadError(language);
    }
  }, [setStoredLanguage]);

  useEffect(() => {
    if (storedLanguage !== normalizeLanguage(storedLanguage)) {
      setStoredLanguage("en");
    }
  }, [setStoredLanguage, storedLanguage]);

  useEffect(() => {
    if (initialNeedsLoadRef.current) void requestLanguage(initialTarget, false);
  }, [initialTarget, requestLanguage]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    applyDocumentLanguage(active.language);
  }, [active.language]);

  const refreshNativePushPresentation = useCallback(async (language: Language) => {
    const requestSequence = ++pushPresentationSequenceRef.current;
    setLanguagePushPresentationError(null);
    try {
      await updateNativePushPresentation({ language });
    } catch (error) {
      logger.warn("[Language] Native push presentation update failed", { error });
      if (!mountedRef.current || requestSequence !== pushPresentationSequenceRef.current) return;
      setLanguagePushPresentationError(language);
    }
  }, []);

  useEffect(() => {
    void refreshNativePushPresentation(active.language);
  }, [active.language, refreshNativePushPresentation]);

  useEffect(() => {
    void syncNativeLocale(active.language).catch((error) => {
      logger.warn("[Language] Native locale update failed", { language: active.language, error });
    });
  }, [active.language]);

  const setLanguage = useCallback((language: Language) => {
    void requestLanguage(language);
  }, [requestLanguage]);

  const retryLanguage = useCallback(() => {
    const failedRequest = failedRequestRef.current;
    if (failedRequest) {
      void requestLanguage(failedRequest.language, failedRequest.persistSelection);
    }
  }, [requestLanguage]);

  const retryLanguagePushPresentation = useCallback(() => {
    void refreshNativePushPresentation(active.language);
  }, [active.language, refreshNativePushPresentation]);

  const isRTL = isRtlLanguage(active.language);

  // Update document title and meta tags when translations change
  useEffect(() => {
    document.title = active.t.metaTitle || "ZenFlow — Daily Wellness";

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", active.t.metaDescription || "");

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", active.t.metaTitle || "");

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", active.t.metaDescription || "");
  }, [active.t.metaTitle, active.t.metaDescription]);

  // Memoize provider value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      language: active.language,
      setLanguage,
      t: active.t,
      isRTL,
      pendingLanguage,
      languageLoadError,
      languageSaveError,
      languagePushPresentationError,
      retryLanguage,
      retryLanguagePushPresentation,
    }),
    [
      active,
      isRTL,
      languageLoadError,
      languagePushPresentationError,
      languageSaveError,
      pendingLanguage,
      retryLanguage,
      retryLanguagePushPresentation,
      setLanguage,
    ]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
