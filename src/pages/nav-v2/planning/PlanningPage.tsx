import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { cn, formatDate } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIStore, useUserDataStore } from "@/stores";
import { generateHabitScheduleEvents, mergeScheduleEvents } from "@/lib/habitScheduleSync";
import { reportDurablePersistenceFailure } from "@/lib/durablePersistenceFailure";
import { persistManualScheduleEvents as commitManualScheduleEvents } from "@/features/automation";
import { logger } from "@/lib/logger";
import { shouldAnimate } from "@/lib/animationUtils";
import type { FocusSession, ScheduleEvent } from "@/types";
import type { FocusCommitBoundary } from "@/types/focusTimerTypes";
import { PlanningActionPanel } from "./PlanningActionPanel";
import { PlanningBridgeActions } from "./PlanningBridgeActions";
import { PlanningDayPulse } from "./PlanningDayPulse";
import { PlanningModeRail } from "./PlanningModeRail";
import { PlanningOverview } from "./PlanningOverview";
import { PlanningReviewLane } from "./PlanningReviewLane";
import { derivePlanningFeatureModel, type PlanningMode } from "./planningFeatureModel";
import { resolveInitialPlanningDate } from "./planningDates";

const ScheduleTimeline = lazyWithRetry(
  () => import("@/components/ScheduleTimeline").then((m) => ({ default: m.ScheduleTimeline })),
  "ScheduleTimeline"
);
const FocusTimer = lazyWithRetry(
  () => import("@/components/FocusTimer").then((m) => ({ default: m.FocusTimer })),
  "FocusTimer"
);

interface PlanningPageProps {
  onCompleteFocusSession?: (
    session: FocusSession,
    boundary?: FocusCommitBoundary
  ) => void | Promise<void>;
}

function createScheduleEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortScheduleEventsByTime(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => {
    const aStart = a.startHour * 60 + a.startMinute;
    const bStart = b.startHour * 60 + b.startMinute;
    return aStart - bStart;
  });
}

function isManualScheduleEvent(event: ScheduleEvent | undefined): event is ScheduleEvent {
  if (!event) return false;
  const manualSource = !event.source || event.source === "manual";
  return manualSource && event.isEditable !== false;
}

export function getLatestCompletedFocusSession(
  focusSessions: readonly FocusSession[]
): FocusSession | null {
  let latest: FocusSession | null = null;

  for (const session of focusSessions) {
    if (session.status === "aborted") continue;
    if (!latest || session.completedAt > latest.completedAt) {
      latest = session;
    }
  }

  return latest;
}

export const PlanningPage = memo(function PlanningPage({
  onCompleteFocusSession,
}: PlanningPageProps) {
  const { t, isRTL, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const pageRootRef = useRef<HTMLElement>(null);
  const scheduleSectionRef = useRef<HTMLElement>(null);
  const focusSectionRef = useRef<HTMLElement>(null);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const [activeMode, setActiveMode] = useState<PlanningMode>("today");
  const [modelNow, setModelNow] = useState(() => new Date());
  const initialScheduleDate = useMemo(
    () =>
      resolveInitialPlanningDate(
        typeof window === "undefined" ? undefined : window.location.search,
      ),
    [],
  );

  const scheduleEvents = useUserDataStore((s) => s.scheduleEvents);
  const publishDurableScheduleEvents = useUserDataStore(
    (s) => s._publishDurableScheduleEvents
  );
  const habits = useUserDataStore((s) => s.habits);
  const moods = useUserDataStore((s) => s.moods);
  const focusSessions = useUserDataStore((s) => s.focusSessions);
  const isLoading = useUserDataStore((s) => s.isLoading);
  const setCurrentFocusMinutes = useUIStore((s) => s.setCurrentFocusMinutes);
  const focusEndTime = useUIStore((s) => s.focusEndTime);
  const focusIsRunning = useUIStore((s) => s.focusIsRunning);
  const focusIsBreak = useUIStore((s) => s.focusIsBreak);
  const focusLabel = useUIStore((s) => s.focusLabel);

  useEffect(() => {
    if (isLoading) return undefined;
    const refreshNow = () => setModelNow(new Date());
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshNow();
    };
    refreshNow();
    const intervalId = window.setInterval(refreshNow, 60_000);
    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoading]);

  const habitScheduleEvents = useMemo(() => generateHabitScheduleEvents(habits, 7), [habits]);

  const allScheduleEvents = useMemo(
    () => mergeScheduleEvents(scheduleEvents, habitScheduleEvents),
    [habitScheduleEvents, scheduleEvents]
  );

  const todayScheduleEvents = useMemo(() => {
    const today = formatDate(modelNow);
    return sortScheduleEventsByTime(allScheduleEvents.filter((event) => event.date === today));
  }, [allScheduleEvents, modelNow]);

  const planningFeatureModel = useMemo(
    () =>
      derivePlanningFeatureModel({
        now: modelNow,
        events: allScheduleEvents,
        focusSessions,
        focusBridge: {
          endTime: focusEndTime,
          isRunning: focusIsRunning,
          isBreak: focusIsBreak,
          label: focusLabel,
        },
        habits,
        moodEntries: moods,
      }),
    [
      allScheduleEvents,
      focusEndTime,
      focusIsBreak,
      focusIsRunning,
      focusLabel,
      focusSessions,
      habits,
      modelNow,
      moods,
    ]
  );

  const lastCompletedFocusSession = useMemo(
    () => getLatestCompletedFocusSession(focusSessions),
    [focusSessions]
  );

  const planningModeLabels: Record<PlanningMode, string> = {
    today: t.planningModeToday,
    schedule: t.planningModeSchedule,
    focus: t.planningModeFocus,
    review: t.planningModeReview,
  };

  const persistManualScheduleEvents = useCallback(
    (update: (current: ScheduleEvent[]) => ScheduleEvent[]) => {
      void commitManualScheduleEvents(update, scheduleEvents)
        .then(({ events }) => publishDurableScheduleEvents(events))
        .catch((error) => {
          reportDurablePersistenceFailure(error, {
            domain: "Planning",
            localizedMessage: t.storageErrorDesc,
          });
        });
    },
    [publishDurableScheduleEvents, scheduleEvents, t.storageErrorDesc]
  );

  const handleAddScheduleEvent = useCallback(
    (event: Omit<ScheduleEvent, "id">) => {
      const newEvent: ScheduleEvent = {
        ...event,
        id: createScheduleEventId(),
        source: "manual",
        isEditable: true,
      };
      persistManualScheduleEvents((current) => [...current, newEvent]);
    },
    [persistManualScheduleEvents]
  );

  const handleDeleteScheduleEvent = useCallback(
    (id: string) => {
      const event = allScheduleEvents.find((candidate) => candidate.id === id);
      if (!isManualScheduleEvent(event)) {
        logger.warn("[Planning] Ignoring delete for non-manual schedule event");
        return;
      }

      persistManualScheduleEvents((current) =>
        current.filter((candidate) => candidate.id !== id)
      );
    },
    [allScheduleEvents, persistManualScheduleEvents]
  );

  const handleCompleteFocusSession = useCallback(
    async (session: FocusSession, boundary?: FocusCommitBoundary): Promise<void> => {
      if (onCompleteFocusSession) {
        await onCompleteFocusSession(session, boundary);
        return;
      }
      logger.warn("[Planning] Focus session completed without a V2 completion handler");
    },
    [onCompleteFocusSession]
  );

  const activatePlanningMode = useCallback((mode: PlanningMode) => {
    setActiveMode(mode);

    const target =
      mode === "schedule"
        ? scheduleSectionRef.current
        : mode === "focus"
          ? focusSectionRef.current
          : mode === "review"
            ? reviewSectionRef.current
            : pageRootRef.current;

    target?.scrollIntoView?.({
      behavior: shouldAnimate() ? "smooth" : "auto",
      block: mode === "today" ? "start" : "center",
    });
    target?.focus?.({ preventScroll: true });
  }, []);

  const scrollToTimeline = useCallback(() => {
    activatePlanningMode("schedule");
  }, [activatePlanningMode]);

  const fallbackLabel = t.navV2PlanningLoading;

  if (isLoading) {
    return (
      <main
        id="main-content-v2"
        role="main"
        ref={pageRootRef}
        tabIndex={-1}
        data-testid="planning-page"
        data-planning-theme="v1-dark"
        data-v2-readable-page="planning"
        dir={isRTL ? "rtl" : undefined}
        aria-label={t.navV2Planning}
        className={cn(
          "dark main-content-v2 v2-fullscreen-page v2-readable-page v2-readable-page--standard relative min-h-[var(--app-viewport-height)] overflow-x-hidden bg-background outline-none",
          "px-4 pb-[calc(var(--safe-bottom)+5rem)] pt-[calc(var(--safe-top)+4.75rem)] md:px-6 md:pt-10 lg:px-10",
        )}
      >
        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <PlanningPageFallback label={fallbackLabel} />
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content-v2"
      role="main"
      ref={pageRootRef}
      tabIndex={-1}
      data-testid="planning-page"
      data-planning-theme="v1-dark"
      data-v2-readable-page="planning"
      dir={isRTL ? "rtl" : undefined}
      aria-labelledby="planning-page-heading"
      className={cn(
        "dark main-content-v2 v2-fullscreen-page v2-readable-page v2-readable-page--standard relative min-h-[var(--app-viewport-height)] overflow-x-hidden bg-background outline-none",
        "px-4 pb-[calc(var(--safe-bottom)+5rem)] pt-[calc(var(--safe-top)+4.75rem)] md:px-6 md:pt-10 lg:px-10"
      )}
    >
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 md:gap-6">
        <PlanningOverview
          labels={t}
          todayScheduleEvents={todayScheduleEvents}
          onOpenSchedule={scrollToTimeline}
        />

        <PlanningDayPulse
          pulse={planningFeatureModel.dayPulse}
          labels={tx}
          language={language}
        />

        <PlanningBridgeActions actions={planningFeatureModel.bridgeActions} labels={tx} />

        <PlanningModeRail
          activeMode={activeMode}
          onModeChange={activatePlanningMode}
          labels={planningModeLabels}
        />

        <PlanningActionPanel
          model={planningFeatureModel}
          labels={tx}
          onActivateMode={activatePlanningMode}
        />

        <div
          ref={reviewSectionRef}
          tabIndex={-1}
          data-testid="planning-review-section"
          data-active-planning-mode={activeMode === "review" ? "true" : "false"}
          className="rounded-[1.35rem] outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <PlanningReviewLane
            focusMinutesToday={planningFeatureModel.focusMinutesToday}
            lastFocusSession={lastCompletedFocusSession}
            labels={tx}
            language={language}
            onModeChange={activatePlanningMode}
          />
        </div>

        <div
          data-testid="planning-v1-dark-scope"
          data-planning-v1-theme="dark"
          className="dark grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] xl:items-start"
        >
          <section
            ref={scheduleSectionRef}
            tabIndex={-1}
            data-testid="planning-schedule-section"
            data-active-planning-mode={activeMode === "schedule" ? "true" : "false"}
            aria-label={t.navV2Planning}
            className="min-w-0 rounded-[1.75rem] outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="mb-3 flex min-w-0 items-center gap-2 pe-1 ps-[calc(var(--v2-phone-drawer-size)+var(--v2-phone-drawer-inset)+0.75rem)] text-sm font-semibold text-foreground md:px-1">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="min-w-0 break-words">{t.navV2Planning}</span>
            </div>
            <Suspense fallback={<PlanningPageFallback label={fallbackLabel} />}>
              <ScheduleTimeline
                events={allScheduleEvents}
                initialSelectedDate={initialScheduleDate}
                onAddEvent={handleAddScheduleEvent}
                onDeleteEvent={handleDeleteScheduleEvent}
              />
            </Suspense>
          </section>

          <section
            ref={focusSectionRef}
            tabIndex={-1}
            data-testid="planning-focus-section"
            data-active-planning-mode={activeMode === "focus" ? "true" : "false"}
            aria-label={t.focus}
            className="min-w-0 rounded-[1.75rem] outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Suspense fallback={<PlanningPageFallback label={fallbackLabel} />}>
              <FocusTimer
                sessions={focusSessions}
                onCompleteSession={handleCompleteFocusSession}
                onMinuteUpdate={setCurrentFocusMinutes}
                isPrimaryCTA
              />
            </Suspense>
          </section>
        </div>

      </div>
    </main>
  );
});

function PlanningPageFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[180px] items-center justify-center rounded-2xl border border-border/45 bg-card px-4 text-sm font-medium text-muted-foreground"
    >
      {label}
    </div>
  );
}
