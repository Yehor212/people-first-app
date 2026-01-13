import { Achievement, getBadgeGlow } from '@/lib/gamification';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Sparkles } from 'lucide-react';

interface AchievementToastProps {
  achievement: Achievement;
}

export function AchievementToast({ achievement }: AchievementToastProps) {
  return (
    <Card className={`p-4 bg-gradient-to-r from-[#6bb5a0] to-[#4a9d7c] text-white ${getBadgeGlow(achievement.rarity)} animate-slide-up`}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="text-5xl animate-scale-in">{achievement.icon}</div>
          <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-300 animate-pulse" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4" />
            <span className="font-bold text-sm uppercase tracking-wide">Достижение разблокировано!</span>
          </div>
          <h3 className="font-bold text-lg mb-1">{achievement.name}</h3>
          <p className="text-sm text-white/80">{achievement.description}</p>
          <Badge className="mt-2 bg-white/20 text-white border-white/30">
            +{achievement.points} XP
          </Badge>
        </div>
      </div>
    </Card>
  );
}
