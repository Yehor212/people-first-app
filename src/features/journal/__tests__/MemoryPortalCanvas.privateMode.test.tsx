import { fireEvent, render, screen, within } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryPortalCanvas } from "../MemoryPortalCanvas";
import type { MemoryPortalNode } from "../memoryPortal";
import type { JournalEntry } from "../types";

const buildMemoryPortalNodesMock = vi.hoisted(() => vi.fn<() => MemoryPortalNode[]>(() => []));

vi.mock("@/components/stats/ParticleBackground", () => ({
  ParticleBackground: () => <div data-testid="particle-background" />,
}));

vi.mock("@/components/state-of-mind/MiniValenceOrb", () => ({
  MiniValenceOrb: () => <span data-testid="mini-valence-orb" />,
}));

vi.mock("@/components/SplashScreen", () => ({
  SplashScreen: () => <div data-testid="splash-screen" />,
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/lib/haptics", () => ({
  hapticMedium: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => false,
}));

vi.mock("@/lib/safeJson", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/safeJson")>();
  return {
    ...actual,
    storageGetRaw: vi.fn(() => ""),
  };
});

vi.mock("../memoryPortal", () => ({
  MEMORY_PORTAL_ACTION_ICON_KEYS: {
    write: true,
    voice: true,
    photo: true,
    gratitude: true,
    burn: true,
    focus: true,
  },
  ZODIAC_CONSTELLATIONS: {},
  buildMemoryPortalNodes: buildMemoryPortalNodesMock,
  getEntriesForPortalDate: vi.fn((entries: JournalEntry[], date: string) =>
    entries.filter((entry) => entry.date === date),
  ),
  getMemoryPortalMoodSignal: vi.fn(() => ({ valence: 0, hasMoodSignal: false })),
  getZodiacSignForBirthDate: vi.fn(() => null),
  loadMemoryPortalPreferences: vi.fn(() => ({
    actionOrder: ["write", "voice", "photo", "gratitude", "burn", "focus"],
    constellationVisible: false,
    motionIntensity: "quiet",
  })),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
  motion: {
    button: ({ children, initial, animate, exit, transition, whileTap, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
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
    section: ({ children, initial, animate, exit, transition, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <section {...rest}>{children}</section>;
    },
    span: ({ children, initial, animate, exit, transition, ...rest }: any) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <span {...rest}>{children}</span>;
    },
  },
}));

const ts: Record<string, string> = {
  close: "Close",
  focus: "Focus",
  journalAdd: "Add",
  journalDayCapsule: "Day capsule",
  journalEntries: "Entries",
  journalHubSpacePrivate: "Private",
  journalMemoryPortalTitle: "Memory portal",
  journalNewEntry: "Write",
  journalPhotoAdd: "Media",
};

const entry: JournalEntry = {
  id: "entry-memory-private",
  date: "2026-06-21",
  title: "Therapy plan",
  content: "Sensitive appointment notes.",
  stickers: [],
  photoIds: [],
  audioIds: [],
  mood: "bad",
  tags: ["secret"],
  createdAt: Date.UTC(2026, 5, 21, 12, 30),
  updatedAt: Date.UTC(2026, 5, 21, 12, 30),
};

describe("MemoryPortalCanvas private mode", () => {
  beforeEach(() => {
    buildMemoryPortalNodesMock.mockReturnValue([]);
  });

  it("masks day capsule media and focus metadata while private mode is active", () => {
    const privateEntryWithMetadata: JournalEntry = {
      ...entry,
      photoIds: ["photo-private"],
      audioIds: ["audio-private"],
      tags: ["portal-focus", "therapy"],
    };

    render(
      <MemoryPortalCanvas
        ts={ts}
        entries={[privateEntryWithMetadata]}
        groupedEntries={[{ label: "Day", key: "day", entries: [privateEntryWithMetadata] }]}
        listTotalCount={1}
        selectedDate={privateEntryWithMetadata.date}
        onSelectDate={vi.fn()}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        onNewEntryWithPrefill={vi.fn()}
        privateMode
        showList={false}
        showDayCapsuleButton
      />,
    );

    fireEvent.click(screen.getByTestId("memory-portal-day-capsule-button"));

    const mediaMetric = screen.getByText("Media").closest("div");
    const focusMetric = screen.getByText("Focus").closest("div");
    expect(mediaMetric).toHaveTextContent("Private");
    expect(mediaMetric).not.toHaveTextContent("1");
    expect(focusMetric).toHaveTextContent("Private");
    expect(focusMetric).not.toHaveTextContent("1");
  });

  it("masks day capsule entry count metadata while private mode is active", () => {
    const secondEntry: JournalEntry = {
      ...entry,
      id: "entry-memory-private-second",
      title: "Medication note",
      content: "Another sensitive note.",
      createdAt: Date.UTC(2026, 5, 21, 14, 0),
      updatedAt: Date.UTC(2026, 5, 21, 14, 0),
    };

    render(
      <MemoryPortalCanvas
        ts={ts}
        entries={[entry, secondEntry]}
        groupedEntries={[{ label: "Day", key: "day", entries: [entry, secondEntry] }]}
        listTotalCount={2}
        selectedDate={entry.date}
        onSelectDate={vi.fn()}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        onNewEntryWithPrefill={vi.fn()}
        privateMode
        showList={false}
        showDayCapsuleButton
      />,
    );

    fireEvent.click(screen.getByTestId("memory-portal-day-capsule-button"));

    const entriesMetric = screen.getByText("Entries").closest("div");
    expect(entriesMetric).toHaveTextContent("Private");
    expect(entriesMetric).not.toHaveTextContent("2");
    expect(screen.queryByText("Medication note")).not.toBeInTheDocument();
  });

  it("does not expose exact hidden entry count through private day capsule rows", () => {
    const secondEntry: JournalEntry = {
      ...entry,
      id: "entry-memory-private-second",
      title: "Medication note",
      content: "Another sensitive note.",
      createdAt: Date.UTC(2026, 5, 21, 14, 0),
      updatedAt: Date.UTC(2026, 5, 21, 14, 0),
    };

    render(
      <MemoryPortalCanvas
        ts={ts}
        entries={[entry, secondEntry]}
        groupedEntries={[{ label: "Day", key: "day", entries: [entry, secondEntry] }]}
        listTotalCount={2}
        selectedDate={entry.date}
        onSelectDate={vi.fn()}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        onNewEntryWithPrefill={vi.fn()}
        privateMode
        showList={false}
        showDayCapsuleButton
      />,
    );

    fireEvent.click(screen.getByTestId("memory-portal-day-capsule-button"));

    const capsuleRows = screen.getAllByTestId("memory-portal-capsule-entry");
    expect(capsuleRows).toHaveLength(1);
    expect(within(capsuleRows[0]).getByText("Private")).toBeInTheDocument();
    expect(screen.queryByText("Medication note")).not.toBeInTheDocument();
  });

  it("keeps day capsule private entries inert", () => {
    const onOpenEntry = vi.fn();

    render(
      <MemoryPortalCanvas
        ts={ts}
        entries={[entry]}
        groupedEntries={[{ label: "Day", key: "day", entries: [entry] }]}
        listTotalCount={1}
        selectedDate={entry.date}
        onSelectDate={vi.fn()}
        onOpenEntry={onOpenEntry}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        onNewEntryWithPrefill={vi.fn()}
        privateMode
        showList={false}
        showDayCapsuleButton
      />,
    );

    fireEvent.click(screen.getByTestId("memory-portal-day-capsule-button"));

    const capsuleEntry = screen.getByTestId("memory-portal-capsule-entry");
    expect(capsuleEntry).toHaveAttribute("aria-disabled", "true");
    expect(within(capsuleEntry).getByText("Private")).toBeInTheDocument();
    expect(screen.queryByText("Therapy plan")).not.toBeInTheDocument();

    fireEvent.click(capsuleEntry);

    expect(onOpenEntry).not.toHaveBeenCalled();
  });

  it("does not expose exact hidden entry count through private portal nodes", () => {
    const secondEntry: JournalEntry = {
      ...entry,
      id: "entry-memory-private-second",
      date: "2026-05-02",
      title: "Medication note",
      createdAt: Date.UTC(2026, 4, 2, 14, 0),
      updatedAt: Date.UTC(2026, 4, 2, 14, 0),
    };

    buildMemoryPortalNodesMock.mockReturnValue([
      {
        id: "memory-node-sensitive-a",
        entryId: entry.id,
        date: "2026-05-01",
        title: "Therapy plan",
        x: 22,
        y: 34,
        size: "lg",
        mood: "bad",
        hasMedia: true,
        hasAudio: false,
        wordCount: 240,
        createdAt: entry.createdAt,
        isSelectedDay: false,
      },
      {
        id: "memory-node-sensitive-b",
        entryId: secondEntry.id,
        date: secondEntry.date,
        title: "Medication note",
        x: 72,
        y: 64,
        size: "md",
        mood: "terrible",
        hasMedia: false,
        hasAudio: true,
        wordCount: 88,
        createdAt: secondEntry.createdAt,
        isSelectedDay: false,
      },
    ]);

    render(
      <MemoryPortalCanvas
        ts={ts}
        entries={[entry, secondEntry]}
        groupedEntries={[{ label: "Day", key: "day", entries: [entry, secondEntry] }]}
        listTotalCount={2}
        selectedDate="2026-06-21"
        onSelectDate={vi.fn()}
        onOpenEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onNewEntry={vi.fn()}
        onNewEntryWithPrefill={vi.fn()}
        privateMode
        showList={false}
      />,
    );

    const portalNodes = screen.getAllByTestId("memory-portal-node");
    expect(portalNodes).toHaveLength(1);
    expect(portalNodes[0]).toHaveAccessibleName(/Private/i);
    expect(portalNodes[0].getAttribute("aria-label")).not.toMatch(/Therapy|Medication|May/i);
  });
});
