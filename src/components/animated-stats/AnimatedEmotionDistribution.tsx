import { useState, useEffect, useMemo } from "react";
import { PrimaryEmotion } from "@/types";
import { cn } from "@/lib/utils";
import { Heart, Sparkles } from "lucide-react";
import { AnimatedEmotionEmoji } from "@/components/AnimatedEmotionEmoji";
import { EMOTION_ORDER, getEmotionLabels } from "@/lib/emotionConstants";
import { useLanguage } from "@/contexts/LanguageContext";

interface EmotionDistributionProps {
  emotionCounts: Record<PrimaryEmotion, number>;
  totalEmotions: number;
  title: string;
  language: string;
  allTags?: string[];
  selectedTag?: string;
  onTagChange?: (tag: string) => void;
  tagFilterLabel?: string;
  allTagsLabel?: string;
}

const emotionConfig: Record<
  PrimaryEmotion,
  { gradient: string; bgLight: string }
> = {
  joy: {
    gradient: "from-yellow-400 to-amber-500",
    bgLight: "bg-yellow-500/20",
  },
  trust: {
    gradient: "from-green-400 to-emerald-500",
    bgLight: "bg-green-500/20",
  },
  fear: { gradient: "from-teal-400 to-cyan-500", bgLight: "bg-teal-500/20" },
  surprise: { gradient: "from-blue-400 to-sky-500", bgLight: "bg-blue-500/20" },
  sadness: {
    gradient: "from-indigo-400 to-blue-500",
    bgLight: "bg-indigo-500/20",
  },
  disgust: {
    gradient: "from-purple-400 to-violet-500",
    bgLight: "bg-purple-500/20",
  },
  anger: { gradient: "from-red-400 to-rose-500", bgLight: "bg-red-500/20" },
  anticipation: {
    gradient: "from-orange-400 to-amber-500",
    bgLight: "bg-orange-500/20",
  },
};

export function AnimatedEmotionDistribution({
  emotionCounts,
  totalEmotions,
  title,
  language,
  allTags,
  selectedTag,
  onTagChange,
  tagFilterLabel,
  allTagsLabel,
}: EmotionDistributionProps) {
  const { t } = useLanguage();
  const [animatedCounts, setAnimatedCounts] = useState<
    Record<PrimaryEmotion, number>
  >({
    joy: 0,
    trust: 0,
    fear: 0,
    surprise: 0,
    sadness: 0,
    disgust: 0,
    anger: 0,
    anticipation: 0,
  });
  const [isVisible, setIsVisible] = useState(false);

  const _emotionLabels = useMemo(() => getEmotionLabels(language), [language]);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setAnimatedCounts(emotionCounts);
    }, 300);
    return () => clearTimeout(timer);
  }, [emotionCounts]);

  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-6 zen-shadow-card overflow-hidden transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <div className="p-2.5 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl shadow-lg shadow-pink-500/20">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -top-1 -end-1 w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-foreground flex-1">{title}</h3>
        {totalEmotions > 0 && (
          <div className="px-3 py-1 bg-secondary rounded-full">
            <span className="text-sm font-medium text-muted-foreground">
              {totalEmotions}
            </span>
          </div>
        )}
      </div>

      {/* Tag Filter */}
      {allTags && allTags.length > 0 && onTagChange && (
        <div className="mb-5">
          <label className="text-sm text-muted-foreground mb-2 block">
            {tagFilterLabel}
          </label>
          <select
            value={selectedTag}
            onChange={(e) => onTagChange(e.target.value)}
            className="w-full p-3 bg-secondary rounded-xl text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
            aria-label={tagFilterLabel || "Filter by tag"}
          >
            <option value="all">{allTagsLabel}</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Emotion Bars - 8 emotions */}
      <div className="space-y-3">
        {EMOTION_ORDER.map((emotion, index) => {
          const count = animatedCounts[emotion] || 0;
          const percentage =
            totalEmotions > 0 ? (count / totalEmotions) * 100 : 0;
          const config = emotionConfig[emotion];

          return (
            <div
              key={emotion}
              className="group animate-fade-in"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-center gap-3">
                {/* Animated Emotion Emoji */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                    config.bgLight,
                    "group-hover:scale-110 group-hover:shadow-lg",
                  )}
                >
                  <AnimatedEmotionEmoji emotion={emotion} size="sm" />
                </div>

                {/* Progress Bar Container */}
                <div className="flex-1">
                  <div className="h-3.5 bg-secondary/80 rounded-full overflow-hidden relative">
                    {/* Animated Fill */}
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000 ease-out relative",
                        `bg-gradient-to-r ${config.gradient}`,
                      )}
                      style={{
                        width: `${percentage}%`,
                        transitionDelay: `${index * 100}ms`,
                      }}
                    >
                      {/* Shimmer Effect */}
                      {percentage > 0 && (
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute inset-0 animate-shimmer-slide">
                            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Percentage Label on Bar */}
                    {percentage > 20 && (
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white/90">
                        {Math.round(percentage)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Count */}
                <div
                  className={cn(
                    "min-w-[2.5rem] text-end transition-all duration-300",
                    "group-hover:scale-110",
                  )}
                >
                  <span
                    className={cn(
                      "text-base font-bold bg-clip-text text-transparent",
                      `bg-gradient-to-r ${config.gradient}`,
                    )}
                  >
                    {count}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {totalEmotions === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {t.noEmotionDataYet || "No emotion data yet"}
          </p>
        </div>
      )}
    </div>
  );
}
