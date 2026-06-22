import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      journalPrivateEntry: "Private entry",
      journalFolderCreate: "Create",
      journalFolders: "Folders",
      journalHubSpaces: "Spaces",
      journalHubSpacePrivate: "Private space",
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
  useInputMethod: () => ({ isMouse: true }),
}));

vi.mock("@/components/desktop/ContextMenu", () => ({
  ContextMenu: ({
    trigger,
    enabled,
    items = [],
  }: {
    trigger: React.ReactNode;
    enabled?: boolean;
    items?: Array<{ label: string }>;
  }) => (
    <div
      data-testid="journal-context-menu-probe"
      data-enabled={String(Boolean(enabled))}
      data-items={items.map((item) => item.label).join("|")}
    >
      {trigger}
    </div>
  ),
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

    fireEvent.click(await screen.findByTestId("journal-space-rail-item-space-projects", undefined, { timeout: 3_000 }));
    fireEvent.click(await screen.findByTestId("journal-entry-actions-entry-older"));

    expect(await screen.findByTestId("journal-entry-actions-sheet")).toBeInTheDocument();
  });

  it("hides space names in private mode rail and workspace shell", async () => {
    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={0}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
      />,
    );

    const railItem = await screen.findByTestId("journal-space-rail-item-space-projects", undefined, { timeout: 3_000 });
    expect(railItem).toHaveTextContent("Private space");
    expect(railItem).not.toHaveTextContent("Projects");
    expect(railItem).not.toHaveAttribute("aria-label", expect.stringContaining("Projects"));

    fireEvent.click(railItem);

    const workspace = await screen.findByTestId("journal-space-mode");
    expect(within(workspace).getByTestId("journal-space-mode-title")).toHaveTextContent("Private space");
    expect(workspace).not.toHaveTextContent("Projects");
    expect(workspace).not.toHaveTextContent("Long-running project space");
  });

  it("keeps private workspace add-entry prefill generic", async () => {
    const onNewEntryWithPrefill = vi.fn();

    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        onNewEntryWithPrefill={onNewEntryWithPrefill}
        totalCount={0}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
      />,
    );

    fireEvent.click(await screen.findByTestId("journal-space-rail-item-space-projects", undefined, { timeout: 3_000 }));
    fireEvent.click(await screen.findByTestId("journal-space-add-entry"));

    expect(onNewEntryWithPrefill).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Private entry",
        tags: [],
        spaceId: undefined,
      }),
    );
    expect(JSON.stringify(onNewEntryWithPrefill.mock.calls[0]?.[0] ?? {})).not.toContain("Projects");
    expect(JSON.stringify(onNewEntryWithPrefill.mock.calls[0]?.[0] ?? {})).not.toContain("space-projects");
  });

  it("hides auto-space experience metadata in private workspace", async () => {
    storageMocks.getJournalSpaces.mockResolvedValue([
      {
        id: "space-gratitude",
        name: "Gratitude vault",
        description: "Gratitude reflections",
        iconKey: "leaf",
        accent: "mint",
        private: true,
        kind: "system",
        autoSource: "gratitude",
        sortOrder: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={0}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
      />,
    );

    fireEvent.click(await screen.findByTestId("journal-space-rail-item-space-gratitude"));

    const workspace = await screen.findByTestId("journal-space-mode");
    expect(within(workspace).getByTestId("journal-space-mode-title")).toHaveTextContent("Private space");
    expect(workspace).toHaveTextContent("Private");
    expect(workspace).not.toHaveTextContent("Gratitude vault");
    expect(workspace).not.toHaveTextContent("Gratitude reflections");
  });

  it("uses generic private folder visuals in the rail", async () => {
    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={0}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
      />,
    );

    const railItem = await screen.findByTestId("journal-space-rail-item-space-projects", undefined, { timeout: 3_000 });

    expect(railItem).toHaveAttribute("data-visual-role", "space");
    expect(railItem.querySelector("[style]")).toBeNull();
  });

  it("collapses private folder rail placeholders so space count stays hidden", async () => {
    storageMocks.getJournalSpaces.mockResolvedValue([
      projectSpace,
      {
        ...projectSpace,
        id: "space-medical",
        name: "Medical notes",
        description: "Sensitive medical details",
        iconKey: "target",
        accent: "mint",
        sortOrder: 3,
        createdAt: 3,
        updatedAt: 3,
      },
      {
        ...projectSpace,
        id: "space-family",
        name: "Family conflict",
        description: "Sensitive family details",
        iconKey: "heart",
        accent: "amber",
        sortOrder: 4,
        createdAt: 4,
        updatedAt: 4,
      },
    ]);

    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={0}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
      />,
    );

    const rail = await screen.findByTestId("journal-space-rail-list");
    await waitFor(() => {
      expect(within(rail).getAllByRole("button", { name: "Private space" })).toHaveLength(1);
    });

    expect(rail).not.toHaveTextContent("Projects");
    expect(rail).not.toHaveTextContent("Medical notes");
    expect(rail).not.toHaveTextContent("Family conflict");
  });

  it("hides exact space and list counts while private mode is active", async () => {
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
        totalCount={3}
        selectedDate="2026-05-01"
        privateMode
      />,
    );

    const railItem = await screen.findByTestId("journal-space-rail-item-space-projects", undefined, { timeout: 3_000 });
    expect(screen.queryByTestId("journal-space-rail-count-space-projects")).not.toBeInTheDocument();
    expect(railItem).toHaveAttribute("aria-label", "Private space");
    expect(screen.queryByText("3 entries")).not.toBeInTheDocument();

    fireEvent.click(railItem);

    const workspace = await screen.findByTestId("journal-space-mode");
    expect(within(workspace).queryByTestId("journal-space-mode-count")).not.toBeInTheDocument();
    expect(within(workspace).queryByText("3 entries")).not.toBeInTheDocument();
  });

  it("does not expose exact hidden space item count through private workspace cards", async () => {
    storageMocks.getJournalSpaceCaptures.mockResolvedValue([projectCaptureA, projectCaptureB]);
    storageMocks.getSpaceEntryLinks.mockResolvedValue([
      {
        id: "link-project-current",
        entryId: currentDayEntry.id,
        targetType: "space",
        targetId: projectSpace.id,
        createdAt: 40,
      },
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
        groupedEntries={[{ label: "today", key: "2026-05-01", entries: [currentDayEntry] }]}
        allEntries={[currentDayEntry, olderEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={2}
        selectedDate="2026-05-01"
        privateMode
      />,
    );

    fireEvent.click(await screen.findByTestId("journal-space-rail-item-space-projects", undefined, { timeout: 3_000 }));

    const workspace = await screen.findByTestId("journal-space-mode");
    await waitFor(() => {
      expect(within(workspace).getByTestId("journal-space-capture-card-capture-project-a")).toBeInTheDocument();
      expect(within(workspace).getByTestId("journal-entry-card-entry-current")).toBeInTheDocument();
    });
    expect(within(workspace).queryByTestId("journal-space-capture-card-capture-project-b")).not.toBeInTheDocument();
    expect(within(workspace).queryByTestId("journal-entry-card-entry-older")).not.toBeInTheDocument();
  });

  it("hides quiet release trace metadata while private mode is active", () => {
    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={0}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
        releaseTraceSummaries={new Map([[
          "2026-05-01",
          { date: "2026-05-01", count: 2, latestAt: new Date("2026-05-01T20:15:00.000Z").getTime() },
        ]])}
      />,
    );

    expect(screen.queryByTestId("journal-quiet-release-trace")).not.toBeInTheDocument();
    expect(screen.queryByText(/thoughts released/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/20:15|8:15/i)).not.toBeInTheDocument();
  });

  it("hides space capture titles and field values while private mode is active", async () => {
    storageMocks.getJournalSpaceCaptures.mockResolvedValue([
      {
        ...projectCaptureA,
        title: "Sensitive capture title",
        fields: [{ prompt: "Private prompt", value: "Hidden capture detail" }],
      },
    ]);

    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={0}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
      />,
    );

    fireEvent.click(await screen.findByTestId("journal-space-rail-item-space-projects", undefined, { timeout: 3_000 }));

    const card = await screen.findByTestId("journal-space-capture-card-capture-project-a");
    expect(within(card).getAllByText("Private entry").length).toBeGreaterThan(0);
    expect(card).not.toHaveTextContent("Sensitive capture title");
    expect(card).not.toHaveTextContent("Private prompt");
    expect(card).not.toHaveTextContent("Hidden capture detail");
    expect(within(card).queryByRole("button", { name: "Open as entry" })).toBeNull();
  });

  it("does not match hidden space capture text while private mode is active", async () => {
    storageMocks.getJournalSpaceCaptures.mockResolvedValue([
      {
        ...projectCaptureA,
        title: "Sensitive searchable capture",
        fields: [{ prompt: "Private prompt", value: "Hidden searchable capture detail" }],
      },
    ]);

    render(
      <JournalEntryList
        groupedEntries={[]}
        allEntries={[]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={0}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
      />,
    );

    fireEvent.click(await screen.findByTestId("journal-space-rail-item-space-projects", undefined, { timeout: 3_000 }));
    expect(await screen.findByTestId("journal-space-capture-card-capture-project-a")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search entries..." }), {
      target: { value: "Hidden searchable capture detail" },
    });

    await waitFor(() => {
      expect(screen.queryByTestId("journal-space-capture-card-capture-project-a")).toBeNull();
    });
  });

  it("disables desktop context actions for private entry cards", async () => {
    render(
      <JournalEntryList
        groupedEntries={[{ label: "today", key: "2026-05-01", entries: [currentDayEntry] }]}
        allEntries={[currentDayEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={1}
        privateMode
      />,
    );

    const probes = await screen.findAllByTestId("journal-context-menu-probe");
    expect(probes.length).toBeGreaterThan(0);
    for (const probe of probes) {
      expect(probe).toHaveAttribute("data-enabled", "false");
      expect(probe).not.toHaveAttribute("data-items", expect.stringContaining("Delete"));
    }
  });

  it("hides linked space names inside the private actions sheet", async () => {
    const privateEntry: JournalEntry = {
      ...currentDayEntry,
      id: "entry-private-space-actions",
      title: "Sensitive folder route title",
      content: "Private details should stay out of routing metadata.",
    };
    storageMocks.getSpaceEntryLinks.mockResolvedValue([
      {
        id: "link-private-project",
        entryId: privateEntry.id,
        targetType: "space",
        targetId: projectSpace.id,
        createdAt: 44,
      },
    ]);

    render(
      <JournalEntryList
        groupedEntries={[{ label: "today", key: "2026-05-01", entries: [privateEntry] }]}
        allEntries={[privateEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={1}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
      />,
    );

    await screen.findByTestId("journal-space-rail-item-space-projects", undefined, { timeout: 3_000 });
    fireEvent.click(await screen.findByTestId("journal-entry-actions-entry-private-space-actions"));

    const sheet = await screen.findByTestId("journal-entry-actions-sheet");
    expect(within(sheet).getAllByText("Private entry").length).toBeGreaterThan(0);
    expect(sheet).not.toHaveTextContent("Projects");
    expect(sheet).not.toHaveTextContent("Sensitive folder route title");
    expect(sheet).not.toHaveTextContent("Private details should stay out of routing metadata.");
    expect(within(sheet).queryByRole("button", { name: "Open" })).toBeNull();
    expect(within(sheet).queryByTestId("journal-entry-actions-space-list")).toBeNull();
  });

  it("hides private entry titles inside the actions sheet", async () => {
    const privateEntry: JournalEntry = {
      ...currentDayEntry,
      id: "entry-private-actions",
      title: "Sensitive route title",
      content: "Private details should stay out of the actions sheet.",
      tags: ["secret"],
    };

    render(
      <JournalEntryList
        groupedEntries={[{ label: "today", key: "2026-05-01", entries: [privateEntry] }]}
        allEntries={[privateEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={1}
        selectedDate="2026-05-01"
        selectedDateOnly
        privateMode
      />,
    );

    fireEvent.click(await screen.findByTestId("journal-entry-actions-entry-private-actions"));

    const sheet = await screen.findByTestId("journal-entry-actions-sheet");
    expect(within(sheet).getAllByText("Private entry").length).toBeGreaterThan(0);
    expect(sheet).not.toHaveTextContent("Sensitive route title");
    expect(sheet).not.toHaveTextContent("Private details should stay out of the actions sheet.");
    expect(within(sheet).queryByRole("button", { name: "Open" })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
