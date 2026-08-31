import { useCallback, useEffect, useRef, useState } from "react";
import { Move, Palette, Undo2, X } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { trySetReduceMotion } from "@/lib/motionPreference";
import { useFontScale } from "@/hooks/useFontScale";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useActiveAriaModal } from "@/hooks/useActiveAriaModal";
import { useThemeStore, type ThemePreference, type ThemeWriteResult } from "@/stores/themeStore";
import { DEFAULT_THEME_CUSTOMIZATION } from "@/stores/themeCustomization";

import { AppearanceAccent } from "./V2SettingsAppearanceAccent";
import { AppearanceBasics } from "./V2SettingsAppearanceBasics";
import { PanelFrame, ToggleRow } from "./components/V2SettingsControlPrimitives";

type AppearanceFeedback = {
  kind: "success" | "error";
  message: string;
  canUndo: boolean;
};

export function AppearancePanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const theme = useThemeStore((state) => state.theme);
  const appliedTheme = useThemeStore((state) => state.appliedTheme);
  const themeCustomization = useThemeStore((state) => state.themeCustomization);
  const setTheme = useThemeStore((state) => state.setTheme);
  const setThemeCustomization = useThemeStore((state) => state.setThemeCustomization);
  const resetThemeCustomization = useThemeStore((state) => state.resetThemeCustomization);
  const undoThemeCustomization = useThemeStore((state) => state.undoThemeCustomization);
  const { scale, setFontScale } = useFontScale();
  const motionPreference = useMotionPreference();
  const osPrefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const hasActiveModal = useActiveAriaModal();
  const [feedback, setFeedback] = useState<AppearanceFeedback | null>(null);
  const [appearanceMenuOpen, setAppearanceMenuOpen] = useState(false);
  const appearanceMoreButtonRef = useRef<HTMLButtonElement | null>(null);
  const appearanceResetButtonRef = useRef<HTMLButtonElement | null>(null);

  const closeAppearanceMenu = useCallback(() => {
    setAppearanceMenuOpen(false);
    window.requestAnimationFrame(() => {
      appearanceMoreButtonRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useBackHandler(appearanceMenuOpen, closeAppearanceMenu);

  const saveError =
    tx.settingsPreferenceSaveError ||
    "Could not save this change. Your previous setting is still active.";
  const savedMessage = tx.themeChangeSaved || "Changed";
  const canResetAppearance =
    themeCustomization.accentFamily !== DEFAULT_THEME_CUSTOMIZATION.accentFamily ||
    themeCustomization.highContrast !== DEFAULT_THEME_CUSTOMIZATION.highContrast;

  useEffect(() => {
    if (!canResetAppearance) setAppearanceMenuOpen(false);
  }, [canResetAppearance]);

  useEffect(() => {
    if (!appearanceMenuOpen) return;
    appearanceResetButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeAppearanceMenu();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (appearanceMoreButtonRef.current?.contains(target)) return;
      if (document.getElementById("settings-v2-appearance-more-menu")?.contains(target)) return;
      setAppearanceMenuOpen(false);
    };
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (appearanceMoreButtonRef.current?.contains(target)) return;
      if (document.getElementById("settings-v2-appearance-more-menu")?.contains(target)) return;
      setAppearanceMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [appearanceMenuOpen, closeAppearanceMenu]);

  const reportWrite = (result: ThemeWriteResult, canUndo: boolean): boolean => {
    if (!result.ok) {
      setFeedback({ kind: "error", message: saveError, canUndo: false });
      return false;
    }
    if (!result.changed) {
      setFeedback(null);
      return true;
    }
    setFeedback(canUndo ? { kind: "success", message: savedMessage, canUndo: true } : null);
    return true;
  };

  const updateTheme = (nextTheme: ThemePreference) => {
    setFeedback(null);
    reportWrite(setTheme(nextTheme), false);
  };

  const updateCustomization = (patch: Partial<typeof themeCustomization>) => {
    setFeedback(null);
    reportWrite(setThemeCustomization({ ...themeCustomization, ...patch }), true);
  };

  const updateTextScale = (nextScale: typeof scale) => {
    setFeedback(null);
    if (!setFontScale(nextScale)) {
      setFeedback({ kind: "error", message: saveError, canUndo: false });
    }
  };

  const updateReducedMotion = (reduceMotion: boolean) => {
    setFeedback(null);
    const result = trySetReduceMotion(reduceMotion);
    if (!result.ok) {
      setFeedback({ kind: "error", message: saveError, canUndo: false });
    }
  };

  const handleReset = () => {
    if (!canResetAppearance) return;
    setFeedback(null);
    setAppearanceMenuOpen(false);
    reportWrite(resetThemeCustomization(), true);
    window.requestAnimationFrame(() => {
      appearanceMoreButtonRef.current?.focus({ preventScroll: true });
    });
  };

  const handleUndo = () => {
    setFeedback(null);
    const result = undoThemeCustomization();
    if (!result.ok) {
      setFeedback({ kind: "error", message: saveError, canUndo: false });
      return;
    }
    if (!result.changed) return;
    setFeedback({
      kind: "success",
      message: tx.themeUndone || "Previous appearance restored",
      canUndo: false,
    });
  };

  return (
    <PanelFrame
      icon={Palette}
      title={tx.appearance || "Appearance"}
      description={
        tx.themeStyleDescription || "Choose a mode, accent color, and readable text size."
      }
      testId="settings-v2-panel-appearance"
      variant="studio"
    >
      <div
        className="w-full min-w-0 max-w-full space-y-4"
        data-slot="settings-appearance-customization"
        data-testid="settings-v2-style-customization"
      >
        <AppearanceBasics
          tx={tx}
          theme={theme}
          scale={scale}
          appearanceMenuOpen={appearanceMenuOpen}
          canResetAppearance={canResetAppearance}
          appearanceMoreButtonRef={appearanceMoreButtonRef}
          appearanceResetButtonRef={appearanceResetButtonRef}
          onToggleAppearanceMenu={() => setAppearanceMenuOpen((open) => !open)}
          onReset={handleReset}
          onThemeChange={updateTheme}
          onFontScaleChange={updateTextScale}
        />
        <AppearanceAccent
          tx={tx}
          appliedTheme={appliedTheme}
          customization={themeCustomization}
          feedback={
            feedback && !hasActiveModal ? (
              <div
                className="relative flex w-full min-w-0 justify-center"
                data-layout="inline"
                data-slot="settings-appearance-feedback-rail"
                data-testid="settings-v2-appearance-feedback-rail"
              >
                <div
                  role={feedback.kind === "error" ? "alert" : "status"}
                  className={
                    feedback.kind === "error"
                      ? "grid min-h-[48px] w-full min-w-0 grid-cols-[minmax(0,1fr)_48px] items-center gap-[8px] rounded-[8px] border border-destructive/50 bg-[hsl(var(--settings-v2-card)/0.98)] px-[12px] py-2 text-sm text-destructive shadow-[var(--zen-shadow-card)] min-[520px]:grid-cols-[minmax(0,1fr)_auto_48px]"
                      : "grid min-h-[48px] w-full min-w-0 grid-cols-[minmax(0,1fr)_48px] items-center gap-[8px] rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.64)] bg-[hsl(var(--settings-v2-card)/0.98)] px-[12px] py-2 text-sm text-foreground shadow-[var(--zen-shadow-card)] min-[520px]:grid-cols-[minmax(0,1fr)_auto_48px]"
                  }
                  data-slot="settings-appearance-feedback"
                  data-testid="settings-v2-appearance-feedback"
                >
                  <span
                    className="col-start-1 row-start-1 min-w-0 break-words [hyphens:manual] [overflow-wrap:break-word]"
                    data-slot="settings-appearance-feedback-message"
                  >
                    {feedback.message}
                  </span>
                  {feedback.canUndo ? (
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="col-span-2 row-start-2 inline-flex min-h-[48px] min-w-0 w-full max-w-full flex-row items-center justify-center gap-[6px] whitespace-normal rounded-[6px] px-3 py-[8px] font-semibold text-[hsl(var(--settings-v2-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-focus,var(--settings-v2-accent)))] min-[520px]:col-span-1 min-[520px]:col-start-2 min-[520px]:row-start-1 min-[520px]:w-auto"
                      data-slot="settings-appearance-feedback-undo"
                    >
                      <Undo2
                        className="h-[20px] w-[20px] shrink-0"
                        aria-hidden="true"
                        data-slot="settings-appearance-feedback-undo-icon"
                      />
                      <span className="min-w-0 max-w-full break-words text-center [hyphens:manual] [overflow-wrap:break-word]">
                        {tx.themeUndoAction || "Undo"}
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setFeedback(null)}
                    aria-label={tx.dismiss || "Dismiss"}
                    className="col-start-2 row-start-1 inline-flex h-[48px] min-h-[48px] w-[48px] min-w-[48px] items-center justify-center justify-self-end rounded-[6px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-focus,var(--settings-v2-accent)))] min-[520px]:col-start-3"
                    data-slot="settings-appearance-feedback-dismiss"
                  >
                    <X
                      className="h-[20px] w-[20px]"
                      aria-hidden="true"
                      data-slot="settings-appearance-feedback-dismiss-icon"
                    />
                  </button>
                </div>
              </div>
            ) : null
          }
          onChange={updateCustomization}
        />
        <ToggleRow
          icon={Move}
          title={tx.settingsReduceMotion || "Reduce motion"}
          description={
            osPrefersReducedMotion
              ? tx.settingsReduceMotionSystemDescription ||
                "Your device is currently reducing motion."
              : tx.settingsReduceMotionDescription || "Limits transitions and decorative movement."
          }
          checked={osPrefersReducedMotion || motionPreference.reduceMotion}
          onCheckedChange={updateReducedMotion}
          disabled={osPrefersReducedMotion}
          testId="settings-v2-motion-toggle"
        />
      </div>
    </PanelFrame>
  );
}
