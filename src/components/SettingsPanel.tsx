import { useEffect, useState, useMemo } from "react";
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
import { FontScaleSettings } from "@/components/FontScaleSettings";
import { SyncStatusBadge, type SyncStatus } from "@/components/SyncStatusBadge";
import { supabase } from "@/lib/supabaseClient";
import { offlineQueue } from "@/lib/offlineQueue";
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track online/offline for real sync status
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Derive real sync status from multiple signals
  const syncStatus: SyncStatus = useMemo(() => {
    if (!supabase) return "not-signed-in";
    if (!isOnline) return "offline";
    if (offlineQueue.hasPendingActions()) return "pending";
    return "synced";
  }, [isOnline]);
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
          className="w-full bg-card rounded-2xl p-5 zen-shadow-card hover:bg-accent/5 motion-safe:transition-colors text-start"
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

      {/* Standalone: Sync Status + Sync Now */}
      <div className="bg-card rounded-2xl p-5 zen-shadow-card">
        <div className="flex items-center justify-between">
          <SyncStatusBadge status={syncStatus} />
          {supabase && navigator.onLine && (
            <button
              // A11Y-OK: aria-label provided with translated text for screen readers
              aria-label={(t as Record<string, string>).syncNow || "Sync Now"}
              onClick={() => {
                void import("@/lib/offlineQueue").then(({ offlineQueue }) => {
                  void offlineQueue.processQueue();
                });
              }}
              className="text-xs text-primary font-medium hover:text-primary/80 motion-safe:transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {(t as Record<string, string>).syncNow || "Sync Now"}
            </button>
          )}
        </div>
      </div>

      {/* Standalone: Font Scale */}
      <FontScaleSettings />

      {/* Standalone: Dopamine Settings */}
      <div className="bg-card rounded-2xl p-5 zen-shadow-card">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">{t.dopamineSettings}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{t.dopamineSettingsDesc}</p>
        <button
          onClick={() => setShowDopamineSettings(true)}
          className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 motion-safe:transition-opacity flex items-center justify-center gap-2"
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
            className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 motion-safe:transition-opacity btn-press"
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
