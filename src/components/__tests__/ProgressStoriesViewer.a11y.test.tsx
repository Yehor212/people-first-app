import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorySlide } from "@/lib/progressStories";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      weeklyStory: "Weekly story",
      close: "Close",
      pause: "Pause",
      play: "Play",
      previous: "Previous",
      next: "Next",
      shareButton: "Share",
      storyTapLeft: "Previous",
      storyTapCenter: "Pause",
      storyTapRight: "Next",
      myProgress: "My progress",
      sharePreview: "Share preview",
      shareDownload: "Download",
      shareCopyLink: "Copy",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({ useBackHandler: () => undefined }));
vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: () => undefined }));
vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));
vi.mock("@/components/ThemeToggle", () => ({
  useTheme: () => ({ effectiveTheme: "light" }),
}));
vi.mock("@/hooks/useShareFlow", () => ({
  useShareFlow: () => ({
    status: "preview",
    imageUrl: "data:image/png;base64,",
    imageBlob: new Blob([], { type: "image/png" }),
    error: null,
    lastAction: null,
    generate: vi.fn(),
    download: vi.fn(),
    copy: vi.fn(),
    share: vi.fn(),
  }),
}));
vi.mock("../stories/slides", () => ({
  IntroSlide: () => <div>Intro</div>,
  MoodSlide: () => <div>Mood</div>,
  HabitsSlide: () => <div>Habits</div>,
  FocusSlide: () => <div>Focus</div>,
  StreakSlide: () => <div>Streak</div>,
  AchievementSlide: () => <div>Achievement</div>,
  SummarySlide: () => <div>Summary</div>,
  OutroSlide: () => <div>Outro</div>,
}));

import { ProgressStoriesViewer } from "../ProgressStoriesViewer";

const slides: StorySlide[] = [
  { type: "intro", title: "Week", gradient: "linear-gradient(black, black)", accentColor: "white" },
  { type: "outro", title: "Next", gradient: "linear-gradient(black, black)", accentColor: "white" },
];

describe("ProgressStoriesViewer modal accessibility", () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("focuses the close control, traps focus, and restores the opener", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Open story";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <ProgressStoriesViewer slides={slides} onClose={vi.fn()} weekRange="Week" />,
    );
    await act(async () => vi.advanceTimersByTime(50));

    const dialog = screen.getByRole("dialog", { name: "Weekly story" });
    const close = within(dialog).getByRole("button", { name: "Close" });
    const pause = within(dialog).getAllByRole("button", { name: "Pause" }).at(-1)!;
    expect(close).toHaveFocus();
    expect(close).toHaveClass("min-h-[44px]", "min-w-[44px]");
    expect(pause).toHaveClass("min-h-[44px]", "min-w-[44px]");

    const focusable = within(dialog)
      .getAllByRole("button")
      .filter((button) => !button.hasAttribute("disabled"));
    focusable.at(-1)?.focus();
    fireEvent.keyDown(focusable.at(-1)!, { key: "Tab" });
    expect(focusable[0]).toHaveFocus();

    unmount();
    await act(async () => vi.advanceTimersByTime(10));
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("uses explicit navigation controls without a nested interactive story container", () => {
    const source = readFileSync("src/components/ProgressStoriesViewer.tsx", "utf8");
    expect(source).not.toContain('role="button"');
    expect(source).not.toContain("handleTap(e as unknown as React.MouseEvent)");
    expect(source).toContain('aria-label={t.previous || "Previous"}');
    expect(source).toContain('data-testid="story-next-control"');
  });

  it("describes the current slide position and names the last advance action as Close", () => {
    render(<ProgressStoriesViewer slides={slides} onClose={vi.fn()} weekRange="Week" />);
    const story = screen.getByRole("dialog", { name: "Weekly story" });
    const next = screen.getByTestId("story-next-control");
    expect(within(story).getByRole("listitem", { name: "Week" })).toHaveAttribute(
      "aria-posinset",
      "1",
    );
    expect(next).toHaveAccessibleName("Next");
    fireEvent.click(next);
    expect(within(story).getByRole("listitem", { name: "Next" })).toHaveAttribute(
      "aria-posinset",
      "2",
    );
    expect(next).toHaveAccessibleName("Close");
  });

  it("keeps story controls and content inside native safe areas", () => {
    const source = readFileSync("src/components/ProgressStoriesViewer.tsx", "utf8");
    expect(source).toContain("pt-[max(1rem,var(--safe-top))]");
    expect(source).toContain("top-[max(2rem,calc(var(--safe-top)+1.5rem))]");
    expect(source).toContain("pt-[calc(5rem+var(--safe-top))]");
    expect(source).toContain("pb-[calc(4rem+var(--safe-bottom))]");
    expect(source).toContain("bottom-[max(1rem,var(--safe-bottom))]");
  });

  it("keeps the nested share dialog above the story and restores focus when it closes", async () => {
    const onClose = vi.fn();
    render(<ProgressStoriesViewer slides={slides} onClose={onClose} weekRange="Week" />);
    await act(async () => vi.advanceTimersByTime(50));

    const story = screen.getByRole("dialog", { name: "Weekly story" });
    const shareTrigger = within(story).getByRole("button", { name: "Share" });
    shareTrigger.focus();
    fireEvent.click(shareTrigger);
    await act(async () => vi.advanceTimersByTime(50));

    const shareDialog = screen.getByRole("dialog", { name: "My progress" });
    const nestedClose = within(shareDialog).getByRole("button", { name: "Close" });
    const nestedActions = within(shareDialog)
      .getAllByRole("button")
      .filter((button) => !button.hasAttribute("disabled"));

    expect(story).toHaveClass("z-[100]");
    expect(story).toHaveAttribute("aria-hidden", "true");
    expect(story).toHaveAttribute("inert");
    expect(story).not.toHaveAttribute("aria-modal", "true");
    expect(shareDialog).toHaveClass("z-[110]");
    expect(nestedClose).toHaveFocus();

    nestedActions.at(-1)?.focus();
    fireEvent.keyDown(nestedActions.at(-1)!, { key: "Tab" });
    expect(nestedActions[0]).toHaveFocus();

    fireEvent.keyDown(nestedClose, { key: "Escape" });
    await act(async () => vi.advanceTimersByTime(10));
    expect(screen.queryByRole("dialog", { name: "My progress" })).not.toBeInTheDocument();
    expect(story).not.toHaveAttribute("aria-hidden");
    expect(story).not.toHaveAttribute("inert");
    expect(story).toHaveAttribute("aria-modal", "true");
    expect(onClose).not.toHaveBeenCalled();
    expect(shareTrigger).toHaveFocus();
  });
});
