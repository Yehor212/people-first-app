import { useLanguage } from '@/contexts/LanguageContext';
import { Leaf, Trophy, ListTodo, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface HeaderProps {
  userName?: string;
  onOpenChallenges?: () => void;
  onOpenTasks?: () => void;
  onOpenQuests?: () => void;
}

export function Header({ userName = 'Friend', onOpenChallenges, onOpenTasks, onOpenQuests }: HeaderProps) {
  const { t } = useLanguage();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.goodMorning;
    if (hour < 18) return t.goodAfternoon;
    return t.goodEvening;
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString(
    useLanguage().language === 'ru' ? 'ru-RU' :
    useLanguage().language === 'uk' ? 'uk-UA' :
    useLanguage().language === 'es' ? 'es-ES' :
    useLanguage().language === 'de' ? 'de-DE' :
    useLanguage().language === 'fr' ? 'fr-FR' : 'en-US',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }
  );

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
          {getGreeting()}, {userName}! 👋
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
              <span className="text-sm font-medium">{t.tasks || 'Задачи'}</span>
            </button>
          )}
          {onOpenQuests && (
            <button
              onClick={onOpenQuests}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-xl transition-all"
              aria-label="Open Quests"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium">{t.quests || 'Квесты'}</span>
            </button>
          )}
          {onOpenChallenges && (
            <button
              onClick={onOpenChallenges}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all"
              aria-label="Open Challenges"
            >
              <Trophy className="w-5 h-5" />
              <span className="text-sm font-medium">{t.challenges || 'Вызовы'}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
