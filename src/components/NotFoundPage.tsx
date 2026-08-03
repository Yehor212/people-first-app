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
      className="v2-fullscreen-page relative flex min-h-[var(--app-viewport-height)] items-start justify-center overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_18%_16%,hsl(var(--zf-role-focus)/0.18),transparent_34%),radial-gradient(circle_at_82%_8%,hsl(var(--zf-role-mind)/0.16),transparent_30%),linear-gradient(150deg,hsl(var(--zf-night-0)),hsl(var(--zf-night-1)))] px-2 pb-[calc(var(--safe-bottom)+1rem)] pt-[calc(var(--safe-top)+1rem)] text-[hsl(var(--zf-text-strong))] sm:px-4 sm:pb-[calc(var(--safe-bottom)+2rem)] sm:pt-[calc(var(--safe-top)+2rem)]"
      data-testid="not-found-page"
      data-surface="v2-not-found"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[13%] h-52 w-52 -translate-x-1/2 rounded-full bg-[hsl(var(--zf-role-body)/0.12)] blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-80 w-80 rounded-full bg-[hsl(var(--zf-role-focus)/0.12)] blur-3xl" />
      </div>

      <section className="relative my-auto w-full max-w-md overflow-hidden rounded-[34px] border border-[hsl(var(--foreground)/0.12)] bg-[linear-gradient(145deg,hsl(var(--zf-surface-1)/0.94),hsl(var(--zf-night-0)/0.96))] px-4 py-6 text-center shadow-[0_34px_100px_-70px_hsl(var(--zf-role-focus)/0.82)] before:pointer-events-none before:absolute before:inset-x-10 before:top-0 before:h-[3px] before:rounded-b-full before:bg-[linear-gradient(90deg,hsl(var(--zf-role-body)),hsl(var(--zf-role-focus)),hsl(var(--zf-role-mind)))] sm:px-6 sm:py-7">
        <div className="mx-auto flex justify-center">
          <RecoveryOrbit label={tx.pageNotFound ?? tx.notFoundKicker ?? "Page not found"} />
        </div>

        <p className="mt-1 break-words text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--zf-role-focus-foreground))] [hyphens:manual] [overflow-wrap:break-word] sm:tracking-[0.22em]">
          {tx.notFoundKicker ?? "Route not found"}
        </p>
        <h1 className="mt-4 break-words font-display text-3xl font-bold leading-tight text-[hsl(var(--zf-text-strong))] [hyphens:manual] [overflow-wrap:break-word]">
          {tx.pageNotFound ?? tx.notFoundMessage ?? "Page not found"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm break-words text-sm leading-relaxed text-[hsl(var(--zf-text-soft))] [hyphens:manual] [overflow-wrap:break-word]">
          {tx.notFoundBody ??
            "This link is outdated or this screen no longer exists. Your data is still here."}
        </p>

        {cleanPath && (
          <div className="mx-auto mt-5 flex max-w-sm items-center gap-3 rounded-3xl border border-[hsl(var(--foreground)/0.10)] bg-[linear-gradient(135deg,hsl(var(--zf-surface-2)/0.76),hsl(var(--zf-night-1)/0.56))] p-3 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[hsl(var(--zf-role-focus)/0.28)] bg-[hsl(var(--zf-role-focus)/0.12)] text-[hsl(var(--zf-role-focus-foreground))]">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block break-words text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--zf-text-muted))] [hyphens:manual] [overflow-wrap:break-word] sm:tracking-[0.14em]">
                {tx.notFoundRequestedPath ?? "Requested path"}
              </span>
              <bdi
                dir="auto"
                className="mt-1 block whitespace-normal break-words text-sm font-semibold text-[hsl(var(--zf-text-strong))] [overflow-wrap:anywhere]"
              >
                {cleanPath}
              </bdi>
            </span>
          </div>
        )}

        <div
          className={cn(
            "mt-6 grid gap-3",
            canGoBack && onGoBack ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          )}
        >
          {canGoBack && onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="inline-flex h-auto min-h-[48px] min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-2xl border border-[hsl(var(--foreground)/0.12)] bg-[hsl(var(--zf-surface-2)/0.62)] px-3 py-3 text-sm font-semibold text-[hsl(var(--zf-text-strong))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] [hyphens:manual] [overflow-wrap:break-word] hover:bg-[hsl(var(--zf-surface-3)/0.74)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-focus))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--zf-night-0))] active:scale-[0.98] motion-safe:transition-[transform,background-color,border-color]"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              {tx.notFoundBack ?? tx.back ?? "Back"}
            </button>
          )}
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex h-auto min-h-[48px] min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-2xl bg-[linear-gradient(135deg,hsl(var(--zf-role-body)),hsl(var(--zf-role-focus)))] px-3 py-3 text-sm font-semibold text-[hsl(var(--zf-night-0))] shadow-[0_18px_42px_-28px_hsl(var(--zf-role-focus)/0.90)] [hyphens:manual] [overflow-wrap:break-word] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-focus))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--zf-night-0))] active:scale-[0.98] motion-safe:transition-[transform,opacity]"
          >
            <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
            {tx.goHome ?? tx.returnToHome ?? "Go Home"}
          </button>
        </div>

        <p className="mx-auto mt-5 max-w-xs break-words text-xs leading-relaxed text-[hsl(var(--zf-text-muted))] [hyphens:manual] [overflow-wrap:break-word]">
          {tx.notFoundHint ?? "Use Home to return to your ZenFlow space."}
        </p>
      </section>
    </main>
  );
}
