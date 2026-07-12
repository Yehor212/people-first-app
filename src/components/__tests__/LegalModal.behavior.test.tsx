import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LegalModal } from "@/components/LegalModal";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      privacyPolicy: "Privacy Policy",
      termsOfService: "Terms of Service",
      openSourceLicenses: "Open-source library licenses",
      legalPrivacyDescription: "Privacy details",
      legalTermsDescription: "Terms details",
      legalLicensesDescription: "License details",
      legalOpenInBrowser: "Open in browser",
    },
  }),
}));

vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));

describe("LegalModal behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("selects the requested legal tab on every open and reselection", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <LegalModal open onOpenChange={onOpenChange} initialTab="privacy" />
    );

    expect(screen.getByRole("tab", { name: "Privacy Policy" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    rerender(<LegalModal open={false} onOpenChange={onOpenChange} initialTab="privacy" />);
    rerender(<LegalModal open onOpenChange={onOpenChange} initialTab="terms" />);
    expect(screen.getByRole("tab", { name: "Terms of Service" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    rerender(<LegalModal open={false} onOpenChange={onOpenChange} initialTab="terms" />);
    rerender(<LegalModal open onOpenChange={onOpenChange} initialTab="licenses" />);
    expect(
      screen.getByRole("tab", { name: "Open-source library licenses" })
    ).toHaveAttribute("aria-selected", "true");
  });

  it("connects the modal a11y focus trap to the rendered dialog", () => {
    render(<LegalModal open onOpenChange={vi.fn()} initialTab="privacy" />);

    act(() => {
      vi.advanceTimersByTime(60);
    });

    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Close" });
    const last = within(dialog).getByRole("button", { name: "Open in browser" });
    expect(close).toHaveFocus();

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
  });

  it("connects tabs to their panel and supports roving arrow-key focus", () => {
    render(<LegalModal open onOpenChange={vi.fn()} initialTab="privacy" />);

    const privacy = screen.getByRole("tab", { name: "Privacy Policy" });
    const terms = screen.getByRole("tab", { name: "Terms of Service" });
    const licenses = screen.getByRole("tab", { name: "Open-source library licenses" });
    const panel = screen.getByRole("tabpanel");

    expect(privacy).toHaveAttribute("id", "legal-tab-privacy");
    expect(privacy).toHaveAttribute("aria-controls", "legal-panel-privacy");
    expect(privacy).toHaveAttribute("tabindex", "0");
    expect(terms).toHaveAttribute("tabindex", "-1");
    expect(panel).toHaveAttribute("id", "legal-panel-privacy");
    expect(panel).toHaveAttribute("aria-labelledby", "legal-tab-privacy");

    privacy.focus();
    fireEvent.keyDown(privacy, { key: "ArrowRight" });
    expect(terms).toHaveFocus();
    expect(terms).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(terms, { key: "End" });
    expect(licenses).toHaveFocus();
    expect(licenses).toHaveAttribute("aria-selected", "true");
  });

  it("renders at the viewport root when opened from a transformed settings surface", () => {
    const settingsSurface = document.createElement("div");
    settingsSurface.style.transform = "translateZ(0)";
    document.body.append(settingsSurface);

    try {
      render(<LegalModal open onOpenChange={vi.fn()} initialTab="privacy" />, {
        container: settingsSurface,
      });

      const dialog = screen.getByRole("dialog");
      expect(settingsSurface).not.toContainElement(dialog);
      expect(document.body).toContainElement(dialog);
    } finally {
      settingsSurface.remove();
    }
  });
});
