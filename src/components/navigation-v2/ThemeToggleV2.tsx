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
 * Visual: 52×36 pill-switch (Sun ↔ Moon, sky-300 / slate-700) matching V1
 * ThemeToggle.tsx aesthetic, but wired through the V2 paper/ink theme store.
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
      "w-full justify-between rounded-2xl px-3.5 py-3 text-[hsl(var(--nav-v2-drawer-muted))] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))] focus-visible:ring-primary focus-visible:ring-offset-[hsl(var(--nav-v2-drawer-end))]",
    label: "font-display text-sm",
  },
  "settings-card": {
    button:
      "rounded-full border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card)/0.72)] px-2",
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

  const ariaLabel = isDark
    ? t.switchToLight || "Switch to light mode"
    : t.switchToDark || "Switch to dark mode";
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
        <div className="relative flex-shrink-0 w-[52px] h-[36px] rounded-full bg-muted" />
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
        "motion-safe:transition-colors motion-safe:duration-200",
        collapsed && "justify-center px-2",
        presentationClasses.button,
      )}
    >
      <span
        data-testid={`${testId}-track`}
        className={cn(
          "relative flex-shrink-0 rounded-full motion-safe:transition-all motion-safe:duration-300",
          "w-[52px] h-[36px]",
          isDark
            ? "bg-[hsl(var(--theme-toggle-v1-dark-track))]"
            : "bg-[hsl(var(--theme-toggle-v1-light-track))]",
        )}
        aria-hidden="true"
      >
        <span
          data-testid={`${testId}-thumb`}
          className={cn(
            "absolute top-[7px] w-[22px] h-[22px] rounded-full motion-safe:transition-all motion-safe:duration-300 flex items-center justify-center shadow-sm",
            isDark
              ? "left-[27px] bg-[hsl(var(--theme-toggle-v1-dark-thumb))] ring-1 ring-[hsl(var(--theme-toggle-v1-dark-ring)/0.30)]"
              : "left-[3px] bg-[hsl(var(--theme-toggle-v1-light-thumb))]",
          )}
        >
          {isDark ? (
            <Moon className="w-3.5 h-3.5 text-[hsl(var(--theme-toggle-v1-dark-ring))] dark:text-[hsl(var(--zf-text-soft))]" aria-hidden="true" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-[hsl(var(--theme-toggle-v1-light-icon))]" aria-hidden="true" />
          )}
        </span>

        {isDark && (
          <>
            <span className="absolute top-[6px] left-[6px] w-1 h-1 bg-foreground/60 rounded-full" />
            <span className="absolute top-[14px] left-[12px] w-0.5 h-0.5 bg-foreground/40 rounded-full" />
          </>
        )}
      </span>

      {!collapsed && (
        <span className={presentationClasses.label}>
          {isDark ? t.themeLight || "Light" : t.themeDark || "Dark"}
        </span>
      )}
    </button>
  );
}
