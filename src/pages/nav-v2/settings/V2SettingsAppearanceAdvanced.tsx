import type { CSSProperties } from "react";
import { ChevronDown, Contrast, Layers, Palette, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  THEME_ACCENT_FAMILIES,
  THEME_CUSTOMIZATION_PRESETS,
  THEME_INTENSITIES,
  type ThemeAccentFamily,
  type ThemeCustomization,
  type ThemeIntensity,
  type ThemePaletteId,
} from "@/stores/themeCustomization";

import {
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsFieldHeader,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";

const PALETTE_LABEL_FALLBACK: Record<ThemePaletteId, string> = {
  zenflow: "ZenFlow",
  morningHearth: "Morning Hearth",
  velvetLibrary: "Velvet Library",
  botanicalPulse: "Botanical Pulse",
  quietOled: "Quiet Black",
};

const ACCENT_LABEL_FALLBACK: Record<ThemeAccentFamily, string> = {
  teal: "Sea glass",
  clay: "Clay",
  plum: "Violet",
  moss: "Moss",
  amber: "Amber",
};

const INTENSITY_LABEL_FALLBACK: Record<ThemeIntensity, string> = {
  quiet: "Quiet",
  balanced: "Balanced",
  vivid: "Vivid",
};

const PALETTE_SWATCH_TOKENS: Record<ThemePaletteId, { start: string; end: string }> = {
  zenflow: { start: "143 42% 34%", end: "142 32% 94%" },
  morningHearth: { start: "36 44% 56%", end: "42 62% 98%" },
  velvetLibrary: { start: "258 70% 78%", end: "252 16% 18%" },
  botanicalPulse: { start: "139 44% 66%", end: "148 28% 82%" },
  quietOled: { start: "150 34% 6%", end: "139 38% 66%" },
};

const ACCENT_SWATCH_TOKENS: Record<ThemeAccentFamily, string> = {
  teal: "143 42% 34%",
  clay: "18 48% 38%",
  plum: "258 70% 78%",
  moss: "130 42% 32%",
  amber: "37 58% 35%",
};

function paletteSwatchStyle(paletteId: ThemePaletteId): CSSProperties {
  const swatch = PALETTE_SWATCH_TOKENS[paletteId];
  return {
    "--theme-palette-swatch-start": swatch.start,
    "--theme-palette-swatch-end": swatch.end,
  } as CSSProperties;
}

function accentSwatchStyle(accentFamily: ThemeAccentFamily): CSSProperties {
  return {
    "--theme-accent-swatch": ACCENT_SWATCH_TOKENS[accentFamily],
  } as CSSProperties;
}

type AppearanceAdvancedProps = {
  tx: Record<string, string>;
  draft: ThemeCustomization;
  onDraftChange: (patch: Partial<ThemeCustomization>) => void;
};

export function AppearanceAdvanced({ tx, draft, onDraftChange }: AppearanceAdvancedProps) {
  const labelFor = <T extends string>(
    option: { id: T; labelKey: string },
    fallback: Record<T, string>
  ) => tx[option.labelKey] || fallback[option.id];

  return (
    <details
      className="group rounded-[24px] border border-[hsl(var(--settings-v2-border)/0.18)] bg-[hsl(var(--settings-v2-shell)/0.24)]"
      data-testid="settings-v2-advanced-appearance-details"
    >
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent)/0.55)] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 text-pretty [overflow-wrap:break-word]">
            {tx.themeAdvancedAppearanceTitle || "Advanced appearance"}
          </span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-0 border-t border-[hsl(var(--settings-v2-border)/0.24)] px-3 pb-3">
        <div
          className="border-t border-[hsl(var(--settings-v2-border)/0.24)] py-3.5 first:border-t-0 first:pt-0"
          data-testid="settings-v2-mood-palette-field"
        >
          <SettingsFieldHeader
            icon={Sparkles}
            title={tx.themeStyleTitle || "Mood palette"}
            description={tx.themeStyleDescription || "Choose a curated look that sets the tone."}
          />
          <div
            className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2"
            role="group"
            aria-label={tx.themeStyleTitle || "Mood palette"}
          >
            {THEME_CUSTOMIZATION_PRESETS.map((option) => {
              const selected = draft.paletteId === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  data-interaction-surface="settings-choice"
                  data-testid={`settings-v2-style-choice-${option.id}`}
                  onClick={() => onDraftChange({ paletteId: option.id })}
                  className={cn(
                    "relative flex min-h-[54px] min-w-0 items-center justify-center gap-2 rounded-[8px] border px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-tight text-foreground motion-safe:transition-[transform,border-color,background-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2",
                    "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px]",
                    selected
                      ? "border-[hsl(var(--settings-v2-accent)/0.38)] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.32),0_14px_28px_-24px_hsl(var(--settings-v2-accent)/0.42)]"
                      : "border-[hsl(var(--settings-v2-border)/0.24)] bg-[hsl(var(--settings-v2-card)/0.28)] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.16),0_8px_18px_-18px_hsl(var(--settings-v2-shadow)/0.32)] hover:border-[hsl(var(--settings-v2-border)/0.38)] hover:bg-[hsl(var(--settings-v2-panel)/0.36)]",
                    option.id === "quietOled" && "min-[480px]:col-span-2"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-[hsl(var(--settings-v2-rim-light)/0.42)] bg-[linear-gradient(135deg,hsl(var(--theme-palette-swatch-start)),hsl(var(--theme-palette-swatch-end)))] shadow-[0_0_18px_-8px_hsl(var(--theme-palette-swatch-start)/0.7)]"
                    style={paletteSwatchStyle(option.id)}
                  />
                  <span className="min-w-0 break-words hyphens-auto text-balance">
                    {labelFor(option, PALETTE_LABEL_FALLBACK)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="border-t border-[hsl(var(--settings-v2-border)/0.24)] py-3.5"
          data-testid="settings-v2-accent-field"
        >
          <SettingsFieldHeader
            icon={Palette}
            title={tx.themeAccentTitle || "Accent"}
            description={
              tx.themeAccentDescription || "Color for buttons, selections, and highlights."
            }
          />
          <p
            id="settings-v2-accent-selected-label"
            className="text-xs font-semibold text-[hsl(var(--settings-v2-accent))]"
            data-testid="settings-v2-accent-selected-label"
          >
            {labelFor(
              THEME_ACCENT_FAMILIES.find((option) => option.id === draft.accentFamily) ||
                THEME_ACCENT_FAMILIES[0],
              ACCENT_LABEL_FALLBACK
            )}
          </p>
          <div
            className="flex flex-wrap items-center gap-2.5 py-1"
            role="group"
            aria-label={tx.themeAccentTitle || "Accent"}
            aria-describedby="settings-v2-accent-selected-label"
            data-testid="settings-v2-accent-swatch-row"
          >
            {THEME_ACCENT_FAMILIES.map((option) => {
              const selected = draft.accentFamily === option.id;
              const label = labelFor(option, ACCENT_LABEL_FALLBACK);

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={label}
                  aria-pressed={selected}
                  aria-describedby="settings-v2-accent-selected-label"
                  title={label}
                  data-interaction-surface="settings-choice"
                  data-swatch-kind="accent"
                  data-testid={`settings-v2-accent-choice-${option.id}`}
                  onClick={() => onDraftChange({ accentFamily: option.id })}
                  className={cn(
                    "relative h-11 w-11 rounded-full border motion-safe:transition-[transform,border-color,box-shadow,filter] motion-safe:duration-200 motion-safe:ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2",
                    "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px]",
                    selected
                      ? "border-[hsl(var(--settings-v2-accent)/0.48)] shadow-[0_0_0_3px_hsl(var(--settings-v2-accent)/0.12),0_0_18px_-12px_hsl(var(--theme-accent-swatch)/0.5)]"
                      : "border-[hsl(var(--settings-v2-border)/0.38)] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.24),0_10px_18px_-18px_hsl(var(--settings-v2-shadow)/0.48)]"
                  )}
                  style={accentSwatchStyle(option.id)}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-1.5 rounded-full bg-[radial-gradient(circle_at_32%_24%,hsl(var(--settings-v2-rim-light)/0.6),transparent_34%),linear-gradient(145deg,hsl(var(--theme-accent-swatch)/0.76),hsl(var(--theme-accent-swatch)/0.42))]"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[hsl(var(--settings-v2-border)/0.24)] py-3.5">
          <details
            className="group rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.24)] bg-[hsl(var(--settings-v2-shell)/0.28)]"
            data-testid="settings-v2-comfort-details"
          >
            <summary
              className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent)/0.55)] [&::-webkit-details-marker]:hidden"
              data-testid="settings-v2-comfort-summary"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]">
                  <Contrast className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 truncate">{tx.themeComfortTitle || "Comfort"}</span>
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-3 border-t border-[hsl(var(--settings-v2-border)/0.36)] p-3 pt-3">
              <div>
                <SettingsFieldHeader icon={Layers} title={tx.themeIntensityTitle || "Intensity"} />
                <SettingsButtonGrid
                  columns="three"
                  role="group"
                  ariaLabel={tx.themeIntensityTitle || "Intensity"}
                >
                  {THEME_INTENSITIES.map((option) => (
                    <SettingsChoiceButton
                      key={option.id}
                      selected={draft.intensity === option.id}
                      onClick={() => onDraftChange({ intensity: option.id })}
                      presentation="compact"
                      testId={`settings-v2-intensity-choice-${option.id}`}
                    >
                      {labelFor(option, INTENSITY_LABEL_FALLBACK)}
                    </SettingsChoiceButton>
                  ))}
                </SettingsButtonGrid>
              </div>
              <ToggleRow
                icon={Contrast}
                title={tx.themeHighContrast || "High contrast"}
                description={
                  tx.themeHighContrastHint || "Strengthens text, borders, and focus indicators."
                }
                checked={draft.contrastMode === "high"}
                onCheckedChange={(checked) =>
                  onDraftChange({ contrastMode: checked ? "high" : "standard" })
                }
                testId="settings-v2-high-contrast-toggle"
              />
              <ToggleRow
                icon={Sparkles}
                title={tx.themeReduceGlow || "Reduce glow"}
                description={tx.themeReduceGlowHint || "Keeps surfaces calmer in low light."}
                checked={draft.reduceGlow}
                onCheckedChange={(checked) => onDraftChange({ reduceGlow: checked })}
                testId="settings-v2-reduce-glow-toggle"
              />
              <ToggleRow
                icon={Layers}
                title={tx.themeReduceTransparency || "Reduce transparency"}
                description={
                  tx.themeReduceTransparencyHint || "Uses more solid panels for readability."
                }
                checked={draft.reduceTransparency}
                onCheckedChange={(checked) => onDraftChange({ reduceTransparency: checked })}
                testId="settings-v2-reduce-transparency-toggle"
              />
            </div>
          </details>
        </div>
      </div>
    </details>
  );
}
