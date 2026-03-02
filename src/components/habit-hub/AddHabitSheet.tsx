/**
 * AddHabitSheet — Bottom sheet for creating/editing a habit.
 * Uses useHabitForm for Loop-faithful Habit creation.
 * Two paths: template quick-start (pre-fills form) or custom creation.
 *
 * Loop-style: 20-color palette (index-based), frequency ratio, question prompt.
 * Deep Space aesthetic.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useKeyboardShift } from '@/hooks/useKeyboardShift';
import { ChevronLeft, Sparkles, Plus, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useHabitForm, habitIcons, habitCategories, frequencyPresets } from '@/hooks/useHabitForm';
import { LOOP_PALETTE_LIGHT, resolveHabitColor } from '@/lib/habitColorUtils';
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
  const keyboardOffset = useKeyboardShift(open);

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
          style={{ paddingBottom: `calc(2rem + env(safe-area-inset-bottom, 0px) + ${keyboardOffset}px)` }}
        >
          {/* ═══ HEADER ═══ */}
          <div className="flex items-center gap-3">
            {showCustomForm && !isEditing && (
              <button
                onClick={resetForm}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/[0.10] min-h-[44px] min-w-[44px] hover:bg-white/[0.10] transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </button>
            )}
            <SheetTitle className="text-lg font-bold text-slate-100 tracking-tight">
              {isEditing ? (ts.editHabit || 'Edit Habit') : (ts.addHabit || 'Add Habit')}
            </SheetTitle>
          </div>

          {/* ═══ TEMPLATES GRID ═══ */}
          {!showCustomForm && !isEditing && (
            <>
              {/* Section header with sparkle + gradient line */}
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-slate-300">
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
                      onClick={() => handleQuickAdd(tmpl.id)}
                      className={cn(
                        'flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl transition-all',
                        'bg-white/[0.04] border border-white/[0.08]',
                        'hover:bg-white/[0.07] hover:scale-[1.03] active:scale-95',
                        'min-h-[104px] relative overflow-hidden group',
                      )}
                    >
                      {/* Colored glow orb — ambient background */}
                      <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full opacity-[0.10] blur-2xl group-hover:opacity-[0.18] transition-opacity"
                        style={{ backgroundColor: color }}
                      />

                      {/* Emoji — large with drop shadow */}
                      <span className="text-3xl relative z-10 drop-shadow-lg">
                        {tmpl.icon}
                      </span>

                      {/* Localized name */}
                      <span className="text-[11px] font-medium text-slate-400 relative z-10 text-center leading-tight line-clamp-2 group-hover:text-slate-300 transition-colors">
                        {tmpl.names[language] || tmpl.names.en}
                      </span>

                      {/* Bottom accent line in habit color */}
                      <div
                        className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full opacity-30 group-hover:opacity-50 transition-opacity"
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
                    'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[44px]',
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
                  aria-label={ts.habitName || 'Habit name'}
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
                  aria-label={ts.questionPrompt || 'Question Prompt'}
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
                        'w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all',
                        'border min-h-[44px] min-w-[44px]',
                        selectedIcon === ic
                          ? 'bg-violet-500/20 border-violet-500/40 scale-110 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]',
                      )}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color — palette grid */}
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
                        'w-7 h-7 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center',
                        'border',
                        selectedColorIndex === idx
                          ? 'scale-110 border-white/40'
                          : 'border-transparent hover:scale-105',
                      )}
                      style={{
                        backgroundColor: hex,
                        boxShadow: selectedColorIndex === idx ? `0 0 14px ${hex}60` : undefined,
                      }}
                    >
                      {selectedColorIndex === idx && (
                        <Check className="w-3.5 h-3.5 text-white drop-shadow-md" />
                      )}
                    </button>
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
                        placeholder={ts.unitPlaceholder || 'L, km, min...'}
                        maxLength={20}
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
                      {ts[preset.i18nKey] || preset.label}
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
                    {ts.customFreq || 'Custom'}
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
                        'px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px]',
                        'border flex items-center gap-1.5',
                        selectedCategory === cat.id
                          ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg`
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
                  disabled={!newHabitName.trim()}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all min-h-[44px]',
                    'bg-gradient-to-r from-violet-600 to-purple-600 text-white',
                    'hover:from-violet-500 hover:to-purple-500 active:scale-[0.98]',
                    'shadow-[0_0_20px_rgba(139,92,246,0.25)]',
                    'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
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
