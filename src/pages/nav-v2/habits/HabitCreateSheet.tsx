/**
 * HabitCreateSheet — vaul-driven bottom drawer that wraps
 * {@link HabitCreationForm}. Phase 3-C deliberately reuses the existing form
 * so creation parity stays guaranteed.
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
import type { HabitTemplate } from "@/lib/habitTemplates";
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
  /** Non-null puts the sheet into "template setup" mode before save. */
  template?: HabitTemplate | null;
  onAddHabit: (habit: Habit) => void;
  onUpdateHabit?: (habit: Habit) => void;
}

export function HabitCreateSheet({
  open,
  onClose,
  habits,
  editHabit,
  template,
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

  const form = useHabitForm({
    onAddHabit: handleAdd,
    onUpdateHabit: handleUpdate,
    useV2IconIds: true,
  });
  const {
    setIsAdding,
    resetForm,
    handleEditHabit: formBeginEdit,
    startFromTemplate: formBeginTemplate,
  } = form;

  // Open the form whenever the drawer opens. If an `editHabit` was passed in,
  // prefill via the shared hook's `handleEditHabit` (sets editingHabit +
  // populates every field) so submit dispatches onUpdateHabit instead of
  // onAddHabit. Reset on close so a re-open starts clean.
  useEffect(() => {
    if (open) {
      if (editHabit) {
        formBeginEdit(editHabit);
      } else if (template) {
        formBeginTemplate(template.id);
      } else {
        setIsAdding(true);
      }
    } else {
      resetForm();
    }
  }, [open, editHabit, template, setIsAdding, resetForm, formBeginEdit, formBeginTemplate]);

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
          className="fixed inset-0 z-[80] bg-[hsl(var(--zf-night-0)/0.58)] backdrop-blur-md [-webkit-backdrop-filter:blur(8px)]"
          data-testid="habits-create-sheet-overlay"
        />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[81] mt-24 flex !h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] flex-col rounded-t-[1.75rem] border border-[hsl(var(--zf-role-energy)/0.30)] bg-[radial-gradient(circle_at_16%_0%,hsl(var(--zf-role-energy)/0.12),transparent_32%),radial-gradient(circle_at_86%_6%,hsl(var(--zf-role-release)/0.09),transparent_30%),linear-gradient(160deg,hsl(var(--zf-night-0)/0.99)_0%,hsl(var(--zf-night-1)/0.98)_58%,hsl(var(--zf-night-0)/0.99)_100%)] text-[hsl(var(--zf-text-strong))] shadow-[0_-28px_90px_-52px_hsl(var(--zf-role-energy)/0.70)] outline-none md:mx-auto md:max-w-lg md:rounded-3xl"
          data-testid="habits-create-sheet"
          data-surface="habit-create-sheet"
          aria-describedby={undefined}
        >
          <div
            className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[hsl(var(--zf-role-energy)/0.34)]"
            aria-hidden="true"
          />
          <div className="flex min-w-0 items-center justify-between gap-2 ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pt-3 pb-1">
            <Drawer.Title className="min-w-0 whitespace-normal break-words font-display text-base font-semibold text-[hsl(var(--zf-text-strong))] [hyphens:manual] [overflow-wrap:break-word]">
              {editHabit ? tx.edit : tx.navV2HabitsCreate}
            </Drawer.Title>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[hsl(var(--zf-text-soft))] motion-safe:transition-colors hover:bg-[hsl(var(--zf-role-energy)/0.12)] hover:text-[hsl(var(--zf-text-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-energy)/0.62)] focus-visible:ring-offset-2"
              aria-label={tx.close}
              data-testid="habits-create-sheet-close"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pb-[max(1.5rem,var(--safe-bottom))] scroll-pb-[max(1.5rem,var(--safe-bottom))]">
            <HabitCreationForm form={form} habits={habits} presentation="v2" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
