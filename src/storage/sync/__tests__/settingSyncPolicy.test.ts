import { describe, expect, it } from "vitest";

import { AUTOMATION_PREFERENCE_SETTING_KEY } from "@/features/automation/types";
import {
  isAccountSyncedSettingKey,
  isDedicatedSyncSettingKey,
  shouldDeleteSettingFromCloud,
} from "@/storage/sync/settingSyncPolicy";

describe("settingSyncPolicy", () => {
  it("reserves the connected-records preference for its server-linearized sync path", () => {
    expect(isDedicatedSyncSettingKey(AUTOMATION_PREFERENCE_SETTING_KEY)).toBe(true);
    expect(isAccountSyncedSettingKey(AUTOMATION_PREFERENCE_SETTING_KEY)).toBe(false);
    expect(shouldDeleteSettingFromCloud(AUTOMATION_PREFERENCE_SETTING_KEY)).toBe(false);
  });

  it("keeps ordinary account settings on the generic sync path", () => {
    expect(isDedicatedSyncSettingKey("mood-reminder-enabled")).toBe(false);
    expect(isAccountSyncedSettingKey("mood-reminder-enabled")).toBe(true);
    expect(shouldDeleteSettingFromCloud("mood-reminder-enabled")).toBe(true);
  });
});
