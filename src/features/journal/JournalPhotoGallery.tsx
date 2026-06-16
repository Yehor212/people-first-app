import { useState, useEffect, useCallback, memo } from "react";
import { X, Trash2, ZoomIn, ChevronLeft, ChevronRight, MoveDiagonal2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { useLanguage } from "@/contexts/LanguageContext";
import type { JournalPhoto } from "./types";
import { getPhotosForEntry, getPhotoById } from "./journalStorage";
import { logger } from "@/lib/logger";

interface JournalPhotoGalleryProps {
  entryId: string;
  photoIds: string[];
  onRemovePhoto?: (photoId: string) => void;
  onFloatPhoto?: (photoId: string) => void;
  editable?: boolean;
}

export const JournalPhotoGallery = memo(function JournalPhotoGallery({
  entryId,
  photoIds,
  onRemovePhoto,
  onFloatPhoto,
  editable = false,
}: JournalPhotoGalleryProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const { isDesktopClass } = useDeviceTier();
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<JournalPhoto | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [fullData, setFullData] = useState<string | null>(null);

  const closeLightbox = () => {
    setLightboxPhoto(null);
    setFullData(null);
  };

  const navigateLightbox = useCallback(
    (direction: -1 | 1) => {
      if (photos.length <= 1) return;
      const nextIndex = (lightboxIndex + direction + photos.length) % photos.length;
      const nextPhoto = photos[nextIndex];
      setLightboxIndex(nextIndex);
      setLightboxPhoto(nextPhoto);
      setFullData(null);
      getPhotoById(nextPhoto.id)
        .then((full) => setFullData(full?.data ?? nextPhoto.thumbnail))
        .catch(() => setFullData(nextPhoto.thumbnail));
    },
    [photos, lightboxIndex]
  );

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigateLightbox(-1);
      if (e.key === "ArrowRight") navigateLightbox(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxPhoto, navigateLightbox]);

  useScrollLock(!!lightboxPhoto);
  useBackHandler(!!lightboxPhoto, closeLightbox);
  useModalA11y(!!lightboxPhoto, closeLightbox);

  useEffect(() => {
    if (photoIds.length === 0) {
      setPhotos([]);
      return;
    }
    getPhotosForEntry(entryId)
      .then((all) => {
        setPhotos(all.filter((p) => photoIds.includes(p.id)));
      })
      .catch((err) => {
        logger.warn("[Journal]", "Photos load failed:", err);
        setPhotos([]);
      }); // graceful: photo display, not data mutation
  }, [entryId, photoIds]);

  const openLightbox = async (photo: JournalPhoto, index: number) => {
    setLightboxPhoto(photo);
    setLightboxIndex(index);
    const full = await getPhotoById(photo.id);
    setFullData(full?.data ?? photo.thumbnail);
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
                src={photo.thumbnail}
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
                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 motion-safe:transition-opacity" aria-hidden="true" />
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
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
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
              className="absolute top-[max(1rem,env(safe-area-inset-top))] end-4 p-2.5 bg-white/10 dark:bg-white/10 rounded-full z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                className="absolute top-[max(1rem,env(safe-area-inset-top))] start-4 p-2.5 bg-destructive/80 rounded-full z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                  className="absolute start-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 rounded-full z-10 min-w-[44px] min-h-[44px] flex items-center justify-center motion-safe:transition-colors"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateLightbox(1);
                  }}
                  className="absolute end-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 rounded-full z-10 min-w-[44px] min-h-[44px] flex items-center justify-center motion-safe:transition-colors"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </>
            )}

            {/* Photo counter */}
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 dark:bg-black/50 rounded-full text-xs text-white/80 z-10">
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
                "max-w-[95vw] max-h-[90dvh] object-contain rounded-lg",
                !fullData && "blur-sm"
              )}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
