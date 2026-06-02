import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useDesignFlag } from "@/hooks/useDesignFlag";
import { NavV2Orchestrator } from "@/components/navigation-v2/NavV2Orchestrator";
import { getModalToggle, useUserDataStore, useHydrateUserData } from "@/stores";
import { useAppLifecycle } from "@/hooks/useAppLifecycle";
import { useDateTracking } from "@/hooks/useDateTracking";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useTelegramGradeSyncRuntime } from "@/hooks/useTelegramGradeSyncRuntime";
import { useChallengeHandlers } from "@/hooks/useChallengeHandlers";
import { useMoodHandlers } from "@/hooks/useMoodHandlers";
import { useGratitudeHandlers } from "@/hooks/useGratitudeHandlers";
import { useSettingsHandlers } from "@/hooks/useSettingsHandlers";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AuthGate } from "@/components/AuthGate";
import { useThemeStore } from "@/stores/themeStore";
import { useInnerWorld } from "@/hooks/useInnerWorld";
import { useGamification } from "@/hooks/useGamification";
import { AdProvider } from "@/contexts/AdContext";
import { canInitializeRewardedAds } from "@/lib/privacyConsent";
import { getChallenges, getBadges } from "@/lib/challengeStorage";
import { FORCE_NAV_V2, IS_DESKTOP_RUNTIME } from "@/lib/env";

const IndexV1Impl = lazy(() => import("./IndexV1Impl"));
const DesktopDownloadPage = lazy(() =>
  import("./DesktopDownloadPage").then((m) => ({ default: m.DesktopDownloadPage })),
);

const NAV_V2_ROUTE_PATHS = new Set(["/orb", "/habits", "/diary", "/settings"]);
const PUBLIC_ROUTE_PATHS = new Set(["/desktop"]);
const setShowWidgetSettings = getModalToggle("showWidgetSettings");
type ChallengeList = ReturnType<typeof getChallenges>;
type BadgeList = ReturnType<typeof getBadges>;

interface NavV2ShellDecision {
  desktopRuntime: boolean;
  forceNavV2: boolean;
  designFlag: boolean;
  queryOverride: boolean;
  pathOverride: boolean;
}

export function shouldUseNavV2Shell(decision: NavV2ShellDecision): boolean {
  return (
    decision.desktopRuntime ||
    decision.forceNavV2 ||
    decision.designFlag ||
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

/**
 * Index - V1/V2 shell selector.
 *
 * Keep this shell light: V2 routes should not parse the full V1 orchestrator
 * during startup, because Chrome reports that parse/compile work as boot LoAF.
 * V1 stays visually unchanged and is loaded as its own chunk when selected.
 */
export function Index() {
  const publicRoute = useMemo(isPublicRouteLocation, []);
  const navV2Flag = useDesignFlag("design.nav.v2");
  const navV2QueryOverride = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("nav") === "v2";
  }, []);

  const navV2PathOverride = useMemo(isNavV2RouteLocation, []);

  if (publicRoute) {
    return (
      <Suspense fallback={null}>
        <DesktopDownloadPage />
      </Suspense>
    );
  }

  if (
    shouldUseNavV2Shell({
      desktopRuntime: IS_DESKTOP_RUNTIME,
      forceNavV2: FORCE_NAV_V2,
      designFlag: navV2Flag,
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
  useTelegramGradeSyncRuntime();

  const { updateChallengeProgress } = useChallengeHandlers({
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
            settingsControls={settingsControls}
          />
        </AdProvider>
      </AuthGate>
    </>
  );
}

export default Index;
