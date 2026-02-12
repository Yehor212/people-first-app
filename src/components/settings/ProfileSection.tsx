import { useEffect, useState } from 'react';
import { User, Globe, Palette, Moon, Sun, Smartphone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language, languageNames, languageFlags } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Switch } from '@/components/ui/switch';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabaseClient';
import { userNameSchema } from '@/lib/validation';
import { sanitizeUserName } from '@/lib/sanitize';
import { useTheme, ThemeOption } from '@/components/ThemeToggle';

interface ProfileSectionProps {
  userName: string;
  onNameChange: (name: string) => void;
}

const languages: Language[] = ['en', 'uk', 'es', 'de', 'fr', 'ja', 'ar', 'he'];

export function ProfileSection({ userName, onNameChange }: ProfileSectionProps) {
  const { t, language, setLanguage } = useLanguage();
  const { theme: currentTheme, changeTheme } = useTheme();

  const [name, setName] = useState(userName);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [oledMode, setOledMode] = useState(() => {
    return localStorage.getItem('zenflow_oled_mode') === 'true';
  });

  useEffect(() => {
    setName(userName);
    setNameStatus(null);
  }, [userName]);

  useEffect(() => {
    if (!nameStatus) return;
    const timer = window.setTimeout(() => setNameStatus(null), 2000);
    return () => window.clearTimeout(timer);
  }, [nameStatus]);

  // Apply OLED mode on mount and when changed
  useEffect(() => {
    if (oledMode) {
      document.documentElement.classList.add('oled');
    } else {
      document.documentElement.classList.remove('oled');
    }
  }, [oledMode]);

  const handleNameSave = async () => {
    const sanitized = sanitizeUserName(name);
    if (!sanitized) return;

    try {
      userNameSchema.parse(sanitized);
    } catch {
      setNameStatus(t.invalidNameFormat || 'Invalid name format');
      return;
    }

    onNameChange(sanitized);
    setNameStatus(t.nameSaved);

    if (!supabase) return;
    try {
      await supabase.auth.updateUser({ data: { full_name: sanitized } });
    } catch (error) {
      logger.error("Failed to update profile name:", error);
      setNameStatus(t.nameSavedLocally || 'Saved locally');
    }
  };

  const handleOledModeChange = (checked: boolean) => {
    setOledMode(checked);
    localStorage.setItem('zenflow_oled_mode', String(checked));
  };

  return (
    <AccordionItem value="profile" className="bg-card rounded-2xl shadow-zen-sm border overflow-hidden">
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="p-2 zen-gradient rounded-xl shadow-zen-soft">
            <User className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">{t.settingsGroupProfile}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <div className="space-y-6">
          {/* Profile Name */}
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
            {nameStatus && (
              <p className="text-sm text-muted-foreground mt-2">{nameStatus}</p>
            )}
          </div>

          {/* Language */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{t.language}</span>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.language}>
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  aria-pressed={language === lang}
                  aria-label={languageNames[lang]}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl transition-all",
                    language === lang
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-secondary hover:bg-muted"
                  )}
                >
                  <span className="text-xl" aria-hidden="true">{languageFlags[lang]}</span>
                  <span className="font-medium text-foreground text-sm">
                    {languageNames[lang]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Appearance / Theme Selector */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{t.appearance || 'Appearance'}</span>
            </div>

            {/* Theme Options: Light / Dark / System */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">{t.themeLabel || 'Theme'}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'light' as ThemeOption, icon: Sun, label: t.themeLight || 'Light' },
                  { value: 'dark' as ThemeOption, icon: Moon, label: t.themeDark || 'Dark' },
                  { value: 'system' as ThemeOption, icon: Smartphone, label: t.themeSystem || 'System' },
                ]).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => changeTheme(option.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                      currentTheme === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 bg-secondary/30"
                    )}
                  >
                    <option.icon className={cn(
                      "w-5 h-5",
                      currentTheme === option.value ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-xs font-medium",
                      currentTheme === option.value ? "text-primary" : "text-foreground"
                    )}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* OLED Mode */}
            <div className="flex items-start justify-between gap-4 p-4 bg-secondary/50 rounded-xl">
              <div>
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">{t.oledDarkMode || 'OLED Dark Mode'}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.oledDarkModeHint || 'Pure black theme for OLED screens. Saves battery.'}
                </p>
              </div>
              <Switch checked={oledMode} onCheckedChange={handleOledModeChange} aria-label={t.oledDarkMode} className="mt-0.5 shrink-0" />
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
