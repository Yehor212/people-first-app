/**
 * DiaryCanvas — Decorative canvas layer (theme particles + radial vignette).
 * Renders as a fixed layer behind the editor. Never resizes for keyboard.
 * Z-depth parallax + scroll kinetic + touch repulsion.
 * Pauses rAF during typing (resumes 2s after last keystroke).
 */

import { useRef, memo } from 'react';
import { useDiaryCanvas } from './useDiaryCanvas';
import type { DiaryThemeName, BackgroundIntensity, ParticleSpeed } from './types';

interface DiaryCanvasProps {
  accentColor: string;
  isActive: boolean;
  theme?: DiaryThemeName;
  intensity?: BackgroundIntensity;
  particleSpeed?: ParticleSpeed;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  scope?: "viewport" | "container";
}

export const DiaryCanvas = memo(function DiaryCanvas({
  accentColor,
  isActive,
  theme = 'dark',
  intensity = 'full',
  particleSpeed = 'slow',
  scrollContainerRef,
  scope = 'viewport',
}: DiaryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useDiaryCanvas(canvasRef, accentColor, isActive, theme, intensity, particleSpeed, scrollContainerRef);

  return (
    <canvas
      ref={canvasRef}
      className={[
        "pointer-events-none",
        scope === "container" ? "absolute inset-0 h-full w-full" : "fixed inset-0",
        "z-0",
      ].join(" ")}
      aria-hidden="true"
    />
  );
});
