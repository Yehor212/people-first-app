/**
 * AddHabitSheet — Bottom sheet for creating/editing a habit.
 * Uses useHabitForm for Loop-faithful Habit creation.
 * Two paths: template quick-start (pre-fills form) or custom creation.
 *
 * Loop-style: 20-color palette (index-based), frequency ratio, question prompt.
 * Deep Space aesthetic.
 */

import { useCallback, useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useHabitForm, habitIcons, habitCategories, frequencyPresets } from '@/hooks/useHabitForm';
import { LOOP_PALETTE_LIGHT } from '@/lib/habitColorUtils';
import { habitTemplates } from '@/lib/habitTemplates';
import type { Habit, LoopHabitType, HabitFrequencyRatio } from '@/types';

const CATEGORY_I18N: Record<string, string> = {
  health: 'categoryHealth',
  mindfulness: 'categoryMindfulness',
  productivity: 'categoryProductivity',
  social: 'categorySocial',
  creativity: 'categoryCreativity',
  finance: 'categoryFinance',
  'self-care': 'categorySelfCare',
  other: 'categoryOther',
};

interface AddHabitSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (habit: Habit) => void;
  onUpdate?: (habit: Habit) => void;
  editingHabit?: Habit | null;
}

export function AddHabitSheet({ open, onClose, onAdd, onUpdate, editingHabit }: AddHabitSheetProps) {
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

  useBackHandler(open, () => { resetForm(); onClose(); });

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Check if frequency matches a preset
  const isPresetMatch = (preset: HabitFrequencyRatio) =>
    frequency.numerator === preset.numerator && frequency.denominator === preset.denominator;

  const isCustomFreq = !frequencyPresets.some(p => isPresetMatch(p.ratio));

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="bottom"
        className={cn(
          'max-h-[85dvh] rounded-t-3xl overflow-y-auto',
          'bg-[#0a0f1a] border-t border-white/[0.06]',
          'p-0',
        )}
      >
        <div
          className="px-6 pt-6 space-y-5"
          style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* ═══ HEADER ═══ */}
          <div className="flex items-center gap-3">
            {showCustomForm && !isEditing && (
              <button
                onClick={resetForm}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.05] border border-white/[0.08] min-h-[44px] min-w-[44px]"
              >
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <SheetTitle className="text-lg font-semibold text-slate-100">
              {isEditing ? (ts.editHabit || 'Edit Habit') : (ts.addHabit || 'Add Habit')}
            </SheetTitle>
          </div>

          {/* ═══ TEMPLATES GRID ═══ */}
          {!showCustomForm && !isEditing && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">
                  {ts.quickStart || 'Quick Start'}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {habitTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => handleQuickAdd(tmpl.id)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
                        'bg-white/[0.03] border border-white/[0.06]',
                        'hover:bg-white/[0.06] active:scale-95',
                        'min-h-[44px]',
                      )}
                    >
                      <span className="text-xl">{tmpl.icon}</span>
                      <span className="text-[10px] text-slate-400 leading-tight text-center line-clamp-1">
                        {tmpl.names[language] || tmpl.names.en}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider + custom button */}
              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-white/[0.06]" />
                <button
                  onClick={() => setShowCustomForm(true)}
                  className="px-4 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {ts.createCustom || 'or create custom'}
                </button>
                <div className="flex-1 border-t border-white/[0.06]" />
              </div>
            </>
          )}

          {/* ═══ CUSTOM FORM ═══ */}
          {showCustomForm && (
            <>
              {/* Name */}
              <div>
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder={ts.habitNamePlaceholder || 'Enter habit name...'}
                  autoFocus
                  className={cn(
                    'w-full px-4 py-3 rounded-xl text-sm text-slate-100',
                    'bg-white/[0.05] border border-white/[0.08] transition-colors',
                    'placeholder:text-slate-600',
                    'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
                  )}
                />
              </div>

              {/* Question prompt */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">
                  {ts.questionPrompt || 'Question Prompt'}
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={ts.questionPromptPlaceholder || 'e.g. Did you exercise today?'}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl text-xs text-slate-300',
                    'bg-white/[0.03] border border-white/[0.06] transition-colors',
                    'placeholder:text-slate-600',
                    'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
                  )}
                />
                <p className="text-[10px] text-slate-600 mt-1">
                  {ts.questionPromptHint || 'Optional — phrased as a daily check-in question'}
                </p>
              </div>

              {/* Icon */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">
                  {ts.selectIcon || 'Icon'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {habitIcons.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setSelectedIcon(ic)}
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all',
                        'border min-h-[44px]',
                        selectedIcon === ic
                          ? 'bg-violet-500/20 border-violet-500/40 scale-110'
                          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]',
                      )}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color — 4×5 palette grid */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">
                  {ts.selectColor || 'Color'}
                </label>
                <div className="grid grid-cols-10 gap-2">
                  {LOOP_PALETTE_LIGHT.map((hex, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedColorIndex(idx)}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center',
                        'border',
                        selectedColorIndex === idx
                          ? 'scale-110 ring-2 ring-white/30 border-transparent'
                          : 'border-white/[0.06]',
                      )}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Type: Boolean / Numerical */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">
                  {ts.habitType || 'Type'}
                </label>
                <div className="flex gap-2">
                  {(['boolean', 'numerical'] as LoopHabitType[]).map((typ) => {
                    const label = typ === 'boolean'
                      ? (ts.habitTypeBoolean || 'Yes/No')
                      : (ts.habitTypeNumerical || 'Measurable');
                    return (
                      <button
                        key={typ}
                        onClick={() => setHabitType(typ)}
                        className={cn(
                          'flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[44px]',
                          'border',
                          habitType === typ
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                            : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06]',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Numerical target + unit */}
                {habitType === 'numerical' && (
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-500">{ts.dailyTarget || 'Target'}:</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTargetValue(Math.max(0, targetValue - 1))}
                          className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-400 flex items-center justify-center min-h-[44px] min-w-[44px]"
                        >
                          -
                        </button>
                        <span className="text-sm text-slate-200 w-8 text-center">{targetValue}</span>
                        <button
                          onClick={() => setTargetValue(targetValue + 1)}
                          className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-400 flex items-center justify-center min-h-[44px] min-w-[44px]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-500">{ts.unit || 'Unit'}:</label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="L, km, min..."
                        className={cn(
                          'flex-1 px-3 py-2 rounded-xl text-xs text-slate-300',
                          'bg-white/[0.03] border border-white/[0.06]',
                          'placeholder:text-slate-600',
                          'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
                        )}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTargetType('atLeast')}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all',
                          'border',
                          targetType === 'atLeast'
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                            : 'bg-white/[0.03] border-white/[0.06] text-slate-400',
                        )}
                      >
                        {ts.atLeast || 'At Least'}
                      </button>
                      <button
                        onClick={() => setTargetType('atMost')}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all',
                          'border',
                          targetType === 'atMost'
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                            : 'bg-white/[0.03] border-white/[0.06] text-slate-400',
                        )}
                      >
                        {ts.atMost || 'At Most'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Frequency */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">
                  {ts.habitFrequency || 'Frequency'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {frequencyPresets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setFrequency(preset.ratio)}
                      className={cn(
                        'px-3 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[44px]',
                        'border',
                        isPresetMatch(preset.ratio)
                          ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                          : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06]',
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setFrequency({ numerator: 3, denominator: 7 })}
                    className={cn(
                      'px-3 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[44px]',
                      'border',
                      isCustomFreq
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06]',
                    )}
                  >
                    {ts.custom || 'Custom'}
                  </button>
                </div>

                {/* Custom ratio picker */}
                {isCustomFreq && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setFrequency({ ...frequency, numerator: Math.max(1, frequency.numerator - 1) })}
                        className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-400 flex items-center justify-center text-xs min-h-[44px] min-w-[44px]"
                      >
                        -
                      </button>
                      <span className="text-sm text-slate-200 w-5 text-center tabular-nums">{frequency.numerator}</span>
                      <button
                        onClick={() => setFrequency({ ...frequency, numerator: frequency.numerator + 1 })}
                        className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-400 flex items-center justify-center text-xs min-h-[44px] min-w-[44px]"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs text-slate-500">{ts.timesPer || 'times per'}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setFrequency({ ...frequency, denominator: Math.max(1, frequency.denominator - 1) })}
                        className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-400 flex items-center justify-center text-xs min-h-[44px] min-w-[44px]"
                      >
                        -
                      </button>
                      <span className="text-sm text-slate-200 w-5 text-center tabular-nums">{frequency.denominator}</span>
                      <button
                        onClick={() => setFrequency({ ...frequency, denominator: frequency.denominator + 1 })}
                        className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-400 flex items-center justify-center text-xs min-h-[44px] min-w-[44px]"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs text-slate-500">{ts.days || 'days'}</span>
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">
                  {ts.habitCategory || 'Category'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {habitCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        'border flex items-center gap-1.5',
                        selectedCategory === cat.id
                          ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                          : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:bg-white/[0.06]',
                      )}
                    >
                      <span>{cat.icon}</span>
                      <span>{ts[CATEGORY_I18N[cat.id]] || cat.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                    'bg-white/[0.05] border border-white/[0.08] text-slate-400',
                    'hover:bg-white/[0.08]',
                  )}
                >
                  {ts.cancel || 'Cancel'}
                </button>
                <button
                  onClick={submitHabit}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                    'bg-violet-600 text-white',
                    'hover:bg-violet-500 active:scale-[0.98]',
                  )}
                >
                  {ts.save || 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
