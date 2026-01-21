import { memo, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Leaf, Trophy, ListTodo, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

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
    <header className="mb-6 animate-fade-in">
      {/* Top row: Logo and theme toggle only */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 zen-gradient rounded-xl zen-shadow-soft">
            <Leaf className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold zen-text-gradient">{t.appName}</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}, {userName}! 👋
        </h1>
        <p className="text-muted-foreground text-sm capitalize">{formattedDate}</p>
      </div>

      {/* Quick Actions Bar - larger, more accessible buttons */}
      {(onOpenTasks || onOpenQuests || onOpenChallenges) && (
        <div className="flex gap-2">
          {onOpenTasks && (
            <button
              onClick={onOpenTasks}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all"
              aria-label="Open Tasks"
            >
              <ListTodo className="w-5 h-5" />
              <span className="text-sm font-medium">{t.tasks}</span>
            </button>
          )}
          {onOpenQuests && (
            <button
              onClick={onOpenQuests}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-xl transition-all"
              aria-label="Open Quests"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium">{t.quests}</span>
            </button>
          )}
          {onOpenChallenges && (
            <button
              onClick={onOpenChallenges}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all"
              aria-label="Open Challenges"
            >
              <Trophy className="w-5 h-5" />
              <span className="text-sm font-medium">{t.challenges}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
});
