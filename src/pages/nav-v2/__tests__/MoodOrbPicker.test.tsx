import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoodOrbPicker } from "../MoodOrbPicker";
import type { MoodType } from "@/types";

// --- Mocks ---

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      moodVeryUnpleasant: "Very unpleasant",
      moodUnpleasant: "Unpleasant",
      moodNeutral: "Neutral",
      moodPleasant: "Pleasant",
      moodVeryPleasant: "Very pleasant",
      moodOrbGroupLabel: "How do you feel?",
    },
    language: "en",
    isRTL: false,
  }),
}));

const hapticSelectionMock = vi.fn();
vi.mock("@/lib/haptics", () => ({
  hapticSelection: () => hapticSelectionMock(),
  hapticTap: vi.fn(),
  hapticMedium: vi.fn(),
}));

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

describe("MoodOrbPicker", () => {
  beforeEach(() => {
    hapticSelectionMock.mockClear();
  });

  it("renders a fieldset+legend with 5 orb options", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value={null} onChange={onChange} />);
    expect(screen.getByTestId("mood-orb-picker")).toBeInTheDocument();
    expect(screen.getByTestId("mood-orb-picker-legend")).toHaveTextContent(
      "How do you feel?",
    );
    const orbs = ["terrible", "bad", "okay", "good", "great"] as const;
    for (const m of orbs) {
      expect(screen.getByTestId(`mood-orb-option-${m}`)).toBeInTheDocument();
    }
    // 5 valence orb shaders
    expect(screen.getAllByTestId("valence-orb")).toHaveLength(5);
  });

  it("each orb exposes the correct valence and aria-checked state", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value="okay" onChange={onChange} />);

    const terrible = screen.getByTestId("mood-orb-option-terrible");
    const bad = screen.getByTestId("mood-orb-option-bad");
    const okay = screen.getByTestId("mood-orb-option-okay");
    const good = screen.getByTestId("mood-orb-option-good");
    const great = screen.getByTestId("mood-orb-option-great");

    expect(terrible.getAttribute("data-valence")).toBe("-1");
    expect(bad.getAttribute("data-valence")).toBe("-0.5");
    expect(okay.getAttribute("data-valence")).toBe("0");
    expect(good.getAttribute("data-valence")).toBe("0.5");
    expect(great.getAttribute("data-valence")).toBe("1");

    expect(okay.getAttribute("aria-checked")).toBe("true");
    expect(terrible.getAttribute("aria-checked")).toBe("false");
    expect(great.getAttribute("aria-checked")).toBe("false");
  });

  it("tapping an orb fires onChange with the correct MoodType", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    expect(onChange).toHaveBeenCalledWith<[MoodType]>("good");
  });

  it("tapping the currently-selected orb deselects (calls onChange with null)", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value="great" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("mood-orb-option-great"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("ArrowRight cycles focus to the next orb", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value={null} onChange={onChange} />);
    const okay = screen.getByTestId("mood-orb-option-okay");
    okay.focus();
    fireEvent.keyDown(okay, { key: "ArrowRight" });
    expect(document.activeElement).toBe(
      screen.getByTestId("mood-orb-option-good"),
    );
  });

  it("ArrowLeft cycles focus to the previous orb and wraps at the start", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value={null} onChange={onChange} />);
    const terrible = screen.getByTestId("mood-orb-option-terrible");
    terrible.focus();
    fireEvent.keyDown(terrible, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(
      screen.getByTestId("mood-orb-option-great"),
    );
  });

  it("Enter/Space on focused orb selects via click", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value={null} onChange={onChange} />);
    const great = screen.getByTestId("mood-orb-option-great");
    great.focus();
    // Native button fires click on Enter/Space — simulate with fireEvent.click.
    fireEvent.click(great);
    expect(onChange).toHaveBeenCalledWith<[MoodType]>("great");
  });

  it("hapticSelection fires on orb tap", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("mood-orb-option-okay"));
    expect(hapticSelectionMock).toHaveBeenCalledTimes(1);
  });

  it("disabled prop disables all orb buttons", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value={null} onChange={onChange} disabled />);
    const orbs = ["terrible", "bad", "okay", "good", "great"] as const;
    for (const m of orbs) {
      expect(screen.getByTestId(`mood-orb-option-${m}`)).toBeDisabled();
    }
  });

  it("color echo sets --page-tint CSS var on the fieldset when selected", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MoodOrbPicker value={null} onChange={onChange} />,
    );
    const fieldset = screen.getByTestId("mood-orb-picker");
    expect(fieldset.getAttribute("data-has-selection")).toBe("false");

    rerender(<MoodOrbPicker value="great" onChange={onChange} />);
    expect(fieldset.getAttribute("data-has-selection")).toBe("true");
    // --page-tint assigned inline on selection
    expect(fieldset.getAttribute("style")).toMatch(/--page-tint/);
  });

  it("sets data-selected='true' on the selected orb only", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value="bad" onChange={onChange} />);
    expect(
      screen.getByTestId("mood-orb-option-bad").getAttribute("data-selected"),
    ).toBe("true");
    expect(
      screen.getByTestId("mood-orb-option-okay").getAttribute("data-selected"),
    ).toBe("false");
    expect(
      screen.getByTestId("mood-orb-option-great").getAttribute("data-selected"),
    ).toBe("false");
  });

  it("labels render from i18n keys with fallbacks", () => {
    const onChange = vi.fn();
    render(<MoodOrbPicker value={null} onChange={onChange} />);
    expect(
      screen.getByTestId("mood-orb-option-terrible"),
    ).toHaveAttribute("aria-label", "Very unpleasant");
    expect(
      screen.getByTestId("mood-orb-option-great"),
    ).toHaveAttribute("aria-label", "Very pleasant");
  });
});
