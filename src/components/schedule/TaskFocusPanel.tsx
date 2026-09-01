/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The bounded timeline region must receive focus for keyboard scrolling. */
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Task } from '@/lib/taskMomentum';
import type { Translations } from '@/i18n/translations';
import { getEventColor, EVENT_COLORS } from './constants';
import { formatScheduleNumber, formatScheduleTime } from './scheduleFormatting';

// Task Focus Panel - detailed minute view for active tasks
export function TaskFocusPanel({
  tasks,
  t,
  language,
}: {
  tasks: Task[];
  t: Translations;
  language: string;
}) {
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
    formatScheduleTime(language, date.getHours(), date.getMinutes());

  const getBlockProgress = (block: typeof blocks[0], index: number): number => {
    if (index > 0) return 0;
    const elapsed = now - block.startTime.getTime();
    const total = block.duration * 60000;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  return (
    <motion.div
      className="mt-3 rounded-xl border border-border bg-secondary p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="mb-3 flex items-start gap-2">
        <span aria-hidden="true" className="shrink-0 text-lg">📋</span>
        <span className="min-w-0 break-words text-sm font-medium text-foreground">
          {t.yourTasksNow || 'Your tasks now'}
        </span>
      </div>

      <div
        className="max-w-full overflow-x-auto overscroll-x-contain touch-pan-x pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        role="region"
        aria-label={t.yourTasksNow || 'Your tasks now'}
        tabIndex={0}
      >
        <div className="w-max min-w-full">
          {/* Progress bar showing all blocks */}
          <div className="mb-2 flex min-h-12 gap-1 rounded-xl">
            {blocks.map((block, index) => {
              const progress = getBlockProgress(block, index);
              const isActive = index === 0;
              const remainingMinutes = Math.ceil(
                block.duration - (progress / 100) * block.duration,
              );

              return (
                <motion.div
                  key={block.id}
                  className="relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-s-4 border-border bg-background px-2 py-2 text-center text-xs font-medium text-foreground"
                  style={{
                    borderInlineStartColor: block.color,
                    flexBasis: 0,
                    flexGrow: block.duration,
                    minWidth: 'calc(7rem * var(--font-scale, 1))',
                  }}
                >
                  {/* Progress overlay */}
                  {isActive && progress > 0 && (
                    <motion.div
                      className="absolute inset-y-0 left-0 right-0 origin-left rounded-lg bg-primary/10"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: progress / 100 }}
                      transition={{ duration: 1 }}
                    />
                  )}

                  <div className="relative z-10 flex min-w-0 items-start justify-center gap-1">
                    <span aria-hidden="true" className="shrink-0">{block.emoji}</span>
                    <bdi
                      dir="auto"
                      className={`min-w-0 leading-tight ${
                        block.type === 'work' ? '[overflow-wrap:anywhere]' : 'break-words'
                      }`}
                    >
                      {block.title}
                    </bdi>
                  </div>

                  {isActive && progress > 0 && (
                    <span className="relative z-10 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                      {formatScheduleNumber(language, remainingMinutes)} {t.min || 'min'}
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
                className="min-h-11 break-words px-1 py-1 text-center text-xs leading-relaxed text-muted-foreground"
                style={{
                  flexBasis: 0,
                  flexGrow: block.duration,
                  minWidth: 'calc(7rem * var(--font-scale, 1))',
                }}
              >
                {formatTime(block.startTime)} — {formatTime(block.endTime)}
                <br />
                ({formatScheduleNumber(language, block.duration)} {t.min || 'min'})
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
