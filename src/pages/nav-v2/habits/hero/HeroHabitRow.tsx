/**
 * HeroHabitRow — weekly-first V2 habit row.
 *
 * Primary interaction stays on the week cells.
 * Secondary actions stay behind long-press / keyboard on the row shell.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isHabitCompletedOnDate } from "@/lib/habits";
import { getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import { V2_HABIT_JOURNEY_ICONS } from "@/lib/v2IconSystem";
import type { NumericalEntryAction } from "@/lib/habitNumericalInteraction";
import { ENTRY } from "@/types";
import type { Habit } from "@/types";
import { HabitActionSheet } from "./HabitActionSheet";
import { HeroWeeklyHabitCard } from "./HeroWeeklyHabitCard";

interface HeroHabitRowProps {
  habit: Habit;
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onNumericalAction?: (habitId: string, date: string, action: NumericalEntryAction) => void;
  onEdit?: (habit: Habit) => void;
  onOpenDetail?: (habit: Habit) => void;
  onSkip?: (habitId: string, date: string) => void;
  onUnskip?: (habitId: string, date: string) => void;
  onArchive?: (habitId: string) => void;
  onUnarchive?: (habitId: string) => void;
  onBeforeActionSheetOpen?: () => Promise<boolean>;
  onActionSheetOpenChange?: (open: boolean) => void;
  initiallyCollapsed?: boolean;
}

const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
const LONG_PRESS_MS = 450;

export const HeroHabitRow = memo(function HeroHabitRow({
  habit,
  onToggle,
  onAdjust,
  onNumericalAction,
  onEdit,
  onOpenDetail,
  onSkip,
  onUnskip,
  onArchive,
  onUnarchive,
  onBeforeActionSheetOpen,
  onActionSheetOpenChange,
  initiallyCollapsed = false,
}: HeroHabitRowProps) {
  const today = getToday();
  const { t } = useLanguage();
  const tx = t;
  const isSkippedToday = habit.entries?.[today]?.value === ENTRY.SKIP;
  const isArchived = Boolean(habit.isArchived);
  const hasActions = Boolean(
    onSkip || onUnskip || onArchive || onUnarchive || onEdit,
  );
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const closeActionSheet = useCallback(() => setActionSheetOpen(false), []);
  const actionTriggerRef = useRef<HTMLButtonElement>(null);
  const openActionSheet = useCallback(() => {
    const suppression = onBeforeActionSheetOpen?.();
    if (!suppression) {
      setActionSheetOpen(true);
      return;
    }
    void suppression.then((acknowledged) => {
      if (!acknowledged) return;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setActionSheetOpen(true);
    });
  }, [onBeforeActionSheetOpen]);

  useEffect(() => {
    if (!actionSheetOpen) return;
    onActionSheetOpenChange?.(true);
    return () => onActionSheetOpenChange?.(false);
  }, [actionSheetOpen, onActionSheetOpenChange]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
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
      const target = e.target as HTMLElement;
      if (target.closest("button, a, [role='button'], [role='checkbox']")) return;
      longPressFiredRef.current = false;
      pointerOriginRef.current = { x: e.clientX, y: e.clientY };
      cancelLongPress();
      timerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        void hapticTap();
        if (hasActions) {
          void openActionSheet();
        } else if (onOpenDetail) {
          onOpenDetail(habit);
        }
      }, LONG_PRESS_MS);
    },
    [cancelLongPress, habit, hasActions, onOpenDetail, openActionSheet],
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

  const reminderTime = habit.reminders?.find((r) => r.enabled !== false)?.time;
  const showCueRow = Boolean(reminderTime);

  const completedToday = useMemo(() => isHabitCompletedOnDate(habit, today), [habit, today]);
  const overdueMinutes = useMemo(() => {
    if (!reminderTime || completedToday) return 0;
    const [h, m] = reminderTime.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    const now = new Date();
    const remind = new Date();
    remind.setHours(h, m, 0, 0);
    return Math.max(0, Math.round((now.getTime() - remind.getTime()) / 60000));
  }, [completedToday, reminderTime]);
  const overdueHours = Math.floor(overdueMinutes / 60);
  const isOverdue = overdueMinutes >= 30;
  const ReminderIcon = V2_HABIT_JOURNEY_ICONS.reminder;
  const actionsLabel = (tx.navV2HabitsActionsFor || "Actions for {habit}").replace(
    "{habit}",
    `\u2068${habit.name}\u2069`,
  );

  return (
    <div
      role="group"
      aria-label={habit.name}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative rounded-2xl"
      data-testid={`hero-habit-row-${habit.id}`}
    >
      <HeroWeeklyHabitCard
        habit={habit}
        onToggle={onToggle}
        onAdjust={onAdjust}
        onNumericalAction={onNumericalAction}
        onOpenDetail={onOpenDetail}
        onOpenActions={hasActions ? openActionSheet : undefined}
        actionsLabel={hasActions ? actionsLabel : undefined}
        actionsTriggerRef={actionTriggerRef}
        initiallyCollapsed={initiallyCollapsed}
      />

      {actionSheetOpen && (
        <HabitActionSheet
          open={actionSheetOpen}
          onClose={closeActionSheet}
          restoreFocusTo={actionTriggerRef}
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
            openDetails: tx.statistics || tx.navV2HabitsOpenDetails,
          }}
          onSkip={onSkip}
          onUnskip={onUnskip}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onEdit={onEdit}
          onOpenDetail={onOpenDetail}
        />
      )}

      {showCueRow && (
        <div
          className="mt-1.5 flex flex-wrap items-center gap-2 whitespace-normal break-words px-1 text-xs text-muted-foreground"
          data-testid={`hero-habit-row-${habit.id}-cue`}
        >
          {reminderTime && (
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 " +
                (isOverdue
                  ? "bg-[hsl(var(--zf-warning)/0.12)] text-[hsl(var(--zf-warning-foreground))]"
                  : "bg-muted/50")
              }
              data-testid={`hero-habit-row-${habit.id}-reminder`}
              data-overdue={isOverdue ? "true" : "false"}
            >
              <ReminderIcon className="h-3 w-3" aria-hidden="true" />
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
