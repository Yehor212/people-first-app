import { memo, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Trophy, ListTodo, Sparkles, Users, Flame } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SyncStatusIndicatorCompact } from '@/components/SyncStatusIndicator';

interface HeaderProps {
  userName?: string;
  streak?: number;
  onOpenChallenges?: () => void;
  onOpenTasks?: () => void;
  onOpenQuests?: () => void;
  onOpenFriends?: () => void;
}

export const Header = memo(function Header({ userName = 'Friend', streak, onOpenChallenges, onOpenTasks, onOpenQuests, onOpenFriends }: HeaderProps) {
  const { t, language } = useLanguage();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t.goodMorning;
    if (hour < 18) return t.goodAfternoon;
    return t.goodEvening;
  }, [t.goodMorning, t.goodAfternoon, t.goodEvening]);

  const formattedDate = useMemo(() => {
    const localeMap: Record<string, string> = {
      uk: 'uk-UA',
      es: 'es-ES',
      de: 'de-DE',
      fr: 'fr-FR',
      ja: 'ja-JP',
      ar: 'ar-SA',
      he: 'he-IL',
    };
    const locale = localeMap[language] || 'en-US';
    return new Date().toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, [language]);

  return (
    <header className="mb-6 motion-safe:animate-fade-in">
      {/* Top row: date + utilities (Apple-style) */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
          {streak != null && streak > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium text-orange-500">
              <Flame className="w-3 h-3" />
              <span>{streak} {t.daysInRow}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusIndicatorCompact />
          <ThemeToggle />
        </div>
      </div>

      {/* Large title — Apple Health style */}
      <h1 className="text-2xl font-bold text-foreground mb-4">
        {greeting}, {userName}
      </h1>

      {/* Quick Actions Bar — clean, no colored backgrounds */}
      {(onOpenTasks || onOpenQuests || onOpenChallenges || onOpenFriends) && (
        <div className="flex gap-2">
          {onOpenTasks && (
            <button
              onClick={onOpenTasks}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-secondary hover:bg-secondary/80 active:scale-[0.97] text-foreground rounded-xl transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t.openTasks}
            >
              <ListTodo className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium truncate">{t.tasks}</span>
            </button>
          )}
          {onOpenQuests && (
            <button
              onClick={onOpenQuests}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-secondary hover:bg-secondary/80 active:scale-[0.97] text-foreground rounded-xl transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t.openQuests}
            >
              <Sparkles className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium truncate">{t.quests}</span>
            </button>
          )}
          {onOpenChallenges && (
            <button
              onClick={onOpenChallenges}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-secondary hover:bg-secondary/80 active:scale-[0.97] text-foreground rounded-xl transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t.openChallenges}
            >
              <Trophy className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium truncate">{t.challenges}</span>
            </button>
          )}
          {onOpenFriends && (
            <button
              onClick={onOpenFriends}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-secondary hover:bg-secondary/80 active:scale-[0.97] text-foreground rounded-xl transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t.friends || 'Friends'}
            >
              <Users className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium truncate">{t.friends || 'Friends'}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
});
