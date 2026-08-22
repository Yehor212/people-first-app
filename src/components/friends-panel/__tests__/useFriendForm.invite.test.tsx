import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ addFriendByCode: vi.fn() }));

vi.mock("@/lib/haptics", () => ({
  hapticError: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
}));

vi.mock("@/lib/a11y", () => ({ announce: vi.fn() }));
vi.mock("@/storage/friendsSync", () => ({ addFriendByCode: mocks.addFriendByCode }));

import { useFriendForm } from "@/components/friends-panel/useFriendForm";

describe("useFriendForm Android friend locator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefills the form but performs no add operation before explicit confirmation", () => {
    const { result } = renderHook(() =>
      useFriendForm({
        initialFriendCode: "ZF-ABCDEFGH",
        onSuccess: vi.fn(),
        t: {},
      }),
    );

    expect(result.current.showAddFriend).toBe(true);
    expect(result.current.friendCode).toBe("ZF-ABCDEFGH");
  });

  it.each([
    ["invalid", "That friend code is not valid."],
    ["self", "This is your own friend code."],
    ["duplicate", "You already added this friend."],
    ["offline", "You are offline. Reconnect and try again."],
    ["not_found", "We could not find that friend code."],
    ["signed_out", "Sign in to add friends."],
    ["unavailable", "Friend lookup is unavailable right now. Try again."],
  ] as const)("maps the %s result to localized recovery copy", async (reason, message) => {
    mocks.addFriendByCode.mockResolvedValue({ success: false, reason });
    const { result } = renderHook(() =>
      useFriendForm({
        onSuccess: vi.fn(),
        t: {
          friendInviteInvalid: "That friend code is not valid.",
          friendInviteSelf: "This is your own friend code.",
          friendInviteDuplicate: "You already added this friend.",
          friendInviteOffline: "You are offline. Reconnect and try again.",
          friendInviteNotFound: "We could not find that friend code.",
          friendInviteSignedOut: "Sign in to add friends.",
          friendInviteUnavailable: "Friend lookup is unavailable right now. Try again.",
        },
      }),
    );

    act(() => {
      result.current.setFriendCode("ZF-ABCDEFGH");
    });
    act(() => {
      result.current.throttledAddFriend();
    });

    await waitFor(() => expect(result.current.addError).toBe(message));
  });
});
