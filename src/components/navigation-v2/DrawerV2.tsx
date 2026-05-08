import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { createFocusTrap } from "@/lib/a11y";
import { getNavVisualRole, getRoleTone } from "@/lib/nonOrbVisualRoles";
import { V2_NAV_ICONS } from "@/lib/v2IconSystem";
import type { NavV2Page } from "@/hooks/useNavigationV2";
import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { ThemeToggleV2 } from "./ThemeToggleV2";
import { ClassicPortalLink } from "./ClassicPortalLink";

interface DrawerV2Props {
  open: boolean;
  activePage: NavV2Page;
  onClose: () => void;
  onPageChange: (page: NavV2Page) => void;
  onOpenCommandPalette?: () => void;
  onOpenThemeSwitcher?: () => void;
  onOpenArchive?: () => void;
  onOpenAccount?: () => void;
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
  onPageChange,
}: DrawerV2Props) {
  const { t, isRTL } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const drawerRef = useRef<HTMLElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shouldRender, setShouldRender] = useState(open);

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      setShouldRender(true);
      return;
    }

    closeTimerRef.current = setTimeout(() => {
      setShouldRender(false);
    }, 220);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [open]);

  // Lock body scroll + autofocus first action when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let cleanupTrap: (() => void) | undefined;
    const focusTimer = setTimeout(() => {
      if (drawerRef.current) {
        cleanupTrap = createFocusTrap(drawerRef.current, {
          initialFocus: firstFocusRef.current,
        });
      }
    }, 120);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(focusTimer);
      cleanupTrap?.();
    };
  }, [open]);

  // Escape to close (complements Android hardware back)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!shouldRender) return null;
  if (typeof document === "undefined") return null;

  const destinations: Array<{
    id: NavV2Page;
    icon: LucideIcon;
    label: string;
  }> = [
    { id: "orb", icon: V2_NAV_ICONS.orb, label: tx.navV2Orb || "Mood" },
    { id: "habits", icon: V2_NAV_ICONS.habits, label: tx.navV2Habits || tx.habits || "Habits" },
    { id: "diary", icon: V2_NAV_ICONS.diary, label: tx.navV2Diary || tx.diary || "Diary" },
  ];
  const settingsLabel = tx.navV2Settings;
  const isSettingsActive = activePage === "settings";
  const SettingsIcon = V2_NAV_ICONS.settings;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[59] bg-[hsl(var(--nav-v2-backdrop)/0.38)] backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]",
          "motion-safe:transition-opacity motion-safe:duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
        data-testid="drawer-v2-backdrop"
      />

      {/* Drawer body */}
      <aside
        id="nav-v2-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={tx.navV2Menu || "Menu"}
        data-testid="drawer-v2"
        className={cn(
          "fixed inset-y-0 start-0 z-[60] flex w-[min(88vw,24rem)] flex-col",
          "border-e border-[hsl(var(--nav-v2-drawer-border)/0.42)]",
          "bg-gradient-to-b from-[hsl(var(--nav-v2-drawer-start)/0.96)] via-[hsl(var(--nav-v2-drawer-mid)/0.96)] to-[hsl(var(--nav-v2-drawer-end)/0.97)]",
          "text-[hsl(var(--nav-v2-drawer-text))]",
          "backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]",
          "overflow-hidden shadow-[0_28px_90px_-54px_hsl(var(--nav-v2-shadow)/0.55)]",
          "motion-safe:transition-[transform,opacity] motion-safe:duration-300 motion-safe:ease-out",
          "will-change-transform",
          open
            ? "translate-x-0 opacity-100"
            : isRTL
              ? "translate-x-full opacity-0"
              : "-translate-x-full opacity-0"
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[hsl(var(--nav-v2-drawer-divider)/0.48)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
          <div className="flex min-w-0 items-center gap-3">
            <MiniValenceOrb
              valence={0}
              hasEntry={false}
              size="sm"
              chrome="badge"
              containerClassName="shadow-[0_0_22px_hsl(var(--primary)/0.14)]"
            />
            <span className="truncate font-display text-xl font-semibold">
              {tx.navV2Menu || "Menu"}
            </span>
          </div>
          <button
            type="button"
            ref={firstFocusRef}
            onClick={() => {
              void haptics.tabChanged();
              onClose();
            }}
            aria-label={tx.navV2CloseMenu || "Close menu"}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--nav-v2-drawer-border)/0.28)] bg-[hsl(var(--nav-v2-item-surface)/0.66)] text-[hsl(var(--nav-v2-drawer-muted))] shadow-sm transition-colors duration-200 hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <nav
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
          aria-label={tx.navV2PrimaryNav || tx.mainNavigation || "Primary navigation"}
          data-testid="drawer-v2-primary-nav"
        >
          <div className="space-y-2" data-testid="drawer-v2-navigation-deck">
            {destinations.map((item, index) => {
              const isActive = activePage === item.id;
              const visualRole = getNavVisualRole(item.id);
              const tone = getRoleTone(visualRole);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  data-active={isActive ? "true" : "false"}
                  data-visual-role={visualRole}
                  onClick={() => {
                    void haptics.tabChanged();
                    onPageChange(item.id);
                  }}
                  className={cn(
                    "group relative flex min-h-[64px] w-full items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3",
                    "font-display text-sm text-start shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "motion-safe:animate-fade-in",
                    "motion-safe:transition-[transform,background-color,border-color,box-shadow,color,opacity] motion-safe:duration-300 motion-safe:ease-out",
                    "active:scale-[0.992]",
                    isActive
                      ? tone.activeSurfaceClass + " text-[hsl(var(--nav-v2-drawer-text))]"
                      : "border-[hsl(var(--nav-v2-drawer-border)/0.20)] bg-[hsl(var(--nav-v2-item-surface)/0.52)] text-[hsl(var(--nav-v2-drawer-muted))] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))] active:bg-[hsl(var(--nav-v2-item-hover))] " + tone.borderClass
                  )}
                  style={{
                    animationDelay: `${index * 45}ms`,
                  }}
                  data-testid={`drawer-v2-destination-${item.id}`}
                >
                  {isActive && (
                    <>
                      <span
                        aria-hidden="true"
                        className={"pointer-events-none absolute inset-0 bg-gradient-to-r " + tone.gradientClass}
                      />
                      <span
                        aria-hidden="true"
                        className={"absolute inset-y-3 start-0 w-1 rounded-e-full " + tone.railClass}
                      />
                    </>
                  )}
                  <span
                    className={cn(
                      "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1",
                      "motion-safe:transition-colors motion-safe:duration-200",
                      isActive
                        ? tone.iconClass + " " + tone.ringClass
                        : "bg-[hsl(var(--nav-v2-icon-surface)/0.76)] text-[hsl(var(--nav-v2-icon-muted))] ring-[hsl(var(--nav-v2-drawer-border)/0.22)] group-hover:text-[hsl(var(--nav-v2-drawer-text))]"
                    )}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="relative flex-1 truncate">{item.label}</span>
                  <ChevronRight
                    className={cn(
                      "relative h-4 w-4 shrink-0 opacity-35",
                      isActive && "opacity-65"
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-3" data-testid="drawer-v2-classic-portal-zone">
            <ClassicPortalLink
              onBeforeNavigate={onClose}
              phoneLayout
              testId="drawer-v2-classic-portal"
              variant="drawer"
            />
          </div>
        </nav>

        <nav
          className="border-t border-[hsl(var(--nav-v2-drawer-divider)/0.42)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3"
          aria-label={settingsLabel}
          data-testid="drawer-v2-bottom-nav"
        >
          <div
            className="mb-2 rounded-2xl border border-[hsl(var(--nav-v2-drawer-border)/0.20)] bg-[hsl(var(--nav-v2-item-surface)/0.52)] shadow-sm"
            data-testid="drawer-v2-theme-switcher"
          >
            <ThemeToggleV2
              testId="drawer-v2-theme-toggle"
              className="w-full justify-between rounded-2xl px-3.5 py-3 text-[hsl(var(--nav-v2-drawer-muted))] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))] focus-visible:ring-primary focus-visible:ring-offset-[hsl(var(--nav-v2-drawer-end))]"
              labelClassName="font-display text-sm"
            />
          </div>
          <button
            type="button"
            aria-current={isSettingsActive ? "page" : undefined}
            data-active={isSettingsActive ? "true" : "false"}
            data-visual-role="settings"
            onClick={() => {
              void haptics.tabChanged();
              onPageChange("settings");
            }}
            className={cn(
              "group flex min-h-[58px] w-full items-center gap-3 rounded-2xl border px-3.5 py-3",
              "font-display text-sm text-start shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-300 motion-safe:ease-out",
              "active:scale-[0.992]",
              isSettingsActive
                ? getRoleTone("settings").activeSurfaceClass + " text-[hsl(var(--nav-v2-drawer-text))]"
                : "border-[hsl(var(--nav-v2-drawer-border)/0.20)] bg-[hsl(var(--nav-v2-item-surface)/0.52)] text-[hsl(var(--nav-v2-drawer-muted))] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))] active:bg-[hsl(var(--nav-v2-item-hover))] " + getRoleTone("settings").borderClass
            )}
            data-testid="drawer-v2-destination-settings"
          >
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1",
                isSettingsActive
                  ? getRoleTone("settings").iconClass + " " + getRoleTone("settings").ringClass
                  : "bg-[hsl(var(--nav-v2-icon-surface)/0.76)] text-[hsl(var(--nav-v2-icon-muted))] ring-[hsl(var(--nav-v2-drawer-border)/0.22)] group-hover:text-[hsl(var(--nav-v2-drawer-text))]"
              )}
            >
              <SettingsIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1 truncate">{settingsLabel}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
          </button>
        </nav>
      </aside>
    </>
  );

  return createPortal(content, document.body);
});
