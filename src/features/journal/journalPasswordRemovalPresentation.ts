import type {
  JournalPasswordRemovalCleanup,
  JournalProtectionBlockerCode,
} from "./journalSecurityErrors";

type JournalRemovalCopy = Record<string, string | undefined>;

export function getJournalPasswordRemovalBlockerMessage(
  ts: JournalRemovalCopy,
  blocker: JournalProtectionBlockerCode,
): string {
  switch (blocker) {
    case "unlock-required":
      return (
        ts.journalLockRemoveFailed ||
        "Unlock your diary, then try removing protection again. Nothing was changed."
      );
    case "activation-pending":
      return (
        ts.journalLockRemoveActivationPending ||
        "Finish setting up diary protection first, then try again. Nothing was changed."
      );
    case "removal-pending":
      return (
        ts.journalLockRemoveRemovalPending ||
        "A previous removal is still being finished. Keep this account signed in and try again shortly."
      );
    case "vault-revision-mismatch":
      return (
        ts.journalLockRemoveRevisionMismatch ||
        "Your diary changed while it was being checked. Reload it, unlock it, and try again. Nothing was changed."
      );
    case "decrypt-entry":
    case "decrypt-media":
    case "decrypt-draft":
    case "decrypt-space":
    case "decrypt-capture":
      return (
        ts.journalLockRemoveContentUnavailable ||
        "Some protected diary content could not be opened. Stay online, unlock the diary, and try again. Nothing was removed."
      );
    case "owner-changed":
      return (
        ts.journalLockRemoveOwnerChanged ||
        "The signed-in account changed. Return to the account that owns this diary and try again. Nothing was changed."
      );
    case "storage-failed":
      return (
        ts.journalLockRemoveStorageFailed ||
        "This device could not read the complete diary. Keep the app open, reload, and try again. Nothing was changed."
      );
  }
}

export function getJournalPasswordRemovalCleanupMessage(
  ts: JournalRemovalCopy,
  pending: JournalPasswordRemovalCleanup[],
): string {
  const pendingSet = new Set(pending);
  if (pendingSet.has("biometric") && pendingSet.has("cloud")) {
    return (
      ts.journalLockRemovePartialBoth ||
      ts.journalLockRemovePartial ||
      "Diary protection is off on this device. Cleanup for biometric unlock and your other signed-in devices is still pending. Keep the app open, stay signed in, and try again when online."
    );
  }
  if (pendingSet.has("biometric")) {
    return (
      ts.journalLockRemovePartialBiometric ||
      ts.journalLockRemovePartial ||
      "Diary protection is off on this device. Biometric cleanup is still pending. Keep the app open and try again."
    );
  }
  return (
    ts.journalLockRemovePartialCloud ||
    ts.journalLockRemovePartial ||
    "Diary protection is off on this device. Cleanup for your other signed-in devices is still pending. Stay signed in and try again when online."
  );
}
