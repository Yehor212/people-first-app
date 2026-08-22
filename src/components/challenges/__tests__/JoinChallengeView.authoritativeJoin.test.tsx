import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JoinChallengeView } from "@/components/challenges/JoinChallengeView";
import type { Translations } from "@/i18n/types";
import type { Challenge, ChallengeInvite } from "@/lib/friendChallenge";

const mocks = vi.hoisted(() => ({
  joinChallengeByCode: vi.fn(),
}));

vi.mock("@/lib/friendChallenge", () => ({
  joinChallengeByCode: mocks.joinChallengeByCode,
}));

vi.mock("@/lib/haptics", () => ({
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
  hapticWarning: vi.fn(),
}));

const translations = {
  joinChallenge: "Join Challenge",
  enterChallengeCode: "Enter the code from your friend",
  challengeCode: "Challenge Code",
  invalidChallengeCode: "Invalid code. Format: ZEN-XXXXXX",
  challengeLookupUnavailable:
    "We couldn't verify this challenge. Check your connection and try again.",
  challengeInviteOffline: "You are offline. Reconnect and try again.",
  challengeInviteNotFound: "We could not find that challenge code.",
  challengeInviteExpired: "This challenge has ended.",
  challengeInviteSelf: "This is your own challenge.",
  challengeInviteDuplicate: "You already joined this challenge.",
  challengeInviteSignedOut: "Sign in to join challenges.",
  enterCodeToJoin: "Enter code to join",
  joinChallengeHint: "Ask your friend to share their challenge code with you",
  joining: "Joining...",
  join: "Join",
  cancel: "Cancel",
  days: "days",
  friend: "Friend",
} as Translations;

const canonicalChallenge: Challenge = {
  id: "server-challenge-id",
  code: "ZEN-ABC123",
  habitName: "Morning walk",
  habitIcon: "🚶",
  duration: 14,
  startDate: "2026-08-01",
  endDate: "2026-08-15",
  myProgress: 2,
  isCreator: false,
  status: "active",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("JoinChallengeView authoritative resolution", () => {
  it("shows an honest retry state and does not join when a valid code cannot be verified", async () => {
    mocks.joinChallengeByCode.mockResolvedValue({ success: false, reason: "unavailable" });
    const onJoined = vi.fn();

    render(
      <JoinChallengeView
        username="Mina"
        onJoined={onJoined}
        onCancel={vi.fn()}
        t={translations}
      />,
    );

    fireEvent.change(screen.getByLabelText("Challenge Code"), {
      target: { value: "ZEN-ABC123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() =>
      expect(mocks.joinChallengeByCode).toHaveBeenCalledWith("ZEN-ABC123", "Mina"),
    );
    expect(
      await screen.findByText(
        "We couldn't verify this challenge. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(onJoined).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Join" })).toBeEnabled();
  });

  it("treats an invite as a locator and passes only its code through canonical resolution", async () => {
    mocks.joinChallengeByCode.mockResolvedValue({
      success: true,
      challenge: canonicalChallenge,
    });
    const onJoined = vi.fn();
    const untrustedPreview: ChallengeInvite = {
      code: "ZEN-ABC123",
    };

    render(
      <JoinChallengeView
        initialInvite={untrustedPreview}
        username="Mina"
        onJoined={onJoined}
        onCancel={vi.fn()}
        t={translations}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() =>
      expect(mocks.joinChallengeByCode).toHaveBeenCalledWith("ZEN-ABC123", "Mina"),
    );
    expect(onJoined).toHaveBeenCalledWith(canonicalChallenge);
  });

  it.each([
    ["offline", "You are offline. Reconnect and try again."],
    ["not_found", "We could not find that challenge code."],
    ["expired", "This challenge has ended."],
    ["self", "This is your own challenge."],
    ["duplicate", "You already joined this challenge."],
    ["signed_out", "Sign in to join challenges."],
    ["unavailable", "We couldn't verify this challenge. Check your connection and try again."],
  ] as const)("shows the localized %s recovery state without joining", async (reason, copy) => {
    mocks.joinChallengeByCode.mockResolvedValue({ success: false, reason });
    const onJoined = vi.fn();

    render(
      <JoinChallengeView
        initialInvite={{ code: "ZEN-ABC123" }}
        username="Mina"
        onJoined={onJoined}
        onCancel={vi.fn()}
        t={translations}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText(copy)).toBeInTheDocument();
    expect(onJoined).not.toHaveBeenCalled();
  });
});
