import type { NavV2Page } from "@/hooks/useNavigationV2";

export function NavV2RouteFallback({ label }: { label: string }) {
  return (
    <main
      id="main-content-v2"
      data-testid="nav-v2-route-fallback"
      role="status"
      aria-live="polite"
      aria-label={label}
      className="flex min-h-[var(--app-viewport-height)] items-center justify-center px-4 py-10"
    >
      <div className="inline-flex min-h-[44px] max-w-full items-start gap-3 rounded-2xl border border-border/50 bg-card/70 px-4 py-3 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full bg-primary motion-safe:animate-pulse"
        />
        <span className="min-w-0 whitespace-normal break-words">{label}</span>
      </div>
    </main>
  );
}

export function getNavV2RouteLabel(page: NavV2Page, tx: Record<string, string>): string {
  if (page === "habits") return tx.navV2Habits || tx.habits || "Habits";
  if (page === "diary") return tx.navV2Diary || tx.diary || "Diary";
  if (page === "planning") return tx.navV2Planning;
  if (page === "settings") return tx.navV2Settings || tx.settings;
  return tx.navV2Orb || tx.somLogFeeling || "Mood";
}

export function NavV2RoutePending({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="nav-v2-route-pending"
      className="pointer-events-none fixed start-[max(0.75rem,var(--safe-inline-start))] end-[max(0.75rem,var(--safe-inline-end))] top-[calc(var(--safe-top)+0.35rem)] z-[61] mx-auto w-fit max-w-[calc(100vw-1.5rem-var(--safe-inline-start)-var(--safe-inline-end))] rounded-2xl border border-border/55 bg-card/85 px-3 py-1.5 text-xs font-semibold leading-tight text-foreground shadow-[0_10px_28px_hsl(var(--foreground)/0.14)] backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] motion-safe:animate-fade-in"
    >
      <span className="inline-flex min-h-[44px] min-w-0 items-start gap-1.5">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse"
        />
        <span className="min-w-0 whitespace-normal break-words">{label}</span>
      </span>
    </div>
  );
}
