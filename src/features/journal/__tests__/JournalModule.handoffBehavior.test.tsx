import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SK } from "@/lib/storageKeys";
import type { JournalEntryPrefill, JournalEntrySuggestion } from "../types";

const storageMocks = vi.hoisted(() => ({
  getAllEntries: vi.fn(),
  getEntriesPage: vi.fn(),
  getEntriesByDate: vi.fn(),
  saveEntry: vi.fn(),
  getEntryCount: vi.fn(),
  hasEncryptedJournalContent: vi.fn(),
  hasEncryptedJournalMedia: vi.fn(),
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

const hapticsMocks = vi.hoisted(() => ({
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
  journalSaved: vi.fn(),
  light: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
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

async function flushJournalModuleEffects() {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

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
      journalLockRemoveFailed: "Unlock your diary first, then try removing the lock again.",
      journalReminderNotifBody: "Take a moment to capture your thoughts and feelings.",
      journalReminderNotifTitle: "Time to Write",
      journalResetServiceUnavailable: "We could not check your account. Check your connection and try again.",
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

vi.mock("@/lib/authRedirect", () => ({
  AUTH_COMPLETE_EVENT: "zenflow-auth-complete",
  getAuthRedirectUrl: () => "com.zenflow.app://login-callback",
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
    journalSaved: hapticsMocks.journalSaved,
    light: hapticsMocks.light,
  },
  hapticSuccess: hapticsMocks.hapticSuccess,
  hapticTap: hapticsMocks.hapticTap,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerMocks.error,
    warn: loggerMocks.warn,
  },
}));

vi.mock("@/lib/safeJson", () => ({
  safeJsonParse: vi.fn((_raw: string, fallback: unknown) => fallback),
  safeLocalStorageGet: vi.fn((key: string, fallback: unknown) => {
    const raw = safeJsonStore.values.get(key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }),
  safeLocalStorageSet: vi.fn((key: string, value: unknown) => {
    safeJsonStore.values.set(key, JSON.stringify(value));
    return true;
  }),
  storageGetRaw: vi.fn((key: string, fallback?: string) => safeJsonStore.values.get(key) ?? fallback ?? null),
  storageRemove: vi.fn((key: string) => {
    safeJsonStore.values.delete(key);
  }),
  storageSetRaw: vi.fn((key: string, value: string) => {
    safeJsonStore.values.set(key, value);
    return true;
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
              unsubscribe: vi.fn(() => {
                supabaseMocks.unsubscribe();
                if (supabaseMocks.authStateCallback === callback) {
                  supabaseMocks.authStateCallback = null;
                }
              }),
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
  getEntriesByDate: storageMocks.getEntriesByDate,
  getEntriesPage: storageMocks.getEntriesPage,
  getEntryCount: storageMocks.getEntryCount,
  getPhotosForEntry: storageMocks.getPhotosForEntry,
  hasEncryptedJournalContent: storageMocks.hasEncryptedJournalContent,
  hasEncryptedJournalMedia: storageMocks.hasEncryptedJournalMedia,
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

vi.mock("../JournalEntryList", () => ({
  JournalEntryList: ({
    groupedEntries,
    onDeleteEntry,
  }: {
    groupedEntries: Array<{ entries: Array<{ id: string; title?: string; content?: string }> }>;
    onDeleteEntry: (id: string) => void;
  }) => (
    <section data-testid="journal-entry-list">
      {groupedEntries.flatMap((group) =>
        group.entries.map((entry) => (
          <article key={entry.id}>
            <h3>{entry.title}</h3>
            <p>{entry.content}</p>
            <button type="button" onClick={() => onDeleteEntry(entry.id)}>
              Delete {entry.title}
            </button>
          </article>
        )),
      )}
    </section>
  ),
}));

vi.mock("../DiaryMiniOrb", () => ({
  DiaryMiniOrb: () => <span data-testid="diary-mini-orb" />,
}));

vi.mock("../DiaryEmptyCanvas", () => ({
  DiaryEmptyCanvas: () => <div data-testid="diary-empty-canvas" />,
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
  LOCK_TIMEOUT_OPTIONS: [
    { label: "Immediately", ms: 0 },
    { label: "1 minute", ms: 60_000 },
    { label: "5 minutes", ms: 300_000 },
    { label: "15 minutes", ms: 900_000 },
    { label: "30 minutes", ms: 1_800_000 },
  ],
  setAutoLockMs: vi.fn(() => true),
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
    figure: (props: MotionMockProps<HTMLElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <figure {...rest}>{children}</figure>;
    },
    h2: (props: MotionMockProps<HTMLHeadingElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <h2 {...rest}>{children}</h2>;
    },
    p: (props: MotionMockProps<HTMLParagraphElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <p {...rest}>{children}</p>;
    },
    section: (props: MotionMockProps<HTMLElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <section {...rest}>{children}</section>;
    },
    span: (props: MotionMockProps<HTMLSpanElement>) => {
      const { children, ...rest } = omitMotionProps(props);
      return <span {...rest}>{children}</span>;
    },
  },
  useReducedMotion: () => false,
}));

import { JournalLoadErrorPanel, JournalModule } from "../JournalModule";

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
  afterEach(async () => {
    cleanup();
    vi.useRealTimers();
    await flushJournalModuleEffects();
    supabaseMocks.authStateCallback = null;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(storageMocks).forEach((mock) => mock.mockReset());
    Object.values(journalHubMocks).forEach((mock) => mock.mockReset());
    gamificationMocks.rewardUser.mockReset();
    hapticsMocks.hapticSuccess.mockReset();
    hapticsMocks.hapticTap.mockReset();
    hapticsMocks.journalSaved.mockReset();
    hapticsMocks.light.mockReset();
    loggerMocks.error.mockReset();
    loggerMocks.warn.mockReset();
    securityMocks.lock.mockReset();
    securityMocks.removePassword.mockReset();
    securityMocks.setPassword.mockReset();
    securityMocks.touch.mockReset();
    securityMocks.unlock.mockReset();
    securityMocks.unlockWithBiometric.mockReset();
    supabaseMocks.getSession.mockReset();
    supabaseMocks.signInWithOtp.mockReset();
    supabaseMocks.unsubscribe.mockReset();
    window.history.replaceState({}, "", "/people-first-app/");
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
    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [],
      totalCount: 0,
      hasMore: false,
      nextCursor: null,
    });
    storageMocks.getEntriesByDate.mockResolvedValue([]);
    storageMocks.getEntryCount.mockResolvedValue(0);
    storageMocks.hasEncryptedJournalContent.mockResolvedValue(false);
    storageMocks.hasEncryptedJournalMedia.mockResolvedValue(false);
    storageMocks.deleteEntry.mockResolvedValue(undefined);
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

  it("renders diary load failure as a calm recoverable state with retry", () => {
    const onRetry = vi.fn();

    render(
      <JournalLoadErrorPanel
        ts={{
          journalLoadFailed: "Diary needs another moment to load",
          journalLoadFailedHint: "This load attempt did not change your entries. Try loading again.",
          journalRetryLoad: "Retry loading",
        }}
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByTestId("journal-load-error");
    expect(alert).toHaveAttribute("role", "status");
    expect(alert).toHaveAttribute("aria-live", "polite");
    expect(alert).toHaveTextContent("Diary needs another moment to load");
    expect(alert).toHaveTextContent("This load attempt did not change your entries. Try loading again.");
    expect(alert).not.toHaveTextContent(/cleared|deleted/i);
    expect(alert.className).not.toContain("destructive");

    const retryButton = within(alert).getByRole("button", { name: /retry loading/i });
    expect(retryButton.className).toContain("min-h-[44px]");
    expect(retryButton.className).toContain("focus-visible:ring");
    expect(retryButton.className).toContain("touch-manipulation");

    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the orb suggestion without saving, then opens the editor with prefill on user action", async () => {
    mediaQueryMocks.matches = true;
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

  it("keeps recovery help visible when locked encrypted diary content cannot be decrypted", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    storageMocks.hasEncryptedJournalContent.mockResolvedValue(true);

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /can't open the lock/i }));

    await waitFor(() => {
      expect(storageMocks.hasEncryptedJournalContent).toHaveBeenCalled();
    });

    expect((await screen.findAllByText(/email verification cannot remove this lock/i)).length).toBeGreaterThan(0);
    expect(supabaseMocks.getSession).not.toHaveBeenCalled();
  });

  it("shows a service error instead of blaming sign-in when account lookup fails", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    supabaseMocks.getSession.mockRejectedValueOnce(
      Object.assign(new Error("temporary auth outage"), { code: "network_error", status: 503 }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not check your account/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/sign in to your account/i)).not.toBeInTheDocument();
  });

  it("offers a calm retry path when no signed-in account is available", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    supabaseMocks.getSession.mockResolvedValueOnce({ data: { session: null } });

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));

    expect((await screen.findAllByText(/sign in to your account/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /check again/i })).toBeInTheDocument();
  });

  it("offers a direct account settings action when email lock removal needs sign-in", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    supabaseMocks.getSession.mockResolvedValueOnce({ data: { session: null } });

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));

    const dialog = await screen.findByRole("dialog", { name: /can't open the lock/i });
    expect(dialog).toHaveTextContent(/entries remain protected/i);
    const settingsAction = within(dialog).getByRole("button", { name: /account settings/i });

    fireEvent.click(settingsAction);

    expect(window.location.pathname).toBe("/people-first-app/settings");
    expect(window.location.search).toContain("nav=v2");
    expect(window.location.search).toContain("settingsSection=account");
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
  });
  it("does not start reset-link cooldown when the email send fails", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    const sendError = Object.assign(new Error("network down"), {
      code: "otp_failed",
      email: "owner@example.invalid",
      status: 429,
    });
    supabaseMocks.signInWithOtp
      .mockResolvedValueOnce({ error: sendError })
      .mockResolvedValueOnce({ error: null });

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.signInWithOtp).toHaveBeenCalledTimes(1);
    });
    expect(loggerMocks.warn).toHaveBeenCalledWith("[Journal] Password reset link failed", {
      code: "otp_failed",
      name: "Error",
      status: 429,
    });
    expect(loggerMocks.warn.mock.calls.flat()).not.toContain(sendError);
    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to send link/i);
    expect(screen.queryByText(/please wait/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.signInWithOtp).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/waiting for verification/i)).toBeInTheDocument();
    expect(screen.getByText(/check spam or junk/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend link/i })).toBeDisabled();
  });

  it("logs thrown reset-link failures with sanitized auth debug info", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    const sendError = Object.assign(new Error("owner@example.invalid network down"), {
      code: "fetch_failed",
      email: "owner@example.invalid",
      status: 503,
    });
    supabaseMocks.signInWithOtp.mockRejectedValueOnce(sendError);

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(loggerMocks.warn).toHaveBeenCalledWith("[Journal] Password reset link failed", {
        code: "fetch_failed",
        name: "Error",
        status: 503,
      });
    });
    expect(loggerMocks.warn.mock.calls.flat()).not.toContain(sendError);
    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to send link/i);
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
  });

  it("does not request a reset link when secure nonce generation is unavailable", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", undefined);

    try {
      render(
        <JournalModule
          startOpen
          disableCardShell
          hideCloseButton
          presentation="page"
        />,
      );

      fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
      fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/failed to send link/i);
      expect(supabaseMocks.signInWithOtp).not.toHaveBeenCalled();
      expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
    } finally {
      vi.stubGlobal("crypto", originalCrypto);
    }
  });

  it("does not remove the diary lock when another account signs in during reset", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    expect(await screen.findByText(/remove lock by email/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.signInWithOtp).toHaveBeenCalledWith({
        email: "owner@example.invalid",
        options: {
          shouldCreateUser: false,
          emailRedirectTo: expect.stringMatching(
            /^com\.zenflow\.app:\/\/login-callback\?journalReset=[a-f0-9]{32}$/,
          ),
        },
      });
    });
    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    const pendingReset = JSON.parse(safeJsonStore.values.get(SK.JOURNAL_PASSWORD_RESET) || "{}");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: pendingReset.nonce, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { email: "other@example.invalid" },
      });
    });

    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/same account that requested it/i);
  });

  it("does not reopen the reset dialog after dismissal while account lookup is pending", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });

    let resolveSession!: (value: { data: { session: { user: { email: string } } } }) => void;
    supabaseMocks.getSession.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    const checkingDialog = await screen.findByRole("dialog", { name: /remove lock by email/i });
    expect(checkingDialog).toHaveAttribute("aria-busy", "true");
    expect(within(checkingDialog).getByRole("button", { name: /close/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await act(async () => {
      resolveSession({ data: { session: { user: { email: "owner@example.invalid" } } } });
    });

    await waitFor(() => {
      expect(screen.queryByText(/remove lock by email/i)).not.toBeInTheDocument();
    });
  });

  it("shows visible account-checking copy while preparing email lock removal", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    supabaseMocks.getSession.mockReturnValueOnce(new Promise(() => undefined));

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));

    const dialog = await screen.findByRole("dialog", { name: /remove lock by email/i });
    expect(dialog).toHaveTextContent(/checking your account/i);
    expect(dialog).toHaveTextContent(/keep this window open/i);
  });

  it("opens the remove-password confirmation from settings and confirms once", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: false,
    });

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByTestId("journal-mobile-settings"));
    fireEvent.click(await screen.findByRole("button", { name: /remove password lock/i }));

    const dialog = await screen.findByRole("dialog", { name: /remove password lock/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /remove password lock/i }));

    await waitFor(() => {
      expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /remove password lock/i })).not.toBeInTheDocument();
    });
  });

  it("opens password reset as a labelled dialog", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));

    const dialog = await screen.findByRole("dialog", { name: /remove lock by email/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/verification link/i);
  });

  it("does not complete a pending password reset after reload without magic-link redirect proof", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "reset-proof-1", startedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    expect(supabaseMocks.getSession).not.toHaveBeenCalled();
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(true);
    expect(screen.queryByRole("dialog", { name: /diary lock removed/i })).not.toBeInTheDocument();
  });

  it("does not complete a pending password reset from a bare journalReset URL without auth proof", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    window.history.replaceState({}, "", "/people-first-app/?journalReset=reset-proof-2");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "reset-proof-2", startedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(true);
    expect(screen.queryByRole("dialog", { name: /diary lock removed/i })).not.toBeInTheDocument();
  });

  it("completes a pending password reset after auth callback proof is stored", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    window.history.replaceState({}, "", "/people-first-app/?code=supabase-code&journalReset=reset-proof-2");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "reset-proof-2", startedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    expect(securityMocks.removePassword).not.toHaveBeenCalled();

    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "reset-proof-2", receivedAt: Date.now() }),
    );
    window.dispatchEvent(new CustomEvent("zenflow-auth-complete"));

    await waitFor(() => {
      expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
    });
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
    expect(screen.getByRole("dialog", { name: /diary lock removed/i })).toBeInTheDocument();
  });

  it("does not remove the diary lock when reset proof changes before it can be consumed", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "reset-proof-race", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "reset-proof-race", receivedAt: Date.now() }),
    );
    storageMocks.hasEncryptedJournalContent.mockImplementationOnce(async () => {
      safeJsonStore.values.set(
        SK.JOURNAL_PASSWORD_RESET_PROOF,
        JSON.stringify({ nonce: "reset-proof-race-stale", receivedAt: Date.now() }),
      );
      return false;
    });

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(securityMocks.removePassword).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        /same account that requested it|could not confirm the email link/i,
      );
    });
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(true);
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBe(false);
  });

  it("does not consume a verified reset for locked encrypted diary content", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    storageMocks.hasEncryptedJournalContent.mockResolvedValue(true);
    window.history.replaceState({}, "", "/people-first-app/?journalReset=encrypted-proof");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "encrypted-proof", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "encrypted-proof", receivedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryAllByText(/encrypted with your password/i).length > 0 ||
          typeof supabaseMocks.authStateCallback === "function",
      ).toBe(true);
    });

    if (screen.queryAllByText(/encrypted with your password/i).length === 0) {
      await act(async () => {
        await supabaseMocks.authStateCallback?.("SIGNED_IN", {
          user: { email: "owner@example.invalid" },
        });
      });
    }
    expect(await screen.findByRole(
      "dialog",
      { name: /can't open the lock/i },
      { timeout: 10_000 },
    )).toBeInTheDocument();
    expect(screen.getAllByText(/encrypted with your password/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/entries remain protected/i).length).toBeGreaterThan(0);
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
    expect(window.location.href).not.toContain("journalReset");
  });

  it("removes the journal reset nonce from the URL while preserving navigation state", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    window.history.replaceState(
      {},
      "",
      "/people-first-app/?nav=v2&journalReset=reset-proof-url&navLayout=phone#view=diary",
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "reset-proof-url", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "reset-proof-url", receivedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(window.location.href).not.toContain("journalReset");
    });
    expect(window.location.href).toContain("nav=v2");
    expect(window.location.href).toContain("navLayout=phone");
    expect(window.location.hash).toBe("#view=diary");
  });

  it("removes stale reset nonce from the URL when no pending reset exists", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    window.history.replaceState({}, "", "/people-first-app/?nav=v2&journalReset=stale-proof");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "stale-proof", receivedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(window.location.href).not.toContain("journalReset");
    });
    expect(window.location.href).toContain("nav=v2");
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBe(false);
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
  });

  it("completes a native cold-start password reset from stored auth proof", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "native-proof-1", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "native-proof-1", receivedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(
        securityMocks.removePassword.mock.calls.length > 0 ||
          typeof supabaseMocks.authStateCallback === "function",
      ).toBe(true);
    });
    if (securityMocks.removePassword.mock.calls.length === 0) {
      await act(async () => {
        await supabaseMocks.authStateCallback?.("SIGNED_IN", {
          user: { email: "owner@example.invalid" },
        });
      });
    }

    await waitFor(() => {
      expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
    });
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBe(false);
    expect(screen.getByRole("dialog", { name: /diary lock removed/i })).toBeInTheDocument();
  });

  it("ignores native cold-start reset when stored proof nonce does not match", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "native-proof-expected", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "native-proof-other", receivedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(true);
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBe(false);
  });

  it("ignores native cold-start reset when stored proof is malformed", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "native-proof-2", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(SK.JOURNAL_PASSWORD_RESET_PROOF, "not-json");

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(true);
  });

  it("clears expired pending password reset without removing the diary lock", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    window.history.replaceState({}, "", "/people-first-app/?nav=v2&journalReset=expired-proof");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({
        email: "owner@example.invalid",
        nonce: "expired-proof",
        startedAt: Date.now() - 601_000,
      }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "expired-proof", receivedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
    });
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBe(false);
    expect(window.location.href).toContain("nav=v2");
    expect(window.location.href).not.toContain("journalReset");
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/verification link expired/i);
  });

  it("does not remove the diary lock when matching sign-in has no reset proof", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    expect(await screen.findByText(/remove lock by email/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { email: "Owner@Example.Invalid" },
      });
    });

    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    const resetAlert = await screen.findByRole("alert");
    expect(resetAlert).toHaveTextContent(/nothing changed/i);
    expect(resetAlert).toHaveTextContent(/entries remain protected/i);
    expect(screen.queryByRole("dialog", { name: /diary lock removed/i })).not.toBeInTheDocument();
  });

  it("shows a same-device proof error when reset proof disappears before consumption", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    window.history.replaceState({}, "", "/people-first-app/?nav=v2&journalReset=missing-proof-copy");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", nonce: "missing-proof-copy", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "missing-proof-copy", receivedAt: Date.now() }),
    );
    supabaseMocks.getSession.mockImplementationOnce(async () => {
      safeJsonStore.values.set(
        SK.JOURNAL_PASSWORD_RESET_PROOF,
        JSON.stringify({ nonce: "missing-proof-copy-stale", receivedAt: Date.now() }),
      );
      return { data: { session: { user: { email: "owner@example.invalid" } } } };
    });

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This browser could not confirm the email link. Open the link on the same device or request a new one.",
      );
    });
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(true);
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBe(false);
    expect(window.location.href).not.toContain("journalReset");
  });

  it("removes the diary password when the requested account signs in with reset proof", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });

    const view = render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    expect(await screen.findByText(/remove lock by email/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    const pendingReset = JSON.parse(safeJsonStore.values.get(SK.JOURNAL_PASSWORD_RESET) || "{}");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: pendingReset.nonce, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { email: "Owner@Example.Invalid" },
      });
    });

    expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: /diary lock removed/i })).toBeInTheDocument();

    Object.assign(securityMocks.state, {
      hasPassword: false,
      isLocked: false,
    });
    view.rerender(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    expect(screen.getByRole("dialog", { name: /diary lock removed/i })).toBeInTheDocument();
  });

  it("keeps lock-removal success visible and offers a new diary password setup", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });

    const view = render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    const pendingReset = JSON.parse(safeJsonStore.values.get(SK.JOURNAL_PASSWORD_RESET) || "{}");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: pendingReset.nonce, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { email: "owner@example.invalid" },
      });
    });

    expect(screen.getByRole("dialog", { name: /diary lock removed/i })).toHaveTextContent(
      /open without a diary password/i,
    );
    const setPasswordButton = screen.getByRole("button", { name: /set new diary password/i });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_200));
    });
    expect(screen.getByRole("dialog", { name: /diary lock removed/i })).toBeInTheDocument();

    Object.assign(securityMocks.state, {
      hasPassword: false,
      isLocked: false,
    });
    fireEvent.click(setPasswordButton);
    view.rerender(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /diary lock removed/i })).not.toBeInTheDocument();
    });
    expect((await screen.findAllByText(/set diary password/i)).length).toBeGreaterThan(0);
  });

  it("removes the diary password when Supabase restores a reset session from INITIAL_SESSION", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    const pendingReset = JSON.parse(safeJsonStore.values.get(SK.JOURNAL_PASSWORD_RESET) || "{}");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: pendingReset.nonce, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("INITIAL_SESSION", {
        user: { email: "owner@example.invalid" },
      });
    });

    expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: /diary lock removed/i })).toBeInTheDocument();
  });

  it("shows reset-link resend cooldown as a disabled button state", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

    expect(await screen.findByText(/waiting for verification/i)).toBeInTheDocument();
    const resendButton = screen.getByRole("button", { name: /resend link/i });
    expect(resendButton).toBeDisabled();
    expect(screen.getByRole("status", { name: /please wait 60s/i })).toBeInTheDocument();
  });

  it("shows recovery feedback when verified reset cannot remove the diary lock", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    securityMocks.removePassword.mockRejectedValueOnce(new Error("cloud cleanup failed"));

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    const pendingReset = JSON.parse(safeJsonStore.values.get(SK.JOURNAL_PASSWORD_RESET) || "{}");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: pendingReset.nonce, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { email: "owner@example.invalid" },
      });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unlock your diary first, then try removing the lock again.",
    );
    expect(screen.getAllByText(/entries remain protected/i).length).toBeGreaterThan(0);
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
  });

  it("keeps a sent reset link valid after the waiting dialog is closed", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

    expect(await screen.findByText(/waiting for verification/i)).toBeInTheDocument();
    const pendingReset = JSON.parse(safeJsonStore.values.get(SK.JOURNAL_PASSWORD_RESET) || "{}");
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));

    await waitFor(() => {
      expect(screen.queryByText(/waiting for verification/i)).not.toBeInTheDocument();
    });
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(true);
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: pendingReset.nonce, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { email: "owner@example.invalid" },
      });
    });

    expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
  });

  it("completes a sent reset link when auth completes while the waiting dialog stays open", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

    expect(await screen.findByText(/waiting for verification/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
    });
    const pendingReset = JSON.parse(safeJsonStore.values.get(SK.JOURNAL_PASSWORD_RESET) || "{}");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: pendingReset.nonce, receivedAt: Date.now() }),
    );

    window.dispatchEvent(new CustomEvent("zenflow-auth-complete"));

    await waitFor(() => {
      expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
    });
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
    expect(screen.getByRole("dialog", { name: /diary lock removed/i })).toBeInTheDocument();
  });

  it("restores a soft-deleted entry when the committed delete fails", async () => {
    mediaQueryMocks.matches = true;
    const retainedEntry = {
      id: "entry-retained",
      date: "2026-06-12",
      title: "Retained entry",
      content: "Keep this line visible if storage cannot delete it.",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1_781_321_000_000,
      updatedAt: 1_781_321_000_000,
    };

    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [retainedEntry],
      totalCount: 1,
      hasMore: false,
      nextCursor: null,
    });
    storageMocks.deleteEntry.mockRejectedValueOnce(new Error("offline delete failed"));

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    expect(await screen.findByText("Retained entry")).toBeInTheDocument();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: /delete retained entry/i }));
      expect(screen.queryByText("Retained entry")).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText("Retained entry")).toBeInTheDocument();
      expect(
        screen.getByText("Couldn't delete this entry. It has been restored."),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes undo once the delete commit starts", async () => {
    mediaQueryMocks.matches = true;
    const retainedEntry = {
      id: "entry-commit-started",
      date: "2026-06-12",
      title: "Commit started",
      content: "Undo must not remain available once storage delete starts.",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1_781_321_000_000,
      updatedAt: 1_781_321_000_000,
    };

    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [retainedEntry],
      totalCount: 1,
      hasMore: false,
      nextCursor: null,
    });
    storageMocks.deleteEntry.mockReturnValueOnce(new Promise(() => undefined));

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    expect(await screen.findByText("Commit started")).toBeInTheDocument();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: /delete commit started/i }));
      expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(storageMocks.deleteEntry).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not recover failed delete state after the component unmounts", async () => {
    mediaQueryMocks.matches = true;
    const retainedEntry = {
      id: "entry-unmounted-delete",
      date: "2026-06-12",
      title: "Unmounted delete",
      content: "This delete commit resolves after unmount.",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1_781_321_000_000,
      updatedAt: 1_781_321_000_000,
    };
    let rejectDelete: (error: Error) => void = () => undefined;

    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [retainedEntry],
      totalCount: 1,
      hasMore: false,
      nextCursor: null,
    });
    storageMocks.deleteEntry.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectDelete = reject;
      }),
    );

    const { unmount } = render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    expect(await screen.findByText("Unmounted delete")).toBeInTheDocument();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: /delete unmounted delete/i }));

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });
      expect(storageMocks.deleteEntry).toHaveBeenCalledTimes(1);

      hapticsMocks.light.mockClear();
      unmount();

      await act(async () => {
        rejectDelete(new Error("late delete failure"));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(storageMocks.deleteEntry).toHaveBeenCalledTimes(1);
      expect(hapticsMocks.light).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears an unconsumed orb suggestion when the parent clears the handoff", async () => {
    mediaQueryMocks.matches = true;
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
