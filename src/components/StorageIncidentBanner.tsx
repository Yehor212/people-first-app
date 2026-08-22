import { AlertTriangle, X } from "lucide-react";

interface StorageIncidentBannerProps {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  closeLabel: string;
  onDismiss: () => void;
  placement?: "entry-flow" | "viewport";
  announcementRole?: "alert" | "status";
}

export function StorageIncidentBanner({
  title,
  message,
  retryLabel,
  onRetry,
  isRetrying = false,
  closeLabel,
  onDismiss,
  placement = "viewport",
  announcementRole = "alert",
}: StorageIncidentBannerProps) {
  const containerClassName =
    placement === "entry-flow"
      ? "relative z-50 min-w-0 max-w-full"
      : "fixed bottom-[calc(5rem+var(--safe-bottom))] start-[max(0.5rem,var(--safe-inline-start))] end-[max(0.5rem,var(--safe-inline-end))] z-50 max-h-[calc(var(--app-viewport-height)-6rem-var(--safe-bottom))] overflow-y-auto overscroll-contain motion-safe:animate-slide-up min-[420px]:start-[max(1rem,var(--safe-inline-start))] min-[420px]:end-[max(1rem,var(--safe-inline-end))]";

  return (
    <div
      data-testid="storage-error-banner"
      className={containerClassName}
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl bg-[hsl(var(--zf-warning))] p-2 text-[hsl(var(--zf-night-0))] shadow-lg backdrop-blur-sm min-[420px]:p-4">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div
          className="w-full min-w-0"
          role={announcementRole}
          aria-live={announcementRole === "status" ? "polite" : undefined}
        >
          <p className="whitespace-normal break-words text-sm font-medium [hyphens:manual] [overflow-wrap:break-word]">
            {title}
          </p>
          <p className="mt-0.5 whitespace-normal break-words text-xs opacity-90 [hyphens:manual] [overflow-wrap:break-word]">
            {message}
          </p>
        </div>
        <div className="col-span-2 grid min-w-0 max-w-full grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          {retryLabel && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              aria-busy={isRetrying ? "true" : undefined}
              className="inline-flex h-auto min-h-11 w-full min-w-0 max-w-full items-center justify-center whitespace-normal break-words rounded-lg px-3 py-2 text-center text-sm font-semibold underline-offset-4 [hyphens:manual] [overflow-wrap:break-word] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current disabled:cursor-wait disabled:opacity-70"
            >
              {retryLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            aria-label={closeLabel}
            className="flex min-h-12 min-w-12 flex-shrink-0 items-center justify-center justify-self-end rounded-lg p-2 hover:bg-foreground/20 motion-safe:transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
