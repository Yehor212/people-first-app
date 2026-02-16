import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Task } from '@/lib/taskMomentum';
import type { Translations } from '@/i18n/translations';
import { getEventColor, EVENT_COLORS } from './constants';

// Task Focus Panel - detailed minute view for active tasks
export function TaskFocusPanel({ tasks, t }: { tasks: Task[]; t: Translations }) {
  const [now, setNow] = useState(Date.now());
  const initialTimeRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const incompleteTasks = tasks.filter(task => !task.completed);
  if (incompleteTasks.length === 0) return null;

  let currentTimestamp = initialTimeRef.current;
  const blocks: Array<{
    id: string;
    title: string;
    emoji: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    color: string;
    type: 'work' | 'break';
  }> = [];

  incompleteTasks.forEach(task => {
    const workStart = new Date(currentTimestamp);
    const workEnd = new Date(currentTimestamp + task.estimatedMinutes * 60000);

    blocks.push({
      id: `work-${task.id}`,
      title: task.name,
      emoji: '💼',
      startTime: workStart,
      endTime: workEnd,
      duration: task.estimatedMinutes,
      color: getEventColor('work', task.urgent),
      type: 'work',
    });

    currentTimestamp += task.estimatedMinutes * 60000;

    if (task.breakMinutes && task.breakMinutes > 0) {
      const breakStart = new Date(currentTimestamp);
      const breakEnd = new Date(currentTimestamp + task.breakMinutes * 60000);

      blocks.push({
        id: `break-${task.id}`,
        title: t.breakTime || 'Break',
        emoji: '☕',
        startTime: breakStart,
        endTime: breakEnd,
        duration: task.breakMinutes,
        color: EVENT_COLORS.break,
        type: 'break',
      });

      currentTimestamp += task.breakMinutes * 60000;
    }
  });

  const formatTime = (date: Date) =>
    `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  const totalMinutes = blocks.reduce((sum, b) => sum + b.duration, 0);

  const getBlockProgress = (block: typeof blocks[0], index: number): number => {
    if (index > 0) return 0;
    const elapsed = now - block.startTime.getTime();
    const total = block.duration * 60000;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  return (
    <motion.div
      className="mt-3 p-4 bg-secondary backdrop-blur-sm rounded-xl border border-border"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📋</span>
        <span className="text-sm font-medium text-slate-700 dark:text-white/90">
          {t.yourTasksNow || 'Your tasks now'}
        </span>
      </div>

      {/* Progress bar showing all blocks */}
      <div className="flex gap-1 h-12 rounded-xl overflow-hidden mb-2">
        {blocks.map((block, index) => {
          const progress = getBlockProgress(block, index);
          const isActive = index === 0;
          const remainingMinutes = Math.ceil(block.duration - (progress / 100 * block.duration));

          return (
            <motion.div
              key={block.id}
              className="relative flex items-center justify-center gap-1 text-white text-xs font-medium overflow-hidden rounded-lg"
              style={{
                backgroundColor: block.color,
                width: `${(block.duration / totalMinutes) * 100}%`,
                minWidth: '70px',
              }}
              whileHover={{ scale: 1.02 }}
            >
              {/* Progress overlay */}
              {isActive && progress > 0 && (
                <motion.div
                  className="absolute inset-y-0 left-0 bg-black/30"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1 }}
                />
              )}

              <span className="relative z-10">{block.emoji}</span>
              <span className="relative z-10 truncate">{block.title}</span>

              {isActive && progress > 0 && (
                <span className="absolute bottom-1 end-1 text-xs bg-black/40 px-1.5 py-0.5 rounded z-10">
                  {remainingMinutes} {t.min || 'min'}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Time labels */}
      <div className="flex gap-1">
        {blocks.map(block => (
          <div
            key={`time-${block.id}`}
            className="text-xs text-slate-500 dark:text-white/50 text-center"
            style={{ width: `${(block.duration / totalMinutes) * 100}%`, minWidth: '70px' }}
          >
            {formatTime(block.startTime)} — {formatTime(block.endTime)}
            <br />
            ({block.duration} {t.min || 'min'})
          </div>
        ))}
      </div>
    </motion.div>
  );
}
