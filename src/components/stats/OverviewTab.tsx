/**
 * OverviewTab — Stats overview with ZenScore, quick actions, insights, galaxy
 * Pure component, 0 useState.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from "@/types";
import { Heart, Target, PlayCircle, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDecimal } from "@/lib/timeUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MoodInsights } from "@/types/statsTypes";
import { motionPresets } from "@/lib/animationUtils";
import { ZenScoreHub, EmotionGalaxy } from "@/components/stats";
import { WeeklyInsightsCard } from "@/components/WeeklyInsightsCard";
import { InsightsPanel } from "@/components/InsightsPanel";
import { hapticTap } from "@/lib/haptics";
import { computeIdentityClusters } from "@/lib/identityClusters";
import { IdentityIcon } from "@/components/IdentityIconPicker";
import type { RingType } from "@/components/stats";
import type { UseStatsPageDataReturn } from "./useStatsPageData";

interface OverviewTabProps {
  premiumStats: {
    moodScore: number;
    habitRate: number;
    focusScore: number;
    weeklyChange: number;
    weekScore: number;
  };
  stats: { currentStreak: number };
  ringWeeklyData: UseStatsPageDataReturn["ringWeeklyData"];
  emotionGalaxyData: UseStatsPageDataReturn["emotionGalaxyData"];
  todayMoods: MoodEntry[];
  canShowStory: boolean;
  moods: MoodEntry[];
  habits: Habit[];
  completedFocusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  restDays?: string[];
  moodInsights?: MoodInsights;
  onQuickAction?: (action: "logMood" | "startFocus") => void;
  onShowStory: () => void;
  onRingClick: (ringId: RingType) => void;
  t: Record<string, string>;
}

export function OverviewTab({
  premiumStats,
  stats,
  ringWeeklyData,
  emotionGalaxyData,
  todayMoods,
  canShowStory,
  moods,
  habits,
  completedFocusSessions,
  gratitudeEntries,
  restDays: _restDays = [],
  moodInsights,
  onQuickAction,
  onShowStory,
  onRingClick,
  t,
}: OverviewTabProps) {
  const { language } = useLanguage();
  // Identity clusters — group habits by identity (IA Blueprint Phase 2)
  const identityClusters = useMemo(() => computeIdentityClusters(habits), [habits]);

  return (
    <>
      <ZenScoreHub
        moodScore={premiumStats.moodScore}
        habitRate={premiumStats.habitRate}
        focusScore={premiumStats.focusScore}
        streakDays={stats.currentStreak}
        weeklyChange={premiumStats.weeklyChange}
        weeklyData={{
          mood: ringWeeklyData.mood,
          habits: ringWeeklyData.habits,
          focus: ringWeeklyData.focus,
          streak: ringWeeklyData.mood.map((d, i) => ({
            date: d.date,
            value: Math.min(i + 1, stats.currentStreak),
          })),
        }}
        onRingClick={(ringId) => onRingClick(ringId)}
      />

      {/* Desktop: 2-col grid for actions + insights */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                void hapticTap();
                onQuickAction?.("logMood");
              }}
              className="flex flex-col items-center gap-1.5 p-3 bg-secondary/80 hover:bg-secondary rounded-xl motion-safe:transition-colors"
            >
              <Heart className="w-5 h-5 text-pink-500" />
              <span className="text-xs font-medium text-foreground truncate w-full text-center">
                {t.quickActionLogMood}
              </span>
            </button>
            <button
              onClick={() => {
                void hapticTap();
                onQuickAction?.("startFocus");
              }}
              className="flex flex-col items-center gap-1.5 p-3 bg-secondary/80 hover:bg-secondary rounded-xl motion-safe:transition-colors"
            >
              <Target className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-medium text-foreground truncate w-full text-center">
                {t.quickActionStartFocus}
              </span>
            </button>
            {canShowStory && (
              <button
                onClick={() => {
                  void hapticTap();
                  onShowStory();
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-secondary/80 hover:bg-secondary rounded-xl motion-safe:transition-colors"
              >
                <PlayCircle className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium text-foreground truncate w-full text-center">
                  {t.weeklyStory || "Weekly Story"}
                </span>
              </button>
            )}
          </div>

          {/* Identity Clusters — who you're becoming (IA Blueprint Phase 2) */}
          {identityClusters.length > 0 && (
            <motion.div {...motionPresets.slideUp} className="rounded-xl bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> {t.identityMap || "Who I Am"}
              </h3>
              <div className="space-y-2">
                {identityClusters.map((cluster) => (
                  <div key={cluster.name} className="flex items-center gap-3">
                    <IdentityIcon name={cluster.icon} className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground truncate">
                          {cluster.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {cluster.alignmentPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-primary rounded-full motion-safe:transition-all"
                          style={{ width: `${cluster.alignmentPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
        {/* end left column */}
        <div className="space-y-4">
          {/* Habit Impact — mood-habit correlation */}
          {moodInsights && moodInsights.habitDiffs.length > 0 && (
            <motion.div {...motionPresets.slideUp} className="rounded-xl bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" /> {t.habitImpact || "Habit Impact"}
              </h3>
              <div className="space-y-2">
                {moodInsights.habitDiffs.map(({ id, name, diff }) => (
                  <div key={id} className="flex items-center justify-between">
                    <span className="text-xs text-foreground truncate flex-1 min-w-0 me-2">
                      {name}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums flex-shrink-0",
                        diff > 0 ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatDecimal(diff, language)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t.habitImpactDesc || "How habits affect your mood"}
              </p>
            </motion.div>
          )}

          {/* Weekly Insights */}
          <WeeklyInsightsCard
            moods={moods}
            habits={habits}
            focusSessions={completedFocusSessions}
            gratitudeEntries={gratitudeEntries}
            onRecommendationAction={(_actionId) => {
              void hapticTap();
            }}
          />

          {/* Personal Insights */}
          <InsightsPanel moods={moods} habits={habits} focusSessions={completedFocusSessions} />
        </div>
        {/* end right column */}
      </div>
      {/* end 2-col grid */}

      {/* Emotion Galaxy - Today's snapshot */}
      {emotionGalaxyData.length > 0 && (
        <EmotionGalaxy
          emotions={emotionGalaxyData}
          totalEntries={todayMoods.length}
          className="mb-4"
        />
      )}
    </>
  );
}
