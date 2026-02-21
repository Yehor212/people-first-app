/**
 * useCanvasCamera — Pan/zoom camera for SpatialCanvas.
 *
 * Single-finger pan + two-finger pinch zoom.
 * Edge zone guard (Fix 1): touches within 40px of screen edges
 * are ignored so EdgeHandle components receive them.
 *
 * Uses framer-motion useMotionValue for GPU-composited transforms.
 */

import { useRef, useCallback } from 'react';
import { useMotionValue } from 'framer-motion';
import { haptics } from '@/lib/haptics';

const EDGE_ZONE = 40; // px — touches here fall through to EdgeHandles

interface CameraOptions {
  minScale?: number; // default: 0.8 (60px node * 0.8 = 48dp)
  maxScale?: number; // default: 2.5
}

function getDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function useCanvasCamera(options?: CameraOptions) {
  const minScale = options?.minScale ?? 0.8;
  const maxScale = options?.maxScale ?? 2.5;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  // Gesture tracking refs (non-reactive)
  const panStartRef = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);
  const isPanningRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    // Fix 1: Edge zone guard — let edge touches fall through to Edge Handles
    if (touch.clientX < EDGE_ZONE || touch.clientX > window.innerWidth - EDGE_ZONE) return;

    if (e.touches.length === 1) {
      // Single finger → pan
      panStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        camX: x.get(),
        camY: y.get(),
      };
      isPanningRef.current = true;
    } else if (e.touches.length === 2) {
      // Two fingers → pinch
      isPanningRef.current = false;
      panStartRef.current = null;
      pinchStartRef.current = {
        dist: getDistance(e.touches[0], e.touches[1]),
        scale: scale.get(),
      };
    }

    e.stopPropagation();
  }, [x, y, scale]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanningRef.current && panStartRef.current) {
      const dx = e.touches[0].clientX - panStartRef.current.x;
      const dy = e.touches[0].clientY - panStartRef.current.y;
      x.set(panStartRef.current.camX + dx);
      y.set(panStartRef.current.camY + dy);
      e.stopPropagation();
    } else if (e.touches.length === 2 && pinchStartRef.current) {
      const currentDist = getDistance(e.touches[0], e.touches[1]);
      const ratio = currentDist / pinchStartRef.current.dist;
      let newScale = pinchStartRef.current.scale * ratio;

      // Clamp scale + haptic at bounds
      if (newScale <= minScale) {
        newScale = minScale;
        if (scale.get() > minScale) void haptics.light();
      } else if (newScale >= maxScale) {
        newScale = maxScale;
        if (scale.get() < maxScale) void haptics.light();
      }

      scale.set(newScale);
      e.stopPropagation();
    }
  }, [x, y, scale, minScale, maxScale]);

  const onTouchEnd = useCallback(() => {
    panStartRef.current = null;
    pinchStartRef.current = null;
    isPanningRef.current = false;
  }, []);

  // ── Mouse handlers (desktop web support) ──

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Edge zone guard — same as touch
    if (e.clientX < EDGE_ZONE || e.clientX > window.innerWidth - EDGE_ZONE) return;
    // Only left button
    if (e.button !== 0) return;

    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      camX: x.get(),
      camY: y.get(),
    };
    isPanningRef.current = true;
    e.stopPropagation();
  }, [x, y]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    x.set(panStartRef.current.camX + dx);
    y.set(panStartRef.current.camY + dy);
    e.stopPropagation();
  }, [x, y]);

  const onMouseUp = useCallback(() => {
    panStartRef.current = null;
    isPanningRef.current = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
    let newScale = scale.get() * zoomFactor;

    if (newScale <= minScale) {
      newScale = minScale;
      if (scale.get() > minScale) void haptics.light();
    } else if (newScale >= maxScale) {
      newScale = maxScale;
      if (scale.get() < maxScale) void haptics.light();
    }

    scale.set(newScale);
  }, [scale, minScale, maxScale]);

  const resetCamera = useCallback(() => {
    x.set(0);
    y.set(0);
    scale.set(1);
  }, [x, y, scale]);

  return {
    x,
    y,
    scale,
    handlers: {
      onTouchStart, onTouchMove, onTouchEnd,
      onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp,
      onWheel,
    },
    resetCamera,
  };
}
