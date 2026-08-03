import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const notificationPlugin = vi.hoisted(() => ({ createChannel: vi.fn() }));
const nativePushRealm = vi.hoisted(() => ({
  isPushRealmChannelId: vi.fn((value: unknown) =>
    value === "zenflow_default_v4" ||
    value === "zenflow_gentle_v4" ||
    value === "zenflow_silent_v4"
  ),
  updateNativePushPresentation: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({
  isDesktopViewport: false,
  isNative: true,
  platform: "android",
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: notificationPlugin,
}));

vi.mock("../nativePushRealm", () => nativePushRealm);

import {
  buildNotificationChannelCopy,
  getNotificationSystemSettingsCopyKey,
  getCurrentChannelId,
  getCurrentSoundOption,
  getNotificationSound,
  initializeNotificationChannels,
  NOTIFICATION_SOUND_CHANNEL_VERSION,
  NOTIFICATION_SOUNDS,
  setNotificationSound,
  supportsNativeNotificationChannels,
  updateNotificationSound,
} from "../notificationSounds";

describe("notification sound channels", () => {
  beforeEach(() => {
    localStorage.clear();
    notificationPlugin.createChannel.mockClear().mockResolvedValue(undefined);
    nativePushRealm.updateNativePushPresentation.mockReset().mockResolvedValue(undefined);
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
    expect(NOTIFICATION_SOUND_CHANNEL_VERSION).toBe("v4");
    expect(NOTIFICATION_SOUNDS.map((sound) => sound.channelId)).toEqual([
      "zenflow_default_v4",
      "zenflow_gentle_v4",
      "zenflow_silent_v4",
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
    expect(getCurrentSoundOption().channelId).toBe("zenflow_default_v4");
    expect(getCurrentChannelId()).toBe("zenflow_default_v4");
  });

  it("updates the active native push realm after saving a sound profile", async () => {
    await expect(updateNotificationSound("gentle")).resolves.toBe("zenflow_gentle_v4");

    expect(nativePushRealm.updateNativePushPresentation).toHaveBeenCalledWith({
      channelId: "zenflow_gentle_v4",
    });
  });

  it("reports an active native presentation failure so settings can roll back", async () => {
    nativePushRealm.updateNativePushPresentation.mockRejectedValueOnce(
      new Error("native realm unavailable"),
    );

    await expect(updateNotificationSound("silent")).rejects.toThrow("native realm unavailable");
    expect(getNotificationSound()).toBe("default");
  });

  it("keeps an unrestored durable choice observable when rollback storage fails", async () => {
    const originalSetItem = Storage.prototype.setItem;
    let writeCount = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      writeCount += 1;
      if (writeCount === 2) {
        throw new DOMException("blocked", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    });
    nativePushRealm.updateNativePushPresentation.mockRejectedValueOnce(
      new Error("native realm unavailable"),
    );

    await expect(updateNotificationSound("gentle")).rejects.toThrow(
      "native realm unavailable",
    );
    expect(getNotificationSound()).toBe("gentle");
  });

  it("creates only secret Android channels so reminder content is hidden on lock screens", async () => {
    await initializeNotificationChannels();

    expect(notificationPlugin.createChannel).toHaveBeenCalledTimes(3);
    for (const [channel] of notificationPlugin.createChannel.mock.calls) {
      expect(channel).toMatchObject({ visibility: -1 });
      expect(channel.id).toMatch(/_v4$/);
    }
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

  it("creates native notification channels only on Android", () => {
    expect(
      supportsNativeNotificationChannels({
        isNativeRuntime: true,
        platformName: "android",
        isDesktopViewportRuntime: false,
      }),
    ).toBe(true);
    expect(
      supportsNativeNotificationChannels({
        isNativeRuntime: true,
        platformName: "ios",
        isDesktopViewportRuntime: false,
      }),
    ).toBe(false);
  });

  it("does not request restricted exact-alarm access for non-critical wellness reminders", () => {
    const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    expect(manifest).not.toContain("android.permission.USE_EXACT_ALARM");
    expect(manifest).not.toContain("android.permission.SCHEDULE_EXACT_ALARM");
  });

  it("rejects an Android sound choice when the durable preference cannot be written", async () => {
    localStorage.setItem("zenflow_notification_sound", "default");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "QuotaExceededError");
    });

    expect(setNotificationSound("gentle")).toBe(false);
    await expect(updateNotificationSound("gentle")).rejects.toThrow(
      "Reminder sound could not be saved",
    );
    expect(getNotificationSound()).toBe("default");
  });
});
