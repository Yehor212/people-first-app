export class JournalRemovePasswordLockedError extends Error {
  constructor() {
    super("Unlock your diary before removing password protection.");
    this.name = "JournalRemovePasswordLockedError";
  }
}

export type JournalProtectionBlockerCode =
  | "unlock-required"
  | "activation-pending"
  | "removal-pending"
  | "vault-revision-mismatch"
  | "decrypt-entry"
  | "decrypt-media"
  | "decrypt-draft"
  | "decrypt-space"
  | "decrypt-capture"
  | "owner-changed"
  | "storage-failed";

export type JournalSecurityDiagnosticCode =
  | "enqueue-failed"
  | "storage-failed";

const JOURNAL_SECURITY_DIAGNOSTIC_CODES = new Set<JournalSecurityDiagnosticCode>([
  "enqueue-failed",
  "storage-failed",
]);

export function isJournalSecurityDiagnosticCode(
  value: unknown,
): value is JournalSecurityDiagnosticCode {
  return (
    typeof value === "string" &&
    JOURNAL_SECURITY_DIAGNOSTIC_CODES.has(value as JournalSecurityDiagnosticCode)
  );
}

export function normalizeJournalSecurityDiagnosticCode(
  value: unknown,
): JournalSecurityDiagnosticCode | undefined {
  return isJournalSecurityDiagnosticCode(value) ? value : undefined;
}

export type JournalPasswordRemovalRecoveryAction =
  | "unlock"
  | "wait-for-activation"
  | "reload"
  | "retry"
  | "stay-signed-in";

export type JournalPasswordRemovalPreflight =
  | {
      status: "ready";
      expectedVaultRevision: number;
      coverage: Record<"entries" | "media" | "drafts" | "spaces" | "captures", number>;
    }
  | {
      status: JournalProtectionBlockerCode;
      recoveryAction: JournalPasswordRemovalRecoveryAction;
    };

export class JournalPasswordRemovalBlockedError extends Error {
  readonly code: JournalProtectionBlockerCode;
  readonly recoveryAction: JournalPasswordRemovalRecoveryAction;

  constructor(
    preflight: Exclude<JournalPasswordRemovalPreflight, { status: "ready" }>
  ) {
    super(`Diary password removal blocked: ${preflight.status}`);
    this.name = "JournalPasswordRemovalBlockedError";
    this.code = preflight.status;
    this.recoveryAction = preflight.recoveryAction;
  }
}

export type JournalPasswordRemovalCleanup = "biometric" | "cloud";

export type JournalPasswordRemovalResult =
  | {
      status: "removed";
    }
  | {
      status: "removed-cleanup-pending";
      pending: JournalPasswordRemovalCleanup[];
    }
  | {
      status: "blocked";
      blocker: JournalProtectionBlockerCode;
      recoveryAction: JournalPasswordRemovalRecoveryAction;
    };

/** @deprecated Password removal now returns a truthful cleanup-pending result. */
export class JournalRemovePasswordPartialError extends Error {
  readonly originalError: unknown;

  constructor(originalError?: unknown) {
    super("Diary password removal stopped after biometric unlock was disabled.");
    this.name = "JournalRemovePasswordPartialError";
    this.originalError = originalError;
  }
}
