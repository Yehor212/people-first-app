import { useState } from 'react';
import { Bell, CheckCircle, Zap, Volume2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { TimeInputInline } from '@/components/ui/time-input';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SmartRemindersCard } from '@/components/SmartRemindersCard';
import { useQuickActions } from '@/hooks/useQuickActions';
import { NOTIFICATION_SOUNDS, getNotificationSound, setNotificationSound, NotificationSoundType } from '@/lib/notificationSounds';
import type { ReminderSettings, MoodEntry, Habit, FocusSession } from '@/types';

interface NotificationsSectionProps {
  reminders: ReminderSettings;
  onRemindersChange: (value: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings)) => void;
  moods?: MoodEntry[];
  habits: Habit[];
  focusSessions?: FocusSession[];
}

export function NotificationsSection({
  reminders,
  onRemindersChange,
  moods = [],
  habits,
  focusSessions = [],
}: NotificationsSectionProps) {
  const { t } = useLanguage();

  // Quick Actions for lock screen (Android only)
  const { isEnabled: quickActionsEnabled, isAndroid, toggle: toggleQuickActions } = useQuickActions();

  // Notification sound preference
  const [selectedSound, setSelectedSound] = useState<NotificationSoundType>(() => getNotificationSound());

  const handleSoundChange = (sound: NotificationSoundType) => {
    setSelectedSound(sound);
    setNotificationSound(sound);
  };

  const handleRemindersToggle = (checked: boolean) => {
    onRemindersChange((prev) => ({ ...prev, enabled: checked }));
  };

  const dayOptions = [
    { value: 1, label: t.mon },
    { value: 2, label: t.tue },
    { value: 3, label: t.wed },
    { value: 4, label: t.thu },
    { value: 5, label: t.fri },
    { value: 6, label: t.sat },
    { value: 0, label: t.sun },
  ];

  return (
    <AccordionItem value="notifications" className="bg-card rounded-2xl shadow-zen-sm border overflow-hidden">
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="p-2 zen-gradient-warm rounded-xl shadow-[0_4px_20px_-4px_hsl(28_75%_65%/0.25)]">
            <Bell className="w-5 h-5 text-primary-foreground" />
          </div>
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
            <div className="space-y-4 motion-safe:animate-fade-in">
              {/* Mood Reminders - 3 times per day */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <span className="text-lg">😊</span>
                  {t.moodReminder}
                </p>

                {/* Morning */}
                <TimeInputInline
                  icon="🌅"
                  label={t.morning || 'Morning'}
                  value={reminders.moodTimeMorning || '09:00'}
                  onChange={(value) => onRemindersChange(prev => ({ ...prev, moodTimeMorning: value }))}
                  className="ms-4"
                />

                {/* Afternoon */}
                <TimeInputInline
                  icon="☀️"
                  label={t.afternoon || 'Afternoon'}
                  value={reminders.moodTimeAfternoon || '14:00'}
                  onChange={(value) => onRemindersChange(prev => ({ ...prev, moodTimeAfternoon: value }))}
                  className="ms-4"
                />

                {/* Evening */}
                <TimeInputInline
                  icon="🌙"
                  label={t.evening || 'Evening'}
                  value={reminders.moodTimeEvening || '20:00'}
                  onChange={(value) => onRemindersChange(prev => ({ ...prev, moodTimeEvening: value }))}
                  className="ms-4"
                />
              </div>

              {/* Habit Reminder Time */}
              <div className="pt-2 border-t border-border">
                <TimeInputInline
                  icon="✨"
                  label={t.habitReminder}
                  value={reminders.habitTime}
                  onChange={(value) => onRemindersChange(prev => ({ ...prev, habitTime: value }))}
                />
              </div>

              {/* Focus Reminder Time */}
              <TimeInputInline
                icon="🎯"
                label={t.focusReminder}
                value={reminders.focusTime}
                onChange={(value) => onRemindersChange(prev => ({ ...prev, focusTime: value }))}
              />

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
                        "px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
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
                        'p-3 rounded-xl text-start transition-all',
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
  );
}
