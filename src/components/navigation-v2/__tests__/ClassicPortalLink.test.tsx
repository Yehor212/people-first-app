import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildClassicPortalHref, ClassicPortalLink } from "../ClassicPortalLink";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      classicPortalAria: "Return to classic ZenFlow",
      classicPortalEyebrow: "Stable home",
      classicPortalTitle: "Back to classic ZenFlow",
      classicPortalBody: "Return to the current stable home while V2 stays in preview.",
      classicPortalCta: "Classic ZenFlow",
    },
    isRTL: false,
  }),
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => false,
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), selection: vi.fn() },
}));

vi.mock("@/components/state-of-mind/MiniValenceOrb", () => ({
  MiniValenceOrb: () => <div data-testid="classic-portal-mini-valence-orb" />,
}));

describe("ClassicPortalLink", () => {
  it("builds a safe V1 root href without carrying arbitrary current URL params", () => {
    expect(
      buildClassicPortalHref({
        baseUrl: "/people-first-app/",
        devPreview: true,
        phoneLayout: true,
      }),
    ).toBe("/people-first-app/?navLayout=phone&dev=true");

    expect(
      buildClassicPortalHref({
        baseUrl: "/people-first-app/",
        devPreview: false,
        phoneLayout: false,
      }),
    ).toBe("/people-first-app/");
  });

  it("renders as a labelled portal link", () => {
    render(<ClassicPortalLink phoneLayout testId="classic-portal-test" />);

    const portal = screen.getByTestId("classic-portal-test");
    expect(portal).toHaveAttribute("aria-label", "Return to classic ZenFlow");
    expect(portal).toHaveAttribute("href", "/?navLayout=phone&dev=true");
    expect(screen.getByTestId("classic-portal-test-orb")).toContainElement(
      screen.getByTestId("classic-portal-mini-valence-orb"),
    );
    expect(screen.getByText("Back to classic ZenFlow")).toBeInTheDocument();
  });
});
