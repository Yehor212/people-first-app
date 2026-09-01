import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { setShowMindfulMoment } = vi.hoisted(() => ({
  setShowMindfulMoment: vi.fn(),
}));

vi.mock("@/stores", () => ({
  getModalToggle: () => setShowMindfulMoment,
  useUIStore: (selector: (state: { showMindfulMoment: boolean }) => unknown) =>
    selector({ showMindfulMoment: true }),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    isFeatureVisible: () => true,
    getFeatureAvailability: () => ({ visible: true }),
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      ariaMindfulMoment: "Mindful moment",
      mindfulMoment: "Mindful Moment",
      close: "Close",
      takeAMoment: "Take a moment",
      done: "Done",
      skip: "Skip",
      treat: "treat",
    },
  }),
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: vi.fn(),
}));

vi.mock("@/hooks/useModalState", () => ({
  useModalClose: vi.fn(),
}));

vi.mock("@/lib/mindfulPrompts", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/mindfulPrompts")>();
  return {
    ...original,
    getRandomPostFocusPrompt: () => ({
      id: "post-focus",
      type: "breathing" as const,
      duration: 10,
      text: { en: "Take one breath." },
    }),
  };
});

import { V2MindfulMomentLayer } from "../V2MindfulMomentLayer";

describe("V2MindfulMomentLayer neutral mode", () => {
  it("does not promise XP or treats when V2 rewards are disabled", async () => {
    render(<V2MindfulMomentLayer onComplete={vi.fn()} />);

    expect(await screen.findByRole("dialog", { name: "Mindful moment" })).toBeInTheDocument();
    expect(screen.queryByText(/\+3 XP/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+1 treat/u)).not.toBeInTheDocument();
  });
});
