import type { Translations } from "./types";

export const JOURNAL_RECOVERY_TRANSLATION_KEYS = [
  "featureAvailabilityDisabledByUser",
  "featureAvailabilityUnlockRequired",
  "featureAvailabilityJournalCountLoading",
  "featureAvailabilityJournalCountUnavailable",
  "journalEntriesUnavailableCount",
  "journalEntriesUnavailableAll",
  "journalEntriesUnavailableAllCount",
  "journalEntriesUnavailableRetry",
  "journalProtectionPasswordSyncPending",
  "journalProtectionRemovalPreflightPending",
  "journalPasswordRemovalResume",
  "journalProtectionRemovalRetry",
  "journalProtectionRemovalRetryPending",
  "journalLockRemoveFailed",
  "journalLockRemoveActivationPending",
  "journalLockRemoveRemovalPending",
  "journalLockRemoveRevisionMismatch",
  "journalLockRemoveContentUnavailable",
  "journalLockRemoveOwnerAdoptionPending",
  "journalLockRemoveOwnerChanged",
  "journalLockRemoveStorageFailed",
  "journalLockRemoveFreshAuth",
  "journalLockRemoveVerifyAccount",
  "journalLockRemoveVerifyingAccount",
  "journalLockRemoveReauthStartFailed",
  "journalLockReauthChecking",
  "journalLockReauthCheckingHint",
  "journalLockReauthNoAccount",
  "journalLockReauthMethodUnavailable",
  "journalLockReauthConfirm",
  "journalLockReauthCheckEmail",
  "journalLockReauthVerified",
  "journalLockReauthVerifiedTitle",
  "journalLockReauthVerifiedDetail",
  "journalLockReauthUnlockAction",
  "journalLockReauthRetryAction",
  "journalLockReauthPhoneDescription",
  "journalLockReauthPhoneTitle",
  "journalLockReauthPhoneConfirm",
  "journalLockReauthPhoneSend",
  "journalLockReauthPhoneCodeTitle",
  "journalLockReauthPhoneCodeLabel",
  "journalLockReauthPhoneCodeInvalid",
  "journalLockReauthPhoneVerify",
  "journalLockReauthProviderDescription",
  "journalLockReauthProviderTitle",
  "journalLockReauthProviderAction",
  "journalLockRemovePartialBiometric",
  "journalLockRemovePartialCloud",
  "journalLockRemovePartialBoth",
] as const;

type JournalRecoveryTranslationKey = (typeof JOURNAL_RECOVERY_TRANSLATION_KEYS)[number];
type JournalRecoveryTranslationValues = readonly string[] & {
  readonly length: typeof JOURNAL_RECOVERY_TRANSLATION_KEYS.length;
};

export function defineJournalRecoveryTranslations(
  values: JournalRecoveryTranslationValues
): Pick<Translations, JournalRecoveryTranslationKey> {
  return Object.fromEntries(
    JOURNAL_RECOVERY_TRANSLATION_KEYS.map((key, index) => [key, values[index]])
  ) as Pick<Translations, JournalRecoveryTranslationKey>;
}
