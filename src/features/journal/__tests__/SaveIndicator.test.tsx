import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: vi.fn(() => ({
    language: "en",
    isRTL: false,
    t: (key: string) => key,
  })),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: vi.fn(() => true),
}));

vi.mock("framer-motion", () => ({
  motion: {
    span: ({ children, ...props }: Record<string, unknown>) => {
      const { initial, animate, exit, transition, ...rest } = props;
      void initial;
      void animate;
      void exit;
      void transition;
      return <span {...(rest)}>{children as React.ReactNode}</span>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { SaveIndicator } from "../SaveIndicator";

describe("SaveIndicator", () => {
  it("idle state renders null (nothing in DOM)", () => {
    const { container } = render(<SaveIndicator state="idle" />);
    expect(container.innerHTML).toBe("");
  });

  it("saving state shows spinner and 'Saving...' text", () => {
    render(<SaveIndicator state="saving" />);
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("saved state shows 'Saved' text", () => {
    render(<SaveIndicator state="saved" />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("error state shows 'Save failed' and retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<SaveIndicator state="error" onRetry={onRetry} />);
    expect(screen.getByText("Save failed")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeInTheDocument();
    retryButton.click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("error state without onRetry shows no retry button", () => {
    render(<SaveIndicator state="error" />);
    expect(screen.getByText("Save failed")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("labels an explicit conflict retry as replacing the newer version", () => {
    const onRetry = vi.fn();
    render(
      <SaveIndicator
        state="error"
        errorTitle="Newer version kept"
        errorHint="Your edits are still here."
        onRetry={onRetry}
        retryLabel="Replace newer version"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Newer version kept");
    const retryButton = screen.getByRole("button", { name: "Replace newer version" });
    retryButton.click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("synced state shows 'Synced' text", () => {
    render(<SaveIndicator state="synced" />);
    expect(screen.getByText("Synced")).toBeInTheDocument();
  });

  it("has aria-live='polite' for screen readers on non-idle states", () => {
    render(<SaveIndicator state="saving" />);
    const liveRegion = screen.getByText("Saving...").closest("[aria-live]");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
  });
});
