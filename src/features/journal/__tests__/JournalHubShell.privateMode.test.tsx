import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { formatDate } from "@/lib/utils";
import { JournalHubShell } from "../JournalHubShell";
import { getJournalSpaces } from "../journalHubStorage";
import type { JournalEntry } from "../types";

vi.mock("../journalHubStorage", () => ({
  DEFAULT_JOURNAL_HUB_PREFERENCES: {
    id: "default",
    homeView: "today",
    visibleViews: ["today", "entries", "spaces", "practices", "library"],
    dockActions: ["write", "quickNote", "gratitude", "resetThought", "template"],
    density: "balanced",
    motion: "quiet",
    background: "clean",
    updatedAt: 0,
  },
  createJournalPracticeSession: vi.fn().mockResolvedValue({}),
  getJournalHubPreferences: vi.fn().mockResolvedValue({
    id: "default",
    homeView: "today",
    visibleViews: ["today", "entries", "spaces", "practices", "library"],
    dockActions: ["write", "quickNote", "gratitude", "resetThought", "template"],
    density: "balanced",
    motion: "quiet",
    background: "clean",
    updatedAt: 0,
  }),
  getJournalSpaces: vi.fn().mockResolvedValue([
    {
      id: "space-therapy",
      name: "Therapy folder",
      descriptionKey: "journalHubSpaceSensitiveDesc",
      iconKey: "heart",
      accent: "rose",
      private: true,
      kind: "user",
      sortOrder: 1,
      createdAt: 0,
      updatedAt: 0,
    },
  ]),
  saveJournalHubPreferences: vi.fn().mockResolvedValue({
    id: "default",
    homeView: "today",
    visibleViews: ["today", "entries", "spaces", "practices", "library"],
    dockActions: ["write", "quickNote", "gratitude", "resetThought", "template"],
    density: "balanced",
    motion: "quiet",
    background: "clean",
    updatedAt: 1,
  }),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => false,
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { light: vi.fn() },
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, initial, animate, exit, transition, whileTap, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileTap;
      return <div {...rest}>{children}</div>;
    },
    button: ({ children, initial, animate, exit, transition, whileTap, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileTap;
      return <button {...rest}>{children}</button>;
    },
    span: ({ children, initial, animate, exit, transition, whileTap, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileTap;
      return <span {...rest}>{children}</span>;
    },
  },
  useReducedMotion: () => true,
}));

const ts: Record<string, string> = {
  journalHubEyebrow: "ZenFlow Hub",
  journalHubToday: "Today",
  journalHubTodayCard: "Your day",
  journalHubTodayCaptured: "Captured",
  journalHubTodayReady: "Ready",
  journalHubActionWrite: "Write",
  journalHubActionQuickNote: "Quick note",
  journalHubMetricEntries: "Entries",
  journalHubMetricToday: "Today",
  journalStatsTitle: "Stats",
  journalHubSpaces: "Spaces",
  journalHubSpacesDesc: "Spaces",
  journalHubSpacePrivate: "Private space",
  journalHubSpaceSensitiveDesc: "Sensitive notes",
  journalHubContinue: "Continue",
  journalTemplateBlank: "Blank Entry",
  journalPrivateEntry: "Private entry",
  journalPrivateEntryHint: "Unlock private mode to view this memory.",
  privateMode: "Private",
  journalHubCapture: "Capture",
  close: "Close",
};

const privateEntry: JournalEntry = {
  id: "entry-private-hub",
  date: formatDate(new Date()),
  title: "Therapy plan",
  content: "Sensitive appointment notes.",
  stickers: [],
  photoIds: [],
  audioIds: [],
  mood: "bad",
  tags: ["secret"],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const olderPrivateEntry: JournalEntry = {
  ...privateEntry,
  id: "entry-private-hub-older",
  date: "2026-06-18",
  title: "Medication note",
  content: "Another private entry.",
  createdAt: Date.now() - 86_400_000,
  updatedAt: Date.now() - 86_400_000,
};

describe("JournalHubShell private mode", () => {
  it("keeps the Today recent-entry card title private", async () => {
    const onOpenEntry = vi.fn();

    render(
      <JournalHubShell
        ts={ts}
        groupedEntries={[{ label: "Today", key: "today", entries: [privateEntry] }]}
        allEntries={[privateEntry]}
        totalCount={1}
        loading={false}
        privateMode
        onOpenEntry={onOpenEntry}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        onNewEntryWithPrefill={vi.fn()}
        onOpenStats={vi.fn()}
      />,
    );

    const recentButton = screen.getByRole("button", { name: /Continue/i });
    expect(recentButton).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Continue")).toBeInTheDocument();
    expect(screen.queryByText("Therapy plan")).not.toBeInTheDocument();
    expect(screen.getByText("Private entry")).toBeInTheDocument();

    fireEvent.click(recentButton);
    expect(onOpenEntry).not.toHaveBeenCalled();

    expect(await screen.findByText("Private space")).toBeInTheDocument();
    expect(screen.queryByText("Therapy folder")).not.toBeInTheDocument();
    expect(screen.queryByText("Sensitive notes")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Spaces/i }));

    expect(screen.getByTestId("journal-hub-spaces")).toBeInTheDocument();
    expect(screen.getAllByText("Private space").length).toBeGreaterThan(0);
    expect(screen.queryByText("Therapy folder")).not.toBeInTheDocument();
  });


  it("masks Today hub entry counts while private mode is active", () => {
    render(
      <JournalHubShell
        ts={ts}
        groupedEntries={[{ label: "Today", key: "today", entries: [privateEntry] }]}
        allEntries={[privateEntry, olderPrivateEntry]}
        totalCount={2}
        loading={false}
        privateMode
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        onNewEntryWithPrefill={vi.fn()}
        onOpenStats={vi.fn()}
      />,
    );

    const todayPanel = screen.getByTestId("journal-hub-today");
    const entriesMetric = within(todayPanel).getByText("Entries").closest("div");
    const todayMetric = within(todayPanel).getByText("Today").closest("div");

    expect(entriesMetric).toHaveTextContent("Private");
    expect(entriesMetric).not.toHaveTextContent("2");
    expect(todayMetric).toHaveTextContent("Private");
    expect(todayMetric).not.toHaveTextContent("1");
    expect(within(todayPanel).queryByText("Captured")).not.toBeInTheDocument();
  });

  it("collapses private space placeholders so space count stays hidden", async () => {
    vi.mocked(getJournalSpaces).mockResolvedValueOnce([
      {
        id: "space-therapy",
        name: "Therapy folder",
        descriptionKey: "journalHubSpaceSensitiveDesc",
        iconKey: "heart",
        accent: "rose",
        private: true,
        kind: "user",
        sortOrder: 1,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: "space-medical",
        name: "Medical notes",
        descriptionKey: "journalHubSpaceSensitiveDesc",
        iconKey: "target",
        accent: "sky",
        private: true,
        kind: "user",
        sortOrder: 2,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: "space-family",
        name: "Family conflict",
        descriptionKey: "journalHubSpaceSensitiveDesc",
        iconKey: "sparkles",
        accent: "amber",
        private: true,
        kind: "user",
        sortOrder: 3,
        createdAt: 0,
        updatedAt: 0,
      },
    ]);

    render(
      <JournalHubShell
        ts={ts}
        groupedEntries={[{ label: "Today", key: "today", entries: [privateEntry] }]}
        allEntries={[privateEntry, olderPrivateEntry]}
        totalCount={2}
        loading={false}
        privateMode
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        onNewEntryWithPrefill={vi.fn()}
        onOpenStats={vi.fn()}
      />,
    );

    const todayPanel = screen.getByTestId("journal-hub-today");
    await waitFor(() => {
      expect(within(todayPanel).getAllByText("Private space")).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /Spaces/i }));

    const spacesPanel = screen.getByTestId("journal-hub-spaces");
    await waitFor(() => {
      expect(within(spacesPanel).getAllByText("Private space")).toHaveLength(1);
    });

    expect(screen.queryByText("Therapy folder")).not.toBeInTheDocument();
    expect(screen.queryByText("Medical notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Family conflict")).not.toBeInTheDocument();
  });
});
