import type { Language, Translations } from "@/i18n/types";
import { getLocale } from "@/lib/timeUtils";

/**
 * Select plural form using Intl.PluralRules and substitute {count}.
 *
 * Convention: base key = "other" form. Variants: key_one, key_few, key_many, key_two, key_zero.
 * Falls back to base key if variant doesn't exist.
 *
 * Usage: plural(t, 'growthRingsTotal', count, language)
 * Requires: t.growthRingsTotal (other), t.growthRingsTotal_one (optional), etc.
 */

// Cache PluralRules instances per language
const rulesCache = new Map<string, Intl.PluralRules>();

function getRules(language: Language): Intl.PluralRules {
  let rules = rulesCache.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(getLocale(language));
    rulesCache.set(language, rules);
  }
  return rules;
}

type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

const SUFFIX_MAP: Record<PluralCategory, string> = {
  zero: "_zero",
  one: "_one",
  two: "_two",
  few: "_few",
  many: "_many",
  other: "",
};

export function plural(
  t: Translations,
  key: keyof Translations,
  count: number,
  language: Language
): string {
  const rules = getRules(language);
  const category = rules.select(count);

  // Try the specific plural form first, fall back to base key (other)
  const suffixedKey = `${String(key)}${SUFFIX_MAP[category]}` as keyof Translations;
  const suffixedVal = t[suffixedKey];
  const baseVal = t[key];
  const resolved = category !== "other" && typeof suffixedVal === "string" ? suffixedVal : baseVal;
  const template = typeof resolved === "string" ? resolved : "";
  let formattedCount: string;
  try {
    formattedCount = new Intl.NumberFormat(getLocale(language)).format(count);
  } catch {
    formattedCount = String(count);
  }
  const isolatedCount = language === "ar" || language === "he"
    ? `\u2068${formattedCount}\u2069`
    : formattedCount;

  return template.replace(/\{count\}/g, isolatedCount);
}
