import { memo, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { springs, stagger } from "@/config/animations";
import { hapticTap } from "@/lib/haptics";

interface PhotoItem {
  id: string;
  url: string;
  thumbnail?: string;
}

interface PhotoGridLayoutProps {
  photoUrls: PhotoItem[];
  onPhotoTap?: (id: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
}

const MAX_VISIBLE = 4;

export const PhotoGridLayout = memo(function PhotoGridLayout({ photoUrls, onPhotoTap, onRemove, className }: PhotoGridLayoutProps) {
  const reduced = useReducedMotion();
  const count = photoUrls.length;
  const overflow = count > MAX_VISIBLE ? count - MAX_VISIBLE : 0;
  const visible = photoUrls.slice(0, MAX_VISIBLE);

  const handleTap = useCallback(
    (id: string) => {
      void hapticTap();
      onPhotoTap?.(id);
    },
    [onPhotoTap],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      void hapticTap();
      onRemove?.(id);
    },
    [onRemove],
  );

  const gridClass =
    count === 1
      ? "grid-cols-1"
      : count === 3
        ? "grid-cols-2 [&>*:first-child]:col-span-2"
        : "grid-cols-2";

  return (
    <div
      role="group"
      aria-label="Attached photos"
      className={cn("grid gap-1.5", gridClass, className)}
    >
      {visible.map((photo, i) => {
        const isHero = count === 1;
        const isOverlayCell = overflow > 0 && i === MAX_VISIBLE - 1;

        return (
          <motion.div
            key={photo.id}
            role="button"
            aria-label={`Photo ${i + 1} of ${count}`}
            tabIndex={0}
            className={cn(
              "relative min-h-[44px] min-w-[44px] overflow-visible rounded-xl cursor-pointer group",
              isHero ? "aspect-video" : "aspect-square"
            )}
            initial={reduced ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              ...springs.quick,
              delay: stagger.delayForIndex(Math.min(i, 3)),
            }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            onClick={() => handleTap(photo.id)}
            onKeyDown={(e) => e.key === "Enter" && handleTap(photo.id)}
          >
            <div className="h-full w-full overflow-hidden rounded-xl">
              <img
                src={photo.thumbnail ?? photo.url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />

              {isOverlayCell && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]">
                  <span className="text-lg font-bold text-white">
                    +{overflow}
                  </span>
                </div>
              )}
            </div>

            {onRemove && (
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                className="absolute end-1 top-1 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 dark:bg-black/50 motion-safe:transition-transform active:scale-95"
                onClick={(e) => handleRemove(e, photo.id)}
              >
                <X className="h-4 w-4 text-white" />
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
});
