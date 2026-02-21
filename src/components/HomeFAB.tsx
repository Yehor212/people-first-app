/**
 * HomeFAB — Floating Action Button on Home tab.
 * Expands to show Mood and Task quick actions.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Heart, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { zenMotion } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface HomeFABProps {
  onLogMood: () => void;
  onAddTask: () => void;
}

export function HomeFAB({ onLogMood, onAddTask }: HomeFABProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    void haptics.light();
    setExpanded(prev => !prev);
  };

  const handleAction = (action: () => void) => {
    void haptics.selection();
    setExpanded(false);
    action();
  };

  return (
    <div className="fixed z-40" style={{ top: 'calc(var(--safe-top, 0px) + 4rem)', right: '1rem' }}>
      <AnimatePresence>
        {expanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[-1]"
              onClick={() => setExpanded(false)}
            />

            {/* Mood button */}
            <motion.button
              initial={{ opacity: 0, y: -8, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.8 }}
              transition={zenMotion.snappy}
              onClick={() => handleAction(onLogMood)}
              className={cn(
                'absolute top-14 right-0',
                'w-11 h-11 rounded-full',
                'bg-surface-glass backdrop-blur-[var(--surface-glass-blur)]',
                'border border-[var(--surface-glass-border)] zen-shadow-soft',
                'flex items-center justify-center',
              )}
              aria-label={t.logMood || 'Log mood'}
            >
              <Heart className="w-5 h-5 text-rose-500" />
            </motion.button>

            {/* Task button */}
            <motion.button
              initial={{ opacity: 0, y: -8, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.8 }}
              transition={{ ...zenMotion.snappy, delay: 0.05 }}
              onClick={() => handleAction(onAddTask)}
              className={cn(
                'absolute top-28 right-0',
                'w-11 h-11 rounded-full',
                'bg-surface-glass backdrop-blur-[var(--surface-glass-blur)]',
                'border border-[var(--surface-glass-border)] zen-shadow-soft',
                'flex items-center justify-center',
              )}
              aria-label={t.addTask || 'Add task'}
            >
              <ListTodo className="w-5 h-5 text-violet-500" />
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <button
        onClick={toggle}
        className={cn(
          'w-12 h-12 rounded-full',
          'bg-surface-glass backdrop-blur-[var(--surface-glass-blur)]',
          'border border-[var(--surface-glass-border)] zen-shadow-card',
          'flex items-center justify-center',
          'transition-transform duration-200',
          expanded && 'rotate-45',
        )}
        aria-label={expanded ? (t.close || 'Close') : (t.quickActions || 'Quick actions')}
      >
        <Plus className="w-6 h-6 text-foreground" />
      </button>
    </div>
  );
}
