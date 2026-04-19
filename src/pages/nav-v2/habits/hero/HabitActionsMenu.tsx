/**
 * HabitActionsMenu — ⋯ button + Radix DropdownMenu over the top-right corner
 * of a habit row. Gives Skip/Archive/Delete the visible affordance the hidden
 * swipe never had (the "discoverability=0" item from the V1↔V2 MCP audit).
 *
 * Cross-platform:
 *   - Radix DropdownMenu uses pointer events and handles click-outside,
 *     Escape, and touch in the same primitive across iOS/Android/Desktop.
 *   - Trigger is a real `<button>` so HeroHabitRow's `target.closest("button")`
 *     guard in handlePointerDown already suppresses long-press on tap here.
 *   - Trigger is 44 × 44 px (Law 9 touch-target).
 *   - `event.stopPropagation()` on the trigger's pointerdown keeps the menu
 *     open from ever feeding into the wrapper's long-press timer, even on
 *     devices where the closest("button") check might run late.
 */
import { memo, useCallback } from "react";
import { MoreVertical } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { hapticTap } from "@/lib/haptics";
import type { Habit } from "@/types";

export interface HabitActionsMenuLabels {
  menu: string;
  skip: string;
  unskip: string;
  archive: string;
  unarchive: string;
  delete: string;
}

export interface HabitActionsMenuProps {
  habit: Habit;
  today: string;
  isSkippedToday: boolean;
  isArchived: boolean;
  labels: HabitActionsMenuLabels;
  onSkip?: (habitId: string, date: string) => void;
  onUnskip?: (habitId: string, date: string) => void;
  onArchive?: (habitId: string) => void;
  onUnarchive?: (habitId: string) => void;
  onDelete?: (habitId: string) => void;
}

export const HabitActionsMenu = memo(function HabitActionsMenu({
  habit,
  today,
  isSkippedToday,
  isArchived,
  labels,
  onSkip,
  onUnskip,
  onArchive,
  onUnarchive,
  onDelete,
}: HabitActionsMenuProps) {
  const stop = useCallback((e: React.PointerEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={labels.menu}
          data-testid={`hero-habit-row-${habit.id}-menu`}
          className="absolute end-2 top-2 z-[2] inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-colors"
          onPointerDown={stop}
          onKeyDown={stop}
        >
          <MoreVertical className="h-5 w-5" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[70] min-w-[10rem] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg [-webkit-backdrop-filter:blur(4px)] backdrop-blur-sm"
          data-testid={`hero-habit-row-${habit.id}-menu-content`}
        >
          {isSkippedToday
            ? onUnskip && (
                <DropdownMenu.Item
                  onSelect={() => {
                    void hapticTap();
                    onUnskip(habit.id, today);
                  }}
                  className="flex min-h-[44px] cursor-pointer select-none items-center rounded-lg px-3 text-sm text-foreground outline-none data-[highlighted]:bg-muted"
                  data-testid={`hero-habit-row-${habit.id}-menu-unskip`}
                >
                  {labels.unskip}
                </DropdownMenu.Item>
              )
            : onSkip && (
                <DropdownMenu.Item
                  onSelect={() => {
                    void hapticTap();
                    onSkip(habit.id, today);
                  }}
                  className="flex min-h-[44px] cursor-pointer select-none items-center rounded-lg px-3 text-sm text-foreground outline-none data-[highlighted]:bg-muted"
                  data-testid={`hero-habit-row-${habit.id}-menu-skip`}
                >
                  {labels.skip}
                </DropdownMenu.Item>
              )}
          {isArchived
            ? onUnarchive && (
                <DropdownMenu.Item
                  onSelect={() => {
                    void hapticTap();
                    onUnarchive(habit.id);
                  }}
                  className="flex min-h-[44px] cursor-pointer select-none items-center rounded-lg px-3 text-sm text-foreground outline-none data-[highlighted]:bg-muted"
                  data-testid={`hero-habit-row-${habit.id}-menu-unarchive`}
                >
                  {labels.unarchive}
                </DropdownMenu.Item>
              )
            : onArchive && (
                <DropdownMenu.Item
                  onSelect={() => {
                    void hapticTap();
                    onArchive(habit.id);
                  }}
                  className="flex min-h-[44px] cursor-pointer select-none items-center rounded-lg px-3 text-sm text-foreground outline-none data-[highlighted]:bg-muted"
                  data-testid={`hero-habit-row-${habit.id}-menu-archive`}
                >
                  {labels.archive}
                </DropdownMenu.Item>
              )}
          {onDelete && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={() => {
                  void hapticTap();
                  onDelete(habit.id);
                }}
                className="flex min-h-[44px] cursor-pointer select-none items-center rounded-lg px-3 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
                data-testid={`hero-habit-row-${habit.id}-menu-delete`}
              >
                {labels.delete}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
});
