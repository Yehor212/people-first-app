/**
 * DiaryImageBlock — Interactive image in the overlay layer.
 *
 * Positioned absolutely over the inert placeholder in contenteditable.
 * Provides: pinch-to-zoom, resize handle, delete button.
 * user-select: none + touch-action: none for gesture isolation.
 */

import { useRef, useState, useCallback } from 'react';
import { Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { setCanvasPaused } from '../canvasPause';
import type { ImageInfo } from '../hooks/useDiaryImages';

interface DiaryImageBlockProps {
  image: ImageInfo;
  onRemove: (id: string) => void;
  onScaleChange: (id: string, scale: number) => void;
}

export function DiaryImageBlock({ image, onRemove, onScaleChange }: DiaryImageBlockProps) {
  const [showControls, setShowControls] = useState(false);
  const initialPinchRef = useRef({ distance: 0, scale: 1 });
  const controlsTimeoutRef = useRef(0);

  // Show controls on tap, auto-hide after 3s
  const toggleControls = useCallback(() => {
    setShowControls(prev => {
      const next = !prev;
      clearTimeout(controlsTimeoutRef.current);
      if (next) {
        controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 3000);
      }
      return next;
    });
  }, []);

  // ── Pinch-to-zoom ──

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchRef.current = {
        distance: Math.hypot(dx, dy),
        scale: image.scale,
      };
      setCanvasPaused(true); // Pause canvas to save GPU during pinch
      e.preventDefault();
    }
  }, [image.scale]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / initialPinchRef.current.distance;
      const newScale = Math.max(0.5, Math.min(3, initialPinchRef.current.scale * ratio));
      onScaleChange(image.id, newScale);
      e.preventDefault();
    }
  }, [image.id, onScaleChange]);

  const onTouchEnd = useCallback(() => {
    setCanvasPaused(false); // Resume canvas after pinch
  }, []);

  // ── Scale buttons (fallback for desktop / single-touch) ──

  const zoomIn = useCallback(() => onScaleChange(image.id, image.scale + 0.25), [image.id, image.scale, onScaleChange]);
  const zoomOut = useCallback(() => onScaleChange(image.id, image.scale - 0.25), [image.id, image.scale, onScaleChange]);

  const { position, scale, src } = image;

  return (
    <div
      className="absolute"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        zIndex: 5,
      }}
      onClick={toggleControls}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Image */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="w-full h-full rounded-lg"
        style={{
          objectFit: 'cover',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.1s ease-out',
        }}
      />

      {/* Controls overlay */}
      {showControls && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        >
          <ControlBtn onClick={zoomOut} label="Zoom out">
            <ZoomOut className="w-5 h-5" />
          </ControlBtn>
          <ControlBtn onClick={zoomIn} label="Zoom in">
            <ZoomIn className="w-5 h-5" />
          </ControlBtn>
          <ControlBtn onClick={() => onRemove(image.id)} label="Remove image" danger>
            <Trash2 className="w-5 h-5" />
          </ControlBtn>
        </div>
      )}
    </div>
  );
}

function ControlBtn({
  onClick, label, danger, children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
      style={{
        backgroundColor: danger ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.2)',
        color: '#fff',
      }}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
