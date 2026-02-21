/**
 * MindMapCanvas — Infinite 2D Mind Map with dark background.
 *
 * Uses framer-motion `drag` for pan, wheel + pinch for zoom.
 * Renders: CanvasEdges (SVG) → HabitPills → ClusterPills → RootNode.
 * Exposes imperative API (recenter, zoomIn, zoomOut) via ref.
 */

import {
  forwardRef, useCallback, useImperativeHandle,
  useMemo, useRef, useState,
} from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { computeIdentityClusters } from '@/lib/identityClusters';
import { getToday } from '@/lib/utils';
import { computeMindMapLayout } from './mindMapLayout';
import { CanvasEdges } from './CanvasEdges';
import { RootNode } from './RootNode';
import { ClusterPill } from './ClusterPill';
import { HabitPill } from './HabitPill';
import type { Habit, MoodType } from '@/types';

export interface MindMapCanvasRef {
  recenter: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface MindMapCanvasProps {
  habits: Habit[];
  latestMood: MoodType | null;
  onHabitToggle: (habitId: string, date: string) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

export const MindMapCanvas = forwardRef<MindMapCanvasRef, MindMapCanvasProps>(
  function MindMapCanvas({ habits, latestMood, onHabitToggle }, ref) {
    const today = getToday();
    const clusters = useMemo(() => computeIdentityClusters(habits), [habits]);
    const layout = useMemo(() => computeMindMapLayout(clusters, today), [clusters, today]);

    const [recentlyCompleted, setRecentlyCompleted] = useState<string[]>([]);
    const zoom = useMotionValue(1);

    // Drag reset key — incrementing forces framer-motion to reset drag position
    const [dragKey, setDragKey] = useState(0);

    const { width: cw, height: ch } = layout.canvasSize;
    const canvasCenter = useMemo(() => ({ x: cw / 2, y: ch / 2 }), [cw, ch]);

    // Daily completion ratio for progress ring
    const completionPercent = useMemo(() => {
      const total = habits.length;
      if (total === 0) return 0;
      const done = habits.filter(h => h.completedDates?.includes(today)).length;
      return done / total;
    }, [habits, today]);

    // ── Imperative API ──

    useImperativeHandle(ref, () => ({
      recenter: () => {
        setDragKey(k => k + 1); // Reset drag position
        zoom.set(1);
      },
      zoomIn: () => zoom.set(Math.min(MAX_ZOOM, zoom.get() * 1.2)),
      zoomOut: () => zoom.set(Math.max(MIN_ZOOM, zoom.get() / 1.2)),
    }), [zoom]);

    // ── Wheel zoom ──

    const handleWheel = useCallback((e: React.WheelEvent) => {
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.get() * factor)));
    }, [zoom]);

    // ── Pinch zoom (two-finger touch) ──

    const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = {
          dist: Math.sqrt(dx * dx + dy * dy),
          zoom: zoom.get(),
        };
      }
    }, [zoom]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ratio = dist / pinchRef.current.dist;
        const next = pinchRef.current.zoom * ratio;
        zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
      }
    }, [zoom]);

    const handleTouchEnd = useCallback(() => {
      pinchRef.current = null;
    }, []);

    // ── Habit toggle + pulse ──

    const handleHabitToggle = useCallback((habitId: string) => {
      onHabitToggle(habitId, today);
      const habit = habits.find(h => h.id === habitId);
      if (habit && !habit.completedDates?.includes(today)) {
        setRecentlyCompleted(prev => [...prev, habitId]);
      }
    }, [onHabitToggle, today, habits]);

    const handlePulseEnd = useCallback((habitId: string) => {
      setRecentlyCompleted(prev => prev.filter(id => id !== habitId));
    }, []);

    // ── Drag constraints ──

    const halfCw = cw / 2;
    const halfCh = ch / 2;

    return (
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ background: '#0D1117', touchAction: 'none' }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <motion.div
          key={dragKey}
          drag
          dragConstraints={{
            left: -halfCw,
            right: halfCw,
            top: -halfCh,
            bottom: halfCh,
          }}
          dragElastic={0.1}
          dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
          className="relative will-change-transform"
          style={{
            width: cw,
            height: ch,
            left: `calc(50% - ${halfCw}px)`,
            top: `calc(50% - ${halfCh}px)`,
            scale: zoom,
          }}
        >
          {/* SVG edges layer (behind nodes) */}
          <CanvasEdges
            layout={layout}
            canvasCenter={canvasCenter}
            latestMood={latestMood}
            recentlyCompleted={recentlyCompleted}
            onPulseEnd={handlePulseEnd}
          />

          {/* Habit pills (behind clusters for z-order) */}
          {layout.clusters.flatMap((cluster, ci) =>
            cluster.habits.map((habit, hi) => (
              <HabitPill
                key={habit.id}
                node={habit}
                canvasCenter={canvasCenter}
                onToggle={() => handleHabitToggle(habit.habit.id)}
                animDelay={ci * 80 + hi * 60 + 40}
              />
            )),
          )}

          {/* Cluster pills */}
          {layout.clusters.map((cluster, i) => (
            <ClusterPill
              key={cluster.id}
              node={cluster}
              canvasCenter={canvasCenter}
              index={i}
            />
          ))}

          {/* Root node (on top) */}
          <RootNode latestMood={latestMood} canvasCenter={canvasCenter} completionPercent={completionPercent} />
        </motion.div>
      </div>
    );
  },
);
