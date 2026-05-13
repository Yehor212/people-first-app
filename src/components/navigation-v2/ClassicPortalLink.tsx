import { memo, useState, type MouseEvent } from "react";
import { ArrowLeftToLine, Sparkles } from "lucide-react";
import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { CLASSIC_BASE_URL, IS_DEV } from "@/lib/env";

interface ClassicPortalHrefOptions {
  baseUrl?: string;
  devPreview?: boolean;
  phoneLayout?: boolean;
}

interface ClassicPortalLinkProps {
  className?: string;
  collapsed?: boolean;
  onBeforeNavigate?: () => void;
  phoneLayout?: boolean;
  testId?: string;
  variant?: "drawer" | "sidebar";
}

export function buildClassicPortalHref(
  options: ClassicPortalHrefOptions = {},
): string {
  const {
    baseUrl = CLASSIC_BASE_URL,
    devPreview = IS_DEV,
    phoneLayout = false,
  } = options;
  const base = baseUrl.replace(/\/$/, "");
  const params = new URLSearchParams();
  if (phoneLayout) {
    params.set("navLayout", "phone");
  }
  if (devPreview) {
    params.set("dev", "true");
  }
  const query = params.toString();
  return `${base}/${query ? `?${query}` : ""}`;
}

export const ClassicPortalLink = memo(function ClassicPortalLink({
  className,
  collapsed = false,
  onBeforeNavigate,
  phoneLayout = false,
  testId = "classic-portal-link",
  variant = "drawer",
}: ClassicPortalLinkProps) {
  const { t } = useLanguage();
  const animate = useShouldAnimate();
  const tx = t as unknown as Record<string, string>;
  const [launching, setLaunching] = useState(false);
  const href = buildClassicPortalHref({ phoneLayout });
  const isSidebar = variant === "sidebar";
  const portalTitle = isSidebar
    ? tx.classicPortalCta || tx.classicPortalTitle || "Classic ZenFlow"
    : tx.classicPortalTitle || "Back to classic ZenFlow";
  const visiblePortalTitle = isSidebar ? `V1 ${tx.home || "Home"}` : portalTitle;

  const handleNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (launching) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    void haptics.tabChanged();
    setLaunching(true);
    onBeforeNavigate?.();
    window.setTimeout(() => {
      window.location.assign(href);
    }, animate ? 140 : 0);
  };

  return (
    <a
      href={href}
      onClick={handleNavigate}
      aria-label={tx.classicPortalAria || "Return to classic ZenFlow"}
      title={collapsed ? tx.classicPortalCta || "Classic ZenFlow" : undefined}
      data-launching={launching ? "true" : "false"}
      data-testid={testId}
      className={cn(
        "group relative isolate flex w-full cursor-pointer overflow-hidden border text-start touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "motion-safe:transition-[transform,background-color,border-color,box-shadow,opacity] motion-safe:duration-300 motion-safe:ease-out",
        "active:scale-[0.992]",
        collapsed
          ? "min-h-[48px] items-center justify-center rounded-xl px-2 py-2"
          : isSidebar
            ? "min-h-[88px] items-center gap-2.5 rounded-[22px] px-3 py-3"
            : "min-h-[92px] items-center gap-3 rounded-[22px] px-3.5 py-3.5",
        "border-[hsl(var(--zf-role-focus)/0.34)] bg-[radial-gradient(circle_at_15%_16%,hsl(var(--zf-role-body)/0.30),transparent_34%),radial-gradient(circle_at_92%_76%,hsl(var(--zf-role-focus)/0.22),transparent_36%),linear-gradient(135deg,hsl(var(--nav-v2-item-surface)/0.86),hsl(var(--zf-role-focus)/0.16))]",
        "text-[hsl(var(--nav-v2-drawer-text))] shadow-[0_20px_48px_-36px_hsl(var(--zf-role-focus)/0.72),inset_0_1px_0_hsl(var(--foreground)/0.10)]",
        "hover:border-[hsl(var(--zf-role-body)/0.50)] hover:bg-[hsl(var(--zf-role-focus)/0.16)] hover:shadow-[0_22px_54px_-34px_hsl(var(--zf-role-body)/0.56),inset_0_1px_0_hsl(var(--foreground)/0.12)]",
        launching && "opacity-85",
        isSidebar && "text-foreground",
        className,
      )}
    >
      <span
        className="pointer-events-none absolute inset-0 -z-[1] bg-[linear-gradient(112deg,transparent_0_18%,hsl(var(--zf-role-focus)/0.13)_18%_18.5%,transparent_18.5%_58%,hsl(var(--zf-role-body)/0.10)_58%_58.5%,transparent_58.5%_100%)]"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,hsl(var(--zf-role-focus)/0),hsl(var(--zf-role-body)/0.72),hsl(var(--zf-role-focus)/0.50),hsl(var(--zf-role-focus)/0))]"
        aria-hidden="true"
      />
      {!collapsed && (
        <span
          className="pointer-events-none absolute end-11 top-1/2 h-px w-16 -translate-y-1/2 bg-[linear-gradient(90deg,hsl(var(--zf-role-focus)/0),hsl(var(--zf-role-body)/0.62),hsl(var(--zf-role-focus)/0))]"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center",
          "h-12 w-12",
        )}
        data-testid={`${testId}-orb`}
        aria-hidden="true"
      >
        <MiniValenceOrb
          valence={0}
          hasEntry={false}
          size="sm"
          chrome="badge"
          containerClassName="shadow-[0_0_24px_hsl(var(--primary)/0.14)]"
        />
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--zf-role-body))]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{tx.classicPortalEyebrow || "Stable home"}</span>
              <span className="ms-auto rounded-full border border-[hsl(var(--zf-role-body)/0.32)] bg-[hsl(var(--zf-role-body)/0.10)] px-1.5 py-0.5 text-[9px] leading-none text-[hsl(var(--zf-role-body))]">
                V1
              </span>
            </span>
            <span
              className={cn(
                "mt-1 block truncate font-display font-semibold",
                isSidebar ? "text-[13px] leading-tight" : "text-[15px]",
              )}
            >
              {visiblePortalTitle}
            </span>
            <span
              className={cn(
                "mt-0.5 block text-xs leading-snug text-[hsl(var(--nav-v2-drawer-muted))]",
                isSidebar ? "hidden" : "line-clamp-2",
              )}
            >
              {tx.classicPortalBody || "Return to the current stable home while V2 stays in preview."}
            </span>
          </span>
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--zf-role-focus)/0.26)] bg-[hsl(var(--nav-v2-item-surface)/0.62)] text-[hsl(var(--nav-v2-drawer-muted))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
            <ArrowLeftToLine
              className="h-4 w-4 opacity-75 motion-safe:transition-transform group-hover:-translate-x-0.5 rtl:scale-x-[-1]"
              aria-hidden="true"
            />
          </span>
        </>
      )}
    </a>
  );
});
