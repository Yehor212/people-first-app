import { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, useUserDataStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { safeLocalStorageSet } from "@/lib/safeJson";
import { SplashScreen, type SplashThemePreference } from "@/components/SplashScreen";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AuthScreen } from "@/components/AuthScreen";
import { WelcomeTutorial } from "@/components/WelcomeTutorial";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { PremiumLoader } from "@/components/PremiumLoader";
import { NotificationPermission } from "@/components/NotificationPermission";
import { IS_DESKTOP_RUNTIME } from "@/lib/env";

interface AuthGateProps {
  isLoading: boolean;
  splashTheme?: SplashThemePreference;
  children: ReactNode;
}

const LOCAL_DEV_BYPASS_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalDevBypassHost(hostname: string): boolean {
  return LOCAL_DEV_BYPASS_HOSTS.has(hostname);
}

export function shouldBypassDesktopInteractiveGates(isDesktopRuntime: boolean): boolean {
  return isDesktopRuntime;
}

/**
 * Orchestrates the app's initialization and onboarding gates.
 * Renders gate screens (splash, language, auth, tutorial, onboarding, notifications)
 * or children when all gates pass.
 *
 * Reads all gate state from Zustand stores directly.
 */
export function AuthGate({ isLoading, splashTheme, children }: AuthGateProps) {
  const { t } = useLanguage();
  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

  // App store — single subscription with shallow comparison (was 12 individual)
  const {
    initializationState, loadingFadeOut,
    authBypassFlag, setAuthBypassFlag,
    isProcessingWebOAuth, webOAuthError, setWebOAuthError, hasValidSession,
    tutorialBypassFlag, setTutorialBypassFlag,
    onboardingBypassFlag, setOnboardingBypassFlag,
  } = useAppStore(useShallow((s) => ({
    initializationState: s.initializationState,
    loadingFadeOut: s.loadingFadeOut,
    authBypassFlag: s.authBypassFlag,
    setAuthBypassFlag: s.setAuthBypassFlag,
    isProcessingWebOAuth: s.isProcessingWebOAuth,
    webOAuthError: s.webOAuthError,
    setWebOAuthError: s.setWebOAuthError,
    hasValidSession: s.hasValidSession,
    tutorialBypassFlag: s.tutorialBypassFlag,
    setTutorialBypassFlag: s.setTutorialBypassFlag,
    onboardingBypassFlag: s.onboardingBypassFlag,
    setOnboardingBypassFlag: s.setOnboardingBypassFlag,
  })));

  // User data store — single subscription with shallow comparison (was 12 individual)
  const {
    hasSelectedLanguage, setHasSelectedLanguage,
    setUserName, setUserNameCustom,
    tutorialComplete, setTutorialComplete,
    onboardingComplete, setOnboardingComplete,
    notificationPermissionChecked, setNotificationPermissionChecked,
    googleAuthChecked, setGoogleAuthChecked,
  } = useUserDataStore(useShallow((s) => ({
    hasSelectedLanguage: s.hasSelectedLanguage,
    setHasSelectedLanguage: s.setHasSelectedLanguage,
    setUserName: s.setUserName,
    setUserNameCustom: s.setUserNameCustom,
    tutorialComplete: s.tutorialComplete,
    setTutorialComplete: s.setTutorialComplete,
    onboardingComplete: s.onboardingComplete,
    setOnboardingComplete: s.setOnboardingComplete,
    notificationPermissionChecked: s.notificationPermissionChecked,
    setNotificationPermissionChecked: s.setNotificationPermissionChecked,
    googleAuthChecked: s.googleAuthChecked,
    setGoogleAuthChecked: s.setGoogleAuthChecked,
  })));

  // ── Gate handlers ──

  const handleLanguageSelected = () => {
    setHasSelectedLanguage(true);
  };

  const handleGoogleAuthComplete = (userData: { name: string; email: string }) => {
    logger.log("[AuthGate] Google auth completed");
    // CRITICAL: Set synchronous bypass flag FIRST (immediate UI update)
    // This ensures we skip AuthScreen immediately, before IndexedDB writes
    setAuthBypassFlag(true);
    // Then set persistent values (async IndexedDB)
    setUserName(userData.name);
    setUserNameCustom(false);
    setGoogleAuthChecked(true);
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

  // ── LOCAL DEV BYPASS: ?dev=true skips all gates on Vite dev and localhost preview only ──
  const isLocalPreviewBypass =
    typeof window !== "undefined" && isLocalDevBypassHost(window.location.hostname);
  const isDevBypass =
    searchParams?.get("dev") === "true" && (import.meta.env.DEV || isLocalPreviewBypass);
  if (isDevBypass) {
    return <>{children}</>;
  }

  // ── Gate screens (order matters — first matching gate wins) ──

  if (initializationState.isInitializing) {
    return (
      <SplashScreen
        loadingFadeOut={loadingFadeOut}
        subtitle={t.initializingApp || "Preparing your zen space..."}
        theme={splashTheme}
      />
    );
  }

  if (initializationState.error) {
    return (
      <div className="flex items-center justify-center min-h-screen zen-gradient-hero p-4">
        <div className="max-w-md bg-card rounded-3xl p-6 zen-shadow-card space-y-4">
          <h2 className="text-2xl font-bold text-destructive">{t.initializationError}</h2>
          <p className="text-muted-foreground">{initializationState.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-semibold hover:opacity-90 motion-safe:transition-opacity"
          >
            {t.tryAgain || "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
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

  if (shouldBypassDesktopInteractiveGates(IS_DESKTOP_RUNTIME)) {
    return <>{children}</>;
  }

  if (!hasSelectedLanguage) {
    return <LanguageSelector onComplete={handleLanguageSelected} />;
  }

  // Google Auth screen — check both IndexedDB flag and synchronous bypass
  // hasValidSession: null = checking, true = has session, false = no session
  if (!googleAuthChecked && !authBypassFlag && hasValidSession === false) {
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

    return (
      <AuthScreen
        onComplete={handleGoogleAuthComplete}
        webOAuthError={webOAuthError}
        onClearError={() => setWebOAuthError(null)}
      />
    );
  }

  if (!tutorialComplete && !tutorialBypassFlag) {
    return (
      <WelcomeTutorial
        onComplete={() => {
          setTutorialBypassFlag(true);
          safeLocalStorageSet("zenflow-tutorial-complete", true);
          setTutorialComplete(true);
        }}
        onSkip={() => {
          setTutorialBypassFlag(true);
          safeLocalStorageSet("zenflow-tutorial-complete", true);
          setTutorialComplete(true);
        }}
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
