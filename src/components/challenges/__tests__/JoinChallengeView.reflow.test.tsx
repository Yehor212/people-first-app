import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const challengeMocks = vi.hoisted(() => ({
  joinChallenge: vi.fn(),
  resolveChallengeInviteByCode: vi.fn(),
}));

vi.mock("@/lib/friendChallenge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/friendChallenge")>()),
  ...challengeMocks,
}));

import { JoinChallengeView } from "@/components/challenges/JoinChallengeView";
import type { Translations } from "@/i18n/types";

vi.mock("@/lib/haptics", () => ({
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
  hapticWarning: vi.fn(),
}));

describe("JoinChallengeView action reflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stacks long localized actions until both labels have enough inline space", () => {
    render(
      <JoinChallengeView
        onJoined={vi.fn()}
        onCancel={vi.fn()}
        t={{
          cancel: "Скасувати",
          join: "Приєднатися",
          joinChallenge: "Приєднатися до виклику",
          enterCodeToJoin: "Введіть код виклику",
          challengeCode: "Код виклику",
          joinChallengeHint: "Попросіть друга поділитися кодом виклику",
        } as Translations}
      />,
    );

    const cancel = screen.getByRole("button", { name: "Скасувати" });
    const join = screen.getByRole("button", { name: "Приєднатися" });
    const actions = cancel.parentElement;

    expect(actions).toHaveClass("grid", "grid-cols-1", "sm:grid-cols-2");
    for (const action of [cancel, join]) {
      expect(action).toHaveClass(
        "h-auto",
        "min-h-14",
        "min-w-0",
        "whitespace-normal",
        "break-words",
        "[hyphens:manual]",
        "[overflow-wrap:break-word]",
      );
    }
  });

  it("shows the existing unavailable state and releases the busy state when code resolution fails", async () => {
    challengeMocks.resolveChallengeInviteByCode.mockRejectedValueOnce(new Error("private remote detail"));

    render(
      <JoinChallengeView
        initialInvite={{ code: "ZEN-A2B3C4" }}
        onJoined={vi.fn()}
        onCancel={vi.fn()}
        t={{
          cancel: "Cancel",
          join: "Join",
          joining: "Joining...",
          invalidChallengeCode: "Invalid challenge code",
          challengeCode: "Challenge code",
        } as Translations}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Invalid challenge code");
    await waitFor(() => expect(screen.getByRole("button", { name: "Join" })).toBeEnabled());
    expect(challengeMocks.joinChallenge).not.toHaveBeenCalled();
  });
});
