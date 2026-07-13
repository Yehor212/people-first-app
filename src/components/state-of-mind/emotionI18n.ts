import type { Translations } from "@/i18n/types";
import { EMOTION_TAGS } from "./emotionTags";

type TranslationMap = Partial<Translations>;

const EMOTION_TAG_KEYS = new Set(EMOTION_TAGS.map((tag) => tag.key));

function toPascalCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function emotionTagToI18nKey(key: string): keyof Translations {
  return `somTag${toPascalCase(key)}` as keyof Translations;
}

export function isEmotionTagKey(value: string): boolean {
  return EMOTION_TAG_KEYS.has(value.trim().toLowerCase());
}

export function getLocalizedEmotionLabel(value: string, translations: TranslationMap): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized || !isEmotionTagKey(normalized)) return value;

  const translationKey = emotionTagToI18nKey(normalized);
  const translated = translations[translationKey];
  return typeof translated === "string" && translated ? translated : value;
}
