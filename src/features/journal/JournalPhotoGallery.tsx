import { useState, useEffect, memo } from 'react';
import { X, Trash2, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useLanguage } from '@/contexts/LanguageContext';
import type { JournalPhoto } from './types';
import { getPhotosForEntry, getPhotoById } from './journalStorage';
import { logger } from '@/lib/logger';

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
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<JournalPhoto | null>(null);
  const [fullData, setFullData] = useState<string | null>(null);

  const closeLightbox = () => {
    setLightboxPhoto(null);
    setFullData(null);
  };

  useScrollLock(!!lightboxPhoto);
  useBackHandler(!!lightboxPhoto, closeLightbox);

  useEffect(() => {
    if (photoIds.length === 0) { setPhotos([]); return; }
    getPhotosForEntry(entryId).then(all => {
      setPhotos(all.filter(p => photoIds.includes(p.id)));
    }).catch(err => { logger.warn('[Journal]', 'Photos load failed:', err); setPhotos([]); });
  }, [entryId, photoIds]);

  const openLightbox = async (photo: JournalPhoto) => {
    setLightboxPhoto(photo);
    const full = await getPhotoById(photo.id);
    setFullData(full?.data ?? photo.thumbnail);
  };

  if (photos.length === 0) return null;

  return (
    <>
      {/* Thumbnail grid */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
        {photos.map(photo => (
          <div key={photo.id} className="relative flex-shrink-0 group">
            <button
              onClick={() => openLightbox(photo)}
              className="block rounded-xl overflow-hidden shadow-sm"
            >
              <img
                src={photo.thumbnail}
                alt=""
                className="w-16 h-16 object-cover rounded-xl"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
            {editable && onRemovePhoto && (
              <button
                onClick={() => onRemovePhoto(photo.id)}
                className="absolute -top-3 -end-3 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={ts.delete || 'Remove'}
              >
                <span className="w-7 h-7 bg-destructive rounded-full flex items-center justify-center shadow-md">
                  <X className="w-3.5 h-3.5 text-white" />
                </span>
              </button>
            )}
            {editable && onFloatPhoto && (
              <button
                onClick={() => onFloatPhoto(photo.id)}
                className="absolute -bottom-1 -end-1 w-6 h-6 bg-emerald-500/80 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Float photo"
              >
                <span className="text-[10px]">↗</span>
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
            className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-[max(1rem,env(safe-area-inset-top))] end-4 p-2.5 bg-white/10 rounded-full z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={ts.close || 'Close'}
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
                aria-label={ts.delete || 'Delete'}
              >
                <Trash2 className="w-5 h-5 text-white" />
              </button>
            )}

            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              src={fullData || lightboxPhoto.thumbnail}
              alt=""
              className={cn(
                'max-w-[95vw] max-h-[90dvh] object-contain rounded-lg',
                !fullData && 'blur-sm',
              )}
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
