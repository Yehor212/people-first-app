import { Suspense } from 'react';
import { LazyErrorBoundary, ModalErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { PullToRefresh } from '@/components/PullToRefresh';
import { InstallBanner } from '@/components/InstallBanner';
import { SessionExpiredBanner } from '@/components/SessionExpiredBanner';
import { DayProgressIndicator } from '@/components/OnboardingOverlay';
import { StreakBanner } from '@/components/StreakBanner';
import { QuickStatsRow } from '@/components/ui/stat-card';
import { UrgencyAlert } from '@/components/UrgencyAlert';
import { RestModeCard } from '@/components/RestModeCard';
import { AllCompleteCelebration } from '@/components/AllCompleteCelebration';
import { SkeletonCard, SkeletonList } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useAppStore, useUIStore, useUserDataStore, getModalToggle } from '@/stores';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';

const EmotionWheel = lazyWithRetry(() => import('@/components/mindfulness/EmotionWheel').then(m => ({ default: m.EmotionWheel })), 'EmotionWheel');
const HabitTracker = lazyWithRetry(() => import('@/components/HabitTracker').then(m => ({ default: m.HabitTracker })), 'HabitTracker');
const GratitudeJournal = lazyWithRetry(() => import('@/components/GratitudeJournal').then(m => ({ default: m.GratitudeJournal })), 'GratitudeJournal');

const setShowChallenges = getModalToggle('showChallenges');
const setShowTasksPanel = getModalToggle('showTasksPanel');
const setShowQuestsPanel = getModalToggle('showQuestsPanel');

interface HomeTabProps {
  // Data arrays (safe-guarded)
  safeMoods: MoodEntry[];
  safeHabits: Habit[];
  safeFocusSessions: FocusSession[];
  safeGratitudeEntries: GratitudeEntry[];

  // Inner World
  restDays: string[];
  currentActiveStreak: number;
  isRestMode: boolean;
  activateRestMode: () => void;
  deactivateRestMode: () => void;
  canActivateRestMode: boolean;
  daysUntilRestAvailable: number;

  // Derived values
  completedTodayCount: number;
  habitsDueToday: Habit[];
  todayFocusMinutes: number;
  currentPrimaryCTA: 'mood' | 'habits' | 'focus' | 'gratitude' | 'complete';
  userLevel: number;

  // Handlers
  handleAddMood: (entry: MoodEntry) => void;
  handleToggleHabit: (habitId: string, date: string) => void;
  handleAdjustHabit: (habitId: string, date: string, delta: number) => void;
  handleAddHabit: (habit: Habit) => void;
  handleUpdateHabit: (habit: Habit) => void;
  handleDeleteHabit: (habitId: string) => void;
  handleAddGratitude: (entry: GratitudeEntry) => void;
  handleJournalPromptUsed: () => void;
  handleOpenChallenge: ((habit: Habit) => void) | undefined;
  handlePullToRefresh: () => Promise<void>;

  // Refs
  moodRef: React.RefObject<HTMLDivElement | null>;
  habitsRef: React.RefObject<HTMLDivElement | null>;
  gratitudeRef: React.RefObject<HTMLDivElement | null>;
}

export function HomeTab({
  safeMoods, safeHabits, safeFocusSessions, safeGratitudeEntries,
  restDays, currentActiveStreak, isRestMode, activateRestMode, deactivateRestMode,
  canActivateRestMode, daysUntilRestAvailable,
  completedTodayCount, habitsDueToday, todayFocusMinutes, currentPrimaryCTA, userLevel,
  handleAddMood, handleToggleHabit, handleAdjustHabit, handleAddHabit,
  handleUpdateHabit, handleDeleteHabit, handleAddGratitude, handleJournalPromptUsed,
  handleOpenChallenge, handlePullToRefresh,
  moodRef, habitsRef, gratitudeRef,
}: HomeTabProps) {
  const { t } = useLanguage();
  const { isFeatureVisible } = useFeatureFlags();
  const userName = useUserDataStore(s => s.userName);
  const hasValidSession = useAppStore(s => s.hasValidSession);
  const googleAuthChecked = useUserDataStore(s => s.googleAuthChecked);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setSettingsOpenSection = useAppStore(s => s.setSettingsOpenSection);
  const journalPromptText = useUIStore(s => s.journalPromptText);

  return (
    <div className="animate-tab-enter">
      <PullToRefresh onRefresh={handlePullToRefresh}>
        <InstallBanner />
        <Header
          userName={userName}
          onOpenChallenges={isFeatureVisible('challenges') ? () => setShowChallenges(true) : undefined}
          onOpenTasks={isFeatureVisible('tasks') ? () => setShowTasksPanel(true) : undefined}
          onOpenQuests={isFeatureVisible('quests') ? () => setShowQuestsPanel(true) : undefined}
        />

        {/* Session expired banner */}
        {hasValidSession === false && googleAuthChecked && userName !== 'Friend' && (
          <SessionExpiredBanner onSignIn={() => { setSettingsOpenSection('account'); setActiveTab('settings'); }} />
        )}

        <div className="space-y-3">
          <DayProgressIndicator />

          <StreakBanner
            moods={safeMoods}
            habits={safeHabits}
            focusSessions={safeFocusSessions}
            gratitudeEntries={safeGratitudeEntries}
            restDays={restDays}
            onRestMode={activateRestMode}
            isRestMode={isRestMode}
            canActivateRestMode={canActivateRestMode}
            daysUntilRestAvailable={daysUntilRestAvailable}
          />

          <QuickStatsRow
            habitsCompleted={completedTodayCount}
            habitsTotal={habitsDueToday.length}
            focusMinutes={isFeatureVisible('focusTimer') ? todayFocusMinutes : undefined}
            level={userLevel}
            labels={{
              habits: t.habits,
              focus: t.focus,
              level: t.level || 'Level',
            }}
          />

          <UrgencyAlert
            habits={habitsDueToday}
            currentStreak={currentActiveStreak}
            onHabitClick={() => {
              habitsRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {isRestMode ? (
            <RestModeCard
              streak={currentActiveStreak}
              onCancel={deactivateRestMode}
            />
          ) : currentPrimaryCTA === 'complete' ? (
            <AllCompleteCelebration streak={currentActiveStreak} />
          ) : (
            <>
              {/* Mood Tracker */}
              <div ref={moodRef}>
                <ModalErrorBoundary fallbackTitle="Mood Tracker Error" fallbackBody="Unable to load mood tracker. Try refreshing.">
                  <Suspense fallback={<SkeletonCard />}>
                    <EmotionWheel
                      entries={safeMoods}
                      onAddEntry={handleAddMood}
                    />
                  </Suspense>
                </ModalErrorBoundary>
              </div>

              {/* Habit Tracker */}
              <div ref={habitsRef}>
                <ModalErrorBoundary fallbackTitle="Habit Tracker Error" fallbackBody="Unable to load habit tracker. Try refreshing.">
                  <Suspense fallback={<SkeletonList />}>
                    <HabitTracker
                      habits={safeHabits}
                      onToggleHabit={handleToggleHabit}
                      onAdjustHabit={handleAdjustHabit}
                      onAddHabit={handleAddHabit}
                      onUpdateHabit={handleUpdateHabit}
                      onDeleteHabit={handleDeleteHabit}
                      onOpenChallenge={handleOpenChallenge}
                    />
                  </Suspense>
                </ModalErrorBoundary>
              </div>

              {/* Gratitude Journal */}
              {isFeatureVisible('gratitudeJournal') && (
                <div ref={gratitudeRef}>
                  <LazyErrorBoundary componentName="Gratitude Journal">
                    <Suspense fallback={<SkeletonCard />}>
                      <GratitudeJournal
                        entries={safeGratitudeEntries}
                        onAddEntry={handleAddGratitude}
                        initialText={journalPromptText}
                        onInitialTextUsed={handleJournalPromptUsed}
                      />
                    </Suspense>
                  </LazyErrorBoundary>
                </div>
              )}
            </>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
