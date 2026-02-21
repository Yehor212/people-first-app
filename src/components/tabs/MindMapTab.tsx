import type { RefObject } from 'react';
import { MindMapCanvas } from '@/components/canvas/MindMapCanvas';
import type { MindMapCanvasRef } from '@/components/canvas/MindMapCanvas';
import type { MoodEntry, Habit } from '@/types';

interface MindMapTabProps {
  safeHabits: Habit[];
  safeMoods: MoodEntry[];
  handleToggleHabit: (habitId: string, date: string) => void;
  canvasRef: RefObject<MindMapCanvasRef | null>;
}

export function MindMapTab({
  safeHabits, safeMoods, handleToggleHabit, canvasRef,
}: MindMapTabProps) {
  const latestMood = safeMoods.length > 0 ? safeMoods[safeMoods.length - 1].mood : null;

  return (
    <MindMapCanvas
      ref={canvasRef}
      habits={safeHabits}
      latestMood={latestMood}
      onHabitToggle={handleToggleHabit}
    />
  );
}
