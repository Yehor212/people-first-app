/**
 * DiaryCanvas — Decorative canvas layer (wavy borders + floating particles).
 * Renders as a fixed layer behind the editor. Never resizes for keyboard.
 * Pauses rAF during typing (resumes 2s after last keystroke).
 */

import { useRef } from 'react';
import { useDiaryCanvas } from './useDiaryCanvas';

interface DiaryCanvasProps {
  accentColor: string;
  isActive: boolean;
}

export function DiaryCanvas({ accentColor, isActive }: DiaryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useDiaryCanvas(canvasRef, accentColor, isActive);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
