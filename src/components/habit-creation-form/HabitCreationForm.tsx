import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HabitType, HabitCategory } from '@/types';
import { cn } from '@/lib/utils';
import { safeParseInt } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { habitIcons, habitColors, habitCategories } from '@/hooks/useHabitForm';
import type { useHabitForm } from '@/hooks/useHabitForm';
import type { Habit } from '@/types';
import { TemplatePicker } from './TemplatePicker';
import { RemindersSection } from './RemindersSection';

interface HabitCreationFormProps {
  form: ReturnType<typeof useHabitForm>;
  habits: Habit[];
  isPrimaryCTA?: boolean;
}

export function HabitCreationForm({ form, habits, isPrimaryCTA = false }: HabitCreationFormProps) {
  const { t, language } = useLanguage();
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => { if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current); };
  }, []);

  const {
    isAdding, showCustomForm, editingHabit,
    newHabitName, selectedIcon, selectedColor, selectedType, selectedCategory,
    dailyTarget, reminders,
    setShowCustomForm, setNewHabitName, setSelectedIcon, setSelectedColor,
    setSelectedType, setSelectedCategory, setDailyTarget,
    resetForm, handleAddHabit, handleQuickAdd,
    handleAddReminder, handleRemoveReminder, handleReminderChange,
  } = form;

  if (!isAdding) return null;

  // Template picker view
  if (!showCustomForm) {
    return (
      <TemplatePicker
        isPrimaryCTA={isPrimaryCTA}
        habits={habits}
        language={language}
        t={t as unknown as Record<string, string>}
        handleQuickAdd={handleQuickAdd}
        setShowCustomForm={setShowCustomForm}
      />
    );
  }

  // Custom form view
  return (
    <motion.div
      className={cn(
        "mb-4 p-4 rounded-2xl relative overflow-hidden",
        isPrimaryCTA
          ? "bg-foreground/5 backdrop-blur-sm border border-foreground/10"
          : "bg-secondary"
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Premium cosmic background */}
      {isPrimaryCTA && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at top,
              rgba(139, 92, 246, 0.1) 0%, transparent 50%)`
          }}
        />
      )}

      {/* Back/Cancel button */}
      <motion.button
        onClick={() => {
          if (editingHabit) { resetForm(); } else { setShowCustomForm(false); }
        }}
        className={cn(
          "relative text-sm mb-3 flex items-center gap-1 transition-colors",
          isPrimaryCTA
            ? "text-slate-500 dark:text-foreground/60 hover:text-slate-800 dark:hover:text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        whileHover={{ x: -2 }}
      >
        ← {editingHabit ? (t.cancel || 'Cancel') : (t.back || 'Back')}
      </motion.button>

      {/* Edit mode header */}
      {editingHabit && (
        <div className={cn("mb-3 pb-2 border-b", isPrimaryCTA ? "border-foreground/20" : "border-border")}>
          <p className={cn("text-sm font-medium", isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground")}>
            {t.editHabit || 'Edit Habit'}
          </p>
        </div>
      )}

      {/* Live Preview Card */}
      <motion.div
        className={cn(
          "relative mb-4 p-4 rounded-2xl overflow-hidden",
          isPrimaryCTA
            ? "bg-gradient-to-br from-foreground/10 to-foreground/5 backdrop-blur-sm border border-foreground/20"
            : "bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm border border-border/50"
        )}
        style={isPrimaryCTA ? {
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
        } : {
          boxShadow: '0 4px 12px -2px hsl(var(--foreground)/0.05)'
        }}
      >
        {isPrimaryCTA && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.03) 50%, transparent 100%)' }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: 'linear' }}
          />
        )}
        <p className={cn("text-xs mb-2", isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground")}>
          {t.preview || 'Preview'}
        </p>
        <div className="flex items-center gap-3">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all duration-300", selectedColor.replace('bg-', 'bg-') + '/20')}>
            {selectedIcon}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("font-semibold text-base truncate", isPrimaryCTA ? "text-slate-800 dark:text-white" : "text-foreground")}>
              {newHabitName || (t.habitNamePlaceholder || 'Enter habit name...')}
            </p>
            <p className={cn("text-xs", isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground")}>
              {selectedType === 'daily' && (t.habitTypeDaily || 'Daily')}
              {selectedType === 'multiple' && `${dailyTarget}× ${t.perDay || 'per day'}`}
              {selectedType === 'continuous' && (t.habitTypeContinuous || 'Continuous')}
              {selectedType === 'reduce' && (t.habitTypeReduce || 'Reduce')}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Name Input */}
      <input
        type="text"
        value={newHabitName}
        onChange={(e) => setNewHabitName(e.target.value)}
        placeholder={t.habitName}
        className={cn(
          "relative w-full p-3 rounded-xl mb-3 transition-all",
          "focus:outline-none focus:ring-2",
          isPrimaryCTA
            ? "bg-foreground/10 backdrop-blur-sm border border-foreground/20 text-white placeholder:text-foreground/40 focus:ring-violet-500/50 focus:border-violet-500/30"
            : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
        )}
        style={isPrimaryCTA ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' } : undefined}
        autoFocus
        onFocus={(e) => { const el = e.target; scrollTimeoutRef.current = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
      />

      {/* Icon Selector */}
      <div className="relative mb-4">
        <p className={cn("text-sm font-medium mb-2", isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground")} id="icon-selector-label">{t.icon}:</p>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-labelledby="icon-selector-label">
          {habitIcons.map((icon) => (
            <motion.button
              key={icon}
              type="button"
              role="radio"
              aria-checked={selectedIcon === icon}
              aria-label={`${t.selectIcon || 'Select icon'} ${icon}`}
              onClick={(e) => { e.preventDefault(); setSelectedIcon(icon); }}
              className={cn(
                "w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-xl transition-all duration-200 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isPrimaryCTA
                  ? selectedIcon === icon
                    ? "bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40"
                    : "bg-foreground/5 border border-foreground/10 hover:bg-foreground/10"
                  : selectedIcon === icon
                    ? "bg-primary/20 ring-2 ring-primary scale-105 shadow-sm"
                    : "bg-background hover:bg-muted hover:scale-105"
              )}
              style={isPrimaryCTA && selectedIcon === icon ? { boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)' } : undefined}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {icon}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Color Selector */}
      <div className="relative mb-4">
        <p className={cn("text-sm font-medium mb-2", isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground")} id="color-selector-label">{t.color}:</p>
        <div className="flex gap-3" role="radiogroup" aria-labelledby="color-selector-label">
          {habitColors.map((color) => {
            const glowColors: Record<string, string> = {
              'bg-primary': 'rgba(52, 152, 117, 0.5)',
              'bg-accent': 'rgba(224, 157, 107, 0.5)',
              'bg-mood-good': 'rgba(16, 185, 129, 0.5)',
              'bg-mood-okay': 'rgba(234, 179, 8, 0.5)',
              'bg-mood-great': 'rgba(139, 92, 246, 0.5)',
            };
            const glowColor = glowColors[color] || 'rgba(139, 92, 246, 0.5)';
            return (
              <motion.button
                key={color}
                type="button"
                role="radio"
                aria-checked={selectedColor === color}
                aria-label={`${t.selectColor || 'Select color'} ${color.replace('bg-', '')}`}
                onClick={(e) => { e.preventDefault(); setSelectedColor(color); }}
                className={cn(
                  "w-11 h-11 min-w-[44px] min-h-[44px] rounded-full transition-all duration-200 cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  color,
                  selectedColor === color
                    ? isPrimaryCTA ? "ring-2 ring-offset-2 ring-foreground/50 scale-110" : "ring-2 ring-offset-2 ring-foreground scale-110"
                    : "hover:scale-105"
                )}
                style={{ boxShadow: selectedColor === color ? `0 0 20px ${glowColor}` : `0 2px 8px ${glowColor.replace('0.5', '0.2')}` }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              />
            );
          })}
        </div>
      </div>

      {/* Type Selector */}
      <div className="relative mb-4">
        <p className={cn("text-sm font-medium mb-2", isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground")}>{t.habitType}:</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { type: 'daily' as HabitType, icon: '✓', label: t.habitTypeDaily, desc: (t as unknown as Record<string, string>).habitTypeDailyDesc || 'Check off once a day' },
            { type: 'multiple' as HabitType, icon: '🔄', label: t.habitTypeMultiple, desc: (t as unknown as Record<string, string>).habitTypeMultipleDesc || 'Track count per day' },
            { type: 'continuous' as HabitType, icon: '📈', label: t.habitTypeContinuous, desc: (t as unknown as Record<string, string>).habitTypeContinuousDesc || "Don't break the chain" },
            { type: 'reduce' as HabitType, icon: '📉', label: t.habitTypeReduce || 'Reduce', desc: (t as unknown as Record<string, string>).habitTypeReduceDesc || 'Decrease over time' },
          ]).map(({ type, icon, label, desc }) => (
            <motion.button
              key={type}
              type="button"
              onClick={(e) => { e.preventDefault(); setSelectedType(type); }}
              className={cn(
                "p-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isPrimaryCTA
                  ? selectedType === type
                    ? "bg-gradient-to-br from-emerald-500/30 to-teal-600/20 border border-emerald-500/40 text-white"
                    : "bg-foreground/5 border border-foreground/10 text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
                  : selectedType === type
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-background hover:bg-muted border border-border/50"
              )}
              style={isPrimaryCTA && selectedType === type ? { boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)' } : undefined}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>{icon} {label}</span>
              <span className={cn(
                "text-[10px] block mt-0.5",
                isPrimaryCTA
                  ? selectedType === type ? "text-foreground/50" : "text-foreground/30"
                  : selectedType === type ? "text-primary-foreground/60" : "text-muted-foreground/60"
              )}>{desc}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Category Selector */}
      <div className="relative mb-4">
        <label className={cn("text-sm mb-2 block", isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground")}>
          {t.habitCategory || 'Category'}:
        </label>
        <div className="grid grid-cols-4 gap-2">
          {habitCategories.map(({ id, icon, color }) => {
            const categoryLabels: Record<HabitCategory, string> = {
              health: t.categoryHealth || 'Health',
              mindfulness: t.categoryMindfulness || 'Mindfulness',
              productivity: t.categoryProductivity || 'Productivity',
              social: t.categorySocial || 'Social',
              creativity: t.categoryCreativity || 'Creativity',
              finance: t.categoryFinance || 'Finance',
              'self-care': t.categorySelfCare || 'Self-care',
              other: t.categoryOther || 'Other',
            };
            return (
              <motion.button
                key={id}
                type="button"
                onClick={(e) => { e.preventDefault(); setSelectedCategory(id); }}
                className={cn(
                  "p-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-1",
                  selectedCategory === id
                    ? isPrimaryCTA ? `bg-gradient-to-br ${color} text-white shadow-lg` : "bg-primary text-primary-foreground shadow-md"
                    : isPrimaryCTA ? "bg-foreground/5 border border-foreground/10 text-foreground/70 hover:bg-foreground/10" : "bg-background hover:bg-muted border border-border/50"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-lg">{icon}</span>
                <span className="truncate w-full text-center">{categoryLabels[id]}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Daily Target Input */}
      {(selectedType === 'multiple' || selectedType === 'reduce') && (
        <div className="relative mb-4">
          <label className={cn("text-sm mb-2 block", isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground")}>
            {t.habitDailyTarget}:
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={dailyTarget}
            onChange={(e) => setDailyTarget(safeParseInt(e.target.value, 1, 1, 50))}
            className={cn(
              "w-full p-2 rounded-lg transition-all",
              "focus:outline-none focus:ring-2",
              isPrimaryCTA
                ? "bg-foreground/10 backdrop-blur-sm border border-foreground/20 text-white focus:ring-violet-500/50"
                : "bg-background text-foreground focus:ring-primary/30"
            )}
          />
        </div>
      )}

      {/* Reminders Section */}
      <RemindersSection
        isPrimaryCTA={isPrimaryCTA}
        t={t as unknown as Record<string, string>}
        reminders={reminders}
        handleAddReminder={handleAddReminder}
        handleRemoveReminder={handleRemoveReminder}
        handleReminderChange={handleReminderChange}
      />

      {/* Submit Button */}
      {isPrimaryCTA ? (
        <motion.button
          onClick={(e) => { e.preventDefault(); handleAddHabit(); }}
          disabled={!newHabitName.trim()}
          className={cn(
            "relative w-full py-3.5 rounded-xl font-semibold text-white transition-all overflow-hidden",
            newHabitName.trim()
              ? editingHabit
                ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                : "bg-gradient-to-r from-emerald-500 to-teal-500"
              : "bg-foreground/10 text-foreground/40 cursor-not-allowed"
          )}
          style={newHabitName.trim() ? {
            boxShadow: editingHabit ? '0 0 20px rgba(99, 102, 241, 0.4)' : '0 0 20px rgba(16, 185, 129, 0.4)'
          } : undefined}
          whileHover={newHabitName.trim() ? { scale: 1.02 } : {}}
          whileTap={newHabitName.trim() ? { scale: 0.98 } : {}}
        >
          {newHabitName.trim() && (
            <motion.div
              className={cn("absolute inset-0 rounded-xl border-2", editingHabit ? "border-indigo-400/30" : "border-emerald-400/30")}
              animate={{ scale: [1, 1.05], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          <span className="relative z-10">
            {editingHabit ? (t.saveChanges || 'Save Changes') : t.addHabit}
          </span>
        </motion.button>
      ) : (
        <Button
          variant={editingHabit ? "default" : "gradient"}
          size="lg"
          onClick={(e) => { e.preventDefault(); handleAddHabit(); }}
          disabled={!newHabitName.trim()}
          className="w-full"
        >
          {editingHabit ? (t.saveChanges || 'Save Changes') : t.addHabit}
        </Button>
      )}
    </motion.div>
  );
}
