/**
 * AddHabitCustomForm — Custom habit creation form for AddHabitSheet.
 * Deep Space aesthetic.
 */

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { zenMotion } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { habitIcons, habitCategories } from '@/hooks/useHabitForm';
import { LOOP_PALETTE_LIGHT } from '@/lib/habitColorUtils';
import { AddHabitFrequencySection } from './AddHabitFrequencySection';
import type { LoopHabitType, HabitFrequencyRatio, HabitCategory } from '@/types';

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

interface AddHabitCustomFormProps {
  newHabitName: string;
  setNewHabitName: (v: string) => void;
  selectedIcon: string;
  setSelectedIcon: (v: string) => void;
  selectedColorIndex: number;
  setSelectedColorIndex: (v: number) => void;
  selectedCategory: HabitCategory;
  setSelectedCategory: (v: HabitCategory) => void;
  habitType: LoopHabitType;
  setHabitType: (v: LoopHabitType) => void;
  frequency: HabitFrequencyRatio;
  setFrequency: (v: HabitFrequencyRatio) => void;
  question: string;
  setQuestion: (v: string) => void;
  targetValue: number;
  setTargetValue: (v: number) => void;
  targetType: 'atLeast' | 'atMost';
  setTargetType: (v: 'atLeast' | 'atMost') => void;
  unit: string;
  setUnit: (v: string) => void;
  submitHabit: () => void;
  handleClose: () => void;
  isAtLimit: boolean;
}

export function AddHabitCustomForm({
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
  submitHabit,
  handleClose,
  isAtLimit,
}: AddHabitCustomFormProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  return (
    <motion.div
      key="custom-form"
      initial={{ opacity: 0, x: (language === 'ar' || language === 'he') ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: (language === 'ar' || language === 'he') ? -16 : 16 }}
      transition={zenMotion.gentle}
      className="space-y-5"
    >
      {/* Name */}
      <div>
        <input
          type="text"
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
          maxLength={100}
          placeholder={ts.habitNamePlaceholder || 'Enter habit name...'}
          aria-label={ts.habitName || 'Habit name'}
          autoFocus
          className={cn(
            'min-h-[44px] w-full rounded-xl px-4 py-3 text-sm text-foreground',
            'bg-foreground/[0.05] border border-border motion-safe:transition-colors',
            'placeholder:text-muted-foreground/60',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
          )}
        />
      </div>

      {/* Question prompt */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {ts.questionPrompt || 'Question Prompt'}
        </label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={ts.questionPromptPlaceholder || 'e.g. Did you exercise today?'}
          aria-label={ts.questionPrompt || 'Question Prompt'}
          className={cn(
            'min-h-[44px] w-full rounded-xl px-4 py-2 text-xs text-muted-foreground',
            'bg-foreground/[0.03] border border-border motion-safe:transition-colors',
            'placeholder:text-muted-foreground/60',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
          )}
        />
        <p className="mt-1 whitespace-normal break-words text-xs text-muted-foreground/60">
          {ts.questionPromptHint || 'Optional — phrased as a daily check-in question'}
        </p>
      </div>

      {/* Icon */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {ts.selectIcon || 'Icon'}
        </label>
        <div className="flex flex-wrap gap-2">
          {habitIcons.map((ic) => (
            <button
              key={ic}
              onClick={() => setSelectedIcon(ic)}
              aria-label={`${ts.selectIcon || 'Icon'}: ${ic}`}
              aria-pressed={selectedIcon === ic}
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center text-xl motion-safe:transition-all',
                'border min-h-[44px] min-w-[44px]',
                selectedIcon === ic
                  ? 'bg-violet-500/20 border-violet-500/40 scale-110 shadow-[0_0_12px_hsl(var(--cosmic-nebula-purple)/0.3)]'
                  : 'bg-foreground/[0.03] border-border hover:bg-foreground/[0.06]',
              )}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* Color — palette grid */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {ts.selectColor || 'Color'}
        </label>
        <div className="grid grid-cols-4 gap-2 min-[420px]:grid-cols-7">
          {LOOP_PALETTE_LIGHT.map((hex, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedColorIndex(idx)}
              aria-label={`${ts.selectColor || 'Color'} ${idx + 1}`}
              aria-pressed={selectedColorIndex === idx}
              className={cn(
                'w-7 h-7 rounded-full motion-safe:transition-all min-h-[44px] min-w-[44px] flex items-center justify-center',
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
                <Check className="w-3.5 h-3.5 text-white drop-shadow-md" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Type: Boolean / Numerical */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {ts.habitType || 'Type'}
        </label>
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {(['boolean', 'numerical'] as LoopHabitType[]).map((typ) => {
            const label = typ === 'boolean'
              ? (ts.habitTypeBoolean || 'Yes/No')
              : (ts.habitTypeNumerical || 'Measurable');
            return (
              <button
                key={typ}
                onClick={() => setHabitType(typ)}
                aria-pressed={habitType === typ}
                className={cn(
                  'min-h-[44px] whitespace-normal break-words rounded-xl px-3 py-2 text-xs font-medium motion-safe:transition-all',
                  'border',
                  habitType === typ
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-foreground/[0.03] border-border text-muted-foreground hover:bg-foreground/[0.06]',
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
            <div className="flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
              <label className="text-xs text-muted-foreground">{ts.dailyTarget || 'Target'}:</label>
              <div className="flex items-center justify-between gap-2 min-[420px]:justify-start">
                <button
                  onClick={() => setTargetValue(Math.max(1, targetValue - 1))}
                  aria-label={ts.decreaseTarget || 'Decrease target'}
                  className="w-8 h-8 rounded-lg bg-foreground/[0.05] border border-border text-muted-foreground flex items-center justify-center min-h-[44px] min-w-[44px]"
                >
                  -
                </button>
                <span className="text-sm text-foreground w-8 text-center">{targetValue}</span>
                <button
                  onClick={() => setTargetValue(targetValue + 1)}
                  aria-label={ts.increaseTarget || 'Increase target'}
                  className="w-8 h-8 rounded-lg bg-foreground/[0.05] border border-border text-muted-foreground flex items-center justify-center min-h-[44px] min-w-[44px]"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
              <label className="text-xs text-muted-foreground">{ts.unit || 'Unit'}:</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={ts.unitPlaceholder || 'L, km, min...'}
                maxLength={20}
                className={cn(
                  'min-h-[44px] flex-1 rounded-xl px-3 py-2 text-xs text-muted-foreground',
                  'bg-foreground/[0.03] border border-border',
                  'placeholder:text-muted-foreground/60',
                  'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              <button
                onClick={() => setTargetType('atLeast')}
                aria-pressed={targetType === 'atLeast'}
                className={cn(
                  'min-h-[44px] whitespace-normal break-words rounded-xl px-3 py-2 text-xs font-medium motion-safe:transition-all',
                  'border',
                  targetType === 'atLeast'
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-foreground/[0.03] border-border text-muted-foreground',
                )}
              >
                {ts.atLeast || 'At Least'}
              </button>
              <button
                onClick={() => setTargetType('atMost')}
                aria-pressed={targetType === 'atMost'}
                className={cn(
                  'min-h-[44px] whitespace-normal break-words rounded-xl px-3 py-2 text-xs font-medium motion-safe:transition-all',
                  'border',
                  targetType === 'atMost'
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-foreground/[0.03] border-border text-muted-foreground',
                )}
              >
                {ts.atMost || 'At Most'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Frequency */}
      <AddHabitFrequencySection frequency={frequency} setFrequency={setFrequency} ts={ts} />

      {/* Category */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          {ts.habitCategory || 'Category'}
        </label>
        <div className="flex flex-wrap gap-2">
          {habitCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              aria-pressed={selectedCategory === cat.id}
              className={cn(
                'min-h-[44px] whitespace-normal break-words rounded-xl px-3 py-2 text-xs font-medium motion-safe:transition-all',
                'flex items-center gap-1.5 border',
                selectedCategory === cat.id
                  ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg`
                  : 'bg-foreground/[0.03] border-border text-muted-foreground hover:bg-foreground/[0.06]',
              )}
            >
              <span>{cat.icon}</span>
              <span>{ts[CATEGORY_I18N[cat.id]] || cat.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 gap-2 pt-2 min-[420px]:grid-cols-2">
        <button
          onClick={handleClose}
          className={cn(
            'min-h-[44px] whitespace-normal break-words rounded-xl px-4 py-3 text-sm font-medium motion-safe:transition-colors',
            'bg-foreground/[0.05] border border-border text-muted-foreground',
            'hover:bg-foreground/[0.08]',
          )}
        >
          {ts.cancel || 'Cancel'}
        </button>
        <button
          onClick={submitHabit}
          disabled={!newHabitName.trim() || isAtLimit}
          className={cn(
            'min-h-[44px] whitespace-normal break-words rounded-xl px-4 py-3 text-sm font-semibold motion-safe:transition-all',
            'bg-gradient-to-r from-violet-600 to-purple-600 text-white',
            'hover:from-violet-500 hover:to-purple-500 active:scale-[0.98]',
            'shadow-[0_0_20px_hsl(var(--cosmic-nebula-purple)/0.25)]',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
          )}
        >
          {ts.save || 'Save'}
        </button>
      </div>
    </motion.div>
  );
}
