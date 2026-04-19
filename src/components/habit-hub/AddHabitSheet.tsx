/**
 * AddHabitSheet — Bottom sheet for creating/editing a habit.
 * Uses useHabitForm for Loop-faithful Habit creation.
 * Two paths: template quick-start (pre-fills form) or custom creation.
 *
 * Loop-style: 20-color palette (index-based), frequency ratio, question prompt.
 * Deep Space aesthetic.
 */

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyboardShift } from '@/hooks/useKeyboardShift';
import { zenMotion } from '@/lib/animationUtils';
import { ChevronLeft, Sparkles, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useHabitForm } from '@/hooks/useHabitForm';
import { resolveHabitColor } from '@/lib/habitColorUtils';
import { habitTemplates } from '@/lib/habitTemplates';
import { LIMITS } from '@/lib/constants';
import { AddHabitCustomForm } from './AddHabitCustomForm';
import type { Habit } from '@/types';

interface AddHabitSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (habit: Habit) => void;
  onUpdate?: (habit: Habit) => void;
  editingHabit?: Habit | null;
  activeHabitCount?: number;
}

export function AddHabitSheet({ open, onClose, onAdd, onUpdate, editingHabit, activeHabitCount = 0 }: AddHabitSheetProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const isEditing = !!editingHabit;

  const handleHabitCreated = useCallback((habit: Habit) => {
    onAdd(habit);
    onClose();
  }, [onAdd, onClose]);

  const handleHabitUpdated = useCallback((habit: Habit) => {
    onUpdate?.(habit);
    onClose();
  }, [onUpdate, onClose]);

  const {
    showCustomForm, setShowCustomForm,
    newHabitName, setNewHabitName,
    selectedIcon, setSelectedIcon,
    selectedColorIndex, setSelectedColorIndex,
    selectedCategory, setSelectedCategory,
    habitType, setHabitType,
    frequency, setFrequency,
    question, setQuestion,
    targetValue, setTargetValue,
    targetType, setTargetType,
    unit, setUnit,
    resetForm,
    handleAddHabit: submitHabit,
    handleQuickAdd,
    handleEditHabit,
  } = useHabitForm({ onAddHabit: handleHabitCreated, onUpdateHabit: handleHabitUpdated });

  // Double-tap guard for template quick-add
  const isQuickAddProcessing = useRef(false);
  useEffect(() => { if (!open) { isQuickAddProcessing.current = false; } }, [open]);

  // Pre-fill form when opening in edit mode
  const prevEditId = useRef<string | null>(null);
  useEffect(() => {
    if (open && editingHabit && editingHabit.id !== prevEditId.current) {
      prevEditId.current = editingHabit.id;
      handleEditHabit(editingHabit);
    }
    if (!open) {
      prevEditId.current = null;
    }
  }, [open, editingHabit, handleEditHabit]);

  // Android back: custom form (non-edit) → return to template picker; otherwise close
  useBackHandler(open && showCustomForm && !isEditing, () => { setShowCustomForm(false); });
  useBackHandler(open && (!showCustomForm || isEditing), () => { resetForm(); onClose(); });
  const keyboardOffset = useKeyboardShift(open);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const isAtLimit = !isEditing && activeHabitCount >= LIMITS.MAX_HABITS;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="bottom"
        className={cn(
          'max-h-[85dvh] rounded-t-3xl overflow-y-auto',
          'bg-card border-t border-border',
          'p-0',
        )}
      >
        <div
          className="px-6 pt-6 space-y-5"
          style={{ paddingBottom: `calc(2rem + env(safe-area-inset-bottom, 0px) + ${keyboardOffset}px)` }}
        >
          {/* ═══ HEADER ═══ */}
          <div className="flex items-center gap-3">
            {showCustomForm && !isEditing && (
              <button
                onClick={resetForm}
                aria-label={ts.back || 'Back'}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/[0.10] min-h-[44px] min-w-[44px] hover:bg-white/[0.10] motion-safe:transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground rtl:scale-x-[-1]" />
              </button>
            )}
            <SheetTitle className="text-lg font-bold text-foreground tracking-tight">
              {isEditing ? (ts.editHabit || 'Edit Habit') : (ts.addHabit || 'Add Habit')}
            </SheetTitle>
          </div>

          {/* ═══ LIMIT WARNING ═══ */}
          {isAtLimit && (
            <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs text-center">
              {ts.habitLimitReached || `Maximum ${LIMITS.MAX_HABITS} habits reached. Archive or delete existing habits to add new ones.`}
            </div>
          )}

          {/* ═══ TEMPLATES / CUSTOM FORM (crossfade) ═══ */}
          <AnimatePresence mode="wait" initial={false}>
          {!showCustomForm && !isEditing && (
            <motion.div
              key="templates"
              initial={{ opacity: 0, x: (language === 'ar' || language === 'he') ? 16 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: (language === 'ar' || language === 'he') ? 16 : -16 }}
              transition={zenMotion.gentle}
              className="space-y-5"
            >
              {/* Section header with sparkle + gradient line */}
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-muted-foreground">
                  {ts.quickStart || 'Quick Start'}
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-violet-500/30 to-transparent" />
              </div>

              {/* Premium template grid — 3 columns, glow cards */}
              <div className="grid grid-cols-3 gap-3">
                {habitTemplates.map((tmpl) => {
                  const color = resolveHabitColor(tmpl.color);
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => { if (isAtLimit || isQuickAddProcessing.current) return; isQuickAddProcessing.current = true; handleQuickAdd(tmpl.id); }}
                      disabled={isAtLimit}
                      className={cn(
                        'flex flex-col items-center justify-center gap-3 p-4 rounded-2xl motion-safe:transition-all',
                        'bg-white/[0.04] border border-white/[0.08]',
                        'hover:bg-white/[0.07] hover:scale-[1.03] active:scale-95',
                        'min-h-[104px] relative overflow-hidden group',
                      )}
                    >
                      {/* Colored glow orb — ambient background */}
                      <div
                        className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full opacity-[0.10] blur-2xl group-hover:opacity-[0.18] motion-safe:transition-opacity"
                        style={{ backgroundColor: color }}
                      />

                      {/* Emoji — large with drop shadow */}
                      <span className="text-3xl relative z-10 drop-shadow-lg">
                        {tmpl.icon}
                      </span>

                      {/* Localized name */}
                      <span className="text-[11px] font-medium text-muted-foreground relative z-10 text-center leading-tight line-clamp-2 group-hover:text-muted-foreground motion-safe:transition-colors">
                        {tmpl.names[language] || tmpl.names.en}
                      </span>

                      {/* Bottom accent line in habit color */}
                      <div
                        className="absolute bottom-0 start-4 end-4 h-[2px] rounded-full opacity-30 group-hover:opacity-50 motion-safe:transition-opacity"
                        style={{ backgroundColor: color }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Divider + create custom pill button */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                <button
                  onClick={() => setShowCustomForm(true)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium motion-safe:transition-all min-h-[44px]',
                    'text-violet-400 hover:text-violet-300',
                    'border border-violet-500/20 bg-violet-500/[0.06]',
                    'hover:bg-violet-500/[0.10] hover:border-violet-500/30',
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {ts.createCustom || 'or create custom'}
                </button>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/[0.06] to-transparent" />
              </div>
            </motion.div>
          )}

          {/* ═══ CUSTOM FORM ═══ */}
          {showCustomForm && (
            <AddHabitCustomForm
              newHabitName={newHabitName}
              setNewHabitName={setNewHabitName}
              selectedIcon={selectedIcon}
              setSelectedIcon={setSelectedIcon}
              selectedColorIndex={selectedColorIndex}
              setSelectedColorIndex={setSelectedColorIndex}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              habitType={habitType}
              setHabitType={setHabitType}
              frequency={frequency}
              setFrequency={setFrequency}
              question={question}
              setQuestion={setQuestion}
              targetValue={targetValue}
              setTargetValue={setTargetValue}
              targetType={targetType}
              setTargetType={setTargetType}
              unit={unit}
              setUnit={setUnit}
              submitHabit={submitHabit}
              handleClose={handleClose}
              isAtLimit={isAtLimit}
            />
          )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
