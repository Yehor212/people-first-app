import { useEffect, type ReactNode } from "react";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { cn } from "@/lib/utils";

interface AdaptiveShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Root layout wrapper that provides device-tier-aware context.
 * Phase 1: minimal wrapper with CSS class switching.
 * Phase 2: will add sidebar vs bottom-tab navigation switching.
 */
export function AdaptiveShell({ children, className }: AdaptiveShellProps) {
  const { tier, isDesktopClass: isDesktop } = useDeviceTier();

  useEffect(() => {
    document.documentElement.dataset.deviceTier = tier;
    document.documentElement.style.setProperty("--device-tier", tier);
  }, [tier]);

  return (
    <div
      data-device-tier={tier}
      className={cn("adaptive-shell", isDesktop && "desktop-class", className)}
    >
      {children}
    </div>
  );
}
