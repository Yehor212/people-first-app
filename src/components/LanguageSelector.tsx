import { Language, languageNames, languageFlags } from '@/i18n/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Leaf, Check } from 'lucide-react';

interface LanguageSelectorProps {
  onComplete: () => void;
}

const languages: Language[] = ['en', 'ru', 'uk', 'es', 'de', 'fr'];

export function LanguageSelector({ onComplete }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
  };

  const handleContinue = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen zen-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 zen-gradient rounded-2xl zen-shadow-glow">
              <Leaf className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold zen-text-gradient mb-2">
            {t.welcomeTitle}
          </h1>
          <p className="text-muted-foreground">
            {t.welcomeSubtitle}
          </p>
        </div>

        {/* Language Selection */}
        <div className="bg-card rounded-2xl p-6 zen-shadow-card mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 text-center">
            {t.selectLanguage}
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            {languages.map((lang) => (
              <button
                key={lang}
                onClick={() => handleSelect(lang)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl transition-all",
                  language === lang
                    ? "bg-primary/10 ring-2 ring-primary zen-shadow-soft"
                    : "bg-secondary hover:bg-muted"
                )}
              >
                <span className="text-2xl">{languageFlags[lang]}</span>
                <span className="font-medium text-foreground flex-1 text-left">
                  {languageNames[lang]}
                </span>
                {language === lang && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="w-full py-4 zen-gradient text-primary-foreground font-semibold rounded-2xl hover:opacity-90 transition-opacity zen-shadow-soft text-lg"
        >
          {t.continue}
        </button>
      </div>
    </div>
  );
}
