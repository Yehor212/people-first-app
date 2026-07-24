import type { CSSProperties, ReactNode } from "react";
import { Contrast, Palette } from "lucide-react";

import {
  THEME_ACCENT_FAMILIES,
  getThemeCustomizationRecipe,
  type AppliedTheme,
  type ThemeAccentFamily,
  type ThemeCustomization,
} from "@/stores/themeCustomization";

import {
  SettingsChoiceButton,
  SettingsFieldHeader,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";

const ACCENT_LABEL_FALLBACK: Record<ThemeAccentFamily, string> = {
  green: "Green",
  blue: "Blue",
  violet: "Violet",
  amber: "Amber",
};

type AppearanceAccentProps = {
  tx: Record<string, string>;
  appliedTheme: AppliedTheme;
  customization: ThemeCustomization;
  feedback?: ReactNode;
  onChange: (patch: Partial<ThemeCustomization>) => void;
};

function accentPreviewStyle(
  appliedTheme: AppliedTheme,
  customization: ThemeCustomization,
  accent: ThemeAccentFamily
): CSSProperties {
  const accentToken = getThemeCustomizationRecipe(appliedTheme, {
    ...customization,
    accentFamily: accent,
  }).cssVars["--settings-v2-accent"];
  return {
    "--settings-v2-choice-accent": accentToken,
  } as CSSProperties;
}

export function AppearanceAccent({
  tx,
  appliedTheme,
  customization,
  feedback,
  onChange,
}: AppearanceAccentProps) {
  return (
    <>
      <section
        className="border-t border-[hsl(var(--settings-v2-border)/0.24)] pt-4"
        data-testid="settings-v2-accent-field"
      >
        <SettingsFieldHeader
          icon={Palette}
          title={tx.themeAccentTitle || "Accent color"}
          description={
            tx.themeAccentDescription || "Color for buttons, selections, and highlights."
          }
        />
        <div
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(7.5rem*var(--font-scale,1))),1fr))] gap-2"
          role="group"
          aria-label={tx.themeAccentTitle || "Accent color"}
          data-testid="settings-v2-accent-grid"
        >
          {THEME_ACCENT_FAMILIES.map((option) => {
            const label = tx[option.labelKey] || ACCENT_LABEL_FALLBACK[option.id];
            return (
              <SettingsChoiceButton
                key={option.id}
                selected={customization.accentFamily === option.id}
                onClick={() => onChange({ accentFamily: option.id })}
                presentation="compact"
                selectedTone="solid"
                surface="secondary"
                testId={`settings-v2-accent-choice-${option.id}`}
                className="min-h-[48px] justify-start rounded-[8px] px-3"
              >
                <span
                  aria-hidden="true"
                  data-swatch-kind="accent"
                  className="h-5 w-5 shrink-0 rounded-full border border-[hsl(var(--settings-v2-border)/0.5)] bg-[hsl(var(--settings-v2-choice-accent))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.24)]"
                  style={accentPreviewStyle(appliedTheme, customization, option.id)}
                />
                <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:break-word]">
                  {label}
                </span>
              </SettingsChoiceButton>
            );
          })}
        </div>
      </section>

      {feedback}

      <ToggleRow
        icon={Contrast}
        title={tx.themeHighContrast || "High contrast"}
        description={tx.themeHighContrastHint || "Strengthens text, borders, and focus indicators."}
        checked={customization.highContrast}
        onCheckedChange={(checked) => onChange({ highContrast: checked })}
        testId="settings-v2-high-contrast-toggle"
      />
    </>
  );
}
