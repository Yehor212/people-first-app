/**
 * UpdateRequiredDialog
 *
 * Shows when a chunk load failure is detected (usually after a new deployment).
 * This happens when cached HTML references old JS chunks that no longer exist.
 * Prompts user to refresh the app to get the latest version.
 */

import { useEffect, useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
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

// Event name for chunk load failures
export const CHUNK_LOAD_ERROR_EVENT = "zenflow:chunk-load-error";

export function UpdateRequiredDialog() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [failedChunk, setFailedChunk] = useState<string | null>(null);

  // Android back button: dismiss dialog
  useBackHandler(isOpen, () => setIsOpen(false));

  const handleChunkError = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    logger.warn("[UpdateRequired] Chunk load error detected:", detail);

    // Track in Sentry as handled (not an error anymore)
    lazyBreadcrumb({
      category: "app",
      message: "Chunk load error - update required dialog shown",
      level: "warning",
      data: detail,
    });

    setFailedChunk(detail?.chunk || "unknown");
    setIsOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(CHUNK_LOAD_ERROR_EVENT, handleChunkError);

    return () => {
      window.removeEventListener(CHUNK_LOAD_ERROR_EVENT, handleChunkError);
    };
  }, [handleChunkError]);

  const handleRefresh = useCallback(() => {
    // Track the refresh action
    lazyBreadcrumb({
      category: "app",
      message: "User clicked refresh after chunk load error",
      level: "info",
      data: { failedChunk },
    });

    // Force a hard reload, bypassing cache
    window.location.reload();
  }, [failedChunk]);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <AlertDialogTitle>{t.updateRequiredTitle || "Update Available"}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-start">
            {t.updateRequiredDesc ||
              "A new version of the app is available. Please refresh to get the latest features and fixes."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={handleRefresh}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            {t.updateRequiredRefresh || "Refresh App"}
          </AlertDialogAction>
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
