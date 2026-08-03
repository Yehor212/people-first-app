/**
 * InsightsPanel - Main insights display component
 *
 * Shows personalized data-driven insights about user patterns
 * Collapsible design to avoid overwhelming the user
 */

import { useState, useMemo, useEffect, useId } from "react";
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
  const helpId = useId();

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
        t.insightHabitImprovesMood || "{habit} appears with higher recorded mood",
      habitImprovesMoodDesc:
        t.insightHabitImprovesMoodDesc ||
        'Across {sampleDays} recorded days with "{habit}", average mood was {avgMoodWith}/5, compared with {avgMoodWithout}/5 across {comparisonDays} other recorded days. This is an association, not proof that the habit caused the change.',
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
      tagBoostsMood:
        t.insightTagBoostsMood || '"{tag}" appears with higher recorded mood',
      tagBoostsMoodDesc:
        t.insightTagBoostsMoodDesc ||
        'Across {occurrences} recorded entries tagged "{tag}", average mood was {avgMoodWith}/5, compared with {avgMoodWithout}/5 across {untaggedEntries} untagged entries. This is an association, not proof that the tag caused the change.',
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

  const displayInsights = useMemo(
    () => (compact ? insights.slice(0, 3) : insights),
    [compact, insights],
  );
  const hasMore = insights.length > 3 && compact;

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
                      className={`h-full rounded-full motion-safe:transition-all motion-safe:duration-500 ${current >= target ? "bg-green-500" : "bg-primary/60"}`}
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

  return (
    <div className="bg-card rounded-2xl zen-shadow-card border border-border overflow-hidden">
      {/* Header - Full width clickable when collapsible */}
      {collapsible ? (
        <button
          onClick={toggleCollapsed}
          className={`w-full p-4 bg-gradient-to-r from-primary/10 to-primary/5 ${!isCollapsed ? "border-b border-border" : ""} motion-safe:transition-colors hover:from-primary/15 hover:to-primary/10 active:from-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? t.insightsExpand || "Expand insights"
              : t.insightsCollapse || "Collapse insights"
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
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
                className={`w-5 h-5 motion-safe:transition-transform motion-safe:duration-200 ${isCollapsed ? "" : "rotate-180"}`} aria-hidden="true" />
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
              aria-controls={helpId}
              aria-label={t.insightsHelpTitle || "About Insights"}
              className="-m-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-muted-foreground hover:text-foreground motion-safe:transition-colors"
            >
              <Info className="w-5 h-5" aria-hidden="true" />
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
                aria-controls={helpId}
                className="-mx-2 flex min-h-[44px] min-w-[44px] items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground motion-safe:transition-colors"
              >
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.insightsHelpTitle || "About Insights"}</span>
              </button>
              {showHelp && (
                <div
                  id={helpId}
                  className="mt-2 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1"
                >
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
                      "Patterns are ordered using the amount of recorded data and the size of the observed difference."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Non-collapsible mode help text (shown when help button in header clicked) */}
          {!collapsible && showHelp && (
            <div className="px-4 pt-4">
              <div
                id={helpId}
                className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1"
              >
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
                    "Patterns are ordered using the amount of recorded data and the size of the observed difference."}
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
                  className="absolute top-2 end-2 p-1.5 rounded-lg bg-card/80 hover:bg-card text-muted-foreground hover:text-foreground motion-safe:transition-colors zen-shadow-sm opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus:opacity-100 active:opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                className="w-full py-3 flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 motion-safe:transition-colors font-medium"
              >
                {isExpanded ? (
                  <>
                    <span>{t.insightsShowLess || "Show less"}</span>
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <span>
                      {t.insightsShowMore ||
                        `Show ${insights.length - 3} more insights`}
                    </span>
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
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
                      className="absolute top-2 end-2 p-1.5 rounded-lg bg-card/80 hover:bg-card text-muted-foreground hover:text-foreground motion-safe:transition-colors zen-shadow-sm opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus:opacity-100 active:opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
