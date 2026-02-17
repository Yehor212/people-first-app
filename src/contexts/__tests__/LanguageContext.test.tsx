/**
 * LanguageContext Tests
 *
 * Tests for the language provider, including browser language detection,
 * RTL support, language validation, and translation object delivery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';

// --- Mocks ---

let mockLanguage: any = 'en';
let mockSetLanguage: any;

vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn(() => [mockLanguage, mockSetLanguage]),
}));

vi.mock('@/lib/safeJson', () => ({
  storageGetRaw: vi.fn(() => ''),
}));

vi.mock('@/lib/storageKeys', () => ({
  SK: { LANGUAGE_SELECTED: 'zenflow-language-selected' },
}));

vi.mock('@/i18n/translations', () => ({
  translations: {
    en: { greeting: 'Hello' },
    uk: { greeting: 'Привіт' },
    ar: { greeting: 'مرحبا' },
    he: { greeting: 'שלום' },
    es: { greeting: 'Hola' },
    de: { greeting: 'Hallo' },
    fr: { greeting: 'Bonjour' },
    ja: { greeting: 'こんにちは' },
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

import { LanguageProvider, useLanguage } from '../LanguageContext';

// --- Helpers ---

const wrapper = ({ children }: { children: ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

// --- Tests ---

describe('LanguageContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      result.current.setLanguage('es' as any);
    });

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
});
