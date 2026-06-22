import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { OnThisDayCard } from "../OnThisDayCard";
import type { JournalEntry } from "../types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    isRTL: false,
    language: "en",
    t: {
      close: "Close",
      diaryOnThisDay: "On This Day",
      diaryYearAgo: "year ago",
      diaryYearsAgo: "years ago",
      journalHubSpacePrivate: "Private",
    },
  }),
}));

vi.mock("@/lib/safeJson", () => ({
  storageGetRaw: vi.fn(() => null),
  storageSetRaw: vi.fn(),
}));

vi.mock("@/lib/haptics", () => ({
  hapticTap: vi.fn(),
}));

vi.mock("../DiaryMiniOrb", () => ({
  DiaryMiniOrb: () => <span data-testid="diary-mini-orb" />,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
  motion: {
    div: ({ children, initial, animate, exit, transition, whileTap, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileTap;
      return <div {...rest}>{children}</div>;
    },
  },
}));

function todayInPreviousYear(): string {
  const now = new Date();
  return [
    String(now.getFullYear() - 1),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

const privateMemory: JournalEntry = {
  id: "entry-on-this-day-private",
  date: todayInPreviousYear(),
  title: "Therapy plan",
  content: "Sensitive appointment notes about family and money.",
  stickers: [],
  photoIds: [],
  audioIds: [],
  mood: "bad",
  tags: ["secret"],
  createdAt: Date.UTC(2025, 5, 17, 12, 30),
  updatedAt: Date.UTC(2025, 5, 17, 12, 30),
};

const secondPrivateMemory: JournalEntry = {
  ...privateMemory,
  id: "entry-on-this-day-private-second",
  title: "Medication note",
  content: "Another private note from the same calendar day.",
  createdAt: Date.UTC(2024, 5, 17, 8, 15),
  updatedAt: Date.UTC(2024, 5, 17, 8, 15),
};

describe("OnThisDayCard private mode", () => {
  it("keeps the hidden memory inert for pointer and keyboard activation", () => {
    const onOpenEntry = vi.fn();

    render(
      <OnThisDayCard
        entries={[privateMemory]}
        onOpenEntry={onOpenEntry}
        onDismiss={vi.fn()}
        privateMode
      />,
    );

    const card = screen.getByRole("button", { name: /On This Day/i });
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.queryByText(/Therapy plan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sensitive appointment/i)).not.toBeInTheDocument();

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onOpenEntry).not.toHaveBeenCalled();
  });

  it("hides extra same-day memory counts while private previews are hidden", () => {
    render(
      <OnThisDayCard
        entries={[privateMemory, secondPrivateMemory]}
        onOpenEntry={vi.fn()}
        onDismiss={vi.fn()}
        privateMode
      />,
    );

    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.queryByText(/more from this day/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Medication note/i)).not.toBeInTheDocument();
  });

  it("hides anniversary age while private previews are hidden", () => {
    render(
      <OnThisDayCard
        entries={[privateMemory]}
        onOpenEntry={vi.fn()}
        onDismiss={vi.fn()}
        privateMode
      />,
    );

    const card = screen.getByRole("button", { name: /On This Day/i });
    expect(card).toHaveAccessibleName(/Private/i);
    expect(card).not.toHaveAccessibleName(/year ago|years ago/i);
    expect(screen.queryByText(/year ago|years ago/i)).not.toBeInTheDocument();
  });
});
