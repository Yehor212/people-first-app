import { useEffect, useRef, useState } from "react";
import { Eye, Palette, Save, Sparkles, Undo2 } from "lucide-react";

import { updateDopamineSettings } from "@/lib/dopamineSettings";
import { useDopamineSettings } from "@/hooks/useDopamineSettings";
import { setThemePreference } from "@/components/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFontScale } from "@/hooks/useFontScale";
import { storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { DEFAULT_THEME_CUSTOMIZATION, type ThemeCustomization } from "@/stores/themeCustomization";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";

import { AppearanceAdvanced } from "./V2SettingsAppearanceAdvanced";
import { AppearanceBasics } from "./V2SettingsAppearanceBasics";
import {
  PanelFrame,
  SettingsInset,
  SettingsStatus,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";

function syncLegacyThemePreference(theme: ThemePreference) {
  const oledEnabled = theme === "oled";
  storageSetRaw(SK.OLED_MODE, String(oledEnabled));
  document.documentElement.classList.toggle("oled", oledEnabled);

  if (theme === "paper") {
    setThemePreference("light");
  } else if (theme === "auto") {
    setThemePreference("system");
  } else {
    setThemePreference("dark");
  }
}

function themeCustomizationsEqual(first: ThemeCustomization, second: ThemeCustomization): boolean {
  return (
    first.paletteId === second.paletteId &&
    first.accentFamily === second.accentFamily &&
    first.intensity === second.intensity &&
    first.warmth === second.warmth &&
    first.depth === second.depth &&
    first.contrastMode === second.contrastMode &&
    first.reduceGlow === second.reduceGlow &&
    first.reduceTransparency === second.reduceTransparency
  );
}

export function AppearancePanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const theme = useThemeStore((s) => s.theme);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const themeCustomization = useThemeStore((s) => s.themeCustomization);
  const previousThemeCustomization = useThemeStore((s) => s.previousThemeCustomization);
  const setThemeCustomization = useThemeStore((s) => s.setThemeCustomization);
  const previewThemeCustomization = useThemeStore((s) => s.previewThemeCustomization);
  const cancelThemeCustomizationPreview = useThemeStore((s) => s.cancelThemeCustomizationPreview);
  const resetThemeCustomization = useThemeStore((s) => s.resetThemeCustomization);
  const undoThemeCustomization = useThemeStore((s) => s.undoThemeCustomization);
  const { scale, setFontScale } = useFontScale();
  const dopamine = useDopamineSettings();
  const [draft, setDraft] = useState<ThemeCustomization>(themeCustomization);
  const [themeStatus, setThemeStatus] = useState<string | null>(null);
  const [appearanceMenuOpen, setAppearanceMenuOpen] = useState(false);
  const previewActiveRef = useRef(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const appearanceMoreButtonRef = useRef<HTMLButtonElement | null>(null);
  const appearanceResetButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasUnsavedAppearanceChanges = !themeCustomizationsEqual(draft, themeCustomization);
  const canUndoAppearanceChange = previousThemeCustomization !== null;

  useEffect(() => {
    syncLegacyThemePreference(theme);
  }, [appliedTheme, theme]);

  useEffect(() => {
    setDraft(themeCustomization);
  }, [themeCustomization]);

  useEffect(() => {
    return () => {
      if (previewActiveRef.current) {
        cancelThemeCustomizationPreview();
      }
    };
  }, [cancelThemeCustomizationPreview]);

  useEffect(() => {
    if (!themeStatus) return;
    const timer = window.setTimeout(() => setThemeStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [themeStatus]);

  useEffect(() => {
    if (!appearanceMenuOpen) return;
    appearanceResetButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setAppearanceMenuOpen(false);
      window.requestAnimationFrame(() => {
        appearanceMoreButtonRef.current?.focus({ preventScroll: true });
      });
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [appearanceMenuOpen]);

  const updateTheme = (nextTheme: ThemePreference) => setTheme(nextTheme);
  const updateDraft = (patch: Partial<ThemeCustomization>) => {
    if (previewActiveRef.current) {
      cancelThemeCustomizationPreview();
      previewActiveRef.current = false;
      setThemeStatus(tx.themePreviewChanged);
    }
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handlePreview = () => {
    previewThemeCustomization(draft);
    previewActiveRef.current = true;
    setThemeStatus(tx.themePreviewing);
  };

  const handleApply = () => {
    if (!hasUnsavedAppearanceChanges) return;
    setThemeCustomization(draft);
    previewActiveRef.current = false;
    setThemeStatus(tx.themeApplied);
  };

  const handleReset = () => {
    const resetCustomization = { ...DEFAULT_THEME_CUSTOMIZATION };
    setDraft(resetCustomization);
    resetThemeCustomization();
    setAppearanceMenuOpen(false);
    window.requestAnimationFrame(() => {
      appearanceMoreButtonRef.current?.focus({ preventScroll: true });
    });
    previewActiveRef.current = false;
    setThemeStatus(tx.themeReset);
  };

  const handleUndo = () => {
    if (!canUndoAppearanceChange) return;
    undoThemeCustomization();
    previewActiveRef.current = false;
    setThemeStatus(tx.themeUndone);
  };

  const toggleAppearanceMenu = () => setAppearanceMenuOpen((open) => !open);

  return (
    <PanelFrame
      icon={Palette}
      title={tx.appearance || "Appearance"}
      description={tx.themeStyleDescription || tx.navV2Theme || tx.theme || "Theme"}
      testId="settings-v2-panel-appearance"
      variant="studio"
      showHeader={false}
    >
      <div className="p-0" data-testid="settings-v2-appearance-glass-card">
        <SettingsInset
          testId="settings-v2-style-customization"
          className="!space-y-0 !border-0 !bg-transparent !p-0 md:!p-0"
        >
          <AppearanceBasics
            tx={tx}
            theme={theme}
            scale={scale}
            appearanceMenuOpen={appearanceMenuOpen}
            appearanceMoreButtonRef={appearanceMoreButtonRef}
            appearanceResetButtonRef={appearanceResetButtonRef}
            onToggleAppearanceMenu={toggleAppearanceMenu}
            onReset={handleReset}
            onThemeChange={updateTheme}
            onFontScaleChange={setFontScale}
          />
          <AppearanceAdvanced tx={tx} draft={draft} onDraftChange={updateDraft} />

          <ToggleRow
            icon={Sparkles}
            title={t.dopamineAnimations}
            description={t.dopamineAnimationsDesc}
            checked={dopamine.animations}
            onCheckedChange={(checked) => updateDopamineSettings({ animations: checked })}
            testId="settings-v2-motion-toggle"
          />

          <div
            id="settings-v2-appearance-actions"
            ref={actionsRef}
            className="border-t border-[hsl(var(--settings-v2-border)/0.24)] pt-3"
            data-testid="settings-v2-appearance-actions"
          >
            <div className="grid grid-cols-[minmax(0,0.86fr)_minmax(0,0.92fr)_minmax(0,1.28fr)] gap-1.5 rounded-[22px] border border-[hsl(var(--settings-v2-border)/0.16)] bg-[hsl(var(--settings-v2-shell)/0.22)] p-1.5 shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.12)]">
              <button
                type="button"
                aria-label={tx.themeUndoAction}
                title={tx.themeUndoAction}
                onClick={handleUndo}
                disabled={!canUndoAppearanceChange}
                data-testid="settings-v2-style-undo"
                className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-transparent bg-transparent px-1.5 text-foreground/76 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-safe:transition-[transform,background-color,color,border-color,opacity] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-panel)/0.26)] motion-safe:active:translate-y-[1px]"
              >
                <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 text-pretty text-[0.68rem] font-semibold leading-tight [overflow-wrap:break-word] min-[390px]:text-[0.72rem]">
                  {tx.themeUndoAction}
                </span>
              </button>
              <button
                type="button"
                aria-label={tx.themePreviewAction}
                title={tx.themePreviewAction}
                onClick={handlePreview}
                disabled={!hasUnsavedAppearanceChanges}
                data-button-tone="secondary"
                data-testid="settings-v2-style-preview"
                className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-transparent bg-transparent px-1.5 text-foreground/76 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-safe:transition-[transform,background-color,color,border-color,opacity] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-panel)/0.26)] motion-safe:active:translate-y-[1px]"
              >
                <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 text-pretty text-[0.68rem] font-semibold leading-tight [overflow-wrap:break-word] min-[390px]:text-[0.72rem]">
                  {tx.themePreviewAction}
                </span>
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!hasUnsavedAppearanceChanges}
                data-button-tone="primary"
                data-testid="settings-v2-style-apply"
                className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-[hsl(var(--settings-v2-accent)/0.34)] bg-[hsl(var(--settings-v2-accent)/0.18)] px-2 text-[hsl(var(--settings-v2-accent))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.2),0_12px_28px_-21px_hsl(var(--settings-v2-accent)/0.52)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[hsl(var(--settings-v2-panel)/0.24)] disabled:text-foreground/44 disabled:shadow-none motion-safe:transition-[transform,background-color,border-color,box-shadow,color,opacity] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-accent)/0.22)] motion-safe:active:translate-y-[1px]"
              >
                <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 text-pretty text-[0.68rem] font-semibold leading-tight [overflow-wrap:break-word] min-[390px]:text-[0.72rem]">
                  {tx.themeApplyAction}
                </span>
              </button>
            </div>
            <div>
              <SettingsStatus>{themeStatus}</SettingsStatus>
            </div>
          </div>
        </SettingsInset>
      </div>
    </PanelFrame>
  );
}
