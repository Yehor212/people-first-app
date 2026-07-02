import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry, JournalSpace, JournalSpaceCapture } from "../types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "uk",
    isRTL: false,
    t: {
      back: "Назад",
      close: "Закрити",
      journalCaptureOpenEditor: "Відкрити як запис",
      journalEntries: "записів",
      journalEntryCountOther: "{count} записів",
      journalEntryCountOne: "{count} запис",
      journalFolderCreate: "Створити",
      journalHubSpaceGratitude: "Мої вдячності",
      journalHubSpaceGratitudeDesc: "Сад вдячності",
      journalSearch: "Пошук записів...",
      journalSpaceEmpty: "Цей простір порожній",
      journalSpaceGratitudeCapturePrompt: "За що я вдячний",
      journalSpaceGratitudeCaptureTitle: "Вдячність",
      journalSpaceLatestActivity: "Остання активність",
      journalSpaceModeGratitude: "Сад вдячності",
      journalSpaceAddEntry: "Додати запис",
      journalNoMatchingEntries: "Нічого не знайдено",
      journalNoMatchingHint: "Спробуйте інший запит",
      quoteJournal1: "Наповніть сторінку диханням свого серця.",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/hooks/useInputMethod", () => ({
  useInputMethod: () => ({ isMouse: false }),
}));

vi.mock("@/components/desktop/ContextMenu", () => ({
  ContextMenu: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock("../JournalEntryCard", () => ({
  JournalEntryCard: ({
    entry,
    onActions,
  }: {
    entry: JournalEntry;
    onActions?: (entry: JournalEntry) => void;
  }) => (
    <article data-testid={`journal-entry-card-${entry.id}`}>
      <span>{entry.title}</span>
      {onActions ? (
        <button
          type="button"
          data-testid={`journal-entry-actions-${entry.id}`}
          onClick={() => onActions(entry)}
        >
          actions
        </button>
      ) : null}
    </article>
  ),
}));

vi.mock("../JournalCaptureLauncher", () => ({
  JournalCaptureLauncher: () => (
    <button
      type="button"
      aria-label="Open journal capture launcher"
      data-testid="journal-capture-launcher"
    />
  ),
}));

vi.mock("@/lib/journalAI", () => ({
  generateAllMissingEmbeddings: vi.fn(() => Promise.resolve()),
  searchJournalSemantic: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: null,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    article: ({ children, initial, animate, exit, transition, variants, custom, layout, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void variants;
      void custom;
      void layout;
      return <article {...rest}>{children}</article>;
    },
    div: ({ children, initial, animate, exit, transition, variants, custom, layout, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void variants;
      void custom;
      void layout;
      return <div {...rest}>{children}</div>;
    },
    section: ({ children, initial, animate, exit, transition, variants, custom, layout, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void variants;
      void custom;
      void layout;
      return <section {...rest}>{children}</section>;
    },
  },
  useReducedMotion: () => false,
}));

const storageMocks = vi.hoisted(() => ({
  createJournalSpaceCapture: vi.fn(),
  getJournalSpaceCaptures: vi.fn(),
  getJournalSpaces: vi.fn(),
  getSpaceEntryLinks: vi.fn(),
  linkEntryToSpace: vi.fn(),
  saveJournalSpace: vi.fn(),
  unlinkEntryFromSpace: vi.fn(),
}));

vi.mock("../journalHubStorage", () => ({
  GRATITUDE_SPACE_ID: "space-gratitude",
  ...storageMocks,
}));

import { JournalEntryList } from "../JournalEntryList";

const gratitudeSpace: JournalSpace = {
  id: "space-gratitude",
  nameKey: "journalHubSpaceGratitude",
  descriptionKey: "journalHubSpaceGratitudeDesc",
  iconKey: "sprout",
  accent: "mint",
  private: false,
  kind: "system",
  autoSource: "gratitude",
  locked: true,
  sortOrder: 1,
  createdAt: 1,
  updatedAt: 1,
};

const linkedEntry: JournalEntry = {
  id: "entry-older",
  date: "2026-04-24",
  title: "Older gratitude note",
  content: "Linked from another day",
  stickers: [],
  photoIds: [],
  tags: [],
  createdAt: 10,
  updatedAt: 10,
};

const gratitudeCapture: JournalSpaceCapture = {
  id: "capture-gratitude",
  spaceId: "space-gratitude",
  spaceName: "Мої вдячності",
  mode: "gratitude",
  title: "gratitude",
  fields: [{ prompt: "gratitude", value: "Тиха ранкова прогулянка" }],
  date: "2026-04-29",
  sourceType: "gratitude",
  sourceId: "gratitude-1",
  createdAt: 20,
  updatedAt: 20,
};

describe("JournalEntryList spaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.getJournalSpaces.mockResolvedValue([gratitudeSpace]);
    storageMocks.getJournalSpaceCaptures.mockResolvedValue([gratitudeCapture]);
    storageMocks.getSpaceEntryLinks.mockResolvedValue([
      {
        id: "link-1",
        entryId: linkedEntry.id,
        targetType: "space",
        targetId: gratitudeSpace.id,
        createdAt: 30,
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens a highlight space with captures and linked entries outside the selected day", async () => {
    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[linkedEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={1}
        selectedDate="2026-05-01"
        selectedDateOnly
      />,
    );

    const gratitudeRailItem = await screen.findByTestId("journal-space-rail-item-space-gratitude");
    expect(gratitudeRailItem).toHaveAttribute("data-visual-role", "gratitude");

    fireEvent.click(gratitudeRailItem);

    await waitFor(() => {
      expect(screen.getByTestId("journal-space-mode-title")).toHaveTextContent("Мої вдячності");
    });

    expect(await screen.findByTestId("journal-space-capture-card-capture-gratitude")).toHaveTextContent(
      "Тиха ранкова прогулянка",
    );
    expect(await screen.findByTestId("journal-entry-card-entry-older")).toHaveTextContent("Older gratitude note");
    expect(screen.queryByText("Цей простір порожній")).not.toBeInTheDocument();
  });

  it("keeps compact chrome empty state off the spaces startup path", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const onNewEntry = vi.fn();
    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={onNewEntry}
        totalCount={0}
        compact
        showFab={false}
        showSpaces={false}
      />,
    );

    expect(screen.getByTestId("journal-compact-empty-list")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-capture-launcher")).not.toBeInTheDocument();
    expect(screen.getByTestId("journal-compact-empty-list")).toHaveTextContent(
      "Наповніть сторінку диханням свого серця.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Write first entry" }));

    expect(onNewEntry).toHaveBeenCalledTimes(1);

    await Promise.resolve();

    expect(storageMocks.getJournalSpaces).not.toHaveBeenCalled();
    expect(storageMocks.getJournalSpaceCaptures).not.toHaveBeenCalled();
    expect(storageMocks.getSpaceEntryLinks).not.toHaveBeenCalled();
  });
});
