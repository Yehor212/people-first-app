/**
 * HabitActionSheet — Vaul-driven bottom drawer of secondary habit actions.
 *
 * Replaces the always-visible ⋯ `HabitActionsMenu` button that violated
 * Hoober's thumb-zone research (top-right = red zone for 67 % of right-thumb
 * one-handed users — see `docs/audits/habits-v2-revolution-ergonomics-
 * proposal-2026-04-19.md`). Invoked via long-press on the row wrapper or
 * keyboard Enter/Space, which is gesture-based and zone-independent.
 *
 * Action hierarchy (items appear top-to-bottom when the corresponding handler
 * is provided):
 *   - Skip today / Unskip (conditional flip on `isSkippedToday`)
 *   - Archive / Unarchive (conditional flip on `isArchived`)
 *   - Edit habit
 *   - Open details (read-only stats)
 *
 * Delete is NOT included here — V1 swipe-reveal owns destructive Delete with
 * its 2-tap confirmation (CompactHabitCard.tsx:173-200). Two paths would
 * violate Hick's law; one safe path (swipe) is enough.
 *
 * Cross-platform:
 *   - Android back: Vaul's internal handler plus `useBackHandler` fallback
 *     on parent row. Law 10 satisfied.
 *   - Desktop: Vaul renders a centred bottom sheet on ≥ md viewports too.
 *   - Webkit backdrop-filter paired with standard for Safari.
 *   - All items ≥ 44 × 44 px (Law 9).
 */

import { memo, useCallback } from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { hapticTap } from "@/lib/haptics";
import type { Habit } from "@/types";

export interface HabitActionSheetLabels {
  /** Sheet title announced to screen readers. */
  title: string;
  close: string;
  skip: string;
  unskip: string;
  archive: string;
  unarchive: string;
  edit: string;
  openDetails: string;
  delete: string;
}

export interface HabitActionSheetProps {
  open: boolean;
  onClose: () => void;
  habit: Habit;
  today: string;
  isSkippedToday: boolean;
  isArchived: boolean;
  labels: HabitActionSheetLabels;
  onSkip?: (habitId: string, date: string) => void;
  onUnskip?: (habitId: string, date: string) => void;
  onArchive?: (habitId: string) => void;
  onUnarchive?: (habitId: string) => void;
  onEdit?: (habit: Habit) => void;
  onOpenDetail?: (habit: Habit) => void;
  onDelete?: (habitId: string) => void;
}

const ITEM_CLASS =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-foreground outline-none min-h-[44px] motion-safe:transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const DELETE_ITEM_CLASS =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-destructive outline-none min-h-[44px] motion-safe:transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2";

export const HabitActionSheet = memo(function HabitActionSheet({
  open,
  onClose,
  habit,
  today,
  isSkippedToday,
  isArchived,
  labels,
  onSkip,
  onUnskip,
  onArchive,
  onUnarchive,
  onEdit,
  onOpenDetail,
  onDelete,
}: HabitActionSheetProps) {
  const fire = useCallback(
    (fn: () => void) => {
      void hapticTap();
      fn();
      onClose();
    },
    [onClose],
  );

  const showSkipItem = isSkippedToday ? Boolean(onUnskip) : Boolean(onSkip);
  const showArchiveItem = isArchived ? Boolean(onUnarchive) : Boolean(onArchive);
  const showEditItem = Boolean(onEdit);
  const showDetailsItem = Boolean(onOpenDetail);
  const showDeleteItem = Boolean(onDelete);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
          data-testid={`habit-action-sheet-${habit.id}-overlay`}
        />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[61] mt-24 flex flex-col rounded-t-2xl border border-border bg-background outline-none md:mx-auto md:max-w-lg md:rounded-2xl md:shadow-2xl"
          data-testid={`habit-action-sheet-${habit.id}`}
          aria-describedby={undefined}
        >
          <div
            className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted"
            aria-hidden="true"
          />
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
            <Drawer.Title className="font-display text-base font-semibold text-foreground">
              {labels.title}
            </Drawer.Title>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={labels.close}
              data-testid={`habit-action-sheet-${habit.id}-close`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p
            className="px-4 pb-3 text-xs text-muted-foreground"
            data-testid={`habit-action-sheet-${habit.id}-subtitle`}
          >
            <span aria-hidden="true">{habit.icon} </span>
            {habit.name}
          </p>
          <div className="flex flex-col gap-1 px-2 pb-4">
            {showSkipItem && (
              <button
                type="button"
                className={ITEM_CLASS}
                data-testid={`habit-action-sheet-${habit.id}-${isSkippedToday ? "unskip" : "skip"}`}
                onClick={() =>
                  fire(() => {
                    if (isSkippedToday) {
                      onUnskip?.(habit.id, today);
                    } else {
                      onSkip?.(habit.id, today);
                    }
                  })
                }
              >
                {isSkippedToday ? labels.unskip : labels.skip}
              </button>
            )}
            {showArchiveItem && (
              <button
                type="button"
                className={ITEM_CLASS}
                data-testid={`habit-action-sheet-${habit.id}-${isArchived ? "unarchive" : "archive"}`}
                onClick={() =>
                  fire(() => {
                    if (isArchived) {
                      onUnarchive?.(habit.id);
                    } else {
                      onArchive?.(habit.id);
                    }
                  })
                }
              >
                {isArchived ? labels.unarchive : labels.archive}
              </button>
            )}
            {showEditItem && (
              <button
                type="button"
                className={ITEM_CLASS}
                data-testid={`habit-action-sheet-${habit.id}-edit`}
                onClick={() => fire(() => onEdit?.(habit))}
              >
                {labels.edit}
              </button>
            )}
            {showDetailsItem && (
              <button
                type="button"
                className={ITEM_CLASS}
                data-testid={`habit-action-sheet-${habit.id}-details`}
                onClick={() => fire(() => onOpenDetail?.(habit))}
              >
                {labels.openDetails}
              </button>
            )}
            {showDeleteItem && (
              <button
                type="button"
                className={DELETE_ITEM_CLASS}
                data-testid={`habit-action-sheet-${habit.id}-delete`}
                onClick={() => fire(() => onDelete?.(habit.id))}
              >
                {labels.delete}
              </button>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
});
