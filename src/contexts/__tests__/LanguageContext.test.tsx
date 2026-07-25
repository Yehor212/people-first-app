/**
 * LanguageContext Tests
 *
 * Tests for the language provider, including browser language detection,
 * RTL support, language validation, and translation object delivery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

// --- Mocks ---

let mockLanguage: any = 'en';
let mockSetLanguage: any;

const i18nMock = vi.hoisted(() => {
  const translations: Record<string, { greeting: string }> = {};
  return { translations, loadLanguage: vi.fn() };
});

const storageMock = vi.hoisted(() => ({
  safeLocalStorageGet: vi.fn(() => true),
  safeLocalStorageSet: vi.fn(() => true),
  storageReadRaw: vi.fn(() => ({ ok: true as const, value: 'true' })),
  storageRemove: vi.fn(() => true),
}));

const nativePushRealm = vi.hoisted(() => ({
  updateNativePushPresentation: vi.fn(),
}));

vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn(() => [mockLanguage, mockSetLanguage]),
}));

vi.mock('@/lib/safeJson', () => ({
  storageGetRaw: vi.fn(() => ''),
  storageSetRaw: vi.fn(() => true),
  safeLocalStorageGet: storageMock.safeLocalStorageGet,
  safeLocalStorageSet: storageMock.safeLocalStorageSet,
  storageReadRaw: storageMock.storageReadRaw,
  storageRemove: storageMock.storageRemove,
}));

vi.mock('@/lib/storageKeys', () => ({
  SK: {
    LANGUAGE: 'zenflow-language',
    LANGUAGE_SELECTED: 'zenflow-language-selected',
  },
}));

vi.mock('@/lib/nativePushRealm', () => nativePushRealm);

vi.mock('@/i18n/translations', () => ({
  translations: i18nMock.translations,
  loadLanguage: i18nMock.loadLanguage,
  normalizeLanguage: (value: unknown) => {
    const language = typeof value === 'string' ? value.split('-')[0]?.toLowerCase() : 'en';
    return ['en', 'uk', 'es', 'de', 'fr', 'ja', 'ar', 'he'].includes(language) ? language : 'en';
  },
  isRtlLanguage: (language: string) => language === 'ar' || language === 'he',
  applyDocumentLanguage: (language: string) => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' || language === 'he' ? 'rtl' : 'ltr';
  },
  languageNames: {
    en: 'English', uk: 'Ukrainian', ar: 'Arabic', he: 'Hebrew',
    es: 'Spanish', de: 'German', fr: 'French', ja: 'Japanese',
  },
  languageFlags: {
    en: '🇬🇧', uk: '🇺🇦', ar: '🇸🇦', he: '🇮🇱',
    es: '🇪🇸', de: '🇩🇪', fr: '🇫🇷', ja: '🇯🇵',
  },
}));

import { storageGetRaw, storageSetRaw } from '@/lib/safeJson';
import { LanguageProvider, useLanguage } from '../LanguageContext';

// --- Helpers ---

const wrapper = ({ children }: { children: ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

// --- Tests ---

describe('LanguageContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageGetRaw).mockReturnValue('true');
    mockLanguage = 'en';
    mockSetLanguage = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        mockLanguage = updater(mockLanguage);
      } else {
        mockLanguage = updater;
      }
    });
    // Reset navigator.language to a known default
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      writable: true,
      configurable: true,
    });
    Object.keys(i18nMock.translations).forEach((key) => delete i18nMock.translations[key]);
    Object.assign(i18nMock.translations, {
      en: { greeting: 'Hello' },
      uk: { greeting: 'Привіт' },
      ar: { greeting: 'مرحبا' },
      he: { greeting: 'שלום' },
      es: { greeting: 'Hola' },
      de: { greeting: 'Hallo' },
      fr: { greeting: 'Bonjour' },
      ja: { greeting: 'こんにちは' },
    });
    i18nMock.loadLanguage.mockReset();
    i18nMock.loadLanguage.mockImplementation(async (language: string) => {
      const loaded = i18nMock.translations[language];
      if (!loaded) throw new Error(`Missing test dictionary: ${language}`);
      return loaded;
    });
    storageMock.safeLocalStorageSet.mockReturnValue(true);
    storageMock.safeLocalStorageGet.mockReturnValue(true);
    storageMock.storageReadRaw.mockReturnValue({ ok: true, value: 'true' });
    storageMock.storageRemove.mockReturnValue(true);
    nativePushRealm.updateNativePushPresentation.mockReset().mockResolvedValue(undefined);
  });

  // 1. Default language: English when navigator.language is 'en-US'
  it('defaults to English when navigator.language is en-US', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('en');
  });

  // 2. Browser detection: 'uk' -> Ukrainian
  it('detects Ukrainian from navigator.language uk', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'uk',
      writable: true,
      configurable: true,
    });
    mockLanguage = 'uk';

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('uk');
  });

  // 3. Browser detection: unsupported language falls back to 'en'
  it('falls back to en for unsupported browser language like ru', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'ru-RU',
      writable: true,
      configurable: true,
    });
    // useLocalStorage would have been initialized with detected language (en fallback)
    mockLanguage = 'en';

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('en');
  });

  // 4. Browser detection: null navigator.language -> 'en'
  it('falls back to en when navigator.language is null', () => {
    Object.defineProperty(navigator, 'language', {
      value: null,
      writable: true,
      configurable: true,
    });
    mockLanguage = 'en';

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('en');
  });

  // 5. RTL: Arabic -> isRTL = true
  it('returns isRTL=true for Arabic', () => {
    mockLanguage = 'ar';

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.isRTL).toBe(true);
  });

  // 6. RTL: Hebrew -> isRTL = true
  it('returns isRTL=true for Hebrew', () => {
    mockLanguage = 'he';

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.isRTL).toBe(true);
  });

  // 7. RTL: English -> isRTL = false
  it('returns isRTL=false for English', () => {
    mockLanguage = 'en';

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.isRTL).toBe(false);
  });

  // 8. setLanguage updates language value
  it('setLanguage calls the underlying setter with the new language', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setLanguage('es');
    });

    expect(mockSetLanguage).toHaveBeenCalledWith('es');
    expect(storageMock.safeLocalStorageSet).toHaveBeenCalledWith('zenflow-language', 'es');
    expect(storageSetRaw).toHaveBeenCalledWith('zenflow-language-selected', 'true');
  });

  it('updates the active native push realm when the app language changes', async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setLanguage('es');
    });

    await waitFor(() => {
      expect(nativePushRealm.updateNativePushPresentation).toHaveBeenCalledWith({
        language: 'es',
      });
    });
  });

  it('keeps the selected language active when native presentation refresh is unavailable', async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    await waitFor(() => {
      expect(nativePushRealm.updateNativePushPresentation).toHaveBeenCalledWith({
        language: 'en',
      });
    });
    nativePushRealm.updateNativePushPresentation.mockRejectedValueOnce(
      new Error('native realm unavailable'),
    );

    act(() => {
      result.current.setLanguage('es');
    });

    await waitFor(() => expect(result.current.language).toBe('es'));
    expect(storageMock.safeLocalStorageSet).toHaveBeenCalledWith('zenflow-language', 'es');
    await waitFor(() => expect(result.current.languagePushPresentationError).toBe('es'));

    nativePushRealm.updateNativePushPresentation.mockResolvedValueOnce(undefined);
    act(() => result.current.retryLanguagePushPresentation());
    await waitFor(() => expect(result.current.languagePushPresentationError).toBeNull());
  });

  it('keeps an unsaved language active for the session and exposes retry when durable storage rejects the selection', async () => {
    storageMock.safeLocalStorageSet.mockReturnValueOnce(false);
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => result.current.setLanguage('es'));

    expect(result.current.language).toBe('es');
    expect(result.current.t).toEqual({ greeting: 'Hola' });
    expect(result.current.languageLoadError).toBeNull();
    expect(result.current.languageSaveError).toBe('es');
    expect(mockSetLanguage).not.toHaveBeenCalledWith('es');
    expect(document.documentElement.lang).toBe('es');

    act(() => result.current.retryLanguage());
    await waitFor(() => expect(result.current.language).toBe('es'));
    expect(result.current.languageSaveError).toBeNull();
    expect(mockSetLanguage).toHaveBeenCalledWith('es');
  });

  // 9. Language validation: invalid stored language falls back to 'en'
  it('falls back to en when stored language is invalid/unsupported', () => {
    // Simulate a previously-stored but now removed language like 'ru'
    mockLanguage = 'ru';

    const { result } = renderHook(() => useLanguage(), { wrapper });

    // validLanguage check: SUPPORTED_LANGUAGES.includes('ru') is false, so falls back to 'en'
    expect(result.current.language).toBe('en');
  });

  it('treats a persisted false selection marker as unselected', () => {
    vi.mocked(storageGetRaw).mockReturnValue('false');
    storageMock.safeLocalStorageGet.mockReturnValue(false);
    mockLanguage = 'uk';
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('en');
    expect(result.current.t).toEqual({ greeting: 'Hello' });
  });

  // 10. Translations: returns correct translations object for language
  it('returns the correct translations object for the current language', () => {
    mockLanguage = 'uk';

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.t).toEqual({ greeting: 'Привіт' });
  });

  // 11. useLanguage throws when used outside provider
  it('useLanguage throws when used outside LanguageProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useLanguage());
    }).toThrow('useLanguage must be used within a LanguageProvider');

    consoleSpy.mockRestore();
  });

  // 12. Translations object matches the set language (Japanese)
  it('returns Japanese translations when language is ja', () => {
    mockLanguage = 'ja';

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('ja');
    expect(result.current.t).toEqual({ greeting: 'こんにちは' });
    expect(result.current.isRTL).toBe(false);
  });

  it('commits only the newest language request when chunks resolve out of order', async () => {
    delete i18nMock.translations.uk;
    delete i18nMock.translations.ar;
    let resolveUkrainian!: (value: { greeting: string }) => void;
    let resolveArabic!: (value: { greeting: string }) => void;
    i18nMock.loadLanguage.mockImplementation((language: string) => new Promise((resolve) => {
      if (language === 'uk') resolveUkrainian = resolve;
      if (language === 'ar') resolveArabic = resolve;
    }));

    const { result } = renderHook(() => useLanguage(), { wrapper });
    act(() => {
      result.current.setLanguage('uk');
      result.current.setLanguage('ar');
    });

    expect(result.current.pendingLanguage).toBe('ar');
    await act(async () => resolveArabic({ greeting: 'مرحبا' }));
    await act(async () => resolveUkrainian({ greeting: 'Привіт' }));

    expect(result.current.language).toBe('ar');
    expect(result.current.t).toEqual({ greeting: 'مرحبا' });
    expect(result.current.isRTL).toBe(true);
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(mockSetLanguage).toHaveBeenLastCalledWith('ar');
  });

  it('retains the last complete dictionary and exposes retry after a chunk failure', async () => {
    delete i18nMock.translations.fr;
    i18nMock.loadLanguage.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => result.current.setLanguage('fr'));
    await waitFor(() => expect(result.current.languageLoadError).toBe('fr'));

    expect(result.current.language).toBe('en');
    expect(result.current.t).toEqual({ greeting: 'Hello' });
    expect(mockSetLanguage).not.toHaveBeenCalledWith('fr');

    i18nMock.loadLanguage.mockResolvedValueOnce({ greeting: 'Bonjour' });
    act(() => result.current.retryLanguage());
    await waitFor(() => expect(result.current.language).toBe('fr'));
    expect(result.current.languageLoadError).toBeNull();
    expect(result.current.t).toEqual({ greeting: 'Bonjour' });
  });

  it('does not turn an auto-detected language into a manual selection after load retry', async () => {
    vi.mocked(storageGetRaw).mockReturnValue('');
    storageMock.safeLocalStorageGet.mockReturnValue(false);
    Object.defineProperty(navigator, 'language', {
      value: 'fr-FR',
      writable: true,
      configurable: true,
    });
    delete i18nMock.translations.fr;
    i18nMock.loadLanguage.mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useLanguage(), { wrapper });
    await waitFor(() => expect(result.current.languageLoadError).toBe('fr'));

    i18nMock.loadLanguage.mockResolvedValueOnce({ greeting: 'Bonjour' });
    act(() => result.current.retryLanguage());
    await waitFor(() => expect(result.current.language).toBe('fr'));

    expect(storageSetRaw).not.toHaveBeenCalledWith('zenflow-language-selected', 'true');
    expect(storageMock.safeLocalStorageSet).not.toHaveBeenCalledWith('zenflow-language', 'fr');
  });

  it('loads an uncached stored dictionary before committing its language and direction', async () => {
    mockLanguage = 'he';
    delete i18nMock.translations.he;
    let resolveHebrew!: (value: { greeting: string }) => void;
    i18nMock.loadLanguage.mockImplementation(() => new Promise((resolve) => {
      resolveHebrew = resolve;
    }));

    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.language).toBe('en');
    expect(result.current.pendingLanguage).toBe('he');

    await act(async () => resolveHebrew({ greeting: 'שלום' }));
    expect(result.current.language).toBe('he');
    expect(result.current.t).toEqual({ greeting: 'שלום' });
    expect(document.documentElement.dir).toBe('rtl');
  });
});
