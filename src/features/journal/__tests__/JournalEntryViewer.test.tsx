import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "../types";
import { JournalEntryViewer } from "../JournalEntryViewer";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "uk",
    t: {
      back: "Назад",
      delete: "Видалити",
      journalEdit: "Редагувати",
      mood: "Настрій",
      moodBad: "Поганий",
      journalWordCountOne: "{count} слово",
      journalWordCountFew: "{count} слова",
      journalWordCountMany: "{count} слів",
      journalWordCountOther: "{count} слова",
      justNow: "Щойно",
      minutesAgo: "{count} хв тому",
      hoursAgo: "{count} год тому",
      daysAgo: "{count} дн тому",
    },
  }),
}));

type MotionDivMockProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
  initial?: unknown;
  animate?: unknown;
  transition?: unknown;
};

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial, animate, transition, ...rest }: MotionDivMockProps) => {
      void initial;
      void animate;
      void transition;
      return <div {...rest}>{children}</div>;
    },
  },
}));

vi.mock("../DiaryMiniOrb", () => ({
  DiaryMiniOrb: () => <div data-testid="diary-mini-orb" />,
}));

vi.mock("../JournalPhotoGallery", () => ({
  JournalPhotoGallery: () => <div data-testid="photo-gallery" />,
}));

vi.mock("../JournalAudioPlayer", () => ({
  JournalAudioPlayer: () => <div data-testid="audio-player" />,
}));

vi.mock("../StickerRenderer", () => ({
  StickerRenderer: () => <span data-testid="sticker-renderer" />,
}));

describe("JournalEntryViewer", () => {
  it("places the full date in the mood hero next to the time without duplicating it below the title", () => {
    const createdAt = new Date(2026, 3, 26, 12, 31).getTime();
    const entry: JournalEntry = {
      id: "entry-1",
      date: "2026-04-26",
      title: "bad",
      content: "стресовий",
      stickers: [],
      photoIds: [],
      audioIds: [],
      mood: "bad",
      tags: ["bad"],
      createdAt,
      updatedAt: createdAt,
    };

    render(
      <JournalEntryViewer
        entry={entry}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const hero = screen.getByTestId("journal-entry-mood-hero");
    expect(within(hero).getByText(/12:31/)).toBeInTheDocument();
    expect(within(hero).getByText(/неділя, 26 квітня 2026 р\./i)).toBeInTheDocument();

    const lowerMeta = screen.getByTestId("journal-entry-body-meta");
    expect(within(lowerMeta).queryByText(/неділя, 26 квітня 2026 р\./i)).not.toBeInTheDocument();
  });
});
