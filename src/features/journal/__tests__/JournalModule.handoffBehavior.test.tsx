import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const securityMocks = vi.hoisted(() => ({
  state: {
    biometricAvailable: false,
    biometricEnabled: false,
    cooldownRemaining: 0,
    failedAttempts: 0,
    hasPassword: false,
    isLocked: false,
    loading: false,
  },
  lock: vi.fn(),
  removePassword: vi.fn(),
  setPassword: vi.fn(),
  touch: vi.fn(),
  unlock: vi.fn(),
  unlockWithBiometric: vi.fn(),
}));

const mediaQueryMocks = vi.hoisted(() => ({
  matches: false,
}));

const safeJsonStore = vi.hoisted(() => ({
  values: new Map<string, string>(),
}));

const supabaseMocks = vi.hoisted(() => ({
  authStateCallback: null as
    | null
    | ((event: string, session?: { user?: { email?: string | null } | null } | null) => Promise<void> | void),
  getSession: vi.fn(),
  signInWithOtp: vi.fn(),
  unsubscribe: vi.fn(),
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
  useMediaQuery: () => mediaQueryMocks.matches,
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
  hapticTap: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/safeJson", () => ({
  safeJsonParse: vi.fn((_raw: string, fallback: unknown) => fallback),
  storageGetRaw: vi.fn((key: string, fallback?: string) => safeJsonStore.values.get(key) ?? fallback ?? null),
  storageRemove: vi.fn((key: string) => {
    safeJsonStore.values.delete(key);
  }),
  storageSetRaw: vi.fn((key: string, value: string) => {
    safeJsonStore.values.set(key, value);
  }),
}));

vi.mock("@/lib/scheduleIdle", () => ({
  scheduleIdle: vi.fn(() => ({ cancel: vi.fn() })),
}));

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      onAuthStateChange: vi.fn((callback) => {
        supabaseMocks.authStateCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: supabaseMocks.unsubscribe,
            },
          },
        };
      }),
      signInWithOtp: supabaseMocks.signInWithOtp,
    },
  },
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
  JournalEntryEditor: ({
    entryPrefill,
    onRequestSettings,
  }: {
    entryPrefill: JournalEntryPrefill | null;
    onRequestSettings?: () => void;
  }) => (
    <section data-testid="journal-entry-editor">
      <h2>{entryPrefill?.title}</h2>
      <p>{entryPrefill?.content}</p>
      {onRequestSettings ? (
        <button type="button" onClick={onRequestSettings}>
          Open diary settings
        </button>
      ) : null}
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
    ...securityMocks.state,
    lock: securityMocks.lock,
    removePassword: securityMocks.removePassword,
    setPassword: securityMocks.setPassword,
    touch: securityMocks.touch,
    unlock: securityMocks.unlock,
    unlockWithBiometric: securityMocks.unlockWithBiometric,
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
    aside: (props: MotionMockProps<HTMLElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <aside {...rest}>{children}</aside>;
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
    Object.assign(securityMocks.state, {
      biometricAvailable: false,
      biometricEnabled: false,
      cooldownRemaining: 0,
      failedAttempts: 0,
      hasPassword: false,
      isLocked: false,
      loading: false,
    });
    safeJsonStore.values.clear();
    mediaQueryMocks.matches = false;
    supabaseMocks.authStateCallback = null;
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { email: "owner@example.invalid" } } },
    });
    supabaseMocks.signInWithOtp.mockResolvedValue({ error: null });
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

  it("does not return to an open editor after private mode is enabled from diary settings", async () => {
    mediaQueryMocks.matches = true;

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
        initialEntrySuggestion={initialSuggestion}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /continue writing/i }));
    expect(await screen.findByTestId("journal-entry-editor")).toHaveTextContent(
      "A steady moment worth keeping.",
    );

    fireEvent.click(screen.getByRole("button", { name: /open diary settings/i }));

    const settingsPanel = await screen.findByTestId("journal-settings-panel");
    const privateModeSwitch = await within(settingsPanel).findByRole("switch", {
      name: /hide previews/i,
    });
    fireEvent.click(privateModeSwitch);
    fireEvent.click(within(settingsPanel).getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("journal-entry-editor")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("journal-page-shell")).toBeInTheDocument();
  });

  it("refreshes the diary auto-lock timer on pointer and keyboard interaction", async () => {
    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    const diaryControl = await screen.findByTestId("journal-mobile-stats");
    await waitFor(() => expect(securityMocks.touch).toHaveBeenCalled());
    securityMocks.touch.mockClear();

    fireEvent.pointerDown(diaryControl);
    fireEvent.keyDown(diaryControl, { key: "A" });

    expect(securityMocks.touch).toHaveBeenCalledTimes(2);
  });

  it("does not remove the diary password when another account signs in during reset", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /forgot password/i }));
    expect(await screen.findByText(/reset via email/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.signInWithOtp).toHaveBeenCalledWith({
        email: "owner@example.invalid",
        options: { shouldCreateUser: false },
      });
    });
    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { email: "other@example.invalid" },
      });
    });

    expect(securityMocks.removePassword).not.toHaveBeenCalled();
  });

  it("removes the diary password when the requested account signs in during reset", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /forgot password/i }));
    expect(await screen.findByText(/reset via email/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { email: "Owner@Example.Invalid" },
      });
    });

    expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/diary password removed/i)).toBeInTheDocument();
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
