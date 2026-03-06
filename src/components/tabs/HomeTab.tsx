import { Suspense, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ModalErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { PullToRefresh } from '@/components/PullToRefresh';
import { InstallBanner } from '@/components/InstallBanner';
import { SessionExpiredBanner } from '@/components/SessionExpiredBanner';
import { DayProgressIndicator } from '@/components/OnboardingOverlay';
import { TodayFocusCard } from '@/components/TodayFocusCard';
import { RestModeCard } from '@/components/RestModeCard';
import { AllCompleteCelebration } from '@/components/AllCompleteCelebration';
import { SkeletonCard } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { TreePine } from 'lucide-react';
import { ReflectionPromptCard } from '@/components/ReflectionPromptCard';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useAppStore, useUserDataStore, getModalToggle } from '@/stores';
import { useReflectionPrompts } from '@/hooks/useReflectionPrompts';
import { computeGrowthRings, getGrowthRingsSummary } from '@/lib/growthRings';
import { motionPresets } from '@/lib/animationUtils';
import { getToday } from '@/lib/utils';
import type { MoodEntry, Habit, FocusSession } from '@/types';

const EmotionWheel = lazyWithRetry(() => import('@/components/mindfulness/EmotionWheel').then(m => ({ default: m.EmotionWheel })), 'EmotionWheel');

const setShowChallenges = getModalToggle('showChallenges');
const setShowTasksPanel = getModalToggle('showTasksPanel');
const setShowQuestsPanel = getModalToggle('showQuestsPanel');

interface HomeTabProps {
  // Data arrays
  safeMoods: MoodEntry[];
  safeHabits: Habit[];
  safeFocusSessions: FocusSession[];

  // Inner World
  currentActiveStreak: number;
  isRestMode: boolean;
  activateRestMode: () => void;
  deactivateRestMode: () => void;
  canActivateRestMode: boolean;

  // Derived values
  completedTodayCount: number;
  currentPrimaryCTA: 'mood' | 'habits' | 'focus' | 'complete';

  // Handlers
  handleAddMood: (entry: MoodEntry) => void;
  handlePullToRefresh: () => Promise<void>;

  // Refs
  moodRef: React.RefObject<HTMLDivElement | null>;
}

export function HomeTab({
  safeMoods, safeHabits, safeFocusSessions,
  currentActiveStreak, isRestMode, activateRestMode, deactivateRestMode,
  canActivateRestMode,
  completedTodayCount, currentPrimaryCTA,
  handleAddMood,
  handlePullToRefresh,
  moodRef,
}: HomeTabProps) {
  const { isFeatureVisible } = useFeatureFlags();
  const userName = useUserDataStore(s => s.userName);
  const hasValidSession = useAppStore(s => s.hasValidSession);
  const googleAuthChecked = useUserDataStore(s => s.googleAuthChecked);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setSettingsOpenSection = useAppStore(s => s.setSettingsOpenSection);
  const gratitudeEntries = useUserDataStore(s => s.gratitudeEntries);

  // Contextual reflection prompts (IA Blueprint Phase 3)
  const reflectionPrompts = useReflectionPrompts(safeMoods, safeHabits, safeFocusSessions, gratitudeEntries);

  // Growth Rings — never-resetting growth visualization (IA Blueprint Phase 2.3)
  const growthSummary = useMemo(() => {
    const activeDates = safeHabits.flatMap(h => Object.entries(h.entries || {}).filter(([, e]) => e.value === 2).map(([d]) => d));
    const uniqueActive = [...new Set(activeDates)];
    const earliest = safeMoods.length > 0
      ? safeMoods.reduce((min, m) => m.date < min ? m.date : min, safeMoods[0].date)
      : getToday();
    const data = computeGrowthRings(uniqueActive, [], earliest);
    return getGrowthRingsSummary(data);
  }, [safeHabits, safeMoods]);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Mood Tracker block — min-h prevents CLS when skeleton → component swap
  const moodBlock = (
    <div ref={moodRef} className="min-h-[200px]">
      <ModalErrorBoundary fallbackTitle="Mood Tracker Error" fallbackBody="Unable to load mood tracker. Try refreshing.">
        <Suspense fallback={<SkeletonCard />}>
          <EmotionWheel
            entries={safeMoods}
            onAddEntry={handleAddMood}
          />
        </Suspense>
      </ModalErrorBoundary>
    </div>
  );

  return (
    <div className="animate-tab-enter">
      <PullToRefresh onRefresh={handlePullToRefresh}>
        <InstallBanner />
        <Header
          userName={userName}
          streak={currentActiveStreak}
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

          <TodayFocusCard
            currentPrimaryCTA={currentPrimaryCTA}
            onScrollToMood={() => scrollToRef(moodRef)}
            onNavigateToHabits={() => setActiveTab('mindmap')}
            onNavigateToFocus={() => setActiveTab('garden')}
            canActivateRestMode={canActivateRestMode}
            onRestMode={activateRestMode}
            completedTodayCount={completedTodayCount}
            isRestMode={isRestMode}
          />

          {/* Growth Rings — permanent growth (IA Blueprint Phase 2.3) */}
          <motion.div
            {...motionPresets.slideUp}
            className="rounded-2xl bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)] zen-shadow-card px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <TreePine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-foreground">
                {growthSummary.totalRings}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{growthSummary.weekSummary}</span>
          </motion.div>

          {/* Contextual reflection prompt (IA Blueprint Phase 3) */}
          {reflectionPrompts.length > 0 && !isRestMode && (
            <ReflectionPromptCard prompt={reflectionPrompts[0]} />
          )}

          {isRestMode ? (
            <RestModeCard
              streak={currentActiveStreak}
              onCancel={deactivateRestMode}
            />
          ) : currentPrimaryCTA === 'complete' ? (
            <AllCompleteCelebration streak={currentActiveStreak} />
          ) : (
            <>
              {/* Primary content — order based on user preference */}
              {moodBlock}
            </>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
