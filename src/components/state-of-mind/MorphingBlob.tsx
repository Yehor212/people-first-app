import { useEffect, useId, useRef, useState } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { generateBlobPath } from './blobGeometry';
import { valenceToColor } from './colorUtils';

interface MorphingBlobProps {
  /** Current valence value (-1.0 to 1.0) */
  valence: number;
  /** Size in px (width = height) */
  size?: number;
}

/**
 * SVG blob that morphs based on valence.
 * Negative → spiky/jagged. Positive → smooth/round.
 * Uses requestAnimationFrame at 30fps for organic movement.
 *
 * GPU-only: SVG path updates are compositor-friendly.
 * Dopamine gate: falls back to static shape when animations disabled.
 * Law 18: RAF cleanup on unmount.
 */
export function MorphingBlob({ valence, size = 192 }: MorphingBlobProps) {
  const gradientId = useId(); // Unique ID per instance (Law 15: Component Isolation)
  const radius = size * 0.42; // ~80px at 192
  const center = size / 2;
  const rafRef = useRef(0);
  const timeRef = useRef(0);
  const mountedRef = useRef(true); // Law 18: guard async setState
  const valenceRef = useRef(valence);
  const [pathD, setPathD] = useState(() =>
    generateBlobPath(valence, 0, radius, center, center)
  );

  // Keep ref in sync for RAF callback
  valenceRef.current = valence;

  // Law 18: track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!shouldAnimate()) {
      // Static fallback: render shape at current valence without animation
      setPathD(generateBlobPath(valenceRef.current, 0, radius, center, center));
      return;
    }

    let lastFrame = 0;
    const FRAME_INTERVAL = 1000 / 30; // 30fps target

    const animate = (timestamp: number) => {
      if (!mountedRef.current) return; // Law 18: no setState after unmount
      // Throttle to 30fps
      if (timestamp - lastFrame >= FRAME_INTERVAL) {
        lastFrame = timestamp;
        timeRef.current += 1 / 30;
        setPathD(generateBlobPath(valenceRef.current, timeRef.current, radius, center, center));
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [radius, center]);

  // Update static shape when valence changes and animations are off
  useEffect(() => {
    if (!shouldAnimate()) {
      setPathD(generateBlobPath(valence, 0, radius, center, center));
    }
  }, [valence, radius, center]);

  const fillColor = valenceToColor(valence, 0.85);
  const glowColor = valenceToColor(valence, 0.3);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Glow layer behind blob */}
      <div
        className="absolute inset-0 rounded-full blur-2xl motion-safe:animate-som-blob-breathe"
        style={{ backgroundColor: glowColor }}
        aria-hidden="true"
      />

      {/* Main blob SVG */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="relative w-full h-full motion-safe:animate-som-blob-breathe"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={gradientId} cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor={valenceToColor(valence, 0.95)} />
            <stop offset="100%" stopColor={fillColor} />
          </radialGradient>
        </defs>
        <path
          d={pathD}
          fill={`url(#${gradientId})`}
          className="transition-[fill] duration-300 ease-out"
        />
      </svg>
    </div>
  );
}
