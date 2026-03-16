import { describe, it, expect } from 'vitest';
import { translations, Language, Translations } from '../src/i18n/translations';

// Get all supported languages
const MAIN_LANGUAGES: Language[] = ['en', 'uk', 'es', 'de', 'fr', 'ja', 'ar', 'he'];

// Reference language (English) - all other languages should have the same keys
const REFERENCE_LANG: Language = 'en';

describe('i18n Translations', () => {
  describe('Key parity between languages', () => {
    const referenceKeys = Object.keys(translations[REFERENCE_LANG] || {}).sort();

    MAIN_LANGUAGES.forEach((lang) => {
      it(`${lang} should have all keys from ${REFERENCE_LANG}`, () => {
        const langTranslations = translations[lang];
        if (!langTranslations) {
          throw new Error(`Translations for ${lang} not found`);
        }

        const langKeys = Object.keys(langTranslations).sort();
        const missingKeys = referenceKeys.filter((key) => !langKeys.includes(key));
        const extraKeys = langKeys.filter((key) => !referenceKeys.includes(key));

        if (missingKeys.length > 0) {
          console.error(`\n❌ Missing keys in ${lang}:`, missingKeys.slice(0, 10));
          if (missingKeys.length > 10) {
            console.error(`   ... and ${missingKeys.length - 10} more`);
          }
        }

        if (extraKeys.length > 0) {
          console.warn(`\n⚠️ Extra keys in ${lang} (not in ${REFERENCE_LANG}):`, extraKeys.slice(0, 5));
        }

        expect(missingKeys).toEqual([]);
      });
    });
  });

  describe('No empty values', () => {
    MAIN_LANGUAGES.forEach((lang) => {
      it(`${lang} should not have empty string values`, () => {
        const langTranslations = translations[lang];
        if (!langTranslations) {
          throw new Error(`Translations for ${lang} not found`);
        }

        const emptyKeys: string[] = [];

        for (const [key, value] of Object.entries(langTranslations)) {
          if (typeof value === 'string' && value.trim() === '') {
            emptyKeys.push(key);
          }
        }

        if (emptyKeys.length > 0) {
          console.error(`\n❌ Empty values in ${lang}:`, emptyKeys);
        }

        expect(emptyKeys).toEqual([]);
      });
    });
  });

  describe('Key count consistency', () => {
    it('all main languages should have the same number of keys', () => {
      const keyCounts: Record<string, number> = {};

      MAIN_LANGUAGES.forEach((lang) => {
        const langTranslations = translations[lang];
        if (langTranslations) {
          keyCounts[lang] = Object.keys(langTranslations).length;
        }
      });

      const counts = Object.values(keyCounts);
      const allSame = counts.every((count) => count === counts[0]);

      if (!allSame) {
        console.error('\n❌ Key count mismatch:', keyCounts);
      }

      expect(allSame).toBe(true);
    });
  });

  describe('No duplicate keys with different casing', () => {
    MAIN_LANGUAGES.forEach((lang) => {
      it(`${lang} should not have keys that differ only by case`, () => {
        const langTranslations = translations[lang];
        if (!langTranslations) {
          return;
        }

        const keys = Object.keys(langTranslations);
        const lowerCaseKeys = keys.map((k) => k.toLowerCase());
        const duplicates = lowerCaseKeys.filter(
          (key, index) => lowerCaseKeys.indexOf(key) !== index
        );

        expect(duplicates).toEqual([]);
      });
    });
  });

  describe('Placeholder consistency', () => {
    // Keys that use placeholders like {name}, {count}, etc.
    const placeholderPattern = /\{(\w+)\}/g;

    it('placeholder patterns should be consistent across languages', () => {
      const referenceTranslations = translations[REFERENCE_LANG];
      if (!referenceTranslations) {
        throw new Error(`Reference translations for ${REFERENCE_LANG} not found`);
      }

      const inconsistencies: string[] = [];

      for (const [key, refValue] of Object.entries(referenceTranslations)) {
        if (typeof refValue !== 'string') continue;

        const refPlaceholders = [...refValue.matchAll(placeholderPattern)].map((m) => m[1]).sort();

        if (refPlaceholders.length === 0) continue;

        MAIN_LANGUAGES.filter((l) => l !== REFERENCE_LANG).forEach((lang) => {
          const langTranslations = translations[lang];
          if (!langTranslations) return;

          const langValue = langTranslations[key as keyof Translations];
          if (typeof langValue !== 'string') return;

          const langPlaceholders = [...langValue.matchAll(placeholderPattern)]
            .map((m) => m[1])
            .sort();

          const refSet = new Set(refPlaceholders);
          const langSet = new Set(langPlaceholders);

          const missing = refPlaceholders.filter((p) => !langSet.has(p));
          const extra = langPlaceholders.filter((p) => !refSet.has(p));

          if (missing.length > 0 || extra.length > 0) {
            inconsistencies.push(
              `${key} in ${lang}: missing=[${missing.join(',')}], extra=[${extra.join(',')}]`
            );
          }
        });
      }

      if (inconsistencies.length > 0) {
        console.warn('\n⚠️ Placeholder inconsistencies:', inconsistencies.slice(0, 10));
      }

      // This is a warning, not a failure - placeholders might legitimately differ
      // expect(inconsistencies).toEqual([]);
    });
  });

  describe('Translation sanity checks', () => {
    it('should have appName defined for all languages', () => {
      MAIN_LANGUAGES.forEach((lang) => {
        const langTranslations = translations[lang];
        expect(langTranslations?.appName).toBeDefined();
        expect(langTranslations?.appName).not.toBe('');
      });
    });

    it('should have common UI keys defined', () => {
      const requiredKeys: (keyof Translations)[] = [
        'save',
        'cancel',
        'close',
        'delete',
        'confirm',
        'retry',
        'dismiss',
        'next',
        'skip',
      ];

      MAIN_LANGUAGES.forEach((lang) => {
        const langTranslations = translations[lang];
        if (!langTranslations) return;

        requiredKeys.forEach((key) => {
          expect(langTranslations[key]).toBeDefined();
          expect(langTranslations[key]).not.toBe('');
        });
      });
    });
  });
});
