/**
 * GoalActionMenu — Inline popover shown when user taps a GoalNode.
 *
 * Three actions:
 * - Add Subtask (+)
 * - Toggle Complete (✓)
 * - Delete (Trash2)
 *
 * Uses --surface-glass styling. Positioned above the tapped node.
 * Escape / Android back / outside tap → dismiss.
 * STRICTLY lucide-react icons only.
 */

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CheckCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { zenMotion } from '@/lib/animationUtils';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { CanvasGoal } from '@/types';

interface GoalActionMenuProps {
  goal: CanvasGoal | null; // null = hidden
  /** True if goal has children — completion is derived, manual toggle blocked */
  isBranch: boolean;
  /** Absolute canvas position of the goal node center */
  anchorX: number;
  anchorY: number;
  onAddSubtask: (parentId: string) => void;
  onToggleComplete: (goalId: string) => void;
  onDelete: (goalId: string) => void;
  onDismiss: () => void;
}

const MENU_WIDTH = 160;

export function GoalActionMenu({
  goal, isBranch, anchorX, anchorY,
  onAddSubtask, onToggleComplete, onDelete,
  onDismiss,
}: GoalActionMenuProps) {
  const isVisible = goal !== null;

  const { modalProps } = useModalA11y(isVisible, onDismiss);

  const handleAddSubtask = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!goal) return;
    void haptics.buttonPress();
    onAddSubtask(goal.id);
  }, [goal, onAddSubtask]);

  const handleToggleComplete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!goal) return;
    void haptics.buttonPress();
    onToggleComplete(goal.id);
  }, [goal, onToggleComplete]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!goal) return;
    void haptics.buttonPress();
    onDelete(goal.id);
  }, [goal, onDelete]);

  return (
    <AnimatePresence>
      {isVisible && goal && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 5 }}
          transition={zenMotion.snappy}
          className="absolute z-40"
          style={{
            left: anchorX - MENU_WIDTH / 2,
            top: anchorY - 60,
            width: MENU_WIDTH,
          }}
          {...modalProps}
        >
          <div
            className={cn(
              'rounded-xl p-1.5',
              'border border-white/10',
              'shadow-zen-lg',
              'flex items-center gap-1',
            )}
            style={{
              background: 'var(--surface-glass)',
              backdropFilter: 'blur(var(--surface-glass-blur, 20px))',
              WebkitBackdropFilter: 'blur(var(--surface-glass-blur, 20px))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Add Subtask */}
            <button
              type="button"
              onClick={handleAddSubtask}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg',
                'text-white/70 hover:text-white hover:bg-white/10',
                'transition-colors text-xs',
              )}
              aria-label="Add subtask"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Toggle Complete — disabled for branch nodes (progress is derived) */}
            <button
              type="button"
              onClick={isBranch ? undefined : handleToggleComplete}
              disabled={isBranch}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg',
                'transition-colors text-xs',
                isBranch
                  ? 'text-white/20 cursor-not-allowed'
                  : goal.completed
                    ? 'text-emerald-400 hover:bg-emerald-400/10'
                    : 'text-white/70 hover:text-emerald-400 hover:bg-emerald-400/10',
              )}
              aria-label={isBranch ? 'Complete subtasks to progress' : goal.completed ? 'Mark incomplete' : 'Mark complete'}
              title={isBranch ? 'Complete subtasks to progress' : undefined}
            >
              <CheckCircle className="w-4 h-4" />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={handleDelete}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg',
                'text-white/70 hover:text-red-400 hover:bg-red-400/10',
                'transition-colors text-xs',
              )}
              aria-label="Delete goal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
