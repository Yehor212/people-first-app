/**
 * GoalActionSheet — Mobile-safe BottomSheet replacement for GoalActionMenu.
 *
 * Features:
 * - Fixed position BottomSheet (rendered outside transform containers)
 * - Icon picker row for changing goal icon
 * - Large touch-friendly action rows: Add Subtask, Complete, Delete
 * - Backdrop blur + dismiss on tap / Escape / Android back
 * - AnimatePresence for slide-up / slide-down transitions
 */

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CheckCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { zenMotion } from '@/lib/animationUtils';
import { useModalA11y } from '@/hooks/useModalA11y';
import { GOAL_ICON_MAP } from './GoalInput';
import type { CanvasGoal } from '@/types';

const ICON_KEYS = Object.keys(GOAL_ICON_MAP);

interface GoalActionSheetProps {
  goal: CanvasGoal | null; // null = hidden
  /** True if goal has children — completion is derived, manual toggle blocked */
  isBranch: boolean;
  onAddSubtask: (parentId: string) => void;
  onToggleComplete: (goalId: string) => void;
  onDelete: (goalId: string) => void;
  onUpdateIcon: (goalId: string, icon: string | undefined) => void;
  onDismiss: () => void;
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-5 py-3.5',
        'text-sm font-medium transition-colors',
        disabled
          ? 'text-white/20 cursor-not-allowed'
          : destructive
            ? 'text-red-400 active:bg-red-400/10'
            : 'text-white/80 active:bg-white/5',
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );
}

export function GoalActionSheet({
  goal, isBranch,
  onAddSubtask, onToggleComplete, onDelete, onUpdateIcon,
  onDismiss,
}: GoalActionSheetProps) {
  const isVisible = goal !== null;

  const { modalProps } = useModalA11y(isVisible, onDismiss);

  const handleAddSubtask = useCallback(() => {
    if (!goal) return;
    void haptics.buttonPress();
    onAddSubtask(goal.id);
  }, [goal, onAddSubtask]);

  const handleToggleComplete = useCallback(() => {
    if (!goal) return;
    void haptics.buttonPress();
    onToggleComplete(goal.id);
  }, [goal, onToggleComplete]);

  const handleDelete = useCallback(() => {
    if (!goal) return;
    void haptics.buttonPress();
    onDelete(goal.id);
  }, [goal, onDelete]);

  const handleIconTap = useCallback((key: string) => {
    if (!goal) return;
    void haptics.light();
    // Toggle: if already selected, clear; otherwise set
    const newIcon = goal.icon === key ? undefined : key;
    onUpdateIcon(goal.id, newIcon);
  }, [goal, onUpdateIcon]);

  return (
    <AnimatePresence>
      {isVisible && goal && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onDismiss}
          />

          {/* Sheet */}
          <motion.div
            key="sheet-body"
            role="dialog"
            aria-modal="true"
            aria-label={`Goal: ${goal.title}`}
            className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-2xl overflow-hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={zenMotion.snappy}
            style={{
              background: 'rgba(15, 20, 30, 0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            {...modalProps}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-4" />

            {/* Goal title */}
            <div className="px-5 pb-3 text-white font-medium text-sm">
              {goal.title}
            </div>

            {/* Icon picker row */}
            <div className="flex items-center gap-2 px-5 pb-4">
              {ICON_KEYS.map(key => {
                const Icon = GOAL_ICON_MAP[key];
                const isSelected = goal.icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleIconTap(key)}
                    className={cn(
                      'p-2 rounded-lg transition-all',
                      isSelected
                        ? 'bg-white/15 ring-1 ring-white/30 text-white'
                        : 'text-white/30 active:text-white/60 active:bg-white/5',
                    )}
                    aria-label={`Icon: ${key}`}
                    aria-pressed={isSelected}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10 mx-5" />

            {/* Action rows */}
            <ActionRow
              icon={Plus}
              label="Add Subtask"
              onClick={handleAddSubtask}
            />
            <ActionRow
              icon={CheckCircle}
              label={goal.completed ? 'Mark Incomplete' : 'Mark Complete'}
              onClick={handleToggleComplete}
              disabled={isBranch}
            />
            <ActionRow
              icon={Trash2}
              label="Delete"
              onClick={handleDelete}
              destructive
            />

            {/* Bottom safe area spacer */}
            <div className="h-2" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
