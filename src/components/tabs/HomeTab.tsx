import { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { PullToRefresh } from "@/components/PullToRefresh";
import { InstallBanner } from "@/components/InstallBanner";
import { SessionExpiredBanner } from "@/components/SessionExpiredBanner";
import { DayProgressIndicator } from "@/components/OnboardingOverlay";
import { RestModeCard } from "@/components/RestModeCard";
import { AllCompleteCelebration } from "@/components/AllCompleteCelebration";
import { ReflectionInsightShelf } from "@/components/reflection/ReflectionInsightShelf";
import { ReflectionPromptCard } from "@/components/ReflectionPromptCard";
import { StateOfMindModal } from "@/components/state-of-mind/StateOfMindModal";
import { V2PreviewPortal } from "@/components/tabs/PreviewPortal";
import { BentoGrid, BentoCard } from "@/components/layout/BentoGrid";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, useUserDataStore, getModalToggle } from "@/stores";
import { useReflectionPrompts } from "@/hooks/useReflectionPrompts";
import { useReflectionStudio } from "@/hooks/useReflectionStudio";
import { motionPresets, zenTap } from "@/lib/animationUtils";
import { plural } from "@/lib/plural";
import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { getToday } from "@/lib/utils";
import type { MoodEntry } from "@/types";

const setShowChallenges = getModalToggle("showChallenges");
const setShowAddEvent = getModalToggle("showAddEvent");
const setShowQuestsPanel = getModalToggle("showQuestsPanel");

interface HomeTabProps {
  // Inner World
  currentActiveStreak: number;
  isRestMode: boolean;
  activateRestMode: () => void;
  deactivateRestMode: () => void;
  canActivateRestMode: boolean;

  // Derived values
  completedTodayCount: number;
  currentPrimaryCTA: "mood" | "habits" | "focus" | "complete";

  // Handlers
  handleAddMood: (entry: MoodEntry) => void;
  handlePullToRefresh: () => Promise<void>;

  // Refs
  moodRef: React.RefObject<HTMLDivElement>;
}

export const HomeTab = memo(function HomeTab({
  currentActiveStreak,
  isRestMode,
  activateRestMode: _activateRestMode,
  deactivateRestMode,
  canActivateRestMode: _canActivateRestMode,
  completedTodayCount: _completedTodayCount,
  currentPrimaryCTA,
  handleAddMood,
  handlePullToRefresh,
  moodRef,
}: HomeTabProps) {
  const { isFeatureVisible } = useFeatureFlags();
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  // User data — single subscription (was 6 individual)
  const { moods, habits, focusSessions, userName, googleAuthChecked, gratitudeEntries } =
    useUserDataStore(
      useShallow((s) => ({
        moods: s.moods,
        habits: s.habits,
        focusSessions: s.focusSessions,
        userName: s.userName,
        googleAuthChecked: s.googleAuthChecked,
        gratitudeEntries: s.gratitudeEntries,
      }))
    );

  // App store — single subscription (was 3 individual)
  const { hasValidSession, setActiveTab, setSettingsOpenSection } = useAppStore(
    useShallow((s) => ({
      hasValidSession: s.hasValidSession,
      setActiveTab: s.setActiveTab,
      setSettingsOpenSection: s.setSettingsOpenSection,
    }))
  );
  const [showStateOfMind, setShowStateOfMind] = useState(false);
  const { reflectionInsights, updateInsightStatus } = useReflectionStudio({
    excludeSuggestionSources: ["mood"],
  });

  // Contextual reflection prompts (IA Blueprint Phase 3)
  const reflectionPrompts = useReflectionPrompts(moods, habits, focusSessions, gratitudeEntries, t);

  // Today's latest mood for CTA preview color
  const todayMoods = useMemo(() => {
    const today = getToday();
    return moods.filter((m) => m.date === today);
  }, [moods]);
  const latestValence =
    todayMoods.length > 0 ? (todayMoods[todayMoods.length - 1].valence ?? 0) : 0;

  // State of Mind CTA block — replaces EmotionWheel
  const moodBlock = (
    <div ref={moodRef}>
      <motion.button
        {...motionPresets.slideUp}
        whileTap={zenTap.card}
        onClick={() => setShowStateOfMind(true)}
        aria-label={t.somLogFeeling}
        className="w-full rounded-2xl bg-card ring-1 ring-black/5 dark:ring-white/10 shadow-zen-card p-5 text-start"
      >
        <div className="flex items-center gap-4">
          <MiniValenceOrb valence={latestValence} hasEntry={todayMoods.length > 0} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-foreground">{t.somLogFeeling}</p>
            {todayMoods.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {plural(t, "somEntriesToday", todayMoods.length, language)}
              </p>
            )}
          </div>
        </div>
      </motion.button>
    </div>
  );

  return (
    <div className="motion-safe:animate-tab-enter">
      <PullToRefresh onRefresh={handlePullToRefresh}>
        <InstallBanner />
        <Header
          userName={userName}
          streak={currentActiveStreak}
          onOpenChallenges={
            isFeatureVisible("challenges") ? () => setShowChallenges(true) : undefined
          }
          onOpenEvents={() => setShowAddEvent(true)}
          onOpenQuests={isFeatureVisible("quests") ? () => setShowQuestsPanel(true) : undefined}
        />

        <V2PreviewPortal />

        {/* Session expired banner */}
        {hasValidSession === false && googleAuthChecked && userName !== "Friend" && (
          <SessionExpiredBanner
            onSignIn={() => {
              setSettingsOpenSection("account");
              setActiveTab("settings");
            }}
          />
        )}

        <BentoGrid>
          <BentoCard span="row">
            <DayProgressIndicator />
          </BentoCard>

          {/* Contextual reflection prompt (IA Blueprint Phase 3) */}
          {reflectionPrompts.length > 0 && !isRestMode && (
            <BentoCard span="2">
              <ReflectionPromptCard prompt={reflectionPrompts[0]} />
            </BentoCard>
          )}

          {reflectionInsights.length > 0 ? (
            <BentoCard span="2">
              <ReflectionInsightShelf
                tx={tx}
                insights={reflectionInsights}
                onUpdateStatus={updateInsightStatus}
                compact
              />
            </BentoCard>
          ) : null}

          {isRestMode ? (
            <BentoCard span="2">
              <RestModeCard streak={currentActiveStreak} onCancel={deactivateRestMode} />
            </BentoCard>
          ) : currentPrimaryCTA === "complete" ? (
            <BentoCard span="2">
              <AllCompleteCelebration streak={currentActiveStreak} />
            </BentoCard>
          ) : null}

          {/* Mood block — always accessible regardless of state */}
          <BentoCard span="2">{moodBlock}</BentoCard>
        </BentoGrid>
      </PullToRefresh>

      {/* State of Mind modal */}
      <StateOfMindModal
        isOpen={showStateOfMind}
        onClose={() => setShowStateOfMind(false)}
        onSave={handleAddMood}
      />
    </div>
  );
});
