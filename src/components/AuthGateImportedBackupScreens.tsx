import { useState, type Ref } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT,
  AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT,
} from "@/lib/authErrors";

interface ImportedBackupLocalRecoveryScreenProps {
  recoveryRef: Ref<HTMLDivElement>;
  onRecoverySucceeded: () => void;
}

/**
 * Gate screen shown when a durable imported-backup claim exists but no
 * account claim is active and the user has not chosen local-only access yet.
 * Lets the user continue without an account; the durable recovery runtime
 * answers through the AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT payload.
 */
export function ImportedBackupLocalRecoveryScreen({
  recoveryRef,
  onRecoverySucceeded,
}: ImportedBackupLocalRecoveryScreenProps) {
  const { t } = useLanguage();
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div
        ref={recoveryRef}
        role="alert"
        aria-labelledby="imported-backup-recovery-title"
        aria-describedby="imported-backup-recovery-description"
        tabIndex={-1}
        className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-card p-6 text-card-foreground zen-shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h2 id="imported-backup-recovery-title" className="text-2xl font-bold">
          {t.authImportedBackupRecoveryTitle || "Choose how to recover this backup"}
        </h2>
        <p id="imported-backup-recovery-description" className="text-muted-foreground">
          {t.authImportedBackupRecoveryRequired}
        </p>
        <button
          type="button"
          className="min-h-[48px] w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setRecoveryError(null);
            window.dispatchEvent(
              new CustomEvent(AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT, {
                detail: {
                  onSettled: (success: boolean) => {
                    if (success) {
                      onRecoverySucceeded();
                    } else {
                      setRecoveryError(
                        t.storageErrorDesc ||
                          "ZenFlow could not save the recovery choice. Try again."
                      );
                    }
                  },
                },
              })
            );
          }}
        >
          {t.authGateContinue || "Continue without account"}
        </button>
        {recoveryError ? (
          <p role="alert" className="text-sm text-destructive">
            {recoveryError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Polite status screen shown when the imported-backup account decision was
 * already settled in another tab or runtime; acknowledges back to the owner.
 */
export function ImportedBackupDecisionSettledScreen({
  settledRef,
}: {
  settledRef: Ref<HTMLDivElement>;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div
        ref={settledRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-card p-6 text-card-foreground zen-shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground">
          {t.authImportedBackupDecisionSettled}
        </p>
        <button
          type="button"
          className="min-h-[48px] w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            window.dispatchEvent(
              new Event(AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT)
            );
          }}
        >
          {t.continue}
        </button>
      </div>
    </div>
  );
}
