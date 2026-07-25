/**
 * FormSelectors — Icon, Color, Type, Frequency, Category selector sub-components
 * for the HabitCreationForm.
 */

import { motion } from "framer-motion";
import { V2HabitPictogram } from "@/components/habit-pictogram/V2HabitPictogram";
import { CheckCircle2, ListChecks } from "lucide-react";
import { zenTap } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";
import {
  habitIcons,
  habitCategories,
  frequencyPresets,
} from "@/hooks/useHabitForm";
import { LOOP_PALETTE_LIGHT, resolveHabitColor } from "@/lib/habitColorUtils";
import { resolveV2HabitPictogramId } from "@/lib/v2HabitPictograms";
import {
  getSuggestedDueDays,
  getWeeklyTargetCountFromFrequency,
  isDailyFrequency,
  normalizeDueDays,
  WEEK_DAYS,
} from "@/lib/habitScheduling";
import type { HabitCategory, HabitFrequencyRatio, HabitScheduleMode, LoopHabitType } from "@/types";

interface SelectorProps {
  isPrimaryCTA: boolean;
  ts: Record<string, string>;
}

interface IconSelectorProps extends SelectorProps {
  selectedIcon: string;
  setSelectedIcon: (icon: string) => void;
}

export function IconSelector({
  selectedIcon,
  setSelectedIcon,
  isPrimaryCTA,
  ts,
}: IconSelectorProps) {
  return (
    <div className="relative mb-4">
      <p
        className={cn(
          "text-sm font-medium mb-2",
          isPrimaryCTA
            ? "text-[hsl(var(--zf-text-soft))]"
            : "text-foreground",
        )}
        id="icon-selector-label"
      >
        {ts.icon}:
      </p>
      <div
        className="flex gap-2 flex-wrap"
        role="radiogroup"
        aria-labelledby="icon-selector-label"
      >
        {habitIcons.map((icon) => {
          const optionValue = isPrimaryCTA ? resolveV2HabitPictogramId(icon) : icon;
          const selected = selectedIcon === optionValue || selectedIcon === icon;
          return (
            <motion.button
              key={icon}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={ts.selectIcon + " " + optionValue}
              onClick={(e) => {
                e.preventDefault();
                setSelectedIcon(optionValue);
              }}
              className={cn(
                "w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center motion-safe:transition-all motion-safe:duration-200 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isPrimaryCTA
                  ? selected
                    ? "bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40"
                    : "bg-foreground/5 border border-foreground/10 hover:bg-foreground/10"
                  : selected
                    ? "bg-primary/20 ring-2 ring-primary scale-105 shadow-sm text-xl"
                    : "bg-background hover:bg-muted hover:scale-105 text-xl",
              )}
              style={
                isPrimaryCTA && selected
                  ? { boxShadow: "0 0 16px hsl(var(--cosmic-nebula-purple) / 0.4)" }
                  : undefined
              }
              whileHover={{ scale: 1.05 }}
              whileTap={zenTap.button}
            >
              {isPrimaryCTA ? (
                <V2HabitPictogram value={optionValue} className="h-7 w-7" />
              ) : (
                icon
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

const colorIndices = Array.from(
  { length: LOOP_PALETTE_LIGHT.length },
  (_, i) => i,
);

interface ColorSelectorProps extends SelectorProps {
  selectedColorIndex: number;
  setSelectedColorIndex: (idx: number) => void;
}

export function ColorSelector({
  selectedColorIndex,
  setSelectedColorIndex,
  isPrimaryCTA,
  ts,
}: ColorSelectorProps) {
  return (
    <div className="relative mb-4">
      <p
        className={cn(
          "text-sm font-medium mb-2",
          isPrimaryCTA
            ? "text-[hsl(var(--zf-text-soft))]"
            : "text-foreground",
        )}
        id="color-selector-label"
      >
        {ts.color}:
      </p>
      <div
        className="grid grid-cols-10 gap-1.5"
        role="radiogroup"
        aria-labelledby="color-selector-label"
      >
        {colorIndices.map((idx) => {
          const hex = resolveHabitColor(idx);
          return (
            <motion.button
              key={idx}
              type="button"
              role="radio"
              aria-checked={selectedColorIndex === idx}
              aria-label={`${ts.selectColor} ${idx + 1}`}
              onClick={(e) => {
                e.preventDefault();
                setSelectedColorIndex(idx);
              }}
              className={cn(
                "w-8 h-8 min-w-[44px] min-h-[44px] rounded-full motion-safe:transition-all motion-safe:duration-200 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                selectedColorIndex === idx
                  ? "ring-2 ring-offset-2 ring-foreground/50 scale-110"
                  : "hover:scale-105",
              )}
              style={{
                backgroundColor: hex,
                boxShadow:
                  selectedColorIndex === idx ? `0 0 16px ${hex}80` : undefined,
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={zenTap.button}
            />
          );
        })}
      </div>
    </div>
  );
}

interface TypeSelectorProps extends SelectorProps {
  habitType: LoopHabitType;
  setHabitType: (type: LoopHabitType) => void;
}

export function TypeSelector({
  habitType,
  setHabitType,
  isPrimaryCTA,
  ts,
}: TypeSelectorProps) {
  return (
    <div className="relative mb-4">
      <p
        className={cn(
          "text-sm font-medium mb-2",
          isPrimaryCTA
            ? "text-[hsl(var(--zf-text-soft))]"
            : "text-foreground",
        )}
      >
        {ts.habitType}:
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(10rem*var(--font-scale,1))),1fr))] gap-2">
        {[
          {
            type: "boolean" as LoopHabitType,
            Icon: CheckCircle2,
            label: ts.habitTypeBoolean,
            desc: ts.habitTypeBooleanDesc,
          },
          {
            type: "numerical" as LoopHabitType,
            Icon: ListChecks,
            label: ts.habitTypeNumerical,
            desc: ts.habitTypeNumericalDesc,
          },
        ].map(({ type, Icon, label, desc }) => (
          <motion.button
            key={type}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setHabitType(type);
            }}
            className={cn(
              "p-3 rounded-xl text-sm font-medium motion-safe:transition-all motion-safe:duration-200 cursor-pointer min-h-[44px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isPrimaryCTA
                ? habitType === type
                  ? "bg-gradient-to-br from-emerald-500/30 to-teal-600/20 border border-emerald-500/40 text-white"
                  : "bg-foreground/5 border border-foreground/10 text-[hsl(var(--zf-text-soft))] hover:bg-foreground/10 hover:text-[hsl(var(--zf-text-strong))]"
                : habitType === type
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-background hover:bg-muted border border-border/50",
            )}
            style={
              isPrimaryCTA && habitType === type
                ? { boxShadow: "0 0 12px hsl(var(--chart-habit) / 0.4)" }
                : undefined
            }
            whileHover={{ scale: 1.02 }}
            whileTap={zenTap.card}
          >
            <span>
              <Icon className="me-1.5 inline h-4 w-4 align-[-0.125em]" aria-hidden="true" />
              {label}
            </span>
            <span
              className={cn(
                "mt-0.5 block whitespace-normal break-words text-xs",
                isPrimaryCTA
                  ? habitType === type
                    ? "text-white/70"
                    : "text-[hsl(var(--zf-text-soft)/0.72)]"
                  : habitType === type
                    ? "text-primary-foreground/60"
                    : "text-muted-foreground/60",
              )}
            >
              {desc}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

interface FrequencySelectorProps extends SelectorProps {
  frequency: HabitFrequencyRatio;
  setFrequency: (f: HabitFrequencyRatio) => void;
  scheduleMode?: HabitScheduleMode;
  setScheduleMode?: (mode: HabitScheduleMode) => void;
  scheduleDueDays?: number[];
  setScheduleDueDays?: (days: number[]) => void;
}

export function FrequencySelector({
  frequency,
  setFrequency,
  scheduleMode = isDailyFrequency(frequency) ? "daily" : "flexiblePerPeriod",
  setScheduleMode,
  scheduleDueDays = [],
  setScheduleDueDays,
  isPrimaryCTA,
  ts,
}: FrequencySelectorProps) {
  const activePresetIndex = frequencyPresets.findIndex(
    (p) =>
      p.ratio.numerator === frequency.numerator &&
      p.ratio.denominator === frequency.denominator,
  );
  const isDaily = isDailyFrequency(frequency);
  const weeklyTargetCount = getWeeklyTargetCountFromFrequency(frequency);
  const normalizedDueDays = normalizeDueDays(scheduleDueDays);
  const dayLabels = [
    { day: 1, label: ts.mon || ts.dayMon || "Mon" },
    { day: 2, label: ts.tue || ts.dayTue || "Tue" },
    { day: 3, label: ts.wed || ts.dayWed || "Wed" },
    { day: 4, label: ts.thu || ts.dayThu || "Thu" },
    { day: 5, label: ts.fri || ts.dayFri || "Fri" },
    { day: 6, label: ts.sat || ts.daySat || "Sat" },
    { day: 0, label: ts.sun || ts.daySun || "Sun" },
  ];

  return (
    <div className="relative mb-4">
      <p
        className={cn(
          "text-sm font-medium mb-2",
          isPrimaryCTA
            ? "text-[hsl(var(--zf-text-soft))]"
            : "text-foreground",
        )}
      >
        {ts.habitFrequency}:
      </p>
      <div className="flex gap-2 flex-wrap">
        {frequencyPresets.map((preset, idx) => (
          <motion.button
            key={idx}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setFrequency(preset.ratio);
            }}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-medium motion-safe:transition-all min-h-[44px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activePresetIndex === idx
                ? isPrimaryCTA
                  ? "bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40 text-white"
                  : "bg-primary text-primary-foreground shadow-sm"
                : isPrimaryCTA
                  ? "bg-foreground/5 border border-foreground/10 text-[hsl(var(--zf-text-soft))]"
                  : "bg-background border border-border/50 hover:bg-muted",
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={zenTap.card}
          >
            {ts[preset.translationId]}
          </motion.button>
        ))}
        {activePresetIndex < 0 && (
          <span
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-medium border",
              isPrimaryCTA
                ? "border-violet-500/40 text-violet-300"
                : "border-primary text-primary",
            )}
          >
            {frequency.numerator}x / {frequency.denominator}
            {ts.daysAbbr}
          </span>
        )}
      </div>
      {!isDaily && (
        <div
          className={cn(
            "mt-3 rounded-2xl border p-3",
            isPrimaryCTA
              ? "border-foreground/10 bg-foreground/5"
              : "border-border/60 bg-muted/30",
          )}
        >
          <p
            className={cn(
              "mb-2 text-xs font-medium",
              isPrimaryCTA ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground",
            )}
          >
            {ts.habitScheduleRule || `${weeklyTargetCount}x this week`}
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(10rem*var(--font-scale,1))),1fr))] gap-2">
            {[
              {
                mode: "flexiblePerPeriod" as HabitScheduleMode,
                label: ts.habitScheduleFlexibleAnyDays || "Any days this week",
                hint: ts.habitScheduleFlexibleHint || "Missed weekdays do not fail the habit until the week ends.",
              },
              {
                mode: "specificDays" as HabitScheduleMode,
                label: ts.habitScheduleSpecificDays || ts.habitFrequencySelectDays || "Choose days",
                hint: ts.habitScheduleSpecificHint || "Only selected days count as due.",
              },
            ].map((option) => {
              const active = scheduleMode === option.mode;
              return (
                <motion.button
                  key={option.mode}
                  type="button"
                  aria-pressed={active}
                  onClick={(e) => {
                    e.preventDefault();
                    setScheduleMode?.(option.mode);
                    if (option.mode === "specificDays" && normalizedDueDays.length === 0) {
                      setScheduleDueDays?.(getSuggestedDueDays(weeklyTargetCount));
                    }
                  }}
                  className={cn(
                    "min-h-[72px] rounded-xl border px-3 py-2 text-left motion-safe:transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? isPrimaryCTA
                        ? "border-emerald-400/45 bg-emerald-400/12 text-white"
                        : "border-primary bg-primary/10 text-foreground"
                      : isPrimaryCTA
                        ? "border-foreground/10 bg-foreground/5 text-[hsl(var(--zf-text-soft))]"
                        : "border-border/50 bg-background text-muted-foreground",
                  )}
                  whileTap={zenTap.card}
                >
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="mt-1 block whitespace-normal break-words text-xs leading-snug opacity-75">
                    {option.hint}
                  </span>
                </motion.button>
              );
            })}
          </div>
          {scheduleMode === "specificDays" && (
            <div className="mt-3">
              <p
                className={cn(
                  "mb-2 text-xs font-medium",
                  isPrimaryCTA ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground",
                )}
              >
                {ts.habitScheduleDueDays || ts.habitFrequencySelectDays || "Due days"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dayLabels.map(({ day, label }) => {
                  const active = normalizedDueDays.includes(day);
                  return (
                    <motion.button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={(e) => {
                        e.preventDefault();
                        const rawDays = active
                          ? normalizedDueDays.filter((item) => item !== day)
                          : [...normalizedDueDays, day];
                        const nextDays = WEEK_DAYS.filter((item) => rawDays.includes(item));
                        setScheduleDueDays?.(
                          nextDays.length > 0 ? nextDays : getSuggestedDueDays(weeklyTargetCount),
                        );
                      }}
                      className={cn(
                        "min-h-[44px] min-w-[44px] rounded-xl px-2 text-xs font-semibold motion-safe:transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        active
                          ? isPrimaryCTA
                            ? "bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/35"
                            : "bg-primary text-primary-foreground"
                          : isPrimaryCTA
                            ? "bg-foreground/5 text-[hsl(var(--zf-text-soft))]"
                            : "bg-background text-muted-foreground",
                      )}
                      whileTap={zenTap.button}
                    >
                      {label}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CategorySelectorProps extends SelectorProps {
  selectedCategory: HabitCategory;
  setSelectedCategory: (cat: HabitCategory) => void;
}

export function CategorySelector({
  selectedCategory,
  setSelectedCategory,
  isPrimaryCTA,
  ts,
}: CategorySelectorProps) {
  const categoryLabels: Record<HabitCategory, string> = {
    health: ts.categoryHealth,
    mindfulness: ts.categoryMindfulness,
    productivity: ts.categoryProductivity,
    social: ts.categorySocial,
    creativity: ts.categoryCreativity,
    finance: ts.categoryFinance,
    "self-care": ts.categorySelfCare,
    other: ts.categoryOther,
  };

  return (
    <div className="relative mb-4">
      <label
        className={cn(
          "text-sm mb-2 block",
          isPrimaryCTA
            ? "text-[hsl(var(--zf-text-soft))]"
            : "text-muted-foreground",
        )}
      >
        {ts.habitCategory}:
      </label>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(7.5rem*var(--font-scale,1))),1fr))] gap-2">
        {habitCategories.map(({ id, icon, color }) => {
          const categoryIcon = isPrimaryCTA
            ? ({
                health: "exercise",
                mindfulness: "meditate",
                productivity: "deep-work",
                social: "gratitude",
                creativity: "journal",
                finance: "focus",
                "self-care": "sleep",
                other: "focus",
              } as const)[id]
            : icon;
          return (
          <motion.button
            key={id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setSelectedCategory(id);
            }}
            className={cn(
              "flex min-h-[44px] min-w-0 flex-col items-center gap-1 rounded-xl p-2 text-xs font-medium motion-safe:transition-all",
              selectedCategory === id
                ? isPrimaryCTA
                  ? `bg-gradient-to-br ${color} text-white shadow-lg`
                  : "bg-primary text-primary-foreground shadow-md"
                : isPrimaryCTA
                  ? "bg-foreground/5 border border-foreground/10 text-[hsl(var(--zf-text-soft))] hover:bg-foreground/10 hover:text-[hsl(var(--zf-text-strong))]"
                  : "bg-background hover:bg-muted border border-border/50",
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={zenTap.card}
          >
            <span className="text-lg">
              {isPrimaryCTA ? (
                <V2HabitPictogram value={categoryIcon} className="h-6 w-6" />
              ) : (
                categoryIcon
              )}
            </span>
            <span className="w-full whitespace-normal break-words text-center">
              {categoryLabels[id]}
            </span>
          </motion.button>
          );
        })}
      </div>
    </div>
  );
}
