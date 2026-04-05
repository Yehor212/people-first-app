import { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { PullToRefresh } from "@/components/PullToRefresh";
import { InstallBanner } from "@/components/InstallBanner";
import { SessionExpiredBanner } from "@/components/SessionExpiredBanner";
import { DayProgressIndicator } from "@/components/OnboardingOverlay";
import { TodayFocusCard } from "@/components/TodayFocusCard";
import { RestModeCard } from "@/components/RestModeCard";
import { AllCompleteCelebration } from "@/components/AllCompleteCelebration";
import { ReflectionPromptCard } from "@/components/ReflectionPromptCard";
import { GrowthRingsCanvas } from "@/components/GrowthRingsCanvas";
import { StateOfMindModal } from "@/components/state-of-mind/StateOfMindModal";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppStore, useUserDataStore, getModalToggle } from "@/stores";
import { useReflectionPrompts } from "@/hooks/useReflectionPrompts";
import { computeGrowthRings, getGrowthRingsSummary } from "@/lib/growthRings";
import { motionPresets, zenTap } from "@/lib/animationUtils";
import { plural } from "@/lib/plural";
import { valenceToColor } from "@/components/state-of-mind/colorUtils";
import { isHabitCompletedOnDate } from "@/lib/habits";
import { getToday } from "@/lib/utils";
import type { MoodEntry } from "@/types";

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
  moodRef: React.RefObject<HTMLDivElement | null>;
}

export const HomeTab = memo(function HomeTab({
  currentActiveStreak,
  isRestMode,
  activateRestMode,
  deactivateRestMode,
  canActivateRestMode,
  completedTodayCount,
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

  // Growth Rings — never-resetting growth visualization (IA Blueprint Phase 2.3)
  const growthData = useMemo(() => {
    const activeHabits = habits.filter((h) => !h.isArchived);
    const activeDates = activeHabits.flatMap((h) =>
      Object.keys(h.entries || {}).filter((d) => isHabitCompletedOnDate(h, d))
    );
    const uniqueActive = [...new Set(activeDates)];
    const earliest =
      moods.length > 0
        ? moods.reduce((min, m) => (m.date < min ? m.date : min), moods[0].date)
        : getToday();
    const data = computeGrowthRings(uniqueActive, [], earliest);
    const summary = getGrowthRingsSummary(data);
    return { rings: data.rings, ...summary };
  }, [habits, moods]);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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
          {/* Mini blob preview */}
          <div
            className="w-12 h-12 rounded-full motion-safe:animate-som-blob-breathe"
            style={{ backgroundColor: valenceToColor(latestValence, 0.6) }}
          />
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

          <TodayFocusCard
            currentPrimaryCTA={currentPrimaryCTA}
            onScrollToMood={() => scrollToRef(moodRef)}
            onNavigateToHabits={() => setActiveTab("mindmap")}
            onNavigateToFocus={() => setActiveTab("garden")}
            canActivateRestMode={canActivateRestMode}
            onRestMode={activateRestMode}
            completedTodayCount={completedTodayCount}
            isRestMode={isRestMode}
          />

          {/* Growth Rings — canvas tree ring visualization (IA Blueprint Phase 2.3) */}
          <motion.div
            {...motionPresets.slideUp}
            className="rounded-xl bg-card px-4 py-3 flex items-center gap-3"
          >
            <GrowthRingsCanvas rings={growthData.rings} size={80} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground">
                {plural(t, "growthRingsTotal", growthData.total, language)}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {growthData.restLast7 > 0
                  ? (t.growthWeekBalance || "Grew {active} days, rested {rest}. Balance.")
                      .replace("{active}", String(growthData.activeLast7))
                      .replace("{rest}", String(growthData.restLast7))
                  : growthData.activeLast7 === 7
                    ? t.growthWeekFull || "A full week of growth!"
                    : (t.growthWeekPartial || "{count} days of growth this week.").replace(
                        "{count}",
                        String(growthData.activeLast7)
                      )}
              </p>
            </div>
          </motion.div>

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
