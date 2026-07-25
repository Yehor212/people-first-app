import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JournalAudio, JournalEntry } from "../types";
import { JournalEntryViewer } from "../JournalEntryViewer";
import { JOURNAL_FAVORITE_TAG } from "../journalFavorite";

const journalStorageMocks = vi.hoisted(() => ({
  getAudioForEntry: vi.fn<() => Promise<JournalAudio[]>>(() => Promise.resolve([])),
}));

vi.mock("../journalStorage", () => journalStorageMocks);

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "uk",
    t: {
      back: "Назад",
      cancel: "Скасувати",
      delete: "Видалити",
      journalDeleteConfirm: "Ви впевнені, що хочете видалити цей запис?",
      journalEdit: "Редагувати",
      journalAddFavorite: "Додати до обраного",
      journalRemoveFavorite: "Прибрати з обраного",
      journalAudioLoadError: "Не вдалося завантажити аудіо цього запису.",
      journalAudioLoadRetry: "Повторити завантаження аудіо",
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
  it("keeps a missing recording visible as a retryable load failure", async () => {
    journalStorageMocks.getAudioForEntry
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([
        {
          id: "audio-recovered",
          entryId: "entry-audio-recovery",
          data: "data:audio/webm;base64,dm9pY2U=",
          duration: 12,
          mimeType: "audio/webm",
          createdAt: 1,
        },
      ]);
    const entry: JournalEntry = {
      id: "entry-audio-recovery",
      date: "2026-07-18",
      title: "Voice memory",
      content: "",
      stickers: [],
      photoIds: [],
      audioIds: ["audio-recovered"],
      tags: [],
      createdAt: 1,
      updatedAt: 2,
    };

    render(
      <JournalEntryViewer
        entry={entry}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не вдалося завантажити аудіо цього запису.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Повторити завантаження аудіо" }),
    );

    await waitFor(() => expect(screen.getByTestId("audio-player")).toBeInTheDocument());
    expect(journalStorageMocks.getAudioForEntry).toHaveBeenCalledTimes(2);
  });

  it("requires explicit confirmation before deleting from the read-only view", () => {
    const onDelete = vi.fn();
    const entry: JournalEntry = {
      id: "entry-delete-confirm",
      date: "2026-07-16",
      title: "Private memory",
      content: "Keep this entry unless deletion is confirmed.",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 2,
    };

    render(
      <JournalEntryViewer
        entry={entry}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Видалити" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Ви впевнені, що хочете видалити цей запис?")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Скасувати" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Видалити" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Видалити" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("keeps the viewer header readable at narrow mobile widths", () => {
    const entry: JournalEntry = {
      id: "entry-mobile-header",
      date: "2026-04-26",
      title: "",
      content: "Mobile memory",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: new Date(2026, 3, 26, 12, 31).getTime(),
      updatedAt: new Date(2026, 3, 26, 12, 31).getTime(),
    };

    render(
      <JournalEntryViewer
        entry={entry}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByTestId("journal-entry-header-date")).toHaveClass(
      "hidden",
      "min-[520px]:inline",
    );
    const editButton = screen.getByRole("button", { name: "Редагувати" });
    expect(editButton).toHaveClass("max-[359px]:w-11", "max-[359px]:px-0");
    expect(within(editButton).getByText("Редагувати")).toHaveClass("max-[359px]:sr-only");
  });

  it("uses the selected civil date and preserves each saved text direction", () => {
    const entry: JournalEntry = {
      id: "entry-mixed-direction",
      date: "2026-04-26",
      title: "عنوان عربي — Project 42",
      content: "English https://example.test/@user (2026-04-26)! שלום",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: new Date(2026, 4, 2, 12, 31).getTime(),
      updatedAt: new Date(2026, 4, 2, 12, 31).getTime(),
    };

    render(
      <JournalEntryViewer
        entry={entry}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const mixedTitle = screen.getByRole("heading", { name: "عنوان عربي — Project 42" });
    expect(mixedTitle).toHaveAttribute("dir", "auto");
    expect(mixedTitle).toHaveClass("[overflow-wrap:anywhere]");
    const mixedContent = screen.getByText("English https://example.test/@user (2026-04-26)! שלום").parentElement;
    expect(mixedContent).toHaveAttribute("dir", "auto");
    expect(mixedContent).toHaveClass("[unicode-bidi:plaintext]", "[overflow-wrap:anywhere]");
    expect(screen.getAllByText(/26 квіт/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/2 трав/i)).not.toBeInTheDocument();
  });

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

  it("keeps saved tags private in the entry viewer", () => {
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

    expect(screen.queryByTestId("journal-entry-tag")).not.toBeInTheDocument();
    expect(screen.queryByText("work")).not.toBeInTheDocument();
    expect(screen.queryByText("#work")).not.toBeInTheDocument();
  });

  it("lets the user change favorite status directly from the read-only view", () => {
    const onToggleFavorite = vi.fn();
    const entry: JournalEntry = {
      id: "entry-favorite",
      date: "2026-07-13",
      title: "Memory",
      content: "Worth returning to",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [JOURNAL_FAVORITE_TAG],
      createdAt: 1,
      updatedAt: 2,
    };

    render(
      <JournalEntryViewer
        entry={entry}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        onToggleFavorite={onToggleFavorite}
      />
    );

    const favoriteButton = screen.getByRole("button", { name: "Прибрати з обраного" });
    expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(favoriteButton);
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("blocks repeated favorite intent while the previous update is pending", () => {
    const onToggleFavorite = vi.fn();
    const entry: JournalEntry = {
      id: "entry-favorite-pending",
      date: "2026-07-13",
      title: "Memory",
      content: "Worth returning to",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 2,
    };

    render(
      <JournalEntryViewer
        entry={entry}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        onToggleFavorite={onToggleFavorite}
        favoritePending
      />,
    );

    const favoriteButton = screen.getByRole("button", { name: "Додати до обраного" });
    expect(favoriteButton).toBeDisabled();
    expect(favoriteButton).toHaveAttribute("aria-busy", "true");
    fireEvent.click(favoriteButton);
    expect(onToggleFavorite).not.toHaveBeenCalled();
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
      fontSize: "calc(22px * var(--font-scale, 1))",
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
