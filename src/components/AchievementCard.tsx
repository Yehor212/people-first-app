import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock } from "lucide-react";
import {
  Achievement,
  getBadgeColor,
  getBadgeGlow,
} from "@/lib/gamification";
import { getDecorationForAchievement } from "@/lib/achievementDecorations";
import { useLanguage } from "@/contexts/LanguageContext";

export interface AchievementCardProps {
  achievement: Achievement;
  isUnlocked: boolean;
  progress?: number;
  onClick: () => void;
  hiddenText: string;
  hiddenTitle: string;
}

export function AchievementCard({
  achievement,
  isUnlocked,
  progress,
  onClick,
  hiddenText,
  hiddenTitle,
}: AchievementCardProps) {
  const { t } = useLanguage();
  const hasProgress = progress !== undefined && achievement.total;
  const progressPercentage = hasProgress
    ? (progress / achievement.total) * 100
    : 0;

  return (
    <Card
      className={`p-4 cursor-pointer transition-all hover:scale-105 ${
        isUnlocked ? getBadgeGlow(achievement.rarity) : "opacity-60"
      }`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="text-center space-y-2 min-w-0">
        <div className={`text-4xl ${!isUnlocked && "grayscale blur-[1px]"}`}>
          {isUnlocked ? (
            achievement.icon
          ) : (
            <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-sm line-clamp-1">
            {isUnlocked ? achievement.name : hiddenTitle}
          </h4>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {isUnlocked ? achievement.description : hiddenText}
          </p>
        </div>

        {hasProgress && (
          <div className="pt-2">
            <Progress value={progressPercentage} className="h-1" />
            <p className="text-xs text-muted-foreground mt-1">
              {progress} / {achievement.total}
            </p>
          </div>
        )}

        {isUnlocked && (
          <Badge className={`${getBadgeColor(achievement.rarity)} text-xs`}>
            +{achievement.points} {t.xp || "XP"}
          </Badge>
        )}

        {isUnlocked &&
          (() => {
            const deco = getDecorationForAchievement(achievement.id);
            return deco ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                🌿 {deco.name}
              </p>
            ) : null;
          })()}
      </div>
    </Card>
  );
}
