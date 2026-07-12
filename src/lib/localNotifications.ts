/**
 * Local Notifications Manager
 *
 * Handles scheduling and managing local notifications for:
 * - Habit reminders
 * - Mood check-ins
 * - Focus session alerts
 * - Daily digests
 *
 * IMPORTANT: Android Notification Channel Behavior (Android 8+)
 * ============================================================
 * Android notification channels are IMMUTABLE after first creation.
 * The following properties CANNOT be changed programmatically once set:
 *   - importance/priority level
 *   - sound
 *   - vibration pattern
 *   - lights
 *
 * To change these settings for existing users:
 * 1. Create a NEW channel with a versioned ID
 * 2. Update all notification code to use the new channel ID
 * 3. Tell users that Android system notification settings remain in control
 *
 * Users can always manually adjust settings in Android System Settings.
 * See: https://developer.android.com/develop/ui/views/notifications/channels
 */

import {
  LocalNotifications,
  type ActionPerformed,
  type LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { isNative } from '@/lib/platform';
import { logger } from './logger';
import { ReminderSettings, Habit, MoodType } from '@/types';
import {
  getCurrentChannelId,
  initializeNotificationChannels,
  type NotificationChannelCopy,
} from './notificationSounds';
import { parseTime } from './timeUtils';
import { QUICK_ACTIONS_NOTIFICATION_ID } from './notificationIds';
import { getCurrentSessionUserId } from './supabaseClient';

let accountNotificationGeneration = 0;
let accountNotificationsSuspended = false;
const inFlightAccountSchedules = new Set<Promise<unknown>>();

interface ReminderScheduleSnapshot {
  generation: number;
  ownerUserId: string | null;
  notifications: LocalNotificationSchema[];
}

let lastSuccessfulReminderSchedule: ReminderScheduleSnapshot | null = null;

interface MoodActionRegistration {
  callback: MoodActionCallback;
  generation: number;
  ownerUserId: string | null;
}

let moodActionRegistration: MoodActionRegistration | null = null;
let moodActionListenerEpoch = 0;

function isAccountScheduleCurrent(generation: number): boolean {
  return !accountNotificationsSuspended && generation === accountNotificationGeneration;
}

async function trackAccountSchedule<T>(
  operation: (generation: number) => Promise<T>,
): Promise<T | undefined> {
  if (accountNotificationsSuspended) return;
  const generation = accountNotificationGeneration;
  const task = operation(generation);
  inFlightAccountSchedules.add(task);
  try {
    return await task;
  } finally {
    inFlightAccountSchedules.delete(task);
  }
}

export function resumeAccountNotifications(): void {
  accountNotificationsSuspended = false;
  accountNotificationGeneration += 1;
  lastSuccessfulReminderSchedule = null;
}

/** Stop all account-owned schedules and remove already visible private copy. */
export async function clearAccountNotificationsForBoundary(): Promise<void> {
  if (!isNative) return;
  accountNotificationsSuspended = true;
  accountNotificationGeneration += 1;
  lastSuccessfulReminderSchedule = null;
  moodActionRegistration = null;
  await Promise.allSettled([...inFlightAccountSchedules]);

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }
  await LocalNotifications.removeAllDeliveredNotifications();
  await PushNotifications.removeAllDeliveredNotifications();
}

/**
 * Get the active channel ID based on user's sound preference
 */
function getActiveChannelId(): string {
  return getCurrentChannelId();
}

/**
 * Initialize notification channel for Android 8+
 * MUST be called before scheduling any notifications
 * Now initializes multiple channels for different sound options
 */
export async function initializeNotificationChannel(
  copy?: NotificationChannelCopy,
): Promise<void> {
  if (!isNative) return;

  try {
    await initializeNotificationChannels(copy);
    logger.log('[Notifications] Sound channels initialized');
  } catch (error) {
    logger.error('[Notifications] Failed to initialize channels:', error);
    throw error;
  }
}

/**
 * Check if notifications are properly configured
 */
export async function checkNotificationStatus(): Promise<{
  hasPermission: boolean;
  pendingCount: number;
  channelExists: boolean;
}> {
  if (!isNative) {
    return { hasPermission: false, pendingCount: 0, channelExists: false };
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
    const pending = await LocalNotifications.getPending();

    // Try to get channels (Android only)
    let channelExists = true;
    try {
      const activeChannelId = getActiveChannelId();
      const channels = await LocalNotifications.listChannels();
      channelExists = channels.channels.some(c => c.id === activeChannelId);
    } catch {
      // listChannels might not be available on all platforms
    }

    const status = {
      hasPermission: permission.display === 'granted',
      pendingCount: pending.notifications.length,
      channelExists,
    };

    logger.log('[Notifications] Status:', status);
    return status;
  } catch (error) {
    logger.error('[Notifications] Status check failed:', error);
    return { hasPermission: false, pendingCount: 0, channelExists: false };
  }
}

export interface ReminderCopy {
  mood: { title: string; body: string };
  habit: { title: string; body: string };
  focus: { title: string; body: string };
}

export interface ReminderReconcileCopy extends ReminderCopy {
  quickMoodBody: string;
  channelCopy?: NotificationChannelCopy;
}

export interface ReminderReconcileOptions {
  rollbackChannelId?: string;
}

export type ReminderReconcileResult =
  | { status: 'unsupported' | 'disabled' | 'permission-required' | 'superseded'; scheduledCount: 0 }
  | { status: 'scheduled'; scheduledCount: number };

interface GlobalReminderSpec {
  id: number;
  title: string;
  body: string;
  time: { hour: number; minute: number };
}

function toMinutes(time: { hour: number; minute: number }): number {
  return time.hour * 60 + time.minute;
}

function isWithinQuietHours(
  time: { hour: number; minute: number },
  quietHours: ReminderSettings['quietHours'],
): boolean {
  const start = toMinutes(parseTime(quietHours.start, 22, 0));
  const end = toMinutes(parseTime(quietHours.end, 7, 0));
  const current = toMinutes(time);

  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function getSelectedReminderDays(days: number[]): number[] {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (a, b) => a - b,
  );
}

function toCapacitorWeekday(day: number): number {
  return day === 0 ? 1 : day + 1;
}

const JOURNAL_REMINDER_ID = 10;
const QUICK_LOG_NOTIFICATION_ID = 150;
const HABIT_REMINDER_ID_BASE = 1000;
const QUICK_LOG_WEEKDAY_ID_BASE = 9000;
const HABIT_REMINDER_ID_MAX = QUICK_LOG_WEEKDAY_ID_BASE - 1;

function isHabitReminderNotificationId(id: number): boolean {
  return (
    id >= HABIT_REMINDER_ID_BASE &&
    id <= HABIT_REMINDER_ID_MAX &&
    id !== QUICK_ACTIONS_NOTIFICATION_ID
  );
}

function isGlobalReminderNotificationId(id: number): boolean {
  if (id >= 1 && id <= 5) return true;
  for (let baseId = 1; baseId <= 5; baseId += 1) {
    for (let day = 0; day <= 6; day += 1) {
      if (id === baseId * 100 + day) return true;
    }
  }
  return false;
}

function isReminderOwnedNotificationId(id: number): boolean {
  return (
    isGlobalReminderNotificationId(id) ||
    isHabitReminderNotificationId(id) ||
    isQuickLogNotificationId(id)
  );
}

function cloneReminderNotifications(
  notifications: LocalNotificationSchema[],
): LocalNotificationSchema[] {
  return notifications.map((notification) => ({ ...notification }));
}

function haveSameNotificationIds(
  left: LocalNotificationSchema[],
  right: LocalNotificationSchema[],
): boolean {
  if (left.length !== right.length) return false;
  const leftIds = left.map(({ id }) => id).sort((a, b) => a - b);
  const rightIds = right.map(({ id }) => id).sort((a, b) => a - b);
  return leftIds.every((id, index) => id === rightIds[index]);
}

function getRestorableReminderSchedule(
  pendingNotifications: LocalNotificationSchema[],
  generation: number,
  ownerUserId: string | null,
  rollbackChannelId?: string,
): LocalNotificationSchema[] {
  if (
    lastSuccessfulReminderSchedule?.generation === generation &&
    lastSuccessfulReminderSchedule.ownerUserId === ownerUserId &&
    haveSameNotificationIds(
      lastSuccessfulReminderSchedule.notifications,
      pendingNotifications,
    )
  ) {
    return cloneReminderNotifications(lastSuccessfulReminderSchedule.notifications);
  }

  // Capacitor's pending schema omits channelId and actionTypeId. Rehydrate the
  // app-owned semantics so a cold-start rollback remains schedulable.
  return pendingNotifications.map((notification) => ({
    ...notification,
    channelId: rollbackChannelId ?? getActiveChannelId(),
    ...(isQuickLogNotificationId(notification.id)
      ? { actionTypeId: MOOD_ACTION_TYPE_ID }
      : {}),
  }));
}

function rememberReminderSchedule(
  notifications: LocalNotificationSchema[],
  generation: number,
  ownerUserId: string | null,
): void {
  lastSuccessfulReminderSchedule = {
    generation,
    ownerUserId,
    notifications: cloneReminderNotifications(notifications),
  };
}

async function isReminderReconcileContextCurrent(
  generation: number,
  ownerUserId: string | null,
): Promise<boolean> {
  if (!isAccountScheduleCurrent(generation)) return false;
  try {
    return (await getCurrentSessionUserId()) === ownerUserId;
  } catch (error) {
    logger.error('[Notifications] Failed to verify reminder rollback owner:', error);
    return false;
  }
}

async function restoreReminderScheduleAfterFailure(
  attemptedNotifications: LocalNotificationSchema[],
  previousNotifications: LocalNotificationSchema[],
  generation: number,
  ownerUserId: string | null,
): Promise<void> {
  if (!(await isReminderReconcileContextCurrent(generation, ownerUserId))) return;

  if (attemptedNotifications.length > 0) {
    try {
      // A rejected native batch may have scheduled only some IDs. Remove the
      // whole attempted set before restoring the last known-good snapshot.
      await LocalNotifications.cancel({ notifications: attemptedNotifications });
    } catch (error) {
      logger.error('[Notifications] Failed to clear a partial reminder schedule:', error);
    }
  }

  if (!(await isReminderReconcileContextCurrent(generation, ownerUserId))) return;

  if (previousNotifications.length === 0) {
    rememberReminderSchedule([], generation, ownerUserId);
    return;
  }

  try {
    await LocalNotifications.schedule({ notifications: previousNotifications });
    if (await isReminderReconcileContextCurrent(generation, ownerUserId)) {
      rememberReminderSchedule(previousNotifications, generation, ownerUserId);
    }
  } catch (error) {
    logger.error('[Notifications] Failed to restore the previous reminder schedule:', error);
  }
}

function buildGlobalReminderNotifications(
  reminders: ReminderSettings,
  specs: GlobalReminderSpec[],
): Array<{
  id: number;
  title: string;
  body: string;
  channelId: string;
  schedule: { on: { hour: number; minute: number; weekday?: number }; allowWhileIdle: boolean };
}> {
  const days = getSelectedReminderDays(reminders.days);
  const activeSpecs = specs.filter((spec) => !isWithinQuietHours(spec.time, reminders.quietHours));

  if (days.length === 0) {
    return activeSpecs.map((spec) => ({
      id: spec.id,
      title: spec.title,
      body: spec.body,
      channelId: getActiveChannelId(),
      schedule: { on: spec.time, allowWhileIdle: true },
    }));
  }

  return activeSpecs.flatMap((spec) =>
    days.map((day) => ({
      id: spec.id * 100 + day,
      title: spec.title,
      body: spec.body,
      channelId: getActiveChannelId(),
      schedule: { on: { ...spec.time, weekday: toCapacitorWeekday(day) }, allowWhileIdle: true },
    })),
  );
}

// Mood action IDs for one-tap logging
export const MOOD_ACTION_TYPE_ID = 'MOOD_QUICK_LOG';
export const MOOD_ACTIONS = {
  great: 'mood_great',
  good: 'mood_good',
  okay: 'mood_okay',
  bad: 'mood_bad',
  terrible: 'mood_terrible',
} as const;

// Callback type for mood quick-log
export type MoodActionCallback = (mood: MoodType) => void;

async function scheduleLocalRemindersOperation(
  reminders: ReminderSettings,
  copy: ReminderCopy,
  generation: number,
): Promise<void> {
  try {
    await initializeNotificationChannel();

    // Check permission
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      logger.log('Notification permission not granted for local reminders');
      return;
    }

    // Cancel all existing notifications
    const pending = await LocalNotifications.getPending();
    const globalReminderNotifications = pending.notifications.filter((notification) =>
      isGlobalReminderNotificationId(notification.id),
    );
    if (globalReminderNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: globalReminderNotifications });
    }

    if (!reminders.enabled) {
      return;
    }

    // 3 mood reminders: morning, afternoon, evening
    const moodTimeAfternoon = parseTime(reminders.moodTimeAfternoon, 14, 0);
    const moodTimeEvening = parseTime(reminders.moodTimeEvening, 20, 0);
    const focusTime = parseTime(reminders.focusTime, 10, 0);

    const notifications = buildGlobalReminderNotifications(reminders, [
      { id: 2, title: copy.mood.title, body: copy.mood.body, time: moodTimeAfternoon },
      { id: 3, title: copy.mood.title, body: copy.mood.body, time: moodTimeEvening },
      { id: 5, title: copy.focus.title, body: copy.focus.body, time: focusTime },
    ]);

    if (notifications.length === 0) {
      logger.log('No local reminders to schedule outside quiet hours');
      return;
    }

    if (!isAccountScheduleCurrent(generation)) return;
    await LocalNotifications.schedule({ notifications });
    logger.log('Local notifications scheduled successfully');
  } catch (error) {
    logger.error('Failed to schedule local notifications:', error);
  }
}

export function scheduleLocalReminders(
  reminders: ReminderSettings,
  copy: ReminderCopy,
): Promise<void> {
  return trackAccountSchedule((generation) =>
    scheduleLocalRemindersOperation(reminders, copy, generation)
  );
}

/**
 * Schedule push notifications for individual habit reminders
 * Each habit can have multiple reminders with custom times and days
 */
function buildHabitReminderNotifications(
  habits: Habit[],
  translations: { reminderTitle: string; reminderBody: string },
): LocalNotificationSchema[] {
  const notifications: LocalNotificationSchema[] = [];
  let notificationId = HABIT_REMINDER_ID_BASE;
  let habitReminderCapacityReached = false;

  const addHabitNotification = (
    habit: Habit,
    time: { hour: number; minute: number },
    weekday?: number,
  ): void => {
    if (notificationId === QUICK_ACTIONS_NOTIFICATION_ID) {
      notificationId += 1;
    }
    if (notificationId > HABIT_REMINDER_ID_MAX) {
      if (!habitReminderCapacityReached) {
        logger.warn('Habit reminder notification capacity reached; skipping remaining habit reminders');
      }
      habitReminderCapacityReached = true;
      return;
    }

    notifications.push({
      id: notificationId++,
      title: `${habit.icon} ${habit.name}`,
      body: translations.reminderBody.replace('{habit}', habit.name),
      channelId: getActiveChannelId(),
      schedule: {
        on: weekday === undefined ? time : { ...time, weekday },
        allowWhileIdle: true,
      },
    });
  };

  for (const habit of habits) {
    if (habitReminderCapacityReached) break;
    if (!habit.reminders || habit.reminders.length === 0) continue;

    for (const reminder of habit.reminders) {
      if (habitReminderCapacityReached) break;
      if (!reminder.enabled) continue;

      const time = parseTime(reminder.time, 9, 0);
      if (reminder.days && reminder.days.length > 0) {
        for (const day of getSelectedReminderDays(reminder.days)) {
          if (habitReminderCapacityReached) break;
          addHabitNotification(habit, time, toCapacitorWeekday(day));
        }
      } else {
        addHabitNotification(habit, time);
      }
    }
  }

  return notifications;
}

async function scheduleHabitRemindersOperation(
  habits: Habit[],
  translations: { reminderTitle: string; reminderBody: string },
  generation: number,
): Promise<void> {
  try {
    await initializeNotificationChannel();

    // Check permission
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      logger.log('Notification permission not granted for habit reminders');
      return;
    }

    // Cancel only habit reminder notifications; quick mood weekday IDs start at 9000.
    const pending = await LocalNotifications.getPending();
    const habitNotifications = pending.notifications.filter((notification) =>
      isHabitReminderNotificationId(notification.id),
    );
    if (habitNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: habitNotifications });
    }

    const notifications = buildHabitReminderNotifications(habits, translations);

    if (notifications.length > 0) {
      if (!isAccountScheduleCurrent(generation)) return;
      await LocalNotifications.schedule({ notifications });
      logger.log(`Scheduled ${notifications.length} habit reminder notifications`);
    } else {
      logger.log('No habit reminders to schedule');
    }
  } catch (error) {
    logger.error('Failed to schedule habit reminders:', error);
  }
}

export function scheduleHabitReminders(
  habits: Habit[],
  translations: { reminderTitle: string; reminderBody: string },
): Promise<void> {
  return trackAccountSchedule((generation) =>
    scheduleHabitRemindersOperation(habits, translations, generation)
  );
}

/**
 * Register notification action types for one-tap mood logging
 * This creates action buttons that appear on mood notifications
 */
export async function registerMoodNotificationActions(): Promise<void> {
  try {
    // Register action type with mood emoji buttons
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: MOOD_ACTION_TYPE_ID,
          actions: [
            { id: MOOD_ACTIONS.great, title: '😄' },
            { id: MOOD_ACTIONS.good, title: '🙂' },
            { id: MOOD_ACTIONS.okay, title: '😐' },
            { id: MOOD_ACTIONS.bad, title: '😔' },
            { id: MOOD_ACTIONS.terrible, title: '😢' },
          ],
        },
      ],
    });
    logger.log('Mood notification actions registered');
  } catch (error) {
    logger.error('Failed to register mood notification actions:', error);
  }
}

/**
 * Set up listener for notification action taps
 * Call this once during app initialization
 */
export async function setupNotificationActionListener(): Promise<() => Promise<void>> {
  const listenerEpoch = ++moodActionListenerEpoch;
  const listener = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    async (action: ActionPerformed) => {
      const actionId = action.actionId;

      // Check if this is a mood action
      const moodEntry = Object.entries(MOOD_ACTIONS).find(
        ([, id]) => id === actionId
      );

      const registration = moodActionRegistration;
      if (!moodEntry || !registration || accountNotificationsSuspended) return;

      const extra = action.notification.extra as Record<string, unknown> | undefined;
      if (
        extra?.zenflowAccountGeneration !== registration.generation ||
        extra?.zenflowAccountOwnerId !== registration.ownerUserId ||
        registration.generation !== accountNotificationGeneration
      ) return;

      const activeOwnerUserId = await getCurrentSessionUserId();
      if (
        accountNotificationsSuspended ||
        moodActionRegistration !== registration ||
        registration.generation !== accountNotificationGeneration ||
        activeOwnerUserId !== registration.ownerUserId
      ) return;

      const moodType = moodEntry[0] as MoodType;
      logger.log('Quick mood logged:', moodType);
      registration.callback(moodType);
    }
  );

  return async () => {
    await listener.remove();
    if (listenerEpoch === moodActionListenerEpoch) {
      moodActionRegistration = null;
    }
  };
}

/**
 * Register callback for handling quick mood actions
 * This should be called from the main app component
 */
export function setMoodActionCallback(
  callback: MoodActionCallback,
  expectedOwnerUserId: string | null,
): void {
  if (accountNotificationsSuspended) return;
  moodActionRegistration = {
    callback,
    generation: accountNotificationGeneration,
    ownerUserId: expectedOwnerUserId,
  };
}

export function clearMoodActionCallback(callback?: MoodActionCallback): void {
  if (!callback || moodActionRegistration?.callback === callback) {
    moodActionRegistration = null;
  }
}

/**
 * Schedule mood notification with quick-log action buttons
 */
// ====== Journal Reminder ======
type ReminderSchedulePolicy = Pick<ReminderSettings, 'days' | 'quietHours'>;

function isQuickLogNotificationId(id: number): boolean {
  return id === QUICK_LOG_NOTIFICATION_ID || (id >= QUICK_LOG_WEEKDAY_ID_BASE && id <= QUICK_LOG_WEEKDAY_ID_BASE + 6);
}

function buildMoodQuickLogNotifications(
  time: { hour: number; minute: number },
  message: string,
  policy: ReminderSchedulePolicy | undefined,
  generation: number,
  ownerUserId: string | null,
): LocalNotificationSchema[] {
  if (policy && isWithinQuietHours(time, policy.quietHours)) {
    return [];
  }

  const notificationAccountContext = {
    zenflowAccountGeneration: generation,
    zenflowAccountOwnerId: ownerUserId,
  };
  const days = policy ? getSelectedReminderDays(policy.days) : [];
  if (days.length === 0) {
    return [
      {
        id: QUICK_LOG_NOTIFICATION_ID,
        title: '💜 ZenFlow',
        body: message,
        channelId: getActiveChannelId(),
        schedule: { on: time, every: 'day', allowWhileIdle: true },
        actionTypeId: MOOD_ACTION_TYPE_ID,
        extra: notificationAccountContext,
      },
    ];
  }

  return days.map((day) => ({
    id: QUICK_LOG_WEEKDAY_ID_BASE + day,
    title: '💜 ZenFlow',
    body: message,
    channelId: getActiveChannelId(),
    schedule: {
      on: { ...time, weekday: toCapacitorWeekday(day) },
      allowWhileIdle: true,
    },
    actionTypeId: MOOD_ACTION_TYPE_ID,
    extra: notificationAccountContext,
  }));
}

async function scheduleJournalReminderOperation(
  time: { hour: number; minute: number },
  copy: { title: string; body: string },
  generation: number,
): Promise<void> {
  if (!isNative) return;

  try {
    await initializeNotificationChannel();

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return;

    // Cancel existing journal reminder
    await cancelJournalReminder();

    if (!isAccountScheduleCurrent(generation)) return;
    await LocalNotifications.schedule({
      notifications: [{
        id: JOURNAL_REMINDER_ID,
        title: copy.title,
        body: copy.body,
        channelId: getActiveChannelId(),
        schedule: { on: time, every: 'day', allowWhileIdle: true },
      }],
    });

    logger.log('[Notifications] Journal reminder scheduled for', `${time.hour}:${time.minute}`);
  } catch (error) {
    logger.error('[Notifications] Failed to schedule journal reminder:', error);
  }
}

export function scheduleJournalReminder(
  time: { hour: number; minute: number },
  copy: { title: string; body: string },
): Promise<void> {
  return trackAccountSchedule((generation) =>
    scheduleJournalReminderOperation(time, copy, generation)
  );
}

export async function cancelJournalReminder(): Promise<void> {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    const journalNotifs = pending.notifications.filter(n => n.id === JOURNAL_REMINDER_ID);
    if (journalNotifs.length > 0) {
      await LocalNotifications.cancel({ notifications: journalNotifs });
    }
  } catch (error) {
    logger.error('[Notifications] Failed to cancel journal reminder:', error);
  }
}

async function scheduleMoodQuickLogNotificationOperation(
  time: { hour: number; minute: number },
  message: string,
  policy?: ReminderSchedulePolicy,
  generation?: number,
): Promise<void> {
  if (!isNative) return;
  try {
    const ownerUserId = await getCurrentSessionUserId();
    await initializeNotificationChannel();

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      return;
    }

    const pending = await LocalNotifications.getPending();
    const quickLogNotifications = pending.notifications.filter((notification) =>
      isQuickLogNotificationId(notification.id),
    );
    if (quickLogNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: quickLogNotifications });
    }

    const notifications = buildMoodQuickLogNotifications(
      time,
      message,
      policy,
      generation ?? -1,
      ownerUserId,
    );
    if (notifications.length === 0) {
      logger.log('Mood quick-log notification skipped during quiet hours');
      return;
    }

    if (generation === undefined || !isAccountScheduleCurrent(generation)) return;
    if ((await getCurrentSessionUserId()) !== ownerUserId) return;
    await LocalNotifications.schedule({
      notifications,
    });

    logger.log('Mood quick-log notification scheduled');
  } catch (error) {
    logger.error('Failed to schedule mood quick-log notification:', error);
  }
}

export function scheduleMoodQuickLogNotification(
  time: { hour: number; minute: number },
  message: string,
  policy?: ReminderSchedulePolicy,
): Promise<void> {
  return trackAccountSchedule((generation) =>
    scheduleMoodQuickLogNotificationOperation(time, message, policy, generation)
  );
}

export async function cancelMoodQuickLogNotification(): Promise<void> {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    const quickLogNotifications = pending.notifications.filter((notification) =>
      isQuickLogNotificationId(notification.id)
    );
    if (quickLogNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: quickLogNotifications });
    }
  } catch (error) {
    logger.error('Failed to cancel mood quick-log notification:', error);
  }
}

let reminderReconcileTail: Promise<unknown> = Promise.resolve();

/**
 * The single production owner for the master reminder schedule. Calls are
 * serialized so rapid preference changes converge on the newest complete
 * cancel-then-schedule pass instead of leaving a mixture of two states.
 */
export async function reconcileReminderNotifications(
  reminders: ReminderSettings,
  habits: Habit[],
  copy: ReminderReconcileCopy,
  options: ReminderReconcileOptions = {},
): Promise<ReminderReconcileResult> {
  if (!isNative) return { status: 'unsupported', scheduledCount: 0 };

  const previousReconcile = reminderReconcileTail;
  const resultPromise = trackAccountSchedule(async (generation): Promise<ReminderReconcileResult> => {
    await previousReconcile.catch(() => undefined);
    if (!isAccountScheduleCurrent(generation)) {
      return { status: 'superseded', scheduledCount: 0 };
    }
    if (!reminders.enabled) {
      const pending = await LocalNotifications.getPending();
      const ownedNotifications = pending.notifications.filter((notification) =>
        isReminderOwnedNotificationId(notification.id),
      );
      if (ownedNotifications.length > 0) {
        await LocalNotifications.cancel({ notifications: ownedNotifications });
      }
      lastSuccessfulReminderSchedule = null;
      return { status: 'disabled', scheduledCount: 0 };
    }

    // Prepare the native delivery surface before touching the last known-good
    // schedule. A channel failure must not silently cancel existing reminders.
    await initializeNotificationChannel(copy.channelCopy);
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      return { status: 'permission-required', scheduledCount: 0 };
    }

    const ownerUserId = await getCurrentSessionUserId();
    const globalNotifications = buildGlobalReminderNotifications(reminders, [
      {
        id: 2,
        title: copy.mood.title,
        body: copy.mood.body,
        time: parseTime(reminders.moodTimeAfternoon, 14, 0),
      },
      {
        id: 3,
        title: copy.mood.title,
        body: copy.mood.body,
        time: parseTime(reminders.moodTimeEvening, 20, 0),
      },
      {
        id: 5,
        title: copy.focus.title,
        body: copy.focus.body,
        time: parseTime(reminders.focusTime, 10, 0),
      },
    ]);
    const habitNotifications = buildHabitReminderNotifications(habits, {
      reminderTitle: copy.habit.title,
      reminderBody: copy.habit.body,
    });
    const quickMoodNotifications = buildMoodQuickLogNotifications(
      parseTime(reminders.moodTimeMorning, 9, 0),
      copy.quickMoodBody,
      { days: reminders.days, quietHours: reminders.quietHours },
      generation,
      ownerUserId,
    );
    const notifications = [
      ...globalNotifications,
      ...habitNotifications,
      ...quickMoodNotifications,
    ];

    if (
      !isAccountScheduleCurrent(generation) ||
      (await getCurrentSessionUserId()) !== ownerUserId
    ) {
      return { status: 'superseded', scheduledCount: 0 };
    }

    const pending = await LocalNotifications.getPending();
    const ownedNotifications = pending.notifications.filter((notification) =>
      isReminderOwnedNotificationId(notification.id),
    );
    const previousNotifications = getRestorableReminderSchedule(
      ownedNotifications,
      generation,
      ownerUserId,
      options.rollbackChannelId,
    );
    if (ownedNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: ownedNotifications });
    }
    if (
      !isAccountScheduleCurrent(generation) ||
      (await getCurrentSessionUserId()) !== ownerUserId
    ) {
      return { status: 'superseded', scheduledCount: 0 };
    }
    if (notifications.length > 0) {
      try {
        await LocalNotifications.schedule({ notifications });
      } catch (error) {
        await restoreReminderScheduleAfterFailure(
          notifications,
          previousNotifications,
          generation,
          ownerUserId,
        );
        throw error;
      }
    }
    rememberReminderSchedule(notifications, generation, ownerUserId);
    return { status: 'scheduled', scheduledCount: notifications.length };
  });

  reminderReconcileTail = resultPromise.then(
    () => undefined,
    () => undefined,
  );
  return (await resultPromise) ?? { status: 'superseded', scheduledCount: 0 };
}
