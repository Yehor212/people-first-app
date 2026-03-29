/**
 * InsightsPanel - Main insights display component
 *
 * Shows personalized data-driven insights about user patterns
 * Collapsible design to avoid overwhelming the user
 */

import { useState, useMemo, useEffect } from "react";
import type { MoodEntry, Habit, FocusSession } from "@/types";
import { useInsights } from "@/hooks/useInsights";
import type { InsightTranslations } from "@/lib/insightsEngine";
import { InsightCard } from "./InsightCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Sparkles, ChevronDown, ChevronUp, X, Info } from "lucide-react";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";

interface InsightsPanelProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  compact?: boolean; // Show only top 3 insights
  collapsible?: boolean; // Allow collapsing to a minimal header
}

export function InsightsPanel({
  moods,
  habits,
  focusSessions,
  compact = false,
  collapsible = false,
}: InsightsPanelProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Collapsible state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (!collapsible) return false;
    const stored = storageGetRaw(SK.INSIGHTS_COLLAPSED);
    return stored === "true";
  });

  // Persist collapsed state
  useEffect(() => {
    if (collapsible) {
      storageSetRaw(SK.INSIGHTS_COLLAPSED, String(isCollapsed));
    }
  }, [isCollapsed, collapsible]);

  const toggleCollapsed = () => setIsCollapsed((prev) => !prev);

  // Build insight translations from current language context
  const insightTranslations = useMemo<InsightTranslations>(
    () => ({
      morning: t.insightMorning || "in the morning",
      afternoon: t.insightAfternoon || "in the afternoon",
      evening: t.insightEvening || "in the evening",
      habitImprovesMood:
        t.insightHabitImprovesMood || "{habit} improves your mood",
      habitImprovesMoodDesc:
        t.insightHabitImprovesMoodDesc ||
        'On days when you complete "{habit}", your mood is {percent}% better on average.',
      focusBestLabel:
        t.insightFocusBestLabel || 'You focus best on "{label}" tasks',
      focusBestLabelDesc:
        t.insightFocusBestLabelDesc ||
        'Your average focus time for "{label}" is {minutes} minutes, higher than other activities.',
      peakFocusTime:
        t.insightPeakFocusTime || "Your peak focus time is {timeOfDay}",
      peakFocusTimeDesc:
        t.insightPeakFocusTimeDesc ||
        "You achieve your best focus around {time}, with an average of {minutes} minutes.",
      bestTimeForHabit:
        t.insightBestTimeForHabit || "Best time for {habit}: {time}",
      bestTimeForHabitDesc:
        t.insightBestTimeForHabitDesc ||
        'You\'re {percent}% more likely to complete "{habit}" {time} compared to {worstTime} ({worstPercent}%).',
      tagBoostsMood: t.insightTagBoostsMood || '"{tag}" boosts your mood',
      tagBoostsMoodDesc:
        t.insightTagBoostsMoodDesc ||
        'Days tagged with "{tag}" show {percent}% better mood on average.',
    }),
    [t],
  );

  const {
    insights,
    topInsight: _topInsight,
    dismissInsight,
    hasEnoughData,
    visibleCount,
    totalGenerated,
  } = useInsights({
    moods,
    habits,
    focusSessions,
    autoRefresh: true,
    translations: insightTranslations,
  });

  // Don't show panel if no data
  if (!hasEnoughData) {
    return (
      <div className="bg-card rounded-2xl p-6 zen-shadow-card border border-border">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-lg mb-2">
              {t.insightsTitle || "Personal Insights"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.insightsNotEnoughData ||
                "Keep tracking your mood, habits, and focus for a week to unlock personalized insights about your patterns."}
            </p>
            <div className="mt-4 space-y-2.5">
              {[
                {
                  current: moods.length,
                  target: 7,
                  label: t.insightsMoodEntries || "mood entries",
                },
                {
                  current: habits.length,
                  target: 1,
                  label: t.insightsHabitCount || "habit",
                },
                {
                  current: focusSessions.length,
                  target: 3,
                  label: t.insightsFocusSessions || "focus sessions",
                },
              ].map(({ current, target, label }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{label}</span>
                    <span
                      className={
                        current >= target ? "text-green-500 font-medium" : ""
                      }
                    >
                      {Math.min(current, target)}/{target}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${current >= target ? "bg-green-500" : "bg-primary/60"}`}
                      style={{
                        width: `${Math.min((current / target) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No insights generated (data exists but no patterns found)
  if (visibleCount === 0) {
    return (
      <div className="bg-card rounded-2xl p-6 zen-shadow-card border border-border">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-lg mb-2">
              {t.insightsTitle || "Personal Insights"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.insightsNoPatterns ||
                "No strong patterns detected yet. Keep tracking consistently to discover what works best for you!"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const displayInsights = compact ? insights.slice(0, 3) : insights;
  const hasMore = insights.length > 3 && compact;

  return (
    <div className="bg-card rounded-2xl zen-shadow-card border border-border overflow-hidden">
      {/* Header - Full width clickable when collapsible */}
      {collapsible ? (
        <button
          onClick={toggleCollapsed}
          className={`w-full p-4 bg-gradient-to-r from-primary/10 to-primary/5 ${!isCollapsed ? "border-b border-border" : ""} transition-colors hover:from-primary/15 hover:to-primary/10 active:from-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? t.insightsExpand || "Expand insights"
              : t.insightsCollapse || "Collapse insights"
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-start">
                {t.insightsTitle || "Personal Insights"}
              </h3>
              {visibleCount > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                  {visibleCount}
                </span>
              )}
            </div>

            {/* Expand/collapse indicator */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">
                {isCollapsed ? t.expand || "Expand" : t.collapse || "Collapse"}
              </span>
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
              />
            </div>
          </div>
        </button>
      ) : (
        <div
          className={`p-4 bg-gradient-to-r from-primary/10 to-primary/5 ${!isCollapsed ? "border-b border-border" : ""}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">
                {t.insightsTitle || "Personal Insights"}
              </h3>
              {visibleCount > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                  {visibleCount}
                </span>
              )}
            </div>

            <button
              onClick={() => setShowHelp(!showHelp)}
              aria-expanded={showHelp}
              aria-label={t.insightsHelpTitle || "About Insights"}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 -m-2"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Insights List - Hidden when collapsed */}
      {!isCollapsed && (
        <>
          {/* Help button + Help text for collapsible mode */}
          {collapsible && (
            <div className="px-4 pt-4">
              <button
                onClick={() => setShowHelp(!showHelp)}
                aria-expanded={showHelp}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{t.insightsHelpTitle || "About Insights"}</span>
              </button>
              {showHelp && (
                <div className="mt-2 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1">
                  <p>
                    {t.insightsHelp1 ||
                      "Insights are generated from your personal data using statistical analysis."}
                  </p>
                  <p>
                    {t.insightsHelp2 ||
                      "All analysis happens locally on your device - your data never leaves."}
                  </p>
                  <p>
                    {t.insightsHelp3 ||
                      "Patterns with higher confidence are shown first."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Non-collapsible mode help text (shown when help button in header clicked) */}
          {!collapsible && showHelp && (
            <div className="px-4 pt-4">
              <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground mb-1">
                  {t.insightsHelpTitle || "About Insights"}
                </p>
                <p>
                  {t.insightsHelp1 ||
                    "Insights are generated from your personal data using statistical analysis."}
                </p>
                <p>
                  {t.insightsHelp2 ||
                    "All analysis happens locally on your device - your data never leaves."}
                </p>
                <p>
                  {t.insightsHelp3 ||
                    "Patterns with higher confidence are shown first."}
                </p>
              </div>
            </div>
          )}

          <div className="p-4 space-y-3">
            {displayInsights.map((insight, _index) => (
              <div key={insight.id} className="relative group">
                <InsightCard insight={insight} />

                {/* Dismiss button — touch-friendly visibility */}
                <button
                  onClick={() => dismissInsight(insight.id)}
                  className="absolute top-2 end-2 p-1.5 rounded-lg bg-card/80 hover:bg-card text-muted-foreground hover:text-foreground transition-colors zen-shadow-sm opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus:opacity-100 active:opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={t.insightsDismiss || "Dismiss"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Expand/Collapse for compact mode */}
            {compact && hasMore && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full py-3 flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
              >
                {isExpanded ? (
                  <>
                    <span>{t.insightsShowLess || "Show less"}</span>
                    <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>
                      {t.insightsShowMore ||
                        `Show ${insights.length - 3} more insights`}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {/* All insights expanded */}
            {compact && isExpanded && (
              <div className="space-y-3 pt-3 border-t border-border">
                {insights.slice(3).map((insight) => (
                  <div key={insight.id} className="relative group">
                    <InsightCard insight={insight} />
                    {/* Added touch-friendly visibility */}
                    <button
                      onClick={() => dismissInsight(insight.id)}
                      className="absolute top-2 end-2 p-1.5 rounded-lg bg-card/80 hover:bg-card text-muted-foreground hover:text-foreground transition-colors zen-shadow-sm opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus:opacity-100 active:opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label={t.insightsDismiss || "Dismiss"}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer stats */}
          {totalGenerated > visibleCount && (
            <div className="px-4 pb-4">
              <p className="text-xs text-muted-foreground text-center">
                {t.insightsDismissedCount ||
                  `${totalGenerated - visibleCount} insights dismissed`}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
