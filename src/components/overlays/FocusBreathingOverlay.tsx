import { Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { LazyErrorBoundary, ModalErrorBoundary } from '@/components/ErrorBoundary';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { zenMotion } from '@/lib/animationUtils';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import type { FocusSession } from '@/types';

const BreathingExercise = lazyWithRetry(
  () => import('@/components/BreathingExercise').then(m => ({ default: m.BreathingExercise })),
  'BreathingExercise',
);
const FocusTimer = lazyWithRetry(
  () => import('@/components/FocusTimer').then(m => ({ default: m.FocusTimer })),
  'FocusTimer',
);

interface FocusBreathingOverlayProps {
  open: boolean;
  focusSessions: FocusSession[];
  onCompleteFocusSession: (session: FocusSession) => void;
  onMinuteUpdate: (minutes: number | undefined) => void;
  onBreathingComplete: (pattern: { name: string }) => void;
  onClose: () => void;
}

export function FocusBreathingOverlay({
  open, focusSessions, onCompleteFocusSession,
  onMinuteUpdate, onBreathingComplete, onClose,
}: FocusBreathingOverlayProps) {
  const { t } = useLanguage();

  useBackHandler(open, onClose);
  useScrollLock(open);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={zenMotion.gentle}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={zenMotion.snappy}
            className="fixed bottom-0 left-0 right-0 z-[61] max-h-[80vh] rounded-t-[2rem] bg-card border-t border-border overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="text-lg font-semibold">{t.focus}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary"
                aria-label={t.close || 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 space-y-4 pb-4">
              {/* Focus Timer */}
              <ModalErrorBoundary fallbackTitle="Focus Timer Error" fallbackBody="Unable to load focus timer.">
                <Suspense fallback={<SkeletonCard />}>
                  <FocusTimer
                    sessions={focusSessions}
                    onCompleteSession={onCompleteFocusSession}
                    onMinuteUpdate={onMinuteUpdate}
                    isPrimaryCTA={false}
                  />
                </Suspense>
              </ModalErrorBoundary>

              {/* Breathing Exercise */}
              <LazyErrorBoundary componentName="Breathing Exercise">
                <Suspense fallback={<SkeletonCard lines={1} />}>
                  <BreathingExercise
                    compact
                    onComplete={onBreathingComplete}
                  />
                </Suspense>
              </LazyErrorBoundary>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
