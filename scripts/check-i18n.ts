/**
 * i18n Validation Script
 *
 * Checks for:
 * 1. Missing keys between languages
 * 2. Empty values
 * 3. Key count consistency
 *
 * Usage: npx tsx scripts/check-i18n.ts
 */

import { translations, Language, Translations } from '../src/i18n/translations';

const MAIN_LANGUAGES: Language[] = ['ru', 'en', 'uk', 'es', 'de', 'fr', 'ja'];
const REFERENCE_LANG: Language = 'en';

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function validateTranslations(): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  const referenceTranslations = translations[REFERENCE_LANG];
  if (!referenceTranslations) {
    result.errors.push(`Reference language ${REFERENCE_LANG} not found!`);
    return result;
  }

  const referenceKeys = Object.keys(referenceTranslations).sort();
  console.log(`\n📊 Reference language: ${REFERENCE_LANG} (${referenceKeys.length} keys)\n`);

  // Check each language
  for (const lang of MAIN_LANGUAGES) {
    const langTranslations = translations[lang];

    if (!langTranslations) {
      result.errors.push(`❌ Language ${lang}: translations not found`);
      continue;
    }

    const langKeys = Object.keys(langTranslations).sort();

    // Check for missing keys
    const missingKeys = referenceKeys.filter(key => !langKeys.includes(key));
    const extraKeys = langKeys.filter(key => !referenceKeys.includes(key));

    // Check for empty values
    const emptyKeys: string[] = [];
    for (const [key, value] of Object.entries(langTranslations)) {
      if (typeof value === 'string' && value.trim() === '') {
        emptyKeys.push(key);
      }
    }

    // Report results
    if (missingKeys.length === 0 && emptyKeys.length === 0) {
      console.log(`✅ ${lang}: ${langKeys.length} keys, all valid`);
    } else {
      console.log(`\n❌ ${lang}: ${langKeys.length} keys`);

      if (missingKeys.length > 0) {
        result.errors.push(`${lang}: ${missingKeys.length} missing keys`);
        console.log(`   Missing (${missingKeys.length}):`, missingKeys.slice(0, 5).join(', '));
        if (missingKeys.length > 5) console.log(`   ... and ${missingKeys.length - 5} more`);
      }

      if (emptyKeys.length > 0) {
        result.errors.push(`${lang}: ${emptyKeys.length} empty values`);
        console.log(`   Empty (${emptyKeys.length}):`, emptyKeys.slice(0, 5).join(', '));
      }
    }

    if (extraKeys.length > 0) {
      result.warnings.push(`${lang}: ${extraKeys.length} extra keys not in ${REFERENCE_LANG}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 SUMMARY');
  console.log('='.repeat(50));

  if (result.errors.length === 0) {
    console.log('\n✅ All translations are valid!\n');
  } else {
    console.log(`\n❌ Found ${result.errors.length} error(s):\n`);
    result.errors.forEach(err => console.log(`   - ${err}`));
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log(`⚠️  ${result.warnings.length} warning(s):\n`);
    result.warnings.forEach(warn => console.log(`   - ${warn}`));
    console.log('');
  }

  return result;
}

// Run validation
const result = validateTranslations();

// Exit with error code if there are errors
if (result.errors.length > 0) {
  process.exit(1);
}
