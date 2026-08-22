import { memo } from "react";
import { ChevronRight, History } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface V2ConnectedHistoryActionProps {
  presentation: "sidebar" | "drawer";
  collapsed?: boolean;
  beforeOpen?: () => void;
  onOpen: (returnFocusTarget: HTMLElement | null) => void;
}

export const V2ConnectedHistoryAction = memo(function V2ConnectedHistoryAction({
  presentation,
  collapsed = false,
  beforeOpen,
  onOpen,
}: V2ConnectedHistoryActionProps) {
  const { t, isRTL } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const label = tx.connectedRecordsHistory || "View history and undo";
  const isDrawer = presentation === "drawer";

  return (
    <button
      type="button"
      aria-label={label}
      title={!isDrawer && collapsed ? label : undefined}
      data-nav-button={`${presentation}-action`}
      data-testid={`${presentation}-v2-connected-history`}
      onClick={(event) => {
        const trigger = event.currentTarget;
        beforeOpen?.();
        onOpen(isDrawer ? null : trigger);
      }}
      className={cn(
        "group flex min-h-12 items-center gap-3 rounded-[8px] text-sm text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out",
        "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] hover:text-foreground",
        isDrawer
          ? "mb-2 w-full border border-[hsl(var(--nav-v2-drawer-border)/0.20)] bg-[hsl(var(--nav-v2-item-surface)/0.52)] px-3.5 py-2.5 text-start shadow-[0_8px_18px_-16px_hsl(var(--nav-v2-shadow)/0.38)] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] focus-visible:ring-offset-background"
          : "px-3 py-2 hover:bg-[hsl(var(--nav-v2-item-hover)/0.72)]",
        !isDrawer && collapsed && "justify-center px-2",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[8px] ring-1",
          isDrawer
            ? "h-11 w-11 bg-[hsl(var(--nav-v2-icon-surface)/0.76)] text-[hsl(var(--nav-v2-icon-muted))] ring-[hsl(var(--nav-v2-drawer-border)/0.22)] group-hover:text-[hsl(var(--nav-v2-drawer-text))]"
            : "h-9 w-9 bg-muted/45 ring-border/40",
        )}
        aria-hidden="true"
      >
        <History className="h-5 w-5" />
      </span>
      {(isDrawer || !collapsed) && (
        <span className="min-w-0 flex-1 whitespace-normal break-words text-start leading-snug [hyphens:auto] [overflow-wrap:break-word]">
          {label}
        </span>
      )}
      {isDrawer ? (
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 opacity-40", isRTL && "rotate-180")}
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
});
