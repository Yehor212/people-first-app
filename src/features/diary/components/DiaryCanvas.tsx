/**
 * DiaryCanvas — Decorative background canvas layer.
 *
 * Renders wavy borders + floating particles behind the editor.
 * Fixed positioning, NEVER resizes for keyboard.
 * All animation cleanup managed by useDiaryCanvas hook.
 */

import { useRef } from 'react';
import { useDiaryCanvas } from '../hooks/useDiaryCanvas';

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
