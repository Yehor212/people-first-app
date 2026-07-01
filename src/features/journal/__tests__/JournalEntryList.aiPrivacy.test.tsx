import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "../types";
import type { SemanticSearchResult } from "@/lib/journalAI";

const journalAiMocks = vi.hoisted(() => ({
  generateAllMissingEmbeddings: vi.fn<() => Promise<number>>(() => Promise.resolve(0)),
  searchJournalSemantic: vi.fn<(query: string) => Promise<SemanticSearchResult[]>>(() => Promise.resolve([])),
}));

vi.mock("@/lib/env", () => ({
  SUPABASE_ANON_KEY: undefined,
  SUPABASE_PUBLIC_API_KEY: ["test", "publishable", "key"].join("-"),
  SUPABASE_URL: "https://example.supabase.co",
}));

vi.mock("@/lib/journalAI", () => journalAiMocks);

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: {} },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    isRTL: false,
    t: {
      clear: "Clear search",
      journalAiPrivacyConfirm:
        "AI search sends your diary search text and entry snippets to our AI provider.",
      journalAiSearchOn: "AI search on",
      journalAiSearchPlaceholder: "Describe what you're looking for...",
      journalAiSwitchToAiSearch: "Switch to AI search",
      journalAiSwitchToTextSearch: "Switch to text search",
      journalEntries: "entries",
      journalEntryCountOne: "{count} entry",
      journalEntryCountOther: "{count} entries",
      journalNoMatchingEntries: "No matches",
      journalNoMatchingHint: "Try another search",
      journalSearch: "Search entries...",
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
  JournalEntryCard: ({ entry, privateMode }: { entry: JournalEntry; privateMode?: boolean }) => (
    <article data-testid={`journal-entry-card-${entry.id}`}>
      <span>{privateMode ? "Private entry" : entry.title}</span>
    </article>
  ),
}));

vi.mock("../JournalCaptureLauncher", () => ({
  JournalCaptureLauncher: () => null,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
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

vi.mock("../journalHubStorage", () => ({
  GRATITUDE_SPACE_ID: "space-gratitude",
  createJournalSpaceCapture: vi.fn(),
  getJournalSpaceCaptures: vi.fn(() => Promise.resolve([])),
  getJournalSpaces: vi.fn(() => Promise.resolve([])),
  getSpaceEntryLinks: vi.fn(() => Promise.resolve([])),
  linkEntryToSpace: vi.fn(),
  saveJournalSpace: vi.fn(),
  unlinkEntryFromSpace: vi.fn(),
}));

import { JournalEntryList } from "../JournalEntryList";

const entry: JournalEntry = {
  id: "entry-private",
  date: "2026-06-17",
  title: "Private iOS note",
  content: "Very private diary content",
  stickers: [],
  photoIds: [],
  tags: [],
  createdAt: 1,
  updatedAt: 1,
};

const secondEntry: JournalEntry = {
  id: "entry-second",
  date: "2026-06-17",
  title: "Second private note",
  content: "Another hidden diary detail",
  stickers: [],
  photoIds: [],
  tags: [],
  createdAt: 2,
  updatedAt: 2,
};

describe("JournalEntryList AI privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("does not backfill AI embeddings until the user confirms the external privacy disclosure", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <JournalEntryList
        groupedEntries={[{ key: "2026-06-17", label: "Today", entries: [entry] }]}
        allEntries={[entry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={1}
        showFab={false}
        showSpaces={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch to AI search" }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(journalAiMocks.generateAllMissingEmbeddings).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Switch to AI search" })).toBeInTheDocument();
  });

  it("keeps external AI search unavailable while private mode is active", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    journalAiMocks.searchJournalSemantic.mockResolvedValue([
      { entry_id: entry.id, similarity: 0.96 },
    ]);

    render(
      <JournalEntryList
        groupedEntries={[{ key: "2026-06-17", label: "Today", entries: [entry] }]}
        allEntries={[entry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={1}
        showFab={false}
        showSpaces={false}
        privateMode
      />,
    );

    expect(screen.queryByRole("button", { name: "Switch to AI search" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search entries..." }), {
      target: { value: "Very private diary content" },
    });

    await waitFor(() => expect(screen.queryByTestId("journal-entry-card-entry-private")).not.toBeInTheDocument());
    expect(confirm).not.toHaveBeenCalled();
    expect(journalAiMocks.generateAllMissingEmbeddings).not.toHaveBeenCalled();
    expect(journalAiMocks.searchJournalSemantic).not.toHaveBeenCalled();
  });

  it("does not match hidden diary text while private mode is active", async () => {
    render(
      <JournalEntryList
        groupedEntries={[{ key: "2026-06-17", label: "Today", entries: [entry] }]}
        allEntries={[entry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={1}
        showFab={false}
        showSpaces={false}
        privateMode
      />,
    );

    expect(screen.getByTestId("journal-entry-card-entry-private")).toHaveTextContent("Private entry");

    fireEvent.change(screen.getByRole("textbox", { name: "Search entries..." }), {
      target: { value: "private diary content" },
    });

    await waitFor(() => expect(screen.queryByTestId("journal-entry-card-entry-private")).not.toBeInTheDocument());
    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.queryByText("Private iOS note")).not.toBeInTheDocument();
    expect(screen.queryByText("Very private diary content")).not.toBeInTheDocument();
  });

  it("does not expose exact hidden entry count through private entry cards", () => {
    render(
      <JournalEntryList
        groupedEntries={[{ key: "2026-06-17", label: "Today", entries: [entry, secondEntry] }]}
        allEntries={[entry, secondEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={2}
        showFab={false}
        showSpaces={false}
        privateMode
      />,
    );

    expect(screen.getByTestId("journal-entry-card-entry-private")).toHaveTextContent("Private entry");
    expect(screen.queryByTestId("journal-entry-card-entry-second")).not.toBeInTheDocument();
    expect(screen.getAllByText("Private entry")).toHaveLength(1);
    expect(screen.queryByText("2 entries")).not.toBeInTheDocument();
  });
});
