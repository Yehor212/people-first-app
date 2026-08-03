/**
 * UpdateRequiredDialog
 *
 * Shows when a chunk load failure is detected (usually after a new deployment).
 * This happens when cached HTML references old JS chunks that no longer exist.
 * Prompts user to refresh the app to get the latest version.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { RefreshCw, Download } from "lucide-react";
import type { SeverityLevel } from "@sentry/core";

// Lazy-load sentry to keep @sentry/* (~250 KB) off the critical rendering path.
// Breadcrumbs are fire-and-forget telemetry — async import is safe.
const lazyBreadcrumb = (bc: {
  category: string;
  message: string;
  level?: SeverityLevel;
  data?: Record<string, unknown>;
}) => {
  import("@/lib/sentry")
    .then(({ addBreadcrumb }) => addBreadcrumb(bc))
    .catch((e) => logger.warn("[Sentry] lazy load skipped:", e));
};
import { logger } from "@/lib/logger";
import {
  chunkFromFilename,
  chunkFromMessage,
  isChunkLoadMessage,
} from "@/lib/chunkErrorDetection";
import { forceHardReload } from "@/lib/versionCheck";

// Event name for chunk load failures
export const CHUNK_LOAD_ERROR_EVENT = "zenflow:chunk-load-error";

export function UpdateRequiredDialog() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [failedChunk, setFailedChunk] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const incidentGenerationRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const requestClose = useCallback(() => {
    if (isRefreshingRef.current) return;
    setIsOpen(false);
  }, []);

  // Reload preparation cannot be cancelled safely. Keep its recovery state
  // visible until it either navigates or returns a retryable failure.
  useBackHandler(isOpen, requestClose);

  const handleChunkError = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    logger.warn("[UpdateRequired] Chunk load error detected:", detail);

    if (isRefreshingRef.current) {
      logger.warn("[UpdateRequired] Additional chunk error ignored during reload preparation");
      return;
    }

    if (!previousFocusRef.current?.isConnected) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    // Track in Sentry as handled (not an error anymore)
    lazyBreadcrumb({
      category: "app",
      message: "Chunk load error - update required dialog shown",
      level: "warning",
      data: detail,
    });

    incidentGenerationRef.current += 1;
    isRefreshingRef.current = false;
    setIsRefreshing(false);
    setRefreshFailed(false);
    setFailedChunk(detail?.chunk || "unknown");
    setIsOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(CHUNK_LOAD_ERROR_EVENT, handleChunkError);

    return () => {
      window.removeEventListener(CHUNK_LOAD_ERROR_EVENT, handleChunkError);
    };
  }, [handleChunkError]);

  const handleRefresh = useCallback(async () => {
    const incidentGeneration = incidentGenerationRef.current;
    // Track the refresh action
    lazyBreadcrumb({
      category: "app",
      message: "User clicked refresh after chunk load error",
      level: "info",
      data: { failedChunk },
    });

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setRefreshFailed(false);
    try {
      const navigated = await forceHardReload();
      if (!navigated && incidentGeneration === incidentGenerationRef.current) {
        isRefreshingRef.current = false;
        setRefreshFailed(true);
        setIsRefreshing(false);
      }
    } catch (error) {
      if (incidentGeneration !== incidentGenerationRef.current) return;
      logger.warn("[UpdateRequired] Safe hard reload preparation failed:", error);
      isRefreshingRef.current = false;
      setRefreshFailed(true);
      setIsRefreshing(false);
    }
  }, [failedChunk]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && isRefreshingRef.current) return;
    setIsOpen(nextOpen);
  }, []);

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        ref={contentRef}
        className="w-[calc(100%-0.5rem)] max-w-md p-1 min-[360px]:w-[calc(100%-1rem)] min-[360px]:p-2 min-[420px]:p-4 sm:p-6"
        onEscapeKeyDown={(event) => {
          if (isRefreshingRef.current) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          const title = titleRef.current;
          if (!title) return;
          event.preventDefault();
          if (contentRef.current) contentRef.current.scrollTop = 0;
          title.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          const previousFocus = previousFocusRef.current;
          previousFocusRef.current = null;
          if (!previousFocus?.isConnected) return;

          previousFocus.focus({ preventScroll: true });
          if (document.activeElement === previousFocus) {
            event.preventDefault();
          }
        }}
      >
        <AlertDialogHeader>
          <div className="mb-2 grid min-w-0 grid-cols-1 items-center gap-3 min-[420px]:grid-cols-[auto_minmax(0,1fr)]">
            <div className="justify-self-center rounded-full bg-primary/10 p-2 min-[420px]:justify-self-auto">
              <Download aria-hidden="true" className="h-6 w-6 text-primary" />
            </div>
            <AlertDialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="text-center min-[420px]:text-start"
            >
              {t.updateRequiredTitle || "Update Available"}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-start">
            {t.updateRequiredDesc ||
              "A new version of the app is available. Please refresh to get the latest features and fixes."}
          </AlertDialogDescription>
          {refreshFailed ? (
            <p
              role="alert"
              className="min-w-0 whitespace-normal break-normal text-sm text-destructive [hyphens:manual] [overflow-wrap:normal]"
            >
              {t.updateRequiredRefreshFailed ||
                "The app stayed open because your latest changes could not be confirmed as saved. Try again."}
            </p>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isRefreshing}
            className="h-auto min-h-11 w-full min-w-0 max-w-full whitespace-normal break-words px-1 py-2 [hyphens:manual] [overflow-wrap:break-word] min-[420px]:px-3 md:w-auto"
          >
            {t.cancel || "Cancel"}
          </AlertDialogCancel>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="inline-flex h-auto min-h-11 w-full min-w-0 max-w-full flex-col items-center justify-center gap-2 whitespace-normal rounded-md bg-primary px-1 py-2 text-sm font-medium text-primary-foreground motion-safe:transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 min-[420px]:px-3 md:w-auto md:flex-row"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words text-center [hyphens:manual] [overflow-wrap:break-word]">
              {t.updateRequiredRefresh || "Refresh App"}
            </span>
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Setup global error listener for chunk load failures.
 * Should be called once in main.tsx before app renders.
 */
export function setupChunkErrorHandler(): void {
  // Handle errors from dynamic imports
  window.addEventListener("error", (event) => {
    const message = event.message || "";
    const filename = event.filename || "";

    if (!isChunkLoadMessage(message)) return;
    // Prevent the error from being logged to console as unhandled.
    event.preventDefault();

    const chunk = chunkFromFilename(filename);
    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { message, filename, chunk, timestamp: Date.now() },
      })
    );
    logger.warn("[ChunkError] Handled chunk load failure:", chunk);
    return true;
  });

  // Handle unhandled promise rejections (dynamic import failures)
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason);

    if (!isChunkLoadMessage(message)) return;
    event.preventDefault();

    const chunk = chunkFromMessage(message);
    const urlMatch = message.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : "";
    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { message, url, chunk, timestamp: Date.now() },
      })
    );
    logger.warn("[ChunkError] Handled chunk load rejection:", chunk);
  });
}
