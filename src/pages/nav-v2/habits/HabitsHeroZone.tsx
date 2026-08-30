/**
 * HabitsHeroZone — Phase 3-C "today's habits" hero.
 *
 * The top support chrome now stays lean:
 *   - HeroIdentityPrompt
 *   - HeroInsightStrip
 *   - grouped weekly-first habit rows below
 */

import {
  memo,
  useCallback,
  useMemo,
  type CSSProperties,
} from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { hapticTap } from "@/lib/haptics";
import { getRoleTone } from "@/lib/nonOrbVisualRoles";
import { V2_HABIT_JOURNEY_ICONS } from "@/lib/v2IconSystem";

import type { Habit } from "@/types";
import type { NumericalEntryAction } from "@/lib/habitNumericalInteraction";
import type { HabitsPageDailyProgress } from "./useHabitsPageState";
import { HeroIdentityPrompt } from "./hero/HeroIdentityPrompt";
import { HeroTimeOfDayGroup } from "./hero/HeroTimeOfDayGroup";
import { HeroEmptyJourney } from "./hero/HeroEmptyJourney";
import { HeroInsightStrip } from "./hero/HeroInsightStrip";
import { groupHabitsByTimeOfDay } from "./hero/timeOfDay";
import type { HabitTemplate } from "@/lib/habitTemplates";

interface HabitsHeroZoneProps {
  todaysHabits: Habit[];
  hasActiveHabits?: boolean;
  dailyProgress: HabitsPageDailyProgress;
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit?: (habitId: string, date: string, delta: number) => void;
  onNumericalAction?: (habitId: string, date: string, action: NumericalEntryAction) => void;
  onDeleteHabit: (habitId: string) => void;
  onCreateHabit: () => void;
  onEditHabit?: (habit: Habit) => void;
  onSkipHabit?: (habitId: string, date: string) => void;
  onUnskipHabit?: (habitId: string, date: string) => void;
  onArchiveHabit?: (habitId: string) => void;
  onUnarchiveHabit?: (habitId: string) => void;
  onPickTemplate?: (template: HabitTemplate) => void;
  onOpenLibrary?: () => void;
  onOpenDetail?: (habit: Habit) => void;
  onBeforeActionSheetOpen?: () => Promise<boolean>;
  onActionSheetOpenChange?: (open: boolean) => void;
}

export const HabitsHeroZone = memo(function HabitsHeroZone({
  todaysHabits,
  hasActiveHabits = todaysHabits.length > 0,
  dailyProgress,
  onToggleHabit,
  onAdjustHabit,
  onNumericalAction,
  onDeleteHabit,
  onCreateHabit,
  onEditHabit,
  onSkipHabit,
  onUnskipHabit,
  onArchiveHabit,
  onUnarchiveHabit,
  onPickTemplate,
  onOpenLibrary,
  onOpenDetail,
  onBeforeActionSheetOpen,
  onActionSheetOpenChange,
}: HabitsHeroZoneProps) {
  const { t } = useLanguage();
  const tx = t;
  const animate = useShouldAnimate();

  const groups = useMemo(() => groupHabitsByTimeOfDay(todaysHabits), [todaysHabits]);
  const dayOfMonth = useMemo(() => new Date().getDate(), []);

  const handleCreate = useCallback(() => {
    void hapticTap();
    onCreateHabit();
  }, [onCreateHabit]);
  const handleOpenInsightHabit = useCallback(
    (habit: Habit) => {
      onOpenDetail?.(habit);
    },
    [onOpenDetail]
  );

  const isEmpty = todaysHabits.length === 0;
  const bodyTone = getRoleTone("body");
  const CreateHabitIcon = V2_HABIT_JOURNEY_ICONS.create;
  const desktopProgressStyle = {
    "--habits-desktop-progress": dailyProgress.total > 0 ? dailyProgress.ratio : 0,
    background: "hsl(var(--card) / 0.74)",
    border: "1px solid",
    borderRadius: "1.5rem",
    borderColor: "hsl(var(--zf-role-body) / 0.28)",
    flexDirection: "column",
    gap: "1rem",
    marginTop: "1rem",
    padding: "1rem",
  } as CSSProperties;
  const desktopSummaryStyle = {
    alignItems: "flex-end",
    display: "flex",
    gap: "0.75rem",
    justifyContent: "space-between",
  } as CSSProperties;
  const desktopProgressTrackStyle = {
    background: "hsl(var(--zf-role-body) / 0.14)",
    borderRadius: "999px",
    height: "0.375rem",
    overflow: "hidden",
    position: "relative",
  } as CSSProperties;
  const desktopProgressFillStyle = {
    background:
      "linear-gradient(90deg, hsl(var(--zf-role-energy) / 0.82), hsl(var(--zf-role-body) / 0.84), hsl(var(--zf-role-focus) / 0.76))",
    borderRadius: "inherit",
    inset: 0,
    position: "absolute",
    transform: "scaleX(var(--habits-desktop-progress, 0))",
    transformOrigin: "left center",
  } as CSSProperties;
  const progressMax = Math.max(dailyProgress.total, 1);

  const renderCreateButton = (testId: string, className = "") => (
    <button
      type="button"
      onClick={handleCreate}
      className={
        "inline-flex min-h-[48px] items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-[hsl(var(--zf-night-0))] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
        "bg-[hsl(var(--zf-role-body))] " +
        bodyTone.focusRingClass +
        " " +
        (animate ? "motion-safe:transition-transform active:scale-[0.97]" : "") +
        " " +
        className
      }
      aria-label={tx.navV2HabitsCreate}
      data-testid={testId}
    >
      <CreateHabitIcon className="h-4 w-4" aria-hidden="true" />
      {tx.navV2HabitsCreate}
    </button>
  );

  return (
    <section
      aria-labelledby="habits-hero-heading"
      data-testid="habits-hero-zone"
      className="habits-hero-zone mx-auto w-full max-w-[88rem] px-4 py-4 md:px-6 md:py-6 lg:px-10 lg:py-8 xl:px-14"
    >
      <h2 id="habits-hero-heading" className="sr-only">
        {tx.navV2HabitsHero}
      </h2>

      {isEmpty ? (
        <HeroEmptyJourney
          onCreateHabit={handleCreate}
          onPickTemplate={onPickTemplate}
          onOpenLibrary={onOpenLibrary}
          variant={hasActiveHabits ? "rest" : "start"}
        />
      ) : (
        <div className="habits-hero-zone__active">
          <div className="habits-hero-zone__desktop-rail">
            <div
              className="habit-identity-cue sticky top-2 z-10 -mx-1 rounded-2xl border px-3 py-3 md:top-4 lg:top-8 lg:mx-0"
              data-visual-role="body"
              data-testid="habits-identity-cue"
            >
              <HeroIdentityPrompt habits={todaysHabits} dayOfMonth={dayOfMonth} />
              <HeroInsightStrip onOpenHabitInsight={handleOpenInsightHabit} />
            </div>

            <div
              className="habits-desktop-command hidden lg:flex"
              data-testid="habits-desktop-command"
              style={desktopProgressStyle}
            >
              <div className="habits-desktop-command__summary" style={desktopSummaryStyle}>
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {dailyProgress.completed} / {dailyProgress.total}
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tx.navV2HabitsHero}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={tx.navV2HabitsHero}
                aria-valuemin={0}
                aria-valuemax={progressMax}
                aria-valuenow={dailyProgress.completed}
                className="habits-desktop-command__progress"
                style={desktopProgressTrackStyle}
              >
                <span aria-hidden="true" style={desktopProgressFillStyle} />
              </div>
              {renderCreateButton("habits-hero-create-desktop", "w-full justify-center")}
            </div>
          </div>

          <div className="habits-groups-grid flex flex-col" data-testid="habits-groups-grid">
            {groups.map((g) => (
              <HeroTimeOfDayGroup
                key={g.bucket}
                bucket={g.bucket}
                habits={g.habits}
                onToggleHabit={onToggleHabit}
                onAdjustHabit={onAdjustHabit}
                onNumericalAction={onNumericalAction}
                onDeleteHabit={onDeleteHabit}
                onEditHabit={onEditHabit}
                onSkipHabit={onSkipHabit}
                onUnskipHabit={onUnskipHabit}
                onArchiveHabit={onArchiveHabit}
                onUnarchiveHabit={onUnarchiveHabit}
                onOpenDetail={onOpenDetail}
                onBeforeActionSheetOpen={onBeforeActionSheetOpen}
                onActionSheetOpenChange={onActionSheetOpenChange}
              />
            ))}
          </div>

          <p
            className="mt-6 px-1 text-xs font-body italic text-muted-foreground/80"
            data-testid="habits-hero-recovery"
          >
            {tx.navV2HabitsRecovery}
          </p>

          <div className="mt-5 flex justify-center md:justify-end lg:hidden">
            {renderCreateButton("habits-hero-create")}
          </div>
        </div>
      )}

    </section>
  );
});
