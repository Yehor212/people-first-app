import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ isNative: true }));
const notifications = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  schedule: vi.fn(),
}));
const channels = vi.hoisted(() => ({
  initializeNotificationChannels: vi.fn(),
  getCurrentChannelId: vi.fn(() => "zenflow_gentle_v3"),
}));

vi.mock("@/lib/platform", () => native);
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: notifications }));
vi.mock("@/lib/notificationSounds", () => channels);

import {
  FOCUS_COMPLETION_NOTIFICATION_ID,
  scheduleFocusCompletionNotification,
} from "../focusCompletionNotification";

describe("focus completion notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.isNative = true;
    notifications.checkPermissions.mockResolvedValue({ display: "granted" });
    notifications.schedule.mockResolvedValue({ notifications: [] });
    channels.initializeNotificationChannels.mockResolvedValue(undefined);
  });

  it("prepares the selected private channel and uses a stable 32-bit notification id", async () => {
    await expect(scheduleFocusCompletionNotification("Focus session complete")).resolves.toBe(true);

    expect(channels.initializeNotificationChannels).toHaveBeenCalledTimes(1);
    expect(notifications.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          title: "ZenFlow",
          body: "Focus session complete",
          id: FOCUS_COMPLETION_NOTIFICATION_ID,
          channelId: "zenflow_gentle_v3",
        },
      ],
    });
    expect(Number.isInteger(FOCUS_COMPLETION_NOTIFICATION_ID)).toBe(true);
    expect(FOCUS_COMPLETION_NOTIFICATION_ID).toBeLessThanOrEqual(2_147_483_647);
    expect(
      channels.initializeNotificationChannels.mock.invocationCallOrder[0],
    ).toBeLessThan(notifications.schedule.mock.invocationCallOrder[0]);
  });

  it("does not schedule when notification permission is unavailable", async () => {
    notifications.checkPermissions.mockResolvedValue({ display: "denied" });

    await expect(scheduleFocusCompletionNotification("Done")).resolves.toBe(false);

    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it("does nothing outside native apps", async () => {
    native.isNative = false;

    await expect(scheduleFocusCompletionNotification("Done")).resolves.toBe(false);

    expect(channels.initializeNotificationChannels).not.toHaveBeenCalled();
    expect(notifications.checkPermissions).not.toHaveBeenCalled();
  });
});
