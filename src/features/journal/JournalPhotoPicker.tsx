import { useCallback, useRef, useState, useEffect } from "react";
import { isNative } from "@/lib/platform";
import { Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { logger } from "@/lib/logger";
import { formatLocalizedCount } from "./journalWordCount";

interface JournalPhotoPickerProps {
  onSelectFile: (file: File, signal?: AbortSignal) => Promise<void>;
  onClose: () => void;
  currentCount: number;
  maxCount: number;
  initialFile?: File | null;
}

export const MAX_JOURNAL_PHOTO_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const JOURNAL_PHOTO_PROCESS_TIMEOUT_MS = 30_000;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
export const JOURNAL_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export function isSupportedJournalPhotoFile(file: Pick<File, "name" | "type">): boolean {
  const type = file.type.toLowerCase();
  if (type) return ALLOWED_MIME_TYPES.includes(type);

  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function isJournalPhotoStorageQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === "QuotaExceededError" || candidate.code === 22;
}

export function JournalPhotoPicker({
  onSelectFile,
  onClose,
  currentCount,
  maxCount,
  initialFile = null,
}: JournalPhotoPickerProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const galleryButtonRef = useRef<HTMLButtonElement>(null);
  const processingStatusRef = useRef<HTMLDivElement>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const consumedInitialFileRef = useRef<File | null>(null);
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestClose = useCallback(() => {
    if (!loading) {
      onClose();
      return;
    }
    cancelRequestedRef.current = true;
    activeControllerRef.current?.abort();
  }, [loading, onClose]);
  const { modalRef, handleKeyDown } = useModalA11y(true, requestClose);
  useScrollLock(true);
  // capture="environment" only opens a real camera on native mobile (Android/iOS).
  // On desktop web it silently falls back to file picker — identical to gallery button.
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    if (isNative) {
      setHasCamera(true);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (loading) processingStatusRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    if (error && !loading) galleryButtonRef.current?.focus();
  }, [error, loading]);

  const processFile = useCallback(async (file: File) => {
    if (!isSupportedJournalPhotoFile(file)) {
      setError(
        ts.journalPhotoInvalidType || "Unsupported file type. Please use JPEG, PNG, or WebP."
      );
      return;
    }

    if (file.size > MAX_JOURNAL_PHOTO_FILE_SIZE) {
      setError(
        ts.journalPhotoTooLarge ||
          "This photo is larger than 10 MB. Choose a smaller photo and try again."
      );
      return;
    }

    setLoading(true);
    setError(null);
    cancelRequestedRef.current = false;
    const controller = new AbortController();
    activeControllerRef.current = controller;
    let timedOut = false;
    let timeoutId: number | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
          const timeoutError = new Error("Journal photo processing timed out");
          timeoutError.name = "TimeoutError";
          reject(timeoutError);
        }, JOURNAL_PHOTO_PROCESS_TIMEOUT_MS);
      });
      const aborted = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => {
            const abortError = new Error("Journal photo processing cancelled");
            abortError.name = "AbortError";
            reject(abortError);
          },
          { once: true },
        );
      });
      await Promise.race([onSelectFile(file, controller.signal), timeout, aborted]);
      if (mountedRef.current) onClose();
    } catch (err) {
      if (!mountedRef.current) return;
      if (cancelRequestedRef.current && controller.signal.aborted && !timedOut) {
        onClose();
        return;
      }
      logger.error("[JournalPhotoPicker] Photo upload failed", {
        name: err instanceof Error ? err.name : "UnknownError",
      });
      setError(
        timedOut
          ? ts.journalPhotoProcessingTimeout ||
              "Photo processing took too long. Try a smaller photo."
          : isJournalPhotoStorageQuotaError(err)
          ? ts.journalPhotoStorageFull ||
              "There is not enough space on this device. Free some space, then try again."
          : ts.journalPhotoError || "Couldn't add this photo. Try again."
      );
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (activeControllerRef.current === controller) activeControllerRef.current = null;
      if (mountedRef.current) setLoading(false);
    }
  }, [onClose, onSelectFile, ts]);

  useEffect(() => {
    if (!initialFile || consumedInitialFileRef.current === initialFile) return;
    consumedInitialFileRef.current = initialFile;
    void processFile(initialFile);
  }, [initialFile, processFile]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = "";
  };

  const remaining = maxCount - currentCount;
  const remainingLabel = formatLocalizedCount(
    remaining,
    language,
    ts,
    "journalPhotoRemainingCount",
    ts.journalRemaining || "remaining"
  );

  return (
    <>
      {/* // A11Y-OK: backdrop is decorative overlay dismissed by click — aria-hidden excludes from AT tree */}
      <div
        className="fixed inset-0 z-[64] bg-black/30 motion-safe:animate-fade-in"
        aria-hidden="true"
        onClick={requestClose}
      />

      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t.ariaPhotoPicker}
        aria-busy={loading}
        className={cn(
          "fixed bottom-0 inset-x-0 z-[65] max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] overflow-y-auto overscroll-contain lg:max-w-4xl lg:mx-auto",
          "bg-card backdrop-blur-xl border-t border-border/40",
          "rounded-t-2xl shadow-lg motion-safe:animate-slide-up"
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="pb-[calc(max(1rem,var(--safe-bottom))+0.75rem)] ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pt-2">
          {/* Header */}
          <div className="mb-4 flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 flex-1 whitespace-normal break-words text-sm font-semibold text-foreground">
              {ts.journalPhotoAdd || "Add Photo"} ({remainingLabel})
            </span>
            <button
              onClick={requestClose}
              className="flex min-h-12 min-w-12 items-center justify-center rounded-lg p-2 hover:bg-muted/50"
              aria-label={ts.close || "Close"}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {error && <p role="alert" className="py-2 text-center text-sm font-medium text-destructive">{error}</p>}

          {loading ? (
            <div
              ref={processingStatusRef}
              role="status"
              aria-live="polite"
              tabIndex={-1}
              className="flex items-center justify-center rounded-lg py-8 outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            >
              <Loader2
                className="w-6 h-6 text-primary motion-safe:animate-spin"
                aria-hidden="true"
              />
              <span className="ms-2 text-sm text-muted-foreground">
                {ts.journalCompressing || "Preparing photo..."}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3 min-[420px]:flex-row">
              {hasCamera && (
                <button
                  onClick={() => cameraRef.current?.click()}
                  disabled={remaining <= 0}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-2 py-6 rounded-xl",
                    "bg-muted/50 border border-border/30",
                    "active:scale-95 motion-safe:transition-transform",
                    "disabled:opacity-40",
                    "min-h-[80px]"
                  )}
                >
                  <Camera className="w-6 h-6 text-foreground" aria-hidden="true" />
                  <span className="min-w-0 whitespace-normal break-words text-center text-xs font-medium text-foreground">
                    {ts.journalPhotoTake || "Take Photo"}
                  </span>
                </button>
              )}

              <button
                ref={galleryButtonRef}
                onClick={() => galleryRef.current?.click()}
                disabled={remaining <= 0}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 py-6 rounded-xl",
                  "bg-muted/50 border border-border/30",
                  "active:scale-95 motion-safe:transition-transform",
                  "disabled:opacity-40",
                  "min-h-[80px]"
                )}
              >
                <ImageIcon className="w-6 h-6 text-foreground" aria-hidden="true" />
                <span className="min-w-0 whitespace-normal break-words text-center text-xs font-medium text-foreground">
                  {ts.journalPhotoChoose || "From Gallery"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept={JOURNAL_PHOTO_ACCEPT}
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <input
          ref={galleryRef}
          type="file"
          accept={JOURNAL_PHOTO_ACCEPT}
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </>
  );
}
