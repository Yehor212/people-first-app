import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "../types";
import type { SemanticSearchResult } from "@/lib/journalAI";

const journalAiMocks = vi.hoisted(() => ({
  generateAllMissingEmbeddings: vi.fn<() => Promise<number>>(() => Promise.resolve(0)),
  searchJournalSemantic: vi.fn<(query: string) => Promise<SemanticSearchResult[]>>(() => Promise.resolve([])),
}));

const journalAiConsentMocks = vi.hoisted(() => ({
  grant: vi.fn<() => Promise<{ status: "granted" }>>(() => Promise.resolve({ status: "granted" })),
  revoke: vi.fn<() => Promise<{ status: "completed" }>>(() => Promise.resolve({ status: "completed" })),
}));

vi.mock("@/lib/env", () => ({
  SUPABASE_ANON_KEY: undefined,
  SUPABASE_PUBLIC_API_KEY: ["test", "publishable", "key"].join("-"),
  SUPABASE_URL: "https://example.supabase.co",
}));

vi.mock("@/lib/journalAI", () => journalAiMocks);

vi.mock("../journalAiConsent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../journalAiConsent")>();
  return {
    ...actual,
    grantJournalAiConsent: journalAiConsentMocks.grant,
    revokeJournalAiConsent: journalAiConsentMocks.revoke,
  };
});

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { user: { id: "11111111-1111-4111-8111-111111111111" } } },
          error: null,
        }),
      ),
    },
    from: vi.fn(() => ({
      delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
  },
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: vi.fn(() =>
    Promise.resolve("11111111-1111-4111-8111-111111111111"),
  ),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    isRTL: false,
    t: {
      clear: "Clear search",
      cancel: "Cancel",
      journalAiConsentAccept: "Enable private search",
      journalAiPrivacyConfirm:
        "Private search runs only against journal entries in your ZenFlow account. No journal text or query is sent to an external AI provider.",
      journalAiSearchPrivacy: "Private search privacy",
      journalAiSearchOn: "Private search on",
      journalAiSearchPlaceholder: "Describe what you're looking for...",
      journalAiSwitchToAiSearch: "Switch to private search",
      journalAiSwitchToTextSearch: "Switch to text search",
      journalEntries: "entries",
      journalEntryCountOne: "{count} entry",
      journalEntryCountOther: "{count} entries",
      journalThisWeekCountOther: "{count} this week",
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
import { JOURNAL_AI_CONSENT_CHANGE_EVENT } from "../journalAiConsent";

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
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    journalAiConsentMocks.grant.mockResolvedValue({ status: "granted" });
    journalAiConsentMocks.revoke.mockResolvedValue({ status: "completed" });
  });

  it("recomputes the visible week when the owner-provided civil date advances", async () => {
    const julyEntry = { ...entry, id: "entry-july", date: "2026-07-31" };
    const augustEntry = { ...secondEntry, id: "entry-august", date: "2026-08-01" };
    const groupedEntries = [
      { key: julyEntry.date, label: julyEntry.date, entries: [julyEntry] },
      { key: augustEntry.date, label: augustEntry.date, entries: [augustEntry] },
    ];

    const { rerender } = render(
      <JournalEntryList
        today="2026-07-31"
        groupedEntries={groupedEntries}
        allEntries={[julyEntry, augustEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={2}
        showFab={false}
        showSpaces={false}
      />,
    );

    expect(await screen.findByText("1 this week")).toBeInTheDocument();

    rerender(
      <JournalEntryList
        today="2026-08-01"
        groupedEntries={groupedEntries}
        allEntries={[julyEntry, augustEntry]}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        totalCount={2}
        showFab={false}
        showSpaces={false}
      />,
    );

    expect(await screen.findByText("2 this week")).toBeInTheDocument();
  });

  it("reserves enough inline space for every visible search control", () => {
    const { rerender } = render(
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

    const search = screen.getByRole("textbox", { name: "Search entries..." });
    expect(search).toHaveClass("pe-14");
    fireEvent.change(search, { target: { value: "private" } });
    expect(search).toHaveClass("pe-24");

    rerender(
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

    expect(screen.getByRole("textbox", { name: "Search entries..." })).toHaveClass("pe-14");
  });

  it("does not build an embedding index and asks before account-backed private search", async () => {
    const confirm = vi.spyOn(window, "confirm");

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

    fireEvent.click(screen.getByRole("button", { name: "Switch to private search" }));

    const dialog = await screen.findByRole("dialog", { name: "Private search privacy" });
    expect(dialog).toHaveAccessibleDescription(
      "Private search runs only against journal entries in your ZenFlow account. No journal text or query is sent to an external AI provider.",
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(journalAiMocks.generateAllMissingEmbeddings).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Switch to private search" })).toBeInTheDocument();
  });

  it("enables private search without uploading entries to build an embedding index", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Switch to private search" }));
    fireEvent.click(await screen.findByRole("button", { name: "Enable private search" }));

    expect(await screen.findByRole("button", { name: "Switch to text search" })).toBeInTheDocument();
    expect(journalAiMocks.generateAllMissingEmbeddings).not.toHaveBeenCalled();
  });

  it("lets the user dismiss a pending consent write and ignores its late grant", async () => {
    let resolveGrant!: (value: { status: "granted" }) => void;
    journalAiConsentMocks.grant.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveGrant = resolve;
      }),
    );

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

    fireEvent.click(screen.getByRole("button", { name: "Switch to private search" }));
    fireEvent.click(await screen.findByRole("button", { name: "Enable private search" }));

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(screen.queryByRole("dialog", { name: "Private search privacy" })).not.toBeInTheDocument();
    expect(journalAiConsentMocks.revoke).toHaveBeenCalledOnce();

    await act(async () => resolveGrant({ status: "granted" }));

    expect(journalAiMocks.generateAllMissingEmbeddings).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Switch to private search" })).toBeInTheDocument();
  });

  it("returns a stalled consent write to an actionable state after a bounded timeout", async () => {
    journalAiConsentMocks.grant.mockReturnValueOnce(new Promise(() => undefined));

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

    fireEvent.click(screen.getByRole("button", { name: "Switch to private search" }));
    const enable = await screen.findByRole("button", { name: "Enable private search" });
    vi.useFakeTimers();
    fireEvent.click(enable);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    const dialog = screen.getByRole("dialog", { name: "Private search privacy" });
    expect(dialog).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();
    expect(journalAiConsentMocks.revoke).toHaveBeenCalledOnce();
  });

  it("leaves AI mode immediately when consent is revoked elsewhere in diary settings", async () => {
    localStorage.setItem("journal_ai_search_consent", "true");

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

    fireEvent.click(screen.getByRole("button", { name: "Switch to private search" }));
    expect(await screen.findByRole("button", { name: "Switch to text search" })).toBeInTheDocument();

    localStorage.removeItem("journal_ai_search_consent");
    window.dispatchEvent(new CustomEvent(JOURNAL_AI_CONSENT_CHANGE_EVENT));

    expect(await screen.findByRole("button", { name: "Switch to private search" })).toBeInTheDocument();
    expect(journalAiMocks.searchJournalSemantic).not.toHaveBeenCalled();
  });

  it("keeps account-backed private search unavailable while screen privacy mode is active", async () => {
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

    expect(screen.queryByRole("button", { name: "Switch to private search" })).not.toBeInTheDocument();

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
