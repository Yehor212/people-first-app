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
  JournalPhotoGallery: ({ photoIds }: { photoIds: string[] }) => (
    <div data-testid="photo-gallery" data-photo-ids={photoIds.join(",")} />
  ),
}));

vi.mock("../FloatingMediaLayer", () => ({
  ReadOnlyFloatingMediaLayer: ({
    photoIds,
    layout,
  }: {
    photoIds: string[];
    layout: Record<string, { x: number; y: number; width: number }>;
  }) => (
    <div
      data-testid="readonly-floating-media"
      data-photo-ids={photoIds.join(",")}
      data-layout={JSON.stringify(layout)}
    />
  ),
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

  it("shows old saved tags without visible hash prefixes", () => {
    const createdAt = new Date(2026, 3, 26, 12, 31).getTime();
    const entry: JournalEntry = {
      id: "entry-hash-tag",
      date: "2026-04-26",
      title: "Reflection",
      content: "Something useful",
      stickers: [],
      photoIds: [],
      audioIds: [],
      mood: "good",
      tags: ["#work"],
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

    expect(screen.getByTestId("journal-entry-tag")).toHaveTextContent("work");
    expect(screen.queryByText("#work")).not.toBeInTheDocument();
  });

  it("replays saved floating photo layout separately from the normal gallery", () => {
    const createdAt = new Date(2026, 3, 26, 12, 31).getTime();
    const entry: JournalEntry = {
      id: "entry-photo-layout",
      date: "2026-04-26",
      title: "Photo memory",
      content: "The photo should stay where I left it.",
      stickers: [],
      photoIds: ["photo-floating", "photo-gallery"],
      photoLayout: {
        "photo-floating": { x: 44, y: 58, width: 220 },
      },
      audioIds: [],
      tags: [],
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

    expect(screen.getByTestId("readonly-floating-media")).toHaveAttribute(
      "data-photo-ids",
      "photo-floating",
    );
    expect(screen.getByTestId("readonly-floating-media").getAttribute("data-layout")).toContain(
      '"photo-floating":{"x":44,"y":58,"width":220}',
    );
    expect(screen.getByTestId("photo-gallery")).toHaveAttribute("data-photo-ids", "photo-gallery");
  });

  it("replays saved paper, ink, and font size in read-only view", () => {
    const createdAt = new Date(2026, 3, 26, 12, 31).getTime();
    const entry: JournalEntry = {
      id: "entry-style-replay",
      date: "2026-04-26",
      title: "Styled memory",
      content: "Styled body",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      paperColor: "milky",
      inkColor: "#34d399",
      fontSize: "large",
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

    expect(screen.getByTestId("journal-entry-viewer-paper")).toHaveStyle({
      backgroundColor: "#F6F3E9",
      color: "#243936",
    });
    expect(screen.getByText("Styled body").parentElement).toHaveStyle({
      color: "#047857",
      fontSize: "22px",
    });
  });

  it("falls back safely for legacy invalid paper values and replays the font presentation", () => {
    const entry: JournalEntry = {
      id: "entry-legacy-style",
      date: "2026-07-13",
      title: "Legacy memory",
      content: "Still readable",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      paperColor: "unsupported" as JournalEntry["paperColor"],
      font: "dancing",
      createdAt: 1,
      updatedAt: 2,
    };

    render(
      <JournalEntryViewer
        entry={entry}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByTestId("journal-entry-viewer-paper")).toHaveStyle({
      backgroundColor: "#0D0D14",
    });
    expect(screen.getByRole("heading", { name: "Legacy memory" })).toHaveStyle({
      fontFamily: '"Fraunces Variable", "Literata Variable", Georgia, Cambria, "Times New Roman", serif',
      fontStyle: "italic",
    });
    expect(screen.getByText("Still readable").parentElement).toHaveStyle({
      fontStyle: "italic",
    });
  });

});
