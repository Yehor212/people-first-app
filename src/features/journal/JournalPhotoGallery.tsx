import { useState, useEffect, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { X, Trash2, ZoomIn, ChevronLeft, ChevronRight, MoveDiagonal2 } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { useLanguage } from "@/contexts/LanguageContext";
import type { JournalEntry, JournalPhoto } from "./types";
import { getPhotoById, getPhotoPreviewById } from "./journalStorage";
import { logger } from "@/lib/logger";
import { formatLocalizedNumber } from "@/lib/timeUtils";
import type { Language } from "@/i18n/translations";

interface JournalPhotoGalleryProps {
  entryId: string;
  photoIds: string[];
  photoLayout?: JournalEntry["photoLayout"];
  onRemovePhoto?: (photoId: string) => void;
  onFloatPhoto?: (photoId: string) => void;
  editable?: boolean;
}

const formatPhotoPosition = (
  template: string,
  current: number,
  total: number,
  language: Language,
) =>
  template
    .replace("{current}", formatLocalizedNumber(current, language))
    .replace("{total}", formatLocalizedNumber(total, language));

export const JournalPhotoGallery = memo(function JournalPhotoGallery({
  entryId,
  photoIds,
  photoLayout,
  onRemovePhoto,
  onFloatPhoto,
  editable = false,
}: JournalPhotoGalleryProps) {
  const { t, isRTL, language } = useLanguage();
  const ts = t;
  const prefersReducedMotion = useReducedMotion();
  const { isDesktopClass } = useDeviceTier();
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<JournalPhoto | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [fullData, setFullData] = useState<string | null>(null);
  const [lightboxLoadFailed, setLightboxLoadFailed] = useState(false);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [storageFailedPhotoCount, setStorageFailedPhotoCount] = useState(0);
  const [decodeFailedPhotoIds, setDecodeFailedPhotoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const lightboxRequestIdRef = useRef(0);
  const lightboxReturnFocusRef = useRef<HTMLElement | null>(null);
  const lightboxCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const lightboxRetryButtonRef = useRef<HTMLButtonElement | null>(null);
  const thumbnailButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const closeLightbox = useCallback(() => {
    lightboxRequestIdRef.current += 1;
    setLightboxPhoto(null);
    setFullData(null);
    setLightboxLoadFailed(false);
    setLightboxLoading(false);
  }, []);

  const hydrateLightboxPhoto = useCallback((photo: JournalPhoto, fromRetry = false) => {
    const requestId = ++lightboxRequestIdRef.current;
    setFullData(null);
    setLightboxLoading(true);
    if (!fromRetry) setLightboxLoadFailed(false);
    const restoreRetryFocus = () => {
      window.setTimeout(() => {
        if (requestId === lightboxRequestIdRef.current) {
          lightboxRetryButtonRef.current?.focus();
        }
      }, 0);
    };
    const moveFocusToClose = () => {
      window.setTimeout(() => {
        if (requestId === lightboxRequestIdRef.current) {
          lightboxCloseButtonRef.current?.focus();
        }
      }, 0);
    };
    getPhotoById(photo.id, entryId)
      .then((full) => {
        if (requestId !== lightboxRequestIdRef.current) return;
        if (!full?.data) {
          setFullData(photo.thumbnail);
          setLightboxLoadFailed(true);
          setLightboxLoading(false);
          if (fromRetry) restoreRetryFocus();
          return;
        }
        setFullData(full.data);
        setLightboxLoadFailed(false);
        setLightboxLoading(false);
        if (fromRetry) moveFocusToClose();
      })
      .catch(() => {
        if (requestId !== lightboxRequestIdRef.current) return;
        setFullData(photo.thumbnail);
        setLightboxLoadFailed(true);
        setLightboxLoading(false);
        if (fromRetry) restoreRetryFocus();
      });
  }, [entryId]);

  const navigateLightbox = useCallback(
    (direction: -1 | 1) => {
      if (photos.length <= 1) return;
      const retryHadFocus =
        document.activeElement === lightboxRetryButtonRef.current;
      const nextIndex = (lightboxIndex + direction + photos.length) % photos.length;
      const nextPhoto = photos[nextIndex];
      setLightboxIndex(nextIndex);
      setLightboxPhoto(nextPhoto);
      hydrateLightboxPhoto(nextPhoto);
      if (retryHadFocus) {
        window.setTimeout(() => lightboxCloseButtonRef.current?.focus(), 0);
      }
    },
    [hydrateLightboxPhoto, photos, lightboxIndex]
  );

  const PreviousIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigateLightbox(isRTL ? 1 : -1);
      if (e.key === "ArrowRight") navigateLightbox(isRTL ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isRTL, lightboxPhoto, navigateLightbox]);

  useScrollLock(!!lightboxPhoto);
  const lightboxA11y = useModalA11y(
    !!lightboxPhoto,
    closeLightbox,
    lightboxReturnFocusRef,
  );

  useEffect(() => {
    if (photoIds.length === 0) {
      setPhotos([]);
      setStorageFailedPhotoCount(0);
      setDecodeFailedPhotoIds(new Set());
      return;
    }
    let cancelled = false;
    void Promise.allSettled(photoIds.map((photoId) => getPhotoPreviewById(photoId, entryId)))
      .then((results) => {
        if (cancelled) return;
        const failedCount = results.filter(
          (result) => result.status === "rejected" || !result.value,
        ).length;
        if (failedCount > 0) {
          logger.warn("[Journal]", `${failedCount} photo preview(s) could not be displayed`);
        }
        setStorageFailedPhotoCount(failedCount);
        setPhotos(
          results.flatMap((result) =>
            result.status === "fulfilled" && result.value ? [result.value] : [],
          ),
        );
      }); // graceful: photo display, not data mutation
    return () => {
      cancelled = true;
    };
  }, [entryId, loadAttempt, photoIds]);

  const reportDecodeError = useCallback((photoId: string) => {
    setDecodeFailedPhotoIds((current) => {
      if (current.has(photoId)) return current;
      const next = new Set(current);
      next.add(photoId);
      return next;
    });
  }, []);

  const retryFailedPhotos = useCallback(() => {
    setDecodeFailedPhotoIds(new Set());
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const failedPhotoCount = storageFailedPhotoCount + decodeFailedPhotoIds.size;

  const openLightbox = (photo: JournalPhoto, index: number, opener: HTMLButtonElement) => {
    lightboxReturnFocusRef.current = opener;
    setLightboxPhoto(photo);
    setLightboxIndex(index);
    hydrateLightboxPhoto(photo);
  };

  if (photos.length === 0 && failedPhotoCount === 0) return null;

  return (
    <>
      {failedPhotoCount > 0 && (
        <div
          role="status"
          className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/90 px-3 py-2 text-sm text-foreground"
        >
          <span>
            {ts.journalPhotoLoadError ||
              "Some photos could not be shown. Your entry was not changed."}
          </span>
          <button
            type="button"
            onClick={retryFailedPhotos}
            className="inline-flex min-h-[48px] items-center rounded-lg px-3 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            {ts.journalPhotoLoadRetry || "Try loading photos again"}
          </button>
        </div>
      )}
      {/* Thumbnail grid */}
      {photos.length > 0 && <div
        className={cn(
          isDesktopClass
            ? "grid grid-cols-3 gap-2 xl:grid-cols-4"
            : "flex gap-2 overflow-x-auto scrollbar-hide py-1"
        )}
      >
        {photos.map((photo, index) => (
          <div key={`${photo.id}:${loadAttempt}`} className="relative flex-shrink-0 group">
            {(() => {
              const description = photoLayout?.[photo.id]?.description;
              const descriptionId = description ? `journal-photo-description-${photo.id}` : undefined;
              return (
                <>
            <button
              ref={(button) => {
                if (button) thumbnailButtonRefs.current.set(photo.id, button);
                else thumbnailButtonRefs.current.delete(photo.id);
              }}
              onClick={(event) => openLightbox(photo, index, event.currentTarget)}
              className="relative block overflow-hidden rounded-xl shadow-sm"
              aria-describedby={descriptionId}
              aria-label={`${ts.openPhoto || "Open photo"}. ${formatPhotoPosition(
                ts.journalPhotoPosition || "Photo {current} of {total}",
                index + 1,
                photos.length,
                language,
              )}`}
            >
              <img
                src={photo.thumbnail || photo.data}
                alt=""
                width={64}
                height={64}
                className={cn(
                  "object-cover rounded-xl",
                  isDesktopClass
                    ? "w-full aspect-square"
                    : editable
                      ? "w-28 h-28"
                      : "w-16 h-16"
                )}
                loading="lazy"
                onError={() => reportDecodeError(photo.id)}
              />
              <div className="absolute inset-0 bg-black/0 dark:bg-black/0 group-hover:bg-black/20 dark:group-hover:bg-black/20 motion-safe:transition-colors rounded-xl flex items-center justify-center">
                <ZoomIn
                  className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 motion-safe:transition-opacity"
                  aria-hidden="true"
                />
              </div>
            </button>
            {description && (
              <span id={descriptionId} className="sr-only" dir="auto">
                {language === "ar" || language === "he" ? `\u2068${description}\u2069` : description}
              </span>
            )}
            {editable && onRemovePhoto && (
              <button
                onClick={() => onRemovePhoto(photo.id)}
                data-journal-photo-action="remove"
                className="absolute top-1 end-1 flex min-h-[48px] min-w-[48px] items-center justify-center"
                aria-label={ts.delete || "Remove"}
              >
                <span className="w-7 h-7 bg-destructive rounded-full flex items-center justify-center shadow-md">
                  <X className="w-3.5 h-3.5 text-white" />
                </span>
              </button>
            )}
            {editable && onFloatPhoto && (
              <button
                onClick={() => onFloatPhoto(photo.id)}
                data-journal-photo-action="float"
                className="mt-1 inline-flex min-h-[48px] min-w-[48px] max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary motion-safe:transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                aria-label={t.ariaFloatPhoto}
              >
                <MoveDiagonal2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 whitespace-normal break-words">{t.ariaFloatPhoto}</span>
              </button>
            )}
                </>
              );
            })()}
          </div>
        ))}
      </div>}

      {/* Lightbox */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {lightboxPhoto && (
              <motion.div
                ref={lightboxA11y.modalRef}
                onKeyDown={lightboxA11y.handleKeyDown}
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                role="dialog"
                aria-modal="true"
                aria-label={t.ariaPhotoLightbox}
                className="fixed inset-x-0 top-0 z-[70] flex h-[var(--app-viewport-height)] w-full items-center justify-center bg-black/90 dark:bg-black/90"
                onClick={closeLightbox}
              >
                <button
                  ref={lightboxCloseButtonRef}
                  onClick={closeLightbox}
                  className="absolute top-[max(1rem,var(--safe-top))] end-[max(1rem,var(--safe-inline-end))] z-20 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-white/10 p-2.5 dark:bg-white/10"
                  aria-label={ts.close || "Close"}
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {editable && onRemovePhoto && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const fallbackPhoto =
                        photos[lightboxIndex + 1] ?? photos[lightboxIndex - 1] ?? null;
                      lightboxReturnFocusRef.current = fallbackPhoto
                        ? thumbnailButtonRefs.current.get(fallbackPhoto.id) ?? null
                        : null;
                      onRemovePhoto(lightboxPhoto.id);
                      closeLightbox();
                    }}
                    className="absolute top-[max(1rem,var(--safe-top))] start-[max(1rem,var(--safe-inline-start))] z-20 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-destructive/80 p-2.5"
                    aria-label={ts.delete || "Delete"}
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                )}

                {/* Prev/Next navigation */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateLightbox(-1);
                      }}
                      className="absolute start-[max(1rem,var(--safe-inline-start))] top-1/2 z-20 flex min-h-[48px] min-w-[48px] -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-2.5 motion-safe:transition-colors hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20"
                      aria-label={ts.journalPhotoPrevious || ts.previous || "Previous photo"}
                    >
                      <PreviousIcon className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateLightbox(1);
                      }}
                      className="absolute end-[max(1rem,var(--safe-inline-end))] top-1/2 z-20 flex min-h-[48px] min-w-[48px] -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-2.5 motion-safe:transition-colors hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20"
                      aria-label={ts.journalPhotoNext || ts.next || "Next photo"}
                    >
                      <NextIcon className="w-5 h-5 text-white" />
                    </button>
                  </>
                )}

                {/* Photo counter */}
                {photos.length > 1 && (
                  <div
                    role="status"
                    aria-busy={lightboxLoading}
                    aria-live="polite"
                    aria-atomic="true"
                    aria-label={formatPhotoPosition(
                      ts.journalPhotoPosition || "Photo {current} of {total}",
                      lightboxIndex + 1,
                      photos.length,
                      language,
                    )}
                    className="absolute bottom-[max(1rem,var(--safe-bottom))] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-xs text-white dark:bg-black/80"
                  >
                    {formatLocalizedNumber(lightboxIndex + 1, language)} /{" "}
                    {formatLocalizedNumber(photos.length, language)}
                  </div>
                )}

                {lightboxLoadFailed && (
                  <div
                    role="status"
                    className="absolute bottom-[max(3.5rem,calc(var(--safe-bottom)+3.5rem))] left-1/2 z-20 flex max-w-[min(90vw,32rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg bg-black/80 px-3 py-2 text-center text-sm text-white dark:bg-black/80"
                  >
                    <span>
                      {ts.journalPhotoLoadError ||
                        "Some photos could not be shown. Your entry was not changed."}
                    </span>
                    <button
                      ref={lightboxRetryButtonRef}
                      type="button"
                      disabled={lightboxLoading}
                      className="inline-flex min-h-[48px] min-w-[48px] items-center rounded-lg px-3 font-medium text-white underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-70"
                      onClick={(event) => {
                        event.stopPropagation();
                        hydrateLightboxPhoto(lightboxPhoto, true);
                      }}
                    >
                      {ts.journalPhotoLoadRetry || "Try loading photos again"}
                    </button>
                  </div>
                )}

                <motion.img
                  key={lightboxPhoto.id}
                  initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={prefersReducedMotion ? undefined : { scale: 0.9, opacity: 0 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 300, damping: 25 }
                  }
                  src={fullData || lightboxPhoto.thumbnail}
                  alt={
                    photoLayout?.[lightboxPhoto.id]?.description ||
                    formatPhotoPosition(
                      ts.journalPhotoPosition || "Photo {current} of {total}",
                      lightboxIndex + 1,
                      photos.length,
                      language,
                    )
                  }
                  dir="auto"
                  className={cn(
                    "relative z-0 max-h-[calc(var(--app-viewport-height)-var(--safe-top)-var(--safe-bottom)-4rem)] max-w-[calc(100vw-var(--safe-left)-var(--safe-right)-2rem)] rounded-lg object-contain",
                    !fullData && !lightboxLoadFailed && "blur-sm"
                  )}
                  onClick={(e) => e.stopPropagation()}
                  onError={() => {
                    if (fullData && fullData !== lightboxPhoto.thumbnail) {
                      setFullData(lightboxPhoto.thumbnail);
                      setLightboxLoadFailed(true);
                      return;
                    }
                    reportDecodeError(lightboxPhoto.id);
                    closeLightbox();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
});
