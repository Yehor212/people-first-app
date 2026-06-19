import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  getAuthUserAccountLabel,
  getAuthUserDisplayName,
  getLinkedAuthProviderIds,
} from "@/lib/authUser";

describe("auth user helpers", () => {
  it("uses Telegram username metadata when the user has no email", () => {
    const user = {
      id: "telegram-user-123456",
      email: null,
      phone: null,
      app_metadata: { provider: "custom:telegram" },
      user_metadata: {
        name: "",
        preferred_username: "zenflow_user",
      },
      identities: [{ provider: "custom:telegram" }],
    } as unknown as User;

    expect(getAuthUserDisplayName(user)).toBe("zenflow_user");
    expect(getAuthUserAccountLabel(user)).toBe("@zenflow_user");
    expect(getLinkedAuthProviderIds(user)).toEqual(["telegram"]);
  });

  it("falls back to display name before opaque user id for email-optional accounts", () => {
    const user = {
      id: "abc1234567890",
      email: null,
      phone: null,
      app_metadata: { provider: "facebook" },
      user_metadata: {
        full_name: "Taylor Green",
      },
      identities: [{ provider: "facebook" }],
    } as unknown as User;

    expect(getAuthUserDisplayName(user)).toBe("Taylor Green");
    expect(getAuthUserAccountLabel(user)).toBe("Taylor Green");
    expect(getLinkedAuthProviderIds(user)).toEqual(["facebook"]);
  });

  it("uses the friendly fallback for Apple users when OAuth has no name metadata", () => {
    const user = {
      id: "apple-user-123456",
      email: "private-relay@example.privaterelay.appleid.com",
      phone: null,
      app_metadata: { provider: "apple" },
      user_metadata: {},
      identities: [{ provider: "apple" }],
    } as unknown as User;

    expect(getAuthUserDisplayName(user)).toBe("Friend");
    expect(getAuthUserAccountLabel(user)).toBe("private-relay@example.privaterelay.appleid.com");
    expect(getLinkedAuthProviderIds(user)).toEqual(["apple"]);
  });

});
