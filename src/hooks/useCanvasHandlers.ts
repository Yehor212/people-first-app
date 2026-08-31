/**
 * useCanvasHandlers — Canvas goal CRUD + mode switching callbacks.
 *
 * Follows the same extraction pattern as useMoodHandlers / useHabitHandlers.
 * Pure functions from canvasGoals.ts handle the data transforms;
 * this hook wires them to Zustand stores (userDataStore + uiStore).
 */

import { useCallback, useRef } from 'react';
import { useUserDataStore, useUIStore } from '@/stores';
import {
  createGoal,
  toggleGoalCompletion,
  deleteGoal,
  updateGoalIcon,
  updateGoalEmoji,
  updateGoalColor,
} from '@/lib/canvasGoals';
import { generateUuid, getToday } from '@/lib/utils';
import type { MindMapCanvasRef } from '@/components/canvas/MindMapCanvas';
import type { MoodType } from '@/types';

interface UseCanvasHandlersParams {
  handleAddMood: (entry: import('@/types').MoodEntry) => void;
}

export function useCanvasHandlers({ handleAddMood }: UseCanvasHandlersParams) {
  const canvasGoals = useUserDataStore(s => s.canvasGoals);
  const setCanvasGoals = useUserDataStore(s => s.setCanvasGoals);
  const canvasMode = useUIStore(s => s.canvasMode);
  const setCanvasMode = useUIStore(s => s.setCanvasMode);
  const canvasRef = useRef<MindMapCanvasRef>(null);

  // ── Mode switching ──

  const onRootTap = useCallback(() => {
    setCanvasMode(canvasMode === 'idle' ? 'split' : 'idle');
  }, [canvasMode, setCanvasMode]);

  const onCanvasBackgroundTap = useCallback(() => {
    setCanvasMode('idle');
  }, [setCanvasMode]);

  const onEmotionSelect = useCallback(() => {
    setCanvasMode('emotion-flow');
  }, [setCanvasMode]);

  const onGoalSelect = useCallback(() => {
    setCanvasMode('goal-flow');
  }, [setCanvasMode]);

  const onEmotionCancel = useCallback(() => {
    setCanvasMode('idle');
  }, [setCanvasMode]);

  const onGoalCancel = useCallback(() => {
    setCanvasMode('idle');
  }, [setCanvasMode]);

  // ── Emotion save (delegates to mood handler, then resets mode) ──

  const onEmotionSave = useCallback((mood: MoodType, text?: string) => {
    const entry = {
      id: generateUuid(),
      mood,
      date: getToday(),
      timestamp: Date.now(),
      ...(text ? { note: text } : {}),
    };
    handleAddMood(entry);
    setCanvasMode('idle');
  }, [handleAddMood, setCanvasMode]);

  // ── Goal CRUD ──

  const onGoalCreate = useCallback((title: string, parentId: string | null, icon?: string) => {
    setCanvasGoals(prev => [...prev, createGoal(title, parentId, prev, icon)]);
    setCanvasMode('idle');
  }, [setCanvasGoals, setCanvasMode]);

  const onGoalToggle = useCallback((goalId: string) => {
    setCanvasGoals(prev => toggleGoalCompletion(goalId, prev));
  }, [setCanvasGoals]);

  const onGoalDelete = useCallback((goalId: string) => {
    setCanvasGoals(prev => deleteGoal(goalId, prev));
  }, [setCanvasGoals]);

  const onGoalUpdateIcon = useCallback((goalId: string, icon: string | undefined) => {
    setCanvasGoals(prev => updateGoalIcon(goalId, icon, prev));
  }, [setCanvasGoals]);

  const onGoalUpdateEmoji = useCallback((goalId: string, emoji: string | undefined) => {
    setCanvasGoals(prev => updateGoalEmoji(goalId, emoji, prev));
  }, [setCanvasGoals]);

  const onGoalUpdateColor = useCallback((goalId: string, color: string | undefined) => {
    setCanvasGoals(prev => updateGoalColor(goalId, color, prev));
  }, [setCanvasGoals]);

  return {
    canvasGoals, canvasMode, canvasRef,
    onRootTap, onCanvasBackgroundTap,
    onEmotionSelect, onGoalSelect,
    onEmotionSave, onEmotionCancel,
    onGoalCreate, onGoalToggle, onGoalDelete,
    onGoalUpdateIcon, onGoalUpdateEmoji, onGoalUpdateColor,
    onGoalCancel,
  };
}
