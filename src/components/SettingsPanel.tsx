import { useEffect, useRef, useState } from 'react';
import { User, Bell, Trash2, Download, Upload, Crown, ExternalLink, Globe, CheckCircle, Shield, Sparkles, Smartphone, ChevronRight, TestTube, Cloud, Palette, Moon, Mail, LayoutGrid, Timer, Wind, Heart, Target, ListTodo, Trophy, Bot, Flower2 } from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatureFlags, ToggleableFeature } from '@/contexts/FeatureFlagsContext';
import { Language, languageNames, languageFlags } from '@/i18n/translations';
import { FeatureToggleItem } from '@/components/FeatureToggleItem';
import { isFeatureUnlocked } from '@/lib/onboardingFlow';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { safeJsonParse } from '@/lib/safeJson';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { Habit, ReminderSettings, PrivacySettings, MoodEntry, FocusSession, GratitudeEntry } from '@/types';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SmartRemindersCard } from '@/components/SmartRemindersCard';
import { HealthConnectCard } from '@/components/HealthConnectCard';
import { exportBackup, importBackup, ImportMode } from '@/storage/backup';
import { exportAllToCSV, exportProgressReportPDF } from '@/lib/exportService';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { syncWithCloud } from '@/storage/cloudSync';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { sanitizeUserName, userNameSchema } from '@/lib/validation';
import { DopamineSettingsComponent } from '@/components/DopamineSettings';
import { sendTestNotification, checkNotificationStatus } from '@/lib/localNotifications';
import { isCloudSyncEnabled, setCloudSyncEnabled } from '@/lib/cloudSyncSettings';
import { FeedbackForm } from '@/components/FeedbackForm';
import { MessageSquare, Zap, Volume2, RefreshCw, History } from 'lucide-react';
import { ChangelogPanel } from '@/components/ChangelogPanel';
import { checkForAppUpdate, openGooglePlayStore, UpdateState } from '@/lib/appUpdateManager';
import { APP_VERSION } from '@/lib/appVersion';
import { useQuickActions } from '@/hooks/useQuickActions';
import {
  NOTIFICATION_SOUNDS,
  getNotificationSound,
  setNotificationSound,
  NotificationSoundType,
} from '@/lib/notificationSounds';

interface SettingsPanelProps {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void;
  reminders: ReminderSettings;
  onRemindersChange: (value: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings)) => void;
  habits: Habit[];
  moods?: MoodEntry[];
  focusSessions?: FocusSession[];
  gratitudeEntries?: GratitudeEntry[];
  privacy: PrivacySettings;
  onPrivacyChange: (value: PrivacySettings | ((prev: PrivacySettings) => PrivacySettings)) => void;
  onOpenWidgetSettings?: () => void;
}

const languages: Language[] = ['en', 'ru', 'uk', 'es', 'de', 'fr'];

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
  onOpenWidgetSettings
}: SettingsPanelProps) {
  const { t, language, setLanguage } = useLanguage();
  const { flags, setFlag, isFeatureEnabled } = useFeatureFlags();
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
  const [showDopamineSettings, setShowDopamineSettings] = useState(false);
  const [notificationTestStatus, setNotificationTestStatus] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabledState] = useState(isCloudSyncEnabled());
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);
  const [weeklyDigestLoading, setWeeklyDigestLoading] = useState(false);
  const weeklyDigestTouchedRef = useRef(false);
  // P1 Fix: Debounce for cloud sync toggle to prevent race conditions
  const cloudSyncDebounceRef = useRef(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [showWhatsNew, setShowWhatsNew] = useState(() => {
    const dismissed = localStorage.getItem('zenflow_whats_new_v1_3_0_dismissed');
    return dismissed !== 'true';
  });
  const [oledMode, setOledMode] = useState(() => {
    return localStorage.getItem('zenflow_oled_mode') === 'true';
  });

  // Update check state
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'checking' | 'available' | 'latest' | 'error'>('idle');
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);

  // Quick Actions for lock screen (Android only)
  const { isEnabled: quickActionsEnabled, isAndroid, toggle: toggleQuickActions } = useQuickActions();

  // Notification sound preference
  const [selectedSound, setSelectedSound] = useState<NotificationSoundType>(() => getNotificationSound());

  const handleSoundChange = (sound: NotificationSoundType) => {
    setSelectedSound(sound);
    setNotificationSound(sound);
  };

  const handleDismissWhatsNew = () => {
    localStorage.setItem('zenflow_whats_new_v1_3_0_dismissed', 'true');
    setShowWhatsNew(false);
  };

  // Apply OLED mode on mount and when changed
  useEffect(() => {
    if (oledMode) {
      document.documentElement.classList.add('oled');
    } else {
      document.documentElement.classList.remove('oled');
    }
  }, [oledMode]);

  const handleOledModeChange = (checked: boolean) => {
    setOledMode(checked);
    localStorage.setItem('zenflow_oled_mode', String(checked));
  };

  const handleCheckForUpdates = async () => {
    setUpdateCheckStatus('checking');
    setUpdateState(null);

    try {
      const result = await checkForAppUpdate();
      setUpdateState(result);

      if (result.available) {
        setUpdateCheckStatus('available');
      } else if (result.error) {
        setUpdateCheckStatus('error');
      } else {
        setUpdateCheckStatus('latest');
      }
    } catch (error) {
      logger.error('[Settings] Update check failed:', error);
      setUpdateCheckStatus('error');
    }
  };

  const handleOpenGooglePlay = async () => {
    await openGooglePlayStore();
  };

  const handleTestNotification = async () => {
    setNotificationTestStatus('Sending...');
    try {
      const status = await checkNotificationStatus();
      if (!status.hasPermission) {
        setNotificationTestStatus('❌ No permission. Enable notifications in Android Settings.');
        return;
      }
      const success = await sendTestNotification();
      if (success) {
        setNotificationTestStatus('✅ Test notification sent! Check in 5 seconds.');
      } else {
        setNotificationTestStatus('❌ Failed to send. Check Android notification settings.');
      }
    } catch (error) {
      setNotificationTestStatus(`❌ Error: ${error}`);
    }
  };

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
      logger.error("Failed to update profile name:", error);
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
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  // Load weekly digest setting when logged in
  useEffect(() => {
    if (!supabase || !sessionEmail) return;

    const loadWeeklyDigestSetting = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('user_settings')
          .select('weekly_digest_enabled')
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle to avoid error if no row exists

        if (error) {
          logger.error('[Settings] Failed to load weekly digest setting:', error);
          return;
        }

        if (weeklyDigestTouchedRef.current) return;
        if (data) {
          setWeeklyDigestEnabled(data.weekly_digest_enabled ?? false);
        }
      } catch (error) {
        logger.error('[Settings] Error loading weekly digest:', error);
      }
    };

    loadWeeklyDigestSetting();
  }, [sessionEmail]);

  const handleWeeklyDigestToggle = async (enabled: boolean) => {
    if (!supabase) return;

    setWeeklyDigestLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setWeeklyDigestEnabled(!enabled); // Revert optimistic update
        logger.warn('[Settings] No user for weekly digest');
        return;
      }

      // Upsert the setting
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          weekly_digest_enabled: enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        setWeeklyDigestEnabled(!enabled); // Revert on error
        logger.error('[Settings] Failed to update weekly digest:', error);
      }
      // Note: Don't set enabled on success - already set optimistically
    } catch (error) {
      setWeeklyDigestEnabled(!enabled); // Revert on error
      logger.error('[Settings] Weekly digest toggle error:', error);
    } finally {
      setWeeklyDigestLoading(false);
    }
  };

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

    const redirectUrl = getAuthRedirectUrl();
    logger.log('[Settings] Starting Google sign-in with redirect:', redirectUrl);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      logger.error('[Settings] Google sign-in error:', error);
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
      logger.error("Delete account failed:", error);
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
      logger.error("Sync failed:", errorMessage);
      setAuthStatus(`${t.syncError} ${errorMessage}`);
    }
  };

  const handleCloudSyncToggle = (enabled: boolean) => {
    // P1 Fix: Debounce to prevent rapid toggle race conditions
    if (cloudSyncDebounceRef.current) return;
    cloudSyncDebounceRef.current = true;
    setTimeout(() => { cloudSyncDebounceRef.current = false; }, 500);

    setCloudSyncEnabled(enabled);
    setCloudSyncEnabledState(enabled);

    if (enabled) {
      setAuthStatus(t.settingsCloudSyncEnabled);
      // Trigger immediate sync when enabled
      handleSync();
    } else {
      setAuthStatus(t.settingsCloudSyncDisabledByUser);
    }
  };

  const handleExport = async () => {
    try {
      const payload = await exportBackup();
      const json = JSON.stringify(payload, null, 2);
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // 2026-01-22
      const filename = `ZenFlow_Backup_${dateStr}_${now.getTime()}.json`;

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
      logger.error("Export failed:", error);
      setDataStatus(t.exportError);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Security: Validate file type
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setDataStatus(t.invalidFileType || 'Invalid file type. Please select a JSON file.');
      event.target.value = '';
      return;
    }

    // Security: Limit file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setDataStatus(t.fileTooLarge || 'File is too large. Maximum size is 10MB.');
      event.target.value = '';
      return;
    }

    // Security: User confirmation
    const confirmMessage = t.importConfirm || `Import data from "${file.name}"? This will add data to your existing entries.`;
    if (!window.confirm(confirmMessage)) {
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const payload = safeJsonParse(text, null);

      if (!payload || typeof payload !== 'object') {
        setDataStatus(t.invalidBackupFormat || 'Invalid backup format. The file does not contain valid JSON data.');
        event.target.value = '';
        return;
      }

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
      logger.error("Import failed:", error);
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
    <div className="space-y-4 animate-fade-in content-with-nav">
      <h2 className="text-2xl font-bold text-foreground">{t.settings}</h2>

      {/* What's New Banner - Always at top */}
      {showWhatsNew && (
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 border border-primary/20 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">{t.settingsWhatsNewTitle || `What's New in v${APP_VERSION}`}</h3>
            </div>
            <button
              onClick={handleDismissWhatsNew}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {t.settingsWhatsNewGotIt || 'Got it!'}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-1">🏆</div>
              <div>
                <p className="text-sm font-medium text-foreground">{t.settingsWhatsNewLeaderboards || 'Leaderboards'}</p>
                <p className="text-xs text-muted-foreground">{t.settingsWhatsNewLeaderboardsDesc || 'Compete anonymously with others'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1">🎵</div>
              <div>
                <p className="text-sm font-medium text-foreground">{t.settingsWhatsNewSpotify || 'Spotify Integration'}</p>
                <p className="text-xs text-muted-foreground">{t.settingsWhatsNewSpotifyDesc || 'Auto-play music during focus sessions'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1">🤝</div>
              <div>
                <p className="text-sm font-medium text-foreground">{t.settingsWhatsNewChallenges || 'Friend Challenges'}</p>
                <p className="text-xs text-muted-foreground">{t.settingsWhatsNewChallengesDesc || 'Challenge friends to build habits together'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1">📧</div>
              <div>
                <p className="text-sm font-medium text-foreground">{t.settingsWhatsNewDigest || 'Weekly Digest'}</p>
                <p className="text-xs text-muted-foreground">{t.settingsWhatsNewDigestDesc || 'Get progress reports in your inbox'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1">🔒</div>
              <div>
                <p className="text-sm font-medium text-foreground">{t.settingsWhatsNewSecurity || 'Enhanced Security'}</p>
                <p className="text-xs text-muted-foreground">{t.settingsWhatsNewSecurityDesc || 'Better data protection & privacy'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Accordion */}
      <Accordion type="multiple" defaultValue={["profile"]} className="space-y-3">

        {/* Group 1: Profile & Appearance */}
        <AccordionItem value="profile" className="bg-card rounded-2xl zen-shadow-card border-none overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
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

              {/* Appearance / OLED Mode */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{t.appearance || 'Appearance'}</span>
                </div>
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

        {/* Group 1.5: Modules / Feature Toggles */}
        <AccordionItem value="modules" className="bg-card rounded-2xl zen-shadow-card border-none overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">{t.settingsGroupModules}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <p className="text-xs text-muted-foreground mb-4">{t.settingsModulesDescription}</p>
            <div className="space-y-1 divide-y divide-border/50">
              {/* Core modules - always enabled */}
              <FeatureToggleItem
                icon={<span className="text-base">😊</span>}
                title={t.settingsModuleMood}
                description={t.settingsModuleMoodDesc}
                enabled={true}
                onToggle={() => {}}
                isCore={true}
              />
              <FeatureToggleItem
                icon={<span className="text-base">✅</span>}
                title={t.settingsModuleHabits}
                description={t.settingsModuleHabitsDesc}
                enabled={true}
                onToggle={() => {}}
                isCore={true}
              />

              {/* Toggleable modules */}
              <FeatureToggleItem
                icon={<Timer className="w-4 h-4 text-orange-500" />}
                title={t.settingsModuleFocus}
                description={t.settingsModuleFocusDesc}
                enabled={isFeatureEnabled('focusTimer')}
                onToggle={(enabled) => setFlag('focusTimer', enabled)}
                isLocked={!isFeatureUnlocked('focusTimer')}
                lockedMessage={t.settingsModuleUnlockHint}
              />
              <FeatureToggleItem
                icon={<Wind className="w-4 h-4 text-sky-500" />}
                title={t.settingsModuleBreathing}
                description={t.settingsModuleBreathingDesc}
                enabled={isFeatureEnabled('breathingExercise')}
                onToggle={(enabled) => setFlag('breathingExercise', enabled)}
              />
              <FeatureToggleItem
                icon={<Heart className="w-4 h-4 text-pink-500" />}
                title={t.settingsModuleGratitude}
                description={t.settingsModuleGratitudeDesc}
                enabled={isFeatureEnabled('gratitudeJournal')}
                onToggle={(enabled) => setFlag('gratitudeJournal', enabled)}
              />
              <FeatureToggleItem
                icon={<Target className="w-4 h-4 text-yellow-500" />}
                title={t.settingsModuleQuests}
                description={t.settingsModuleQuestsDesc}
                enabled={isFeatureEnabled('quests')}
                onToggle={(enabled) => setFlag('quests', enabled)}
                isLocked={!isFeatureUnlocked('quests')}
                lockedMessage={t.settingsModuleUnlockHint}
              />
              <FeatureToggleItem
                icon={<ListTodo className="w-4 h-4 text-blue-500" />}
                title={t.settingsModuleTasks}
                description={t.settingsModuleTasksDesc}
                enabled={isFeatureEnabled('tasks')}
                onToggle={(enabled) => setFlag('tasks', enabled)}
                isLocked={!isFeatureUnlocked('tasks')}
                lockedMessage={t.settingsModuleUnlockHint}
              />
              <FeatureToggleItem
                icon={<Trophy className="w-4 h-4 text-amber-500" />}
                title={t.settingsModuleChallenges}
                description={t.settingsModuleChallengesDesc}
                enabled={isFeatureEnabled('challenges')}
                onToggle={(enabled) => setFlag('challenges', enabled)}
                isLocked={!isFeatureUnlocked('challenges')}
                lockedMessage={t.settingsModuleUnlockHint}
              />
              <FeatureToggleItem
                icon={<Bot className="w-4 h-4 text-violet-500" />}
                title={t.settingsModuleAICoach}
                description={t.settingsModuleAICoachDesc}
                enabled={isFeatureEnabled('aiCoach')}
                onToggle={(enabled) => setFlag('aiCoach', enabled)}
              />
              <FeatureToggleItem
                icon={<Flower2 className="w-4 h-4 text-green-500" />}
                title={t.settingsModuleGarden}
                description={t.settingsModuleGardenDesc}
                enabled={isFeatureEnabled('innerWorld')}
                onToggle={(enabled) => setFlag('innerWorld', enabled)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Group 2: Notifications */}
        <AccordionItem value="notifications" className="bg-card rounded-2xl zen-shadow-card border-none overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">{t.settingsGroupNotifications}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4">
              {/* Enable Reminders Toggle */}
              <div className="flex items-start justify-between gap-4 p-4 bg-secondary/50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.enableReminders || 'Enable Reminders'}</p>
                  <p className="text-xs text-muted-foreground">{t.remindersDescription || 'Get gentle nudges throughout the day'}</p>
                </div>
                <Switch checked={reminders.enabled} onCheckedChange={handleRemindersToggle} aria-label={t.enableReminders} className="mt-0.5 shrink-0" />
              </div>

        {/* Reminder Times - Only show when enabled */}
        {reminders.enabled && (
          <div className="space-y-4 animate-fade-in">
            {/* Mood Reminders - 3 times per day */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <span className="text-lg">😊</span>
                {t.moodReminder}
              </p>

              {/* Morning */}
              <div className="flex items-center justify-between gap-3 pl-7">
                <span className="text-sm text-muted-foreground">{t.morning || 'Morning'} 🌅</span>
                <input
                  type="time"
                  value={reminders.moodTimeMorning || '09:00'}
                  onChange={(e) => onRemindersChange(prev => ({ ...prev, moodTimeMorning: e.target.value }))}
                  className="px-3 py-2 bg-secondary rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Afternoon */}
              <div className="flex items-center justify-between gap-3 pl-7">
                <span className="text-sm text-muted-foreground">{t.afternoon || 'Afternoon'} ☀️</span>
                <input
                  type="time"
                  value={reminders.moodTimeAfternoon || '14:00'}
                  onChange={(e) => onRemindersChange(prev => ({ ...prev, moodTimeAfternoon: e.target.value }))}
                  className="px-3 py-2 bg-secondary rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Evening */}
              <div className="flex items-center justify-between gap-3 pl-7">
                <span className="text-sm text-muted-foreground">{t.evening || 'Evening'} 🌙</span>
                <input
                  type="time"
                  value={reminders.moodTimeEvening || '20:00'}
                  onChange={(e) => onRemindersChange(prev => ({ ...prev, moodTimeEvening: e.target.value }))}
                  className="px-3 py-2 bg-secondary rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Habit Reminder Time */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <span className="text-sm text-foreground">{t.habitReminder}</span>
              </div>
              <input
                type="time"
                value={reminders.habitTime}
                onChange={(e) => onRemindersChange(prev => ({ ...prev, habitTime: e.target.value }))}
                className="px-3 py-2 bg-secondary rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Focus Reminder Time */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <span className="text-sm text-foreground">{t.focusReminder}</span>
              </div>
              <input
                type="time"
                value={reminders.focusTime}
                onChange={(e) => onRemindersChange(prev => ({ ...prev, focusTime: e.target.value }))}
                className="px-3 py-2 bg-secondary rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Reminder Days */}
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">{t.reminderDays}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t.reminderDays}>
                {dayOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      onRemindersChange(prev => ({
                        ...prev,
                        days: prev.days.includes(value)
                          ? prev.days.filter(d => d !== value)
                          : [...prev.days, value].sort((a, b) => a - b)
                      }));
                    }}
                    aria-pressed={reminders.days.includes(value)}
                    aria-label={label}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      reminders.days.includes(value)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Smart Reminders Suggestions */}
        {reminders.enabled && (
          <SmartRemindersCard
            currentSettings={reminders}
            moods={moods}
            habits={habits}
            focusSessions={focusSessions}
            onApplySuggestion={(type, time) => {
              if (type === 'mood') {
                onRemindersChange(prev => ({ ...prev, moodTimeMorning: time }));
              } else if (type === 'habit') {
                onRemindersChange(prev => ({ ...prev, habitTime: time }));
              } else if (type === 'focus') {
                onRemindersChange(prev => ({ ...prev, focusTime: time }));
              }
            }}
            className="mt-4"
          />
        )}

        {/* Per-Habit Reminders Info */}
        <div className="p-4 bg-primary/10 rounded-xl border-2 border-primary/20 mt-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {t.perHabitRemindersTitle || 'Per-Habit Reminders'}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.perHabitRemindersDesc || 'Each habit can have its own custom reminder times. Set them when creating a new habit or by editing an existing one.'}
              </p>
            </div>
          </div>
        </div>

        {/* Test Notification Button - Only on native */}
        {Capacitor.isNativePlatform() && (
          <div className="space-y-2 mt-4">
            <button
              onClick={handleTestNotification}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <TestTube className="w-4 h-4" />
              {t.testNotification || 'Test Notification'}
            </button>
            {notificationTestStatus && (
              <p className="text-sm text-center text-muted-foreground">{notificationTestStatus}</p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              {t.testNotificationHint || 'Sends a test notification in 5 seconds to verify notifications work.'}
            </p>
          </div>
        )}

        {/* Notification Sound Selection - Only on native */}
        {Capacitor.isNativePlatform() && (
          <div className="mt-4 p-4 bg-secondary/50 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <Volume2 className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{t.notificationSound}</p>
                <p className="text-xs text-muted-foreground">{t.notificationSoundDescription}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.notificationSound}>
              {NOTIFICATION_SOUNDS.map((sound) => {
                const soundLabel = t[sound.labelKey] || sound.id;
                return (
                  <button
                    key={sound.id}
                    onClick={() => handleSoundChange(sound.id)}
                    aria-pressed={selectedSound === sound.id}
                    aria-label={soundLabel}
                    className={cn(
                      'p-3 rounded-xl text-left transition-all',
                      selectedSound === sound.id
                        ? 'bg-primary/10 ring-2 ring-primary'
                        : 'bg-card hover:bg-muted'
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {soundLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t[`${sound.labelKey}Desc`] || sound.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Health Connect Integration */}
        <HealthConnectCard
          className="mt-4"
          syncEnabled={localStorage.getItem('zenflow_health_connect_sync') === 'true'}
          onSyncSettingChange={(enabled) => {
            localStorage.setItem('zenflow_health_connect_sync', String(enabled));
          }}
        />

        {/* Quick Actions for Lock Screen (Android only) */}
        {isAndroid && (
          <div className="mt-4 p-4 bg-secondary/50 rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t.quickActions}</p>
                  <p className="text-xs text-muted-foreground">{t.quickActionsDescription}</p>
                </div>
              </div>
              <Switch
                checked={quickActionsEnabled}
                onCheckedChange={toggleQuickActions}
                aria-label={t.quickActions}
                className="mt-0.5 shrink-0"
              />
            </div>
            {quickActionsEnabled && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {t.quickActionsEnabled}
              </p>
            )}
          </div>
        )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Group 3: Data & Privacy */}
        <AccordionItem value="data" className="bg-card rounded-2xl zen-shadow-card border-none overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">{t.settingsGroupData}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4">
              {/* Info message */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  {t.settingsExportDescription || 'Your data is stored locally on your device. Export backups regularly to prevent data loss.'}
                </p>
              </div>

              <div className="space-y-3">
          {/* Export button - Primary style */}
          <button
            onClick={handleExport}
            className="w-full py-4 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity zen-shadow-sm flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            <span>{t.settingsExportTitle || t.exportData}</span>
          </button>

          {/* Export CSV and PDF buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => exportAllToCSV({ moods, habits, focusSessions, gratitudeEntries })}
              className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t.exportCSV || 'CSV'}</span>
            </button>
            <button
              onClick={() => exportProgressReportPDF({ moods, habits, focusSessions, gratitudeEntries, userName })}
              className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>{t.exportPDF || 'PDF Report'}</span>
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">{t.importMode}</label>
            <div className="flex gap-2 mb-2" role="group" aria-label={t.importMode}>
              <button
                onClick={() => setImportMode('merge')}
                aria-pressed={importMode === 'merge'}
                aria-label={t.importMerge}
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
                aria-pressed={importMode === 'replace'}
                aria-label={t.importReplace}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                  importMode === 'replace'
                    ? "bg-destructive/10 ring-2 ring-destructive text-destructive"
                    : "bg-secondary text-muted-foreground hover:bg-muted"
                )}
              >
                {t.importReplace}
              </button>
            </div>
            {/* Tooltips text */}
            <p className="text-xs text-muted-foreground">
              {importMode === 'merge'
                ? (t.settingsImportMergeTooltip || 'Imported data will be added to existing. Duplicates skipped.')
                : (t.settingsImportReplaceTooltip || '⚠️ All current data will be deleted and replaced with import')
              }
            </p>
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
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              <span>{t.settingsImportTitle || t.importData}</span>
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

              {/* Privacy Section inside Data group */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{t.privacyTitle}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{t.privacyDescription}</p>

                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4 p-4 bg-secondary/50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.privacyNoTracking}</p>
                      <p className="text-xs text-muted-foreground">{t.privacyNoTrackingHint}</p>
                    </div>
                    <Switch checked={privacy.noTracking} onCheckedChange={handleNoTrackingChange} aria-label={t.privacyNoTracking} className="mt-0.5 shrink-0" />
                  </div>

                  <div className="flex items-start justify-between gap-4 p-4 bg-secondary/50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.privacyAnalytics}</p>
                      <p className="text-xs text-muted-foreground">{t.privacyAnalyticsHint}</p>
                    </div>
                    <Switch checked={privacy.analytics} onCheckedChange={handleAnalyticsChange} aria-label={t.privacyAnalytics} className="mt-0.5 shrink-0" />
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
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Group 4: Account */}
        <AccordionItem value="account" className="bg-card rounded-2xl zen-shadow-card border-none overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Cloud className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">{t.settingsGroupAccount}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <p className="text-muted-foreground mb-4">{t.accountDescription}</p>

        {!supabase ? (
          <p className="text-sm text-muted-foreground">{t.cloudSyncDisabled}</p>
        ) : sessionEmail ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t.signedInAs} <span className="text-foreground font-medium">{sessionEmail}</span>
            </p>

            {/* Cloud Sync Toggle */}
            <div className="p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <Cloud className={cn(
                    "w-5 h-5 shrink-0",
                    cloudSyncEnabled ? "text-green-500" : "text-muted-foreground"
                  )} />
                  <span className="font-medium text-foreground">
                    {t.settingsCloudSyncTitle}
                  </span>
                </div>
                <Switch
                  checked={cloudSyncEnabled}
                  onCheckedChange={handleCloudSyncToggle}
                  aria-label={t.settingsCloudSyncTitle}
                  className="shrink-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.settingsCloudSyncDescription}
              </p>
              {cloudSyncEnabled && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>{t.settingsCloudSyncEnabled}</span>
                </div>
              )}
            </div>

            {/* Weekly Digest Toggle */}
            <div className="p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <Mail className={cn(
                    "w-5 h-5 shrink-0",
                    weeklyDigestEnabled ? "text-green-500" : "text-muted-foreground"
                  )} />
                  <span className="font-medium text-foreground">
                    {t.weeklyDigestTitle || 'Weekly Progress Report'}
                  </span>
                </div>
                <Switch
                  checked={weeklyDigestEnabled}
                  onCheckedChange={(checked) => {
                    weeklyDigestTouchedRef.current = true;
                    setWeeklyDigestEnabled(checked); // Optimistic update
                    handleWeeklyDigestToggle(checked);
                  }}
                  disabled={weeklyDigestLoading}
                  aria-label={t.weeklyDigestTitle}
                  className="shrink-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.weeklyDigestDescription || 'Receive a weekly summary of your habits, focus time, and mood trends every Sunday.'}
              </p>
              {weeklyDigestEnabled && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>{t.weeklyDigestEnabled || 'You\'ll receive reports at your email'}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleSync}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
              disabled={!cloudSyncEnabled}
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
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setDeleteConfirmInput(''); // P1 Fix: Reset input on open
                }}
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
                {/* P1 Fix: Require typing DELETE to confirm */}
                <div>
                  <label className="text-xs text-destructive font-medium block mb-1">
                    {t.deleteAccountTypeConfirm || 'Type DELETE to confirm:'}
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder="DELETE"
                    className="w-full p-2 bg-secondary rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmInput('');
                    }}
                    className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmInput !== 'DELETE'}
                    className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
              aria-label={t.emailPlaceholder || 'Email address'}
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
          </AccordionContent>
        </AccordionItem>

        {/* Group 5: About */}
        <AccordionItem value="about" className="bg-card rounded-2xl zen-shadow-card border-none overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">{t.settingsGroupAbout}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4">
              {/* Version Info */}
              <div className="text-center text-muted-foreground py-2">
                <p className="text-sm font-medium text-foreground">{t.appName} v{APP_VERSION}</p>
                <p className="text-xs mt-1">{t.tagline}</p>
              </div>

              {/* Version History Button */}
              <button
                onClick={() => setShowChangelog(true)}
                className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <History className="w-4 h-4" />
                {t.changelogTitle || 'Version History'}
              </button>

              {/* Check for Updates Button - Only on native */}
              {Capacitor.isNativePlatform() && (
                <div className="space-y-3">
                  <button
                    onClick={handleCheckForUpdates}
                    disabled={updateCheckStatus === 'checking'}
                    className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${updateCheckStatus === 'checking' ? 'animate-spin' : ''}`} />
                    {updateCheckStatus === 'checking'
                      ? (t.checkingForUpdates || 'Checking...')
                      : (t.checkForUpdates || 'Check for Updates')
                    }
                  </button>

                  {/* Update Status Messages */}
                  {updateCheckStatus === 'latest' && (
                    <p className="text-sm text-center text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      {t.appUpToDate || 'App is up to date'}
                    </p>
                  )}

                  {updateCheckStatus === 'available' && updateState && (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                      <p className="text-sm font-medium text-foreground text-center mb-2">
                        {t.updateAvailable || 'Update Available'}
                        {updateState.latestVersion && (
                          <span className="text-primary ml-1">v{updateState.latestVersion}</span>
                        )}
                      </p>
                      {updateState.releaseNotes && (
                        <p className="text-xs text-muted-foreground text-center mb-2">{updateState.releaseNotes}</p>
                      )}
                      <button
                        onClick={handleOpenGooglePlay}
                        className="w-full py-2 zen-gradient text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {t.openGooglePlay || 'Open Google Play'}
                      </button>
                    </div>
                  )}

                  {updateCheckStatus === 'error' && (
                    <p className="text-sm text-center text-muted-foreground">
                      {t.updateCheckFailed || 'Could not check for updates. Try again later.'}
                    </p>
                  )}
                </div>
              )}

              {/* Feedback Button */}
              <button
                onClick={() => setShowFeedback(true)}
                className="w-full flex items-center justify-between py-3 px-4 bg-secondary rounded-xl hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <span className="font-medium">{t.sendFeedback}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Standalone: Widget Settings */}
      {onOpenWidgetSettings && (
        <button
          onClick={onOpenWidgetSettings}
          className="w-full bg-card rounded-2xl p-5 zen-shadow-card hover:bg-accent/5 transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-primary" />
              <div>
                <h3 className="text-base font-semibold text-foreground">{t.widgetSettings || 'Widget Settings'}</h3>
                <p className="text-xs text-muted-foreground">{t.widgetSettingsDesc || 'Configure widgets for your home screen'}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
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
            className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            {t.installNow}
          </button>
        </div>
      )}

      {/* Modals */}
      {/* Feedback Form */}
      <FeedbackForm open={showFeedback} onOpenChange={setShowFeedback} />

      {/* Dopamine Settings Modal */}
      {showDopamineSettings && (
        <DopamineSettingsComponent onClose={() => setShowDopamineSettings(false)} />
      )}

      {/* Changelog Panel */}
      {showChangelog && (
        <ChangelogPanel onClose={() => setShowChangelog(false)} />
      )}
    </div>
  );
}
