export const JOURNAL_SAVE_CEREMONY_CANCEL_EVENT =
  "zenflow:journal-save-ceremony-cancel";

export interface JournalSaveCeremonyLifecycleToken {
  epoch: number;
}

let lifecycleEpoch = 0;
let lifecycleActive =
  typeof document === "undefined" || document.visibilityState !== "hidden";

export function captureJournalSaveCeremonyLifecycle(): JournalSaveCeremonyLifecycleToken {
  return { epoch: lifecycleEpoch };
}

export function markJournalSaveCeremonyLifecycleActive(): void {
  lifecycleActive = true;
}

export function invalidateJournalSaveCeremonyLifecycle(): void {
  lifecycleActive = false;
  lifecycleEpoch += 1;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(JOURNAL_SAVE_CEREMONY_CANCEL_EVENT));
  }
}

export function mayPresentJournalSaveCeremony(
  token: JournalSaveCeremonyLifecycleToken,
): boolean {
  return (
    lifecycleActive &&
    token.epoch === lifecycleEpoch &&
    (typeof document === "undefined" ||
      document.visibilityState !== "hidden")
  );
}
