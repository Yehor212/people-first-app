import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { zenMotion } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { frequencyPresets } from "@/hooks/useHabitForm";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import type { useHabitForm } from "@/hooks/useHabitForm";
import type { Habit } from "@/types";
import { TemplatePicker } from "./TemplatePicker";
import { RemindersSection } from "./RemindersSection";
import {
  IconSelector,
  ColorSelector,
  TypeSelector,
  FrequencySelector,
  CategorySelector,
} from "./FormSelectors";
import { NumericalTargetSection } from "./NumericalTargetSection";
import { IdentityMappingSection } from "./IdentityMappingSection";

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
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const {
    isAdding,
    showCustomForm,
    editingHabit,
    newHabitName,
    selectedIcon,
    selectedColorIndex,
    selectedCategory,
    habitType,
    frequency,
    question,
    description,
    targetValue,
    targetType,
    unit,
    reminders,
    identityCluster,
    identityVerb,
    identityIcon,
    setShowCustomForm,
    setNewHabitName,
    setSelectedIcon,
    setSelectedColorIndex,
    setSelectedCategory,
    setHabitType,
    setFrequency,
    setQuestion,
    setDescription,
    setTargetValue,
    setTargetType,
    setUnit,
    setIdentityCluster,
    setIdentityVerb,
    setIdentityIcon,
    resetForm,
    handleAddHabit,
    handleQuickAdd,
    handleAddReminder,
    handleRemoveReminder,
    handleReminderChange,
  } = form;

  const existingClusters = [
    ...new Set(habits.map((h) => h.identityCluster).filter((c): c is string => !!c)),
  ];

  const activePresetIndex = frequencyPresets.findIndex(
    (p) =>
      p.ratio.numerator === frequency.numerator && p.ratio.denominator === frequency.denominator
  );

  if (!isAdding) return null;

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

  const freqText =
    activePresetIndex >= 0
      ? ts[frequencyPresets[activePresetIndex].i18nKey] || frequencyPresets[activePresetIndex].label
      : `${frequency.numerator}× / ${frequency.denominator}${ts.daysAbbr || "d"}`;

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
      transition={zenMotion.gentle}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Premium cosmic background */}
      {isPrimaryCTA && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.1)_0%,transparent_50%)]" />
      )}

      {/* Back/Cancel button */}
      <motion.button
        onClick={() => {
          if (editingHabit) {
            resetForm();
          } else {
            setShowCustomForm(false);
          }
        }}
        className={cn(
          "relative text-sm mb-3 flex items-center gap-1 transition-colors",
          isPrimaryCTA
            ? "text-slate-500 dark:text-foreground/60 hover:text-slate-800 dark:hover:text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        whileHover={{ x: -2 }}
      >
        <span className="inline-block rtl:rotate-180">←</span>{" "}
        {editingHabit ? t.cancel || "Cancel" : t.back || "Back"}
      </motion.button>

      {/* Edit mode header */}
      {editingHabit && (
        <div
          className={cn(
            "mb-3 pb-2 border-b",
            isPrimaryCTA ? "border-foreground/20" : "border-border"
          )}
        >
          <p
            className={cn(
              "text-sm font-medium",
              isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground"
            )}
          >
            {t.editHabit || "Edit Habit"}
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
        style={
          isPrimaryCTA
            ? {
                boxShadow: "0 0 20px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
              }
            : {
                boxShadow: "0 4px 12px -2px hsl(var(--foreground)/0.05)",
              }
        }
      >
        {isPrimaryCTA && (
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.03)_50%,transparent_100%)] [animation:form-shimmer_3s_linear_2s_infinite]" />
        )}
        <p
          className={cn(
            "text-xs mb-2",
            isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground"
          )}
        >
          {t.preview || "Preview"}
        </p>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all duration-300"
            style={{ backgroundColor: `${resolveHabitColor(selectedColorIndex)}33` }}
          >
            {selectedIcon}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "font-semibold text-base truncate",
                isPrimaryCTA ? "text-slate-800 dark:text-white" : "text-foreground"
              )}
            >
              {newHabitName || ts.habitNamePlaceholder || "Enter habit name..."}
            </p>
            <p
              className={cn(
                "text-xs",
                isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground"
              )}
            >
              {habitType === "boolean"
                ? ts.habitTypeBoolean || "Yes/No"
                : `${targetValue} ${unit || ""}`}
              {" · "}
              {freqText}
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
        aria-label={ts.habitName || "Habit name"}
        className={cn(
          "relative w-full p-3 rounded-xl mb-3 transition-all",
          "focus:outline-none focus:ring-2",
          isPrimaryCTA
            ? "bg-foreground/10 backdrop-blur-sm border border-foreground/20 text-white placeholder:text-foreground/60 focus:ring-violet-500/50 focus:border-violet-500/30"
            : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
        )}
        style={isPrimaryCTA ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" } : undefined}
        autoFocus
        onFocus={(e) => {
          const el = e.target;
          scrollTimeoutRef.current = setTimeout(
            () => el.scrollIntoView({ behavior: "smooth", block: "center" }),
            300
          );
        }}
      />

      {/* Question Input */}
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={ts.habitQuestion || 'Question (e.g., "Did you exercise today?")'}
        maxLength={200}
        aria-label={ts.habitQuestion || "Tracking question"}
        className={cn(
          "relative w-full p-3 rounded-xl mb-3 transition-all",
          "focus:outline-none focus:ring-2",
          isPrimaryCTA
            ? "bg-foreground/10 backdrop-blur-sm border border-foreground/20 text-white placeholder:text-foreground/60 focus:ring-violet-500/50"
            : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
        )}
      />

      <IconSelector
        selectedIcon={selectedIcon}
        setSelectedIcon={setSelectedIcon}
        isPrimaryCTA={isPrimaryCTA}
        ts={ts}
      />
      <ColorSelector
        selectedColorIndex={selectedColorIndex}
        setSelectedColorIndex={setSelectedColorIndex}
        isPrimaryCTA={isPrimaryCTA}
        ts={ts}
      />
      <TypeSelector
        habitType={habitType}
        setHabitType={setHabitType}
        isPrimaryCTA={isPrimaryCTA}
        ts={ts}
      />
      <FrequencySelector
        frequency={frequency}
        setFrequency={setFrequency}
        isPrimaryCTA={isPrimaryCTA}
        ts={ts}
      />

      {habitType === "numerical" && (
        <NumericalTargetSection
          isPrimaryCTA={isPrimaryCTA}
          ts={ts}
          targetValue={targetValue}
          setTargetValue={setTargetValue}
          targetType={targetType}
          setTargetType={setTargetType}
          unit={unit}
          setUnit={setUnit}
        />
      )}

      <CategorySelector
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        isPrimaryCTA={isPrimaryCTA}
        ts={ts}
      />

      <IdentityMappingSection
        isPrimaryCTA={isPrimaryCTA}
        ts={ts}
        identityCluster={identityCluster}
        setIdentityCluster={setIdentityCluster}
        identityVerb={identityVerb}
        setIdentityVerb={setIdentityVerb}
        identityIcon={identityIcon}
        setIdentityIcon={setIdentityIcon}
        existingClusters={existingClusters}
      />

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
        <label
          className={cn(
            "text-sm mb-2 block",
            isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground"
          )}
        >
          {ts.habitDescription || "Notes (optional)"}:
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={ts.habitDescriptionPlaceholder || "Additional details..."}
          rows={2}
          className={cn(
            "w-full p-2 rounded-lg text-sm resize-none transition-all",
            "focus:outline-none focus:ring-2",
            isPrimaryCTA
              ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/60 focus:ring-violet-500/50"
              : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
          )}
        />
      </div>

      {/* Submit Button */}
      {isPrimaryCTA ? (
        <motion.button
          onClick={(e) => {
            e.preventDefault();
            if (isSaving) return;
            setIsSaving(true);
            handleAddHabit();
          }}
          disabled={!newHabitName.trim() || isSaving}
          className={cn(
            "relative w-full py-3.5 rounded-xl font-semibold text-white transition-all overflow-hidden",
            newHabitName.trim() && !isSaving
              ? editingHabit
                ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                : "bg-gradient-to-r from-emerald-500 to-teal-500"
              : "bg-foreground/10 text-foreground/40 cursor-not-allowed"
          )}
          style={
            newHabitName.trim()
              ? {
                  boxShadow: editingHabit
                    ? "0 0 20px rgba(99, 102, 241, 0.4)"
                    : "0 0 20px rgba(16, 185, 129, 0.4)",
                }
              : undefined
          }
          whileHover={newHabitName.trim() ? { scale: 1.02 } : {}}
          whileTap={newHabitName.trim() ? { scale: 0.98 } : {}}
        >
          {newHabitName.trim() && (
            <div
              className={cn(
                "absolute inset-0 rounded-xl border-2 [animation:submit-pulse-ring_1.5s_ease-in-out_infinite]",
                editingHabit ? "border-indigo-400/30" : "border-emerald-400/30"
              )}
            />
          )}
          <span className="relative z-10">
            {editingHabit ? t.saveChanges || "Save Changes" : t.addHabit}
          </span>
        </motion.button>
      ) : (
        <Button
          variant={editingHabit ? "default" : "gradient"}
          size="lg"
          onClick={(e) => {
            e.preventDefault();
            if (isSaving) return;
            setIsSaving(true);
            handleAddHabit();
          }}
          disabled={!newHabitName.trim() || isSaving}
          className="w-full"
        >
          {editingHabit ? t.saveChanges || "Save Changes" : t.addHabit}
        </Button>
      )}
    </motion.div>
  );
}
