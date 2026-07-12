import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const feedbackMocks = vi.hoisted(() => ({
  submitDetailedFeedback: vi.fn(),
  submitQuickFeedback: vi.fn(),
}));

vi.mock("@/lib/feedbackService", () => feedbackMocks);

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ariaFeedback: "Feedback dialog",
      close: "Close",
      feedbackBug: "Bug",
      feedbackCategoryBug: "Bug",
      feedbackCategoryFeature: "Feature",
      feedbackCategoryOther: "Other",
      feedbackEmailPlaceholder: "Email (optional)",
      feedbackError: "Could not send. Your message is still here — try again.",
      feedbackFeature: "Feature",
      feedbackInvalidEmail: "Invalid email",
      feedbackMessagePlaceholder: "Tell us what happened",
      feedbackOther: "Other",
      feedbackPlaceholder: "Describe your feedback...",
      feedbackPrivacyNotice: "Feedback privacy notice",
      feedbackSending: "Sending...",
      feedbackSubmit: "Send feedback",
      feedbackSubtitle: "Help improve ZenFlow",
      feedbackSuccess: "Sent",
      feedbackTitle: "Send feedback",
      send: "Send",
      sendFeedback: "Send feedback",
      sending: "Sending...",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({ useBackHandler: vi.fn() }));
vi.mock("@/hooks/useModalA11y", () => ({
  useModalA11y: vi.fn(() => ({
    modalRef: { current: null },
    handleKeyDown: vi.fn(),
    modalProps: {},
  })),
}));
vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/hooks/useThrottledCallback", () => ({
  useThrottledCallback: (callback: () => void) => callback,
}));
vi.mock("@/lib/haptics", () => ({
  haptics: { light: vi.fn(), medium: vi.fn() },
}));
vi.mock("@/lib/platform", () => ({ platform: "web" }));

import { FeedbackButton } from "@/components/FeedbackButton";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SK } from "@/lib/storageKeys";

describe("feedback delivery truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    feedbackMocks.submitDetailedFeedback.mockResolvedValue(false);
    feedbackMocks.submitQuickFeedback.mockResolvedValue(false);
  });

  it("keeps the detailed message visible and reports an error when delivery fails", async () => {
    const onOpenChange = vi.fn();
    render(<FeedbackForm open onOpenChange={onOpenChange} />);

    const message = screen.getByLabelText("Tell us what happened");
    fireEvent.change(message, { target: { value: "The reminder time did not save." } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(feedbackMocks.submitDetailedFeedback).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Could not send. Your message is still here — try again."
    );
    expect(screen.getByRole("button", { name: "Send feedback" })).toBeEnabled();
    expect(message).toHaveValue("The reminder time did not save.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(localStorage.getItem(SK.FEEDBACK)).toBeNull();
  });

  it("keeps the quick-feedback dialog and message open when delivery fails", async () => {
    render(<FeedbackButton />);

    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    const message = screen.getByPlaceholderText("Describe your feedback...");
    fireEvent.change(message, { target: { value: "The contrast control is hard to find." } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(feedbackMocks.submitQuickFeedback).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog", { name: "Feedback dialog" })).toBeInTheDocument();
    expect(message).toHaveValue("The contrast control is hard to find.");
    expect(screen.getByText("Could not send. Your message is still here — try again.")).toBeInTheDocument();
    expect(localStorage.getItem(SK.PENDING_FEEDBACK)).toBeNull();
  });
});
