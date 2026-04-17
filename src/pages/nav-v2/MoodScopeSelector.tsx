import { memo, useCallback, useId } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLanguage } from "@/contexts/LanguageContext";
import { haptics } from "@/lib/haptics";
import {
  useMoodEntryDraftStore,
  type MoodDraftScope,
} from "@/stores/moodEntryDraftStore";
import "./MoodScopeSelector.css";

/**
 * MoodScopeSelector — Phase 3-A.4b glassy segmented chip bar.
 *
 * Three chips for "when did this apply":
 *   - `now`      → in this moment (default)
 *   - `day`      → for the whole day
 *   - `specific` → at a specific time (reveals native <input type=time>)
 *
 * Styling rationale: `backdrop-blur-xl bg-card/30 border border-white/10`
 * floats over cosmic backdrop without breaking the aesthetic. In paper
 * (day) theme the same tokens resolve to warm glass.
 *
 * Law 9 (a11y): role=radiogroup, aria-pressed on buttons, label for time.
 * Law 10 (cross-platform): time input is native, works on iOS/Android/Desktop.
 * Law 17 (i18n): 3 scope labels + time-input label i18n via t().
 */

const SCOPE_KEYS: Record<MoodDraftScope, string> = {
  now: "orbScopeNow",
  day: "orbScopeDay",
  specific: "orbScopeSpecific",
};

function ScopeChip({
  scope,
  active,
  label,
  onSelect,
  variant = "secondary",
}: {
  scope: MoodDraftScope;
  active: boolean;
  label: string;
  onSelect: (scope: MoodDraftScope) => void;
  /** Primary = prominent default ("Now"); secondary = softer opt-in. */
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-testid={`mood-scope-chip-${scope}`}
      data-scope={scope}
      data-active={active ? "true" : "false"}
      data-variant={variant}
      className={[
        "mood-scope-chip",
        "relative flex items-center justify-center",
        variant === "primary"
          ? "px-5 py-2.5 md:px-6 md:py-3 text-sm md:text-base font-semibold"
          : "px-4 py-2 md:px-5 md:py-2.5 text-sm md:text-base font-medium",
        "rounded-full",
        "transition-all duration-200 ease-out",
        "min-h-[44px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        active ? "mood-scope-chip-active" : "mood-scope-chip-idle",
      ].join(" ")}
      onClick={() => {
        void haptics.tabChanged();
        onSelect(scope);
      }}
    >
      {label}
    </button>
  );
}

export const MoodScopeSelector = memo(function MoodScopeSelector() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const timeInputId = useId();

  const { scope, specificTime, setScope, setSpecificTime } =
    useMoodEntryDraftStore(
      useShallow((s) => ({
        scope: s.scope,
        specificTime: s.specificTime,
        setScope: s.setScope,
        setSpecificTime: s.setSpecificTime,
      })),
    );

  const onSelect = useCallback(
    (next: MoodDraftScope) => {
      setScope(next);
    },
    [setScope],
  );

  const onTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSpecificTime(e.target.value || null);
    },
    [setSpecificTime],
  );

  return (
    <div
      className="mood-scope-wrapper"
      data-testid="mood-scope-selector"
      role="radiogroup"
      aria-label={tx.orbScopeGroupLabel || "When did this apply?"}
    >
      {/*
        Phase 3-A.4c-ii-d-a — "Now" is the primary, prominent default.
        "Specific time" is a subtle secondary that reveals a native picker.
        "Whole day" kept as third option for users capturing an overall day.
      */}
      <div className="mood-scope-chip-row" data-scope-refined="true">
        <ScopeChip
          scope="now"
          active={scope === "now"}
          label={tx[SCOPE_KEYS.now] || "In this moment"}
          onSelect={onSelect}
          variant="primary"
        />
        <ScopeChip
          scope="specific"
          active={scope === "specific"}
          label={tx[SCOPE_KEYS.specific] || "At a specific time"}
          onSelect={onSelect}
          variant="secondary"
        />
        <ScopeChip
          scope="day"
          active={scope === "day"}
          label={tx[SCOPE_KEYS.day] || "For the whole day"}
          onSelect={onSelect}
          variant="secondary"
        />
      </div>

      {scope === "specific" && (
        <div
          className="mood-scope-time-reveal"
          data-testid="mood-scope-time-picker"
        >
          <label
            htmlFor={timeInputId}
            className="mood-scope-time-label"
          >
            {tx.orbScopeSpecificTimeLabel || "Pick a time"}
          </label>
          <input
            id={timeInputId}
            type="time"
            data-testid="mood-scope-time-input"
            className="mood-scope-time-input"
            value={specificTime ?? ""}
            onChange={onTimeChange}
            aria-label={tx.orbScopeSpecificTimeLabel || "Pick a time"}
          />
        </div>
      )}
    </div>
  );
});
