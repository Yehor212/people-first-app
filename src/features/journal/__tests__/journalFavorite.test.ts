import { describe, expect, it } from "vitest";
import {
  JOURNAL_FAVORITE_TAG,
  getVisibleJournalTags,
  isFavoriteJournalEntry,
  isJournalFavoriteTag,
  setJournalEntryFavorite,
} from "../journalFavorite";

describe("journal favorites", () => {
  it("does not interpret user-authored words as system favorite metadata", () => {
    expect(isFavoriteJournalEntry({ tags: ["favorite", "обране", "お気に入り"] })).toBe(false);
    expect(isJournalFavoriteTag("favorite")).toBe(false);
    expect(isJournalFavoriteTag("favorito")).toBe(false);
  });

  it("stores an explicit favorite as hidden, language-neutral metadata", () => {
    expect(setJournalEntryFavorite(["reflection", "обране", "favorite"], true)).toEqual([
      "reflection",
      "обране",
      "favorite",
      JOURNAL_FAVORITE_TAG,
    ]);
    expect(isFavoriteJournalEntry({ tags: ["reflection", JOURNAL_FAVORITE_TAG] })).toBe(true);
  });

  it("removes only hidden favorite metadata when the explicit star is disabled", () => {
    expect(
      setJournalEntryFavorite(["work", "favorito", JOURNAL_FAVORITE_TAG, "memory"], false)
    ).toEqual([
      "work",
      "favorito",
      "memory",
    ]);
  });

  it("keeps hidden favorite metadata out of user-facing tag surfaces", () => {
    expect(getVisibleJournalTags(["memory", JOURNAL_FAVORITE_TAG, "travel"])).toEqual([
      "memory",
      "travel",
    ]);
  });

  it("keeps only unambiguous legacy workflow metadata out of user-facing tags and exports", () => {
    expect(
      getVisibleJournalTags([
        "travel",
        "quick-note",
        "photo-note",
        "focus",
        "gratitude",
        "template",
        "portal-focus",
        "portal-gratitude",
        "day-capsule",
        "family",
      ]),
    ).toEqual(["travel", "focus", "gratitude", "template", "family"]);
  });

  it("does not hide user-authored tags that happen to match old workflow words", () => {
    expect(getVisibleJournalTags(["focus", "gratitude", "template", "family"])).toEqual([
      "focus",
      "gratitude",
      "template",
      "family",
    ]);
  });
});
