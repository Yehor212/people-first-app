/// <reference types="@testing-library/jest-dom/vitest" />

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChallengesPanel } from "../ChallengesPanel";

const mockUseBackHandler = vi.fn();
const mockUseScrollLock = vi.fn();
const mockUseModalA11y = vi.fn();

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      challengesTitle: "Challenges & Badges",
      challengesSubtitle: "Take on challenges and earn badges",
      close: "Close",
      noChallengesActive: "No Active Challenges",
      noChallengesActiveHint: "Start a challenge to track your progress",
      availableChallenges: "Available",
      activeChallenges: "Active",
      badges: "Badges",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: (...args: unknown[]) => mockUseBackHandler(...args),
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: (...args: unknown[]) => mockUseScrollLock(...args),
}));

vi.mock("@/hooks/useModalA11y", () => ({
  useModalA11y: (...args: unknown[]) => mockUseModalA11y(...args),
}));

describe("ChallengesPanel", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing and wires modal accessibility hooks", () => {
    const onClose = vi.fn();

    render(
      <ChallengesPanel
        activeChallenges={[]}
        badges={[]}
        onStartChallenge={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Challenges & Badges")).toBeInTheDocument();
    expect(mockUseBackHandler).not.toHaveBeenCalled();
    expect(mockUseScrollLock).toHaveBeenCalledWith(true);
    expect(mockUseModalA11y).toHaveBeenNthCalledWith(1, true, onClose);
    expect(mockUseModalA11y).toHaveBeenNthCalledWith(
      2,
      false,
      expect.any(Function),
    );
  });
});
