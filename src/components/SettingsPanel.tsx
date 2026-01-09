import { useState } from 'react';
import { User, Bell, Trash2, Download, Crown, ExternalLink, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language, languageNames, languageFlags } from '@/i18n/translations';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void;
}

const languages: Language[] = ['en', 'ru', 'uk', 'es', 'de', 'fr'];

export function SettingsPanel({ userName, onNameChange, onResetData }: SettingsPanelProps) {
  const { t, language, setLanguage } = useLanguage();
  const [name, setName] = useState(userName);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleNameSave = () => {
    if (name.trim()) {
      onNameChange(name.trim());
    }
  };

  const handleReset = () => {
    onResetData();
    setShowResetConfirm(false);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-foreground">{t.settings}</h2>

      {/* Profile */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t.profile}</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">{t.yourName}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleNameSave}
                className="px-4 py-2 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t.language}</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={cn(
                "flex items-center gap-2 p-3 rounded-xl transition-all",
                language === lang
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "bg-secondary hover:bg-muted"
              )}
            >
              <span className="text-xl">{languageFlags[lang]}</span>
              <span className="font-medium text-foreground text-sm">
                {languageNames[lang]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Premium Promo */}
      <div className="bg-gradient-to-br from-accent/20 to-primary/20 rounded-2xl p-6 border border-accent/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 zen-gradient-warm rounded-xl">
            <Crown className="w-5 h-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t.premium}</h3>
        </div>
        <p className="text-muted-foreground mb-4">
          {t.premiumDescription}
        </p>
        <button className="w-full py-3 zen-gradient-warm text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <span>{t.comingSoon}</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Notifications */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t.notifications}</h3>
        </div>
        <p className="text-muted-foreground">
          {t.notificationsComingSoon}
        </p>
      </div>

      {/* Data */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t.data}</h3>
        </div>
        
        <div className="space-y-3">
          <button className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors">
            {t.exportData} ({t.comingSoon})
          </button>
          
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-medium hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.resetAllData}</span>
            </button>
          ) : (
            <div className="p-4 bg-destructive/10 rounded-xl animate-scale-in">
              <p className="text-destructive font-medium mb-3">
                {t.areYouSure} {t.cannotBeUndone}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* About */}
      <div className="text-center text-muted-foreground py-4">
        <p className="text-sm">{t.appName} v1.0.0</p>
        <p className="text-xs mt-1">{t.tagline}</p>
      </div>
    </div>
  );
}
