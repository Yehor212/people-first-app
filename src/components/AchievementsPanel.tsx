import { useState, useEffect, memo, useCallback } from "react";
import { interpolate } from "@/lib/utils";
import { useBackHandler } from "@/hooks/useBackHandler";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Achievement,
  ACHIEVEMENTS,
  AchievementId,
  calculateLevel,
  getBadgeColor,
  getBadgeGlow,
  checkAchievements,
  UserStats,
} from "@/lib/gamification";
import { getDecorationForAchievement } from "@/lib/achievementDecorations";
import { Trophy, Star, TrendingUp } from "lucide-react";
import { AchievementCard } from "./AchievementCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Language } from "@/i18n/translations";
import { announceSuccess } from "@/lib/a11y";

interface AchievementsPanelProps {
  stats: UserStats;
  unlockedAchievements: AchievementId[];
  onAchievementUnlock?: (achievement: Achievement) => void;
}

// Locale mapping for date formatting
const localeMap: Record<Language, string> = {
  en: "en-US",
  uk: "uk-UA",
  es: "es-ES",
  de: "de-DE",
  fr: "fr-FR",
  ja: "ja-JP",
  ar: "ar-SA",
  he: "he-IL",
};

export const AchievementsPanel = memo(function AchievementsPanel({
  stats,
  unlockedAchievements,
  onAchievementUnlock,
}: AchievementsPanelProps) {
  const { t, language } = useLanguage();
  const [selectedAchievement, setSelectedAchievement] =
    useState<Achievement | null>(null);
  const [achievementProgress, setAchievementProgress] = useState<
    Record<AchievementId, number>
  >({} as Record<AchievementId, number>);
  const clearSelectedAchievement = useCallback(
    () => setSelectedAchievement(null),
    [],
  );
  useBackHandler(!!selectedAchievement, clearSelectedAchievement);
  const userLevel = calculateLevel(stats.totalXp);

  useEffect(() => {
    const { newAchievements, updatedProgress } = checkAchievements(
      stats,
      unlockedAchievements,
    );

    // Update progress
    setAchievementProgress(updatedProgress);

    // Notify about new achievements
    if (newAchievements.length > 0) {
      newAchievements.forEach((achievement) => {
        // Announce to screen readers
        announceSuccess(
          `${t.achievementUnlocked || "Achievement unlocked!"} ${achievement.name}`,
        );

        if (onAchievementUnlock) {
          onAchievementUnlock(achievement);
        }
      });
    }
  }, [stats, unlockedAchievements, t.achievementUnlocked, onAchievementUnlock]);

  const allAchievements = Object.values(ACHIEVEMENTS);
  const unlockedCount = unlockedAchievements.length;
  const totalCount = allAchievements.length;
  const completionPercentage = (unlockedCount / totalCount) * 100;

  const unlockedList = allAchievements.filter((a) =>
    unlockedAchievements.includes(a.id),
  );
  const lockedList = allAchievements.filter(
    (a) => !unlockedAchievements.includes(a.id),
  );

  return (
    <div className="space-y-6">
      {/* Level Card */}
      <Card className="p-6 bg-gradient-to-br from-primary/70 to-primary text-primary-foreground">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6" fill="currentColor" />
              {t.userLevel || "Level"} {userLevel.level}
            </h3>
            <p className="text-white/80 text-sm">{userLevel.title}</p>
          </div>
          <div className="text-end">
            <div className="text-3xl font-bold">{stats.totalXp}</div>
            <div className="text-white/80 text-sm">{t.xp || "XP"}</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              {t.toLevel || "To level"} {userLevel.level + 1}
            </span>
            <span>
              {userLevel.nextLevelXp - stats.totalXp} {t.xp || "XP"}
            </span>
          </div>
          <Progress
            value={(stats.totalXp / userLevel.nextLevelXp) * 100}
            className="bg-white/20"
          />
        </div>
      </Card>

      {/* Completion Stats */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            {t.achievements || "Achievements"}
          </h3>
          <Badge variant="secondary">
            {unlockedCount} / {totalCount}
          </Badge>
        </div>
        <Progress value={completionPercentage} className="mb-2" />
        <p className="text-sm text-muted-foreground">
          {t.unlockedPercent?.replace(
            "{percent}",
            String(Math.round(completionPercentage)),
          ) || `${Math.round(completionPercentage)}% unlocked`}
        </p>
      </Card>

      {/* Achievements Grid */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">{t.all || "All"}</TabsTrigger>
          <TabsTrigger value="unlocked">{t.unlocked || "Unlocked"}</TabsTrigger>
          <TabsTrigger value="locked">{t.locked || "Locked"}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 overflow-visible">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
            {allAchievements.map((achievement) => {
              const isUnlocked = unlockedAchievements.includes(achievement.id);
              const progress = achievementProgress[achievement.id];

              return (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  isUnlocked={isUnlocked}
                  progress={progress}
                  onClick={() =>
                    setSelectedAchievement({ ...achievement, progress })
                  }
                  hiddenText={t.hidden || "Hidden"}
                  hiddenTitle={t.hiddenAchievement || "???"}
                />
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="unlocked" className="mt-4 overflow-visible">
          {unlockedList.length === 0 ? (
            <Card className="p-8 text-center">
              <Trophy
                className="w-12 h-12 mx-auto mb-3 text-muted-foreground"
                aria-label={t.trophyIcon || "Trophy"}
                role="img"
              />
              <p className="text-muted-foreground">
                {t.noAchievementsYet || "No achievements yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t.startUsingZenFlow || "Start using ZenFlow!"}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
              {unlockedList.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  isUnlocked={true}
                  onClick={() => setSelectedAchievement(achievement)}
                  hiddenText={t.hidden || "Hidden"}
                  hiddenTitle={t.hiddenAchievement || "???"}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="locked" className="mt-4 overflow-visible">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
            {lockedList.map((achievement) => {
              const progress = achievementProgress[achievement.id];
              return (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  isUnlocked={false}
                  progress={progress}
                  onClick={() =>
                    setSelectedAchievement({ ...achievement, progress })
                  }
                  hiddenText={t.hidden || "Hidden"}
                  hiddenTitle={t.hiddenAchievement || "???"}
                />
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Achievement Detail Dialog */}
      <Dialog
        open={!!selectedAchievement}
        onOpenChange={() => setSelectedAchievement(null)}
      >
        <DialogContent className="max-h-[80dvh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <div
              className={`text-6xl mb-4 text-center ${selectedAchievement && getBadgeGlow(selectedAchievement.rarity)}`}
            >
              {selectedAchievement?.icon}
            </div>
            <DialogTitle className="text-center text-2xl">
              {selectedAchievement?.name}
            </DialogTitle>
            <DialogDescription className="text-center space-y-4">
              <p className="text-base">{selectedAchievement?.description}</p>

              {selectedAchievement && (
                <div className="flex items-center justify-center gap-4">
                  <Badge className={getBadgeColor(selectedAchievement.rarity)}>
                    {selectedAchievement.rarity.toUpperCase()}
                  </Badge>
                  <Badge variant="secondary">
                    <TrendingUp className="w-3 h-3 me-1" />
                    {selectedAchievement.points} {t.xp || "XP"}
                  </Badge>
                </div>
              )}

              {selectedAchievement?.total &&
                selectedAchievement.progress !== undefined && (
                  <div className="space-y-2 pt-4">
                    <div className="flex justify-between text-sm">
                      <span>{t.progress || "Progress"}</span>
                      <span>
                        {selectedAchievement.progress} /{" "}
                        {selectedAchievement.total}
                      </span>
                    </div>
                    <Progress
                      value={
                        (selectedAchievement.progress /
                          selectedAchievement.total) *
                        100
                      }
                    />
                  </div>
                )}

              {/* Garden decoration info (IA Blueprint Phase 4) */}
              {selectedAchievement &&
                unlockedAchievements.includes(selectedAchievement.id) &&
                (() => {
                  const deco = getDecorationForAchievement(
                    selectedAchievement.id,
                  );
                  return deco ? (
                    <div className="pt-4 text-center">
                      <Badge
                        variant="outline"
                        className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
                      >
                        🌿 Unlocks: {deco.name} ({deco.rarity})
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {deco.description}
                      </p>
                    </div>
                  ) : null;
                })()}

              {selectedAchievement?.unlockedAt && (
                <p className="text-xs text-muted-foreground pt-4">
                  {interpolate(t.unlockedOn || "Unlocked on {date}", {
                    date: new Date(
                      selectedAchievement.unlockedAt,
                    ).toLocaleDateString(localeMap[language], {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                  })}
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
});
