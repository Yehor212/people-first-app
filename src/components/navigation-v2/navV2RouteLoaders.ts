import { lazy } from "react";
import { NAV_V2_PAGES, type NavV2Page } from "@/hooks/useNavigationV2";
import { logger } from "@/lib/logger";

const loadOrbPage = () =>
  import("@/pages/nav-v2/OrbPage").then((module) => ({ default: module.OrbPage }));
const loadHabitsPage = () =>
  import("@/pages/nav-v2/HabitsPage").then((module) => ({ default: module.HabitsPage }));
const loadDiaryPage = () =>
  import("@/pages/nav-v2/DiaryPage").then((module) => ({ default: module.DiaryPage }));
const loadPlanningPage = () =>
  import("@/pages/nav-v2/planning/PlanningPage").then((module) => ({
    default: module.PlanningPage,
  }));
const loadSettingsPage = () =>
  import("@/pages/nav-v2/SettingsPage").then((module) => ({ default: module.SettingsPage }));

type RouteLoader = () => Promise<unknown>;

const NAV_V2_ROUTE_LOADERS: Record<NavV2Page, RouteLoader> = {
  orb: loadOrbPage,
  habits: loadHabitsPage,
  diary: loadDiaryPage,
  planning: loadPlanningPage,
  settings: loadSettingsPage,
};
const preloadedNavV2Routes = new Map<NavV2Page, Promise<unknown>>();

export function preloadNavV2Route(page: NavV2Page): Promise<unknown> {
  const existing = preloadedNavV2Routes.get(page);
  if (existing) return existing;

  const promise = NAV_V2_ROUTE_LOADERS[page]().catch((error) => {
    preloadedNavV2Routes.delete(page);
    logger.warn(`[NavV2] Route preload failed for ${page}`, error);
  });
  preloadedNavV2Routes.set(page, promise);
  return promise;
}

// React.lazy consumes the exact promise started by drawer preloading. Creating
// another promise for the same cached module can still expose a route fallback.
export const OrbPage = lazy(() => preloadNavV2Route("orb") as ReturnType<typeof loadOrbPage>);
export const HabitsPage = lazy(
  () => preloadNavV2Route("habits") as ReturnType<typeof loadHabitsPage>
);
export const DiaryPage = lazy(() => preloadNavV2Route("diary") as ReturnType<typeof loadDiaryPage>);
export const PlanningPage = lazy(
  () => preloadNavV2Route("planning") as ReturnType<typeof loadPlanningPage>
);
export const SettingsPage = lazy(
  () => preloadNavV2Route("settings") as ReturnType<typeof loadSettingsPage>
);

export function scheduleNavV2RoutePreload(activePage: NavV2Page): () => void {
  if (typeof window === "undefined") return () => undefined;

  let cancelled = false;
  let idleId: number | null = null;
  let timerId: number | null = null;
  const pendingPages = Array.from(new Set<NavV2Page>(["settings", ...NAV_V2_PAGES])).filter(
    (page) => page !== activePage
  );
  const requestIdle = window.requestIdleCallback;
  const cancelIdle = window.cancelIdleCallback;
  const scheduleTimeout = window.setTimeout.bind(window);
  const cancelTimeout = window.clearTimeout.bind(window);

  const scheduleNext = () => {
    if (cancelled) return;
    const page = pendingPages.shift();
    if (!page) return;

    void preloadNavV2Route(page);
    if (pendingPages.length > 0) schedule();
  };

  const schedule = () => {
    if (typeof requestIdle === "function" && typeof cancelIdle === "function") {
      idleId = requestIdle(scheduleNext, { timeout: 750 });
      return;
    }
    timerId = scheduleTimeout(scheduleNext, 120);
  };

  schedule();
  return () => {
    cancelled = true;
    if (idleId !== null) cancelIdle?.(idleId);
    if (timerId !== null) cancelTimeout(timerId);
  };
}
