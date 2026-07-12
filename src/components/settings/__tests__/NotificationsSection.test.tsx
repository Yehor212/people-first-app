import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Accordion } from '@/components/ui/accordion';
import { NotificationsSection } from '../NotificationsSection';
import { reconcileReminderNotifications } from '@/lib/localNotifications';
import { updateNotificationSound } from '@/lib/notificationSounds';
import type { Habit, ReminderSettings } from '@/types';

vi.mock('@/lib/platform', () => ({
  isNative: true,
}));

vi.mock('@/hooks/useQuickActions', () => ({
  useQuickActions: () => ({
    isEnabled: false,
    isAndroid: true,
    toggle: vi.fn(),
  }),
}));

vi.mock('@/components/SmartRemindersCard', () => ({
  SmartRemindersCard: () => <div data-testid="smart-reminders-card" />,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/localNotifications', () => ({
  reconcileReminderNotifications: vi.fn().mockResolvedValue({
    status: 'scheduled',
    scheduledCount: 1,
  }),
}));

vi.mock('@/lib/notificationSounds', () => ({
  buildNotificationChannelCopy: vi.fn(() => ({})),
  NOTIFICATION_SOUNDS: [
    {
      id: 'default',
      labelKey: 'soundDefault',
      description: 'System notification sound',
    },
    {
      id: 'gentle',
      labelKey: 'soundGentle',
      description: 'Gentle chime',
    },
  ],
  getNotificationSound: vi.fn(() => 'default'),
  getNotificationSystemSettingsCopyKey: vi.fn(() => 'notificationSystemSettingsDescription'),
  updateNotificationSound: vi.fn().mockResolvedValue('zenflow_gentle_v2'),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      settingsGroupNotifications: 'Notifications',
      enableReminders: 'Enable reminders',
      remindersDescription: 'Get gentle nudges throughout the day',
      moodReminder: 'Mood reminder',
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      habitReminder: 'Habit reminder',
      focusReminder: 'Focus reminder',
      reminderDays: 'Reminder days',
      mon: 'Mon',
      tue: 'Tue',
      wed: 'Wed',
      thu: 'Thu',
      fri: 'Fri',
      sat: 'Sat',
      sun: 'Sun',
      reminderMoodTitle: 'Mood check-in',
      reminderMoodBody: 'How are you feeling?',
      reminderHabitTitle: 'Habit reminder',
      reminderHabitBody: 'Remember your habits:',
      reminderFocusTitle: 'Focus reminder',
      reminderFocusBody: 'Time to focus',
      howAreYouNow: 'How are you feeling now?',
      perHabitRemindersTitle: 'Per-Habit Reminders',
      perHabitRemindersDesc: 'Each habit can have reminders.',
      notificationSound: 'Notification sound',
      notificationSoundDescription: 'Choose a reminder sound.',
      notificationSystemSettingsTitle: 'System notification controls',
      notificationSystemSettingsDescription: 'System settings keep final control.',
      quickActions: 'Quick actions',
      quickActionsDescription: 'Use lock screen actions.',
      quickActionsEnabled: 'Quick actions enabled',
      soundDefault: 'Default',
      soundDefaultDesc: 'System notification sound',
      soundGentle: 'Gentle',
      soundGentleDesc: 'Gentle chime',
    },
  }),
}));

const reminders: ReminderSettings = {
  enabled: true,
  moodTimeMorning: '08:15',
  moodTimeAfternoon: '14:00',
  moodTimeEvening: '20:00',
  habitTime: '09:30',
  focusTime: '10:00',
  days: [1, 2, 3, 4, 5],
  habitIds: ['habit-1'],
  quietHours: { start: '22:00', end: '07:00' },
};

const habits: Habit[] = [
  {
    id: 'habit-1',
    name: 'Stretch',
    icon: '✨',
    color: '#10b981',
    completed: false,
    streak: 0,
    entries: {},
    createdAt: '2026-06-30T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
  } as unknown as Habit,
];

function renderNotificationsSection() {
  return render(
    <Accordion type="multiple" defaultValue={["notifications"]}>
      <NotificationsSection
        reminders={reminders}
        onRemindersChange={vi.fn()}
        habits={habits}
      />
    </Accordion>,
  );
}

describe('NotificationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reschedules native reminders after changing notification sound', async () => {
    renderNotificationsSection();

    fireEvent.click(screen.getByRole('button', { name: 'Gentle' }));

    await waitFor(() => {
      expect(updateNotificationSound).toHaveBeenCalledWith('gentle');
      expect(reconcileReminderNotifications).toHaveBeenCalledWith(
        reminders,
        habits,
        expect.objectContaining({
          habit: expect.objectContaining({ body: 'Remember your habits: Stretch' }),
          quickMoodBody: 'How are you feeling now?',
        }),
      );
    });
  });
});
