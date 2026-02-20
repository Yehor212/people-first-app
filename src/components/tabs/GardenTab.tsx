import { Suspense, useCallback } from 'react';
import { LazyErrorBoundary, ModalErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { MoodInsights } from '@/components/MoodInsights';
import { SkeletonCard, SkeletonList } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useUIStore, useUserDataStore, useGamificationStore, getModalToggle } from '@/stores';
import { haptics } from '@/lib/haptics';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry, ScheduleEvent } from '@/types';

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
  handleAddScheduleEvent: (event: Omit<ScheduleEvent, 'id'>) => void;
  handleDeleteScheduleEvent: (id: string) => void;
  handleCompleteFocusSession: (session: FocusSession) => void;
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
}

export function GardenTab({
  safeMoods, safeHabits, safeFocusSessions, safeGratitudeEntries,
  todayAllEvents, handleAddScheduleEvent, handleDeleteScheduleEvent,
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
