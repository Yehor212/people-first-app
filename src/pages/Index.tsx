import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useDesignFlag } from "@/hooks/useDesignFlag";
import { NavV2Orchestrator } from "@/components/navigation-v2/NavV2Orchestrator";
import { getModalToggle, useUserDataStore, useHydrateUserData } from "@/stores";
import { useAppLifecycle } from "@/hooks/useAppLifecycle";
import { useDateTracking } from "@/hooks/useDateTracking";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { useTelegramGradeSyncRuntime } from "@/hooks/useTelegramGradeSyncRuntime";
import { useV2FullscreenSurface } from "@/hooks/useV2FullscreenSurface";
import { useChallengeHandlers } from "@/hooks/useChallengeHandlers";
import { useFocusHandlers } from "@/hooks/useFocusHandlers";
import { useMoodHandlers } from "@/hooks/useMoodHandlers";
import { useGratitudeHandlers } from "@/hooks/useGratitudeHandlers";
import { useSettingsHandlers } from "@/hooks/useSettingsHandlers";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AuthGate } from "@/components/AuthGate";
import { useThemeStore } from "@/stores/themeStore";
import { useInnerWorld } from "@/hooks/useInnerWorld";
import { useGamification } from "@/hooks/useGamification";
import { AdProvider } from "@/contexts/AdContext";
import { analytics } from "@/lib/analytics";
import { canInitializeRewardedAds } from "@/lib/privacyConsent";
import { getChallenges, getBadges } from "@/lib/challengeStorage";
import { FORCE_NAV_V2, IS_DESKTOP_RUNTIME } from "@/lib/env";
import {
  hasPendingNativeDiaryDeepLink,
  NATIVE_DIARY_DEEP_LINK_EVENT,
} from "@/lib/nativeDiaryDeepLinkSignal";

const IndexV1Impl = lazy(() => import("./IndexV1Impl"));
const DesktopDownloadPage = lazy(() =>
  import("./DesktopDownloadPage").then((m) => ({ default: m.DesktopDownloadPage })),
);
const HabitStickerPreview = import.meta.env.DEV
  ? lazy(() => import("./__dev/HabitStickerPreview"))
  : null;

const NAV_V2_ROUTE_PATHS = new Set(["/orb", "/habits", "/diary", "/planning", "/settings"]);
const PUBLIC_ROUTE_PATHS = new Set(["/desktop"]);
const DEV_PREVIEW_ROUTE_PATHS = new Set(["/__dev/habit-sticker"]);
const setShowWidgetSettings = getModalToggle("showWidgetSettings");
type ChallengeList = ReturnType<typeof getChallenges>;
type BadgeList = ReturnType<typeof getBadges>;

interface NavV2ShellDecision {
  desktopRuntime: boolean;
  forceNavV2: boolean;
  designFlag: boolean;
  nativeDiaryDeepLink: boolean;
  queryOverride: boolean;
  pathOverride: boolean;
}

export function shouldUseNavV2Shell(decision: NavV2ShellDecision): boolean {
  return (
    decision.desktopRuntime ||
    decision.forceNavV2 ||
    decision.designFlag ||
    decision.nativeDiaryDeepLink ||
    decision.queryOverride ||
    decision.pathOverride
  );
}

function getCurrentAppPath(): string {
  if (typeof window === "undefined") return "/";

  const base = (import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  const pathname = window.location.pathname;
  const rawAppPath = base && pathname.startsWith(base)
    ? pathname.slice(base.length) || "/"
    : pathname;
  return rawAppPath.length > 1 && rawAppPath.endsWith("/")
    ? rawAppPath.slice(0, -1)
    : rawAppPath;
}

function isNavV2RouteLocation(): boolean {
  const appPath = getCurrentAppPath();
  return NAV_V2_ROUTE_PATHS.has(appPath);
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

/**
 * Index - V1/V2 shell selector.
 *
 * Keep this shell light: V2 routes should not parse the full V1 orchestrator
 * during startup, because Chrome reports that parse/compile work as boot LoAF.
 * V1 stays visually unchanged and is loaded as its own chunk when selected.
 */
export function Index() {
  const publicRoute = useMemo(isPublicRouteLocation, []);
  const devPreviewRoute = useMemo(isDevPreviewRouteLocation, []);
  const navV2Flag = useDesignFlag("design.nav.v2");
  const navV2QueryOverride = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("nav") === "v2";
  }, []);

  const navV2PathOverride = useMemo(isNavV2RouteLocation, []);
  const [nativeDiaryDeepLinkOverride, setNativeDiaryDeepLinkOverride] = useState(() =>
    hasPendingNativeDiaryDeepLink(),
  );

  useEffect(() => {
    const handleNativeDiaryDeepLink = () => setNativeDiaryDeepLinkOverride(true);
    window.addEventListener(NATIVE_DIARY_DEEP_LINK_EVENT, handleNativeDiaryDeepLink);
    if (hasPendingNativeDiaryDeepLink()) {
      handleNativeDiaryDeepLink();
    }
    return () => window.removeEventListener(NATIVE_DIARY_DEEP_LINK_EVENT, handleNativeDiaryDeepLink);
  }, []);

  if (publicRoute) {
    return (
      <Suspense fallback={null}>
        <DesktopDownloadPage />
      </Suspense>
    );
  }

  if (devPreviewRoute && HabitStickerPreview) {
    return (
      <Suspense fallback={null}>
        <HabitStickerPreview />
      </Suspense>
    );
  }

  if (
    shouldUseNavV2Shell({
      desktopRuntime: IS_DESKTOP_RUNTIME,
      forceNavV2: FORCE_NAV_V2,
      designFlag: navV2Flag,
      nativeDiaryDeepLink: nativeDiaryDeepLinkOverride,
      queryOverride: navV2QueryOverride,
      pathOverride: navV2PathOverride,
    })
  ) {
    return <IndexV2Impl />;
  }

  return (
    <Suspense fallback={null}>
      <IndexV1Impl />
    </Suspense>
  );
}

function IndexV2Impl() {
  // V2 must use the same boot contract as V1: native splash handoff,
  // premium web loading screen, data hydration, and auth/onboarding gates.
  useV2FullscreenSurface();
  useAppLifecycle();
  useDateTracking();
  useHydrateUserData();

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
  const reminders = useUserDataStore((s) => s.reminders);
  const setReminders = useUserDataStore((s) => s.setReminders);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const isLoadingUserData = useUserDataStore((s) => s.isLoading);
  const privacy = useUserDataStore((s) => s.privacy);
  const setPrivacy = useUserDataStore((s) => s.setPrivacy);
  useEffect(() => {
    analytics.init(privacy);
  }, [privacy]);

  const emptyScheduleEvents = useMemo(() => [], []);
  const { handleNameChange, handleResetData } = useSettingsHandlers(emptyScheduleEvents);
  const {
    world: innerWorld,
    isLoading: isLoadingInnerWorld,
    earnTreats,
    attractCreature,
    feedCreatures,
  } = useInnerWorld();
  const { awardXp } = useGamification();
  const isLoading = isLoadingUserData || isLoadingInnerWorld;

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

  const { handleAddMood } = useMoodHandlers({
    updateChallengeProgress,
  });
  const { handleAddGratitude } = useGratitudeHandlers({
    earnTreats,
    attractCreature,
    feedCreatures,
    updateChallengeProgress,
  });
  const { handleCompleteFocusSession, handleMindfulMomentComplete } = useFocusHandlers({
    earnTreats,
    updateChallengeProgress,
    checkForFeatureUnlocks,
  });
  const settingsControls = useMemo(
    () => ({
      userName,
      onNameChange: handleNameChange,
      onResetData: handleResetData,
      reminders,
      onRemindersChange: setReminders,
      habits,
      moods,
      focusSessions,
      gratitudeEntries,
      privacy,
      onPrivacyChange: setPrivacy,
      onOpenWidgetSettings: () => setShowWidgetSettings(true),
    }),
    [
      focusSessions,
      gratitudeEntries,
      habits,
      handleNameChange,
      handleResetData,
      moods,
      privacy,
      reminders,
      setPrivacy,
      setReminders,
      userName,
    ],
  );

  return (
    <>
      <OfflineBanner />
      <AuthGate isLoading={isLoading} splashTheme={appliedTheme}>
        <AdProvider
          onEarnTreats={(amount) => earnTreats("ad", amount, "Ad reward")}
          onEarnXp={() => awardXp("habit")}
          adConsent={canInitializeRewardedAds(privacy)}
          isPremium={false}
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
