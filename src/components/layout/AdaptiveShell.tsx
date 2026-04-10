import { useEffect, type ReactNode } from "react";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface AdaptiveShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Root layout wrapper with tier-aware navigation context.
 * Exposes showSidebar state via data attribute so Navigation.tsx
 * can decide which mode to render.
 */
export function AdaptiveShell({ children, className }: AdaptiveShellProps) {
  const { tier, isDesktopClass: isDesktop } = useDeviceTier();
  const isTabletLandscape = useMediaQuery(
    "(min-width: 768px) and (max-width: 1023px) and (orientation: landscape)"
  );

  const showSidebar = isDesktop || isTabletLandscape;

  useEffect(() => {
    document.documentElement.dataset.deviceTier = tier;
    document.documentElement.style.setProperty("--device-tier", tier);
  }, [tier]);

  return (
    <div
      data-device-tier={tier}
      data-show-sidebar={showSidebar}
      className={cn(
        "adaptive-shell",
        isDesktop && "desktop-class",
        showSidebar && "has-sidebar",
        className
      )}
    >
      {children}
    </div>
  );
}
