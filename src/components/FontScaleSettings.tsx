import { Type } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFontScale, FONT_SCALE_LEVELS } from "@/hooks/useFontScale";
import { cn } from "@/lib/utils";

const SCALE_LABELS: Record<number, string> = {
  0.85: "fontScaleTiny",
  0.9: "fontScaleSmall",
  1.0: "fontScaleDefault",
  1.1: "fontScaleMedium",
  1.2: "fontScaleLarge",
  1.3: "fontScaleXL",
  1.5: "fontScaleXXL",
};

/**
 * Telegram-style font size settings card with discrete steps.
 * Renders as a standalone card in SettingsPanel (same pattern as Dopamine).
 */
export function FontScaleSettings() {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const { scale, setFontScale } = useFontScale();

  const currentIndex = FONT_SCALE_LEVELS.indexOf(scale);

  return (
    <div className="bg-card rounded-2xl p-5 zen-shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <Type className="w-5 h-5 text-primary" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">
          {ts.fontScaleTitle || "Text Size"}
        </h3>
      </div>

      {/* Preview text */}
      <div className="bg-muted/50 rounded-xl p-4 mb-4">
        <p className="text-foreground">
          {ts.fontScalePreview || "Preview: How your text will look"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {ts.fontScalePreviewSub ||
            "Adjust the slider below to change text size across the app."}
        </p>
      </div>

      {/* Scale indicator */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-muted-foreground">A</span>
        <span className="text-sm font-medium text-foreground">
          {ts[SCALE_LABELS[scale]] ||
            (scale === 1.0 ? "Default" : `${Math.round(scale * 100)}%`)}
        </span>
        <span className="text-xl text-muted-foreground">A</span>
      </div>

      {/* Discrete step slider */}
      <div className="relative px-1">
        <input
          type="range"
          min={0}
          max={FONT_SCALE_LEVELS.length - 1}
          step={1}
          value={currentIndex}
          onChange={(e) => {
            const idx = Number(e.target.value);
            setFontScale(FONT_SCALE_LEVELS[idx]);
          }}
          className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background
            [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background"
          aria-label={ts.fontScaleTitle || "Text Size"}
          aria-valuemin={0}
          aria-valuemax={FONT_SCALE_LEVELS.length - 1}
          aria-valuenow={currentIndex}
          aria-valuetext={`${Math.round(scale * 100)}%`}
        />

        {/* Step dots — visual dot is 8px, tappable area is 44px (WCAG 2.5.5) */}
        <div className="flex justify-between mt-1">
          {FONT_SCALE_LEVELS.map((level, i) => (
            <button
              key={level}
              // A11Y-OK: aria-label provided below with percentage value for screen readers
              onClick={() => setFontScale(level)}
              aria-label={`${Math.round(level * 100)}%`}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-4"
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full motion-safe:transition-colors",
                  i === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
