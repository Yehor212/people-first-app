import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MoodConfirmCta } from "../MoodConfirmCta";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      orbConfirm: "Save",
      orbSkip: "Later",
      orbUndo: "Undo",
      orbMoodSaved: "Mood saved",
    },
    language: "en",
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
}));

describe("MoodConfirmCta", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders confirm + skip buttons", () => {
    render(
      <MoodConfirmCta
        enabled={true}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByTestId("mood-confirm-button")).toBeInTheDocument();
    expect(screen.getByTestId("mood-skip-button")).toBeInTheDocument();
  });

  it("disables confirm button when enabled=false", () => {
    render(
      <MoodConfirmCta
        enabled={false}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByTestId("mood-confirm-button")).toBeDisabled();
    expect(screen.getByTestId("mood-confirm-button")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("does not invoke onConfirm when disabled and clicked", () => {
    const onConfirm = vi.fn();
    render(
      <MoodConfirmCta
        enabled={false}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("mood-confirm-button"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows undo toast when confirm clicked", () => {
    render(
      <MoodConfirmCta
        enabled={true}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("mood-confirm-button"));
    expect(screen.getByTestId("mood-undo-toast")).toBeInTheDocument();
    expect(screen.getByTestId("mood-undo-toast")).toHaveAttribute(
      "role",
      "status",
    );
  });

  it("invokes onConfirm after 5 seconds", () => {
    const onConfirm = vi.fn();
    render(
      <MoodConfirmCta
        enabled={true}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("mood-confirm-button"));
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("undo button cancels save", () => {
    const onConfirm = vi.fn();
    render(
      <MoodConfirmCta
        enabled={true}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("mood-confirm-button"));
    fireEvent.click(screen.getByTestId("mood-undo-toast-button"));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mood-undo-toast")).not.toBeInTheDocument();
  });

  it("skip button invokes onSkip immediately", () => {
    const onSkip = vi.fn();
    render(
      <MoodConfirmCta
        enabled={true}
        onConfirm={vi.fn()}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByTestId("mood-skip-button"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("shows progress indicator when toast visible", () => {
    render(
      <MoodConfirmCta
        enabled={true}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("mood-confirm-button"));
    expect(screen.getByTestId("mood-undo-toast-progress")).toBeInTheDocument();
  });

  it("keeps the undo toast below the mobile drawer stack", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/pages/nav-v2/MoodConfirmCta.css"),
      "utf8",
    );
    const match = css.match(/\.mood-undo-toast\s*\{[^}]*z-index:\s*(\d+)/s);

    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeLessThan(59);
  });
});
