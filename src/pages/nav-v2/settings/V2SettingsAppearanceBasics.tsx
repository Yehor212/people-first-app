import type { RefObject } from "react";
import {
  Leaf,
  Moon,
  MoreHorizontal,
  RotateCcw,
  Smartphone,
  Sun,
  Type,
  type LucideIcon,
} from "lucide-react";

import { FONT_SCALE_LEVELS, type FontScaleLevel } from "@/hooks/useFontScale";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/stores/themeStore";

import {
  SettingsFieldHeader,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";

const FONT_SCALE_LABELS: Record<number, string> = {
  0.85: "fontScaleTiny",
  0.9: "fontScaleSmall",
  1: "fontScaleDefault",
  1.1: "fontScaleMedium",
  1.2: "fontScaleLarge",
  1.3: "fontScaleXL",
  1.5: "fontScaleXXL",
};

type AppearanceBasicsProps = {
  tx: Record<string, string>;
  theme: ThemePreference;
  scale: FontScaleLevel;
  appearanceMenuOpen: boolean;
  appearanceMoreButtonRef: RefObject<HTMLButtonElement>;
  appearanceResetButtonRef: RefObject<HTMLButtonElement>;
  onToggleAppearanceMenu: () => void;
  onReset: () => void;
  onThemeChange: (theme: ThemePreference) => void;
  onFontScaleChange: (scale: FontScaleLevel) => void;
};

export function AppearanceBasics({
  tx,
  theme,
  scale,
  appearanceMenuOpen,
  appearanceMoreButtonRef,
  appearanceResetButtonRef,
  onToggleAppearanceMenu,
  onReset,
  onThemeChange,
  onFontScaleChange,
}: AppearanceBasicsProps) {
  const currentFontIndex = FONT_SCALE_LEVELS.indexOf(scale);
  const themeOptions: Array<{
    value: Exclude<ThemePreference, "oled">;
    icon: LucideIcon;
    label: string;
  }> = [
    { value: "paper", icon: Sun, label: tx.themeLight || "Light" },
    { value: "ink", icon: Moon, label: tx.themeDark || "Dark" },
    { value: "auto", icon: Smartphone, label: tx.themeSystem || "System" },
  ];

  return (
    <>
      <section
        className="relative grid gap-3 rounded-[18px] bg-[hsl(var(--settings-v2-panel)/0.34)] p-3 pe-14 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-4 sm:pe-16"
        aria-label={tx.appearance || "Appearance"}
        data-testid="settings-v2-identity-anchor"
      >
        <button
          ref={appearanceMoreButtonRef}
          type="button"
          aria-label={tx.themeMoreActions || tx.moreActions || tx.appearance}
          aria-expanded={appearanceMenuOpen}
          aria-controls={appearanceMenuOpen ? "settings-v2-appearance-more-menu" : undefined}
          onClick={onToggleAppearanceMenu}
          className="absolute end-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--settings-v2-border)/0.34)] bg-[hsl(var(--settings-v2-card)/0.56)] text-foreground/82 shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.24),0_14px_30px_-24px_hsl(var(--settings-v2-shadow)/0.72)] backdrop-blur-[var(--settings-v2-glass-blur,24px)] [-webkit-backdrop-filter:blur(var(--settings-v2-glass-blur,24px))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 motion-safe:transition-[transform,border-color,background-color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px]"
          data-testid="settings-v2-appearance-more"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
        {appearanceMenuOpen && (
          <div
            id="settings-v2-appearance-more-menu"
            role="group"
            aria-label={tx.themeMoreActions || tx.moreActions || tx.appearance}
            className="absolute end-3 top-14 z-20 min-w-[10.5rem] rounded-[18px] border border-[hsl(var(--settings-v2-border)/0.22)] bg-[hsl(var(--settings-v2-card)/0.92)] p-1.5 text-start shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.22),0_18px_42px_-30px_hsl(var(--settings-v2-shadow)/0.58)] backdrop-blur-[var(--settings-v2-glass-blur,24px)] [-webkit-backdrop-filter:blur(var(--settings-v2-glass-blur,24px))]"
            data-testid="settings-v2-appearance-more-menu"
          >
            <button
              ref={appearanceResetButtonRef}
              type="button"
              onClick={onReset}
              data-testid="settings-v2-style-reset"
              className="flex min-h-11 w-full items-center gap-2 rounded-[14px] px-3 text-sm font-semibold text-foreground/78 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 motion-safe:transition-[transform,background-color,color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-panel)/0.32)] motion-safe:active:translate-y-[1px]"
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{tx.themeResetAction}</span>
            </button>
          </div>
        )}
        <span
          aria-hidden="true"
          className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[26px] border border-[hsl(var(--settings-v2-rim-light)/0.26)] bg-[radial-gradient(circle_at_32%_18%,hsl(var(--settings-v2-rim-light)/0.42),transparent_34%),linear-gradient(145deg,hsl(var(--settings-v2-icon-glass-mid)),hsl(var(--settings-v2-icon-glass))_58%,hsl(var(--settings-v2-icon-glass-dark)))] text-[hsl(var(--settings-v2-icon-glyph))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.35),inset_0_-18px_26px_-22px_hsl(var(--settings-v2-icon-shadow)/0.62),0_18px_34px_-24px_hsl(var(--settings-v2-shadow)/0.72)]"
        >
          <Leaf className="h-12 w-12" strokeWidth={2.75} aria-hidden="true" />
        </span>
        <span className="grid min-w-0 gap-1 text-center sm:text-start">
          <span className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[hsl(var(--settings-v2-accent))]">
            ZenFlow
          </span>
          <span className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">
            {tx.appearance || "Appearance"}
          </span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            {tx.themeStyleDescription || tx.navV2Theme || tx.theme}
          </span>
        </span>
      </section>

      <div
        className="border-t border-[hsl(var(--settings-v2-border)/0.2)] py-3"
        data-testid="settings-v2-theme-mode-field"
      >
        <div
          className="grid grid-cols-3 gap-1 rounded-full border border-[hsl(var(--settings-v2-border)/0.2)] bg-[hsl(var(--settings-v2-shell)/0.22)] p-1 shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.14)]"
          role="group"
          aria-label={tx.themeLabel || "Theme"}
          data-testid="settings-v2-theme-segmented-control"
        >
          {themeOptions.map((option) => {
            const selected = theme === option.value;
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onThemeChange(option.value)}
                data-interaction-surface="settings-choice"
                data-testid={`settings-v2-theme-choice-${option.value}`}
                className={cn(
                  "relative flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-full border px-2.5 text-[0.8125rem] font-semibold motion-safe:transition-[transform,border-color,background-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 sm:min-h-[58px] sm:px-3 sm:text-sm",
                  selected
                    ? "border-[hsl(var(--settings-v2-accent)/0.38)] bg-[hsl(var(--settings-v2-accent)/0.14)] text-[hsl(var(--settings-v2-accent))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.2),0_10px_24px_-22px_hsl(var(--settings-v2-accent)/0.36)]"
                    : "border-transparent bg-transparent text-foreground/84 hover:bg-[hsl(var(--settings-v2-panel)/0.28)]",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>

        <ToggleRow
          icon={Moon}
          title={tx.oledDarkMode || "OLED Dark Mode"}
          description={tx.oledDarkModeHint || "Pure black theme for OLED screens. May save battery."}
          checked={theme === "oled"}
          onCheckedChange={(checked) => onThemeChange(checked ? "oled" : "ink")}
          testId="settings-v2-oled-toggle"
        />
      </div>

      <div
        className="border-t border-[hsl(var(--settings-v2-border)/0.2)] py-3"
        data-testid="settings-v2-text-size-field"
      >
        <SettingsFieldHeader
          icon={Type}
          title={tx.fontScaleTitle || "Text Size"}
          description={tx.fontScalePreviewSub || "Adjust text size across the app."}
        />
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground" aria-hidden="true">A</span>
          <span className="text-sm font-semibold text-foreground" aria-live="polite">
            {tx[FONT_SCALE_LABELS[scale]] || `${Math.round(scale * 100)}%`}
          </span>
          <span className="text-xl text-muted-foreground" aria-hidden="true">A</span>
        </div>
        <input
          type="range"
          min={0}
          max={FONT_SCALE_LEVELS.length - 1}
          step={1}
          value={currentFontIndex}
          onChange={(event) => onFontScaleChange(FONT_SCALE_LEVELS[Number(event.target.value)])}
          className="settings-v2-range-control h-11 w-full cursor-pointer appearance-none"
          aria-label={tx.fontScaleTitle || "Text Size"}
        />
      </div>
    </>
  );
}
