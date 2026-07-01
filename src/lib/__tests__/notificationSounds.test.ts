import { describe, expect, it } from "vitest";
import {
  getNotificationSystemSettingsCopyKey,
  getCurrentChannelId,
  getCurrentSoundOption,
  NOTIFICATION_SOUND_CHANNEL_VERSION,
  NOTIFICATION_SOUNDS,
} from "../notificationSounds";

describe("notification sound channels", () => {
  it("uses versioned Android channels so immutable old channel behavior is not reused", () => {
    expect(NOTIFICATION_SOUND_CHANNEL_VERSION).toBe("v2");
    expect(NOTIFICATION_SOUNDS.map((sound) => sound.channelId)).toEqual([
      "zenflow_default_v2",
      "zenflow_gentle_v2",
      "zenflow_chime_v2",
      "zenflow_silent_v2",
    ]);
    expect(NOTIFICATION_SOUNDS.some((sound) => sound.channelId === "zenflow_reminders")).toBe(false);
  });

  it("matches each user-facing sound option to a low-startle channel profile", () => {
    expect(NOTIFICATION_SOUNDS).toEqual([
      expect.objectContaining({ id: "default", sound: "default", vibrate: true, importance: 3 }),
      expect.objectContaining({ id: "gentle", sound: undefined, vibrate: true, importance: 2 }),
      expect.objectContaining({ id: "chime", sound: "default", vibrate: true, importance: 3 }),
      expect.objectContaining({ id: "silent", sound: undefined, vibrate: false, importance: 1 }),
    ]);
  });

  it("routes new reminder schedules through the selected versioned channel", () => {
    expect(getCurrentSoundOption().channelId).toBe("zenflow_default_v2");
    expect(getCurrentChannelId()).toBe("zenflow_default_v2");
  });

  it("maps system notification guidance to every supported runtime surface", () => {
    expect(
      getNotificationSystemSettingsCopyKey({
        isNativeRuntime: true,
        platformName: "android",
        isDesktopViewportRuntime: false,
      })
    ).toBe("notificationSystemSettingsAndroidDescription");

    expect(
      getNotificationSystemSettingsCopyKey({
        isNativeRuntime: true,
        platformName: "ios",
        isDesktopViewportRuntime: false,
      })
    ).toBe("notificationSystemSettingsIosDescription");

    expect(
      getNotificationSystemSettingsCopyKey({
        isNativeRuntime: false,
        platformName: "web",
        isDesktopViewportRuntime: false,
      })
    ).toBe("notificationSystemSettingsWebDescription");

    expect(
      getNotificationSystemSettingsCopyKey({
        isNativeRuntime: false,
        platformName: "web",
        isDesktopViewportRuntime: true,
      })
    ).toBe("notificationSystemSettingsDesktopDescription");
  });
});
