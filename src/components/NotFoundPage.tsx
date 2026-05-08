import { ArrowLeft, Compass, Home } from "lucide-react";

import { RecoveryOrbit } from "@/components/RecoveryOrbit";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface NotFoundPageProps {
  requestedPath?: string;
  canGoBack?: boolean;
  onGoBack?: () => void;
  onGoHome: () => void;
}

export function NotFoundPage({
  requestedPath,
  canGoBack = false,
  onGoBack,
  onGoHome,
}: NotFoundPageProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string | undefined>;
  const cleanPath = requestedPath && requestedPath !== "/" ? requestedPath : "";

  return (
    <main
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_18%_16%,hsl(var(--zf-role-focus)/0.18),transparent_34%),radial-gradient(circle_at_82%_8%,hsl(var(--zf-role-mind)/0.16),transparent_30%),linear-gradient(150deg,hsl(var(--zf-night-0)),hsl(var(--zf-night-1)))] px-4 py-[calc(env(safe-area-inset-top)+2rem)] text-[hsl(var(--zf-text-strong))]"
      data-testid="not-found-page"
      data-surface="v2-not-found"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[13%] h-52 w-52 -translate-x-1/2 rounded-full bg-[hsl(var(--zf-role-body)/0.12)] blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-80 w-80 rounded-full bg-[hsl(var(--zf-role-focus)/0.12)] blur-3xl" />
      </div>

      <section className="relative w-full max-w-md overflow-hidden rounded-[34px] border border-[hsl(var(--foreground)/0.12)] bg-[linear-gradient(145deg,hsl(var(--zf-surface-1)/0.94),hsl(var(--zf-night-0)/0.96))] px-6 py-7 text-center shadow-[0_34px_100px_-70px_hsl(var(--zf-role-focus)/0.82)] before:pointer-events-none before:absolute before:inset-x-10 before:top-0 before:h-[3px] before:rounded-b-full before:bg-[linear-gradient(90deg,hsl(var(--zf-role-body)),hsl(var(--zf-role-focus)),hsl(var(--zf-role-mind)))]">
        <div className="mx-auto flex justify-center">
          <RecoveryOrbit label="ZenFlow not found" />
        </div>

        <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[hsl(var(--zf-role-focus))]">
          {tx.notFoundKicker ?? "Route not found"}
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-[hsl(var(--zf-text-strong))]">
          {tx.pageNotFound ?? tx.notFoundMessage ?? "Page not found"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[hsl(var(--zf-text-soft))]">
          {tx.notFoundBody ??
            "This link is outdated or this screen no longer exists. Your data is still here."}
        </p>

        {cleanPath && (
          <div className="mx-auto mt-5 flex max-w-sm items-center gap-3 rounded-3xl border border-[hsl(var(--foreground)/0.10)] bg-[linear-gradient(135deg,hsl(var(--zf-surface-2)/0.76),hsl(var(--zf-night-1)/0.56))] p-3 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[hsl(var(--zf-role-focus)/0.28)] bg-[hsl(var(--zf-role-focus)/0.12)] text-[hsl(var(--zf-role-focus))]">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--zf-text-muted))]">
                {tx.notFoundRequestedPath ?? "Requested path"}
              </span>
              <span className="mt-1 block truncate text-sm font-semibold text-[hsl(var(--zf-text-strong))]">
                {cleanPath}
              </span>
            </span>
          </div>
        )}

        <div className={cn("mt-6 grid gap-3", canGoBack && onGoBack ? "grid-cols-2" : "grid-cols-1")}>
          {canGoBack && onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--foreground)/0.12)] bg-[hsl(var(--zf-surface-2)/0.62)] px-4 py-3 text-sm font-semibold text-[hsl(var(--zf-text-strong))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] hover:bg-[hsl(var(--zf-surface-3)/0.74)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-focus))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--zf-night-0))] active:scale-[0.98] motion-safe:transition-[transform,background-color,border-color]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {tx.notFoundBack ?? tx.back ?? "Back"}
            </button>
          )}
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,hsl(var(--zf-role-body)),hsl(var(--zf-role-focus)))] px-4 py-3 text-sm font-semibold text-[hsl(var(--zf-night-0))] shadow-[0_18px_42px_-28px_hsl(var(--zf-role-focus)/0.90)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-focus))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--zf-night-0))] active:scale-[0.98] motion-safe:transition-[transform,opacity]"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            {tx.goHome ?? tx.returnToHome ?? "Go Home"}
          </button>
        </div>

        <p className="mx-auto mt-5 max-w-xs text-xs leading-relaxed text-[hsl(var(--zf-text-muted))]">
          {tx.notFoundHint ?? "Use Home to return to your ZenFlow space."}
        </p>
      </section>
    </main>
  );
}
