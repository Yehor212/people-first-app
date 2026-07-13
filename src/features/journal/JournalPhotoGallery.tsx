import { useState, useEffect, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { X, Trash2, ZoomIn, ChevronLeft, ChevronRight, MoveDiagonal2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { useLanguage } from "@/contexts/LanguageContext";
import type { JournalPhoto } from "./types";
import { getPhotoById, getPhotoPreviewById } from "./journalStorage";
import { logger } from "@/lib/logger";

interface JournalPhotoGalleryProps {
  entryId: string;
  photoIds: string[];
  onRemovePhoto?: (photoId: string) => void;
  onFloatPhoto?: (photoId: string) => void;
  editable?: boolean;
}

export const JournalPhotoGallery = memo(function JournalPhotoGallery({
  photoIds,
  onRemovePhoto,
  onFloatPhoto,
  editable = false,
}: JournalPhotoGalleryProps) {
  const { t, isRTL } = useLanguage();
  const ts = t;
  const { isDesktopClass } = useDeviceTier();
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<JournalPhoto | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [fullData, setFullData] = useState<string | null>(null);
  const lightboxRequestIdRef = useRef(0);

  const closeLightbox = useCallback(() => {
    lightboxRequestIdRef.current += 1;
    setLightboxPhoto(null);
    setFullData(null);
  }, []);

  const hydrateLightboxPhoto = useCallback((photo: JournalPhoto) => {
    const requestId = ++lightboxRequestIdRef.current;
    setFullData(null);
    getPhotoById(photo.id)
      .then((full) => {
        if (requestId !== lightboxRequestIdRef.current) return;
        setFullData(full?.data ?? photo.thumbnail);
      })
      .catch(() => {
        if (requestId !== lightboxRequestIdRef.current) return;
        setFullData(photo.thumbnail);
      });
  }, []);

  const navigateLightbox = useCallback(
    (direction: -1 | 1) => {
      if (photos.length <= 1) return;
      const nextIndex = (lightboxIndex + direction + photos.length) % photos.length;
      const nextPhoto = photos[nextIndex];
      setLightboxIndex(nextIndex);
      setLightboxPhoto(nextPhoto);
      hydrateLightboxPhoto(nextPhoto);
    },
    [hydrateLightboxPhoto, photos, lightboxIndex]
  );

  const backwardDirection = isRTL ? 1 : -1;
  const forwardDirection = isRTL ? -1 : 1;
  const PreviousIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigateLightbox(backwardDirection);
      if (e.key === "ArrowRight") navigateLightbox(forwardDirection);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [backwardDirection, forwardDirection, lightboxPhoto, navigateLightbox]);

  useScrollLock(!!lightboxPhoto);
  const lightboxA11y = useModalA11y(!!lightboxPhoto, closeLightbox);

  useEffect(() => {
    if (photoIds.length === 0) {
      setPhotos([]);
      return;
    }
    let cancelled = false;
    Promise.all(photoIds.map((photoId) => getPhotoPreviewById(photoId)))
      .then((items) => {
        if (cancelled) return;
        setPhotos(items.filter((photo): photo is JournalPhoto => Boolean(photo)));
      })
      .catch((err) => {
        if (cancelled) return;
        logger.warn("[Journal]", "Photos load failed:", err);
        setPhotos([]);
      }); // graceful: photo display, not data mutation
    return () => {
      cancelled = true;
    };
  }, [photoIds]);

  const openLightbox = (photo: JournalPhoto, index: number) => {
    setLightboxPhoto(photo);
    setLightboxIndex(index);
    hydrateLightboxPhoto(photo);
  };

  if (photos.length === 0) return null;

  return (
    <>
      {/* Thumbnail grid */}
      <div
        className={cn(
          isDesktopClass
            ? "grid grid-cols-3 gap-2 xl:grid-cols-4"
            : "flex gap-2 overflow-x-auto scrollbar-hide py-1"
        )}
      >
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative flex-shrink-0 group">
            <button
              onClick={() => openLightbox(photo, index)}
              className="block rounded-xl overflow-hidden shadow-sm"
              aria-label={ts.openPhoto || "Open photo"}
            >
              <img
                src={photo.thumbnail || photo.data}
                alt=""
                width={64}
                height={64}
                className={cn(
                  "object-cover rounded-xl",
                  isDesktopClass ? "w-full aspect-square" : "w-16 h-16"
                )}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 dark:bg-black/0 group-hover:bg-black/20 dark:group-hover:bg-black/20 motion-safe:transition-colors rounded-xl flex items-center justify-center">
                <ZoomIn
                  className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 motion-safe:transition-opacity"
                  aria-hidden="true"
                />
              </div>
            </button>
            {editable && onRemovePhoto && (
              <button
                onClick={() => onRemovePhoto(photo.id)}
                className="absolute -top-3 -end-3 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                className="absolute -bottom-3 -end-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-primary-foreground motion-safe:transition-transform active:scale-95"
                aria-label={t.ariaFloatPhoto}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-md">
                  <MoveDiagonal2 className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {lightboxPhoto && (
              <motion.div
                ref={lightboxA11y.modalRef}
                onKeyDown={lightboxA11y.handleKeyDown}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role="dialog"
                aria-modal="true"
                aria-label={t.ariaPhotoLightbox}
                className="fixed inset-0 z-[70] bg-black/90 dark:bg-black/90 flex items-center justify-center"
                onClick={closeLightbox}
              >
                <button
                  onClick={closeLightbox}
                  className="absolute top-[max(1rem,env(safe-area-inset-top))] end-4 p-2.5 bg-white/10 dark:bg-white/10 rounded-full z-20 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={ts.close || "Close"}
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {editable && onRemovePhoto && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePhoto(lightboxPhoto.id);
                      closeLightbox();
                    }}
                    className="absolute top-[max(1rem,env(safe-area-inset-top))] start-4 p-2.5 bg-destructive/80 rounded-full z-20 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                        navigateLightbox(backwardDirection);
                      }}
                      className="absolute start-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 rounded-full z-20 min-w-[44px] min-h-[44px] flex items-center justify-center motion-safe:transition-colors"
                      aria-label={ts.journalPhotoPrevious || ts.previous || "Previous photo"}
                    >
                      <PreviousIcon className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateLightbox(forwardDirection);
                      }}
                      className="absolute end-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 rounded-full z-20 min-w-[44px] min-h-[44px] flex items-center justify-center motion-safe:transition-colors"
                      aria-label={ts.journalPhotoNext || ts.next || "Next photo"}
                    >
                      <NextIcon className="w-5 h-5 text-white" />
                    </button>
                  </>
                )}

                {/* Photo counter */}
                {photos.length > 1 && (
                  <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 dark:bg-black/50 rounded-full text-xs text-white/80 z-20">
                    {lightboxIndex + 1} / {photos.length}
                  </div>
                )}

                <motion.img
                  key={lightboxPhoto.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  src={fullData || lightboxPhoto.thumbnail}
                  alt=""
                  className={cn(
                    "relative z-0 max-w-[95vw] max-h-[90dvh] object-contain rounded-lg",
                    !fullData && "blur-sm"
                  )}
                  onClick={(e) => e.stopPropagation()}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
});
