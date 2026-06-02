import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SplashScreen } from "@/components/SplashScreen";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      loading: "Loading",
    },
  }),
}));

describe("SplashScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("uses explicit ink theme even when the persisted theme is paper", () => {
    localStorage.setItem(
      "zenflow:theme-v0c",
      JSON.stringify({ state: { theme: "paper" }, version: 0 }),
    );

    render(
      <SplashScreen
        loadingFadeOut={false}
        subtitle="Preparing your zen space..."
        theme="ink"
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveAttribute(
      "data-splash-theme",
      "ink",
    );
  });

  it("keeps the current persisted theme behavior when no override is provided", () => {
    localStorage.setItem(
      "zenflow:theme-v0c",
      JSON.stringify({ state: { theme: "paper" }, version: 0 }),
    );

    render(
      <SplashScreen
        loadingFadeOut={false}
        subtitle="Preparing your zen space..."
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveAttribute(
      "data-splash-theme",
      "paper",
    );
  });

  it("can show the full branded route loader immediately", () => {
    render(
      <SplashScreen
        loadingFadeOut={false}
        subtitle="Preparing your zen space..."
        instant
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveAttribute(
      "data-splash-instant",
      "true",
    );
    expect(screen.getByTestId("splash-brand-logo")).toBeInTheDocument();
    expect(screen.getByTestId("splash-infinity-loader")).toBeInTheDocument();
  });

  it("drives root fade-out through the CSS data contract", () => {
    render(
      <SplashScreen
        loadingFadeOut
        subtitle="Preparing your zen space..."
        instant
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveAttribute(
      "data-splash-fade-out",
      "true",
    );
    expect(screen.getByTestId("splash-theme-shell")).toHaveClass("splash-theme-shell");
  });

  it("keeps the bright paper logo treatment on the dark splash scene", () => {
    render(
      <SplashScreen
        loadingFadeOut={false}
        subtitle="Preparing your zen space..."
        theme="ink"
        instant
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveStyle({
      "--splash-logo-stop-1": "var(--color-mood-great)",
      "--splash-logo-stop-2": "var(--color-surface-primary)",
      "--splash-logo-stop-3": "var(--color-mood-good)",
      "--splash-logo-highlight-opacity": "0.12",
      "--splash-logo-glyph-opacity": "0.92",
    });
  });

  it("keeps the red-to-green infinity colors across splash themes", () => {
    render(
      <SplashScreen
        loadingFadeOut={false}
        subtitle="Preparing your zen space..."
        theme="paper"
        instant
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveStyle({
      "--premium-loader-stop-1": "var(--color-mood-terrible)",
      "--premium-loader-stop-2": "var(--color-mood-bad)",
      "--premium-loader-stop-3": "var(--color-mood-okay)",
      "--premium-loader-stop-4": "var(--color-mood-good)",
      "--premium-loader-stop-5": "var(--color-mood-great)",
      "--premium-loader-foundation-opacity": "0.2",
      "--premium-loader-mid-opacity": "0.3",
      "--premium-loader-base-line-opacity": "0.28",
      "--premium-loader-trail-opacity": "0.42",
      "--premium-loader-core-opacity": "1",
    });
  });

  it("keeps the approved green day splash treatment for paper theme", () => {
    render(
      <SplashScreen
        loadingFadeOut={false}
        subtitle="Preparing your zen space..."
        theme="paper"
        instant
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveStyle({
      "--splash-bg": "hsl(var(--zf-night-0))",
      "--splash-copy": "hsl(var(--zf-text-strong))",
      "--splash-muted": "hsl(var(--zf-text-soft))",
      "--splash-day-topbar": "hsl(var(--zf-primary) / 0.72)",
      "--splash-day-aurora-a": "hsl(var(--zf-primary) / 0.1)",
      "--splash-day-bubble-b": "hsl(var(--zf-primary) / 0.07)",
    });
  });

  it("keeps exactly two loading scenes: paper for light, night for ink/oled", () => {
    const { rerender } = render(
      <SplashScreen
        loadingFadeOut={false}
        subtitle="Preparing your zen space..."
        theme="ink"
        instant
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveAttribute(
      "data-splash-scene",
      "night",
    );
    expect(screen.getByTestId("splash-night-background").children.length).toBeGreaterThan(6);
    expect(document.querySelector(".splash-night-vellum")).toBeInTheDocument();
    expect(screen.getAllByTestId("splash-night-bokeh-orb")).toHaveLength(6);
    expect(screen.getByTestId("splash-theme-shell")).toHaveStyle({
      "--splash-night-depth-core": "color-mix(in oklab, var(--color-theme-ink-primary) 9%, transparent)",
      "--splash-night-ribbon-a": "color-mix(in oklab, var(--color-mood-good) 13%, transparent)",
      "--splash-night-orb-a": "color-mix(in oklab, var(--color-mood-okay) 15%, transparent)",
    });

    rerender(
      <SplashScreen
        loadingFadeOut={false}
        subtitle="Preparing your zen space..."
        theme="oled"
        instant
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveAttribute(
      "data-splash-theme",
      "oled",
    );
    expect(screen.getByTestId("splash-night-background")).toBeInTheDocument();
    expect(document.querySelector(".splash-night-vellum")).toBeInTheDocument();

    rerender(
      <SplashScreen
        loadingFadeOut={false}
        subtitle="Preparing your zen space..."
        theme="paper"
        instant
      />,
    );

    expect(screen.getByTestId("splash-theme-shell")).toHaveAttribute(
      "data-splash-theme",
      "paper",
    );
    expect(screen.getByTestId("splash-theme-shell")).toHaveAttribute(
      "data-splash-scene",
      "day",
    );
    expect(screen.getByTestId("splash-day-green-background")).toBeInTheDocument();
    expect(screen.getAllByTestId("splash-day-bubble")).toHaveLength(6);
    expect(screen.queryByTestId("splash-night-background")).not.toBeInTheDocument();
    expect(document.querySelector(".splash-night-vellum")).not.toBeInTheDocument();
    expect(document.querySelector(".splash-night-focus-well")).not.toBeInTheDocument();
    expect(document.querySelector(".splash-day-topbar")).toBeInTheDocument();
    expect(document.querySelector(".splash-day-aurora")).toBeInTheDocument();
    expect(document.querySelector(".splash-day-focus-well")).not.toBeInTheDocument();
    expect(screen.getByTestId("splash-brand-logo")).toBeInTheDocument();
    expect(screen.getByTestId("splash-day-logo-ring")).toBeInTheDocument();
    expect(screen.getByTestId("splash-infinity-loader")).toBeInTheDocument();
  });

});
