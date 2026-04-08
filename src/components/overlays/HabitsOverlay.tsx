import { AnimatePresence, motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { cn, getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { haptics } from "@/lib/haptics";
import { zenMotion } from "@/lib/animationUtils";
import { IdentityIcon } from "@/components/IdentityIconPicker";
import type { Habit } from "@/types";

interface HabitsOverlayProps {
  open: boolean;
  habits: Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  onClose: () => void;
}

export function HabitsOverlay({
  open,
  habits,
  onToggleHabit,
  onClose,
}: HabitsOverlayProps) {
  const { t } = useLanguage();
  const today = getToday();

  const { modalRef, handleKeyDown } = useModalA11y(open, onClose);
  useScrollLock(open);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* // A11Y-OK: backdrop is decorative overlay dismissed by click — aria-hidden excludes from AT tree */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={zenMotion.gentle}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={modalRef}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label={t.habits}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={zenMotion.snappy}
            className="fixed bottom-0 inset-x-0 z-[61] max-h-[70dvh] rounded-t-[2rem] bg-card border-t border-border overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] lg:max-w-4xl lg:mx-auto"
          >
            {/* Handle bar */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="text-lg font-semibold">{t.habits}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-secondary"
                aria-label={t.close || "Close"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Habit list */}
            <div className="px-5 space-y-2 pb-4">
              {habits.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t.noHabitsYet || "No habits yet"}
                </p>
              )}
              {habits.map((habit) => {
                const completed = habit.entries?.[today]?.value === 2;
                return (
                  <button
                    key={habit.id}
                    onClick={() => {
                      void haptics.habitCompleted();
                      onToggleHabit(habit.id, today);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors min-h-[48px]",
                      "bg-surface-glass border border-[var(--surface-glass-border)]",
                      completed && "opacity-60",
                    )}
                  >
                    <IdentityIcon
                      name={habit.icon || "Target"}
                      className="w-5 h-5 shrink-0"
                    />
                    <span
                      className={cn(
                        "flex-1 text-start text-sm",
                        completed && "line-through text-muted-foreground",
                      )}
                    >
                      {habit.name}
                    </span>
                    {completed && (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
