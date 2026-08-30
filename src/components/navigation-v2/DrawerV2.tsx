import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, LoaderCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { createFocusTrap } from "@/lib/a11y";
import { getNavVisualRole, getRoleTone } from "@/lib/nonOrbVisualRoles";
import { V2_NAV_ICONS } from "@/lib/v2IconSystem";
import type { NavV2Page } from "@/hooks/useNavigationV2";
import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { ThemeToggleV2 } from "./ThemeToggleV2";

interface DrawerV2Props {
  open: boolean;
  activePage: NavV2Page;
  onClose: () => void;
  onExitComplete?: () => void;
  onPageChange: (page: NavV2Page) => void;
  onPagePreload?: (page: NavV2Page) => void;
  onOpenCommandPalette?: () => void;
  onOpenThemeSwitcher?: () => void;
  onOpenArchive?: () => void;
  onOpenAccount?: () => void;
}

// This is a watchdog, not the visual duration. Android WebView can deliver the
// compositor transitionend after a busy main-thread turn; racing the 300ms CSS
// transition with a 350ms unmount timer cut off the retained exit surface.
const DRAWER_EXIT_FALLBACK_MS = 1000;
const DRAWER_ENTER_FALLBACK_MS = 350;

function isDrawerMotionReduced(): boolean {
  if (typeof window === "undefined") return true;
  return (
    document.body.classList.contains("reduce-motion") ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * DrawerV2 — mobile sidebar-as-drawer navigation.
 *
 * Triggered from the phone menu button. It keeps daily destinations near the
 * top and anchors Settings at the bottom, so the panel reads as navigation
 * instead of a mixed action list.
 *
 * - Compact command drawer, glass surface, backdrop blur
 * - Calm open / close via CSS transitions (verb-aligned timings)
 * - Android back closes drawer first (handled by parent via handleBackButton)
 * - Renders via createPortal to escape transform ancestors (see modal-standard.md)
 */
export const DrawerV2 = memo(function DrawerV2({
  open,
  activePage,
  onClose,
  onExitComplete,
  onPageChange,
  onPagePreload,
}: DrawerV2Props) {
  const { t, isRTL } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const drawerRef = useRef<HTMLElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTrapCleanupRef = useRef<(() => void) | null>(null);
  const [shouldRender, setShouldRender] = useState(open);
  const renderedDrawerRef = useRef(shouldRender);
  const [navigatingPage, setNavigatingPage] = useState<NavV2Page | null>(null);

  const activateFocusTrap = useCallback(() => {
    if (focusTrapCleanupRef.current || !drawerRef.current) return;
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    focusTrapCleanupRef.current = createFocusTrap(drawerRef.current, {
      initialFocus: firstFocusRef.current,
    });
  }, []);

  useEffect(() => {
    if (open) {
      setNavigatingPage(null);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setShouldRender(true);
      return;
    }

    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setShouldRender(false);
    }, DRAWER_EXIT_FALLBACK_MS);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  // Retain scroll and focus ownership until the retained exit frame unmounts.
  useEffect(() => {
    if (!shouldRender) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      focusTrapCleanupRef.current?.();
      focusTrapCleanupRef.current = null;
    };
  }, [shouldRender]);

  // Restore trigger ownership only after the retained exit surface is gone.
  // This avoids moving focus through the still-animating backdrop/drawer tree.
  useEffect(() => {
    if (shouldRender) {
      renderedDrawerRef.current = true;
      return;
    }
    if (!renderedDrawerRef.current) return;

    renderedDrawerRef.current = false;
    onExitComplete?.();
  }, [onExitComplete, shouldRender]);

  // transitionend is authoritative. The bounded fallback covers cancelled CSS
  // transitions; reduced motion focuses on the next frame instead of waiting.
  useEffect(() => {
    if (!open || !shouldRender || focusTrapCleanupRef.current) return;

    if (isDrawerMotionReduced()) {
      const frame = window.requestAnimationFrame(activateFocusTrap);
      return () => window.cancelAnimationFrame(frame);
    }

    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      activateFocusTrap();
    }, DRAWER_ENTER_FALLBACK_MS);

    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [activateFocusTrap, open, shouldRender]);

  useEffect(() => {
    if (navigatingPage === activePage) {
      setNavigatingPage(null);
    }
  }, [activePage, navigatingPage]);

  // Escape to close (complements Android hardware back)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open && !shouldRender) return null;
  if (typeof document === "undefined") return null;

  const destinations: Array<{
    id: NavV2Page;
    icon: LucideIcon;
    label: string;
  }> = [
    { id: "orb", icon: V2_NAV_ICONS.orb, label: tx.navV2Orb || "Mood" },
    { id: "habits", icon: V2_NAV_ICONS.habits, label: tx.navV2Habits || tx.habits || "Habits" },
    { id: "diary", icon: V2_NAV_ICONS.diary, label: tx.navV2Diary || tx.diary || "Diary" },
    { id: "planning", icon: V2_NAV_ICONS.planning, label: tx.navV2Planning },
  ];
  const settingsLabel = tx.navV2Settings;
  const clearNavigatingPage = () => setNavigatingPage(null);
  const beginNavigationFeedback = (page: NavV2Page, isActive: boolean) => {
    if (!isActive) {
      setNavigatingPage(page);
    }
  };
  const loadingLabel = tx.loading || "loading";
  const isSettingsActive = activePage === "settings";
  const isSettingsNavigating = navigatingPage === "settings";
  const isSettingsSelected = isSettingsActive || isSettingsNavigating;
  const SettingsIcon = V2_NAV_ICONS.settings;
  const isEntered = open;
  // React 18's HTML attribute types predate the now-baseline inert attribute.
  // Spreading the native attribute preserves the real browser behavior without
  // teaching every JSX element a project-wide type extension.
  const closedInteractionProps = !open ? ({ inert: "" } as const) : {};

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "drawer-v2-backdrop-partitioned fixed inset-0 z-[59] bg-[hsl(var(--nav-v2-backdrop)/0.38)] backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]",
          "motion-safe:transition-opacity motion-safe:duration-200",
          open ? "pointer-events-auto" : "pointer-events-none",
          isEntered ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
        data-testid="drawer-v2-backdrop"
      />

      {/* Drawer body */}
      <aside
        {...closedInteractionProps}
        id="nav-v2-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-hidden={!open ? "true" : undefined}
        aria-label={tx.navV2Menu || "Menu"}
        data-theme-region="drawer-v2"
        data-testid="drawer-v2"
        onTransitionEnd={(event) => {
          if (event.currentTarget !== event.target) return;
          if (event.propertyName && event.propertyName !== "transform") return;
          if (open) {
            activateFocusTrap();
            return;
          }
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
          setShouldRender(false);
        }}
        className={cn(
          "drawer-v2-panel-partitioned fixed inset-y-0 start-0 z-[60] flex w-[min(88vw,24rem)] flex-col",
          "border-e border-[hsl(var(--nav-v2-drawer-border)/0.42)]",
          "bg-gradient-to-b from-[hsl(var(--nav-v2-drawer-start)/0.96)] via-[hsl(var(--nav-v2-drawer-mid)/0.96)] to-[hsl(var(--nav-v2-drawer-end)/0.97)]",
          "text-[hsl(var(--nav-v2-drawer-text))]",
          "backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]",
          "overflow-hidden shadow-[0_28px_90px_-54px_hsl(var(--nav-v2-shadow)/0.55)]",
          "motion-safe:transition-[transform,opacity] motion-safe:duration-300 motion-safe:ease-out",
          "will-change-transform",
          isEntered
            ? "translate-x-0 opacity-100"
            : isRTL
              ? "translate-x-full opacity-0"
              : "-translate-x-full opacity-0"
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[hsl(var(--nav-v2-drawer-divider)/0.48)] px-4 pb-3 pt-[calc(var(--safe-top)+0.85rem)]">
          <div className="flex min-w-0 items-center gap-3">
            <MiniValenceOrb
              valence={0}
              hasEntry={false}
              size="sm"
              chrome="badge"
              containerClassName="shadow-[0_0_22px_hsl(var(--primary)/0.14)]"
            />
            <span className="min-w-0 whitespace-normal break-words font-display text-xl font-semibold leading-snug [hyphens:manual] [overflow-wrap:break-word]">
              {tx.navV2Menu || "Menu"}
            </span>
          </div>
          <button
            type="button"
            ref={firstFocusRef}
            tabIndex={open ? undefined : -1}
            onClick={() => {
              void haptics.tabChanged();
              onClose();
            }}
            aria-label={tx.navV2CloseMenu || "Close menu"}
            className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-[hsl(var(--nav-v2-drawer-border)/0.36)] bg-[hsl(var(--nav-v2-item-surface)/0.66)] text-[hsl(var(--nav-v2-drawer-muted))] shadow-[0_8px_18px_-16px_hsl(var(--nav-v2-shadow)/0.42)] motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <nav
          role="navigation"
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
          aria-label={tx.navV2PrimaryNav || tx.mainNavigation || "Primary navigation"}
          data-testid="drawer-v2-primary-nav"
        >
          <div className="space-y-2" data-testid="drawer-v2-navigation-deck">
            {destinations.map((item, index) => {
              const isActive = activePage === item.id;
              const isNavigating = navigatingPage === item.id;
              const isSelected = isActive || isNavigating;
              const visualRole = getNavVisualRole(item.id);
              const tone = getRoleTone(visualRole);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  aria-label={isNavigating ? item.label + ", " + loadingLabel : item.label}
                  aria-busy={isNavigating ? "true" : undefined}
                  data-active={isActive ? "true" : "false"}
                  data-navigating={isNavigating ? "true" : "false"}
                  data-nav-button="drawer"
                  data-visual-role={visualRole}
                  onPointerDown={() => {
                    beginNavigationFeedback(item.id, isActive);
                    if (!isActive) onPagePreload?.(item.id);
                  }}
                  onPointerCancel={clearNavigatingPage}
                  onPointerLeave={clearNavigatingPage}
                  onClick={() => {
                    beginNavigationFeedback(item.id, isActive);
                    void haptics.tabChanged();
                    onPageChange(item.id);
                  }}
                  className={cn(
                    "group relative flex min-h-[64px] w-full items-center gap-3 overflow-hidden rounded-[8px] border px-3.5 py-3",
                    "font-display text-sm text-start shadow-[0_8px_18px_-16px_hsl(var(--nav-v2-shadow)/0.38)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "motion-safe:animate-fade-in",
                    "motion-safe:transition-[transform,background-color,border-color,box-shadow,color,opacity] motion-safe:duration-300 motion-safe:ease-out",
                    "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none",
                    isSelected
                      ? tone.activeSurfaceClass + " text-[hsl(var(--nav-v2-drawer-text))]"
                      : "border-[hsl(var(--nav-v2-drawer-border)/0.20)] bg-[hsl(var(--nav-v2-item-surface)/0.52)] text-[hsl(var(--nav-v2-drawer-muted))] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))] active:bg-[hsl(var(--nav-v2-item-hover))] " +
                          tone.borderClass
                  )}
                  style={{
                    animationDelay: `${index * 45}ms`,
                  }}
                  data-testid={`drawer-v2-destination-${item.id}`}
                >
                  {isSelected && (
                    <>
                      <span
                        aria-hidden="true"
                        className={
                          "pointer-events-none absolute inset-0 bg-gradient-to-r " +
                          tone.gradientClass
                        }
                      />
                      <span
                        aria-hidden="true"
                        className={
                          "absolute inset-y-3 start-0 w-1 rounded-e-full " + tone.railClass
                        }
                      />
                    </>
                  )}
                  <span
                    className={cn(
                      "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] ring-1",
                      "motion-safe:transition-[background-color,color,border-color] motion-safe:duration-200",
                      isSelected
                        ? tone.iconClass + " " + tone.ringClass
                        : "bg-[hsl(var(--nav-v2-icon-surface)/0.76)] text-[hsl(var(--nav-v2-icon-muted))] ring-[hsl(var(--nav-v2-drawer-border)/0.22)] group-hover:text-[hsl(var(--nav-v2-drawer-text))]"
                    )}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="relative min-w-0 flex-1 whitespace-normal break-words leading-snug [hyphens:manual] [overflow-wrap:break-word]">
                    {item.label}
                  </span>
                  {isNavigating ? (
                    <LoaderCircle
                      className="relative h-4 w-4 shrink-0 motion-safe:animate-spin opacity-75"
                      aria-hidden="true"
                      data-testid={`drawer-v2-destination-${item.id}-progress`}
                    />
                  ) : (
                    <ChevronRight
                      className={cn(
                        "relative h-4 w-4 shrink-0 opacity-35",
                        isActive && "opacity-65",
                        isRTL && "rotate-180"
                      )}
                      aria-hidden="true"
                      data-testid={"drawer-v2-destination-" + item.id + "-chevron"}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <nav
          role="navigation"
          className="border-t border-[hsl(var(--nav-v2-drawer-divider)/0.42)] px-3 pb-[calc(var(--safe-bottom)+0.75rem)] pt-3"
          aria-label={settingsLabel}
          data-testid="drawer-v2-bottom-nav"
        >
          <div
            className="mb-2 rounded-[8px] border border-[hsl(var(--nav-v2-drawer-border)/0.28)] bg-[hsl(var(--nav-v2-item-surface)/0.52)] shadow-[0_8px_18px_-16px_hsl(var(--nav-v2-shadow)/0.38)]"
            data-testid="drawer-v2-theme-switcher"
          >
            <ThemeToggleV2 testId="drawer-v2-theme-toggle" presentation="drawer" />
          </div>
          <button
            type="button"
            aria-current={isSettingsActive ? "page" : undefined}
            aria-label={isSettingsNavigating ? settingsLabel + ", " + loadingLabel : settingsLabel}
            aria-busy={isSettingsNavigating ? "true" : undefined}
            data-active={isSettingsActive ? "true" : "false"}
            data-navigating={isSettingsNavigating ? "true" : "false"}
            data-nav-button="drawer"
            data-visual-role="settings"
            onPointerDown={() => {
              beginNavigationFeedback("settings", isSettingsActive);
              if (!isSettingsActive) onPagePreload?.("settings");
            }}
            onPointerCancel={clearNavigatingPage}
            onPointerLeave={clearNavigatingPage}
            onClick={() => {
              beginNavigationFeedback("settings", isSettingsActive);
              void haptics.tabChanged();
              onPageChange("settings");
            }}
            className={cn(
              "group flex min-h-[58px] w-full items-center gap-3 rounded-[8px] border px-3.5 py-3",
              "font-display text-sm text-start shadow-[0_8px_18px_-16px_hsl(var(--nav-v2-shadow)/0.38)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-300 motion-safe:ease-out",
              "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none",
              isSettingsSelected
                ? "border-[hsl(var(--settings-v2-accent)/0.74)] bg-[hsl(var(--settings-v2-accent)/0.18)] text-[hsl(var(--nav-v2-drawer-text))] shadow-[0_12px_28px_-20px_hsl(var(--nav-v2-shadow)/0.48)]"
                : "border-[hsl(var(--nav-v2-drawer-border)/0.20)] bg-[hsl(var(--nav-v2-item-surface)/0.52)] text-[hsl(var(--nav-v2-drawer-muted))] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))] active:bg-[hsl(var(--nav-v2-item-hover))] " +
                    getRoleTone("settings").borderClass
            )}
            data-testid="drawer-v2-destination-settings"
          >
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] ring-1",
                isSettingsSelected
                  ? "bg-[hsl(var(--settings-v2-accent)/0.18)] text-[hsl(var(--settings-v2-accent))] ring-[hsl(var(--settings-v2-accent)/0.42)]"
                  : "bg-[hsl(var(--nav-v2-icon-surface)/0.76)] text-[hsl(var(--nav-v2-icon-muted))] ring-[hsl(var(--nav-v2-drawer-border)/0.22)] group-hover:text-[hsl(var(--nav-v2-drawer-text))]"
              )}
            >
              <SettingsIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug [hyphens:manual] [overflow-wrap:break-word]">
              {settingsLabel}
            </span>
            {isSettingsNavigating ? (
              <LoaderCircle
                className="h-4 w-4 shrink-0 motion-safe:animate-spin opacity-75"
                aria-hidden="true"
                data-testid="drawer-v2-destination-settings-progress"
              />
            ) : (
              <ChevronRight
                className={cn("h-4 w-4 shrink-0 opacity-40", isRTL && "rotate-180")}
                aria-hidden="true"
                data-testid="drawer-v2-destination-settings-chevron"
              />
            )}
          </button>
        </nav>
      </aside>
    </>
  );

  return createPortal(content, document.body);
});
