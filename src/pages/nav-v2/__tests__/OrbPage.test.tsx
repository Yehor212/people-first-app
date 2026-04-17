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
      orbWhisper1: "How's your heart today?",
      orbWhisper2: "What rises for you now?",
      orbWhisper3: "Speak to the orb.",
      orbWhisper4: "Breathe, then listen.",
      orbWhisper5: "What's the weather inside?",
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

// MoodSlider mock — proves integration + forwards showEmojis for assertion
vi.mock("@/features/journal/MoodSlider", () => ({
  MoodSlider: ({
    onChange,
    showEmojis,
  }: {
    onChange: (m: string) => void;
    showEmojis?: boolean;
  }) => (
    <button
      data-testid="mood-slider"
      data-show-emojis={String(showEmojis ?? true)}
      onClick={() => onChange("good")}
      type="button"
    >
      slider
    </button>
  ),
}));

// CosmicBgAdapter mock — prove it's rendered behind content
vi.mock("../CosmicBgAdapter", () => ({
  CosmicBgAdapter: () => (
    <div data-testid="cosmic-orb-background">cosmic</div>
  ),
}));

// ShootingStar mock — prove flourish layer renders
vi.mock("../ShootingStar", () => ({
  ShootingStar: () => <div data-testid="shooting-star-stub" />,
}));

// useCosmicParallax mock — no DOM side effects in jsdom
vi.mock("../useCosmicParallax", () => ({
  useCosmicParallax: () => ({ current: null }),
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

describe("OrbPage (Phase 3-A.2 cosmic cinematic surface)", () => {
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

  it("renders CosmicBgAdapter behind content (Phase 3-A.4a focus-timer bg reuse)", () => {
    render(<OrbPage />);
    expect(screen.getByTestId("cosmic-orb-background")).toBeInTheDocument();
  });

  it("renders shooting-star flourish layer atop cosmic backdrop (Phase 3-A.3 WOW-3)", () => {
    render(<OrbPage />);
    expect(screen.getByTestId("cosmic-orb-flourish-layer")).toBeInTheDocument();
    expect(screen.getByTestId("shooting-star-stub")).toBeInTheDocument();
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
    // Two orbs render (mobile + desktop) — CSS hidden/md:block picks which one shows.
    const orbs = screen.getAllByTestId("valence-orb");
    expect(orbs.length).toBeGreaterThanOrEqual(1);
    // Placeholder copy from Phase 3-A must be gone
    expect(screen.queryByText(/Phase 3-B will wire/i)).not.toBeInTheDocument();
  });

  it("renders the orb at the Phase 3-A.2 enlarged sizes (256 mobile / 320 desktop)", () => {
    render(<OrbPage />);
    // Two wrappers render — one for each viewport. Both ValenceOrb mocks exist
    // in the DOM, CSS `hidden md:block` picks which one shows. Verify both sizes.
    const orbs = screen.getAllByTestId("valence-orb");
    const sizes = orbs.map((el) => el.getAttribute("data-size"));
    expect(sizes).toContain("256");
    expect(sizes).toContain("320");
  });

  it("renders the MoodSlider WITHOUT emojis on OrbPage (showEmojis=false)", () => {
    render(<OrbPage />);
    const slider = screen.getByTestId("mood-slider");
    expect(slider).toBeInTheDocument();
    expect(slider.getAttribute("data-show-emojis")).toBe("false");
    expect(screen.getByTestId("orb-page-slider")).toBeInTheDocument();
  });

  it("renders the whisper subtitle with an italic font-serif class", () => {
    render(<OrbPage />);
    const whisper = screen.getByTestId("orb-page-whisper");
    expect(whisper).toBeInTheDocument();
    expect(whisper.className).toContain("italic");
    expect(whisper.className).toContain("font-serif");
    // Whisper text should be one of the 5 literary prompts
    expect(whisper.textContent).toMatch(
      /heart today|rises for you|orb|listen|weather inside/i,
    );
  });

  it("whisper rotates deterministically by day-of-month", () => {
    vi.useFakeTimers();
    // Day 1 → prompt index 1 % 5 = 1 → orbWhisper2
    vi.setSystemTime(new Date("2026-04-01T12:00:00"));
    const { unmount } = render(<OrbPage />);
    expect(screen.getByTestId("orb-page-whisper")).toHaveAttribute(
      "data-whisper-key",
      "orbWhisper2",
    );
    unmount();

    // Day 5 → 5 % 5 = 0 → orbWhisper1
    vi.setSystemTime(new Date("2026-04-05T12:00:00"));
    const r2 = render(<OrbPage />);
    expect(r2.getByTestId("orb-page-whisper")).toHaveAttribute(
      "data-whisper-key",
      "orbWhisper1",
    );
    r2.unmount();

    // Day 14 → 14 % 5 = 4 → orbWhisper5
    vi.setSystemTime(new Date("2026-04-14T12:00:00"));
    const r3 = render(<OrbPage />);
    expect(r3.getByTestId("orb-page-whisper")).toHaveAttribute(
      "data-whisper-key",
      "orbWhisper5",
    );
    r3.unmount();
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
    const orbs = screen.getAllByTestId("valence-orb");
    // With no entries AND no animation, valence should stay at 0 (not oscillate)
    for (const orb of orbs) {
      expect(orb.getAttribute("data-valence")).toBe("0");
    }
  });
});
