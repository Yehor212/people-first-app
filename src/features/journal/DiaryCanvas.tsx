/**
 * DiaryCanvas — Decorative canvas layer (wavy frame zones + theme particles).
 * Renders as a fixed layer behind the editor. Never resizes for keyboard.
 * Pauses rAF during typing (resumes 2s after last keystroke).
 */

import { useRef } from 'react';
import { useDiaryCanvas } from './useDiaryCanvas';
import type { DiaryThemeName } from './types';

interface DiaryCanvasProps {
  accentColor: string;
  isActive: boolean;
  theme?: DiaryThemeName;
}

export function DiaryCanvas({ accentColor, isActive, theme = 'dark' }: DiaryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useDiaryCanvas(canvasRef, accentColor, isActive, theme);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
