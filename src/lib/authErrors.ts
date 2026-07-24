export const AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR = "account-switch-pending-writes";

export const AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_REQUIRED = "imported-backup-account-claim-required";
export const AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT =
  "zenflow:confirm-imported-backup-account-claim";
export const AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT =
  "zenflow:cancel-imported-backup-account-claim";
export const AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT =
  "zenflow:continue-with-imported-backup-save-pending";
export const AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED =
  "imported-backup-decision-already-settled";
export const AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT =
  "zenflow:acknowledge-imported-backup-decision-settled";
export const AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT =
  "zenflow:recover-imported-backup-local-access";

export type ImportedBackupAccountClaimState = "choice" | "action-failed" | "save-failed";

export interface ImportedBackupAccountClaimError {
  accountLabel: string;
  expectedOwnerUserId: string | null;
  state: ImportedBackupAccountClaimState;
}

export function createImportedBackupAccountClaimError(
  accountLabel?: string,
  expectedOwnerUserId?: string,
  state: ImportedBackupAccountClaimState = "choice"
): string {
  const normalizedLabel = accountLabel?.trim();
  if (!normalizedLabel) return AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_REQUIRED;
  const encodedLabel = encodeURIComponent(normalizedLabel);
  const normalizedOwnerUserId = expectedOwnerUserId?.trim();
  return normalizedOwnerUserId
    ? `${AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_REQUIRED}:${encodedLabel}:${encodeURIComponent(normalizedOwnerUserId)}:${state}`
    : `${AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_REQUIRED}:${encodedLabel}`;
}

export function readImportedBackupAccountClaim(
  error: string | null
): ImportedBackupAccountClaimError | null {
  if (error === AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_REQUIRED) {
    return { accountLabel: "", expectedOwnerUserId: null, state: "choice" };
  }
  const labeledPrefix = `${AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_REQUIRED}:`;
  if (!error?.startsWith(labeledPrefix)) return null;
  const [encodedLabel, encodedOwnerUserId, encodedState] = error
    .slice(labeledPrefix.length)
    .split(":", 3);
  const state: ImportedBackupAccountClaimState =
    encodedState === "action-failed" || encodedState === "save-failed" ? encodedState : "choice";
  try {
    return {
      accountLabel: decodeURIComponent(encodedLabel),
      expectedOwnerUserId: encodedOwnerUserId ? decodeURIComponent(encodedOwnerUserId) : null,
      state,
    };
  } catch {
    return { accountLabel: "", expectedOwnerUserId: null, state: "choice" };
  }
}

export function readImportedBackupAccountClaimLabel(error: string | null): string | null {
  return readImportedBackupAccountClaim(error)?.accountLabel ?? null;
}

export const LEGACY_OFFLINE_QUEUE_RECOVERY_EVENT = "zenflow:recover-legacy-offline-queue";
export const LEGACY_OFFLINE_QUEUE_CANCEL_EVENT = "zenflow:cancel-legacy-offline-queue-recovery";
