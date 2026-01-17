/**
 * Haptic Feedback Utility for ADHD-friendly interactions
 * Provides tactile confirmation for actions, helping with focus and engagement
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

// Check if haptics are available (native platform only)
const isHapticsAvailable = Capacitor.isNativePlatform();

/**
 * Light haptic tap - for button presses, selections
 */
export async function hapticTap(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    console.debug('Haptic tap failed:', error);
  }
}

/**
 * Medium haptic impact - for mood selections, habit toggles
 */
export async function hapticMedium(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    console.debug('Haptic medium failed:', error);
  }
}

/**
 * Heavy haptic impact - for significant actions, achievements
 */
export async function hapticHeavy(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.debug('Haptic heavy failed:', error);
  }
}

/**
 * Success haptic - for completed actions, achievements unlocked
 */
export async function hapticSuccess(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    console.debug('Haptic success failed:', error);
  }
}

/**
 * Warning haptic - for time alerts, approaching deadlines
 */
export async function hapticWarning(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (error) {
    console.debug('Haptic warning failed:', error);
  }
}

/**
 * Error haptic - for invalid actions, errors
 */
export async function hapticError(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (error) {
    console.debug('Haptic error failed:', error);
  }
}

/**
 * Selection changed haptic - for scrolling through options
 */
export async function hapticSelection(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.selectionChanged();
  } catch (error) {
    console.debug('Haptic selection failed:', error);
  }
}

/**
 * Selection start - call before a selection session
 */
export async function hapticSelectionStart(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.selectionStart();
  } catch (error) {
    console.debug('Haptic selection start failed:', error);
  }
}

/**
 * Selection end - call after a selection session
 */
export async function hapticSelectionEnd(): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.selectionEnd();
  } catch (error) {
    console.debug('Haptic selection end failed:', error);
  }
}

// Convenience functions for specific app actions
export const haptics = {
  // Mood tracking
  moodSelected: hapticMedium,
  moodSaved: hapticSuccess,

  // Habits
  habitToggled: hapticMedium,
  habitCompleted: hapticSuccess,

  // Focus
  focusStarted: hapticMedium,
  focusPaused: hapticTap,
  focusCompleted: hapticSuccess,
  focusPing: hapticTap,

  // Gratitude
  gratitudeSaved: hapticSuccess,

  // Achievements & XP
  xpGained: hapticTap,
  achievementUnlocked: hapticHeavy,
  levelUp: hapticHeavy,

  // Navigation & UI
  buttonPress: hapticTap,
  tabChanged: hapticSelection,
  panelOpened: hapticTap,
  panelClosed: hapticTap,

  // Alerts
  timeWarning: hapticWarning,
  error: hapticError,
};
