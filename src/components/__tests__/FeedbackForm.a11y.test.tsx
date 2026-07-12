import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackForm } from "@/components/FeedbackForm";

const feedbackServiceMock = vi.hoisted(() => ({
  submitDetailedFeedback: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      feedbackCategoryBug: "Bug",
      feedbackCategoryFeature: "Feature",
      feedbackCategoryOther: "Other",
      feedbackEmailPlaceholder: "Email (optional)",
      feedbackError: "Could not send. Your message is still here — try again.",
      feedbackInvalidEmail: "Invalid email",
      feedbackMessagePlaceholder: "Tell us what happened",
      feedbackPrivacyNotice: "Feedback privacy notice",
      feedbackSending: "Sending...",
      feedbackSubmit: "Send feedback",
      feedbackSubtitle: "Help improve ZenFlow",
      feedbackSuccess: "Sent",
      feedbackTitle: "Send feedback",
    },
  }),
}));

vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/hooks/useThrottledCallback", () => ({
  useThrottledCallback: (callback: () => void) => callback,
}));
vi.mock("@/lib/feedbackService", () => feedbackServiceMock);
vi.mock("@/lib/platform", () => ({ platform: "web" }));

describe("FeedbackForm accessibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    feedbackServiceMock.submitDetailedFeedback.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("connects the modal focus trap to the rendered dialog", () => {
    render(<FeedbackForm open onOpenChange={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(60);
    });

    const dialog = screen.getByRole("dialog", { name: "Send feedback" });
    const close = within(dialog).getByRole("button", { name: "Close" });
    const email = within(dialog).getByRole("textbox", { name: "Email (optional)" });
    expect(close).toHaveFocus();

    email.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
  });

  it("keeps every feedback category target at least 48px tall", () => {
    render(<FeedbackForm open onOpenChange={vi.fn()} />);

    for (const name of ["Bug", "Feature", "Other"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("min-h-[48px]");
    }
  });

  it("exposes an invalid optional email through the input accessibility contract", async () => {
    render(<FeedbackForm open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Tell us what happened" }), {
      target: { value: "The reminder did not open" },
    });
    const email = screen.getByRole("textbox", { name: "Email (optional)" });
    fireEvent.change(email, { target: { value: "not-an-email" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    });

    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "feedback-email-error");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "feedback-email-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
  });

  it("does not let a completed submission timer close a newly reopened form", async () => {
    feedbackServiceMock.submitDetailedFeedback.mockResolvedValue(true);
    const onOpenChange = vi.fn();
    const { rerender } = render(<FeedbackForm open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Tell us what happened" }), {
      target: { value: "Thoughtful feedback" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Sent" })).toBeInTheDocument();

    rerender(<FeedbackForm open={false} onOpenChange={onOpenChange} />);
    rerender(<FeedbackForm open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("button", { name: "Send feedback" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Tell us what happened" })).toHaveValue("");
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("renders at the viewport root when opened from a transformed settings surface", () => {
    const settingsSurface = document.createElement("div");
    settingsSurface.style.transform = "translateZ(0)";
    document.body.append(settingsSurface);

    try {
      render(<FeedbackForm open onOpenChange={vi.fn()} />, { container: settingsSurface });

      const dialog = screen.getByRole("dialog", { name: "Send feedback" });
      expect(settingsSurface).not.toContainElement(dialog);
      expect(document.body).toContainElement(dialog);
    } finally {
      settingsSurface.remove();
    }
  });
});
