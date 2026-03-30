/**
 * FormSelectors — Icon, Color, Type, Frequency, Category selector sub-components
 * for the HabitCreationForm.
 */

import { motion } from "framer-motion";
import { zenTap } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";
import {
  habitIcons,
  habitCategories,
  frequencyPresets,
} from "@/hooks/useHabitForm";
import { LOOP_PALETTE_LIGHT, resolveHabitColor } from "@/lib/habitColorUtils";
import type { HabitCategory, LoopHabitType } from "@/types";

interface SelectorProps {
  isPrimaryCTA: boolean;
  ts: Record<string, string>;
}

/* ═══ ICON SELECTOR ═══ */

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
            ? "text-slate-700 dark:text-foreground/80"
            : "text-foreground",
        )}
        id="icon-selector-label"
      >
        {ts.icon || "Icon"}:
      </p>
      <div
        className="flex gap-2 flex-wrap"
        role="radiogroup"
        aria-labelledby="icon-selector-label"
      >
        {habitIcons.map((icon) => (
          <motion.button
            key={icon}
            type="button"
            role="radio"
            aria-checked={selectedIcon === icon}
            aria-label={`${ts.selectIcon || "Select icon"} ${icon}`}
            onClick={(e) => {
              e.preventDefault();
              setSelectedIcon(icon);
            }}
            className={cn(
              "w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-xl transition-all duration-200 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isPrimaryCTA
                ? selectedIcon === icon
                  ? "bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40"
                  : "bg-foreground/5 border border-foreground/10 hover:bg-foreground/10"
                : selectedIcon === icon
                  ? "bg-primary/20 ring-2 ring-primary scale-105 shadow-sm"
                  : "bg-background hover:bg-muted hover:scale-105",
            )}
            style={
              isPrimaryCTA && selectedIcon === icon
                ? { boxShadow: "0 0 16px rgba(139, 92, 246, 0.4)" }
                : undefined
            }
            whileHover={{ scale: 1.05 }}
            whileTap={zenTap.button}
          >
            {icon}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ═══ COLOR SELECTOR ═══ */

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
            ? "text-slate-700 dark:text-foreground/80"
            : "text-foreground",
        )}
        id="color-selector-label"
      >
        {ts.color || "Color"}:
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
              aria-label={`${ts.selectColor || "Select color"} ${idx + 1}`}
              onClick={(e) => {
                e.preventDefault();
                setSelectedColorIndex(idx);
              }}
              className={cn(
                "w-8 h-8 min-w-[44px] min-h-[44px] rounded-full transition-all duration-200 cursor-pointer",
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

/* ═══ TYPE SELECTOR ═══ */

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
            ? "text-slate-700 dark:text-foreground/80"
            : "text-foreground",
        )}
      >
        {ts.habitType || "Type"}:
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            type: "boolean" as LoopHabitType,
            icon: "✓",
            label: ts.habitTypeBoolean || "Yes/No",
            desc: ts.habitTypeBooleanDesc || "Check off once a day",
          },
          {
            type: "numerical" as LoopHabitType,
            icon: "🔢",
            label: ts.habitTypeNumerical || "Measurable",
            desc: ts.habitTypeNumericalDesc || "Track a number per day",
          },
        ].map(({ type, icon, label, desc }) => (
          <motion.button
            key={type}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setHabitType(type);
            }}
            className={cn(
              "p-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer min-h-[44px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isPrimaryCTA
                ? habitType === type
                  ? "bg-gradient-to-br from-emerald-500/30 to-teal-600/20 border border-emerald-500/40 text-white"
                  : "bg-foreground/5 border border-foreground/10 text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
                : habitType === type
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-background hover:bg-muted border border-border/50",
            )}
            style={
              isPrimaryCTA && habitType === type
                ? { boxShadow: "0 0 12px rgba(16, 185, 129, 0.4)" }
                : undefined
            }
            whileHover={{ scale: 1.02 }}
            whileTap={zenTap.card}
          >
            <span>
              {icon} {label}
            </span>
            <span
              className={cn(
                "text-[10px] block mt-0.5",
                isPrimaryCTA
                  ? habitType === type
                    ? "text-foreground/50"
                    : "text-foreground/30"
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

/* ═══ FREQUENCY SELECTOR ═══ */

interface FrequencySelectorProps extends SelectorProps {
  frequency: { numerator: number; denominator: number };
  setFrequency: (f: { numerator: number; denominator: number }) => void;
}

export function FrequencySelector({
  frequency,
  setFrequency,
  isPrimaryCTA,
  ts,
}: FrequencySelectorProps) {
  const activePresetIndex = frequencyPresets.findIndex(
    (p) =>
      p.ratio.numerator === frequency.numerator &&
      p.ratio.denominator === frequency.denominator,
  );

  return (
    <div className="relative mb-4">
      <p
        className={cn(
          "text-sm font-medium mb-2",
          isPrimaryCTA
            ? "text-slate-700 dark:text-foreground/80"
            : "text-foreground",
        )}
      >
        {ts.habitFrequency || "Frequency"}:
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
              "px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activePresetIndex === idx
                ? isPrimaryCTA
                  ? "bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40 text-white"
                  : "bg-primary text-primary-foreground shadow-sm"
                : isPrimaryCTA
                  ? "bg-foreground/5 border border-foreground/10 text-foreground/70"
                  : "bg-background border border-border/50 hover:bg-muted",
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={zenTap.card}
          >
            {ts[preset.i18nKey] || preset.label}
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
            {frequency.numerator}× / {frequency.denominator}
            {ts.daysAbbr || "d"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══ CATEGORY SELECTOR ═══ */

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
    health: ts.categoryHealth || "Health",
    mindfulness: ts.categoryMindfulness || "Mindfulness",
    productivity: ts.categoryProductivity || "Productivity",
    social: ts.categorySocial || "Social",
    creativity: ts.categoryCreativity || "Creativity",
    finance: ts.categoryFinance || "Finance",
    "self-care": ts.categorySelfCare || "Self-care",
    other: ts.categoryOther || "Other",
  };

  return (
    <div className="relative mb-4">
      <label
        className={cn(
          "text-sm mb-2 block",
          isPrimaryCTA
            ? "text-slate-500 dark:text-foreground/60"
            : "text-muted-foreground",
        )}
      >
        {ts.habitCategory || "Category"}:
      </label>
      <div className="grid grid-cols-4 gap-2">
        {habitCategories.map(({ id, icon, color }) => (
          <motion.button
            key={id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setSelectedCategory(id);
            }}
            className={cn(
              "p-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-1",
              selectedCategory === id
                ? isPrimaryCTA
                  ? `bg-gradient-to-br ${color} text-white shadow-lg`
                  : "bg-primary text-primary-foreground shadow-md"
                : isPrimaryCTA
                  ? "bg-foreground/5 border border-foreground/10 text-foreground/70 hover:bg-foreground/10"
                  : "bg-background hover:bg-muted border border-border/50",
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={zenTap.card}
          >
            <span className="text-lg">{icon}</span>
            <span className="truncate w-full text-center">
              {categoryLabels[id]}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
