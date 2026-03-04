import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HabitCategory, LoopHabitType } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { habitIcons, habitCategories, frequencyPresets } from '@/hooks/useHabitForm';
import { LOOP_PALETTE_LIGHT, resolveHabitColor } from '@/lib/habitColorUtils';
import type { useHabitForm } from '@/hooks/useHabitForm';
import type { Habit } from '@/types';
import { Fingerprint, Minus, Plus } from 'lucide-react';
import { IdentityIconPicker } from '@/components/IdentityIconPicker';
import { TemplatePicker } from './TemplatePicker';
import { RemindersSection } from './RemindersSection';

interface HabitCreationFormProps {
  form: ReturnType<typeof useHabitForm>;
  habits: Habit[];
  isPrimaryCTA?: boolean;
}

export function HabitCreationForm({ form, habits, isPrimaryCTA = false }: HabitCreationFormProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return () => { if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current); };
  }, []);

  const {
    isAdding, showCustomForm, editingHabit,
    newHabitName, selectedIcon, selectedColorIndex, selectedCategory,
    habitType, frequency, question, description,
    targetValue, targetType, unit,
    reminders,
    identityCluster, identityVerb, identityIcon,
    setShowCustomForm, setNewHabitName, setSelectedIcon, setSelectedColorIndex,
    setSelectedCategory,
    setHabitType, setFrequency, setQuestion, setDescription,
    setTargetValue, setTargetType, setUnit,
    setIdentityCluster, setIdentityVerb, setIdentityIcon,
    resetForm, handleAddHabit, handleQuickAdd,
    handleAddReminder, handleRemoveReminder, handleReminderChange,
  } = form;

  // Collect existing cluster names for autocomplete suggestions
  const existingClusters = [...new Set(
    habits.map(h => h.identityCluster).filter((c): c is string => !!c)
  )];

  // Color palette indices (0-19)
  const colorIndices = Array.from({ length: LOOP_PALETTE_LIGHT.length }, (_, i) => i);

  // Check if frequency matches a preset
  const activePresetIndex = frequencyPresets.findIndex(
    p => p.ratio.numerator === frequency.numerator && p.ratio.denominator === frequency.denominator
  );

  if (!isAdding) return null;

  // Template picker view
  if (!showCustomForm) {
    return (
      <TemplatePicker
        isPrimaryCTA={isPrimaryCTA}
        habits={habits}
        language={language}
        t={ts}
        handleQuickAdd={handleQuickAdd}
        setShowCustomForm={setShowCustomForm}
      />
    );
  }

  // Frequency display text
  const freqText = activePresetIndex >= 0
    ? (ts[frequencyPresets[activePresetIndex].i18nKey] || frequencyPresets[activePresetIndex].label)
    : `${frequency.numerator}× / ${frequency.denominator}${ts.daysAbbr || 'd'}`;

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
        <span className="inline-block rtl:rotate-180">←</span> {editingHabit ? (t.cancel || 'Cancel') : (t.back || 'Back')}
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
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.03) 50%, transparent 100%)',
              animation: 'form-shimmer 3s linear 2s infinite',
            }}
          />
        )}
        <p className={cn("text-xs mb-2", isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground")}>
          {t.preview || 'Preview'}
        </p>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all duration-300"
            style={{ backgroundColor: `${resolveHabitColor(selectedColorIndex)}33` }}
          >
            {selectedIcon}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("font-semibold text-base truncate", isPrimaryCTA ? "text-slate-800 dark:text-white" : "text-foreground")}>
              {newHabitName || (ts.habitNamePlaceholder || 'Enter habit name...')}
            </p>
            <p className={cn("text-xs", isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground")}>
              {habitType === 'boolean' ? (ts.habitTypeBoolean || 'Yes/No') : `${targetValue} ${unit || ''}`}
              {' · '}{freqText}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Name Input */}
      <input
        type="text"
        value={newHabitName}
        onChange={(e) => setNewHabitName(e.target.value)}
        maxLength={100}
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

      {/* Question Input */}
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={ts.habitQuestion || 'Question (e.g., "Did you exercise today?")'}
        maxLength={200}
        className={cn(
          "relative w-full p-3 rounded-xl mb-3 transition-all",
          "focus:outline-none focus:ring-2",
          isPrimaryCTA
            ? "bg-foreground/10 backdrop-blur-sm border border-foreground/20 text-white placeholder:text-foreground/40 focus:ring-violet-500/50"
            : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
        )}
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

      {/* Color Selector — 4×5 grid of 20 Loop palette colors */}
      <div className="relative mb-4">
        <p className={cn("text-sm font-medium mb-2", isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground")} id="color-selector-label">{t.color}:</p>
        <div className="grid grid-cols-10 gap-1.5" role="radiogroup" aria-labelledby="color-selector-label">
          {colorIndices.map((idx) => {
            const hex = resolveHabitColor(idx);
            return (
              <motion.button
                key={idx}
                type="button"
                role="radio"
                aria-checked={selectedColorIndex === idx}
                aria-label={`${t.selectColor || 'Select color'} ${idx + 1}`}
                onClick={(e) => { e.preventDefault(); setSelectedColorIndex(idx); }}
                className={cn(
                  "w-8 h-8 min-w-[32px] min-h-[32px] rounded-full transition-all duration-200 cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  selectedColorIndex === idx
                    ? "ring-2 ring-offset-2 ring-foreground/50 scale-110"
                    : "hover:scale-105"
                )}
                style={{
                  backgroundColor: hex,
                  boxShadow: selectedColorIndex === idx ? `0 0 16px ${hex}80` : undefined,
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              />
            );
          })}
        </div>
      </div>

      {/* Type Selector — Boolean / Numerical */}
      <div className="relative mb-4">
        <p className={cn("text-sm font-medium mb-2", isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground")}>{t.habitType || 'Type'}:</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { type: 'boolean' as LoopHabitType, icon: '✓', label: ts.habitTypeBoolean || 'Yes/No', desc: ts.habitTypeBooleanDesc || 'Check off once a day' },
            { type: 'numerical' as LoopHabitType, icon: '🔢', label: ts.habitTypeNumerical || 'Measurable', desc: ts.habitTypeNumericalDesc || 'Track a number per day' },
          ]).map(({ type, icon, label, desc }) => (
            <motion.button
              key={type}
              type="button"
              onClick={(e) => { e.preventDefault(); setHabitType(type); }}
              className={cn(
                "p-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isPrimaryCTA
                  ? habitType === type
                    ? "bg-gradient-to-br from-emerald-500/30 to-teal-600/20 border border-emerald-500/40 text-white"
                    : "bg-foreground/5 border border-foreground/10 text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
                  : habitType === type
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-background hover:bg-muted border border-border/50"
              )}
              style={isPrimaryCTA && habitType === type ? { boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)' } : undefined}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>{icon} {label}</span>
              <span className={cn(
                "text-[10px] block mt-0.5",
                isPrimaryCTA
                  ? habitType === type ? "text-foreground/50" : "text-foreground/30"
                  : habitType === type ? "text-primary-foreground/60" : "text-muted-foreground/60"
              )}>{desc}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Frequency Selector */}
      <div className="relative mb-4">
        <p className={cn("text-sm font-medium mb-2", isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground")}>
          {ts.habitFrequency || 'Frequency'}:
        </p>
        <div className="flex gap-2 flex-wrap">
          {frequencyPresets.map((preset, idx) => (
            <motion.button
              key={idx}
              type="button"
              onClick={(e) => { e.preventDefault(); setFrequency(preset.ratio); }}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activePresetIndex === idx
                  ? isPrimaryCTA
                    ? "bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40 text-white"
                    : "bg-primary text-primary-foreground shadow-sm"
                  : isPrimaryCTA
                    ? "bg-foreground/5 border border-foreground/10 text-foreground/70"
                    : "bg-background border border-border/50 hover:bg-muted"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {ts[preset.i18nKey] || preset.label}
            </motion.button>
          ))}
          {/* Custom frequency indicator */}
          {activePresetIndex < 0 && (
            <span className={cn(
              "px-3 py-2 rounded-xl text-xs font-medium border",
              isPrimaryCTA ? "border-violet-500/40 text-violet-300" : "border-primary text-primary"
            )}>
              {frequency.numerator}× / {frequency.denominator}{ts.daysAbbr || 'd'}
            </span>
          )}
        </div>
      </div>

      {/* Numerical Target Section */}
      {habitType === 'numerical' && (
        <div className="relative mb-4 space-y-3">
          {/* Target value */}
          <div>
            <label className={cn("text-sm mb-2 block", isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground")}>
              {ts.habitTarget || 'Target'}:
            </label>
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={() => setTargetValue(Math.max(1, targetValue - 1))}
                className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg bg-muted/50 flex items-center justify-center"
                whileTap={{ scale: 0.95 }}
              >
                <Minus className="w-4 h-4" />
              </motion.button>
              <input
                type="number"
                min="1"
                step="0.5"
                value={targetValue}
                onChange={(e) => setTargetValue(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className={cn(
                  "w-20 p-2 rounded-lg text-center text-lg font-bold",
                  "focus:outline-none focus:ring-2",
                  isPrimaryCTA
                    ? "bg-foreground/10 border border-foreground/20 text-white focus:ring-violet-500/50"
                    : "bg-background text-foreground focus:ring-primary/30"
                )}
              />
              <motion.button
                type="button"
                onClick={() => setTargetValue(targetValue + 1)}
                className={cn(
                  "w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center",
                  "bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
                )}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-4 h-4" />
              </motion.button>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={ts.habitUnit || 'Unit (L, km, min...)'}
                maxLength={20}
                className={cn(
                  "flex-1 p-2 rounded-lg text-sm",
                  "focus:outline-none focus:ring-2",
                  isPrimaryCTA
                    ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/30 focus:ring-violet-500/50"
                    : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
                )}
              />
            </div>
          </div>

          {/* Target type: At Least / At Most */}
          <div className="flex gap-2">
            {(['atLeast', 'atMost'] as const).map((tt) => (
              <motion.button
                key={tt}
                type="button"
                onClick={(e) => { e.preventDefault(); setTargetType(tt); }}
                className={cn(
                  "flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px]",
                  targetType === tt
                    ? isPrimaryCTA
                      ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                      : "bg-primary text-primary-foreground shadow-sm"
                    : isPrimaryCTA
                      ? "bg-foreground/5 border border-foreground/10 text-foreground/60"
                      : "bg-background border border-border/50 hover:bg-muted"
                )}
                whileTap={{ scale: 0.98 }}
              >
                {tt === 'atLeast' ? (ts.atLeast || 'At least') : (ts.atMost || 'At most')}
              </motion.button>
            ))}
          </div>
        </div>
      )}

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

      {/* Identity Mapping — "Who are you becoming?" (IA Blueprint Phase 2) */}
      <div className={cn(
        "relative mb-4 rounded-xl p-3 space-y-3",
        isPrimaryCTA
          ? "bg-foreground/5 border border-foreground/10"
          : "bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)]"
      )}>
        <div className="flex items-center gap-2">
          <Fingerprint className={cn("w-4 h-4", isPrimaryCTA ? "text-violet-400" : "text-primary")} />
          <p className={cn("text-sm font-medium", isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground")}>
            {ts.identityMapping || 'Identity Mapping'}
          </p>
        </div>
        <p className={cn("text-xs", isPrimaryCTA ? "text-slate-500 dark:text-foreground/40" : "text-muted-foreground")}>
          {ts.identityMappingHint || 'Optional — connect this habit to who you\'re becoming'}
        </p>

        {/* Cluster name */}
        <div>
          <label className={cn("text-xs mb-1 block", isPrimaryCTA ? "text-slate-500 dark:text-foreground/50" : "text-muted-foreground")}>
            {ts.identityCluster || 'Cluster'}
          </label>
          <input
            type="text"
            list="identity-clusters-list"
            value={identityCluster}
            onChange={(e) => setIdentityCluster(e.target.value)}
            placeholder={ts.identityClusterPlaceholder || 'e.g., The Mindful Me'}
            maxLength={40}
            className={cn(
              "w-full p-2 rounded-lg text-sm transition-all",
              "focus:outline-none focus:ring-2",
              isPrimaryCTA
                ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/30 focus:ring-violet-500/50"
                : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
            )}
          />
          {existingClusters.length > 0 && (
            <datalist id="identity-clusters-list">
              {existingClusters.map(c => <option key={c} value={c} />)}
            </datalist>
          )}
        </div>

        {/* Identity verb */}
        <div>
          <label className={cn("text-xs mb-1 block", isPrimaryCTA ? "text-slate-500 dark:text-foreground/50" : "text-muted-foreground")}>
            {ts.identityVerb || 'Affirmation'}
          </label>
          <input
            type="text"
            value={identityVerb}
            onChange={(e) => setIdentityVerb(e.target.value)}
            placeholder={ts.identityVerbPlaceholder || 'e.g., I am a meditator'}
            maxLength={60}
            className={cn(
              "w-full p-2 rounded-lg text-sm transition-all",
              "focus:outline-none focus:ring-2",
              isPrimaryCTA
                ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/30 focus:ring-violet-500/50"
                : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
            )}
          />
        </div>

        {/* Identity icon */}
        <div>
          <label className={cn("text-xs mb-1.5 block", isPrimaryCTA ? "text-slate-500 dark:text-foreground/50" : "text-muted-foreground")}>
            {ts.identityIcon || 'Icon'}
          </label>
          <IdentityIconPicker
            value={identityIcon}
            onChange={setIdentityIcon}
            isPrimaryCTA={isPrimaryCTA}
          />
        </div>
      </div>

      {/* Reminders Section */}
      <RemindersSection
        isPrimaryCTA={isPrimaryCTA}
        t={ts}
        reminders={reminders}
        handleAddReminder={handleAddReminder}
        handleRemoveReminder={handleRemoveReminder}
        handleReminderChange={handleReminderChange}
      />

      {/* Description (optional) */}
      <div className="relative mb-4">
        <label className={cn("text-sm mb-2 block", isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground")}>
          {ts.habitDescription || 'Notes (optional)'}:
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={ts.habitDescriptionPlaceholder || 'Additional details...'}
          rows={2}
          className={cn(
            "w-full p-2 rounded-lg text-sm resize-none transition-all",
            "focus:outline-none focus:ring-2",
            isPrimaryCTA
              ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/30 focus:ring-violet-500/50"
              : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
          )}
        />
      </div>

      {/* Submit Button */}
      {isPrimaryCTA ? (
        <motion.button
          onClick={(e) => { e.preventDefault(); if (isSaving) return; setIsSaving(true); handleAddHabit(); }}
          disabled={!newHabitName.trim() || isSaving}
          className={cn(
            "relative w-full py-3.5 rounded-xl font-semibold text-white transition-all overflow-hidden",
            newHabitName.trim() && !isSaving
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
            <div
              className={cn("absolute inset-0 rounded-xl border-2", editingHabit ? "border-indigo-400/30" : "border-emerald-400/30")}
              style={{ animation: 'submit-pulse-ring 1.5s ease-in-out infinite' }}
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
          onClick={(e) => { e.preventDefault(); if (isSaving) return; setIsSaving(true); handleAddHabit(); }}
          disabled={!newHabitName.trim() || isSaving}
          className="w-full"
        >
          {editingHabit ? (t.saveChanges || 'Save Changes') : t.addHabit}
        </Button>
      )}
    </motion.div>
  );
}
