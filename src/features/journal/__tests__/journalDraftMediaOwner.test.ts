import { describe, expect, it } from "vitest";
import {
  JOURNAL_DRAFT_ENTRY_ID,
  getJournalDraftMediaOwnerId,
  isJournalDraftMediaOwnerId,
} from "../types";

describe("journal draft media ownership", () => {
  it("keeps different editor drafts in separate media namespaces", () => {
    expect(getJournalDraftMediaOwnerId("entry-one")).toBe("__draft__:entry-one");
    expect(getJournalDraftMediaOwnerId("entry-two")).toBe("__draft__:entry-two");
    expect(getJournalDraftMediaOwnerId(null)).toBe("__draft__:new");
  });

  it("recognizes both scoped and legacy draft media during migration", () => {
    expect(isJournalDraftMediaOwnerId("__draft__:entry-one")).toBe(true);
    expect(isJournalDraftMediaOwnerId(JOURNAL_DRAFT_ENTRY_ID)).toBe(true);
    expect(isJournalDraftMediaOwnerId("entry-one")).toBe(false);
  });
});
