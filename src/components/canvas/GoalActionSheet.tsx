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

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CheckCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { zenMotion } from '@/lib/animationUtils';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useLanguage } from '@/contexts/LanguageContext';
import { GOAL_ICON_MAP } from './GoalInput';
import { GOAL_COLORS } from './GoalNode';
import type { CanvasGoal } from '@/types';

const CURATED_EMOJIS = ['🎯', '📚', '💪', '🏃', '💡', '🎨', '🎵', '❤️', '⭐', '🔥', '🌱', '🧘'];
const COLOR_KEYS = Object.keys(GOAL_COLORS);

const ICON_KEYS = Object.keys(GOAL_ICON_MAP);

interface GoalActionSheetProps {
  goal: CanvasGoal | null; // null = hidden
  /** True if goal has children — completion is derived, manual toggle blocked */
  isBranch: boolean;
  onAddSubtask: (parentId: string) => void;
  onToggleComplete: (goalId: string) => void;
  onDelete: (goalId: string) => void;
  onUpdateIcon: (goalId: string, icon: string | undefined) => void;
  onUpdateEmoji: (goalId: string, emoji: string | undefined) => void;
  onUpdateColor: (goalId: string, color: string | undefined) => void;
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
        'w-full flex items-center gap-3 px-5 py-4',
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
  onUpdateEmoji, onUpdateColor,
  onDismiss,
}: GoalActionSheetProps) {
  const isVisible = goal !== null;
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset delete confirmation when switching to a different goal
  useEffect(() => { setShowDeleteConfirm(false); }, [goal?.id]);

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
    setShowDeleteConfirm(true);
  }, [goal]);

  const confirmDelete = useCallback(() => {
    if (!goal) return;
    onDelete(goal.id);
    setShowDeleteConfirm(false);
  }, [goal, onDelete]);

  const handleIconTap = useCallback((key: string) => {
    if (!goal) return;
    void haptics.light();
    // Toggle: if already selected, clear; otherwise set
    const newIcon = goal.icon === key ? undefined : key;
    onUpdateIcon(goal.id, newIcon);
  }, [goal, onUpdateIcon]);

  const handleEmojiTap = useCallback((emoji: string) => {
    if (!goal) return;
    void haptics.light();
    const newEmoji = goal.emoji === emoji ? undefined : emoji;
    onUpdateEmoji(goal.id, newEmoji);
  }, [goal, onUpdateEmoji]);

  const handleColorTap = useCallback((color: string) => {
    if (!goal) return;
    void haptics.light();
    const newColor = goal.color === color ? undefined : color;
    onUpdateColor(goal.id, newColor);
  }, [goal, onUpdateColor]);

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
            className="fixed bottom-0 inset-x-0 z-[60] rounded-t-2xl overflow-hidden"
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
                      'p-3 rounded-lg transition-all',
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

            {/* Emoji picker row */}
            <div className="flex items-center gap-2 px-5 pb-3 flex-wrap">
              {CURATED_EMOJIS.map(emoji => {
                const isSelected = goal.emoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiTap(emoji)}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center transition-all text-base',
                      isSelected
                        ? 'bg-white/15 ring-1 ring-white/30'
                        : 'active:bg-white/5',
                    )}
                    aria-label={`Emoji: ${emoji}`}
                    aria-pressed={isSelected}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* Color swatch row */}
            <div className="flex items-center gap-2 px-5 pb-4">
              {COLOR_KEYS.map(key => {
                const isSelected = goal.color === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleColorTap(key)}
                    className={cn(
                      'w-7 h-7 rounded-full transition-all flex-shrink-0',
                      isSelected
                        ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-[rgba(15,20,30,0.95)]'
                        : 'ring-1 ring-white/10',
                    )}
                    style={{ background: GOAL_COLORS[key] }}
                    aria-label={`Color: ${key}`}
                    aria-pressed={isSelected}
                  />
                );
              })}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10 mx-5" />

            {/* Action rows */}
            <ActionRow
              icon={Plus}
              label={ts.goalAddSubtask || 'Add Subtask'}
              onClick={handleAddSubtask}
            />
            <ActionRow
              icon={CheckCircle}
              label={goal.completed ? (ts.goalMarkIncomplete || 'Mark Incomplete') : (ts.goalMarkComplete || 'Mark Complete')}
              onClick={handleToggleComplete}
              disabled={isBranch}
            />
            {showDeleteConfirm ? (
              <div className="px-5 py-3 space-y-2">
                <p className="text-sm text-red-300">{ts.confirmDelete || 'Delete?'}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/80 text-sm font-medium min-h-[44px]"
                  >
                    {ts.cancel || 'Cancel'}
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium min-h-[44px]"
                  >
                    {ts.delete || 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <ActionRow
                icon={Trash2}
                label={ts.delete || 'Delete'}
                onClick={handleDelete}
                destructive
              />
            )}

            {/* Bottom safe area spacer */}
            <div className="h-2" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
