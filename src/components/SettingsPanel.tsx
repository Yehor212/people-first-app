import { useEffect, useRef, useState } from 'react';
import { User, Bell, Trash2, Download, Crown, ExternalLink, Globe, CheckCircle, Shield } from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language, languageNames, languageFlags } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { Habit, ReminderSettings, PrivacySettings } from '@/types';
import { Switch } from '@/components/ui/switch';
import { exportBackup, importBackup, ImportMode } from '@/storage/backup';
import { supabase } from '@/lib/supabaseClient';
import { syncWithCloud } from '@/storage/cloudSync';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { sanitizeUserName, userNameSchema } from '@/lib/validation';

interface SettingsPanelProps {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void;
  reminders: ReminderSettings;
  onRemindersChange: (value: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings)) => void;
  habits: Habit[];
  privacy: PrivacySettings;
  onPrivacyChange: (value: PrivacySettings | ((prev: PrivacySettings) => PrivacySettings)) => void;
}

const languages: Language[] = ['en', 'ru', 'uk', 'es', 'de', 'fr'];

export function SettingsPanel({
  userName,
  onNameChange,
  onResetData,
  reminders,
  onRemindersChange,
  habits,
  privacy,
  onPrivacyChange
}: SettingsPanelProps) {
  const { t, language, setLanguage } = useLanguage();
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const [name, setName] = useState(userName);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  const formatError = (error: unknown) => {
    if (error && typeof error === "object") {
      const errObj = error as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
      };
      const parts = [errObj.code, errObj.message, errObj.details, errObj.hint].filter(Boolean);
      if (parts.length) {
        return parts.join(" | ");
      }
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    return String(error);
  };

  useEffect(() => {
    setName(userName);
    setNameStatus(null);
  }, [userName]);

  const handleNameSave = async () => {
    const sanitized = sanitizeUserName(name);
    if (!sanitized) return;

    // Validate name
    try {
      userNameSchema.parse(sanitized);
    } catch (error) {
      setNameStatus('Invalid name format');
      return;
    }

    onNameChange(sanitized);
    setNameStatus(t.nameSaved);
    if (!supabase) return;
    try {
      await supabase.auth.updateUser({ data: { full_name: sanitized } });
    } catch (error) {
      console.error("Failed to update profile name:", error);
    }
  };

  const handleReset = () => {
    onResetData();
    setShowResetConfirm(false);
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user?.email ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!nameStatus) return;
    const timer = window.setTimeout(() => setNameStatus(null), 2000);
    return () => window.clearTimeout(timer);
  }, [nameStatus]);

  const handleSignIn = async () => {
    if (!supabase) {
      setAuthStatus(t.authNotConfigured);
      return;
    }
    if (!authEmail.trim()) return;
    setAuthStatus(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: getAuthRedirectUrl() }
    });
    if (error) {
      setAuthStatus(t.authError);
      return;
    }
    setAuthStatus(t.authEmailSent);
  };

  const handleGoogle = async () => {
    if (!supabase) {
      setAuthStatus(t.authNotConfigured);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthRedirectUrl() }
    });
    if (error) {
      setAuthStatus(t.authError);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthStatus(t.authSignedOut);
  };

  const handleDeleteAccount = async () => {
    if (!supabase) {
      setDeleteStatus(t.deleteAccountError);
      return;
    }
    setDeleteStatus(null);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) {
        throw error;
      }
      await supabase.auth.signOut();
      onResetData();
      setShowDeleteConfirm(false);
      setDeleteStatus(t.deleteAccountSuccess);
    } catch (error) {
      console.error("Delete account failed:", error);
      setDeleteStatus(t.deleteAccountError);
    }
  };

  const handleSync = async () => {
    try {
      if (!supabase) {
        setAuthStatus(t.cloudSyncDisabled);
        return;
      }
      setAuthStatus(null);
      const result = await syncWithCloud('merge');
      setAuthStatus(result.status === "pulled" ? t.syncPulled : t.syncPushed);
    } catch (error) {
      const errorMessage = formatError(error);
      console.error("Sync failed:", errorMessage);
      setAuthStatus(`${t.syncError} ${errorMessage}`);
    }
  };

  const handleExport = async () => {
    try {
      const payload = await exportBackup();
      const json = JSON.stringify(payload, null, 2);
      const date = new Date().toISOString().slice(0, 10);
      const filename = `zenflow-backup-${date}.json`;

      if (Capacitor.isNativePlatform()) {
        const file = await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        await Share.share({
          title: 'ZenFlow backup',
          text: filename,
          url: file.uri,
          dialogTitle: 'Share backup'
        });
        setDataStatus(t.exportSuccess);
        return;
      }

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDataStatus(t.exportSuccess);
    } catch (error) {
      console.error(error);
      setDataStatus(t.exportError);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const report = await importBackup(payload, importMode);
      const formatEntry = (label: string, entry: { added: number; updated: number; skipped: number }) =>
        `${label} ${t.importAdded} ${entry.added}, ${t.importUpdated} ${entry.updated}, ${t.importSkipped} ${entry.skipped}`;
      setDataStatus(
        `${t.importSuccess} ${t.importedItems}: ` +
          `${formatEntry(t.moodEntries, report.moods)}; ` +
          `${formatEntry(t.habits, report.habits)}; ` +
          `${formatEntry(t.focus, report.focusSessions)}; ` +
          `${formatEntry(t.gratitude, report.gratitudeEntries)}; ` +
          `${formatEntry(t.settings, report.settings)}.`
      );
    } catch (error) {
      console.error(error);
      setDataStatus(t.importError);
    } finally {
      event.target.value = '';
    }
  };

  const dayOptions = [
    { value: 1, label: t.mon },
    { value: 2, label: t.tue },
    { value: 3, label: t.wed },
    { value: 4, label: t.thu },
    { value: 5, label: t.fri },
    { value: 6, label: t.sat },
    { value: 0, label: t.sun }
  ];

  const handleNoTrackingChange = (checked: boolean) => {
    // Prevent disabling both toggles
    if (!checked && !privacy.analytics) {
      return;
    }
    onPrivacyChange((prev) => ({
      ...prev,
      noTracking: checked,
      analytics: checked ? false : prev.analytics
    }));
  };

  const handleAnalyticsChange = (checked: boolean) => {
    // Prevent disabling both toggles
    if (!checked && !privacy.noTracking) {
      return;
    }
    onPrivacyChange((prev) => ({
      ...prev,
      analytics: checked,
      noTracking: checked ? false : prev.noTracking
    }));
  };

  const baseUrl = import.meta.env.BASE_URL || '/';
  // Use main privacy.html for all languages (localized versions can be added later)
  const privacyHref = `${baseUrl}privacy.html`;
  const termsHref = `${baseUrl}terms.html`;
  const deleteAccountHref = `${baseUrl}delete-account.html`;

  const handleRemindersToggle = (checked: boolean) => {
    onRemindersChange((prev) => ({ ...prev, enabled: checked }));
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
            {nameStatus && (
              <p className="text-sm text-muted-foreground mt-2">{nameStatus}</p>
            )}
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

      {/* Reminders */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">{t.remindersTitle}</h3>
          </div>
          <Switch
            checked={reminders.enabled}
            onCheckedChange={handleRemindersToggle}
          />
        </div>
        <p className="text-muted-foreground mb-4">
          {t.remindersDescription}
        </p>

        <div className={cn("space-y-4", !reminders.enabled && "opacity-50 pointer-events-none")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">{t.moodReminder}</label>
              <input
                type="time"
                value={reminders.moodTime}
                onChange={(e) =>
                  onRemindersChange((prev) => ({ ...prev, moodTime: e.target.value }))
                }
                className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">{t.habitReminder}</label>
              <input
                type="time"
                value={reminders.habitTime}
                onChange={(e) =>
                  onRemindersChange((prev) => ({ ...prev, habitTime: e.target.value }))
                }
                className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">{t.focusReminder}</label>
              <input
                type="time"
                value={reminders.focusTime}
                onChange={(e) =>
                  onRemindersChange((prev) => ({ ...prev, focusTime: e.target.value }))
                }
                className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">{t.quietHours}</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={reminders.quietHours.start}
                  onChange={(e) =>
                    onRemindersChange((prev) => ({
                      ...prev,
                      quietHours: { ...prev.quietHours, start: e.target.value }
                    }))
                  }
                  className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  type="time"
                  value={reminders.quietHours.end}
                  onChange={(e) =>
                    onRemindersChange((prev) => ({
                      ...prev,
                      quietHours: { ...prev.quietHours, end: e.target.value }
                    }))
                  }
                  className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">{t.reminderDays}</label>
            <div className="flex flex-wrap gap-2">
              {dayOptions.map((day) => {
                const active = reminders.days.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() =>
                      onRemindersChange((prev) => ({
                        ...prev,
                        days: active
                          ? prev.days.filter((value) => value !== day.value)
                          : [...prev.days, day.value]
                      }))
                    }
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 ring-2 ring-primary text-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">{t.selectedHabits}</label>
            {habits.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noHabitsYet}</p>
            ) : (
              <div className="space-y-2">
                {habits.map((habit) => {
                  const checked = reminders.habitIds.includes(habit.id);
                  return (
                    <label key={habit.id} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onRemindersChange((prev) => ({
                            ...prev,
                            habitIds: checked
                              ? prev.habitIds.filter((id) => id !== habit.id)
                              : [...prev.habitIds, habit.id]
                          }))
                        }
                        className="h-4 w-4 rounded border-muted"
                      />
                      <span>{habit.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Install */}
      {isInstalled && (
        <div className="bg-card rounded-2xl p-6 zen-shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">{t.appInstalled}</h3>
          </div>
          <p className="text-muted-foreground">
            {t.appInstalledDescription}
          </p>
        </div>
      )}

      {!isInstalled && canInstall && (
        <div className="bg-card rounded-2xl p-6 zen-shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">{t.installApp}</h3>
          </div>
          <p className="text-muted-foreground mb-4">
            {t.installAppDescription}
          </p>
          <button
            onClick={() => promptInstall()}
            className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            {t.installNow}
          </button>
        </div>
      )}

      {/* Data */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t.data}</h3>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={handleExport}
            className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
          >
            {t.exportData}
          </button>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">{t.importMode}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setImportMode('merge')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                  importMode === 'merge'
                    ? "bg-primary/10 ring-2 ring-primary text-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-muted"
                )}
              >
                {t.importMerge}
              </button>
              <button
                onClick={() => setImportMode('replace')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                  importMode === 'replace'
                    ? "bg-primary/10 ring-2 ring-primary text-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-muted"
                )}
              >
                {t.importReplace}
              </button>
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              onClick={handleImportClick}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
            >
              {t.importData}
            </button>
          </div>

          {dataStatus && (
            <p className="text-sm text-muted-foreground">{dataStatus}</p>
          )}
          
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

      {/* Privacy */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t.privacyTitle}</h3>
        </div>

        <p className="text-muted-foreground mb-4">{t.privacyDescription}</p>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t.privacyNoTracking}</p>
              <p className="text-xs text-muted-foreground">{t.privacyNoTrackingHint}</p>
            </div>
            <Switch checked={privacy.noTracking} onCheckedChange={handleNoTrackingChange} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t.privacyAnalytics}</p>
              <p className="text-xs text-muted-foreground">{t.privacyAnalyticsHint}</p>
            </div>
            <Switch checked={privacy.analytics} onCheckedChange={handleAnalyticsChange} />
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <a
              href={privacyHref}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline hover:text-primary/90"
            >
              {t.privacyPolicy}
            </a>
            <a
              href={termsHref}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline hover:text-primary/90"
            >
              {t.termsOfService}
            </a>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t.account}</h3>
        </div>

        <p className="text-muted-foreground mb-4">{t.accountDescription}</p>

        {!supabase ? (
          <p className="text-sm text-muted-foreground">{t.cloudSyncDisabled}</p>
        ) : sessionEmail ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t.signedInAs} <span className="text-foreground font-medium">{sessionEmail}</span>
            </p>
            <button
              onClick={handleSync}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
            >
              {t.syncNow}
            </button>
            <button
              onClick={handleSignOut}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
            >
              {t.signOut}
            </button>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-medium hover:bg-destructive/20 transition-colors"
              >
                {t.deleteAccount}
              </button>
            ) : (
              <div className="p-4 bg-destructive/10 rounded-xl animate-scale-in space-y-3">
                <p className="text-sm text-destructive font-medium">
                  {t.deleteAccountConfirm}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.deleteAccountWarning}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg"
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            )}
            <a
              href={deleteAccountHref}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline hover:text-primary/90"
            >
              {t.deleteAccountLink}
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleSignIn}
              className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              {t.sendMagicLink}
            </button>
            <button
              onClick={handleGoogle}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
            >
              {t.continueWithGoogle}
            </button>
          </div>
        )}

        {authStatus && (
          <p className="text-sm text-muted-foreground mt-3">{authStatus}</p>
        )}
        {deleteStatus && (
          <p className="text-sm text-muted-foreground mt-3">{deleteStatus}</p>
        )}
      </div>

      {/* About */}
      <div className="text-center text-muted-foreground py-4">
        <p className="text-sm">{t.appName} v{__APP_VERSION__}</p>
        <p className="text-xs mt-1">{t.tagline}</p>
      </div>
    </div>
  );
}
