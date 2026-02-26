/**
 * DiaryCanvas — Decorative canvas layer (theme particles + radial vignette).
 * Renders as a fixed layer behind the editor. Never resizes for keyboard.
 * Z-depth parallax + scroll kinetic + touch repulsion.
 * Pauses rAF during typing (resumes 2s after last keystroke).
 */

import { useRef } from 'react';
import { useDiaryCanvas } from './useDiaryCanvas';
import type { DiaryThemeName, BackgroundIntensity } from './types';

interface DiaryCanvasProps {
  accentColor: string;
  isActive: boolean;
  theme?: DiaryThemeName;
  intensity?: BackgroundIntensity;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export function DiaryCanvas({ accentColor, isActive, theme = 'dark', intensity = 'full', scrollContainerRef }: DiaryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useDiaryCanvas(canvasRef, accentColor, isActive, theme, intensity, scrollContainerRef);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
