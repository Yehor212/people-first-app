import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildV2PortalHref, V2PreviewPortal } from "../PreviewPortal";

const appCss = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      v2PortalAria: "Open ZenFlow V2 preview",
      v2PortalEyebrow: "V2 preview",
      v2PortalTitle: "Step into the new ritual space",
      v2PortalBody:
        "Try the phone-first V2 flow while classic ZenFlow stays here as your safe home base.",
      v2PortalStatus: "Preview mode, using your same data",
      v2PortalCta: "Open V2",
      v2PortalOrb: "Mood orb",
      v2PortalHabits: "Habits",
      v2PortalDiary: "Diary",
    },
    isRTL: false,
    language: "en",
  }),
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => false,
}));

vi.mock("@/lib/haptics", () => ({
  hapticTap: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/components/state-of-mind/MiniValenceOrb", () => ({
  MiniValenceOrb: () => <div data-testid="v2-preview-canonical-mini-orb" />,
}));

describe("V2PreviewPortal", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/people-first-app/?navLayout=phone&dev=true#today");
  });

  it("builds V2 preview links from an internal allowlist only", () => {
    expect(
      buildV2PortalHref("habits", {
        baseUrl: "/people-first-app/",
        devPreview: true,
        phoneLayout: true,
      }),
    ).toBe("/people-first-app/habits?nav=v2&navLayout=phone&dev=true");
  });

  it("renders one primary portal and three direct V2 entry cards", () => {
    render(<V2PreviewPortal />);

    expect(screen.getByTestId("v1-v2-portal")).toBeInTheDocument();
    expect(screen.getByTestId("v1-v2-portal-rift")).toBeInTheDocument();
    expect(screen.getByTestId("v1-v2-portal-ring-v1")).toBeInTheDocument();
    expect(screen.getByTestId("v1-v2-portal-ring-v2")).toBeInTheDocument();
    expect(screen.getByTestId("v1-v2-portal-orb-core")).toContainElement(
      screen.getByTestId("v2-preview-canonical-mini-orb"),
    );
    expect(screen.getByTestId("v1-v2-portal-aperture")).toBeInTheDocument();
    expect(screen.getAllByTestId("v1-v2-portal-stream-node")).toHaveLength(4);
    expect(screen.getByText("Step into the new ritual space")).toBeInTheDocument();
    expect(screen.getByTestId("v1-v2-portal-primary")).toHaveAttribute(
      "aria-label",
      "Open ZenFlow V2 preview",
    );

    expect(screen.getByTestId("v1-v2-portal-orb")).toHaveAttribute(
      "aria-label",
      "Open V2: Mood orb",
    );
    expect(screen.getByTestId("v1-v2-portal-habits")).toHaveAttribute(
      "aria-label",
      "Open V2: Habits",
    );
    expect(screen.getByTestId("v1-v2-portal-diary")).toHaveAttribute(
      "aria-label",
      "Open V2: Diary",
    );
  });

  it("keeps the animated V1 to V2 portal isolated from route-level paint stalls", () => {
    expect(appCss).toContain(".v2-preview-portal {");
    expect(appCss).toContain("contain: layout paint style");
    expect(appCss).toContain(".v2-preview-portal [data-orb-renderer-policy]");
    expect(appCss).toContain("will-change: transform, opacity");
  });
});
