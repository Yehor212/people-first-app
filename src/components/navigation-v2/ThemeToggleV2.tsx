import { useCallback, useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeStore } from "@/stores/themeStore";
import { haptics } from "@/lib/haptics";

/**
 * ThemeToggleV2 — Sidebar-embedded theme switcher for Nav-V2.
 *
 * Visual: compact 52×36 tactile switch (Sun ↔ Moon) wired through the V2
 * paper/ink theme store.
 *
 * Theme changes commit immediately. This avoids root-level compositor
 * artifacts on glass surfaces and keeps the control consistent across Web,
 * PWA, WebView, and browsers without View Transitions support.
 *
 * Accessibility: Law 9 — 44×44 tap surface (via padding), aria-label,
 * keyboard activation (Enter/Space). Haptic feedback on native.
 */

const DRAWER_THEME_SWAP_ATTR = "data-theme-swap-mode";
const DRAWER_THEME_SWAP_VALUE = "drawer-instant";
const DRAWER_THEME_SWAP_RESET_MS = 140;

function isInsideModalDialog(target: HTMLElement): boolean {
  return Boolean(target.closest('[role="dialog"][aria-modal="true"]'));
}

function swapDrawerThemeInstantly(
  nextTheme: "paper" | "ink",
  commitTheme: (theme: "paper" | "ink") => boolean,
) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    commitTheme(nextTheme);
    return;
  }

  const root = document.documentElement;
  root.setAttribute(DRAWER_THEME_SWAP_ATTR, DRAWER_THEME_SWAP_VALUE);
  if (!commitTheme(nextTheme)) {
    root.removeAttribute(DRAWER_THEME_SWAP_ATTR);
    return;
  }
  window.setTimeout(() => {
    if (root.getAttribute(DRAWER_THEME_SWAP_ATTR) === DRAWER_THEME_SWAP_VALUE) {
      root.removeAttribute(DRAWER_THEME_SWAP_ATTR);
    }
  }, DRAWER_THEME_SWAP_RESET_MS);
}

interface ThemeToggleV2Props {
  collapsed?: boolean;
  presentation?: "sidebar" | "drawer" | "settings-card";
  testId?: string;
}

const THEME_TOGGLE_PRESENTATION_CLASSES: Record<
  NonNullable<ThemeToggleV2Props["presentation"]>,
  { button: string; label: string }
> = {
  sidebar: {
    button: "",
    label: "text-xs",
  },
  drawer: {
    button:
      "w-full justify-between rounded-[8px] px-3.5 py-3 text-[hsl(var(--nav-v2-drawer-muted))] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))] focus-visible:ring-primary focus-visible:ring-offset-[hsl(var(--nav-v2-drawer-end))]",
    label: "font-display text-sm",
  },
  "settings-card": {
    button:
      "rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.5)] bg-[hsl(var(--settings-v2-panel)/0.72)] px-2 shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.42)]",
    label: "text-xs",
  },
};

export function ThemeToggleV2({
  collapsed = false,
  presentation = "sidebar",
  testId = "sidebar-v2-theme-toggle",
}: ThemeToggleV2Props) {
  const { t } = useLanguage();
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  // Prevent hydration mismatch — only render interactive state after mount.
  const [mounted, setMounted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = appliedTheme === "ink" || appliedTheme === "oled";
  const feedbackId = `${testId}-feedback`;

  const commitTheme = useCallback(
    (nextTheme: "paper" | "ink") => {
      const result = setTheme(nextTheme);
      if (!result.ok) {
        setSaveError(
          t.settingsPreferenceSaveError ||
            "Could not save this change. Your previous setting is still active.",
        );
        return false;
      }
      setSaveError(null);
      return true;
    },
    [setTheme, t.settingsPreferenceSaveError],
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const nextTheme = isDark ? "paper" : "ink";
      void haptics.tabChanged();

      if (isInsideModalDialog(e.currentTarget)) {
        swapDrawerThemeInstantly(nextTheme, commitTheme);
        return;
      }
      commitTheme(nextTheme);
    },
    [commitTheme, isDark],
  );

  const ariaLabel = t.themeDark || "Dark mode";
  const presentationClasses = THEME_TOGGLE_PRESENTATION_CLASSES[presentation];

  // SSR / pre-hydration placeholder — static, zero hydration risk.
  if (!mounted) {
    return (
      <div
        className={cn(
          "flex items-center rounded-lg px-3 py-2 min-h-[44px]",
          collapsed && "justify-center px-2",
          presentationClasses.button,
        )}
        aria-hidden="true"
      >
        <div className="relative flex-shrink-0 w-[52px] h-[36px] rounded-[8px] bg-muted" />
      </div>
    );
  }

  return (
    <div className={cn("relative", presentation === "drawer" && "w-full")}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={ariaLabel}
        aria-pressed={isDark}
        aria-describedby={saveError ? feedbackId : undefined}
        data-testid={testId}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 min-h-[44px]",
          "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--nav-v2-item-hover)/0.72)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200",
          "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none",
          collapsed && "justify-center px-2",
          presentationClasses.button,
        )}
      >
      <span
        data-testid={`${testId}-track`}
        className={cn(
          "relative flex-shrink-0 rounded-[8px] border shadow-[inset_0_0_0_1px_hsl(var(--settings-v2-shadow)/0.08)] motion-safe:transition-[background-color,border-color,box-shadow] motion-safe:duration-300",
          "w-[52px] h-[36px]",
          isDark
            ? "border-[hsl(var(--nav-v2-drawer-border)/0.36)] bg-[hsl(var(--nav-v2-item-surface)/0.76)]"
            : "border-[hsl(var(--settings-v2-border)/0.48)] bg-[hsl(var(--settings-v2-shell)/0.74)]",
        )}
        aria-hidden="true"
      >
        <span
          data-testid={`${testId}-thumb`}
          className={cn(
            "absolute top-[5px] h-[26px] w-[22px] rounded-[6px] motion-safe:transition-[transform,background-color,color,box-shadow] motion-safe:duration-300 flex items-center justify-center shadow-[0_8px_16px_-12px_hsl(var(--settings-v2-shadow)/0.68)] ring-1",
            isDark
              ? "ltr:translate-x-[20px] rtl:-translate-x-[20px] bg-[hsl(var(--settings-v2-accent)/0.18)] text-[hsl(var(--settings-v2-accent))] ring-[hsl(var(--settings-v2-accent)/0.34)]"
              : "translate-x-0 bg-[hsl(var(--settings-v2-panel)/0.94)] text-[hsl(var(--settings-v2-accent))] ring-[hsl(var(--settings-v2-border)/0.42)]",
          )}
          style={{ insetInlineStart: "5px" }}
        >
          {isDark ? (
            <Moon className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Sun className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </span>
      </span>

        {!collapsed && (
          <span className={presentationClasses.label}>
            {isDark ? t.themeDark || "Dark" : t.themeLight || "Light"}
          </span>
        )}
      </button>
      {saveError ? (
        <span
          id={feedbackId}
          role="alert"
          className="absolute end-0 top-[calc(100%+0.25rem)] z-[70] w-56 rounded-[8px] border border-destructive/30 bg-background px-3 py-2 text-xs leading-relaxed text-destructive shadow-[var(--zen-shadow-card)]"
        >
          {saveError}
        </span>
      ) : null}
    </div>
  );
}
