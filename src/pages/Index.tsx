import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { NavV2Orchestrator } from "@/components/navigation-v2/NavV2Orchestrator";
import {
  getModalToggle,
  useAppStore,
  useUserDataStore,
  useHydrateUserData,
  useHydrateGamification,
} from "@/stores";
import { useAppLifecycle } from "@/hooks/useAppLifecycle";
import { useDateTracking } from "@/hooks/useDateTracking";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { useReminderMigration } from "@/hooks/useReminderMigration";
import { useEmotionSync } from "@/hooks/useEmotionSync";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { useTelegramGradeSyncRuntime } from "@/hooks/useTelegramGradeSyncRuntime";
import { useV2FullscreenSurface } from "@/hooks/useV2FullscreenSurface";
import { useAdGracePeriod } from "@/hooks/useAdGracePeriod";
import { useNotificationSetup } from "@/hooks/useNotificationSetup";
import { useChallengeHandlers } from "@/hooks/useChallengeHandlers";
import { useFocusHandlers } from "@/hooks/useFocusHandlers";
import { useMoodHandlers } from "@/hooks/useMoodHandlers";
import { useGratitudeHandlers } from "@/hooks/useGratitudeHandlers";
import { useSettingsHandlers } from "@/hooks/useSettingsHandlers";
import { OfflineBanner } from "@/components/OfflineBanner";
import { StorageErrorBanner } from "@/components/StorageErrorBanner";
import { AuthGate } from "@/components/AuthGate";
import { useThemeStore } from "@/stores/themeStore";
import { useInnerWorld } from "@/hooks/useInnerWorld";
import { useGamification } from "@/hooks/useGamification";
import { AdProvider } from "@/contexts/AdContext";
import { supabase } from "@/lib/supabaseClient";
import { getChallenges, getBadges } from "@/lib/challengeStorage";
import {
  deriveCurrentProductAdEntitlement,
  isEmotionallyProtectedOnLocalDate,
} from "@/lib/adEligibility";
import { IS_ADMOB_QA_TEST_MODE } from "@/lib/env";
import { getToday } from "@/lib/utils";
const DesktopDownloadPage = lazy(() =>
  import("./DesktopDownloadPage").then((m) => ({ default: m.DesktopDownloadPage }))
);
const HabitStickerPreview = import.meta.env.DEV
  ? lazy(() => import("./__dev/HabitStickerPreview"))
  : null;

const PUBLIC_ROUTE_PATHS = new Set(["/desktop"]);
const DEV_PREVIEW_ROUTE_PATHS = new Set(["/__dev/habit-sticker"]);
const setShowWidgetSettings = getModalToggle("showWidgetSettings");
type ChallengeList = ReturnType<typeof getChallenges>;
type BadgeList = ReturnType<typeof getBadges>;

function getCurrentAppPath(): string {
  if (typeof window === "undefined") return "/";

  const base = (import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  const pathname = window.location.pathname;
  const rawAppPath =
    base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname;
  return rawAppPath.length > 1 && rawAppPath.endsWith("/") ? rawAppPath.slice(0, -1) : rawAppPath;
}

function isPublicRouteLocation(): boolean {
  const appPath = getCurrentAppPath();
  return PUBLIC_ROUTE_PATHS.has(appPath);
}

function isDevPreviewRouteLocation(): boolean {
  if (!import.meta.env.DEV) return false;
  const appPath = getCurrentAppPath();
  return DEV_PREVIEW_ROUTE_PATHS.has(appPath);
}

function PublicRouteFallback({ label }: { label: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-[var(--app-viewport-height)] items-center justify-center bg-background px-4 py-10 text-foreground"
    >
      <div className="inline-flex min-h-[44px] items-center gap-3 rounded-2xl border border-border/50 bg-card/75 px-4 py-3 text-sm font-semibold text-muted-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full bg-primary motion-safe:animate-pulse"
        />
        <span>{label}</span>
      </div>
    </main>
  );
}

function DesktopDownloadRouteFallback() {
  return <PublicRouteFallback label="Opening ZenFlow Desktop..." />;
}

function DevPreviewRouteFallback() {
  return <PublicRouteFallback label="Opening preview..." />;
}

/**
 * Index - V2 app shell selector.
 *
 * The normal app root now boots V2. Keep this shell light so public root,
 * direct V2 routes, desktop runtime, PWA, and native WebViews share one entry.
 */
export function Index() {
  const publicRoute = useMemo(isPublicRouteLocation, []);
  const devPreviewRoute = useMemo(isDevPreviewRouteLocation, []);

  if (publicRoute) {
    return (
      <Suspense fallback={<DesktopDownloadRouteFallback />}>
        <DesktopDownloadPage />
      </Suspense>
    );
  }

  if (devPreviewRoute && HabitStickerPreview) {
    return (
      <Suspense fallback={<DevPreviewRouteFallback />}>
        <HabitStickerPreview />
      </Suspense>
    );
  }

  return <IndexV2Impl />;
}

const V2_REWARDS_ENABLED = false;

function IndexV2Impl() {
  // V2 owns the app boot contract: native splash handoff, premium web loading,
  // data hydration, and auth/onboarding gates.
  useV2FullscreenSurface();
  useAppLifecycle();
  useDateTracking();
  useHydrateUserData();
  useSessionTimeout(!!supabase);
  useReminderMigration();
  useEmotionSync();

  const challengesRef = useRef<ChallengeList | null>(null);
  const badgesRef = useRef<BadgeList | null>(null);
  const setChallenges = useCallback<Dispatch<SetStateAction<ChallengeList>>>((next) => {
    const current = challengesRef.current ?? getChallenges();
    challengesRef.current = typeof next === "function" ? next(current) : next;
  }, []);
  const setBadges = useCallback<Dispatch<SetStateAction<BadgeList>>>((next) => {
    const current = badgesRef.current ?? getBadges();
    badgesRef.current = typeof next === "function" ? next(current) : next;
  }, []);
  const moods = useUserDataStore((s) => s.moods);
  const habits = useUserDataStore((s) => s.habits);
  const focusSessions = useUserDataStore((s) => s.focusSessions);
  const gratitudeEntries = useUserDataStore((s) => s.gratitudeEntries);
  const userName = useUserDataStore((s) => s.userName);
  const userNameCustom = useUserDataStore((s) => s.userNameCustom);
  const reminders = useUserDataStore((s) => s.reminders);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const isLoadingUserData = useUserDataStore((s) => s.isLoading);
  const privacy = useUserDataStore((s) => s.privacy);
  const currentDate = useAppStore((s) => s.currentDate) || getToday();
  const accountBoundaryInProgress = useAppStore((s) => s.isAccountBoundaryInProgress);
  const emotionProtectedToday = useMemo(
    () => isEmotionallyProtectedOnLocalDate(moods, currentDate),
    [currentDate, moods],
  );
  const adEntitlement = deriveCurrentProductAdEntitlement({
    accountBoundaryInProgress,
    qaTestEligibility: IS_ADMOB_QA_TEST_MODE,
  });
  const emptyScheduleEvents = useMemo(() => [], []);
  const { handleNameChange, handlePrivacyChange, handleRemindersChange, handleResetData } =
    useSettingsHandlers(emptyScheduleEvents);
  const {
    world: innerWorld,
    isLoading: isLoadingInnerWorld,
    earnTreats,
    plantSeed,
    waterPlants,
    attractCreature,
    feedCreatures,
  } = useInnerWorld();
  const { awardXp } = useGamification({ enabled: V2_REWARDS_ENABLED });
  useHydrateGamification({ awardXp, earnTreats, plantSeed, waterPlants });
  const isLoading = isLoadingUserData || isLoadingInnerWorld;
  const adGraceComplete = useAdGracePeriod({
    isLoading,
    hasExistingData:
      moods.length > 0 || habits.length > 0 || focusSessions.length > 0 || gratitudeEntries.length > 0,
    localDate: currentDate,
  });

  useAuthSession(isLoading);
  useDeepLinkHandler({ handleDiaryDeepLinks: false });
  useTelegramGradeSyncRuntime();

  const { checkForFeatureUnlocks, updateChallengeProgress } = useChallengeHandlers({
    safeMoods: moods,
    safeHabits: habits,
    safeFocusSessions: focusSessions,
    safeGratitudeEntries: gratitudeEntries,
    currentActiveStreak: innerWorld.currentActiveStreak,
    setChallenges,
    setBadges,
  });

  const { handleAddMood, handleQuickMood } = useMoodHandlers({
    updateChallengeProgress,
    rewardsEnabled: V2_REWARDS_ENABLED,
  });
  useNotificationSetup({ handleQuickMood });
  const { handleAddGratitude } = useGratitudeHandlers({
    earnTreats,
    attractCreature,
    feedCreatures,
    updateChallengeProgress,
    rewardsEnabled: V2_REWARDS_ENABLED,
  });
  const { handleCompleteFocusSession, handleMindfulMomentComplete } = useFocusHandlers({
    earnTreats,
    updateChallengeProgress,
    checkForFeatureUnlocks,
    rewardsEnabled: V2_REWARDS_ENABLED,
  });
  const settingsControls = useMemo(
    () => ({
      userName,
      userNameCustom,
      onNameChange: handleNameChange,
      onResetData: handleResetData,
      reminders,
       onRemindersChange: handleRemindersChange,
      habits,
      moods,
      focusSessions,
      gratitudeEntries,
      privacy,
      onPrivacyChange: handlePrivacyChange,
      onOpenWidgetSettings: () => setShowWidgetSettings(true),
    }),
    [
      focusSessions,
      gratitudeEntries,
      habits,
      handleNameChange,
      handlePrivacyChange,
      handleResetData,
      moods,
      privacy,
      reminders,
       handleRemindersChange,
      userName,
      userNameCustom,
    ]
  );

  return (
    <>
      <OfflineBanner />
      <StorageErrorBanner />
      <AuthGate isLoading={isLoading} splashTheme={appliedTheme}>
        <AdProvider
          adConsent={privacy.adConsent === true}
          adAgeEligibility={privacy.adAgeEligibility ?? "unknown"}
          adEntitlement={adEntitlement}
          emotionProtectedToday={emotionProtectedToday}
          adGraceComplete={adGraceComplete}
        >
          <NavV2Orchestrator
            onAddMood={handleAddMood}
            onAddGratitude={handleAddGratitude}
            onCompleteFocusSession={handleCompleteFocusSession}
            onMindfulMomentComplete={handleMindfulMomentComplete}
            settingsControls={settingsControls}
          />
        </AdProvider>
      </AuthGate>
    </>
  );
}

export default Index;
