import { useState, useEffect, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Achievement,
  ACHIEVEMENTS,
  AchievementId,
  UserLevel,
  calculateLevel,
  getBadgeColor,
  getBadgeGlow,
  checkAchievements,
  UserStats,
} from '@/lib/gamification';
import { Trophy, Star, Lock, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language } from '@/i18n/translations';

interface AchievementsPanelProps {
  stats: UserStats;
  unlockedAchievements: AchievementId[];
  onAchievementUnlock?: (achievement: Achievement) => void;
}

// Locale mapping for date formatting
const localeMap: Record<Language, string> = {
  ru: 'ru-RU', en: 'en-US', uk: 'uk-UA',
  es: 'es-ES', de: 'de-DE', fr: 'fr-FR'
};

export const AchievementsPanel = memo(function AchievementsPanel({ stats, unlockedAchievements, onAchievementUnlock }: AchievementsPanelProps) {
  const { t, language } = useLanguage();
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [achievementProgress, setAchievementProgress] = useState<Record<AchievementId, number>>({});
  const userLevel = calculateLevel(stats.totalXp);

  useEffect(() => {
    const { newAchievements, updatedProgress } = checkAchievements(stats, unlockedAchievements);

    // Update progress
    setAchievementProgress(updatedProgress);

    // Notify about new achievements
    if (newAchievements.length > 0 && onAchievementUnlock) {
      newAchievements.forEach((achievement) => {
        onAchievementUnlock(achievement);
      });
    }
  }, [stats, unlockedAchievements]);

  const allAchievements = Object.values(ACHIEVEMENTS);
  const unlockedCount = unlockedAchievements.length;
  const totalCount = allAchievements.length;
  const completionPercentage = (unlockedCount / totalCount) * 100;

  const unlockedList = allAchievements.filter((a) => unlockedAchievements.includes(a.id));
  const lockedList = allAchievements.filter((a) => !unlockedAchievements.includes(a.id));

  return (
    <div className="space-y-6">
      {/* Level Card */}
      <Card className="p-6 bg-gradient-to-br from-[#6bb5a0] to-[#4a9d7c] text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6" fill="currentColor" />
              {t.userLevel || 'Level'} {userLevel.level}
            </h3>
            <p className="text-white/80 text-sm">{userLevel.title}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{stats.totalXp}</div>
            <div className="text-white/80 text-sm">{t.xp || 'XP'}</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t.toLevel || 'To level'} {userLevel.level + 1}</span>
            <span>{userLevel.nextLevelXp - stats.totalXp} {t.xp || 'XP'}</span>
          </div>
          <Progress value={(stats.totalXp / userLevel.nextLevelXp) * 100} className="bg-white/20" />
        </div>
      </Card>

      {/* Completion Stats */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#4a9d7c]" />
            {t.achievements || 'Achievements'}
          </h3>
          <Badge variant="secondary">
            {unlockedCount} / {totalCount}
          </Badge>
        </div>
        <Progress value={completionPercentage} className="mb-2" />
        <p className="text-sm text-muted-foreground">
          {t.unlockedPercent?.replace('{percent}', String(Math.round(completionPercentage))) || `${Math.round(completionPercentage)}% unlocked`}
        </p>
      </Card>

      {/* Achievements Grid */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">{t.all || 'All'}</TabsTrigger>
          <TabsTrigger value="unlocked">{t.unlocked || 'Unlocked'}</TabsTrigger>
          <TabsTrigger value="locked">{t.locked || 'Locked'}</TabsTrigger>
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
                  onClick={() => setSelectedAchievement({ ...achievement, progress })}
                  hiddenText={t.hidden || 'Hidden'}
                  hiddenTitle={t.hiddenAchievement || '???'}
                />
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="unlocked" className="mt-4 overflow-visible">
          {unlockedList.length === 0 ? (
            <Card className="p-8 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">{t.noAchievementsYet || 'No achievements yet'}</p>
              <p className="text-sm text-muted-foreground mt-1">{t.startUsingZenFlow || 'Start using ZenFlow!'}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
              {unlockedList.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  isUnlocked={true}
                  onClick={() => setSelectedAchievement(achievement)}
                  hiddenText={t.hidden || 'Hidden'}
                  hiddenTitle={t.hiddenAchievement || '???'}
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
                  onClick={() => setSelectedAchievement({ ...achievement, progress })}
                  hiddenText={t.hidden || 'Hidden'}
                  hiddenTitle={t.hiddenAchievement || '???'}
                />
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Achievement Detail Dialog */}
      <Dialog open={!!selectedAchievement} onOpenChange={() => setSelectedAchievement(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <div className={`text-6xl mb-4 text-center ${selectedAchievement && getBadgeGlow(selectedAchievement.rarity)}`}>
              {selectedAchievement?.icon}
            </div>
            <DialogTitle className="text-center text-2xl">{selectedAchievement?.name}</DialogTitle>
            <DialogDescription className="text-center space-y-4">
              <p className="text-base">{selectedAchievement?.description}</p>

              {selectedAchievement && (
                <div className="flex items-center justify-center gap-4">
                  <Badge className={getBadgeColor(selectedAchievement.rarity)}>
                    {selectedAchievement.rarity.toUpperCase()}
                  </Badge>
                  <Badge variant="secondary">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {selectedAchievement.points} {t.xp || 'XP'}
                  </Badge>
                </div>
              )}

              {selectedAchievement?.total && selectedAchievement.progress !== undefined && (
                <div className="space-y-2 pt-4">
                  <div className="flex justify-between text-sm">
                    <span>{t.progress || 'Progress'}</span>
                    <span>{selectedAchievement.progress} / {selectedAchievement.total}</span>
                  </div>
                  <Progress value={(selectedAchievement.progress / selectedAchievement.total) * 100} />
                </div>
              )}

              {selectedAchievement?.unlockedAt && (
                <p className="text-xs text-muted-foreground pt-4">
                  {t.unlockedOn || 'Unlocked on'} {new Date(selectedAchievement.unlockedAt).toLocaleDateString(localeMap[language], {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
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

interface AchievementCardProps {
  achievement: Achievement;
  isUnlocked: boolean;
  progress?: number;
  onClick: () => void;
  hiddenText: string;
  hiddenTitle: string;
}

function AchievementCard({ achievement, isUnlocked, progress, onClick, hiddenText, hiddenTitle }: AchievementCardProps) {
  const hasProgress = progress !== undefined && achievement.total;
  const progressPercentage = hasProgress ? (progress / achievement.total!) * 100 : 0;

  return (
    <Card
      className={`p-4 cursor-pointer transition-all hover:scale-105 ${
        isUnlocked ? getBadgeGlow(achievement.rarity) : 'opacity-60'
      }`}
      onClick={onClick}
    >
      <div className="text-center space-y-2 min-w-0">
        <div className={`text-4xl ${!isUnlocked && 'grayscale blur-[1px]'}`}>
          {isUnlocked ? achievement.icon : <Lock className="w-10 h-10 mx-auto text-muted-foreground" />}
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-sm line-clamp-1">{isUnlocked ? achievement.name : hiddenTitle}</h4>
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
            +{achievement.points} {t.xp || 'XP'}
          </Badge>
        )}
      </div>
    </Card>
  );
}
