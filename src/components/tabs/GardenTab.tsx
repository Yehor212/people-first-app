import { Suspense, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { LazyErrorBoundary, ModalErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { MoodInsights } from '@/components/MoodInsights';
import { SkeletonCard, SkeletonList } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useUIStore, useUserDataStore, useGamificationStore, getModalToggle } from '@/stores';
import { haptics } from '@/lib/haptics';
import { getCurrentGardenAtmosphere, getCompanionBehaviorForAtmosphere } from '@/lib/gardenAtmosphere';
import { motionPresets } from '@/lib/animationUtils';
import { PersonStanding, Flower2, Moon, Zap, Palette } from 'lucide-react';
import { GardenCanvas } from '@/components/GardenCanvas';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry, ScheduleEvent, InnerWorld } from '@/types';

const ScheduleTimeline = lazyWithRetry(() => import('@/components/ScheduleTimeline').then(m => ({ default: m.ScheduleTimeline })), 'ScheduleTimeline');
const JournalModule = lazyWithRetry(() => import('@/features/journal').then(m => ({ default: m.JournalModule })), 'JournalModule');
const BreathingExercise = lazyWithRetry(() => import('@/components/BreathingExercise').then(m => ({ default: m.BreathingExercise })), 'BreathingExercise');
const FocusTimer = lazyWithRetry(() => import('@/components/FocusTimer').then(m => ({ default: m.FocusTimer })), 'FocusTimer');

const setShowChallenges = getModalToggle('showChallenges');
const setShowTasksPanel = getModalToggle('showTasksPanel');
const setShowQuestsPanel = getModalToggle('showQuestsPanel');
const setShowFriendsPanel = getModalToggle('showFriendsPanel');

interface GardenTabProps {
  safeMoods: MoodEntry[];
  safeHabits: Habit[];
  safeFocusSessions: FocusSession[];
  safeGratitudeEntries: GratitudeEntry[];
  todayAllEvents: ScheduleEvent[];
  innerWorld: InnerWorld;
  handleAddScheduleEvent: (event: Omit<ScheduleEvent, 'id'>) => void;
  handleDeleteScheduleEvent: (id: string) => void;
  handleCompleteFocusSession: (session: FocusSession) => void;
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
}

export function GardenTab({
  safeMoods, safeHabits, safeFocusSessions, safeGratitudeEntries,
  todayAllEvents, innerWorld, handleAddScheduleEvent, handleDeleteScheduleEvent,
  handleCompleteFocusSession, earnTreats: _earnTreats,
}: GardenTabProps) {
  const { isFeatureVisible } = useFeatureFlags();
  const userName = useUserDataStore(s => s.userName);
  const setCurrentFocusMinutes = useUIStore(s => s.setCurrentFocusMinutes);
  const rewardUser = useGamificationStore(s => s.rewardUser);

  // Focus → Journal expansion: scroll journal into view (IA Blueprint Phase 3)
  const handleExpandToJournal = useCallback(() => {
    document.getElementById('journal-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Garden atmosphere from current schedule events (IA Blueprint Phase 4)
  const atmosphere = useMemo(
    () => getCurrentGardenAtmosphere(todayAllEvents),
    [todayAllEvents]
  );
  // Companion behavior derived from atmosphere — ready for companion UI component
  const _companionBehavior = useMemo(
    () => getCompanionBehaviorForAtmosphere(atmosphere),
    [atmosphere]
  );

  const atmosphereIcons: Record<string, { Icon: typeof PersonStanding; label: string; color: string }> = {
    focused: { Icon: PersonStanding, label: 'Focus mode — garden is quiet', color: 'text-blue-500' },
    social: { Icon: Flower2, label: 'Social time — garden is lively', color: 'text-pink-500' },
    restful: { Icon: Moon, label: 'Rest time — garden is peaceful', color: 'text-indigo-400' },
    energetic: { Icon: Zap, label: 'Active time — garden is energized', color: 'text-amber-500' },
    creative: { Icon: Palette, label: 'Creative time — garden is inspired', color: 'text-purple-500' },
  };

  return (
    <div className="animate-tab-enter">
      <div className="space-y-4">
        <Header
          userName={userName}
          onOpenChallenges={isFeatureVisible('challenges') ? () => setShowChallenges(true) : undefined}
          onOpenTasks={isFeatureVisible('tasks') ? () => setShowTasksPanel(true) : undefined}
          onOpenQuests={isFeatureVisible('quests') ? () => setShowQuestsPanel(true) : undefined}
          onOpenFriends={() => setShowFriendsPanel(true)}
        />

        {/* Garden World visualization (IA Blueprint Phase 5) */}
        <GardenCanvas world={innerWorld} atmosphere={atmosphere} />

        {/* Garden atmosphere indicator (IA Blueprint Phase 4) */}
        {atmosphere !== 'default' && atmosphereIcons[atmosphere] && (() => {
          const { Icon, label, color } = atmosphereIcons[atmosphere];
          return (
            <motion.div {...motionPresets.fadeIn} className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-4 py-2.5 flex items-center gap-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                {label}
              </span>
            </motion.div>
          );
        })()}

        {/* Schedule Timeline — min-h prevents CLS on lazy load */}
        <div className="min-h-[200px]">
        <LazyErrorBoundary componentName="Schedule Timeline">
          <Suspense fallback={<SkeletonList />}>
            <ScheduleTimeline
              events={todayAllEvents}
              onAddEvent={handleAddScheduleEvent}
              onDeleteEvent={handleDeleteScheduleEvent}
            />
          </Suspense>
        </LazyErrorBoundary>
        </div>

        {/* Diary — min-h prevents CLS */}
        <div id="journal-section" className="min-h-[160px]">
        <LazyErrorBoundary componentName="Journal">
          <Suspense fallback={<SkeletonCard />}>
            <JournalModule />
          </Suspense>
        </LazyErrorBoundary>
        </div>

        {/* Breathing Exercise */}
        {isFeatureVisible('breathingExercise') && (
          <div className="min-h-[100px]">
          <LazyErrorBoundary componentName="Breathing Exercise">
            <Suspense fallback={<SkeletonCard lines={1} />}>
              <BreathingExercise
                compact
                onComplete={(pattern) => {
                  rewardUser('breathing', {
                    treats: 5,
                    treatReason: `Breathing: ${pattern.name}`,
                    haptic: haptics.breathingComplete,
                  });
                }}
              />
            </Suspense>
          </LazyErrorBoundary>
          </div>
        )}

        {/* Focus Timer — min-h prevents CLS */}
        {isFeatureVisible('focusTimer') && (
          <div className="min-h-[200px]">
          <ModalErrorBoundary fallbackTitle="Focus Timer Error" fallbackBody="Unable to load focus timer. Try refreshing.">
            <Suspense fallback={<SkeletonCard />}>
              <FocusTimer
                sessions={safeFocusSessions}
                onCompleteSession={handleCompleteFocusSession}
                onMinuteUpdate={setCurrentFocusMinutes}
                isPrimaryCTA={true}
                onExpandToJournal={handleExpandToJournal}
              />
            </Suspense>
          </ModalErrorBoundary>
          </div>
        )}

        {/* Insights */}
        <LazyErrorBoundary componentName="Insights">
          <MoodInsights
            moods={safeMoods}
            habits={safeHabits}
            focusSessions={safeFocusSessions}
            gratitudeEntries={safeGratitudeEntries}
          />
        </LazyErrorBoundary>
      </div>
    </div>
  );
}
