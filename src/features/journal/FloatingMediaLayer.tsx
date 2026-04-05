/**
 * FloatingMediaLayer — Draggable + resizable photos floating above the textarea.
 *
 * Container is pointer-events-none so taps pass through to textarea.
 * Individual photos are pointer-events-auto for drag/resize interaction.
 * Uses framer-motion for drag physics. Custom resize handler on bottom-right corner.
 *
 * Z-INDEX: 20 (above content z-5, below toolbar z-30)
 */

import { useRef, useCallback, useState, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { JournalPhoto } from "./types";
import { getPhotosForEntry } from "./journalStorage";
import { logger } from "@/lib/logger";

interface PhotoLayout {
  x: number; // percentage of container width (0-100)
  y: number; // percentage of container height (0-100)
  width: number; // rendered width in px
}

interface FloatingMediaLayerProps {
  entryId: string;
  photoIds: string[];
  layout: Record<string, PhotoLayout>;
  onLayoutChange: (layout: Record<string, PhotoLayout>) => void;
  onReturnToGallery: (photoId: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const FloatingPhoto = memo(function FloatingPhoto({
  photo,
  position,
  onPositionChange,
  onReturn,
  containerRef,
}: {
  photo: JournalPhoto;
  position: PhotoLayout;
  onPositionChange: (pos: PhotoLayout) => void;
  onReturn: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const resizeStartRef = useRef<{
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [liveWidth, setLiveWidth] = useState(position.width);
  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number; y: number } }) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // Convert drag offset (px) to percentage of container
      const dxPct = (info.offset.x / rect.width) * 100;
      const dyPct = (info.offset.y / rect.height) * 100;
      onPositionChange({
        x: Math.max(5, Math.min(95, position.x + dxPct)),
        y: Math.max(5, Math.min(95, position.y + dyPct)),
        width: liveWidth,
      });
    },
    [containerRef, onPositionChange, liveWidth, position]
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = liveWidth;
      resizeStartRef.current = { startX, startWidth, currentWidth: startWidth };

      const onMove = (ev: PointerEvent) => {
        if (!resizeStartRef.current) return;
        const delta = ev.clientX - resizeStartRef.current.startX;
        const newWidth = Math.max(80, Math.min(500, resizeStartRef.current.startWidth + delta));
        setLiveWidth(newWidth);
        resizeStartRef.current.currentWidth = newWidth;
      };

      const onUp = () => {
        setIsResizing(false);
        if (resizeStartRef.current) {
          onPositionChange({ ...position, width: resizeStartRef.current.currentWidth });
        }
        resizeStartRef.current = null;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [liveWidth, position, onPositionChange]
  );

  const displayHeight = liveWidth / aspectRatio;

  return (
    <motion.div
      drag={!isResizing}
      dragMomentum={false}
      dragConstraints={containerRef}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      className="absolute pointer-events-auto cursor-grab active:cursor-grabbing group gpu-layer"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: liveWidth,
        height: displayHeight,
        touchAction: "none",
        marginLeft: -(liveWidth / 2),
        marginTop: -(displayHeight / 2),
      }}
      whileTap={isResizing ? undefined : { scale: 0.98 }}
    >
      <img
        src={photo.thumbnail || photo.data}
        alt=""
        className="w-full h-full object-cover rounded-xl shadow-lg shadow-black/40 border border-white/10"
        draggable={false}
      />

      {/* Return to gallery button (top-right, always visible on mobile) */}
      <button
        aria-label="Return photo to gallery" // A11Y-OK: aria-label fallback for non-i18n context
        onClick={(e) => {
          e.stopPropagation();
          onReturn();
        }}
        className="absolute -top-3 -end-3 w-11 h-11 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity shadow-lg"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>

      {/* Resize handle (bottom-right corner, 44px touch target) */}
      <div
        role="slider"
        aria-label="Resize photo" // A11Y-OK: aria-label fallback for non-i18n context
        aria-valuemin={80}
        aria-valuemax={500}
        aria-valuenow={liveWidth}
        tabIndex={0}
        onPointerDown={handleResizeStart}
        className="absolute -bottom-2 -end-2 w-11 h-11 rounded-full bg-emerald-500/60 border-2 border-emerald-400/80 cursor-se-resize opacity-60 group-hover:opacity-100 transition-opacity shadow-lg"
        style={{ touchAction: "none" }}
      />
    </motion.div>
  );
});

export const FloatingMediaLayer = memo(function FloatingMediaLayer({
  entryId,
  photoIds,
  layout,
  onLayoutChange,
  onReturnToGallery,
  containerRef,
}: FloatingMediaLayerProps) {
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);

  // Load photos that have layout entries
  useEffect(() => {
    const floatingIds = photoIds.filter((id) => layout[id]);
    if (floatingIds.length === 0) {
      setPhotos([]);
      return;
    }
    getPhotosForEntry(entryId)
      .then((all) => {
        setPhotos(all.filter((p) => floatingIds.includes(p.id)));
      })
      .catch((err) => {
        logger.warn("[FloatingMediaLayer] Failed to load photos:", err);
        setPhotos([]);
      });
  }, [entryId, photoIds, layout]);

  if (photos.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 20 }}>
      {photos.map((photo) => {
        const pos = layout[photo.id];
        if (!pos) return null;
        return (
          <FloatingPhoto
            key={photo.id}
            photo={photo}
            position={pos}
            onPositionChange={(newPos) => {
              onLayoutChange({ ...layout, [photo.id]: newPos });
            }}
            onReturn={() => onReturnToGallery(photo.id)}
            containerRef={containerRef}
          />
        );
      })}
    </div>
  );
});
