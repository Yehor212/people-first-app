/**
 * HabitCreateSheet — vaul-driven bottom drawer that wraps the V1
 * {@link HabitCreationForm}. Phase 3-C deliberately reuses the existing form
 * so creation parity with V1 is guaranteed.
 *
 * Cross-platform constraints satisfied:
 *   - Android back: closes drawer via {@link useBackHandler} (Law 10).
 *   - Desktop: vaul renders a centred bottom sheet on >=md viewports too;
 *     `dismissible` allows backdrop click + ESC to close.
 *   - Webkit backdrop: paired alongside `backdrop-filter` for Safari/iOS.
 *   - aria-label: drawer title is read on open.
 */

import { useCallback, useEffect } from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useHabitForm } from "@/hooks/useHabitForm";
import { HabitCreationForm } from "@/components/habit-creation-form/HabitCreationForm";
import type { Habit } from "@/types";

interface HabitCreateSheetProps {
  open: boolean;
  onClose: () => void;
  habits: Habit[];
  /**
   * Non-null puts the sheet into edit mode: on open, the form is prefilled
   * from this habit via `useHabitForm.handleEditHabit`, and submit calls
   * `onUpdateHabit` instead of `onAddHabit`. Null/undefined = create mode.
   */
  editHabit?: Habit | null;
  onAddHabit: (habit: Habit) => void;
  onUpdateHabit?: (habit: Habit) => void;
}

export function HabitCreateSheet({
  open,
  onClose,
  habits,
  editHabit,
  onAddHabit,
  onUpdateHabit,
}: HabitCreateSheetProps) {
  const { t } = useLanguage();
  const tx = t;

  const handleAdd = useCallback(
    (habit: Habit) => {
      onAddHabit(habit);
      onClose();
    },
    [onAddHabit, onClose],
  );

  const handleUpdate = useCallback(
    (habit: Habit) => {
      onUpdateHabit?.(habit);
      onClose();
    },
    [onUpdateHabit, onClose],
  );

  const form = useHabitForm({ onAddHabit: handleAdd, onUpdateHabit: handleUpdate });
  const { setIsAdding, resetForm, handleEditHabit: formBeginEdit } = form;

  // Open the form whenever the drawer opens. If an `editHabit` was passed in,
  // prefill via the V1 hook's `handleEditHabit` (sets editingHabit +
  // populates every field) so submit dispatches onUpdateHabit instead of
  // onAddHabit. Reset on close so a re-open starts clean.
  useEffect(() => {
    if (open) {
      if (editHabit) {
        formBeginEdit(editHabit);
      } else {
        setIsAdding(true);
      }
    } else {
      resetForm();
    }
  }, [open, editHabit, setIsAdding, resetForm, formBeginEdit]);

  useBackHandler(open, onClose);

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
          data-testid="habits-create-sheet-overlay"
        />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[61] mt-24 flex max-h-[92vh] flex-col rounded-t-2xl border border-border bg-background outline-none md:mx-auto md:max-w-lg md:rounded-2xl md:shadow-2xl"
          data-testid="habits-create-sheet"
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
            <Drawer.Title className="font-display text-base font-semibold text-foreground">
              {editHabit ? tx.edit || "Edit" : tx.navV2HabitsCreate}
            </Drawer.Title>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={tx.cancel || "Close"}
              data-testid="habits-create-sheet-close"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <HabitCreationForm form={form} habits={habits} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
