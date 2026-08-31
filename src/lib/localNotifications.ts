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
import { isNative, platform } from '@/lib/platform';
import { logger } from './logger';
import { ReminderSettings, Habit, MoodType } from '@/types';
import {
  getCurrentChannelId,
  getCurrentSoundOption,
  initializeNotificationChannels,
  NOTIFICATION_SOUNDS,
  type NotificationChannelCopy,
} from './notificationSounds';
import { parseTime } from './timeUtils';
import { QUICK_ACTIONS_NOTIFICATION_ID } from './notificationIds';
import { getCurrentSessionUserId } from './supabaseClient';
import { storageGetRaw, storageSetRaw } from './safeJson';
import { SK } from './storageKeys';
import { normalizeHabitReminderDays } from './habitScheduling';
import {
  assertVerifiedNotificationRealmCurrent,
  readVerifiedNotificationRealm,
} from '@/storage/notificationRealm';

const PRIVATE_CHANNEL_MIGRATION_COMPLETE = 'complete';
const GENERIC_HABIT_COPY_MIGRATION_COMPLETE = 'complete';
const IOS_PENDING_CONFIRMATION_RETRY_DELAYS_MS = [0, 25, 75, 150] as const;

class ReminderPendingIdsUnconfirmedError extends Error {
  constructor(phase: 'replacement' | 'rollback', notifications: LocalNotificationSchema[]) {
    const expectedIds = notifications.map(({ id }) => id).sort((a, b) => a - b);
    super(`iOS ${phase} reminder pending IDs were not confirmed: ${expectedIds.join(',')}`);
    this.name = 'ReminderPendingIdsUnconfirmedError';
  }
}

class ReminderReconcileSupersededError extends Error {
  constructor() {
    super('Reminder reconciliation was superseded during native confirmation');
    this.name = 'ReminderReconcileSupersededError';
  }
}

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

function getNotificationSoundPayload(channelId?: string): { sound?: string } {
  const soundOption = channelId
    ? NOTIFICATION_SOUNDS.find((option) => option.channelId === channelId)
    : getCurrentSoundOption();
  return soundOption?.sound ? { sound: soundOption.sound } : {};
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
  ownerUserId?: string | null;
  moodActionsEnabled?: boolean;
  assertRealmCurrent?: () => Promise<void>;
}

export type ReminderReconcileResult =
  | { status: 'unsupported' | 'disabled' | 'permission-required' | 'superseded'; scheduledCount: 0 }
  | {
      status: 'native-restored' | 'native-uncertain';
      scheduledCount: 0;
      error: unknown;
    }
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

function isReminderCategoryEnabled(
  explicitPreference: boolean | undefined,
  reminders: ReminderSettings,
): boolean {
  // Preserve an already-active legacy schedule until the one-time migration
  // writes explicit category consent. New defaults always provide `false`.
  return explicitPreference ?? reminders.enabled;
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

async function removeLegacyPersonalizedHabitNotifications(
  pendingNotifications: LocalNotificationSchema[],
  assertRealmCurrent: () => Promise<void>,
): Promise<Set<number>> {
  const cancelledPendingIds = new Set<number>();
  if (
    storageGetRaw(SK.NOTIFICATION_GENERIC_HABIT_COPY_MIGRATION) ===
    GENERIC_HABIT_COPY_MIGRATION_COMPLETE
  ) {
    return cancelledPendingIds;
  }

  const pendingHabitNotifications = pendingNotifications.filter(({ id }) =>
    isHabitReminderNotificationId(id),
  );
  if (pendingHabitNotifications.length > 0) {
    await assertRealmCurrent();
    await LocalNotifications.cancel({ notifications: pendingHabitNotifications });
    for (const { id } of pendingHabitNotifications) cancelledPendingIds.add(id);
  }

  await assertRealmCurrent();
  const delivered = await LocalNotifications.getDeliveredNotifications();
  const deliveredHabitNotifications = delivered.notifications.filter(({ id }) =>
    isHabitReminderNotificationId(id),
  );
  if (deliveredHabitNotifications.length > 0) {
    await assertRealmCurrent();
    await LocalNotifications.removeDeliveredNotifications({
      notifications: deliveredHabitNotifications,
    });
  }

  storageSetRaw(
    SK.NOTIFICATION_GENERIC_HABIT_COPY_MIGRATION,
    GENERIC_HABIT_COPY_MIGRATION_COMPLETE,
  );
  return cancelledPendingIds;
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

async function confirmIosPendingReminderIds(
  expectedNotifications: LocalNotificationSchema[],
  assertContextCurrent: () => Promise<void>,
): Promise<boolean> {
  if (platform !== 'ios') return true;

  for (const retryDelayMs of IOS_PENDING_CONFIRMATION_RETRY_DELAYS_MS) {
    if (retryDelayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
    }
    await assertContextCurrent();
    const pending = await LocalNotifications.getPending();
    await assertContextCurrent();
    const pendingReminderNotifications = pending.notifications.filter(({ id }) =>
      isReminderOwnedNotificationId(id),
    );
    if (haveSameNotificationIds(pendingReminderNotifications, expectedNotifications)) {
      return true;
    }
  }

  return false;
}

function getRestorableReminderSchedule(
  pendingNotifications: LocalNotificationSchema[],
  generation: number,
  ownerUserId: string | null,
  moodActionsEnabled: boolean,
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
    ...getNotificationSoundPayload(rollbackChannelId),
    ...(moodActionsEnabled && isQuickLogNotificationId(notification.id)
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
  assertRealmCurrent: () => Promise<void>,
): Promise<boolean> {
  if (!isAccountScheduleCurrent(generation)) return false;
  await assertRealmCurrent();
  return isAccountScheduleCurrent(generation);
}

async function restoreReminderScheduleAfterFailure(
  attemptedNotifications: LocalNotificationSchema[],
  previousNotifications: LocalNotificationSchema[],
  generation: number,
  ownerUserId: string | null,
  assertRealmCurrent: () => Promise<void>,
  confirmPendingIds: (notifications: LocalNotificationSchema[]) => Promise<boolean>,
): Promise<boolean> {
  if (!(await isReminderReconcileContextCurrent(generation, assertRealmCurrent))) return false;
  let restorationCertain = true;

  if (attemptedNotifications.length > 0) {
    try {
      // A rejected native batch may have scheduled only some IDs. Remove the
      // whole attempted set before restoring the last known-good snapshot.
      await assertRealmCurrent();
      await LocalNotifications.cancel({ notifications: attemptedNotifications });
    } catch (error) {
      restorationCertain = false;
      logger.error('[Notifications] Failed to clear a partial reminder schedule:', error);
    }
  }

  if (!(await isReminderReconcileContextCurrent(generation, assertRealmCurrent))) return false;

  if (previousNotifications.length === 0) {
    const rollbackConfirmed = await confirmPendingIds([]);
    if (restorationCertain && rollbackConfirmed) {
      rememberReminderSchedule([], generation, ownerUserId);
    }
    return restorationCertain && rollbackConfirmed;
  }

  try {
    await assertRealmCurrent();
    await LocalNotifications.schedule({ notifications: previousNotifications });
    const rollbackConfirmed = await confirmPendingIds(previousNotifications);
    if (!rollbackConfirmed) {
      logger.error(
        '[Notifications] Previous reminder pending IDs were not confirmed after rollback',
      );
      return false;
    }
    if (await isReminderReconcileContextCurrent(generation, assertRealmCurrent)) {
      if (restorationCertain) {
        rememberReminderSchedule(previousNotifications, generation, ownerUserId);
      }
      return restorationCertain;
    }
    return false;
  } catch (error) {
    if (error instanceof ReminderReconcileSupersededError) throw error;
    logger.error('[Notifications] Failed to restore the previous reminder schedule:', error);
    return false;
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
  sound?: string;
  schedule: { on: { hour: number; minute: number; weekday?: number }; allowWhileIdle: boolean };
}> {
  const days = getSelectedReminderDays(reminders.days);
  const activeSpecs = specs.filter((spec) => !isWithinQuietHours(spec.time, reminders.quietHours));

  if (days.length === 0) return [];

  return activeSpecs.flatMap((spec) =>
    days.map((day) => ({
      id: spec.id * 100 + day,
      title: spec.title,
      body: spec.body,
      channelId: getActiveChannelId(),
      ...getNotificationSoundPayload(),
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
      logger.log('[Notifications] Notification permission not granted for local reminders');
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
      ...(isReminderCategoryEnabled(reminders.moodCheckInsEnabled, reminders)
        ? [
            { id: 2, title: copy.mood.title, body: copy.mood.body, time: moodTimeAfternoon },
            { id: 3, title: copy.mood.title, body: copy.mood.body, time: moodTimeEvening },
          ]
        : []),
      ...(isReminderCategoryEnabled(reminders.focusReminderEnabled, reminders)
        ? [{ id: 5, title: copy.focus.title, body: copy.focus.body, time: focusTime }]
        : []),
    ]);

    if (notifications.length === 0) {
      logger.log('[Notifications] No local reminders to schedule outside quiet hours');
      return;
    }

    if (!isAccountScheduleCurrent(generation)) return;
    await LocalNotifications.schedule({ notifications });
    logger.log('[Notifications] Local notifications scheduled successfully');
  } catch (error) {
    logger.error('[Notifications] Failed to schedule local notifications:', error);
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
        logger.warn('[Notifications] Habit reminder notification capacity reached; skipping remaining habit reminders');
      }
      habitReminderCapacityReached = true;
      return;
    }

    notifications.push({
      id: notificationId++,
      title: translations.reminderTitle,
      body: translations.reminderBody,
      channelId: getActiveChannelId(),
      ...getNotificationSoundPayload(),
      schedule: {
        on: weekday === undefined ? time : { ...time, weekday },
        allowWhileIdle: true,
      },
    });
  };

  for (const habit of habits) {
    if (habitReminderCapacityReached) break;
    if (habit.isArchived) continue;
    if (!habit.reminders || habit.reminders.length === 0) continue;

    for (const reminder of habit.reminders) {
      if (habitReminderCapacityReached) break;
      if (!reminder.enabled) continue;

      const time = parseTime(reminder.time, 9, 0);
      const selectedDays = normalizeHabitReminderDays(reminder.days);
      for (const day of selectedDays) {
        if (habitReminderCapacityReached) break;
        addHabitNotification(habit, time, toCapacitorWeekday(day));
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
      logger.log('[Notifications] Notification permission not granted for habit reminders');
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
      logger.log(`[Notifications] Scheduled ${notifications.length} habit reminder notifications`);
    } else {
      logger.log('[Notifications] No habit reminders to schedule');
    }
  } catch (error) {
    logger.error('[Notifications] Failed to schedule habit reminders:', error);
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
    logger.log('[Notifications] Mood notification actions registered');
  } catch (error) {
    logger.error('[Notifications] Failed to register mood notification actions:', error);
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
      logger.log('[Notifications] Quick mood action completed');
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
  moodActionsEnabled = true,
): LocalNotificationSchema[] {
  if (policy && isWithinQuietHours(time, policy.quietHours)) {
    return [];
  }

  const notificationAccountContext = {
    zenflowAccountGeneration: generation,
    zenflowAccountOwnerId: ownerUserId,
  };
  const days = policy ? getSelectedReminderDays(policy.days) : [];
  if (policy && days.length === 0) return [];
  if (!policy) {
    return [
      {
        id: QUICK_LOG_NOTIFICATION_ID,
        title: '💜 ZenFlow',
        body: message,
        channelId: getActiveChannelId(),
        ...getNotificationSoundPayload(),
        schedule: { on: time, every: 'day', allowWhileIdle: true },
        ...(moodActionsEnabled
          ? { actionTypeId: MOOD_ACTION_TYPE_ID, extra: notificationAccountContext }
          : {}),
      },
    ];
  }

  return days.map((day) => ({
    id: QUICK_LOG_WEEKDAY_ID_BASE + day,
    title: '💜 ZenFlow',
    body: message,
    channelId: getActiveChannelId(),
    ...getNotificationSoundPayload(),
    schedule: {
      on: { ...time, weekday: toCapacitorWeekday(day) },
      allowWhileIdle: true,
    },
    ...(moodActionsEnabled
      ? { actionTypeId: MOOD_ACTION_TYPE_ID, extra: notificationAccountContext }
      : {}),
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
    if (permission.display !== 'granted') {
      throw new Error('Notification permission is not granted');
    }

    // Cancel existing journal reminder
    await cancelJournalReminder();

    if (!isAccountScheduleCurrent(generation)) return;
    await LocalNotifications.schedule({
      notifications: [{
        id: JOURNAL_REMINDER_ID,
        title: copy.title,
        body: copy.body,
        channelId: getActiveChannelId(),
        ...getNotificationSoundPayload(),
        schedule: { on: time, every: 'day', allowWhileIdle: true },
      }],
    });

    logger.log('[Notifications] Journal reminder scheduled for', `${time.hour}:${time.minute}`);
  } catch (error) {
    logger.error('[Notifications] Failed to schedule journal reminder:', error);
    throw error;
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
    throw error;
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
      logger.log('[Notifications] Mood quick-log notification skipped during quiet hours');
      return;
    }

    if (generation === undefined || !isAccountScheduleCurrent(generation)) return;
    if ((await getCurrentSessionUserId()) !== ownerUserId) return;
    await LocalNotifications.schedule({
      notifications,
    });

    logger.log('[Notifications] Mood quick-log notification scheduled');
  } catch (error) {
    logger.error('[Notifications] Failed to schedule mood quick-log notification:', error);
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
    logger.error('[Notifications] Failed to cancel mood quick-log notification:', error);
  }
}

let reminderReconcileTail: Promise<unknown> = Promise.resolve();
let latestReminderReconcileRevision = 0;

interface ResolvedReminderRealm {
  ownerUserId: string | null;
  moodActionsEnabled: boolean;
  assertRealmCurrent: () => Promise<void>;
}

async function resolveReminderRealm(
  options: ReminderReconcileOptions,
): Promise<ResolvedReminderRealm> {
  const hasInjectedRealm =
    Object.prototype.hasOwnProperty.call(options, 'ownerUserId') ||
    options.moodActionsEnabled !== undefined ||
    options.assertRealmCurrent !== undefined;

  if (hasInjectedRealm) {
    if (
      !Object.prototype.hasOwnProperty.call(options, 'ownerUserId') ||
      typeof options.moodActionsEnabled !== 'boolean' ||
      typeof options.assertRealmCurrent !== 'function'
    ) {
      throw new Error('Incomplete notification realm guard');
    }
    return {
      ownerUserId: options.ownerUserId ?? null,
      moodActionsEnabled: options.moodActionsEnabled,
      assertRealmCurrent: options.assertRealmCurrent,
    };
  }

  const realm = await readVerifiedNotificationRealm();
  return {
    ownerUserId: realm.ownerUserId,
    moodActionsEnabled: realm.kind === 'account',
    assertRealmCurrent: () => assertVerifiedNotificationRealmCurrent(realm),
  };
}

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

  const reconcileRevision = ++latestReminderReconcileRevision;
  const previousReconcile = reminderReconcileTail;
  const resultPromise = trackAccountSchedule(async (generation): Promise<ReminderReconcileResult> => {
    await previousReconcile.catch(() => undefined);
    if (
      !isAccountScheduleCurrent(generation) ||
      reconcileRevision !== latestReminderReconcileRevision
    ) {
      return { status: 'superseded', scheduledCount: 0 };
    }
    const realm = await resolveReminderRealm(options);
    if (reconcileRevision !== latestReminderReconcileRevision) {
      return { status: 'superseded', scheduledCount: 0 };
    }
    const assertNativeContextCurrent = async (): Promise<void> => {
      if (!isAccountScheduleCurrent(generation)) {
        throw new Error('Notification reconcile was superseded by an account boundary');
      }
      await realm.assertRealmCurrent();
      if (!isAccountScheduleCurrent(generation)) {
        throw new Error('Notification reconcile was superseded by an account boundary');
      }
    };

    await assertNativeContextCurrent();
    const pendingSnapshot = await LocalNotifications.getPending();
    if (reminders.enabled) {
      // Preparing immutable Android channels must succeed before either migration
      // removes the last known-good native schedule or advances its durable marker.
      await assertNativeContextCurrent();
      await initializeNotificationChannel(copy.channelCopy);
      await assertNativeContextCurrent();
    }
    const migratedPendingIds = await removeLegacyPersonalizedHabitNotifications(
      pendingSnapshot.notifications,
      assertNativeContextCurrent,
    );
    if (!reminders.enabled) {
      const ownedNotifications = pendingSnapshot.notifications.filter(
        (notification) =>
          isReminderOwnedNotificationId(notification.id) &&
          !migratedPendingIds.has(notification.id),
      );
      if (ownedNotifications.length > 0) {
        await assertNativeContextCurrent();
        await LocalNotifications.cancel({ notifications: ownedNotifications });
      }
      lastSuccessfulReminderSchedule = null;
      return { status: 'disabled', scheduledCount: 0 };
    }

    const ownerUserId = realm.ownerUserId;
    const moodCheckInsEnabled = isReminderCategoryEnabled(
      reminders.moodCheckInsEnabled,
      reminders,
    );
    const focusReminderEnabled = isReminderCategoryEnabled(
      reminders.focusReminderEnabled,
      reminders,
    );
    const globalNotifications = buildGlobalReminderNotifications(reminders, [
      ...(moodCheckInsEnabled
        ? [
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
          ]
        : []),
      ...(focusReminderEnabled
        ? [
            {
              id: 5,
              title: copy.focus.title,
              body: copy.focus.body,
              time: parseTime(reminders.focusTime, 10, 0),
            },
          ]
        : []),
    ]);
    const habitNotifications = buildHabitReminderNotifications(habits, {
      reminderTitle: copy.habit.title,
      reminderBody: copy.habit.body,
    });
    const quickMoodNotifications = moodCheckInsEnabled
      ? buildMoodQuickLogNotifications(
          parseTime(reminders.moodTimeMorning, 9, 0),
          copy.quickMoodBody,
          { days: reminders.days, quietHours: reminders.quietHours },
          generation,
          ownerUserId,
          realm.moodActionsEnabled,
        )
      : [];
    const notifications = [
      ...globalNotifications,
      ...habitNotifications,
      ...quickMoodNotifications,
    ];

    const desiredIds = new Set(notifications.map(({ id }) => id));
    const ownedNotifications = pendingSnapshot.notifications.filter((notification) =>
      isReminderOwnedNotificationId(notification.id),
    );
    const privateChannelMigrationPending =
      platform === 'android' &&
      storageGetRaw(SK.NOTIFICATION_PRIVATE_CHANNEL_MIGRATION) !==
        PRIVATE_CHANNEL_MIGRATION_COMPLETE;
    const obsoleteNotifications = ownedNotifications.filter(
      ({ id }) => !desiredIds.has(id),
    );
    const prePermissionCancellation = (privateChannelMigrationPending
      ? ownedNotifications
      : obsoleteNotifications
    ).filter(({ id }) => !migratedPendingIds.has(id));
    if (prePermissionCancellation.length > 0) {
      await assertNativeContextCurrent();
      await LocalNotifications.cancel({ notifications: prePermissionCancellation });
    }
    if (privateChannelMigrationPending) {
      storageSetRaw(
        SK.NOTIFICATION_PRIVATE_CHANNEL_MIGRATION,
        PRIVATE_CHANNEL_MIGRATION_COMPLETE,
      );
    }

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      return { status: 'permission-required', scheduledCount: 0 };
    }

    if (!isAccountScheduleCurrent(generation)) {
      return { status: 'superseded', scheduledCount: 0 };
    }
    await assertNativeContextCurrent();

    const previousDesiredNotifications = ownedNotifications.filter(({ id }) =>
      desiredIds.has(id),
    );
    const previousNotifications = getRestorableReminderSchedule(
      previousDesiredNotifications,
      generation,
      ownerUserId,
      realm.moodActionsEnabled,
      options.rollbackChannelId,
    );
    const preCancelledIds = new Set([
      ...migratedPendingIds,
      ...prePermissionCancellation.map(({ id }) => id),
    ]);
    const remainingOwnedNotifications = ownedNotifications.filter(
      ({ id }) => !preCancelledIds.has(id),
    );
    if (remainingOwnedNotifications.length > 0) {
      await assertNativeContextCurrent();
      await LocalNotifications.cancel({ notifications: remainingOwnedNotifications });
    }
    if (!isAccountScheduleCurrent(generation)) {
      return { status: 'superseded', scheduledCount: 0 };
    }
    await assertNativeContextCurrent();
    const assertPendingConfirmationContextCurrent = async (): Promise<void> => {
      if (reconcileRevision !== latestReminderReconcileRevision) {
        throw new ReminderReconcileSupersededError();
      }
      await assertNativeContextCurrent();
      if (reconcileRevision !== latestReminderReconcileRevision) {
        throw new ReminderReconcileSupersededError();
      }
    };
    const confirmPendingIds = (expectedNotifications: LocalNotificationSchema[]) =>
      confirmIosPendingReminderIds(
        expectedNotifications,
        assertPendingConfirmationContextCurrent,
      );
    try {
      if (notifications.length > 0) {
        await assertNativeContextCurrent();
        await LocalNotifications.schedule({ notifications });
      }
      if (!(await confirmPendingIds(notifications))) {
        throw new ReminderPendingIdsUnconfirmedError('replacement', notifications);
      }
    } catch (error) {
      if (error instanceof ReminderReconcileSupersededError) {
        return { status: 'superseded', scheduledCount: 0 };
      }
      let previousScheduleRestored = false;
      try {
        previousScheduleRestored = await restoreReminderScheduleAfterFailure(
          notifications,
          previousNotifications,
          generation,
          ownerUserId,
          assertNativeContextCurrent,
          confirmPendingIds,
        );
      } catch (rollbackError) {
        if (rollbackError instanceof ReminderReconcileSupersededError) {
          return { status: 'superseded', scheduledCount: 0 };
        }
        logger.error('[Notifications] Reminder rollback context is no longer valid:', rollbackError);
      }
      return {
        status: previousScheduleRestored ? 'native-restored' : 'native-uncertain',
        scheduledCount: 0,
        error,
      };
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
