import { memo, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Leaf, Trophy, ListTodo, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SyncStatusIndicatorCompact } from '@/components/SyncStatusIndicator';

interface HeaderProps {
  userName?: string;
  onOpenChallenges?: () => void;
  onOpenTasks?: () => void;
  onOpenQuests?: () => void;
}

export const Header = memo(function Header({ userName = 'Friend', onOpenChallenges, onOpenTasks, onOpenQuests }: HeaderProps) {
  const { t, language } = useLanguage();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t.goodMorning;
    if (hour < 18) return t.goodAfternoon;
    return t.goodEvening;
  }, [t.goodMorning, t.goodAfternoon, t.goodEvening]);

  const formattedDate = useMemo(() => {
    const localeMap: Record<string, string> = {
      ru: 'ru-RU',
      uk: 'uk-UA',
      es: 'es-ES',
      de: 'de-DE',
      fr: 'fr-FR',
    };
    const locale = localeMap[language] || 'en-US';
    return new Date().toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, [language]);

  return (
    <header className="mb-4 animate-fade-in">
      {/* Top row: Logo, sync status, and theme toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 zen-gradient rounded-lg zen-shadow-soft">
            <Leaf className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold zen-text-gradient">{t.appName}</span>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusIndicatorCompact />
          <ThemeToggle />
        </div>
      </div>

      {/* Greeting */}
      <div className="mb-3">
        <h1 className="text-xl font-bold text-foreground">
          {greeting}, {userName}! 👋
        </h1>
        <p className="text-muted-foreground text-xs capitalize">{formattedDate}</p>
      </div>

      {/* Quick Actions Bar - compact but accessible */}
      {(onOpenTasks || onOpenQuests || onOpenChallenges) && (
        <div className="flex gap-2">
          {onOpenTasks && (
            <button
              onClick={onOpenTasks}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all min-h-[44px]"
              aria-label={t.openTasks}
            >
              <ListTodo className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{t.tasks}</span>
            </button>
          )}
          {onOpenQuests && (
            <button
              onClick={onOpenQuests}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-xl transition-all min-h-[44px]"
              aria-label={t.openQuests}
            >
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{t.quests}</span>
            </button>
          )}
          {onOpenChallenges && (
            <button
              onClick={onOpenChallenges}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all min-h-[44px]"
              aria-label={t.openChallenges}
            >
              <Trophy className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{t.challenges}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
});
