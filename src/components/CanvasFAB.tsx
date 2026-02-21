/**
 * CanvasFAB — Bottom-right FAB cluster for the Mind Map Canvas.
 *
 * Primary FAB (emerald→cyan gradient) expands to Mood + Task quick actions.
 * Below it, a controls pill with recenter, zoom in, zoom out.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Heart, ListTodo, Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { zenMotion } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface CanvasFABProps {
  onLogMood: () => void;
  onAddTask: () => void;
  onRecenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function CanvasFAB({
  onLogMood, onAddTask,
  onRecenter, onZoomIn, onZoomOut,
}: CanvasFABProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    void haptics.light();
    setExpanded(prev => !prev);
  };

  const handleAction = (action: () => void) => {
    void haptics.buttonPress();
    setExpanded(false);
    action();
  };

  return (
    <div
      className="fixed z-40 flex flex-col items-center gap-3"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        right: '1rem',
      }}
    >
      {/* Expanded action buttons */}
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
              initial={{ opacity: 0, y: 8, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.8 }}
              transition={zenMotion.snappy}
              onClick={() => handleAction(onLogMood)}
              className={cn(
                'w-11 h-11 rounded-full',
                'bg-white/5 backdrop-blur-md',
                'border border-white/10',
                'flex items-center justify-center',
              )}
              aria-label={t.logMood || 'Log mood'}
            >
              <Heart className="w-5 h-5 text-rose-400" />
            </motion.button>

            {/* Task button */}
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.8 }}
              transition={{ ...zenMotion.snappy, delay: 0.05 }}
              onClick={() => handleAction(onAddTask)}
              className={cn(
                'w-11 h-11 rounded-full',
                'bg-white/5 backdrop-blur-md',
                'border border-white/10',
                'flex items-center justify-center',
              )}
              aria-label={t.addTask || 'Add task'}
            >
              <ListTodo className="w-5 h-5 text-violet-400" />
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Primary FAB */}
      <button
        onClick={toggle}
        className={cn(
          'w-14 h-14 rounded-full',
          'bg-gradient-to-br from-emerald-400 to-cyan-500',
          'flex items-center justify-center',
          'shadow-lg shadow-emerald-500/25',
          'transition-transform duration-200',
          expanded && 'rotate-45',
        )}
        aria-label={expanded ? (t.close || 'Close') : (t.quickActions || 'Quick actions')}
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Canvas controls pill */}
      <div className={cn(
        'flex flex-col items-center gap-1 py-1.5 px-1.5',
        'bg-white/5 backdrop-blur-md',
        'border border-white/10',
        'rounded-full',
      )}>
        <button
          onClick={() => { void haptics.buttonPress(); onRecenter(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Recenter"
        >
          <Crosshair className="w-4 h-4 text-white/50" />
        </button>
        <button
          onClick={() => { void haptics.buttonPress(); onZoomIn(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-white/50" />
        </button>
        <button
          onClick={() => { void haptics.buttonPress(); onZoomOut(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-white/50" />
        </button>
      </div>
    </div>
  );
}
