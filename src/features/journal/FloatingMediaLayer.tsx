/**
 * FloatingMediaLayer — Draggable + resizable photos floating above the textarea.
 *
 * Container is pointer-events-none so taps pass through to textarea.
 * Individual photos are pointer-events-auto for drag/resize interaction.
 * Uses framer-motion for drag physics. Custom resize handler on bottom-right corner.
 *
 * Z-INDEX: 20 (above content z-5, below toolbar z-30)
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { JournalPhoto } from './types';
import { getPhotosForEntry } from './journalStorage';

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

function FloatingPhoto({
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
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [liveWidth, setLiveWidth] = useState(position.width);
  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;

  const handleDragEnd = useCallback((_: unknown, info: { point: { x: number; y: number } }) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const xPct = ((info.point.x - rect.left) / rect.width) * 100;
    const yPct = ((info.point.y - rect.top) / rect.height) * 100;
    onPositionChange({
      x: Math.max(5, Math.min(95, xPct)),
      y: Math.max(5, Math.min(95, yPct)),
      width: liveWidth,
    });
  }, [containerRef, onPositionChange, liveWidth]);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = liveWidth;
    resizeStartRef.current = { startX, startWidth };

    const onMove = (ev: PointerEvent) => {
      if (!resizeStartRef.current) return;
      const delta = ev.clientX - resizeStartRef.current.startX;
      const newWidth = Math.max(80, Math.min(500, resizeStartRef.current.startWidth + delta));
      setLiveWidth(newWidth);
    };

    const onUp = () => {
      setIsResizing(false);
      if (resizeStartRef.current) {
        onPositionChange({ ...position, width: liveWidth });
      }
      resizeStartRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [liveWidth, position, onPositionChange]);

  const displayHeight = liveWidth / aspectRatio;

  return (
    <motion.div
      drag={!isResizing}
      dragMomentum
      dragTransition={{ power: 0.2, timeConstant: 200 }}
      dragConstraints={containerRef}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      className="absolute pointer-events-auto cursor-grab active:cursor-grabbing group gpu-layer"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        width: liveWidth,
        height: displayHeight,
        touchAction: 'none',
      }}
      whileTap={isResizing ? undefined : { scale: 0.98 }}
    >
      <img
        src={photo.thumbnail || photo.data}
        alt=""
        className="w-full h-full object-cover rounded-xl shadow-lg shadow-black/40 border border-white/10"
        draggable={false}
      />

      {/* Return to gallery button (top-right, visible on hover/touch) */}
      <button
        onClick={(e) => { e.stopPropagation(); onReturn(); }}
        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Resize handle (bottom-right corner) */}
      <div
        onPointerDown={handleResizeStart}
        className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500/60 border-2 border-emerald-400/80 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        style={{ touchAction: 'none' }}
      />
    </motion.div>
  );
}

export function FloatingMediaLayer({
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
    const floatingIds = photoIds.filter(id => layout[id]);
    if (floatingIds.length === 0) { setPhotos([]); return; }
    getPhotosForEntry(entryId).then(all => {
      setPhotos(all.filter(p => floatingIds.includes(p.id)));
    }).catch(() => setPhotos([]));
  }, [entryId, photoIds, layout]);

  if (photos.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 20 }}
    >
      {photos.map(photo => {
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
}
