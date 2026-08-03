/**
 * InsightCard - Individual insight display component
 *
 * Shows personalized insights with their recorded observation count
 * and expandable details.
 */

import { memo, useId, useState } from "react";
import type { Insight } from "@/types";
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  TrendingUp,
  Clock,
  Tag,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface InsightCardProps {
  insight: Insight;
}

export const InsightCard = memo(function InsightCard({
  insight,
}: InsightCardProps) {
  const { t, language, isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const titleId = useId();
  const detailsId = useId();

  // Icon based on insight type
  const getIcon = () => {
    switch (insight.type) {
      case "mood-habit-correlation":
        return <TrendingUp className="w-5 h-5" />;
      case "focus-pattern":
        return <Clock className="w-5 h-5" />;
      case "habit-timing":
        return <Clock className="w-5 h-5" />;
      case "mood-tag":
        return <Tag className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  // Color based on severity
  const getColors = () => {
    switch (insight.severity) {
      case "celebration":
        return {
          bg: "bg-green-50 dark:bg-green-900/20",
          border: "border-green-200 dark:border-green-800",
          text: "text-green-700 dark:text-green-300",
          icon: "text-green-600 dark:text-green-400",
        };
      case "tip":
        return {
          bg: "bg-blue-50 dark:bg-blue-900/20",
          border: "border-blue-200 dark:border-blue-800",
          text: "text-blue-700 dark:text-blue-300",
          icon: "text-blue-600 dark:text-blue-400",
        };
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-900/20",
          border: "border-amber-200 dark:border-amber-800",
          text: "text-amber-700 dark:text-amber-300",
          icon: "text-amber-600 dark:text-amber-400",
        };
      default:
        return {
          bg: "bg-gray-50 dark:bg-gray-900/20",
          border: "border-gray-200 dark:border-gray-800",
          text: "text-gray-700 dark:text-gray-300",
          icon: "text-gray-600 dark:text-gray-400",
        };
    }
  };

  const colors = getColors();
  const observationUnit =
    insight.metadata.type === "mood-habit-correlation"
      ? t.days || "recorded days"
      : insight.metadata.type === "focus-pattern"
        ? t.insightSessions || "sessions"
        : insight.metadata.type === "habit-timing"
          ? t.times || "times"
          : t.insightDataPoints || "recorded entries";
  const observationSummary = `${new Intl.NumberFormat(language).format(insight.dataPoints)} ${observationUnit}`;

  return (
    <div
      className={`rounded-2xl border-2 ${colors.border} ${colors.bg} overflow-hidden motion-safe:transition-all motion-safe:duration-300`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 hover:opacity-80 motion-safe:transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={isExpanded}
        aria-controls={detailsId}
      >
        <div className={`flex-shrink-0 ${colors.icon}`}>{getIcon()}</div>

        <div className="min-w-0 flex-1 text-start">
          <h3
            id={titleId}
            className={`mb-1 break-words font-semibold [overflow-wrap:anywhere] ${colors.text}`}
          >
            {insight.title}
          </h3>
          <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {insight.description}
          </p>
        </div>

        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* The ranking score is internal; only the real observation count is shown. */}
      <div className="px-4 pb-3">
        <span
          className="text-xs text-muted-foreground"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {observationSummary}
        </span>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          id={detailsId}
          role="region"
          aria-labelledby={titleId}
          className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700"
        >
          <div className="space-y-2 text-sm">
            {insight.metadata.type === "mood-habit-correlation" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.insightAvgMoodWith || "Avg mood with habit"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.avgMoodWith}/5
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.insightAvgMoodWithout || "Avg mood without"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.avgMoodWithout}/5
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.insightSampleDays || "Sample days"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.sampleDays} {t.days || "days"}
                  </span>
                </div>
              </>
            )}

            {insight.metadata.type === "focus-pattern" && (
              <>
                {insight.metadata.bestLabel && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t.insightBestActivity || "Best activity"}:
                    </span>
                    <span className="font-medium">
                      {insight.metadata.bestLabel}
                    </span>
                  </div>
                )}
                {insight.metadata.bestTime && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t.insightPeakTime || "Peak time"}:
                    </span>
                    <span className="font-medium">
                      {insight.metadata.bestTime}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.insightAvgDuration || "Avg duration"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.avgDuration} {t.min || "min"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.insightSessions || "Sessions"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.totalSessions}
                  </span>
                </div>
              </>
            )}

            {insight.metadata.type === "habit-timing" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.morning || "Morning"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.morningCount} {t.times || "times"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.afternoon || "Afternoon"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.afternoonCount} {t.times || "times"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.evening || "Evening"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.eveningCount} {t.times || "times"}
                  </span>
                </div>
              </>
            )}

            {insight.metadata.type === "mood-tag" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.insightTagOccurrences || "Tag occurrences"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.occurrences} {t.times || "times"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.insightMoodWithTag || "Mood with tag"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.avgMoodWith}/5
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.insightMoodWithoutTag || "Mood without tag"}:
                  </span>
                  <span className="font-medium">
                    {insight.metadata.avgMoodWithout}/5
                  </span>
                </div>
              </>
            )}

            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-muted-foreground italic">
                {t.insightDisclaimer ||
                  "This insight is based on your personal data. Patterns may vary over time."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
