import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DopamineSettingsComponent } from "../DopamineSettings";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      dopamineSettings: "Feedback & motion",
      dopamineSettingsDesc: "Choose how much animation, sound, and haptics ZenFlow uses.",
      dopamineIntensity: "Feedback level",
      dopamineMinimal: "Quiet",
      dopamineNormal: "Balanced",
      dopamineADHD: "High feedback",
      dopamineSave: "Done",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

describe("DopamineSettingsComponent", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });
  it("traps focus inside feedback and motion dialog", () => {
    const onClose = vi.fn();

    render(
      <>
        <button type="button">Before modal</button>
        <DopamineSettingsComponent onClose={onClose} />
        <button type="button">After modal</button>
      </>
    );

    const dialog = screen.getByRole("dialog", { name: "Feedback & motion" });
    const doneButton = screen.getByRole("button", { name: "Done" });
    doneButton.focus();

    fireEvent.keyDown(dialog, { key: "Tab" });

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "After modal" })).not.toHaveFocus();
  });

  it("uses icon controls without emoji or raw close glyphs", () => {
    render(<DopamineSettingsComponent onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Feedback & motion" });
    const forbiddenGlyphs = ["🌙", "⚖️", "🚀", "🎉", "🔥", "🎨", "💡", "×"];

    for (const glyph of forbiddenGlyphs) {
      expect(dialog.textContent).not.toContain(glyph);
    }
    expect(screen.getByRole("button", { name: "Close" })).toHaveTextContent("");
  });

  it("uses a vibration-specific icon for the haptics setting", () => {
    render(<DopamineSettingsComponent onClose={vi.fn()} />);

    expect(screen.getByRole("switch", { name: "Haptics" })).toBeInTheDocument();
    expect(screen.getByTestId("dopamine-haptics-icon")).toBeInTheDocument();
  });
});
