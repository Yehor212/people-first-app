import { act, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { MoodDotStrip } from "../MoodDotStrip";
import type { JournalEntry } from "../types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    isRTL: false,
    t: {
      journalPrivateEntry: "Private entry",
      privateMode: "Private",
    },
  }),
}));

vi.mock("../DiaryMiniOrb", () => ({
  DiaryMiniOrb: () => <span data-testid="mood-dot-orb" />,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    button: ({ children, layoutId, whileHover, whileTap, ...rest }: any) => {
      void layoutId;
      void whileHover;
      void whileTap;
      return <button {...rest}>{children}</button>;
    },
    div: ({ children, initial, animate, exit, transition, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <div {...rest}>{children}</div>;
    },
  },
}));

const entry: JournalEntry = {
  id: "entry-private-dot",
  date: "2026-06-17",
  title: "Therapy plan",
  content: "Sensitive appointment notes.",
  stickers: [],
  photoIds: [],
  audioIds: [],
  mood: "bad",
  tags: ["secret"],
  createdAt: Date.UTC(2026, 5, 17, 12, 30),
  updatedAt: Date.UTC(2026, 5, 17, 12, 30),
};

describe("MoodDotStrip private mode", () => {
  it("keeps private entry titles and moods out of desktop rail aria labels", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-06-19T12:30:00Z"));

      render(
        <MoodDotStrip
          entries={[entry]}
          activeEntryId={null}
          onOpenEntry={vi.fn()}
          privateMode
        />,
      );

      const privateEntry = screen.getByRole("option", { name: /Private entry/i });
      expect(screen.queryByRole("option", { name: /Therapy plan/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("option", { name: /bad/i })).not.toBeInTheDocument();

      fireEvent.mouseEnter(privateEntry);
      void act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText("Private entry")).toBeInTheDocument();
      expect(screen.queryByText("2d")).not.toBeInTheDocument();
      expect(screen.queryByText(/Therapy plan/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps private rail entries inert for pointer and keyboard activation", () => {
    const onOpenEntry = vi.fn();

    render(
      <MoodDotStrip
        entries={[entry]}
        activeEntryId={null}
        onOpenEntry={onOpenEntry}
        privateMode
      />,
    );

    const list = screen.getByRole("listbox", { name: /Diary entries/i });
    const privateEntry = screen.getByRole("option", { name: /Private entry/i });
    expect(privateEntry).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(privateEntry);
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "Enter" });

    expect(onOpenEntry).not.toHaveBeenCalled();
  });

  it("does not expose exact hidden entry count through private rail dots", () => {
    const secondEntry: JournalEntry = {
      ...entry,
      id: "entry-private-dot-second",
      title: "Medication reminder",
      content: "Another sensitive note.",
      createdAt: Date.UTC(2026, 5, 17, 13, 45),
      updatedAt: Date.UTC(2026, 5, 17, 13, 45),
    };

    render(
      <MoodDotStrip
        entries={[entry, secondEntry]}
        activeEntryId={null}
        onOpenEntry={vi.fn()}
        privateMode
      />,
    );

    expect(screen.getAllByRole("option", { name: /Private entry/i })).toHaveLength(1);
    expect(screen.queryByRole("option", { name: /Medication reminder/i })).not.toBeInTheDocument();
  });
});
