import { ChevronRight, LoaderCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getNavVisualRole, getRoleTone } from "@/lib/nonOrbVisualRoles";
import { V2_NAV_ICONS } from "@/lib/v2IconSystem";
import type { NavV2Page } from "@/hooks/useNavigationV2";

interface DrawerV2DestinationsProps {
  translations: Record<string, string>;
  isRTL: boolean;
  activePage: NavV2Page;
  navigatingPage: NavV2Page | null;
  beginNavigationFeedback: (page: NavV2Page, isActive: boolean) => void;
  clearNavigatingPage: () => void;
  onPageChange: (page: NavV2Page) => void;
  onPagePreload?: (page: NavV2Page) => void;
}

export function DrawerV2Destinations({
  translations: tx,
  isRTL,
  activePage,
  navigatingPage,
  beginNavigationFeedback,
  clearNavigatingPage,
  onPageChange,
  onPagePreload,
}: DrawerV2DestinationsProps) {
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
  const loadingLabel = tx.loading || "loading";

  return (
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
  );
}
