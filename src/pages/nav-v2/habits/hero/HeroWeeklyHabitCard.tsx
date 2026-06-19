import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatedFire } from "@/components/compact-habit-card/AnimatedFire";
import { MiniWeekRow } from "@/components/habit-hub/MiniWeekRow";
import { useLanguage } from "@/contexts/LanguageContext";
import { frequencyPresets } from "@/hooks/useHabitForm";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import { getHabitPlanState } from "@/lib/habitPlan";
import {
  formatHabitQuantity,
  formatHabitValue,
  getNumericalValue,
  isHabitCompletedOnDate,
} from "@/lib/habits";
import { getCurrentStreak } from "@/lib/habitScore";
import { scheduleIdle, type IdleHandle } from "@/lib/scheduleIdle";
import { getToday } from "@/lib/utils";
import {
  getHabitRoleTone,
  getHabitVisualRole,
  getRoleHsl,
  getRoleStyleVars,
} from "@/lib/nonOrbVisualRoles";
import {
  getNumericalActionDelta,
  getNumericalQuickEntryAction,
  type NumericalEntryAction,
} from "@/lib/habitNumericalInteraction";
import { isHabitDueOnDate, normalizeHabitSchedule } from "@/lib/habitScheduling";
import type { Habit } from "@/types";
import { formatLocalizedCount } from "@/features/journal";
import { ChevronDown } from "lucide-react";
import { HabitIconVisual } from "./HabitIconVisual";

function getCurrentISOWeek(todayStr: string): string[] {
  const [year, month, day] = todayStr.split("-").map(Number);
  const today = new Date(year, month - 1, day);
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(monday.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
}

interface QueuedStreakTask {
  cancelled: boolean;
  run: () => void;
}

const queuedStreakTasks: QueuedStreakTask[] = [];
let queuedStreakHandle: IdleHandle | null = null;
const STREAK_IDLE_TIMEOUT_MS = 240;
const STREAK_IDLE_MIN_DELAY_MS = 80;

function pruneCancelledStreakTasks() {
  while (queuedStreakTasks[0]?.cancelled) {
    queuedStreakTasks.shift();
  }
}

function pumpQueuedStreakTasks() {
  pruneCancelledStreakTasks();
  if (queuedStreakHandle || queuedStreakTasks.length === 0) {
    return;
  }

  queuedStreakHandle = scheduleIdle(() => {
    queuedStreakHandle = null;
    pruneCancelledStreakTasks();
    const task = queuedStreakTasks.shift();
    if (task && !task.cancelled) {
      task.run();
    }
    pruneCancelledStreakTasks();
    pumpQueuedStreakTasks();
  }, STREAK_IDLE_TIMEOUT_MS, STREAK_IDLE_MIN_DELAY_MS);
}

function scheduleQueuedStreakTask(run: () => void): IdleHandle {
  const task: QueuedStreakTask = { cancelled: false, run };
  queuedStreakTasks.push(task);
  pumpQueuedStreakTasks();

  return {
    cancel: () => {
      task.cancelled = true;
      const index = queuedStreakTasks.indexOf(task);
      if (index >= 0) {
        queuedStreakTasks.splice(index, 1);
      }
      if (queuedStreakTasks.length === 0) {
        queuedStreakHandle?.cancel();
        queuedStreakHandle = null;
      }
    },
  };
}

interface HeroWeeklyHabitCardProps {
  habit: Habit;
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onNumericalAction?: (habitId: string, date: string, action: NumericalEntryAction) => void;
  onOpenDetail?: (habit: Habit) => void;
  initiallyCollapsed?: boolean;
}

export const HeroWeeklyHabitCard = memo(function HeroWeeklyHabitCard({
  habit,
  onToggle,
  onAdjust,
  onNumericalAction,
  onOpenDetail,
  initiallyCollapsed = false,
}: HeroWeeklyHabitCardProps) {
  const { t, language } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(() => initiallyCollapsed);
  const today = getToday();
  const habitColor = resolveHabitColor(habit.color, true);
  const visualRole = getHabitVisualRole(habit);
  const tone = getHabitRoleTone(visualRole);
  const roleColor = getRoleHsl(visualRole);
  const roleAccent = useMemo(
    () => ({
      color: getRoleHsl(visualRole),
      softBg: getRoleHsl(visualRole, 0.18),
      strongBg: getRoleHsl(visualRole, 0.3),
      border: getRoleHsl(visualRole, 0.46),
      mutedBg: getRoleHsl(visualRole, 0.16),
    }),
    [visualRole],
  );
  const isCompletedToday = isHabitCompletedOnDate(habit, today);
  const cardVisualStyle = useMemo(
    () =>
      ({
        ...getRoleStyleVars(visualRole),
        "--habit-card-border": getRoleHsl(visualRole, isCollapsed ? 0.5 : 0.28),
        "--habit-card-background": isCollapsed
          ? `radial-gradient(circle at 9% 50%, ${getRoleHsl(visualRole, 0.28)} 0%, transparent 36%), linear-gradient(135deg, ${getRoleHsl(visualRole, 0.20)} 0%, hsl(var(--card)) 52%, hsl(var(--surface-elevated)) 100%)`
          : `radial-gradient(circle at 18% 0%, ${getRoleHsl(visualRole, 0.22)} 0%, transparent 34%), linear-gradient(135deg, ${getRoleHsl(visualRole, 0.16)} 0%, hsl(var(--card)) 42%, hsl(var(--surface-elevated)) 100%)`,
        "--habit-card-shadow": isCompletedToday
          ? `0 18px 46px -34px ${roleColor}`
          : isCollapsed
            ? `inset 0 0 0 1px ${getRoleHsl(visualRole, 0.16)}, 0 18px 44px -34px ${roleColor}`
            : `0 14px 40px -36px ${roleColor}`,
      }) as CSSProperties,
    [isCollapsed, isCompletedToday, roleColor, visualRole],
  );
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setStreak(0);
    const handle = scheduleQueuedStreakTask(() => {
      if (!cancelled) {
        setStreak(getCurrentStreak(habit));
      }
    });

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [habit]);
  const isNumeric = habit.habitType === "numerical";
  const tx = t as unknown as Record<string, string>;
  const identityVerb = (habit.identityVerb ?? "").trim();
  const identityIcon = (habit.identityIcon ?? "").trim() || (habit.icon ?? "").trim() || "Sparkles";
  const identityVoteLabel = identityVerb
    ? (tx.identityVoteFor || "Step toward {identity}").replace("{identity}", identityVerb)
    : "";
  const weekDates = useMemo(() => getCurrentISOWeek(today), [today]);
  const planState = useMemo(() => getHabitPlanState(habit, today), [habit, today]);
  const schedule = useMemo(() => normalizeHabitSchedule(habit), [habit]);
  const isDueToday = isHabitDueOnDate(habit, today);

  const currentValue = isNumeric ? getNumericalValue(habit, today) : 0;
  const targetValue = habit.targetValue || 1;
  const numericSummary = isNumeric
    ? `${formatHabitValue(currentValue, language)}/${formatHabitQuantity(targetValue, habit.unit, language)}`
    : null;
  const weekSummary = useMemo(() => {
    const thisWeekLabel = t.thisWeek || "This week";
    if (isNumeric) {
      const total = weekDates.reduce(
        (sum, date) => sum + getNumericalValue(habit, date),
        0,
      );
      return `${formatHabitQuantity(total, habit.unit, language)} · ${thisWeekLabel}`;
    }

    const done = weekDates.reduce(
      (sum, date) => sum + (isHabitCompletedOnDate(habit, date) ? 1 : 0),
      0,
    );
    if (schedule.mode === "daily") return `${done}x · ${thisWeekLabel}`;
    const target = schedule.targetCount;
    return `${done}/${target} · ${thisWeekLabel}`;
  }, [habit, isNumeric, language, schedule.mode, schedule.targetCount, t.thisWeek, weekDates]);

  const freqLabel = useMemo(() => {
    const { numerator: n, denominator: d } = habit.frequency;
    const ts = t as unknown as Record<string, string>;
    const preset = frequencyPresets.find(
      (item) => item.ratio.numerator === n && item.ratio.denominator === d,
    );
    if (preset) return ts[preset.i18nKey] || preset.label;
    return `${n}x / ${d}${ts.daysAbbr || "d"}`;
  }, [habit.frequency, t]);

  const planLabel = planState
    ? planState.isComplete
      ? t.completed || "Completed"
      : formatLocalizedCount(
          planState.remainingDays,
          language,
          t as unknown as Record<string, string>,
          "daysLeftCount",
          t.daysLeft || "days left"
        )
    : null;
  const planSubLabel = planState
    ? `${planState.durationDays}-${(t as unknown as Record<string, string>).habitDurationDaysLabel || "day"} ${(t as unknown as Record<string, string>).habitPlanLabel || "plan"}`
    : null;
  const contentId = `hero-weekly-card-${habit.id}-content`;
  const collapseLabel = isCollapsed ? t.expand || "Expand" : t.collapse || "Collapse";
  const collapsedCueLabel = t.expand || "Expand";

  const handleIconCheckIn = () => {
    if (!isDueToday) return;

    if (isNumeric) {
      const current = getNumericalValue(habit, today);
      const hasEntry = Boolean(habit.entries?.[today]);
      const action = getNumericalQuickEntryAction(habit, current, hasEntry);
      if (onNumericalAction) {
        onNumericalAction(habit.id, today, action);
        return;
      }
      const delta = getNumericalActionDelta(action, current);
      if (delta !== null && onAdjust) {
        onAdjust(habit.id, today, delta);
      } else if (action.type === "openExactInput") {
        onOpenDetail?.(habit);
      }
      return;
    }

    onToggle(habit.id, today);
  };

  return (
    <article
      role="listitem"
      aria-label={habit.name}
      className={
        "relative overflow-hidden rounded-[26px] border border-border/55 bg-card shadow-sm " +
        tone.surfaceClass +
        " " +
        "motion-safe:transition-[border-color,box-shadow,transform] motion-safe:duration-300 hover:-translate-y-0.5"
      }
      data-testid={`hero-weekly-card-${habit.id}`}
      data-card="ritual-weekly-card"
      data-collapsed={isCollapsed ? "true" : "false"}
      data-completed-today={isCompletedToday ? "true" : "false"}
      data-visual-role={visualRole}
      style={cardVisualStyle}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute inset-y-4 start-0 w-1 rounded-e-full"
        data-slot="weekly-rail"
        aria-hidden="true"
      />
      <div
        className={
          isCollapsed
            ? "grid min-h-[72px] grid-cols-[48px_minmax(0,1fr)_44px] items-center gap-3 px-3 py-2.5"
            : "grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 px-4 pt-4"
        }
      >
        <button
            type="button"
            onClick={handleIconCheckIn}
            className={
              "flex shrink-0 items-center justify-center rounded-2xl border text-lg shadow-sm motion-safe:transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
              (isCollapsed ? "h-12 w-12" : "min-h-[44px] min-w-[44px]")
            }
            aria-label={`${habit.name}: ${isCompletedToday ? t.completed || "Completed" : tx.identityVotePending || "mark today"}`}
            data-testid={`hero-weekly-card-${habit.id}-icon-check`}
            data-slot="weekly-check"
          >
            <HabitIconVisual value={habit.icon} iconClassName={isCollapsed ? "h-8 w-8" : "h-7 w-7"} />
          </button>
          <div className="min-w-0 self-center">
            <p
              className={
                "truncate font-semibold " +
                (isCollapsed ? "text-[15px] leading-snug" : "text-sm leading-tight md:text-base") +
                " " +
                (isCompletedToday ? "text-foreground/70" : "text-foreground")
              }
              title={habit.name}
            >
              {habit.name}
            </p>
            {!isCollapsed && planSubLabel ? (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {planSubLabel}
                {planLabel ? ` · ${planLabel}` : ""}
              </p>
            ) : null}
            {isCollapsed ? (
              <span
                className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background/68 px-2.5 py-1 text-[11px] font-semibold text-foreground/75"
                data-testid={`hero-weekly-card-${habit.id}-collapsed-cue`}
                data-slot="weekly-pill"
                aria-live="polite"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  data-slot="weekly-pill-dot"
                  aria-hidden="true"
                />
                <span className="truncate">{collapsedCueLabel}</span>
              </span>
            ) : null}
            {!isCollapsed && identityVerb ? (
              <p
                className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border bg-background/55 px-2 py-1 text-[11px] font-medium text-foreground/75"
                data-testid={`hero-weekly-card-${habit.id}-identity`}
                data-slot="weekly-pill"
                title={identityVoteLabel}
              >
                <HabitIconVisual
                  value={identityIcon}
                  fallback="Sparkles"
                  iconClassName="h-3 w-3 shrink-0"
                  textClassName="text-xs leading-none"
                />
                <span className="truncate">{identityVoteLabel}</span>
              </p>
            ) : null}
          </div>
        <div
          className={
            isCollapsed
              ? "flex h-12 items-center justify-center"
              : "flex shrink-0 items-start gap-1"
          }
        >
          {!isCollapsed && numericSummary ? (
            <span
              className="rounded-full border bg-background/70 px-2.5 py-1 text-[11px] font-medium tabular-nums text-foreground/75"
              data-testid={`hero-weekly-card-${habit.id}-summary`}
              data-slot="weekly-pill"
            >
              {numericSummary}
            </span>
          ) : null}
          {!isCollapsed && !numericSummary && planLabel ? (
            <span
              className="rounded-full border bg-background/70 px-2.5 py-1 text-[11px] font-medium text-foreground/75"
              data-testid={`hero-weekly-card-${habit.id}-plan`}
              data-slot="weekly-pill"
            >
              {planLabel}
            </span>
          ) : null}
          <button
            type="button"
            aria-expanded={!isCollapsed}
            aria-controls={contentId}
            aria-label={`${collapseLabel} ${habit.name}`}
            onClick={() => setIsCollapsed((current) => !current)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border/55 bg-background/70 text-foreground/75 motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            data-testid={`hero-weekly-card-${habit.id}-collapse`}
            data-slot="weekly-collapse"
          >
            <ChevronDown
              className={
                "h-4 w-4 motion-safe:transition-transform " +
                (isCollapsed ? "rotate-0" : "rotate-180")
              }
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <div id={contentId} data-testid={`hero-weekly-card-${habit.id}-content`}>
          <div className="px-4 pt-3" onClick={(e) => e.stopPropagation()}>
            <MiniWeekRow
              habit={habit}
              habitColor={habitColor}
              roleAccent={roleAccent}
              onToggle={onToggle}
              onAdjust={onAdjust}
              onNumericalAction={onNumericalAction}
              tone="hero"
              interactionScope="today"
            />
          </div>

          <div
            className="flex items-center justify-between gap-3 px-4 pt-3 pb-4 text-[11px] text-muted-foreground"
            data-slot="weekly-footer"
          >
            <div
              className="flex min-h-[20px] min-w-0 flex-wrap items-center gap-x-2 gap-y-1 tabular-nums"
              data-testid={`hero-weekly-card-${habit.id}-streak`}
            >
              {identityVerb ? (
                <span
                  className="inline-flex items-center gap-1 font-medium text-[hsl(var(--zf-role-rest))]"
                  data-testid={`hero-weekly-card-${habit.id}-identity-vote`}
                >
                  <HabitIconVisual
                    value={identityIcon}
                    fallback="Sparkles"
                    iconClassName="h-3 w-3"
                    textClassName="text-xs leading-none"
                  />
                  {isCompletedToday
                    ? tx.identityVoteCast || "step logged"
                    : tx.identityVotePending || "ready to mark"}
                </span>
              ) : null}
              {streak > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <AnimatedFire intensity={Math.min(1 + streak / 7, 3)} size="sm" />
                  <span className="font-medium text-[hsl(var(--zf-warm))]">
                    {streak}
                    {t.dStreak}
                  </span>
                </span>
              ) : null}
            </div>
            <span
              className="truncate text-right tabular-nums"
              data-testid={`hero-weekly-card-${habit.id}-meta`}
              data-slot="weekly-meta"
            >
              {weekSummary || freqLabel}
            </span>
            {onOpenDetail && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail(habit);
                }}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-border/60 bg-background/80 px-3 py-2 text-[11px] font-medium text-foreground motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                data-testid={`hero-weekly-card-${habit.id}-stats`}
                data-slot="weekly-stats"
              >
                {t.statistics || "Statistics"}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
});
