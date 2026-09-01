import { memo, useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  ChevronRight,
  Flame,
  Pencil,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  computeHabitStatsSnapshot,
  type HabitStatsSnapshot,
  type HabitStatsTone,
} from "@/lib/habitStatsSnapshot";
import {
  doesNumericalStoredValueMeetTarget,
  formatHabitQuantity,
  formatHabitValue,
} from "@/lib/habits";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import { zenMotion } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";
import { HabitStatsSection } from "./HabitStatsSection";
import { HabitTargetCard } from "./HabitTargetCard";
import { HabitScoreChart } from "./HabitScoreChart";
import { HabitBarCard } from "./HabitBarCard";
import { HabitHeatmapGrid } from "./HabitHeatmapGrid";
import { HabitStreakTimeline } from "./HabitStreakTimeline";
import { HabitNotesSection } from "./HabitNotesSection";
import { cn, getToday } from "@/lib/utils";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { getHabitPlanState } from "@/lib/habitPlan";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLocalizedCount } from "@/features/journal";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { HabitIconVisual } from "@/pages/nav-v2/habits/hero/HabitIconVisual";
import { ENTRY } from "@/types";
import type { Habit } from "@/types";

const LazyHabitFrequencyChart = lazyWithRetry(
  () =>
    import("./HabitFrequencyChart").then((m) => ({
      default: m.HabitFrequencyChart,
    })),
  "HabitFrequencyChart"
);

type DetailTab = "overview" | "calendar" | "trends" | "history";

const detailTabs: DetailTab[] = ["overview", "calendar", "trends", "history"];

const sheetStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.12 } },
};

const sectionEntrance = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: zenMotion.gentle },
};

interface HabitDetailSheetProps {
  habit: Habit | null;
  onClose: () => void;
  onEdit: (habit: Habit) => void;
  onUpdate: (habit: Habit) => void;
  onSkip: (id: string, date: string) => void;
  onUnskip: (id: string, date: string) => void;
  onDelete: (id: string) => void;
}

function formatTargetValue(habit: Habit, value: number | undefined, language: string): string {
  if (value === undefined) return "";
  return formatHabitQuantity(value, habit.unit, language as Parameters<typeof formatHabitValue>[1]);
}

function getToneClasses(tone: HabitStatsTone): string {
  if (tone === "success") return "border-mood-great/30 bg-mood-great/10 text-mood-great";
  if (tone === "warning") return "border-mood-okay/35 bg-mood-okay/10 text-mood-okay";
  if (tone === "danger") return "border-destructive/35 bg-destructive/10 text-destructive";
  if (tone === "skipped") return "border-primary/25 bg-primary/10 text-primary";
  return "border-border bg-secondary/40 text-muted-foreground";
}

function getStatusCopy(
  snapshot: HabitStatsSnapshot,
  habit: Habit,
  ts: Record<string, string>,
  language: string
): { title: string; detail: string; action: string } {
  const today = snapshot.today;
  const value = formatTargetValue(habit, today.realValue, language);
  const target = formatTargetValue(habit, today.targetValue, language);
  const remaining = formatTargetValue(habit, today.remaining, language);

  if (today.status === "done" && habit.habitType === "numerical" && habit.targetType === "atMost") {
    return {
      title: ts.habitStatsLimitSafe || "Within the limit",
      detail: value ? `${value} / ${target}` : target,
      action: ts.habitStatsActionHold || "Keep the line tomorrow.",
    };
  }

  if (today.status === "done") {
    return {
      title: ts.habitStatsDoneToday || "Today is counted",
      detail: value ? `${value} / ${target}` : ts.habitStatsProofCounted || "Check-in counted",
      action: ts.habitStatsActionHold || "Keep the line tomorrow.",
    };
  }

  if (today.status === "partial") {
    return {
      title: ts.habitStatsPartial || "Progress started",
      detail: remaining
        ? `${ts.habitStatsRemaining || "Remaining"}: ${remaining}`
        : `${value} / ${target}`,
      action: ts.habitStatsActionFinish || "Finish the target while it is still easy.",
    };
  }

  if (today.status === "skipped") {
    return {
      title: ts.habitStatsSkippedSafe || "Skip kept the streak safe",
      detail: ts.habitStatsSkipNotDone || "It does not count as a completion.",
      action: ts.habitStatsActionReturn || "Return with one clean mark tomorrow.",
    };
  }

  if (today.status === "overLimit") {
    return {
      title: ts.habitStatsLimitOver || "Limit exceeded",
      detail: value ? `${value} / ${target}` : target,
      action: ts.habitStatsActionReset || "Use tomorrow as the reset point.",
    };
  }

  if (today.status === "missed") {
    return {
      title: ts.habitStatsNotCounted || "Not counted yet",
      detail: ts.habitStatsNoProof || "No check-in for today yet.",
      action: ts.habitStatsActionCheckIn || "Add a real check-in.",
    };
  }

  return {
    title: ts.habitStatsNeedsCheckIn || "Needs a check-in",
    detail: target
      ? `${ts.habitStatsTodayTarget || "Today target"}: ${target}`
      : ts.habitStatsNoDataYet || "No data for today yet.",
    action: ts.habitStatsActionCheckIn || "Add a real check-in.",
  };
}

function getTabLabel(tab: DetailTab, ts: Record<string, string>): string {
  const labels: Record<DetailTab, string> = {
    overview: ts.habitStatsTabOverview || "Overview",
    calendar: ts.habitStatsTabCalendar || "Calendar",
    trends: ts.habitStatsTabTrends || "Trends",
    history: ts.habitStatsTabHistory || "History",
  };
  return labels[tab];
}

function getRecentDays(habit: Habit, today: string) {
  const result: Array<{
    date: string;
    day: string;
    status: "done" | "partial" | "skip" | "miss" | "empty";
  }> = [];
  const base = new Date(`${today}T00:00:00`);

  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date(base);
    date.setDate(date.getDate() - i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const entry = habit.entries?.[dateStr];
    let status: "done" | "partial" | "skip" | "miss" | "empty" = "empty";

    if (entry?.value === ENTRY.SKIP) {
      status = "skip";
    } else if (habit.habitType === "boolean") {
      status =
        entry?.value === ENTRY.YES_MANUAL || entry?.value === ENTRY.YES_AUTO
          ? "done"
          : entry
            ? "miss"
            : "empty";
    } else if (entry) {
      if (doesNumericalStoredValueMeetTarget(habit, entry.value)) {
        status = "done";
      } else if (entry.value > 0) {
        status = habit.targetType === "atMost" ? "miss" : "partial";
      } else {
        status = habit.targetType === "atMost" ? "done" : "miss";
      }
    }

    result.push({ date: dateStr, day: String(date.getDate()), status });
  }

  return result;
}

function recentDayClasses(status: ReturnType<typeof getRecentDays>[number]["status"]): string {
  if (status === "done") return "border-mood-great/35 bg-mood-great/15 text-mood-great";
  if (status === "partial") return "border-mood-okay/35 bg-mood-okay/15 text-mood-okay";
  if (status === "skip") return "border-primary/35 bg-primary/15 text-primary";
  if (status === "miss") return "border-destructive/25 bg-destructive/10 text-destructive";
  return "border-border bg-secondary/35 text-muted-foreground";
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/35 p-3">
      <div className="flex items-start gap-2 text-muted-foreground">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <div className="mt-2 whitespace-normal [overflow-wrap:anywhere] text-xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {detail && (
        <div className="mt-1 whitespace-normal break-words text-xs text-muted-foreground">
          {detail}
        </div>
      )}
    </div>
  );
}

export const HabitDetailSheet = memo(function HabitDetailSheet({
  habit,
  onClose,
  onEdit,
  onUpdate,
  onSkip,
  onUnskip,
  onDelete,
}: HabitDetailSheetProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const today = getToday();
  const planDurationFallback = "day plan";
  const reduceMotion = useReducedMotion();
  const shouldAnimate = useShouldAnimate();

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);
  const shouldRestoreDeleteTriggerFocusRef = useRef(false);

  const setDeleteTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    if (!node || !shouldRestoreDeleteTriggerFocusRef.current) return;
    shouldRestoreDeleteTriggerFocusRef.current = false;
    requestAnimationFrame(() => {
      if (node.isConnected) node.focus({ preventScroll: true });
    });
  }, []);

  const setCancelDeleteRef = useCallback(
    (node: HTMLButtonElement | null) => {
      if (!node || !showDeleteConfirm) return;
      requestAnimationFrame(() => {
        if (node.isConnected) node.focus({ preventScroll: true });
      });
    },
    [showDeleteConfirm]
  );

  const closeDeleteConfirm = useCallback(() => {
    shouldRestoreDeleteTriggerFocusRef.current = true;
    setShowDeleteConfirm(false);
  }, []);

  useBackHandler(showDeleteConfirm, closeDeleteConfirm);
  useBackHandler(!!habit && !showDeleteConfirm, onClose);

  useEffect(() => {
    setIsDeleting(false);
    isDeletingRef.current = false;
    shouldRestoreDeleteTriggerFocusRef.current = false;
    setShowDeleteConfirm(false);
    setActiveTab("overview");
  }, [habit?.id]);

  const snapshot = useMemo(
    () => (habit ? computeHabitStatsSnapshot(habit, today) : null),
    [habit, today]
  );

  const habitColor = habit ? resolveHabitColor(habit.color) : "hsl(var(--primary))";
  const planState = useMemo(() => (habit ? getHabitPlanState(habit, today) : null), [habit, today]);
  const isSkippedToday = useMemo(
    () => habit?.entries?.[today]?.value === ENTRY.SKIP || false,
    [habit, today]
  );

  const handleSkipToggle = useCallback(() => {
    if (!habit) return;
    void hapticTap();
    if (isSkippedToday) onUnskip(habit.id, today);
    else onSkip(habit.id, today);
  }, [habit, isSkippedToday, today, onSkip, onUnskip]);

  const handleDelete = useCallback(() => {
    if (!habit || isDeletingRef.current) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    void hapticTap();
    onDelete(habit.id);
    shouldRestoreDeleteTriggerFocusRef.current = false;
    setShowDeleteConfirm(false);
    onClose();
  }, [habit, onDelete, onClose]);

  const handleNoteUpdate = useCallback(
    (updatedHabit: Habit) => {
      onUpdate(updatedHabit);
    },
    [onUpdate]
  );

  if (!habit || !snapshot) {
    return (
      <Sheet open={false} onOpenChange={onClose}>
        <SheetContent side="bottom" />
      </Sheet>
    );
  }

  const statusCopy = getStatusCopy(snapshot, habit, ts, language);
  const week = snapshot.periods[0];
  const month = snapshot.periods[1];
  const bestWeekdayLabels = [t.daySun, t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat];
  const bestWeekday = snapshot.bestWeekday
    ? bestWeekdayLabels[snapshot.bestWeekday.index]
    : ts.habitStatsDataGrowing || "Data is growing";
  const recentDays = getRecentDays(habit, today);

  return (
    <Sheet
      open={!!habit}
      onOpenChange={(open) => {
        if (!open) {
          setIsDeleting(false);
          isDeletingRef.current = false;
          shouldRestoreDeleteTriggerFocusRef.current = false;
          setShowDeleteConfirm(false);
          onClose();
        }
      }}
    >
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          if (!showDeleteConfirm) return;
          event.preventDefault();
          closeDeleteConfirm();
        }}
        className={cn(
          "max-h-[90dvh] rounded-t-3xl overflow-y-auto",
          "bg-card border-t border-border",
          "p-0"
        )}
      >
        <motion.div
          className="px-5 pt-5 space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
          variants={sheetStagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={sectionEntrance}
            className="relative overflow-hidden rounded-3xl border border-border bg-secondary/25 p-4"
          >
            <motion.div
              aria-hidden="true"
              className="absolute -left-10 -top-16 h-40 w-40 rounded-full blur-3xl"
              style={{ backgroundColor: habitColor, opacity: 0.22 }}
              animate={
                reduceMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.18, 0.28, 0.18] }
              }
              transition={
                reduceMotion ? undefined : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
              }
            />
            <div className="relative grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3 min-[420px]:grid-cols-[56px_minmax(0,1fr)_auto]">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-2xl shadow-sm"
                style={{
                  borderColor: `${habitColor}66`,
                  backgroundColor: `${habitColor}24`,
                }}
              >
                <HabitIconVisual
                  value={habit.icon}
                  iconClassName="h-8 w-8"
                  textClassName="text-2xl leading-none"
                />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="whitespace-normal break-words [overflow-wrap:anywhere] text-xl font-semibold text-foreground">
                  <bdi dir="auto">{habit.name}</bdi>
                </SheetTitle>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {habit.category && <span className="capitalize">{habit.category}</span>}
                  {snapshot.identityProof.text && (
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary">
                      {snapshot.identityProof.icon || "✦"} {snapshot.identityProof.text}
                    </span>
                  )}
                </div>
                {planState && (
                  <div className="mt-1 whitespace-normal break-words text-xs text-muted-foreground">
                    {formatLocalizedCount(
                      planState.durationDays,
                      language,
                      ts,
                      "habitPlanDurationCount",
                      planDurationFallback
                    )}
                    {" · "}
                    {planState.isComplete
                      ? ts.completed
                      : formatLocalizedCount(
                          planState.remainingDays,
                          language,
                          ts,
                          "daysLeftCount",
                          ts.daysLeft
                        )}
                  </div>
                )}
              </div>
              <div className="col-span-2 justify-self-center min-[420px]:col-span-1 min-[420px]:justify-self-end">
                <ProgressRing
                  progress={snapshot.scorePercent}
                  size="lg"
                  showPercentage
                  color={
                    snapshot.scorePercent >= 60
                      ? "success"
                      : snapshot.scorePercent >= 30
                        ? "warning"
                        : "primary"
                  }
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={sectionEntrance}
            role="tablist"
            aria-label={ts.habitStatsTabsLabel || "Habit statistics sections"}
            className="grid grid-cols-2 gap-1 min-[520px]:grid-cols-4 rounded-2xl border border-border bg-secondary/30 p-1"
          >
            {detailTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "min-h-[44px] whitespace-normal break-words rounded-xl px-2 py-2 text-xs font-semibold motion-safe:transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {getTabLabel(tab, ts)}
              </button>
            ))}
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "overview" && (
              <motion.section
                key="overview"
                role="tabpanel"
                variants={sectionEntrance}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -6 }}
                className="space-y-4"
              >
                <div className={cn("rounded-3xl border p-4", getToneClasses(snapshot.today.tone))}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-current/20 bg-background/45 text-2xl">
                      <HabitIconVisual
                        value={habit.icon}
                        iconClassName="h-7 w-7"
                        textClassName="text-2xl leading-none"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{statusCopy.title}</div>
                      <div className="mt-1 text-xs opacity-80">{statusCopy.detail}</div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 opacity-50" aria-hidden="true" />
                  </div>
                  <div className="mt-4 rounded-2xl border border-current/15 bg-background/35 px-3 py-2 text-xs">
                    <span className="font-semibold">
                      {ts.habitStatsNextAction || "Next action"}:
                    </span>{" "}
                    {statusCopy.action}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 min-[720px]:grid-cols-3">
                  <OverviewMetric
                    icon={TrendingUp}
                    label={ts.habitStatsPace || "Completion"}
                    value={`${Math.round(week.percentToDate)}%`}
                    detail={
                      week.isOnPace
                        ? ts.habitStatsOnTrack || "On track"
                        : ts.habitStatsNeedsToday || "Needs a check-in"
                    }
                  />
                  <OverviewMetric
                    icon={Flame}
                    label={ts.currentStreak || "Streak"}
                    value={`${snapshot.currentStreak}${ts.daysAbbr || "d"}`}
                    detail={
                      ts.bestStreak
                        ? `${ts.bestStreak}: ${snapshot.bestStreak}${ts.daysAbbr || "d"}`
                        : undefined
                    }
                  />
                  <OverviewMetric
                    icon={ShieldCheck}
                    label={ts.habitStatsProof || "Check-ins"}
                    value={`${snapshot.totalCompleted}`}
                    detail={
                      snapshot.lowData
                        ? ts.habitStatsLowData || "Needs more check-ins"
                        : bestWeekday
                    }
                  />
                </div>

                <HabitStatsSection
                  currentStreak={snapshot.currentStreak}
                  allStreaks={snapshot.allStreaks}
                  completedDates={snapshot.completedDates}
                  snapshot={snapshot}
                />
              </motion.section>
            )}

            {activeTab === "calendar" && (
              <motion.section
                key="calendar"
                role="tabpanel"
                variants={sectionEntrance}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -6 }}
                className="space-y-4"
              >
                <div>
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {ts.habitStatsRecentProof || "Recent check-ins"}
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(3rem,1fr))] gap-2">
                    {recentDays.map((day) => (
                      <div
                        key={day.date}
                        className={cn(
                          "flex min-h-14 min-w-0 flex-col items-center justify-center rounded-2xl border text-xs font-semibold",
                          recentDayClasses(day.status)
                        )}
                        role="img"
                        aria-label={`${day.date}: ${day.status}`}
                      >
                        <span>{day.day}</span>
                        <span
                          className="mt-1 h-1 w-1 rounded-full bg-current opacity-70"
                          aria-hidden="true"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <HabitHeatmapGrid habit={habit} />
                <HabitTargetCard habit={habit} snapshot={snapshot} />
              </motion.section>
            )}

            {activeTab === "trends" && (
              <motion.section
                key="trends"
                role="tabpanel"
                variants={sectionEntrance}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -6 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  <OverviewMetric
                    icon={Target}
                    label={ts.habitStatsThisMonth || ts.thisMonth || "Month"}
                    value={`${Math.round(month.percentToDate)}%`}
                    detail={`${formatHabitValue(month.actual, language)}/${formatHabitValue(month.expectedToDate, language)}`}
                  />
                  <OverviewMetric
                    icon={Sparkles}
                    label={ts.habitStatsBestDay || "Best day"}
                    value={bestWeekday}
                    detail={
                      snapshot.bestWeekday
                        ? `${snapshot.bestWeekday.count}`
                        : ts.habitStatsLowData || "More data soon"
                    }
                  />
                </div>
                <HabitScoreChart habit={habit} />
                <HabitBarCard habit={habit} />
                <Suspense fallback={<div className="h-48" />}>
                  <LazyHabitFrequencyChart habit={habit} />
                </Suspense>
              </motion.section>
            )}

            {activeTab === "history" && (
              <motion.section
                key="history"
                role="tabpanel"
                variants={sectionEntrance}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -6 }}
                className="space-y-5"
              >
                <HabitStreakTimeline
                  allStreaks={snapshot.allStreaks}
                  currentStreak={snapshot.currentStreak}
                />
                <HabitNotesSection habit={habit} onUpdate={handleNoteUpdate} />
              </motion.section>
            )}
          </AnimatePresence>

          <motion.div variants={sectionEntrance} className="space-y-2 border-t border-border pt-2">
            <button
              onClick={() => {
                onEdit(habit);
                onClose();
              }}
              className={cn(
                "flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-border bg-secondary/35 px-4 py-3 text-sm motion-safe:transition",
                "hover:bg-secondary/55 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              )}
            >
              <Pencil className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-muted-foreground">{ts.editHabit || "Edit Habit"}</span>
            </button>

            <button
              onClick={handleSkipToggle}
              className={cn(
                "flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-border bg-secondary/35 px-4 py-3 text-sm motion-safe:transition",
                "hover:bg-secondary/55 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                isSkippedToday && "border-primary/25 bg-primary/10 text-primary"
              )}
            >
              <SkipForward className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className={isSkippedToday ? "text-primary" : "text-muted-foreground"}>
                {isSkippedToday ? ts.skipped || "Skipped Today" : ts.skipToday || "Skip Today"}
              </span>
            </button>

            <AnimatePresence mode="wait" initial={false}>
              {!showDeleteConfirm ? (
                <motion.div
                  key="del-btn"
                  initial={shouldAnimate ? { opacity: 0 } : false}
                  animate={shouldAnimate ? { opacity: 1 } : undefined}
                  exit={shouldAnimate ? { opacity: 0 } : undefined}
                  transition={shouldAnimate ? zenMotion.exit : zenMotion.instant}
                >
                  <button
                    ref={setDeleteTriggerRef}
                    type="button"
                    onClick={() => {
                      void hapticTap();
                      setShowDeleteConfirm(true);
                    }}
                    className={cn(
                      "flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive motion-safe:transition",
                      "hover:bg-destructive/15 active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
                    )}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>{ts.deleteHabit || "Delete Habit"}</span>
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="del-confirm"
                  initial={shouldAnimate ? { opacity: 0, height: 0 } : false}
                  animate={shouldAnimate ? { opacity: 1, height: "auto" } : undefined}
                  exit={shouldAnimate ? { opacity: 0, height: 0 } : undefined}
                  transition={shouldAnimate ? zenMotion.snappy : zenMotion.instant}
                  className="overflow-hidden"
                >
                  <div className="space-y-2">
                    <p
                      id={`habit-delete-confirmation-${habit.id}`}
                      role="status"
                      aria-live="polite"
                      className="px-2 text-center text-xs text-destructive"
                    >
                      {ts.confirmDeleteHabit || "Are you sure? This cannot be undone."}
                    </p>
                    <div className="flex gap-2">
                      <button
                        ref={setCancelDeleteRef}
                        type="button"
                        aria-describedby={`habit-delete-confirmation-${habit.id}`}
                        onClick={closeDeleteConfirm}
                        className={cn(
                          "min-h-[44px] flex-1 rounded-xl border border-border bg-secondary/35 px-4 py-3 text-sm font-medium text-muted-foreground motion-safe:transition",
                          "hover:bg-secondary/55",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        )}
                      >
                        {ts.cancel || "Cancel"}
                      </button>
                      <button
                        type="button"
                        aria-describedby={`habit-delete-confirmation-${habit.id}`}
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className={cn(
                          "min-h-[44px] flex-1 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground motion-safe:transition",
                          "hover:bg-destructive/90 active:scale-[0.98]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
                          isDeleting && "cursor-not-allowed opacity-50"
                        )}
                      >
                        {ts.delete || "Delete"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
});
