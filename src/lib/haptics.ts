/** Native tactile feedback for short, causal confirmations. */

import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNative } from "@/lib/platform";
import { getHapticsPreference } from "./hapticsPreference";
import { logger } from "@/lib/logger";

// Check if haptics are available (native platform only)
const isHapticsAvailable = isNative;

// Combined check for availability AND user preference
function canTriggerHaptics(): boolean {
  return isHapticsAvailable && getHapticsPreference().enabled;
}

/**
 * Light haptic tap - for button presses, selections
 */
export async function hapticTap(): Promise<void> {
  if (!canTriggerHaptics()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    logger.log("Haptic tap failed:", error);
  }
}

/**
 * Medium haptic impact - for mood selections, habit toggles
 */
export async function hapticMedium(): Promise<void> {
  if (!canTriggerHaptics()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    logger.log("Haptic medium failed:", error);
  }
}

/**
 * Heavy haptic impact - for significant actions, achievements
 */
export async function hapticHeavy(): Promise<void> {
  if (!canTriggerHaptics()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    logger.log("Haptic heavy failed:", error);
  }
}

/**
 * Success haptic - for completed actions, achievements unlocked
 */
export async function hapticSuccess(): Promise<void> {
  if (!canTriggerHaptics()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    logger.log("Haptic success failed:", error);
  }
}

/**
 * Warning haptic - for time alerts, approaching deadlines
 */
export async function hapticWarning(): Promise<void> {
  if (!canTriggerHaptics()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (error) {
    logger.log("Haptic warning failed:", error);
  }
}

/**
 * Error haptic - for invalid actions, errors
 */
export async function hapticError(): Promise<void> {
  if (!canTriggerHaptics()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (error) {
    logger.log("Haptic error failed:", error);
  }
}

/**
 * Selection changed haptic - for scrolling through options
 */
export async function hapticSelection(): Promise<void> {
  await hapticTap();
}

/**
 * Selection start - call before a selection session
 */
export async function hapticSelectionStart(): Promise<void> {
  if (!canTriggerHaptics()) return;
  try {
    await Haptics.selectionStart();
  } catch (error) {
    logger.log("Haptic selection start failed:", error);
  }
}

/**
 * Selection end - call after a selection session
 */
export async function hapticSelectionEnd(): Promise<void> {
  if (!canTriggerHaptics()) return;
  try {
    await Haptics.selectionEnd();
  } catch (error) {
    logger.log("Haptic selection end failed:", error);
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

  // Journal
  journalSaved: hapticSuccess,

  // Breathing
  breathingComplete: hapticSuccess,

  // Achievements & XP
  xpGained: hapticTap,
  achievementUnlocked: hapticHeavy,
  levelUp: hapticHeavy,

  // Generic intensity aliases
  light: hapticTap,
  medium: hapticMedium,
  heavy: hapticHeavy,

  // Navigation & UI
  buttonPress: hapticTap,
  buttonTap: hapticTap, // Alias for AI Coach compatibility
  tabChanged: hapticTap,
  panelOpened: hapticTap,
  panelClosed: hapticTap,

  // Alerts
  timeWarning: hapticWarning,
  error: hapticError,
};
