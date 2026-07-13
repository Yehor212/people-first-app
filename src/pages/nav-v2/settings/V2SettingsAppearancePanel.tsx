import { useEffect, useRef, useState } from "react";
import { Move, Palette, Undo2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { trySetReduceMotion } from "@/lib/motionPreference";
import { useFontScale } from "@/hooks/useFontScale";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useThemeStore, type ThemePreference, type ThemeWriteResult } from "@/stores/themeStore";

import { AppearanceAccent } from "./V2SettingsAppearanceAccent";
import { AppearanceBasics } from "./V2SettingsAppearanceBasics";
import {
  PanelFrame,
  SettingsInset,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";

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
  const [feedback, setFeedback] = useState<AppearanceFeedback | null>(null);
  const [appearanceMenuOpen, setAppearanceMenuOpen] = useState(false);
  const appearanceMoreButtonRef = useRef<HTMLButtonElement | null>(null);
  const appearanceResetButtonRef = useRef<HTMLButtonElement | null>(null);

  const saveError =
    tx.settingsPreferenceSaveError ||
    "Could not save this change. Your previous setting is still active.";
  const savedMessage = tx.themeChangeSaved || "Changed";

  useEffect(() => {
    if (feedback?.kind !== "success") return;
    const timer = window.setTimeout(() => setFeedback(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!appearanceMenuOpen) return;
    appearanceResetButtonRef.current?.focus({ preventScroll: true });

    const closeMenuAndRestoreFocus = () => {
      setAppearanceMenuOpen(false);
      window.requestAnimationFrame(() => {
        appearanceMoreButtonRef.current?.focus({ preventScroll: true });
      });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenuAndRestoreFocus();
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
  }, [appearanceMenuOpen]);

  const reportWrite = (result: ThemeWriteResult, canUndo: boolean): boolean => {
    if (!result.ok) {
      setFeedback({ kind: "error", message: saveError, canUndo: false });
      return false;
    }
    setFeedback({ kind: "success", message: savedMessage, canUndo });
    return true;
  };

  const updateTheme = (nextTheme: ThemePreference) => {
    setFeedback(null);
    reportWrite(setTheme(nextTheme), false);
  };

  const updateCustomization = (
    patch: Partial<typeof themeCustomization>,
  ) => {
    setFeedback(null);
    reportWrite(setThemeCustomization({ ...themeCustomization, ...patch }), true);
  };

  const updateTextScale = (nextScale: typeof scale) => {
    setFeedback(null);
    if (setFontScale(nextScale)) {
      setFeedback({ kind: "success", message: savedMessage, canUndo: false });
    } else {
      setFeedback({ kind: "error", message: saveError, canUndo: false });
    }
  };

  const updateReducedMotion = (reduceMotion: boolean) => {
    setFeedback(null);
    const result = trySetReduceMotion(reduceMotion);
    setFeedback(
      result.ok
        ? { kind: "success", message: savedMessage, canUndo: false }
        : { kind: "error", message: saveError, canUndo: false },
    );
  };

  const handleReset = () => {
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
      <SettingsInset testId="settings-v2-style-customization" className="space-y-4">
        <AppearanceBasics
          tx={tx}
          theme={theme}
          scale={scale}
          appearanceMenuOpen={appearanceMenuOpen}
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
          onChange={updateCustomization}
        />
        <ToggleRow
          icon={Move}
          title={tx.settingsReduceMotion || "Reduce motion"}
          description={
            osPrefersReducedMotion
              ? tx.settingsReduceMotionSystemDescription ||
                "Your device is currently reducing motion."
              : tx.settingsReduceMotionDescription ||
                "Limits transitions and decorative movement."
          }
          checked={osPrefersReducedMotion || motionPreference.reduceMotion}
          onCheckedChange={updateReducedMotion}
          disabled={osPrefersReducedMotion}
          testId="settings-v2-motion-toggle"
        />
      </SettingsInset>

      {feedback ? (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          className={
            feedback.kind === "error"
              ? "flex min-h-11 items-center rounded-[8px] border border-destructive/25 bg-destructive/10 px-3 text-sm text-destructive"
              : "flex min-h-11 items-center justify-between gap-3 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.36)] bg-[hsl(var(--settings-v2-shell)/0.44)] px-3 text-sm text-muted-foreground"
          }
          data-testid="settings-v2-appearance-feedback"
        >
          <span>{feedback.message}</span>
          {feedback.canUndo ? (
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[6px] px-3 font-semibold text-[hsl(var(--settings-v2-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-focus,var(--settings-v2-accent)))]"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              <span>{tx.themeUndoAction || "Undo"}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </PanelFrame>
  );
}
