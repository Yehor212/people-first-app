import { beforeEach, describe, expect, it } from "vitest";
import {
  buildNotificationChannelCopy,
  getNotificationSystemSettingsCopyKey,
  getCurrentChannelId,
  getCurrentSoundOption,
  getNotificationSound,
  NOTIFICATION_SOUND_CHANNEL_VERSION,
  NOTIFICATION_SOUNDS,
} from "../notificationSounds";

describe("notification sound channels", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("builds Android channel names and descriptions from the active language", () => {
    const copy = buildNotificationChannelCopy({
      soundDefault: "За замовчуванням",
      soundDefaultDesc: "Системний звук сповіщення",
      soundGentle: "М'який",
      soundGentleDesc: "Тільки вібрація",
      soundSilent: "Тихий",
      soundSilentDesc: "Без звуку та вібрації",
    });

    expect(copy.default).toEqual({
      name: "ZenFlow — За замовчуванням",
      description: "Системний звук сповіщення",
    });
    expect(copy.silent.description).toBe("Без звуку та вібрації");
  });

  it("uses versioned Android channels so immutable old channel behavior is not reused", () => {
    expect(NOTIFICATION_SOUND_CHANNEL_VERSION).toBe("v2");
    expect(NOTIFICATION_SOUNDS.map((sound) => sound.channelId)).toEqual([
      "zenflow_default_v2",
      "zenflow_gentle_v2",
      "zenflow_silent_v2",
    ]);
    expect(NOTIFICATION_SOUNDS.some((sound) => sound.channelId === "zenflow_reminders")).toBe(false);
  });

  it("matches each user-facing sound option to a low-startle channel profile", () => {
    expect(NOTIFICATION_SOUNDS).toEqual([
      expect.objectContaining({ id: "default", sound: "default", vibrate: true, importance: 3 }),
      expect.objectContaining({ id: "gentle", sound: undefined, vibrate: true, importance: 2 }),
      expect.objectContaining({ id: "silent", sound: undefined, vibrate: false, importance: 1 }),
    ]);
  });

  it("migrates the retired duplicate chime preference to the truthful default option", () => {
    localStorage.setItem("zenflow_notification_sound", "chime");

    expect(getNotificationSound()).toBe("default");
    expect(localStorage.getItem("zenflow_notification_sound")).toBe("default");
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
