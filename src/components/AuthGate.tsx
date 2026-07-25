import { ReactNode, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, useUserDataStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { reloadAppSafely } from "@/lib/versionCheck";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { interpolate } from "@/lib/utils";
import { SK } from "@/lib/storageKeys";
import {
  readImportedBackupLocalOnlyDecisionRevision,
  readPendingLocalBackupAccountClaim,
} from "@/storage/accountBoundaryRuntime";
import { SplashScreen, type SplashThemePreference } from "@/components/SplashScreen";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AuthScreen } from "@/components/AuthScreen";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { PremiumLoader } from "@/components/PremiumLoader";
import { NotificationPermission } from "@/components/NotificationPermission";
import { IS_DESKTOP_RUNTIME } from "@/lib/env";
import {
  AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR,
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT,
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT,
  AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED,
  AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT,
  AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT,
  AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT,
  LEGACY_OFFLINE_QUEUE_CANCEL_EVENT,
  LEGACY_OFFLINE_QUEUE_RECOVERY_EVENT,
  readImportedBackupAccountClaim,
} from "@/lib/authErrors";

interface AuthGateProps {
  isLoading: boolean;
  splashTheme?: SplashThemePreference;
  children: ReactNode;
}

const LOCAL_DEV_BYPASS_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalDevBypassHost(hostname: string): boolean {
  return LOCAL_DEV_BYPASS_HOSTS.has(hostname);
}

export function shouldBypassDesktopInteractiveGates(
  isDesktopRuntime: boolean,
  requiresMandatoryAccountDecision = false
): boolean {
  return isDesktopRuntime && !requiresMandatoryAccountDecision;
}

export function isInstalledWebShell(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function hasStoredCompletedInteractiveGates(): boolean {
  return (
    safeLocalStorageGet<boolean>("zenflow-language-selected", false) === true &&
    safeLocalStorageGet<boolean>("zenflow-google-auth-checked", false) === true &&
    safeLocalStorageGet<boolean>("zenflow-onboarding-complete", false) === true &&
    safeLocalStorageGet<boolean>("zenflow-notification-permission-checked", false) === true
  );
}

/**
 * Orchestrates the app's initialization and onboarding gates.
 * Renders gate screens (splash, language, auth, onboarding, notifications)
 * or children when all gates pass.
 *
 * Reads all gate state from Zustand stores directly.
 */
export function AuthGate({ isLoading, splashTheme, children }: AuthGateProps) {
  const { t } = useLanguage();
  const [reloadPending, setReloadPending] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [accountDecisionPending, setAccountDecisionPending] = useState(false);
  const [, setImportedBackupMarkerRevision] = useState(0);
  const [importedBackupRecoveryError, setImportedBackupRecoveryError] = useState<string | null>(
    null
  );
  const accountDecisionPendingRef = useRef(false);
  const importedBackupRecoveryRef = useRef<HTMLDivElement | null>(null);
  const importedBackupSettledRef = useRef<HTMLDivElement | null>(null);
  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

  useEffect(() => {
    const handleImportedBackupMarkerChange = (event: StorageEvent) => {
      if (
        event.key === SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM ||
        event.key === SK.IMPORTED_BACKUP_LOCAL_ONLY_ACCESS
      ) {
        setImportedBackupMarkerRevision((revision) => revision + 1);
      }
    };
    window.addEventListener("storage", handleImportedBackupMarkerChange);
    return () => window.removeEventListener("storage", handleImportedBackupMarkerChange);
  }, []);

  // App store — single subscription with shallow comparison (was 12 individual)
  const {
    initializationState,
    loadingFadeOut,
    authBypassFlag,
    setAuthBypassFlag,
    isProcessingWebOAuth,
    webOAuthError,
    setWebOAuthError,
    hasValidSession,
    isAccountBoundaryInProgress,
    onboardingBypassFlag,
    setOnboardingBypassFlag,
  } = useAppStore(
    useShallow((s) => ({
      initializationState: s.initializationState,
      loadingFadeOut: s.loadingFadeOut,
      authBypassFlag: s.authBypassFlag,
      setAuthBypassFlag: s.setAuthBypassFlag,
      isProcessingWebOAuth: s.isProcessingWebOAuth,
      webOAuthError: s.webOAuthError,
      setWebOAuthError: s.setWebOAuthError,
      hasValidSession: s.hasValidSession,
      isAccountBoundaryInProgress: s.isAccountBoundaryInProgress,
      onboardingBypassFlag: s.onboardingBypassFlag,
      setOnboardingBypassFlag: s.setOnboardingBypassFlag,
    }))
  );

  // User data store — single subscription with shallow comparison (was 12 individual)
  const {
    hasSelectedLanguage,
    setHasSelectedLanguage,
    setUserName,
    setUserNameCustom,
    onboardingComplete,
    setOnboardingComplete,
    notificationPermissionChecked,
    setNotificationPermissionChecked,
    authGateChecked,
    setAuthGateChecked,
  } = useUserDataStore(
    useShallow((s) => ({
      hasSelectedLanguage: s.hasSelectedLanguage,
      setHasSelectedLanguage: s.setHasSelectedLanguage,
      setUserName: s.setUserName,
      setUserNameCustom: s.setUserNameCustom,
      onboardingComplete: s.onboardingComplete,
      setOnboardingComplete: s.setOnboardingComplete,
      notificationPermissionChecked: s.notificationPermissionChecked,
      setNotificationPermissionChecked: s.setNotificationPermissionChecked,
      authGateChecked: s.authGateChecked,
      setAuthGateChecked: s.setAuthGateChecked,
    }))
  );

  // ── Gate handlers ──

  const handleLanguageSelected = () => {
    setHasSelectedLanguage(true);
  };

  const handleAuthComplete = (userData: { name: string; email: string }) => {
    logger.log("[AuthGate] Auth completed");
    // CRITICAL: Set synchronous bypass flag FIRST (immediate UI update)
    // This ensures we skip AuthScreen immediately, before IndexedDB writes
    setAuthBypassFlag(true);
    // Then set persistent values (async IndexedDB)
    setUserName(userData.name);
    setUserNameCustom(false);
    setAuthGateChecked(true);
  };

  const handleOnboardingComplete = (result: { skipped?: boolean; modules?: string[] }) => {
    logger.log("[AuthGate] handleOnboardingComplete called", result);
    // CRITICAL: Set synchronous bypass flag FIRST (immediate UI update)
    setOnboardingBypassFlag(true);
    // Direct localStorage write (survives page refresh even if IndexedDB fails)
    safeLocalStorageSet("zenflow-onboarding-complete", true);
    // Zustand + IndexedDB persistence (normal async path)
    try {
      setOnboardingComplete(true);
    } catch (error) {
      logger.error("[AuthGate] Error in handleOnboardingComplete:", error);
    }
  };

  const handleNotificationPermissionComplete = () => {
    setNotificationPermissionChecked(true);
  };

  // ── Gate screens (order matters — first matching gate wins) ──

  const canOpenInstalledWebShell = isInstalledWebShell() && hasStoredCompletedInteractiveGates();
  const durableImportedBackupClaim = readPendingLocalBackupAccountClaim();
  const importedBackupAccountClaim = readImportedBackupAccountClaim(webOAuthError);
  const importedBackupAccountLabel = importedBackupAccountClaim?.accountLabel ?? null;
  const importedBackupLocalOnlyDecisionRevision =
    readImportedBackupLocalOnlyDecisionRevision();
  const importedBackupLocalOnlyAccess = importedBackupLocalOnlyDecisionRevision !== null;
  const importedBackupDecisionAlreadySettled =
    webOAuthError === AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED;
  const isLegacyQueueRecovery = webOAuthError === AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR;
  const isImportedBackupClaim = importedBackupAccountLabel !== null;
  const isImportedBackupLocalRecoveryRequired =
    durableImportedBackupClaim.status !== "none" &&
    importedBackupAccountClaim === null &&
    !importedBackupLocalOnlyAccess;
  const requiresMandatoryAccountDecision =
    isLegacyQueueRecovery ||
    isImportedBackupClaim ||
    isImportedBackupLocalRecoveryRequired ||
    importedBackupDecisionAlreadySettled;

  useEffect(() => {
    if (isImportedBackupLocalRecoveryRequired) {
      importedBackupRecoveryRef.current?.focus();
    } else if (importedBackupDecisionAlreadySettled) {
      importedBackupSettledRef.current?.focus();
    }
  }, [importedBackupDecisionAlreadySettled, isImportedBackupLocalRecoveryRequired]);

  // ── LOCAL DEV BYPASS: ?dev=true skips all gates on Vite dev and localhost preview only ──
  // Keep this return below every hook so the hook order is identical across renders.
  const isLocalPreviewBypass =
    typeof window !== "undefined" && isLocalDevBypassHost(window.location.hostname);
  const isDevBypass =
    searchParams?.get("dev") === "true" && (import.meta.env.DEV || isLocalPreviewBypass);
  if (isDevBypass) {
    return <>{children}</>;
  }

  const shouldOpenInstalledWebShellDuringStartup =
    canOpenInstalledWebShell &&
    !requiresMandatoryAccountDecision &&
    (initializationState.isInitializing || isLoading);

  if (initializationState.error) {
    return (
      <div className="flex items-center justify-center min-h-screen zen-gradient-hero p-4">
        <div className="max-w-md bg-card rounded-3xl p-6 zen-shadow-card space-y-4">
          <h2 className="text-2xl font-bold text-destructive">{t.initializationError}</h2>
          <p className="text-muted-foreground">{initializationState.error}</p>
          <button
            onClick={async () => {
              if (reloadPending) return;
              setReloadPending(true);
              setReloadError(null);
              try {
                await reloadAppSafely();
              } catch (error) {
                logger.warn("[AuthGate] Reload blocked until durable state is saved:", error);
                setReloadError(
                  t.updateRequiredRefreshFailed ||
                    "Your latest changes could not be confirmed as saved. Try again."
                );
              } finally {
                setReloadPending(false);
              }
            }}
            disabled={reloadPending}
            aria-busy={reloadPending}
            className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-semibold hover:opacity-90 motion-safe:transition-opacity"
          >
            {t.tryAgain || "Try Again"}
          </button>
          {reloadError ? (
            <p role="alert" aria-label={reloadError} className="text-sm text-destructive">
              {reloadError}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (isAccountBoundaryInProgress) {
    return (
      <SplashScreen
        loadingFadeOut={false}
        subtitle={t.initializingApp || "Preparing your zen space..."}
        theme={splashTheme}
        instant
      />
    );
  }

  if (isImportedBackupLocalRecoveryRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div
          ref={importedBackupRecoveryRef}
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
              setImportedBackupRecoveryError(null);
              window.dispatchEvent(
                new CustomEvent(AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT, {
                  detail: {
                    onSettled: (success: boolean) => {
                      if (success) {
                        setImportedBackupMarkerRevision((revision) => revision + 1);
                      } else {
                        setImportedBackupRecoveryError(
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
          {importedBackupRecoveryError ? (
            <p role="alert" className="text-sm text-destructive">
              {importedBackupRecoveryError}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (importedBackupDecisionAlreadySettled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div
          ref={importedBackupSettledRef}
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

  if (shouldOpenInstalledWebShellDuringStartup) {
    return <>{children}</>;
  }

  if (initializationState.isInitializing && !requiresMandatoryAccountDecision) {
    return (
      <SplashScreen
        loadingFadeOut={loadingFadeOut}
        subtitle={t.initializingApp || "Preparing your zen space..."}
        theme={splashTheme}
      />
    );
  }

  if (shouldBypassDesktopInteractiveGates(IS_DESKTOP_RUNTIME, requiresMandatoryAccountDecision)) {
    return <>{children}</>;
  }

  if (isLoading && !requiresMandatoryAccountDecision) {
    if (splashTheme) {
      return (
        <SplashScreen
          loadingFadeOut={false}
          subtitle={t.initializingApp || "Preparing your zen space..."}
          theme={splashTheme}
          instant
        />
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <PremiumLoader size="lg" />
      </div>
    );
  }

  if (!hasSelectedLanguage) {
    return <LanguageSelector onComplete={handleLanguageSelected} />;
  }

  // Auth screen — check both IndexedDB flag and synchronous bypass
  // hasValidSession: null = checking, true = has session, false = no session
  if (!authGateChecked && !authBypassFlag && hasValidSession === false) {
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

    const requiresAccountDecision = requiresMandatoryAccountDecision;
    const displayedAccountLabel = importedBackupAccountLabel || t.account;
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
        onComplete={handleAuthComplete}
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
        onClearError={requiresAccountDecision ? undefined : () => setWebOAuthError(null)}
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

  if (!onboardingComplete && !onboardingBypassFlag) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  if (!notificationPermissionChecked) {
    return <NotificationPermission onComplete={handleNotificationPermissionComplete} />;
  }

  return <>{children}</>;
}
