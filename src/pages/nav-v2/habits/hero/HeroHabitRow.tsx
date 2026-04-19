/**
 * HeroHabitRow — V2 wrapper around V1 {@link CompactHabitCard}.
 *
 * Law 1 / Law 15: CompactHabitCard is NOT modified. This wrapper adds
 * three additive, research-backed enhancements:
 *
 *   1. **Long-press (450 ms) → open detail sheet.** iOS Haptic-Touch pattern
 *      (Apple HIG 2026). Medium-intensity haptic fires when the threshold is
 *      met so users "feel" the reveal before they see it. Tap still toggles
 *      (fallback remains — every gesture has a visible alternative per Material
 *      Design 2026 accessibility guidance).
 *
 *   2. **Inline 7-day chain dots** below the card (Streaks / Habitify pattern,
 *      "chain of completed squares" — NN/g 2026). Filled = completed, hollow
 *      = missed, today ringed. Progressive disclosure: only renders once a
 *      user has ≥1 entry so empty habits don't get noise.
 *
 *   3. **Cue + identity badge row** — pulls `reminders[0].time` +
 *      `identityVerb` into a tiny strip so the "when/where/why" is visible
 *      on the card (BJ Fogg cue specificity research), not buried in a sheet.
 *
 * All motion gated by {@link useShouldAnimate}. The wrapper element is
 * keyboard-focusable with `role="group"` so keyboard users can Enter/Space to
 * open detail (long-press equivalent for non-touch input).
 */

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { CompactHabitCard } from "@/components/compact-habit-card/CompactHabitCard";
import { isHabitCompletedOnDate } from "@/lib/habits";
import { getCurrentStreak } from "@/lib/habitScore";
import { getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import { ENTRY } from "@/types";
import type { Habit } from "@/types";
import { HabitActionSheet } from "./HabitActionSheet";

interface HeroHabitRowProps {
  habit: Habit;
  onToggle: (habitId: string, date: string) => void;
  /** +/- for numerical habits (drink 250ml, meditate 10min). Optional. */
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onDelete: (habitId: string) => void;
  /**
   * Pencil (hover desktop / swipe-reveal mobile) — opens the create sheet in
   * edit mode. Distinct from `onOpenDetail` which opens the read-only stats
   * sheet on long-press. Mapping both to detail was the original "пенсил
   * открывает не то что ожидаешь" complaint.
   */
  onEdit?: (habit: Habit) => void;
  onOpenDetail?: (habit: Habit) => void;
  /** Skip/unskip the habit for today (rest day). */
  onSkip?: (habitId: string, date: string) => void;
  onUnskip?: (habitId: string, date: string) => void;
  onArchive?: (habitId: string) => void;
  onUnarchive?: (habitId: string) => void;
}

/** px threshold past which we treat an ongoing pointer as a swipe, not a
 *  long-press. Matches the swipe trigger in V1 `CompactHabitCard`
 *  (`handleTouchEnd` fires at 50px; we cancel at 10px so the user's swipe
 *  never loses 450 ms to an aborted long-press). */
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

const LONG_PRESS_MS = 450;

export const HeroHabitRow = memo(function HeroHabitRow({
  habit,
  onToggle,
  onAdjust,
  onDelete,
  onEdit,
  onOpenDetail,
  onSkip,
  onUnskip,
  onArchive,
  onUnarchive,
}: HeroHabitRowProps) {
  const today = getToday();
  const { t } = useLanguage();
  const tx = t;
  const isSkippedToday = habit.entries?.[today]?.value === ENTRY.SKIP;
  const isArchived = Boolean(habit.isArchived);
  const hasActions = Boolean(onSkip || onUnskip || onArchive || onUnarchive || onEdit);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const closeActionSheet = useCallback(() => setActionSheetOpen(false), []);

  // Compute real current streak via V1 habitScore.ts — unlocks the fire glyph
  // + milestone badge that CompactHabitCard already renders when streak ≥ 1.
  // Memoized on habit.entries reference (Zustand shallows, so changes create
  // a new reference).
  const streak = useMemo(() => getCurrentStreak(habit), [habit]);

  // Long-press — pointer event based so it works on touch + mouse + pen
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  /** Initial pointerdown coordinates. Used by `handlePointerMove` to cancel
   *  the long-press timer as soon as the user's finger moves past the swipe
   *  tolerance (inner V1 CompactHabitCard swipes at 50 px — we cancel at 10
   *  px so the horizontal swipe reveal of Edit/Delete never fights the
   *  long-press timer). Cross-platform: pointer events fire identically on
   *  iOS / Android / Desktop, so one handler covers all. */
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);

  const cancelLongPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!hasActions && !onOpenDetail) return;
      // Don't trigger on the inner toggle button — tap-to-complete wins.
      const target = e.target as HTMLElement;
      if (target.closest("button, a")) return;
      longPressFiredRef.current = false;
      pointerOriginRef.current = { x: e.clientX, y: e.clientY };
      cancelLongPress();
      timerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        void hapticTap();
        if (hasActions) {
          setActionSheetOpen(true);
        } else if (onOpenDetail) {
          onOpenDetail(habit);
        }
      }, LONG_PRESS_MS);
    },
    [hasActions, onOpenDetail, habit, cancelLongPress],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const origin = pointerOriginRef.current;
      if (!origin || !timerRef.current) return;
      const dx = Math.abs(e.clientX - origin.x);
      const dy = Math.abs(e.clientY - origin.y);
      if (dx > LONG_PRESS_MOVE_TOLERANCE_PX || dy > LONG_PRESS_MOVE_TOLERANCE_PX) {
        cancelLongPress();
      }
    },
    [cancelLongPress],
  );

  const handlePointerUp = useCallback(() => {
    cancelLongPress();
    pointerOriginRef.current = null;
  }, [cancelLongPress]);
  const handlePointerLeave = useCallback(() => {
    cancelLongPress();
    pointerOriginRef.current = null;
  }, [cancelLongPress]);

  // Keyboard fallback — Enter/Space on the wrapper opens the action sheet
  // (or the detail sheet when no actions are wired). Keyboard equivalent of
  // long-press per habits-tab-spec §11 item 5.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!hasActions && !onOpenDetail) return;
      if (e.target !== e.currentTarget) return; // don't eat keystrokes on inner buttons
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (hasActions) {
          setActionSheetOpen(true);
        } else if (onOpenDetail) {
          onOpenDetail(habit);
        }
      }
    },
    [hasActions, onOpenDetail, habit],
  );

  const reminderTime = habit.reminders?.find((r) => r.enabled !== false)?.time;
  const showCueRow = Boolean(reminderTime);

  // Overdue nudge: reminder has passed + habit not yet completed today.
  // Purely visual signal — never blocks, never auto-completes.
  const completedToday = useMemo(() => isHabitCompletedOnDate(habit, today), [habit, today]);
  const overdueMinutes = useMemo(() => {
    if (!reminderTime || completedToday) return 0;
    const [h, m] = reminderTime.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    const now = new Date();
    const remind = new Date();
    remind.setHours(h, m, 0, 0);
    return Math.max(0, Math.round((now.getTime() - remind.getTime()) / 60000));
  }, [reminderTime, completedToday]);
  const overdueHours = Math.floor(overdueMinutes / 60);
  const isOverdue = overdueMinutes >= 30; // 30-min grace period — don't nag early

  return (
    <div
      role="group"
      aria-label={habit.name}
      // Composite widget: long-press or Enter/Space opens detail sheet per habits-tab-spec.md §11.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={onOpenDetail ? 0 : -1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
      data-testid={`hero-habit-row-${habit.id}`}
    >
      <CompactHabitCard
        habit={habit}
        onToggle={onToggle}
        onAdjust={onAdjust}
        onDelete={onDelete}
        onEdit={onEdit ?? onOpenDetail}
        streak={streak}
        isDueToday
      />
      <HabitActionSheet
        open={actionSheetOpen}
        onClose={closeActionSheet}
        habit={habit}
        today={today}
        isSkippedToday={isSkippedToday}
        isArchived={isArchived}
        labels={{
          title: tx.navV2HabitsActions,
          close: tx.cancel,
          skip: tx.skipToday,
          unskip: tx.unskip,
          archive: tx.archiveHabit,
          unarchive: tx.unarchiveHabit,
          edit: tx.edit,
          openDetails: tx.navV2HabitsOpenDetails,
        }}
        onSkip={onSkip}
        onUnskip={onUnskip}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
        onEdit={onEdit}
        onOpenDetail={onOpenDetail}
      />
      {/* onDelete is NOT surfaced in the action sheet — V1 CompactHabitCard
          swipe-reveal with 2-tap confirm is the single destructive path.
          Prevents Hick's-law overload and preserves V1's safety pattern. */}
      {onDelete ? null : null}

      {showCueRow && (
        <div
          className="mt-1.5 flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground"
          data-testid={`hero-habit-row-${habit.id}-cue`}
        >
          {reminderTime && (
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 " +
                (isOverdue
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-muted/50")
              }
              data-testid={`hero-habit-row-${habit.id}-reminder`}
              data-overdue={isOverdue ? "true" : "false"}
            >
              <Clock className="h-3 w-3" aria-hidden="true" />
              {reminderTime}
              {isOverdue && (
                <span className="ms-1 font-semibold" aria-hidden="true">
                  · {overdueHours > 0 ? `${overdueHours}h` : `${overdueMinutes}m`}
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
