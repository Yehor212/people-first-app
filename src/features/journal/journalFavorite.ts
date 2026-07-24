import type { JournalEntry } from "./types";

export const JOURNAL_FAVORITE_TAG = "__zenflow_favorite_v1__";

const LEGACY_HIDDEN_JOURNAL_TAGS = new Set([
  "quick-note",
  "photo-note",
  "day-capsule",
]);

export function isJournalFavoriteTag(tag: string): boolean {
  return tag === JOURNAL_FAVORITE_TAG;
}

export function isHiddenJournalSystemTag(tag: string): boolean {
  return (
    isJournalFavoriteTag(tag) ||
    LEGACY_HIDDEN_JOURNAL_TAGS.has(tag) ||
    tag.startsWith("portal-") ||
    tag.startsWith("__zenflow_")
  );
}

export function isFavoriteJournalEntry(entry: Pick<JournalEntry, "tags">): boolean {
  return entry.tags.some(isJournalFavoriteTag);
}

export function setJournalEntryFavorite(tags: string[], favorite: boolean): string[] {
  const visibleTags = tags.filter((tag) => !isJournalFavoriteTag(tag));
  return favorite ? [...visibleTags, JOURNAL_FAVORITE_TAG] : visibleTags;
}

export function getVisibleJournalTags(tags: string[]): string[] {
  return tags.filter((tag) => !isHiddenJournalSystemTag(tag));
}
