import { describe, expect, it, vi } from "vitest";

import {
  JOURNAL_SAVE_CEREMONY_CANCEL_EVENT,
  captureJournalSaveCeremonyLifecycle,
  invalidateJournalSaveCeremonyLifecycle,
  markJournalSaveCeremonyLifecycleActive,
  mayPresentJournalSaveCeremony,
} from "../save-ceremony/journalSaveCeremonyLifecycle";

describe("journal save ceremony lifecycle epoch", () => {
  it("invalidates a save that started before background and permits only a new foreground save", () => {
    markJournalSaveCeremonyLifecycleActive();
    const beforeBackground = captureJournalSaveCeremonyLifecycle();
    const cancel = vi.fn();
    window.addEventListener(JOURNAL_SAVE_CEREMONY_CANCEL_EVENT, cancel);

    invalidateJournalSaveCeremonyLifecycle();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(mayPresentJournalSaveCeremony(beforeBackground)).toBe(false);

    markJournalSaveCeremonyLifecycleActive();
    const afterForeground = captureJournalSaveCeremonyLifecycle();
    expect(mayPresentJournalSaveCeremony(afterForeground)).toBe(true);
    expect(mayPresentJournalSaveCeremony(beforeBackground)).toBe(false);

    window.removeEventListener(JOURNAL_SAVE_CEREMONY_CANCEL_EVENT, cancel);
  });
});
