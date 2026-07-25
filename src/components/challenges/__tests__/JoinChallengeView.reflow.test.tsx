import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JoinChallengeView } from "@/components/challenges/JoinChallengeView";
import type { Translations } from "@/i18n/types";

vi.mock("@/lib/haptics", () => ({
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
  hapticWarning: vi.fn(),
}));

describe("JoinChallengeView action reflow", () => {
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
});
