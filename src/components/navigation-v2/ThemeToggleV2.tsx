import { useCallback, useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeStore } from "@/stores/themeStore";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";

/**
 * ThemeToggleV2 — Sidebar-embedded theme switcher for Nav-V2.
 *
 * Visual: compact 52×36 tactile switch (Sun ↔ Moon) wired through the V2
 * paper/ink theme store.
 *
 * Animation: 2026-standard circle-reveal via View Transitions API — the new
 * theme grows from the click origin as a clip-path circle until it covers
 * the viewport. Gracefully falls back to instant swap on browsers without
 * the API and when `prefers-reduced-motion: reduce` is set.
 *
 * Accessibility: Law 9 — 44×44 tap surface (via padding), aria-label,
 * keyboard activation (Enter/Space). Haptic feedback on native.
 */

const TRANSITION_DURATION_MS = 500;
const DRAWER_THEME_SWAP_ATTR = "data-theme-swap-mode";
const DRAWER_THEME_SWAP_VALUE = "drawer-instant";
const DRAWER_THEME_SWAP_RESET_MS = 140;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function supportsViewTransition(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function"
  );
}

function isInsideModalDialog(target: HTMLElement): boolean {
  return Boolean(target.closest('[role="dialog"][aria-modal="true"]'));
}

function swapDrawerThemeInstantly(nextTheme: "paper" | "ink", setTheme: (theme: "paper" | "ink") => void) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    setTheme(nextTheme);
    return;
  }

  const root = document.documentElement;
  root.setAttribute(DRAWER_THEME_SWAP_ATTR, DRAWER_THEME_SWAP_VALUE);
  setTheme(nextTheme);
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
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = appliedTheme === "ink" || appliedTheme === "oled";

  const handleToggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const nextTheme = isDark ? "paper" : "ink";
      void haptics.tabChanged();

      // Compute click origin for circle-reveal (fallback to element center).
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX || rect.left + rect.width / 2;
      const y = e.clientY || rect.top + rect.height / 2;

      if (isInsideModalDialog(e.currentTarget)) {
        swapDrawerThemeInstantly(nextTheme, setTheme);
        return;
      }

      if (!supportsViewTransition() || prefersReducedMotion()) {
        setTheme(nextTheme);
        return;
      }

      // Mark document root so CSS can scope the circle-reveal animation.
      document.documentElement.setAttribute("data-theme-swap", "active");

      try {
        const vt = document.startViewTransition!(() => {
          flushSync(() => setTheme(nextTheme));
        });

        vt.ready
          .then(() => {
            const endRadius = Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y),
            );
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration: TRANSITION_DURATION_MS,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                pseudoElement: "::view-transition-new(root)",
              },
            );
          })
          .catch((err) => {
            logger.warn("[ThemeToggleV2]", "view-transition failed", err);
          });

        void vt.finished.finally(() => {
          document.documentElement.removeAttribute("data-theme-swap");
        });
      } catch (err) {
        logger.warn("[ThemeToggleV2]", "startViewTransition threw", err);
        document.documentElement.removeAttribute("data-theme-swap");
        setTheme(nextTheme);
      }
    },
    [isDark, setTheme],
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
    <button
      type="button"
      onClick={handleToggle}
      aria-label={ariaLabel}
      aria-pressed={isDark}
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
            "absolute top-[5px] h-[26px] w-[22px] rounded-[6px] motion-safe:transition-[left,background-color,color,box-shadow] motion-safe:duration-300 flex items-center justify-center shadow-[0_8px_16px_-12px_hsl(var(--settings-v2-shadow)/0.68)] ring-1",
            isDark
              ? "left-[25px] bg-[hsl(var(--settings-v2-accent)/0.18)] text-[hsl(var(--settings-v2-accent))] ring-[hsl(var(--settings-v2-accent)/0.34)]"
              : "left-[5px] bg-[hsl(var(--settings-v2-panel)/0.94)] text-[hsl(var(--settings-v2-accent))] ring-[hsl(var(--settings-v2-border)/0.42)]",
          )}
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
  );
}
