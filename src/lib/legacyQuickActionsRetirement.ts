import { LocalNotifications } from "@capacitor/local-notifications";
import { logger } from "@/lib/logger";
import { isAndroid } from "@/lib/platform";
import { storageGetRaw, storageRemove, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { QUICK_ACTIONS_NOTIFICATION_ID } from "@/lib/notificationIds";

const LEGACY_QUICK_ACTIONS_CHANNEL_ID = "zenflow_quick_actions";
const RETIREMENT_COMPLETE = "complete";

/**
 * Removes the retired Android lock-screen notification. The persisted flag is
 * kept when cancellation fails so a later startup can retry safely.
 */
export async function retireLegacyQuickActions(): Promise<boolean> {
  if (!isAndroid) return true;
  if (storageGetRaw(SK.LEGACY_QUICK_ACTIONS_RETIREMENT) === RETIREMENT_COMPLETE) {
    return true;
  }

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: QUICK_ACTIONS_NOTIFICATION_ID }],
    });
  } catch (error) {
    logger.warn("[Notifications] Could not retire legacy Quick Actions", error);
    return false;
  }

  try {
    await LocalNotifications.deleteChannel({ id: LEGACY_QUICK_ACTIONS_CHANNEL_ID });
  } catch (error) {
    // Cancellation is the user-visible requirement. Old Android versions and
    // vendor implementations may not support channel deletion consistently.
    logger.warn("[Notifications] Could not remove the retired Quick Actions channel", error);
  }

  if (!storageRemove(SK.QUICK_ACTIONS_ENABLED)) return false;
  return storageSetRaw(SK.LEGACY_QUICK_ACTIONS_RETIREMENT, RETIREMENT_COMPLETE);
}
