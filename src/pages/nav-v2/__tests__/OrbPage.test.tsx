import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrbPage } from "../OrbPage";

// --- Mocks ---

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      goodMorning: "Good morning",
      goodAfternoon: "Good afternoon",
      goodEvening: "Good evening",
      somLogFeeling: "Log how you feel",
      navV2Orb: "Orb",
      navV2OrbSubhead: "How are you feeling?",
    },
    language: "en",
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn() },
}));

// ValenceOrb mock — proves integration without running WebGL in jsdom
vi.mock("@/components/state-of-mind/ValenceOrb", () => ({
  ValenceOrb: ({ valence, size }: { valence: number; size?: number }) => (
    <div
      data-testid="valence-orb"
      data-valence={valence}
      data-size={size}
    >
      orb
    </div>
  ),
}));

// MoodSlider mock — proves integration
vi.mock("@/features/journal/MoodSlider", () => ({
  MoodSlider: ({ onChange }: { onChange: (m: string) => void }) => (
    <button
      data-testid="mood-slider"
      onClick={() => onChange("good")}
      type="button"
    >
      slider
    </button>
  ),
}));

vi.mock("@/components/state-of-mind/StateOfMindModal", () => ({
  StateOfMindModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="som-modal">state of mind modal</div> : null,
}));

// Mock setMoods so we can assert it was called
const setMoodsSpy = vi.fn();
vi.mock("zustand/react/shallow", () => ({
  useShallow: <T,>(fn: (s: unknown) => T) => fn,
}));
vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (s: unknown) => unknown) =>
    selector({ moods: [], userName: "Yehor", setMoods: setMoodsSpy }),
}));

// Control reduced-motion gating
const shouldAnimateMock = vi.fn(() => true);
vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => shouldAnimateMock(),
}));

// Bloom passthrough so children render synchronously
vi.mock("@/lib/motion", () => ({
  Bloom: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("OrbPage (Phase 3-A.1 ValenceOrb integration)", () => {
  beforeEach(() => {
    setMoodsSpy.mockClear();
    shouldAnimateMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the page with main role + labelled-by h1 (a11y landmark)", () => {
    render(<OrbPage />);
    const main = screen.getByTestId("orb-page");
    expect(main).toHaveAttribute("role", "main");
    expect(main).toHaveAttribute("aria-labelledby", "orb-page-heading");
  });

  it("renders the greeting with font-display + includes user name", () => {
    render(<OrbPage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Yehor/);
    expect(heading.className).toContain("font-display");
    expect(heading.className).toContain("tracking-tight");
  });

  it("greeting tone follows the time of day (morning < 12 < afternoon < 18 < evening)", () => {
    vi.useFakeTimers();
    // 9am — morning
    vi.setSystemTime(new Date("2026-04-16T09:00:00"));
    const { unmount } = render(<OrbPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Good morning/);
    unmount();

    // 3pm — afternoon
    vi.setSystemTime(new Date("2026-04-16T15:00:00"));
    const r2 = render(<OrbPage />);
    expect(r2.getByRole("heading", { level: 1 })).toHaveTextContent(/Good afternoon/);
    r2.unmount();

    // 8pm — evening
    vi.setSystemTime(new Date("2026-04-16T20:00:00"));
    const r3 = render(<OrbPage />);
    expect(r3.getByRole("heading", { level: 1 })).toHaveTextContent(/Good evening/);
    r3.unmount();
  });

  it("renders the ValenceOrb hero (not the old placeholder text)", () => {
    render(<OrbPage />);
    expect(screen.getByTestId("valence-orb")).toBeInTheDocument();
    // Placeholder copy from Phase 3-A must be gone
    expect(screen.queryByText(/Phase 3-B will wire/i)).not.toBeInTheDocument();
  });

  it("renders the MoodSlider below the orb", () => {
    render(<OrbPage />);
    expect(screen.getByTestId("mood-slider")).toBeInTheDocument();
    expect(screen.getByTestId("orb-page-slider")).toBeInTheDocument();
  });

  it("tapping the orb opens the State of Mind modal", () => {
    render(<OrbPage />);
    expect(screen.queryByTestId("som-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("orb-page-hero"));
    expect(screen.getByTestId("som-modal")).toBeInTheDocument();
  });

  it("changing the MoodSlider calls setMoods with a valid MoodEntry shape", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    expect(setMoodsSpy).toHaveBeenCalledTimes(1);

    // setMoods was called with an updater fn — exercise it to prove shape
    const updater = setMoodsSpy.mock.calls[0][0] as (
      prev: Array<Record<string, unknown>>,
    ) => Array<Record<string, unknown>>;
    const next = updater([]);
    expect(next).toHaveLength(1);
    const entry = next[0];
    expect(entry.mood).toBe("good");
    expect(typeof entry.id).toBe("string");
    expect(typeof entry.date).toBe("string");
    expect(typeof entry.timestamp).toBe("number");
    expect(typeof entry.updatedAt).toBe("number");
  });

  it("does NOT idle-oscillate when reduced motion is requested", () => {
    shouldAnimateMock.mockReturnValue(false);
    render(<OrbPage />);
    const orb = screen.getByTestId("valence-orb");
    // With no entries AND no animation, valence should stay at 0 (not oscillate)
    expect(orb.getAttribute("data-valence")).toBe("0");
  });
});
