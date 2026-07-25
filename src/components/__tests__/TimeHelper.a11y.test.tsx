import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      timeBlindnessHelper: "Visual timer",
      visualTimeAwareness: "A visual timer for your chosen duration",
      minutesLeft: "{mins}m left",
      ariaDurationMinutes: "Duration in minutes",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({ useBackHandler: vi.fn() }));
vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/hooks/useModalKeyboard", () => ({
  useModalKeyboard: () => ({
    modalRef: { current: null },
    handleKeyDown: vi.fn(),
  }),
}));
vi.mock("@/lib/audioManager", () => ({
  playComplete: vi.fn(),
  playNotification: vi.fn(),
}));

import { TimeHelper } from "../TimeHelper";

describe("TimeHelper accessibility", () => {
  it("names the dialog with its visible translated heading", () => {
    render(<TimeHelper onClose={vi.fn()} />);

    const heading = screen.getByRole("heading", { level: 2, name: "Visual timer" });
    expect(screen.getByRole("dialog", { name: "Visual timer" })).toHaveAttribute(
      "aria-labelledby",
      heading.id,
    );
  });
});
