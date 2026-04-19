import { useState, useEffect } from "react";
import { MoodType } from "@/types";
import { cn } from "@/lib/utils";
import { Heart, Sparkles } from "lucide-react";
import { AnimatedMoodEmoji } from "@/components/AnimatedMoodEmoji";
import { useLanguage } from "@/contexts/LanguageContext";

interface MoodDistributionProps {
  moodCounts: Record<MoodType, number>;
  totalMoods: number;
  title: string;
  allTags?: string[];
  selectedTag?: string;
  onTagChange?: (tag: string) => void;
  tagFilterLabel?: string;
  allTagsLabel?: string;
}

const moodConfig: Record<
  MoodType,
  { gradient: string; bgLight: string; emoji: string }
> = {
  great: {
    gradient: "from-emerald-400 to-teal-500",
    bgLight: "bg-emerald-500/20",
    emoji: "😄",
  },
  good: {
    gradient: "from-green-400 to-emerald-500",
    bgLight: "bg-green-500/20",
    emoji: "🙂",
  },
  okay: {
    gradient: "from-amber-400 to-yellow-500",
    bgLight: "bg-amber-500/20",
    emoji: "😐",
  },
  bad: {
    gradient: "from-orange-400 to-amber-500",
    bgLight: "bg-orange-500/20",
    emoji: "😔",
  },
  terrible: {
    gradient: "from-red-400 to-rose-500",
    bgLight: "bg-red-500/20",
    emoji: "😢",
  },
};

export function AnimatedMoodDistribution({
  moodCounts,
  totalMoods,
  title,
  allTags,
  selectedTag,
  onTagChange,
  tagFilterLabel,
  allTagsLabel,
}: MoodDistributionProps) {
  const { t } = useLanguage();
  const [animatedCounts, setAnimatedCounts] = useState<
    Record<MoodType, number>
  >({
    great: 0,
    good: 0,
    okay: 0,
    bad: 0,
    terrible: 0,
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setAnimatedCounts(moodCounts);
    }, 300);
    return () => clearTimeout(timer);
  }, [moodCounts]);

  const moods: MoodType[] = ["great", "good", "okay", "bad", "terrible"];

  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-6 zen-shadow-card overflow-hidden motion-safe:transition-all motion-safe:duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <div className="p-2.5 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl shadow-lg shadow-pink-500/20">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -top-1 -end-1 w-2 h-2 bg-pink-400 rounded-full motion-safe:animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-foreground flex-1">{title}</h3>
        {totalMoods > 0 && (
          <div className="px-3 py-1 bg-secondary rounded-full">
            <span className="text-sm font-medium text-muted-foreground">
              {totalMoods}
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
            className="w-full p-3 bg-secondary rounded-xl text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-safe:transition-all"
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

      {/* Mood Bars */}
      <div className="space-y-4">
        {moods.map((mood, index) => {
          const count = animatedCounts[mood] || 0;
          const percentage = totalMoods > 0 ? (count / totalMoods) * 100 : 0;
          const config = moodConfig[mood];

          return (
            <div
              key={mood}
              className="group motion-safe:animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-4">
                {/* Animated Emoji */}
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center motion-safe:transition-all motion-safe:duration-300",
                    config.bgLight,
                    "group-hover:scale-110 group-hover:shadow-lg",
                  )}
                >
                  <AnimatedMoodEmoji mood={mood} size="md" />
                </div>

                {/* Progress Bar Container */}
                <div className="flex-1">
                  <div className="h-4 bg-secondary/80 rounded-full overflow-hidden relative">
                    {/* Animated Fill */}
                    <div
                      className={cn(
                        "h-full rounded-full motion-safe:transition-all motion-safe:duration-1000 ease-out relative",
                        `bg-gradient-to-r ${config.gradient}`,
                      )}
                      style={{
                        width: `${percentage}%`,
                        transitionDelay: `${index * 150}ms`,
                      }}
                    >
                      {/* Shimmer Effect */}
                      {percentage > 0 && (
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute inset-0 motion-safe:animate-shimmer-slide">
                            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Percentage Label on Bar */}
                    {percentage > 15 && (
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white/90">
                        {Math.round(percentage)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Count */}
                <div
                  className={cn(
                    "min-w-[3rem] text-end motion-safe:transition-all motion-safe:duration-300",
                    "group-hover:scale-110",
                  )}
                >
                  <span
                    className={cn(
                      "text-lg font-bold bg-clip-text text-transparent",
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
      {totalMoods === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t.noMoodDataYet || "No mood data yet"}</p>
        </div>
      )}
    </div>
  );
}
