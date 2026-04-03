import { ReactNode } from "react";
import { useAppStore, useUserDataStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { safeLocalStorageSet } from "@/lib/safeJson";
import { SplashScreen } from "@/components/SplashScreen";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AuthScreen } from "@/components/AuthScreen";
import { WelcomeTutorial } from "@/components/WelcomeTutorial";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { PremiumLoader } from "@/components/PremiumLoader";
import { NotificationPermission } from "@/components/NotificationPermission";

interface AuthGateProps {
  isLoading: boolean;
  children: ReactNode;
}

/**
 * Orchestrates the app's initialization and onboarding gates.
 * Renders gate screens (splash, language, auth, tutorial, onboarding, notifications)
 * or children when all gates pass.
 *
 * Reads all gate state from Zustand stores directly.
 */
export function AuthGate({ isLoading, children }: AuthGateProps) {
  const { t } = useLanguage();

  // App initialization state
  const initializationState = useAppStore((s) => s.initializationState);
  const loadingFadeOut = useAppStore((s) => s.loadingFadeOut);

  // Auth state
  const authBypassFlag = useAppStore((s) => s.authBypassFlag);
  const setAuthBypassFlag = useAppStore((s) => s.setAuthBypassFlag);
  const isProcessingWebOAuth = useAppStore((s) => s.isProcessingWebOAuth);
  const webOAuthError = useAppStore((s) => s.webOAuthError);
  const setWebOAuthError = useAppStore((s) => s.setWebOAuthError);
  const hasValidSession = useAppStore((s) => s.hasValidSession);

  // Gate bypass flags (synchronous — survive until page refresh)
  const tutorialBypassFlag = useAppStore((s) => s.tutorialBypassFlag);
  const setTutorialBypassFlag = useAppStore((s) => s.setTutorialBypassFlag);
  const onboardingBypassFlag = useAppStore((s) => s.onboardingBypassFlag);
  const setOnboardingBypassFlag = useAppStore((s) => s.setOnboardingBypassFlag);

  // User data gate state
  const hasSelectedLanguage = useUserDataStore((s) => s.hasSelectedLanguage);
  const setHasSelectedLanguage = useUserDataStore((s) => s.setHasSelectedLanguage);
  const setUserName = useUserDataStore((s) => s.setUserName);
  const setUserNameCustom = useUserDataStore((s) => s.setUserNameCustom);
  const tutorialComplete = useUserDataStore((s) => s.tutorialComplete);
  const setTutorialComplete = useUserDataStore((s) => s.setTutorialComplete);
  const onboardingComplete = useUserDataStore((s) => s.onboardingComplete);
  const setOnboardingComplete = useUserDataStore((s) => s.setOnboardingComplete);
  const notificationPermissionChecked = useUserDataStore((s) => s.notificationPermissionChecked);
  const setNotificationPermissionChecked = useUserDataStore(
    (s) => s.setNotificationPermissionChecked
  );
  const googleAuthChecked = useUserDataStore((s) => s.googleAuthChecked);
  const setGoogleAuthChecked = useUserDataStore((s) => s.setGoogleAuthChecked);

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

  // ── Gate screens (order matters — first matching gate wins) ──

  if (initializationState.isInitializing) {
    return (
      <SplashScreen
        loadingFadeOut={loadingFadeOut}
        subtitle={t.initializingApp || "Preparing your zen space..."}
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
            className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            {t.tryAgain || "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PremiumLoader size="lg" />
      </div>
    );
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
