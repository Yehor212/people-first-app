import { ReactNode, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, useUserDataStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { safeLocalStorageSet } from "@/lib/safeJson";
import {
  hasStoredCompletedInteractiveGates,
  isInstalledWebShell,
  isLocalDevBypassHost,
  shouldBypassDesktopInteractiveGates,
} from "@/lib/authGateRuntime";
import { SK } from "@/lib/storageKeys";
import {
  readImportedBackupLocalOnlyDecisionRevision,
  readPendingLocalBackupAccountClaim,
} from "@/storage/accountBoundaryRuntime";
import { SplashScreen, type SplashThemePreference } from "@/components/SplashScreen";
import { LanguageSelector } from "@/components/LanguageSelector";
import { PremiumLoader } from "@/components/PremiumLoader";
import { AuthGateInitErrorScreen } from "@/components/AuthGateInitErrorScreen";
import { AuthGateSignInScreen } from "@/components/AuthGateSignInScreen";
import {
  ImportedBackupDecisionSettledScreen,
  ImportedBackupLocalRecoveryScreen,
} from "@/components/AuthGateImportedBackupScreens";
import { IS_DESKTOP_RUNTIME } from "@/lib/env";
import {
  AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR,
  AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED,
  readImportedBackupAccountClaim,
} from "@/lib/authErrors";

interface AuthGateProps {
  isLoading: boolean;
  splashTheme?: SplashThemePreference;
  children: ReactNode;
}

export {
  hasStoredCompletedInteractiveGates,
  isInstalledWebShell,
  isLocalDevBypassHost,
  shouldBypassDesktopInteractiveGates,
} from "@/lib/authGateRuntime";

/**
 * Orchestrates the app's initialization and account gates.
 * Renders splash, language, and auth screens or children when those gates pass.
 *
 * Reads all gate state from Zustand stores directly.
 */
export function AuthGate({ isLoading, splashTheme, children }: AuthGateProps) {
  const { t } = useLanguage();
  const [, setImportedBackupMarkerRevision] = useState(0);
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

  useEffect(() => {
    const accountGatePassed =
      hasValidSession === true || authGateChecked || authBypassFlag;
    if (!hasSelectedLanguage || !accountGatePassed || onboardingComplete) return;

    if (!safeLocalStorageSet("zenflow-onboarding-complete", true)) {
      logger.warn("[AuthGate] Failed to persist removed onboarding compatibility state");
    }
    try {
      setOnboardingComplete(true);
    } catch (error) {
      logger.error("[AuthGate] Failed to persist removed onboarding state:", error);
    }
  }, [
    authBypassFlag,
    authGateChecked,
    hasSelectedLanguage,
    hasValidSession,
    onboardingComplete,
    setOnboardingComplete,
  ]);

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
    return <AuthGateInitErrorScreen message={initializationState.error} />;
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
      <ImportedBackupLocalRecoveryScreen
        recoveryRef={importedBackupRecoveryRef}
        onRecoverySucceeded={() => setImportedBackupMarkerRevision((revision) => revision + 1)}
      />
    );
  }

  if (importedBackupDecisionAlreadySettled) {
    return <ImportedBackupDecisionSettledScreen settledRef={importedBackupSettledRef} />;
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
    return (
      <AuthGateSignInScreen
        isProcessingWebOAuth={isProcessingWebOAuth}
        webOAuthError={webOAuthError}
        isLegacyQueueRecovery={isLegacyQueueRecovery}
        isImportedBackupClaim={isImportedBackupClaim}
        importedBackupAccountClaim={importedBackupAccountClaim}
        displayedAccountLabel={importedBackupAccountLabel || t.account}
        requiresAccountDecision={requiresMandatoryAccountDecision}
        importedBackupLocalOnlyDecisionRevision={importedBackupLocalOnlyDecisionRevision}
        onAuthComplete={handleAuthComplete}
        onClearWebOAuthError={() => setWebOAuthError(null)}
      />
    );
  }

  return <>{children}</>;
}
