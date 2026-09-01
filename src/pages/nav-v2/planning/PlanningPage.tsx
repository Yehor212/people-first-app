import { memo, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, Sparkles } from "lucide-react";
import { GlobalScheduleBar } from "@/components/GlobalScheduleBar";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { cn, getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIStore, useUserDataStore } from "@/stores";
import { generateHabitScheduleEvents, mergeScheduleEvents } from "@/lib/habitScheduleSync";
import { reportDurablePersistenceFailure } from "@/lib/durablePersistenceFailure";
import { persistManualScheduleEvents as commitManualScheduleEvents } from "@/features/automation";
import { logger } from "@/lib/logger";
import type { FocusSession, ScheduleEvent } from "@/types";
import type { FocusCommitBoundary } from "@/types/focusTimerTypes";
import { PlanningActionPanel } from "./PlanningActionPanel";
import { PlanningBridgeActions } from "./PlanningBridgeActions";
import { PlanningDayPulse } from "./PlanningDayPulse";
import { PlanningModeRail } from "./PlanningModeRail";
import { PlanningReviewLane } from "./PlanningReviewLane";
import { derivePlanningFeatureModel, type PlanningMode } from "./planningFeatureModel";
import { alignPlanningNow, resolveInitialPlanningDate } from "./planningDates";

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
  const { t, isRTL } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const pageRootRef = useRef<HTMLElement>(null);
  const scheduleSectionRef = useRef<HTMLElement>(null);
  const focusSectionRef = useRef<HTMLElement>(null);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const [activeMode, setActiveMode] = useState<PlanningMode>("today");
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

  const habitScheduleEvents = useMemo(() => generateHabitScheduleEvents(habits, 7), [habits]);

  const allScheduleEvents = useMemo(
    () => mergeScheduleEvents(scheduleEvents, habitScheduleEvents),
    [habitScheduleEvents, scheduleEvents]
  );

  const todayScheduleEvents = useMemo(() => {
    const today = getToday();
    return sortScheduleEventsByTime(allScheduleEvents.filter((event) => event.date === today));
  }, [allScheduleEvents]);

  const planningFeatureModel = useMemo(
    () =>
      derivePlanningFeatureModel({
        now: alignPlanningNow(initialScheduleDate ?? getToday()),
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
      initialScheduleDate,
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
      behavior: "smooth",
      block: mode === "today" ? "start" : "center",
    });
    target?.focus?.({ preventScroll: true });
  }, []);

  const scrollToTimeline = useCallback(() => {
    activatePlanningMode("schedule");
  }, [activatePlanningMode]);

  const fallbackLabel = t.navV2PlanningLoading;

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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_start,hsl(var(--primary)/0.13),transparent_34%),radial-gradient(circle_at_80%_16%,hsl(var(--accent)/0.10),transparent_30%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 md:gap-6">
        <header className="flex min-w-0 flex-col gap-3">
          <div className="inline-flex min-h-[44px] w-fit max-w-full min-w-0 items-center gap-2 whitespace-normal rounded-full border border-border/55 bg-card/72 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:normal]">
              {t.navV2Planning}
            </span>
          </div>
          <div className="min-w-0 max-w-3xl space-y-2">
            <h1
              id="planning-page-heading"
              className="min-w-0 break-words font-display text-xl font-semibold leading-[1.02] text-foreground [hyphens:manual] [overflow-wrap:normal] min-[420px]:text-3xl md:text-display-5xl"
            >
              {t.navV2PlanningHeading}
            </h1>
            <p className="min-w-0 max-w-2xl break-words text-base leading-7 text-muted-foreground [hyphens:manual] [overflow-wrap:normal] md:text-lg">
              {t.navV2PlanningSubcopy}
            </p>
          </div>
        </header>

        <section aria-label={t.viewSchedule} className="space-y-3">
          {todayScheduleEvents.length > 0 ? (
            <GlobalScheduleBar events={todayScheduleEvents} onTap={scrollToTimeline} />
          ) : (
            <button
              type="button"
              onClick={scrollToTimeline}
              data-testid="planning-empty-schedule"
              className="flex min-h-[64px] w-full min-w-0 items-center gap-3 whitespace-normal rounded-2xl border border-border/50 bg-card/72 px-4 py-3 text-start text-muted-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Clock3 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words [hyphens:manual] [overflow-wrap:normal]">
                {t.navV2PlanningEmpty}
              </span>
            </button>
          )}
        </section>

        <PlanningDayPulse pulse={planningFeatureModel.dayPulse} labels={tx} />

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
          className={cn(
            "rounded-[1.35rem] outline-none motion-safe:transition-shadow",
            activeMode === "review" && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background"
          )}
        >
          <PlanningReviewLane
            focusMinutesToday={planningFeatureModel.focusMinutesToday}
            lastFocusSession={lastCompletedFocusSession}
            labels={tx}
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
            className={cn(
              "min-w-0 rounded-[1.75rem] outline-none motion-safe:transition-shadow",
              activeMode === "schedule" &&
                "ring-2 ring-primary/70 ring-offset-2 ring-offset-background"
            )}
          >
            <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>{t.navV2Planning}</span>
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
            className={cn(
              "min-w-0 rounded-[1.75rem] outline-none motion-safe:transition-shadow",
              activeMode === "focus" &&
                "ring-2 ring-primary/70 ring-offset-2 ring-offset-background"
            )}
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

        {isLoading && (
          <div role="status" aria-live="polite" className="sr-only">
            {fallbackLabel}
          </div>
        )}
      </div>
    </main>
  );
});

function PlanningPageFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[180px] items-center justify-center rounded-2xl border border-border/45 bg-card/60 px-4 text-sm font-medium text-muted-foreground backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]"
    >
      {label}
    </div>
  );
}
