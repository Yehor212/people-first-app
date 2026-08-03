import { LocalNotifications } from "@capacitor/local-notifications";

import {
  getCurrentChannelId,
  getCurrentSoundOption,
  initializeNotificationChannels,
} from "@/lib/notificationSounds";
import { isNative } from "@/lib/platform";

// Reserved outside the repeating reminder ranges and within Android's signed
// 32-bit notification ID contract. Reusing it replaces an older completion.
export const FOCUS_COMPLETION_NOTIFICATION_ID = 9_500;

export async function scheduleFocusCompletionNotification(body: string): Promise<boolean> {
  if (!isNative) return false;

  await initializeNotificationChannels();
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return false;

  const sound = getCurrentSoundOption().sound;

  await LocalNotifications.schedule({
    notifications: [
      {
        title: "ZenFlow",
        body,
        id: FOCUS_COMPLETION_NOTIFICATION_ID,
        channelId: getCurrentChannelId(),
        ...(sound ? { sound } : {}),
      },
    ],
  });
  return true;
}
