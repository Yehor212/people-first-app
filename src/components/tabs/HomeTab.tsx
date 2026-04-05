import { memo, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { PullToRefresh } from "@/components/PullToRefresh";
import { InstallBanner } from "@/components/InstallBanner";
import { SessionExpiredBanner } from "@/components/SessionExpiredBanner";
import { DayProgressIndicator } from "@/components/OnboardingOverlay";
import { RestModeCard } from "@/components/RestModeCard";
import { AllCompleteCelebration } from "@/components/AllCompleteCelebration";
import { ReflectionPromptCard } from "@/components/ReflectionPromptCard";
import { StateOfMindModal } from "@/components/state-of-mind/StateOfMindModal";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppStore, useUserDataStore, getModalToggle } from "@/stores";
import { useReflectionPrompts } from "@/hooks/useReflectionPrompts";
import { motionPresets, zenTap } from "@/lib/animationUtils";
import { plural } from "@/lib/plural";
import { ValenceOrb } from "@/components/state-of-mind/ValenceOrb";
import { getToday } from "@/lib/utils";
import type { MoodEntry } from "@/types";

/** Miniature orb with idle oscillation — isolated to avoid HomeTab re-renders */
const MiniOrbPreview = memo(function MiniOrbPreview({
  valence,
  hasEntry,
}: {
  valence: number;
  hasEntry: boolean;
}) {
  // Oscillate valence gently when no mood entry exists yet
  const [oscillatedValence, setOscillatedValence] = useState(0);

  useEffect(() => {
    if (hasEntry) return; // stop oscillation once user picks a mood
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      // Sine wave: period ~6s (30 ticks × 200ms), range -0.4..+0.4
      setOscillatedValence(Math.sin(frame * 0.1) * 0.4);
    }, 200);
    return () => clearInterval(id);
  }, [hasEntry]);

  const displayValence = hasEntry ? valence : oscillatedValence;

  return (
    <div className="w-12 h-12 flex-shrink-0 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.4] w-[120px] h-[120px] brightness-75">
        <ValenceOrb valence={displayValence} size={120} />
      </div>
    </div>
  );
});

const setShowChallenges = getModalToggle("showChallenges");
const setShowTasksPanel = getModalToggle("showTasksPanel");
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
  const moods = useUserDataStore((s) => s.moods);
  const habits = useUserDataStore((s) => s.habits);
  const focusSessions = useUserDataStore((s) => s.focusSessions);
  const userName = useUserDataStore((s) => s.userName);
  const hasValidSession = useAppStore((s) => s.hasValidSession);
  const googleAuthChecked = useUserDataStore((s) => s.googleAuthChecked);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setSettingsOpenSection = useAppStore((s) => s.setSettingsOpenSection);
  const gratitudeEntries = useUserDataStore((s) => s.gratitudeEntries);
  const [showStateOfMind, setShowStateOfMind] = useState(false);

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
          <MiniOrbPreview valence={latestValence} hasEntry={todayMoods.length > 0} />
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
    <div className="animate-tab-enter">
      <PullToRefresh onRefresh={handlePullToRefresh}>
        <InstallBanner />
        <Header
          userName={userName}
          streak={currentActiveStreak}
          onOpenChallenges={
            isFeatureVisible("challenges") ? () => setShowChallenges(true) : undefined
          }
          onOpenTasks={isFeatureVisible("tasks") ? () => setShowTasksPanel(true) : undefined}
          onOpenQuests={isFeatureVisible("quests") ? () => setShowQuestsPanel(true) : undefined}
        />

        {/* Session expired banner */}
        {hasValidSession === false && googleAuthChecked && userName !== "Friend" && (
          <SessionExpiredBanner
            onSignIn={() => {
              setSettingsOpenSection("account");
              setActiveTab("settings");
            }}
          />
        )}

        <div className="space-y-5">
          <DayProgressIndicator />

          {/* Contextual reflection prompt (IA Blueprint Phase 3) */}
          {reflectionPrompts.length > 0 && !isRestMode && (
            <ReflectionPromptCard prompt={reflectionPrompts[0]} />
          )}

          {isRestMode ? (
            <RestModeCard streak={currentActiveStreak} onCancel={deactivateRestMode} />
          ) : currentPrimaryCTA === "complete" ? (
            <AllCompleteCelebration streak={currentActiveStreak} />
          ) : null}

          {/* Mood block — always accessible regardless of state */}
          {moodBlock}
        </div>
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
