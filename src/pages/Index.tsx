import { lazy, Suspense, useMemo, useState } from "react";
import { useDesignFlag } from "@/hooks/useDesignFlag";
import { NavV2Orchestrator } from "@/components/navigation-v2/NavV2Orchestrator";
import { useUserDataStore, useHydrateUserData } from "@/stores";
import { useAppLifecycle } from "@/hooks/useAppLifecycle";
import { useDateTracking } from "@/hooks/useDateTracking";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useTelegramGradeSyncRuntime } from "@/hooks/useTelegramGradeSyncRuntime";
import { useChallengeHandlers } from "@/hooks/useChallengeHandlers";
import { useMoodHandlers } from "@/hooks/useMoodHandlers";
import { useGratitudeHandlers } from "@/hooks/useGratitudeHandlers";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AuthGate } from "@/components/AuthGate";
import { useThemeStore } from "@/stores/themeStore";
import { useInnerWorld } from "@/hooks/useInnerWorld";
import { getChallenges, getBadges } from "@/lib/challengeStorage";
import { FORCE_NAV_V2 } from "@/lib/env";

const IndexV1Impl = lazy(() => import("./IndexV1Impl"));
const DesktopDownloadPage = lazy(() =>
  import("./DesktopDownloadPage").then((m) => ({ default: m.DesktopDownloadPage })),
);

const NAV_V2_ROUTE_PATHS = new Set(["/orb", "/habits", "/diary", "/settings"]);
const PUBLIC_ROUTE_PATHS = new Set(["/desktop"]);

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

  if (FORCE_NAV_V2 || navV2Flag || navV2QueryOverride || navV2PathOverride) {
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

  const [, setChallenges] = useState(() => getChallenges());
  const [, setBadges] = useState(() => getBadges());
  const moods = useUserDataStore((s) => s.moods);
  const habits = useUserDataStore((s) => s.habits);
  const focusSessions = useUserDataStore((s) => s.focusSessions);
  const gratitudeEntries = useUserDataStore((s) => s.gratitudeEntries);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const isLoadingUserData = useUserDataStore((s) => s.isLoading);
  const {
    world: innerWorld,
    isLoading: isLoadingInnerWorld,
    earnTreats,
    attractCreature,
    feedCreatures,
  } = useInnerWorld();
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

  return (
    <>
      <OfflineBanner />
      <AuthGate isLoading={isLoading} splashTheme={appliedTheme}>
        <NavV2Orchestrator onAddMood={handleAddMood} onAddGratitude={handleAddGratitude} />
      </AuthGate>
    </>
  );
}

export default Index;
