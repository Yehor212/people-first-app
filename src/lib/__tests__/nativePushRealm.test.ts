import { describe, expect, it } from "vitest";
import {
  isPushRealmChannelId,
  PUSH_REALM_CHANNEL_IDS,
} from "../nativePushRealm";

describe("native push realm channel allowlist", () => {
  it("admits the optional versioned fūrin notification channel", () => {
    expect(PUSH_REALM_CHANNEL_IDS).toEqual([
      "zenflow_default_v4",
      "zenflow_furin_v5",
      "zenflow_gentle_v4",
      "zenflow_silent_v4",
    ]);
    expect(isPushRealmChannelId("zenflow_furin_v5")).toBe(true);
    expect(isPushRealmChannelId("zenflow_furin_v4")).toBe(false);
  });
});
