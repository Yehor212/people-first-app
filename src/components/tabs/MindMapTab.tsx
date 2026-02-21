import type { RefObject } from 'react';
import { MindMapCanvas } from '@/components/canvas/MindMapCanvas';
import type { MindMapCanvasRef } from '@/components/canvas/MindMapCanvas';
import type { MoodEntry, MoodType, CanvasGoal } from '@/types';
import type { CanvasMode } from '@/stores/uiStore';

interface MindMapTabProps {
  safeMoods: MoodEntry[];
  canvasGoals: CanvasGoal[];
  canvasMode: CanvasMode;
  onRootTap: () => void;
  onCanvasBackgroundTap: () => void;
  onEmotionSelect: () => void;
  onGoalSelect: () => void;
  onEmotionSave: (mood: MoodType, text?: string) => void;
  onEmotionCancel: () => void;
  onGoalCreate: (title: string, parentId: string | null) => void;
  onGoalToggle: (goalId: string) => void;
  onGoalDelete: (goalId: string) => void;
  onGoalCancel: () => void;
  canvasRef: RefObject<MindMapCanvasRef | null>;
}

export function MindMapTab({
  safeMoods, canvasGoals, canvasMode,
  onRootTap, onCanvasBackgroundTap,
  onEmotionSelect, onGoalSelect,
  onEmotionSave, onEmotionCancel,
  onGoalCreate, onGoalToggle, onGoalDelete, onGoalCancel,
  canvasRef,
}: MindMapTabProps) {
  const latestMood = safeMoods.length > 0 ? safeMoods[safeMoods.length - 1].mood : null;

  return (
    <MindMapCanvas
      ref={canvasRef}
      latestMood={latestMood}
      canvasGoals={canvasGoals}
      canvasMode={canvasMode}
      onRootTap={onRootTap}
      onCanvasBackgroundTap={onCanvasBackgroundTap}
      onEmotionSelect={onEmotionSelect}
      onGoalSelect={onGoalSelect}
      onEmotionSave={onEmotionSave}
      onEmotionCancel={onEmotionCancel}
      onGoalCreate={onGoalCreate}
      onGoalToggle={onGoalToggle}
      onGoalDelete={onGoalDelete}
      onGoalCancel={onGoalCancel}
    />
  );
}
