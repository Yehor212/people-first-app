import { memo, useCallback, useEffect, useId, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ValenceOrb } from "@/components/state-of-mind/ValenceOrb";
import { hapticSelection } from "@/lib/haptics";
import type { MoodType } from "@/types";
import "./MoodOrbPicker.css";

/**
 * MoodOrbPicker — Phase 3-A.4c-ii-d-a discrete 5-orb mood selector.
 *
 * Replaces MoodSlider on V2 OrbPage. Apple State of Mind pattern:
 *   5 orbs with literary labels: Very Unpleasant / Unpleasant / Neutral /
 *   Pleasant / Very Pleasant, mapped to valence [-1, -0.5, 0, 0.5, 1].
 *
 * Interaction model:
 *   - Tap orb → select + hapticSelection fires + onChange callback
 *   - Tap selected orb → deselect (onChange(null)) — allows change
 *   - Arrow Left/Right cycles focus between 5 orbs
 *   - Space/Enter selects focused orb
 *   - Hover (desktop) → scale 1.05 + label opacity 1.0
 *
 * Color echo: once selected, sets --page-tint CSS var on the fieldset
 * so ancestor chrome can echo a gentle wash of the mood hue.
 *
 * RTL: row direction reverses so "very_pleasant" lives on the left in
 * ar/he — matches the visual reading flow.
 *
 * Law 9 (a11y): fieldset+legend, role=radiogroup, aria-checked, focus ring,
 * keyboard nav, 44px min target.
 * Law 10 (cross-platform): static orbs except selected (shader gated).
 * Law 17 (i18n): every label routed through t() with safe fallback.
 * Law 23: only selected orb animates (ValenceOrb's shouldAnimate gate).
 */

export interface MoodOrbPickerProps {
  /** Current selected mood, or null when nothing chosen yet. */
  value: MoodType | null;
  /** Fires with new mood on select, null on deselect of current. */
  onChange: (mood: MoodType | null) => void;
  /** Disables the entire picker. */
  disabled?: boolean;
}

/** 5 orbs, ordered from unpleasant → pleasant. */
interface OrbDef {
  mood: MoodType;
  valence: number;
  /** i18n key (falls back to English when lookup fails). */
  labelKey: string;
  labelFallback: string;
  /** Hue for --page-tint when selected (warm/cool cosmic echo). */
  tintHue: number;
}

const ORBS: readonly OrbDef[] = [
  {
    mood: "terrible",
    valence: -1,
    labelKey: "moodVeryUnpleasant",
    labelFallback: "Very unpleasant",
    tintHue: 250,
  },
  {
    mood: "bad",
    valence: -0.5,
    labelKey: "moodUnpleasant",
    labelFallback: "Unpleasant",
    tintHue: 220,
  },
  {
    mood: "okay",
    valence: 0,
    labelKey: "moodNeutral",
    labelFallback: "Neutral",
    tintHue: 40,
  },
  {
    mood: "good",
    valence: 0.5,
    labelKey: "moodPleasant",
    labelFallback: "Pleasant",
    tintHue: 80,
  },
  {
    mood: "great",
    valence: 1,
    labelKey: "moodVeryPleasant",
    labelFallback: "Very pleasant",
    tintHue: 120,
  },
] as const;

export const MoodOrbPicker = memo(function MoodOrbPicker({
  value,
  onChange,
  disabled = false,
}: MoodOrbPickerProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const groupId = useId();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Color echo: selected orb sets --page-tint on fieldset.
  const selectedDef = ORBS.find((o) => o.mood === value) ?? null;
  const tintStyle = selectedDef
    ? ({ "--page-tint": `hsl(${selectedDef.tintHue} 60% 55% / 0.08)` } as React.CSSProperties)
    : undefined;

  const handleSelect = useCallback(
    (mood: MoodType) => {
      if (disabled) return;
      void hapticSelection();
      onChange(value === mood ? null : mood);
    },
    [disabled, onChange, value],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (disabled) return;
      const last = ORBS.length - 1;
      let next = index;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        next = index === last ? 0 : index + 1;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        next = index === 0 ? last : index - 1;
      } else {
        return;
      }
      e.preventDefault();
      buttonRefs.current[next]?.focus();
    },
    [disabled],
  );

  // Ensure the ref array stays sized with the orbs (defensive).
  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, ORBS.length);
  }, []);

  const legendText = tx.moodOrbGroupLabel || "How do you feel?";

  return (
    <fieldset
      className="mood-orb-picker"
      data-testid="mood-orb-picker"
      data-has-selection={value !== null ? "true" : "false"}
      style={tintStyle}
      disabled={disabled}
      aria-labelledby={`${groupId}-legend`}
    >
      <legend
        id={`${groupId}-legend`}
        className="mood-orb-picker-legend"
        data-testid="mood-orb-picker-legend"
      >
        {legendText}
      </legend>

      <div
        className="mood-orb-picker-row"
        role="radiogroup"
        aria-label={legendText}
      >
        {ORBS.map((def, index) => {
          const selected = value === def.mood;
          const label = tx[def.labelKey] || def.labelFallback;
          return (
            <button
              key={def.mood}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              data-testid={`mood-orb-option-${def.mood}`}
              data-mood={def.mood}
              data-valence={def.valence}
              data-selected={selected ? "true" : "false"}
              className="mood-orb-option"
              disabled={disabled}
              tabIndex={selected || (value === null && index === 2) ? 0 : -1}
              onClick={() => handleSelect(def.mood)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <ValenceOrb valence={def.valence} size={56} />
              <span className="mood-orb-option-label">{label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
});
