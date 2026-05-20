import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry, JournalSpace, JournalSpaceCapture } from "../types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    isRTL: false,
    t: {
      back: "Back",
      close: "Close",
      delete: "Delete",
      done: "Done",
      journalCaptureOpenEditor: "Open as entry",
      journalEntries: "entries",
      journalEntryCountOther: "{count} entries",
      journalEntryCountOne: "{count} entry",
      journalFolderCreate: "Create",
      journalFolders: "Folders",
      journalHubSpaces: "Spaces",
      journalNoMatchingEntries: "No matches",
      journalNoMatchingHint: "Try another search",
      journalSearch: "Search entries...",
      journalSpaceAddEntry: "Add entry",
      journalSpaceAddToSpace: "Add to space",
      journalSpaceEmpty: "This space is empty",
      journalSpaceLatestActivity: "Latest activity",
      open: "Open",
      quoteJournal1: "Quote",
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
    button: ({ children, initial, animate, exit, transition, variants, custom, layout, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void variants;
      void custom;
      void layout;
      return <button {...rest}>{children}</button>;
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

const projectSpace: JournalSpace = {
  id: "space-projects",
  name: "Projects",
  description: "Long-running project space",
  iconKey: "briefcase",
  accent: "sky",
  private: false,
  kind: "user",
  sortOrder: 2,
  createdAt: 2,
  updatedAt: 2,
};

const currentDayEntry: JournalEntry = {
  id: "entry-current",
  date: "2026-05-01",
  title: "Current day project note",
  content: "Visible in selected day and project space",
  stickers: [],
  photoIds: [],
  tags: [],
  createdAt: 12,
  updatedAt: 12,
};

const olderEntry: JournalEntry = {
  id: "entry-older",
  date: "2026-04-24",
  title: "Older project note",
  content: "Linked from another day",
  stickers: [],
  photoIds: [],
  tags: [],
  createdAt: 10,
  updatedAt: 10,
};

const projectCaptureA: JournalSpaceCapture = {
  id: "capture-project-a",
  spaceId: "space-projects",
  spaceName: "Projects",
  mode: "project",
  title: "Project note",
  fields: [{ prompt: "Next", value: "First project trace" }],
  date: "2026-04-28",
  createdAt: 21,
  updatedAt: 21,
};

const projectCaptureB: JournalSpaceCapture = {
  ...projectCaptureA,
  id: "capture-project-b",
  fields: [{ prompt: "Next", value: "Second project trace" }],
  sourceId: "project-b",
  createdAt: 22,
  updatedAt: 22,
};

describe("JournalEntryList space parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    storageMocks.getJournalSpaces.mockResolvedValue([projectSpace]);
    storageMocks.getJournalSpaceCaptures.mockResolvedValue([]);
    storageMocks.getSpaceEntryLinks.mockResolvedValue([]);
  });

  it("keeps folder rail count and opened workspace count in parity", async () => {
    storageMocks.getJournalSpaceCaptures.mockResolvedValue([projectCaptureA, projectCaptureB]);
    storageMocks.getSpaceEntryLinks.mockResolvedValue([
      {
        id: "link-project-current",
        entryId: currentDayEntry.id,
        targetType: "space",
        targetId: projectSpace.id,
        createdAt: 40,
      },
    ]);

    render(
      <JournalEntryList
        groupedEntries={[{ label: "today", key: "2026-05-01", entries: [currentDayEntry] }]}
        allEntries={[currentDayEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={1}
        selectedDate="2026-05-01"
        selectedDateOnly
      />,
    );

    const projectRailCount = await screen.findByTestId(
      "journal-space-rail-count-space-projects",
      undefined,
      { timeout: 3_000 },
    );
    expect(projectRailCount).toHaveTextContent("3");
    expect(screen.getByTestId("journal-space-rail-item-space-projects")).toHaveAttribute(
      "data-visual-role",
      "focus",
    );

    fireEvent.click(screen.getByTestId("journal-space-rail-item-space-projects"));

    await waitFor(() => {
      expect(screen.getByTestId("journal-space-mode-count")).toHaveTextContent("3");
    });

    expect(screen.getByTestId("journal-space-capture-card-capture-project-a")).toBeInTheDocument();
    expect(screen.getByTestId("journal-space-capture-card-capture-project-b")).toBeInTheDocument();
    expect(screen.getByTestId("journal-entry-card-entry-current")).toBeInTheDocument();
  });

  it("opens entry actions for a space entry that is outside the selected day", async () => {
    storageMocks.getSpaceEntryLinks.mockResolvedValue([
      {
        id: "link-project-older",
        entryId: olderEntry.id,
        targetType: "space",
        targetId: projectSpace.id,
        createdAt: 41,
      },
    ]);

    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[olderEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={1}
        selectedDate="2026-05-01"
        selectedDateOnly
      />,
    );

    fireEvent.click(await screen.findByTestId("journal-space-rail-item-space-projects"));
    fireEvent.click(await screen.findByTestId("journal-entry-actions-entry-older"));

    expect(await screen.findByTestId("journal-entry-actions-sheet")).toBeInTheDocument();
  });
});
