import { useEffect, useState } from "react";
import { Sparkles, Smartphone, ChevronRight, Download, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import {
  Habit,
  ReminderSettings,
  PrivacySettings,
  MoodEntry,
  FocusSession,
  GratitudeEntry,
} from "@/types";
import { Accordion } from "@/components/ui/accordion";
import { DopamineSettingsComponent } from "@/components/DopamineSettings";
import {
  ProfileSection,
  AboutSection,
  ModulesSection,
  NotificationsSection,
  DataSection,
  AccountSection,
  SecuritySection,
  WhatsNewBanner,
} from "@/components/settings";

interface SettingsPanelProps {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void;
  reminders: ReminderSettings;
  onRemindersChange: (
    value: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings)
  ) => void;
  habits: Habit[];
  moods?: MoodEntry[];
  focusSessions?: FocusSession[];
  gratitudeEntries?: GratitudeEntry[];
  privacy: PrivacySettings;
  onPrivacyChange: (value: PrivacySettings | ((prev: PrivacySettings) => PrivacySettings)) => void;
  onOpenWidgetSettings?: () => void;
  initialOpenSection?: string;
}

export function SettingsPanel({
  userName,
  onNameChange,
  onResetData,
  reminders,
  onRemindersChange,
  habits,
  moods = [],
  focusSessions = [],
  gratitudeEntries = [],
  privacy,
  onPrivacyChange,
  onOpenWidgetSettings,
  initialOpenSection,
}: SettingsPanelProps) {
  const { t } = useLanguage();
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const [showDopamineSettings, setShowDopamineSettings] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(
    initialOpenSection ? [initialOpenSection] : ["profile"]
  );

  // Auto-open and scroll to section when initialOpenSection changes
  useEffect(() => {
    if (initialOpenSection) {
      setOpenSections((prev) =>
        prev.includes(initialOpenSection) ? prev : [...prev, initialOpenSection]
      );
    }
  }, [initialOpenSection]);

  return (
    <div className="space-y-4 motion-safe:animate-fade-in content-with-nav lg:max-w-3xl lg:mx-auto">
      <h2 className="text-2xl font-bold text-foreground">{t.settings}</h2>

      {/* What's New Banner */}
      <WhatsNewBanner />

      {/* Settings Accordion */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-3"
      >
        <ProfileSection userName={userName} onNameChange={onNameChange} />
        <ModulesSection />
        <NotificationsSection
          reminders={reminders}
          onRemindersChange={onRemindersChange}
          moods={moods}
          habits={habits}
          focusSessions={focusSessions}
        />
        <DataSection
          onResetData={onResetData}
          privacy={privacy}
          onPrivacyChange={onPrivacyChange}
          moods={moods}
          habits={habits}
          focusSessions={focusSessions}
          gratitudeEntries={gratitudeEntries}
          userName={userName}
        />
        <AccountSection userName={userName} onNameChange={onNameChange} onResetData={onResetData} />
        <SecuritySection />
        <AboutSection />
      </Accordion>

      {/* Standalone: Widget Settings */}
      {onOpenWidgetSettings && (
        <button
          onClick={onOpenWidgetSettings}
          className="w-full bg-card rounded-2xl p-5 zen-shadow-card hover:bg-accent/5 transition-colors text-start"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-primary" />
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {t.widgetSettings || "Widget Settings"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t.widgetSettingsDesc || "Configure widgets for your home screen"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground rtl:scale-x-[-1]" />
          </div>
        </button>
      )}

      {/* Standalone: Dopamine Settings */}
      <div className="bg-card rounded-2xl p-5 zen-shadow-card">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">{t.dopamineSettings}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{t.dopamineSettingsDesc}</p>
        <button
          onClick={() => setShowDopamineSettings(true)}
          className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>{t.dopamineCustomize}</span>
        </button>
      </div>

      {/* Standalone: Install App */}
      {isInstalled && (
        <div className="bg-card rounded-2xl p-5 zen-shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">{t.appInstalled}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{t.appInstalledDescription}</p>
        </div>
      )}

      {!isInstalled && canInstall && (
        <div className="bg-card rounded-2xl p-5 zen-shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <Download className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">{t.installApp}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t.installAppDescription}</p>
          <button
            onClick={() => promptInstall()}
            className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity btn-press"
          >
            {t.installNow}
          </button>
        </div>
      )}

      {/* Modals */}
      {showDopamineSettings && (
        <DopamineSettingsComponent onClose={() => setShowDopamineSettings(false)} />
      )}
    </div>
  );
}
