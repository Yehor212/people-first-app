/**
 * SpatialCanvas — Infinite Canvas (Ecosystem of the Self).
 *
 * Camera layer with pan/zoom, atmosphere gradient background,
 * radial node layout (CentralOrb → Clusters → Habits),
 * SVG energy paths with completion pulse animation.
 */

import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn, getToday } from '@/lib/utils';
import { computeIdentityClusters } from '@/lib/identityClusters';
import { getCurrentSeason } from '@/lib/seasonHelper';
import { useCanvasCamera } from './useCanvasCamera';
import { computeCanvasLayout } from './canvasLayout';
import { CentralOrb } from './CentralOrb';
import { ClusterNode } from './ClusterNode';
import { HabitNode } from './HabitNode';
import { EnergyPaths } from './EnergyPaths';
import type { Habit, MoodType, Season } from '@/types';
import type { GardenAtmosphere } from '@/lib/gardenAtmosphere';

// ── Atmosphere → gradient classes (reused from GardenCanvas) ──

const SEASONAL_GRADIENTS: Record<Season, string> = {
  spring: 'from-emerald-50 to-green-100 dark:from-emerald-950/60 dark:to-green-950/40',
  summer: 'from-amber-50 to-yellow-100 dark:from-amber-950/60 dark:to-yellow-950/40',
  autumn: 'from-orange-50 to-amber-100 dark:from-orange-950/60 dark:to-amber-950/40',
  winter: 'from-sky-50 to-slate-100 dark:from-sky-950/60 dark:to-slate-950/40',
};

const ATMOSPHERE_GRADIENTS: Record<GardenAtmosphere, string> = {
  default: '',
  focused: 'from-slate-100 to-blue-50 dark:from-slate-900 dark:to-blue-950',
  restful: 'from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950',
  social: 'from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950',
  energetic: 'from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950',
  creative: 'from-violet-50 to-fuchsia-50 dark:from-violet-950 dark:to-fuchsia-950',
};

interface SpatialCanvasProps {
  habits: Habit[];
  latestMood: MoodType | null;
  atmosphere: GardenAtmosphere;
  onHabitToggle: (habitId: string, date: string) => void;
}

export function SpatialCanvas({ habits, latestMood, atmosphere, onHabitToggle }: SpatialCanvasProps) {
  const { x, y, scale, handlers } = useCanvasCamera();
  const [recentlyCompleted, setRecentlyCompleted] = useState<string[]>([]);

  const today = getToday();
  const season = getCurrentSeason();

  const gradientClass = atmosphere === 'default'
    ? SEASONAL_GRADIENTS[season]
    : ATMOSPHERE_GRADIENTS[atmosphere];

  const clusters = useMemo(() => computeIdentityClusters(habits), [habits]);
  const layout = useMemo(() => computeCanvasLayout(clusters, today), [clusters, today]);

  const handleHabitToggle = useCallback((habitId: string) => {
    onHabitToggle(habitId, today);
    // Add to recently completed for pulse animation
    const habit = habits.find(h => h.id === habitId);
    const wasCompleted = habit?.completedDates?.includes(today);
    if (!wasCompleted) {
      setRecentlyCompleted(prev => [...prev, habitId]);
    }
  }, [onHabitToggle, today, habits]);

  const handlePulseEnd = useCallback((habitId: string) => {
    setRecentlyCompleted(prev => prev.filter(id => id !== habitId));
  }, []);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-br',
        gradientClass,
        'min-h-[calc(100dvh-12rem)]',
      )}
      style={{ touchAction: 'none', willChange: 'transform' }}
      {...handlers}
    >
      {/* Camera layer — pans/zooms */}
      <motion.div
        className="absolute inset-0"
        style={{ x, y, scale }}
      >
        {/* SVG energy paths (behind nodes) */}
        <EnergyPaths
          layout={layout}
          latestMood={latestMood}
          recentlyCompleted={recentlyCompleted}
          onPulseEnd={handlePulseEnd}
        />

        {/* Habit nodes (behind clusters for z-order) */}
        {layout.clusters.flatMap(cluster =>
          cluster.habits.map(habit => (
            <HabitNode
              key={habit.id}
              habit={habit.habit}
              x={habit.x}
              y={habit.y}
              radius={habit.radius}
              completed={habit.completed}
              onToggle={() => handleHabitToggle(habit.habit.id)}
            />
          ))
        )}

        {/* Cluster nodes */}
        {layout.clusters.map(cluster => (
          <ClusterNode
            key={cluster.id}
            cluster={cluster.cluster}
            x={cluster.x}
            y={cluster.y}
            radius={cluster.radius}
          />
        ))}

        {/* Central Orb (on top) */}
        <CentralOrb latestMood={latestMood} />
      </motion.div>
    </div>
  );
}
