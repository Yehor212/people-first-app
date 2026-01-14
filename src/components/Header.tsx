import { useLanguage } from '@/contexts/LanguageContext';
import { Leaf, Trophy } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface HeaderProps {
  userName?: string;
  onOpenChallenges?: () => void;
}

export function Header({ userName = 'Friend', onOpenChallenges }: HeaderProps) {
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
    <header className="mb-8 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 zen-gradient rounded-xl zen-shadow-soft">
            <Leaf className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold zen-text-gradient">{t.appName}</span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenChallenges && (
            <button
              onClick={onOpenChallenges}
              className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all zen-shadow-soft hover:zen-shadow"
              aria-label="Open Challenges"
            >
              <Trophy className="w-5 h-5" />
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>
      
      <div className="mt-6">
        <h1 className="text-3xl font-bold text-foreground">
          {getGreeting()}, {userName}! 👋
        </h1>
        <p className="text-muted-foreground mt-1 capitalize">{formattedDate}</p>
      </div>
    </header>
  );
}
