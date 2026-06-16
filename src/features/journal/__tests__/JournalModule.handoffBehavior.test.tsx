import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalEntryPrefill, JournalEntrySuggestion } from "../types";

const storageMocks = vi.hoisted(() => ({
  getAllEntries: vi.fn(),
  saveEntry: vi.fn(),
  getEntryCount: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  compressAndStorePhoto: vi.fn(),
  deletePhoto: vi.fn(),
  getPhotosForEntry: vi.fn(),
  storeAudio: vi.fn(),
  deleteAudio: vi.fn(),
  getAudioForEntry: vi.fn(),
}));

const journalHubMocks = vi.hoisted(() => ({
  createGratitudeSpaceCapture: vi.fn(),
  createQuietReleaseSession: vi.fn(),
  getQuietReleaseTraceSummaries: vi.fn(),
  linkEntryToSpace: vi.fn(),
}));

const gamificationMocks = vi.hoisted(() => ({
  rewardUser: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    isRTL: false,
    t: {
      close: "Close",
      diary: "Diary",
      journalContinueWriting: "Continue writing",
      journalEmpty: "Your diary is empty",
      journalEmptyHint: "Start writing to capture your thoughts, feelings, and memories.",
      journalNewEntry: "New entry",
      journalReminderNotifBody: "Take a moment to capture your thoughts and feelings.",
      journalReminderNotifTitle: "Time to Write",
      journalStartToday: "Start today's entry",
      loading: "Loading...",
      moodGood: "Good",
      navV2Diary: "Diary",
      orbScopeNow: "In this moment",
      orbSkip: "Later",
      settings: "Settings",
    },
  }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: vi.fn(),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/hooks/useModalA11y", () => ({
  useModalA11y: vi.fn(),
}));

vi.mock("@/hooks/useSidebarKeyboard", () => ({
  useSidebarKeyboard: vi.fn(),
}));

vi.mock("@/hooks/useSidebarState", () => ({
  useSidebarState: () => ({
    sidebarState: "expanded",
    setSidebarState: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleSidebarCollapsed: vi.fn(() => "collapsed"),
    isExpanded: true,
    isCollapsed: false,
  }),
}));

vi.mock("@/hooks/useEntryTransition", () => ({
  useEntryTransition: () => ({
    cancelTransition: vi.fn(),
    startTransition: vi.fn(),
  }),
}));

vi.mock("@/lib/androidBackHandler", () => ({
  registerModalCloseCallback: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/a11y", () => ({
  announceError: vi.fn(),
  announceSuccess: vi.fn(),
  createFocusTrap: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => false,
  zenMotion: {
    gentle: { duration: 0 },
    snappy: { duration: 0 },
  },
}));

vi.mock("@/lib/haptics", () => ({
  haptics: {
    journalSaved: vi.fn(),
    light: vi.fn(),
  },
  hapticSuccess: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/safeJson", () => ({
  safeJsonParse: vi.fn((_raw: string, fallback: unknown) => fallback),
  storageGetRaw: vi.fn((_key: string, fallback?: string) => fallback ?? null),
  storageRemove: vi.fn(),
  storageSetRaw: vi.fn(),
}));

vi.mock("@/lib/scheduleIdle", () => ({
  scheduleIdle: vi.fn(() => ({ cancel: vi.fn() })),
}));

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: vi.fn(),
}));

vi.mock("@/storage/db", () => ({
  settingsRepo: {
    get: vi.fn(() => Promise.resolve(undefined)),
  },
}));

vi.mock("@/stores", () => ({
  useGamificationStore: (selector: (state: { rewardUser: typeof gamificationMocks.rewardUser }) => unknown) =>
    selector({ rewardUser: gamificationMocks.rewardUser }),
  useUserDataStore: (selector: (state: { moods: unknown[] }) => unknown) => selector({ moods: [] }),
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (state: { appliedTheme: "paper" }) => unknown) =>
    selector({ appliedTheme: "paper" }),
}));

vi.mock("../journalStorage", () => ({
  compressAndStorePhoto: storageMocks.compressAndStorePhoto,
  deleteAudio: storageMocks.deleteAudio,
  deleteEntry: storageMocks.deleteEntry,
  deletePhoto: storageMocks.deletePhoto,
  getAllEntries: storageMocks.getAllEntries,
  getAudioForEntry: storageMocks.getAudioForEntry,
  getEntryCount: storageMocks.getEntryCount,
  getPhotosForEntry: storageMocks.getPhotosForEntry,
  saveEntry: storageMocks.saveEntry,
  storeAudio: storageMocks.storeAudio,
  updateEntry: storageMocks.updateEntry,
}));

vi.mock("../journalHubStorage", () => ({
  createGratitudeSpaceCapture: journalHubMocks.createGratitudeSpaceCapture,
  createQuietReleaseSession: journalHubMocks.createQuietReleaseSession,
  getQuietReleaseTraceSummaries: journalHubMocks.getQuietReleaseTraceSummaries,
  linkEntryToSpace: journalHubMocks.linkEntryToSpace,
}));

vi.mock("../JournalOnboardingHints", () => ({
  JournalOnboardingHints: () => null,
  useJournalOnboarding: () => ({
    currentHint: null,
    dismissHint: vi.fn(),
  }),
}));

vi.mock("../JournalEntryEditor", () => ({
  JournalEntryEditor: ({ entryPrefill }: { entryPrefill: JournalEntryPrefill | null }) => (
    <section data-testid="journal-entry-editor">
      <h2>{entryPrefill?.title}</h2>
      <p>{entryPrefill?.content}</p>
    </section>
  ),
}));

vi.mock("../DiaryMiniOrb", () => ({
  DiaryMiniOrb: () => <span data-testid="diary-mini-orb" />,
}));

vi.mock("../StreakFreeze", () => ({
  StreakFreezeIndicator: () => null,
  useStreakFreeze: () => ({ streak: 0, frozen: false }),
}));

vi.mock("../useJournalReminder", () => ({
  getDaysSinceLastEntry: () => null,
  useJournalReminder: () => ({
    enabled: false,
    hour: 20,
    minute: 0,
    setEnabled: vi.fn(),
    setTime: vi.fn(),
  }),
}));

vi.mock("../useJournalSecurity", () => ({
  useJournalSecurity: () => ({
    biometricAvailable: false,
    biometricEnabled: false,
    cooldownRemaining: 0,
    failedAttempts: 0,
    hasPassword: false,
    isLocked: false,
    loading: false,
    lock: vi.fn(),
    removePassword: vi.fn(),
    setPassword: vi.fn(),
    touch: vi.fn(),
    unlock: vi.fn(),
    unlockWithBiometric: vi.fn(),
  }),
}));

vi.mock("../useScreenSecurity", () => ({
  useScreenSecurity: () => ({
    enabled: false,
    setEnabled: vi.fn(),
  }),
}));

type MotionMockProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  children?: React.ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  layout?: unknown;
  layoutId?: unknown;
};

function omitMotionProps<T extends HTMLElement>({
  initial,
  animate,
  exit,
  transition,
  whileHover,
  whileTap,
  layout,
  layoutId,
  ...rest
}: MotionMockProps<T>): React.HTMLAttributes<T> {
  void initial;
  void animate;
  void exit;
  void transition;
  void whileHover;
  void whileTap;
  void layout;
  void layoutId;
  return rest;
}

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    article: (props: MotionMockProps<HTMLElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <article {...rest}>{children}</article>;
    },
    button: (props: MotionMockProps<HTMLButtonElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <button {...rest}>{children}</button>;
    },
    div: (props: MotionMockProps<HTMLDivElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <div {...rest}>{children}</div>;
    },
    section: (props: MotionMockProps<HTMLElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <section {...rest}>{children}</section>;
    },
  },
  useReducedMotion: () => false,
}));

import { JournalModule } from "../JournalModule";

const initialSuggestion: JournalEntrySuggestion = {
  source: "orb",
  mood: "good",
  emotion: "hopeful",
  scope: "now",
  note: "A steady moment worth keeping.",
  committedAt: 1_781_321_000_000,
  contextLabel: "Fri, Jun 12",
  prefill: {
    title: "Hopeful",
    content: "A steady moment worth keeping.",
    mood: "good",
    tags: ["hopeful"],
    date: "2026-06-12",
  },
};

describe("JournalModule orb handoff behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.getAllEntries.mockResolvedValue([]);
    storageMocks.getEntryCount.mockResolvedValue(0);
    storageMocks.saveEntry.mockResolvedValue({
      id: "entry-1",
      date: "2026-06-12",
      title: "Hopeful",
      content: "A steady moment worth keeping.",
      stickers: [],
      photoIds: [],
      tags: ["hopeful"],
      createdAt: 1,
      updatedAt: 1,
    });
  });

  it("renders the orb suggestion without saving, then opens the editor with prefill on user action", async () => {
    const onConsumed = vi.fn();

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
        initialEntrySuggestion={initialSuggestion}
        onInitialEntrySuggestionConsumed={onConsumed}
      />,
    );

    expect(await screen.findByTestId("diary-entry-suggestion")).toHaveTextContent(
      "A steady moment worth keeping.",
    );
    expect(screen.getByTestId("diary-entry-suggestion")).toHaveTextContent("Continue writing");
    expect(screen.queryByTestId("journal-entry-editor")).not.toBeInTheDocument();
    expect(storageMocks.saveEntry).not.toHaveBeenCalled();
    expect(onConsumed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /continue writing/i }));

    expect(onConsumed).toHaveBeenCalledTimes(1);
    expect(storageMocks.saveEntry).not.toHaveBeenCalled();
    expect(await screen.findByTestId("journal-entry-editor")).toHaveTextContent("Hopeful");
    expect(screen.getByTestId("journal-entry-editor")).toHaveTextContent(
      "A steady moment worth keeping.",
    );

    await waitFor(() => {
      expect(screen.queryByTestId("diary-entry-suggestion")).not.toBeInTheDocument();
    });
  });

  it("clears an unconsumed orb suggestion when the parent clears the handoff", async () => {
    const onConsumed = vi.fn();

    const { rerender } = render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
        initialEntrySuggestion={initialSuggestion}
        onInitialEntrySuggestionConsumed={onConsumed}
      />,
    );

    expect(await screen.findByTestId("diary-entry-suggestion")).toHaveTextContent(
      "A steady moment worth keeping.",
    );

    rerender(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
        initialEntrySuggestion={null}
        onInitialEntrySuggestionConsumed={onConsumed}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("diary-entry-suggestion")).not.toBeInTheDocument();
    });
    expect(storageMocks.saveEntry).not.toHaveBeenCalled();
    expect(onConsumed).not.toHaveBeenCalled();
  });
});
