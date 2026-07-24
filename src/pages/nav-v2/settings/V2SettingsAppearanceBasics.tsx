import type { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Circle,
  Moon,
  MoreHorizontal,
  RotateCcw,
  Smartphone,
  Sun,
  Type,
  type LucideIcon,
} from "lucide-react";

import { FONT_SCALE_LEVELS, type FontScaleLevel } from "@/hooks/useFontScale";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { motionPresets, zenMotion } from "@/lib/animationUtils";
import type { ThemePreference } from "@/stores/themeStore";

import {
  SettingsChoiceButton,
  SettingsFieldHeader,
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
  canResetAppearance: boolean;
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
  canResetAppearance,
  appearanceMoreButtonRef,
  appearanceResetButtonRef,
  onToggleAppearanceMenu,
  onReset,
  onThemeChange,
  onFontScaleChange,
}: AppearanceBasicsProps) {
  const shouldAnimate = useShouldAnimate();
  const currentFontIndex = Math.max(0, FONT_SCALE_LEVELS.indexOf(scale));
  const currentFontLabel = tx[FONT_SCALE_LABELS[scale]] || `${Math.round(scale * 100)}%`;
  const themeOptions: Array<{
    value: ThemePreference;
    icon: LucideIcon;
    label: string;
  }> = [
    { value: "auto", icon: Smartphone, label: tx.themeSystem || "System" },
    { value: "paper", icon: Sun, label: tx.themeLight || "Light" },
    { value: "ink", icon: Moon, label: tx.themeDark || "Dark" },
    { value: "oled", icon: Circle, label: tx.themeBlack || tx.oledDarkMode || "Black" },
  ];

  return (
    <>
      <section
        className="relative border-b border-[hsl(var(--settings-v2-border)/0.24)] pb-4"
        aria-label={tx.themeModeTitle || tx.themeLabel || "Color mode"}
        data-testid="settings-v2-theme-mode-field"
      >
        <div
          className="mb-2 grid min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-start"
          data-testid="settings-v2-theme-header-layout"
        >
          <div className="min-w-0">
            <SettingsFieldHeader
              title={tx.themeModeTitle || tx.themeLabel || "Color mode"}
              description={
                tx.themeModeDescription || "Use your device setting or choose a fixed mode."
              }
            />
          </div>
          {canResetAppearance ? (
            <div className="relative justify-self-end min-[420px]:col-start-2 min-[420px]:row-start-1">
              <button
                ref={appearanceMoreButtonRef}
                type="button"
                aria-label={tx.themeMoreActions || tx.moreActions || "More appearance actions"}
                aria-expanded={appearanceMenuOpen}
                aria-controls={appearanceMenuOpen ? "settings-v2-appearance-more-menu" : undefined}
                onClick={onToggleAppearanceMenu}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[hsl(var(--settings-v2-border)/0.42)] bg-[hsl(var(--settings-v2-shell)/0.56)] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-focus,var(--settings-v2-accent)))] focus-visible:ring-offset-2 motion-safe:transition-[transform,background-color,border-color] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px]"
                data-testid="settings-v2-appearance-more"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>

              <AnimatePresence initial={false}>
                {appearanceMenuOpen ? (
                  <motion.div
                    id="settings-v2-appearance-more-menu"
                    initial={shouldAnimate ? motionPresets.scaleIn.initial : false}
                    animate={motionPresets.scaleIn.animate}
                    exit={
                      shouldAnimate ? motionPresets.scaleIn.initial : motionPresets.scaleIn.animate
                    }
                    transition={
                      shouldAnimate ? motionPresets.scaleIn.transition : zenMotion.instant
                    }
                    className="absolute end-0 top-12 z-20 min-w-[11rem] rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.5)] bg-[hsl(var(--settings-v2-card)/0.98)] p-1.5 shadow-[var(--zen-shadow-card)] backdrop-blur-[var(--settings-v2-glass-blur,24px)] [-webkit-backdrop-filter:blur(var(--settings-v2-glass-blur,24px))]"
                    data-testid="settings-v2-appearance-more-menu"
                  >
                    <button
                      ref={appearanceResetButtonRef}
                      type="button"
                      onClick={onReset}
                      data-testid="settings-v2-style-reset"
                      className="flex min-h-[48px] w-full min-w-0 items-center gap-2 whitespace-normal break-words rounded-[6px] px-3 text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-focus,var(--settings-v2-accent)))] motion-safe:transition-[transform,background-color] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-panel)/0.72)] motion-safe:active:translate-y-[1px]"
                    >
                      <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">
                        {tx.themeResetAction || "Reset appearance"}
                      </span>
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </div>

        <div
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(8rem*var(--font-scale,1))),1fr))] gap-2"
          role="group"
          aria-label={tx.themeModeTitle || tx.themeLabel || "Color mode"}
          data-testid="settings-v2-theme-segmented-control"
        >
          {themeOptions.map((option) => (
            <SettingsChoiceButton
              key={option.value}
              icon={option.icon}
              selected={theme === option.value}
              onClick={() => onThemeChange(option.value)}
              presentation="stacked"
              selectedTone="solid"
              surface="secondary"
              testId={`settings-v2-theme-choice-${option.value}`}
              className="min-h-[64px] rounded-[8px]"
            >
              <span className="min-w-0 break-words text-sm [hyphens:manual] [overflow-wrap:break-word]">
                {option.label}
              </span>
            </SettingsChoiceButton>
          ))}
        </div>
      </section>

      <section className="pt-4" data-testid="settings-v2-text-size-field">
        <SettingsFieldHeader
          icon={Type}
          title={tx.fontScaleTitle || "Text size"}
          description={tx.fontScalePreviewSub || "Adjust text size across ZenFlow."}
        />
        <div className="mb-1 flex min-w-0 items-center justify-between gap-2 px-1">
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            A
          </span>
          <span className="min-w-0 break-words text-center text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
            {currentFontLabel}
          </span>
          <span className="text-xl text-muted-foreground" aria-hidden="true">
            A
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={FONT_SCALE_LEVELS.length - 1}
          step={1}
          value={currentFontIndex}
          onChange={(event) => onFontScaleChange(FONT_SCALE_LEVELS[Number(event.target.value)])}
          className="settings-v2-range-control h-12 w-full cursor-pointer appearance-none"
          aria-label={tx.fontScaleTitle || "Text size"}
          aria-valuetext={currentFontLabel}
        />
      </section>
    </>
  );
}
