import { useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AuthScreen } from "@/components/AuthScreen";
import { PremiumLoader } from "@/components/PremiumLoader";
import { interpolate } from "@/lib/utils";
import {
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT,
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT,
  AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT,
  LEGACY_OFFLINE_QUEUE_CANCEL_EVENT,
  LEGACY_OFFLINE_QUEUE_RECOVERY_EVENT,
  type readImportedBackupAccountClaim,
} from "@/lib/authErrors";

interface AuthGateSignInScreenProps {
  isProcessingWebOAuth: boolean;
  webOAuthError: string | null;
  isLegacyQueueRecovery: boolean;
  isImportedBackupClaim: boolean;
  importedBackupAccountClaim: ReturnType<typeof readImportedBackupAccountClaim>;
  displayedAccountLabel: string;
  requiresAccountDecision: boolean;
  importedBackupLocalOnlyDecisionRevision: string | null;
  onAuthComplete: (userData: { name: string; email: string }) => void;
  onClearWebOAuthError: () => void;
}

/**
 * Unauthenticated gate screen. Hosts the OAuth-in-progress loader plus the
 * AuthScreen wiring for legacy offline-queue recovery and imported-backup
 * account claims, including the pending-decision dedup for those choices.
 */
export function AuthGateSignInScreen({
  isProcessingWebOAuth,
  webOAuthError,
  isLegacyQueueRecovery,
  isImportedBackupClaim,
  importedBackupAccountClaim,
  displayedAccountLabel,
  requiresAccountDecision,
  importedBackupLocalOnlyDecisionRevision,
  onAuthComplete,
  onClearWebOAuthError,
}: AuthGateSignInScreenProps) {
  const { t } = useLanguage();
  const [accountDecisionPending, setAccountDecisionPending] = useState(false);
  const accountDecisionPendingRef = useRef(false);

  if (isProcessingWebOAuth) {
    return (
      <div className="min-h-screen zen-gradient-hero flex items-center justify-center p-4">
        <div className="text-center">
          <PremiumLoader size="md" className="mx-auto mb-4" />
          <p className="text-muted-foreground">{t.authSigningIn}</p>
        </div>
      </div>
    );
  }

  const settleAccountDecision = () => {
    accountDecisionPendingRef.current = false;
    setAccountDecisionPending(false);
  };
  const dispatchImportedBackupDecision = (eventName: string) => {
    if (accountDecisionPendingRef.current) return;
    accountDecisionPendingRef.current = true;
    setAccountDecisionPending(true);
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          accountLabel: displayedAccountLabel,
          expectedOwnerUserId: importedBackupAccountClaim?.expectedOwnerUserId ?? undefined,
          expectedLocalOnlyDecisionRevision: importedBackupLocalOnlyDecisionRevision,
          onSettled: settleAccountDecision,
        },
      })
    );
  };

  return (
    <AuthScreen
      onComplete={onAuthComplete}
      webOAuthError={
        isLegacyQueueRecovery
          ? t.authAccountSwitchPendingChanges
          : isImportedBackupClaim
            ? interpolate(
                importedBackupAccountClaim?.state === "save-failed"
                  ? t.authImportedBackupSaveFailed
                  : importedBackupAccountClaim?.state === "action-failed"
                    ? t.authImportedBackupActionFailed
                    : t.authImportedBackupAccountChoice,
                {
                  account: displayedAccountLabel,
                }
              )
            : webOAuthError
      }
      onClearError={requiresAccountDecision ? undefined : onClearWebOAuthError}
      suspendSessionCompletion={requiresAccountDecision}
      recoveryAction={
        isLegacyQueueRecovery
          ? {
              confirmLabel: t.authRecoverLegacyChanges || "Recover changes with this account",
              cancelLabel: t.authUseDifferentAccount || "Use a different account",
              onConfirm: () => {
                window.dispatchEvent(new Event(LEGACY_OFFLINE_QUEUE_RECOVERY_EVENT));
              },
              onCancel: () => {
                window.dispatchEvent(new Event(LEGACY_OFFLINE_QUEUE_CANCEL_EVENT));
              },
            }
          : isImportedBackupClaim
            ? {
                confirmLabel:
                  importedBackupAccountClaim?.state === "save-failed"
                    ? t.retry
                    : interpolate(t.authAddImportedBackupToAccount, {
                        account: displayedAccountLabel,
                      }),
                cancelLabel:
                  importedBackupAccountClaim?.state === "save-failed"
                    ? t.continue
                    : t.authKeepImportedBackupOnDevice ||
                      "Keep only on this device and sign out",
                pending: accountDecisionPending,
                tone: "choice" as const,
                onConfirm: () => {
                  dispatchImportedBackupDecision(
                    AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT
                  );
                },
                onCancel: () => {
                  dispatchImportedBackupDecision(
                    importedBackupAccountClaim?.state === "save-failed"
                      ? AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT
                      : AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT
                  );
                },
              }
            : undefined
      }
    />
  );
}
