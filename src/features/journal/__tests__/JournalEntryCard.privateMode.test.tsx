import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { JournalEntryCard } from "../JournalEntryCard";
import type { JournalEntry } from "../types";

const mocks = vi.hoisted(() => ({
  getPhotoById: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    isRTL: false,
    language: "en",
    t: {
      journalPrivateEntry: "Entry preview hidden",
      journalPrivateEntryHint: "Change the diary screen privacy setting to see this entry.",
      more: "More",
    },
  }),
}));

vi.mock("@/lib/haptics", () => ({
  hapticTap: vi.fn(() => Promise.resolve()),
  hapticMedium: vi.fn(() => Promise.resolve()),
  hapticWarning: vi.fn(() => Promise.resolve()),
}));

vi.mock("../DiaryMiniOrb", () => ({
  DiaryMiniOrb: () => <span data-testid="diary-private-test-mood-orb" />,
}));

vi.mock("../journalStorage", () => ({
  getPhotoById: mocks.getPhotoById,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
  );
  return {
    motion: { div: MotionDiv },
    useMotionValue: () => ({ set: () => undefined }),
    useTransform: () => 0,
  };
});

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "entry-private-1",
    date: "2026-06-17",
    title: "Therapy plan",
    content: "Sensitive appointment notes and family details.",
    stickers: ["star"],
    photoIds: ["photo-private"],
    audioIds: ["audio-private"],
    mood: "bad",
    tags: ["secret"],
    createdAt: Date.UTC(2026, 5, 17, 12, 30),
    updatedAt: Date.UTC(2026, 5, 17, 12, 30),
    ...overrides,
  };
}

const cardSource = readFileSync("src/features/journal/JournalEntryCard.tsx", "utf8");

describe("JournalEntryCard private mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces private diary details with a neutral locked placeholder", async () => {
    render(
      <JournalEntryCard
        entry={makeEntry()}
        privateMode
        onTap={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Entry preview hidden")).toBeInTheDocument();
    expect(
      screen.getByText("Change the diary screen privacy setting to see this entry."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Therapy plan")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sensitive appointment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("diary-private-test-mood-orb")).not.toBeInTheDocument();
    const privateHint = screen.getByText(
      "Change the diary screen privacy setting to see this entry.",
    );
    expect(privateHint.className).not.toContain("line-clamp");
    expect(privateHint.className).toContain("whitespace-normal");
    expect(privateHint.className).toContain("break-words");

    await waitFor(() => expect(mocks.getPhotoById).not.toHaveBeenCalled());
  });

  it("does not open the full entry from the private placeholder", () => {
    const onTap = vi.fn();

    render(
      <JournalEntryCard
        entry={makeEntry()}
        privateMode
        onTap={onTap}
        onDelete={vi.fn()}
      />
    );

    const privateCard = screen.getByRole("button");
    expect(privateCard).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(privateCard);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("guards private placeholders from swipe delete", () => {
    const dragEndBlock = /const handleDragEnd = useCallback\([\s\S]*?\n\s{2}\);/.exec(cardSource)?.[0] ?? "";
    const motionCardBlock = /aria-disabled=\{privateMode \|\| undefined\}[\s\S]*?onDragEnd=\{handleDragEnd\}/.exec(cardSource)?.[0] ?? "";

    expect(dragEndBlock).toContain("privateMode");
    expect(dragEndBlock.indexOf("privateMode")).toBeLessThan(
      dragEndBlock.indexOf("setSwipeDeleteConfirmOpen"),
    );
    expect(dragEndBlock).not.toContain("onSwipeDelete");
    expect(motionCardBlock).toContain('drag={privateMode ? false : "x"}');
  });

  it("requires confirmation before a swipe can request permanent deletion", () => {
    const dragEndBlock = /const handleDragEnd = useCallback\([\s\S]*?\n\s{2}\);/.exec(cardSource)?.[0] ?? "";

    expect(cardSource).toContain("const [swipeDeleteConfirmOpen, setSwipeDeleteConfirmOpen]");
    expect(dragEndBlock).toContain("setSwipeDeleteConfirmOpen(true)");
    expect(dragEndBlock).not.toContain("onSwipeDelete?.(entry.id)");
    expect(cardSource).toContain("useBackHandler(swipeDeleteConfirmOpen");
    expect(cardSource).toContain("<AlertDialog open={swipeDeleteConfirmOpen}");
    expect(cardSource).toContain("onSwipeDelete?.(entry.id)");
  });

  it("does not expose contextual actions from the private placeholder", () => {
    const onActions = vi.fn();

    render(
      <JournalEntryCard
        entry={makeEntry()}
        privateMode
        onTap={vi.fn()}
        onDelete={vi.fn()}
        onActions={onActions}
      />
    );

    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
    expect(onActions).not.toHaveBeenCalled();
  });

  it("ignores long press actions from the private placeholder", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();

    render(
      <JournalEntryCard
        entry={makeEntry()}
        privateMode
        onTap={vi.fn()}
        onDelete={vi.fn()}
        onLongPress={onLongPress}
      />
    );

    fireEvent.touchStart(screen.getByRole("button"), {
      touches: [{ clientX: 20, clientY: 20 }],
    });
    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not reuse a loaded thumbnail for another private photo id", async () => {
    mocks.getPhotoById.mockImplementation((photoId: string) => {
      if (photoId === "photo-private") {
        return Promise.resolve({ id: photoId, thumbnail: "data:image/jpeg;base64,old-thumb" });
      }
      return new Promise(() => undefined);
    });

    const { container, rerender } = render(
      <JournalEntryCard
        entry={makeEntry()}
        onTap={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('img[src="data:image/jpeg;base64,old-thumb"]')).toBeInTheDocument();
    });

    rerender(
      <JournalEntryCard
        entry={makeEntry({ id: "entry-private-2", photoIds: ["photo-next"] })}
        onTap={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container.querySelector('img[src="data:image/jpeg;base64,old-thumb"]')).not.toBeInTheDocument();
  });

  it("renders a text-only entry without reading thumbnail data from null state", () => {
    render(
      <JournalEntryCard
        entry={makeEntry({
          id: "entry-text-only",
          title: "Plain thought",
          content: "No photo should still render safely.",
          photoIds: [],
          audioIds: [],
          stickers: [],
          tags: [],
          mood: undefined,
        })}
        onTap={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Plain thought")).toBeInTheDocument();
    expect(screen.getByText(/No photo should still render safely/i)).toBeInTheDocument();
    expect(mocks.getPhotoById).not.toHaveBeenCalled();
  });
});
