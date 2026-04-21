/**
 * Sub-components for WeeklyInsightsCard
 * Extracted from WeeklyInsightsCard.tsx for TD-20 decomposition
 */

import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Target,
  Brain,
  Heart,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/weeklyInsights";
import { hapticTap } from "@/lib/haptics";

// ============================================
// RECOMMENDATION CARD
// ============================================

export function RecommendationCard({
  recommendation,
  t,
  onAction,
  index = 0,
}: {
  recommendation: Recommendation;
  t: Record<string, string>;
  onAction?: (actionId: string) => void;
  index?: number;
}) {
  // Premium priority colors with glow effects
  const priorityStyles = {
    high: {
      base: "border-destructive/30 bg-destructive/5",
      hover:
        "hover:bg-destructive/10 hover:shadow-[0_4px_20px_-4px_hsl(var(--destructive)/0.3)]",
      glow: "from-destructive/10",
    },
    medium: {
      base: "border-[hsl(var(--mood-okay))]/30 bg-[hsl(var(--mood-okay))]/5",
      hover:
        "hover:bg-[hsl(var(--mood-okay))]/10 hover:shadow-[0_4px_20px_-4px_hsl(var(--mood-okay)/0.3)]",
      glow: "from-[hsl(var(--mood-okay))]/10",
    },
    low: {
      base: "border-[hsl(var(--mood-good))]/30 bg-[hsl(var(--mood-good))]/5",
      hover:
        "hover:bg-[hsl(var(--mood-good))]/10 hover:shadow-[0_4px_20px_-4px_hsl(var(--mood-good)/0.3)]",
      glow: "from-[hsl(var(--mood-good))]/10",
    },
  };

  const typeIcons = {
    habit: <Target className="w-4 h-4" />,
    mood: <Heart className="w-4 h-4" />,
    focus: <Brain className="w-4 h-4" />,
    general: <Lightbulb className="w-4 h-4" />,
  };

  const handleClick = () => {
    if (onAction) {
      void hapticTap();
      onAction(recommendation.id);
    }
  };

  const title = t[recommendation.titleKey] || recommendation.title;
  const actionLabel = recommendation.actionKey
    ? t[recommendation.actionKey] || recommendation.action
    : recommendation.action;
  const style = priorityStyles[recommendation.priority];

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
      whileHover={{ x: 4 }}
      onClick={handleClick}
      aria-label={title}
      className={cn(
        "relative w-full text-start p-3 rounded-xl border motion-safe:transition-all motion-safe:duration-200 overflow-hidden",
        "active:scale-[0.98]",
        style.base,
        style.hover,
        onAction && "cursor-pointer",
      )}
    >
      {/* Gradient overlay on hover */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r to-transparent opacity-0 hover:opacity-100 motion-safe:transition-opacity pointer-events-none",
          style.glow,
        )}
      />

      <div className="relative flex items-start gap-3">
        <div className="text-2xl flex-shrink-0" aria-hidden="true">
          {recommendation.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-muted-foreground" aria-hidden="true">
              {typeIcons[recommendation.type]}
            </span>
            <p className="font-medium text-sm text-foreground truncate">
              {title}
            </p>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {t[recommendation.descriptionKey] || recommendation.description}
          </p>
          {recommendation.action && (
            <p className="text-xs font-medium text-primary mt-2 flex items-center gap-1">
              <ChevronRight
                className="w-3 h-3 rtl:scale-x-[-1]"
                aria-hidden="true"
              />
              {actionLabel}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ============================================
// COMPARISON BADGE
// ============================================

export function ComparisonBadge({
  value,
  label,
  suffix = "%",
}: {
  value: number;
  label: string;
  suffix?: string;
}) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div className="text-center">
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
          isPositive &&
            "bg-[hsl(var(--mood-good))]/10 text-[hsl(var(--mood-good))]",
          value < 0 && "bg-destructive/10 text-destructive",
          isNeutral && "bg-muted text-muted-foreground",
        )}
      >
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : value < 0 ? (
          <TrendingDown className="w-3 h-3" />
        ) : (
          <Minus className="w-3 h-3" />
        )}
        <span>
          {isPositive && "+"}
          {value}
          {suffix}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
