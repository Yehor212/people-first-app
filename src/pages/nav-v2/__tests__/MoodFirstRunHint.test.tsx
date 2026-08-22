import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { MoodFirstRunHint } from "../MoodFirstRunHint";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const backHandlerMocks = vi.hoisted(() => ({
  callback: null as null | (() => void),
  enabled: false,
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: (enabled: boolean, callback: () => void) => {
    backHandlerMocks.enabled = enabled;
    backHandlerMocks.callback = callback;
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      orbFirstRunTitle: "Three steps to your first entry",
      orbFirstRunStep1: "Slide the orb",
      orbFirstRunStep2: "Choose when you felt this way",
      orbFirstRunStep3:
        "Add an emotion or note if you want, then save your mood and start today's entry",
      orbFirstRunGotIt: "Got it",
    },
    language: "en",
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn() },
}));

describe("MoodFirstRunHint", () => {
  beforeEach(() => {
    window.localStorage.clear();
    backHandlerMocks.callback = null;
    backHandlerMocks.enabled = false;
  });

  it("does not render when eligible=false", () => {
    render(<MoodFirstRunHint eligible={false} />);
    expect(screen.queryByTestId("mood-first-run-hint")).not.toBeInTheDocument();
  });

  it("renders when eligible=true and never dismissed", () => {
    render(<MoodFirstRunHint eligible={true} />);
    expect(screen.getByTestId("mood-first-run-hint")).toBeInTheDocument();
    expect(
      screen.getByText("Three steps to your first entry"),
    ).toBeInTheDocument();
  });

  it("renders all three steps", () => {
    render(<MoodFirstRunHint eligible={true} />);
    expect(screen.getByText("Slide the orb")).toBeInTheDocument();
    expect(screen.getByText("Choose when you felt this way")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add an emotion or note if you want, then save your mood and start today's entry",
      ),
    ).toBeInTheDocument();
  });

  it("has a11y attributes on dialog", () => {
    render(<MoodFirstRunHint eligible={true} />);
    const dialog = screen.getByTestId("mood-first-run-hint");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).not.toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute(
      "aria-labelledby",
      "mood-first-run-title",
    );
  });

  it("dismisses when button clicked + persists flag", () => {
    render(<MoodFirstRunHint eligible={true} />);
    fireEvent.click(screen.getByTestId("mood-first-run-dismiss"));
    expect(
      screen.queryByTestId("mood-first-run-hint"),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem("zenflow-orb-first-run-dismissed")).toBe(
      "1",
    );
  });

  it("does not render on remount after dismissal", () => {
    window.localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    render(<MoodFirstRunHint eligible={true} />);
    expect(screen.queryByTestId("mood-first-run-hint")).not.toBeInTheDocument();
  });

  it("does not dismiss from the passive backdrop", () => {
    render(<MoodFirstRunHint eligible={true} />);
    const backdrop = screen.getByTestId("mood-first-run-hint");
    fireEvent.click(backdrop);
    expect(screen.getByTestId("mood-first-run-hint")).toBeInTheDocument();
  });

  it("keeps the full-screen hint layer passive so V2 navigation remains reachable", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/pages/nav-v2/MoodFirstRunHint.css"),
      "utf8",
    );

    expect(css).toMatch(/\.mood-first-run-backdrop\s*\{[^}]*pointer-events:\s*none/s);
    expect(css).toMatch(/\.mood-first-run-card\s*\{[^}]*pointer-events:\s*auto/s);
  });

  it("keeps the hint below the mobile drawer stack so drawer taps are not intercepted", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/pages/nav-v2/MoodFirstRunHint.css"),
      "utf8",
    );
    const match = css.match(/\.mood-first-run-backdrop\s*\{[^}]*z-index:\s*(\d+)/s);

    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeLessThan(59);
  });

  it("uses the shared viewport contract instead of a raw viewport unit", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/pages/nav-v2/MoodFirstRunHint.css"),
      "utf8",
    );

    expect(css).toContain("var(--app-viewport-height)");
    expect(css).not.toContain("100dvh");
  });

  it("registers explicit Android Back ownership only while visible", () => {
    render(<MoodFirstRunHint eligible={true} />);
    expect(backHandlerMocks.enabled).toBe(true);

    act(() => backHandlerMocks.callback?.());

    expect(screen.queryByTestId("mood-first-run-hint")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("zenflow-orb-first-run-dismissed")).toBe("1");
  });
});
