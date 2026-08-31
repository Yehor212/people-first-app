import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { forwardRef } from "react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SK } from "@/lib/storageKeys";
import { requestDiaryEditorOpen } from "@/lib/diaryDeepLinkIntent";
import type { JournalEntryPrefill, JournalEntrySuggestion } from "../types";

const storageMocks = vi.hoisted(() => ({
  getAllEntries: vi.fn(),
  getEntriesPage: vi.fn(),
  getEntriesByDate: vi.fn(),
  getEntryById: vi.fn(),
  saveEntry: vi.fn(),
  getEntryCount: vi.fn(),
  hasEncryptedJournalContent: vi.fn(),
  hasEncryptedJournalMedia: vi.fn(),
  hasEncryptedJournalDrafts: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  commitPendingJournalEntryDelete: vi.fn(),
  getPendingJournalEntryDeletes: vi.fn(),
  stagePendingJournalEntryDelete: vi.fn(),
  cancelPendingJournalEntryDeletes: vi.fn(),
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
  hasEncryptedJournalHubContent: vi.fn(),
  linkEntryToSpace: vi.fn(),
}));

const editorExitMocks = vi.hoisted(() => ({
  requested: vi.fn(),
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
    cloudProtectionPending: false,
    cloudProtectionPendingKind: null as null | "removal" | "vault-sync",
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

const a11yMocks = vi.hoisted(() => ({
  announceError: vi.fn(),
  announceSuccess: vi.fn(),
}));

const journalImportMocks = vi.hoisted(() => ({
  inspectJournalBackup: vi.fn(),
  importJournalBackup: vi.fn(),
}));

const safeJsonStore = vi.hoisted(() => ({
  readBlocked: false,
  values: new Map<string, string>(),
  writeBlocked: false,
}));

const supabaseMocks = vi.hoisted(() => ({
  authStateCallback: null as
    | null
    | ((event: string, session?: { user?: { id?: string; email?: string | null } | null } | null) => Promise<void> | void),
  getSession: vi.fn(),
  signInWithOtp: vi.fn(),
  countRemoteJournalRows: vi.fn(),
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

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => false,
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: vi.fn(),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/hooks/useModalA11y", () => ({
  useModalA11y: vi.fn(() => ({
    modalProps: { role: "dialog", "aria-modal": true },
    handleKeyDown: vi.fn(),
    modalRef: { current: null },
  })),
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
  announceError: a11yMocks.announceError,
  announceSuccess: a11yMocks.announceSuccess,
  createFocusTrap: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => false,
  zenMotion: {
    gentle: { duration: 0 },
    snappy: { duration: 0 },
  },
  zenTap: {
    cell: { scale: 0.97 },
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
  storageReadRaw: vi.fn((key: string) =>
    safeJsonStore.readBlocked
      ? { ok: false as const, value: null }
      : { ok: true as const, value: safeJsonStore.values.get(key) ?? null },
  ),
  storageRemove: vi.fn((key: string) => {
    safeJsonStore.values.delete(key);
  }),
  storageSetRaw: vi.fn((key: string, value: string) => {
    if (safeJsonStore.writeBlocked) return false;
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
    from: (table: string) => ({
      select: () => supabaseMocks.countRemoteJournalRows(table),
    }),
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
  getLocalDataOwnerId: vi.fn(() => Promise.resolve(null)),
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
  commitPendingJournalEntryDelete: storageMocks.commitPendingJournalEntryDelete,
  getPendingJournalEntryDeletes: storageMocks.getPendingJournalEntryDeletes,
  stagePendingJournalEntryDelete: storageMocks.stagePendingJournalEntryDelete,
  cancelPendingJournalEntryDeletes: storageMocks.cancelPendingJournalEntryDeletes,
  deletePhoto: storageMocks.deletePhoto,
  getAllEntries: storageMocks.getAllEntries,
  getAudioForEntry: storageMocks.getAudioForEntry,
  getEntriesByDate: storageMocks.getEntriesByDate,
  getEntryById: storageMocks.getEntryById,
  getEntriesPage: storageMocks.getEntriesPage,
  getEntryCount: storageMocks.getEntryCount,
  getPhotosForEntry: storageMocks.getPhotosForEntry,
  hasEncryptedJournalContent: storageMocks.hasEncryptedJournalContent,
  hasEncryptedJournalMedia: storageMocks.hasEncryptedJournalMedia,
  saveEntry: storageMocks.saveEntry,
  storeAudio: storageMocks.storeAudio,
  updateEntry: storageMocks.updateEntry,
}));

vi.mock("../journalDraftStorage", () => ({
  hasEncryptedJournalDrafts: storageMocks.hasEncryptedJournalDrafts,
}));

vi.mock("../journalImport", () => journalImportMocks);

vi.mock("../journalHubStorage", () => ({
  createGratitudeSpaceCapture: journalHubMocks.createGratitudeSpaceCapture,
  createQuietReleaseSession: journalHubMocks.createQuietReleaseSession,
  getQuietReleaseTraceSummaries: journalHubMocks.getQuietReleaseTraceSummaries,
  hasEncryptedJournalHubContent: journalHubMocks.hasEncryptedJournalHubContent,
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
    onBack,
    onBindExitRequestHandler,
    onExitRequestCancelled,
    onRequestSettings,
  }: {
    entryPrefill: JournalEntryPrefill | null;
    onBack: () => void;
    onBindExitRequestHandler?: (handler: (() => void) | null) => void;
    onExitRequestCancelled?: () => void;
    onRequestSettings?: () => void;
  }) => {
    onBindExitRequestHandler?.(editorExitMocks.requested);
    return (
      <section data-testid="journal-entry-editor">
        <h2>{entryPrefill?.title}</h2>
        <p>{entryPrefill?.content}</p>
        {onRequestSettings ? (
          <button type="button" onClick={onRequestSettings}>
            Open diary settings
          </button>
        ) : null}
        <button type="button" onClick={onBack}>
          Confirm editor exit
        </button>
        <button type="button" onClick={onExitRequestCancelled}>
          Keep editing
        </button>
      </section>
    );
  },
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
  useIsPresent: () => true,
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
    div: forwardRef<HTMLDivElement, MotionMockProps<HTMLDivElement>>((props, ref) => {
      const { children, ...rest } = omitMotionProps(props);
      return <div ref={ref} {...rest}>{children}</div>;
    }),
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

import {
  JournalBackgroundLoadNotice,
  JournalFavoritesPanel,
  JournalLoadErrorPanel,
  JournalModule,
} from "../JournalModule";
import "../JournalSettingsContent";

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
    journalImportMocks.inspectJournalBackup.mockReset();
    journalImportMocks.importJournalBackup.mockReset();
    securityMocks.lock.mockReset();
    securityMocks.removePassword.mockReset();
    securityMocks.removePassword.mockResolvedValue({ status: "removed" });
    securityMocks.setPassword.mockReset();
    securityMocks.touch.mockReset();
    securityMocks.unlock.mockReset();
    securityMocks.unlockWithBiometric.mockReset();
    supabaseMocks.getSession.mockReset();
    supabaseMocks.signInWithOtp.mockReset();
    supabaseMocks.countRemoteJournalRows.mockReset();
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
      cloudProtectionPending: false,
      cloudProtectionPendingKind: null,
    });
    safeJsonStore.values.clear();
    safeJsonStore.readBlocked = false;
    safeJsonStore.writeBlocked = false;
    mediaQueryMocks.matches = false;
    supabaseMocks.authStateCallback = null;
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "owner-user-id", email: "owner@example.invalid" } } },
    });
    supabaseMocks.signInWithOtp.mockResolvedValue({ error: null });
    supabaseMocks.countRemoteJournalRows.mockResolvedValue({ count: 0, error: null });
    storageMocks.getAllEntries.mockResolvedValue([]);
    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [],
      totalCount: 0,
      hasMore: false,
      nextCursor: null,
    });
    storageMocks.getEntriesByDate.mockResolvedValue([]);
    storageMocks.getEntryById.mockResolvedValue(undefined);
    storageMocks.getEntryCount.mockResolvedValue(0);
    storageMocks.hasEncryptedJournalContent.mockResolvedValue(false);
    storageMocks.hasEncryptedJournalMedia.mockResolvedValue(false);
    storageMocks.hasEncryptedJournalDrafts.mockResolvedValue(false);
    journalImportMocks.inspectJournalBackup.mockResolvedValue({
      canImport: true,
      entries: 2,
      photos: 1,
      audio: 1,
      issues: 0,
      errors: [],
    });
    journalImportMocks.importJournalBackup.mockResolvedValue({
      imported: 2,
      skipped: 1,
      photosImported: 1,
      audioImported: 1,
      syncPending: false,
      errors: [],
    });
    journalHubMocks.hasEncryptedJournalHubContent.mockResolvedValue(false);
    storageMocks.deleteEntry.mockResolvedValue(undefined);
    storageMocks.commitPendingJournalEntryDelete.mockResolvedValue("committed");
    storageMocks.getPendingJournalEntryDeletes.mockResolvedValue([]);
    storageMocks.stagePendingJournalEntryDelete.mockImplementation(
      (id: string, expiresAt: number) => Promise.resolve([{ id, expiresAt }]),
    );
    storageMocks.cancelPendingJournalEntryDeletes.mockImplementation((ids: string[]) =>
      Promise.resolve([...ids]),
    );
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

  it("renders a compact retry notice without replacing already loaded entries", () => {
    const onRetry = vi.fn();
    render(
      <JournalBackgroundLoadNotice
        ts={{
          journalHistoryLoadFailed: "Some older entries are not available yet",
          journalHistoryLoadFailedHint: "The entries shown are safe. Try again to load the rest.",
          journalRetryHistory: "Try older entries again",
        }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("The entries shown are safe");
    fireEvent.click(screen.getByRole("button", { name: "Try older entries again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not claim favorites are empty while older history is loading", () => {
    render(
      <JournalFavoritesPanel
        entries={[]}
        onOpenEntry={vi.fn()}
        onNewEntry={vi.fn()}
        privateMode={false}
        language="en"
        historyLoading
        historyLoadError={false}
        onRetryHistory={vi.fn()}
        ts={{
          journalFavorites: "Favorites",
          journalFavoritesEmptyTitle: "No favorites yet",
          journalHistoryLoadPending: "Loading older diary entries…",
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading older diary entries");
    expect(screen.queryByText("No favorites yet")).not.toBeInTheDocument();
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

  it("treats Later as a session deferral and resurfaces the suggestion on the next diary visit", async () => {
    mediaQueryMocks.matches = true;
    const onConsumed = vi.fn();
    const firstVisit = render(
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
    fireEvent.click(screen.getAllByRole("button", { name: "Later" })[0]);

    expect(screen.queryByTestId("diary-entry-suggestion")).not.toBeInTheDocument();
    expect(onConsumed).not.toHaveBeenCalled();
    expect(storageMocks.saveEntry).not.toHaveBeenCalled();

    firstVisit.unmount();
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
    expect(onConsumed).not.toHaveBeenCalled();
  });

  it("does not reveal orb suggestion text while private mode conceals the diary", async () => {
    mediaQueryMocks.matches = true;
    safeJsonStore.values.set(SK.JOURNAL_PRIVATE_MODE, "true");

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
        initialEntrySuggestion={initialSuggestion}
      />,
    );

    await screen.findByTestId("journal-page-shell");
    expect(screen.queryByText("A steady moment worth keeping.")).not.toBeInTheDocument();
    expect(storageMocks.saveEntry).not.toHaveBeenCalled();
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
      name: /conceal diary list/i,
    });
    fireEvent.click(privateModeSwitch);
    fireEvent.click(within(settingsPanel).getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("journal-entry-editor")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("journal-page-shell")).toBeInTheDocument();
  });

  it("fails closed without rendering sensitive suggestions when private-mode storage cannot be read", async () => {
    mediaQueryMocks.matches = true;
    safeJsonStore.readBlocked = true;

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
        initialEntrySuggestion={initialSuggestion}
      />,
    );

    await screen.findByTestId("journal-page-shell");
    expect(screen.queryByText("A steady moment worth keeping.")).not.toBeInTheDocument();
  });

  it("keeps the current diary concealed and reports when private mode cannot be saved", async () => {
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
    safeJsonStore.writeBlocked = true;

    const settingsPanel = await screen.findByTestId("journal-settings-panel");
    const privateModeSwitch = await within(settingsPanel).findByRole("switch", {
      name: /conceal diary list/i,
    });
    fireEvent.click(privateModeSwitch);

    expect(screen.queryByTestId("journal-entry-editor")).not.toBeInTheDocument();
    expect(
      within(settingsPanel).getByText(
        /could not save this privacy setting.*diary stays concealed/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(settingsPanel).getByRole("switch", { name: /conceal diary list/i }),
    ).toBeChecked();
  });

  it("does not open statistics until the editor approves leaving a dirty entry", async () => {
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
    expect(await screen.findByTestId("journal-entry-editor")).toBeInTheDocument();

    fireEvent.click(await screen.findByTestId("journal-sidebar-nav-stats"));
    expect(editorExitMocks.requested).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("journal-entry-editor")).toBeInTheDocument();
    expect(screen.getByTestId("journal-sidebar-nav-stats")).not.toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm editor exit/i }));
    await waitFor(() =>
      expect(screen.getByTestId("journal-sidebar-nav-stats")).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    const hiddenEditor = screen.queryByTestId("journal-entry-editor");
    if (hiddenEditor) expect(hiddenEditor).not.toBeVisible();
  });

  it("routes an external new-entry request through the active editor exit guard", async () => {
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

    act(() => requestDiaryEditorOpen());

    expect(editorExitMocks.requested).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("journal-entry-editor")).toHaveTextContent(
      "A steady moment worth keeping.",
    );
  });

  it("forgets a cancelled statistics intent before a later ordinary editor exit", async () => {
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
    fireEvent.click(await screen.findByTestId("journal-sidebar-nav-stats"));
    fireEvent.click(screen.getByRole("button", { name: /keep editing/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm editor exit/i }));

    await waitFor(() =>
      expect(screen.getByTestId("journal-sidebar-nav-entry")).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    const hiddenEditor = screen.queryByTestId("journal-entry-editor");
    if (hiddenEditor) expect(hiddenEditor).not.toBeVisible();
    expect(screen.getByTestId("journal-sidebar-nav-stats")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("journal-sidebar-nav-entry")).toHaveAttribute(
      "aria-current",
      "page",
    );
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

  it("does not offer email lock removal when the account still has remote diary data", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    supabaseMocks.countRemoteJournalRows.mockImplementation(async (table: string) => ({
      count: table === "journal_entries" ? 1 : 0,
      error: null,
    }));

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));

    expect((await screen.findAllByText(/email verification cannot remove this lock/i)).length).toBeGreaterThan(0);
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    expect(supabaseMocks.countRemoteJournalRows).toHaveBeenCalledWith("journal_entries");
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

  it("lets the user dismiss a pending reset-link request and ignores its late result", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    let resolveSend!: (value: { error: null }) => void;
    supabaseMocks.signInWithOtp.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSend = resolve;
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
    fireEvent.click(await screen.findByRole("button", { name: /send link/i }));

    const dialog = await screen.findByRole("dialog", { name: /remove lock by email/i });
    const cancel = within(dialog).getByRole("button", { name: /cancel/i });
    await waitFor(() => expect(supabaseMocks.signInWithOtp).toHaveBeenCalledOnce());
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(screen.queryByRole("dialog", { name: /remove lock by email/i })).not.toBeInTheDocument();

    await act(async () => resolveSend({ error: null }));

    expect(screen.queryByRole("dialog", { name: /remove lock by email/i })).not.toBeInTheDocument();
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
    expect(securityMocks.removePassword).not.toHaveBeenCalled();
  });

  it("returns a stalled reset-link request to an actionable state after a bounded timeout", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    supabaseMocks.signInWithOtp.mockReturnValueOnce(new Promise(() => undefined));

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /can't open the lock/i }));
    const send = await screen.findByRole("button", { name: /send link/i });
    vi.useFakeTimers();
    fireEvent.click(send);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    const dialog = screen.getByRole("dialog", { name: /remove lock by email/i });
    expect(dialog).toHaveAttribute("aria-busy", "false");
    expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeEnabled();
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();
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
          emailRedirectTo: expect.any(String),
        },
      });
    });
    const resetRequest = supabaseMocks.signInWithOtp.mock.calls[0]?.[0] as {
      options?: { emailRedirectTo?: string };
    };
    const resetRedirect = new URL(resetRequest.options?.emailRedirectTo || "");
    expect(resetRedirect.protocol).toBe("com.zenflow.app:");
    expect(resetRedirect.hostname).toBe("login-callback");
    expect(resetRedirect.searchParams.get("journalReset")).toMatch(/^[a-f0-9]{32}$/);
    expect(resetRedirect.searchParams.get("zenflowAuthAttempt")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    await waitFor(
      () => {
        expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
      },
      { timeout: 10_000 },
    );
    const pendingReset = JSON.parse(safeJsonStore.values.get(SK.JOURNAL_PASSWORD_RESET) || "{}");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: pendingReset.nonce, userId: pendingReset.userId, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { id: "other-user-id", email: "other@example.invalid" },
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

    let resolveSession!: (value: { data: { session: { user: { id: string; email: string } } } }) => void;
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
      resolveSession({
        data: { session: { user: { id: "owner-user-id", email: "owner@example.invalid" } } },
      });
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
    expect(securityMocks.removePassword).toHaveBeenCalledWith();
    expect(a11yMocks.announceSuccess).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /remove password lock/i })).not.toBeInTheDocument();
    });
  });

  it("announces pending cleanup only inside the open removal dialog", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: false,
      cloudProtectionPending: true,
      cloudProtectionPendingKind: "removal",
    });
    securityMocks.removePassword.mockResolvedValueOnce({
      status: "removed-cleanup-pending",
      pending: ["biometric", "cloud"],
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
    fireEvent.click(
      await screen.findByRole("button", { name: /continue removing diary lock/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /remove password lock/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /remove password lock/i }));

    expect(await within(dialog).findByRole("status")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(dialog).toBeInTheDocument();
    expect(a11yMocks.announceSuccess).not.toHaveBeenCalled();
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
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "reset-proof-1", startedAt: Date.now() }),
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
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "reset-proof-2", startedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(
      () => {
        expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
      },
      { timeout: 10_000 },
    );
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
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "reset-proof-2", startedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(
      () => {
        expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
      },
      { timeout: 10_000 },
    );
    expect(securityMocks.removePassword).not.toHaveBeenCalled();

    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "reset-proof-2", userId: "owner-user-id", receivedAt: Date.now() }),
    );
    window.dispatchEvent(new CustomEvent("zenflow-auth-complete"));

    expect(await screen.findByRole(
      "dialog",
      { name: /diary lock removed/i },
      { timeout: 10_000 },
    )).toBeInTheDocument();
    expect(securityMocks.removePassword).toHaveBeenCalledWith({
      allowVerifiedEmptyDiary: true,
    });
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
  });

  it("coalesces simultaneous auth-complete and signed-in reset signals", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    let finishRemoval!: () => void;
    let releaseAvailabilityChecks!: () => void;
    const availabilityGate = new Promise<void>((resolve) => {
      releaseAvailabilityChecks = resolve;
    });
    storageMocks.hasEncryptedJournalContent.mockImplementation(async () => {
      await availabilityGate;
      return false;
    });
    securityMocks.removePassword.mockImplementationOnce(
      () => new Promise<{ status: "removed" }>((resolve) => {
        finishRemoval = () => resolve({ status: "removed" });
      }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "reset-proof-single-flight", startedAt: Date.now() }),
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
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "reset-proof-single-flight", userId: "owner-user-id", receivedAt: Date.now() }),
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent("zenflow-auth-complete"));
      void supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { id: "owner-user-id", email: "owner@example.invalid" },
      });
    });

    await waitFor(() => expect(storageMocks.hasEncryptedJournalContent).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      releaseAvailabilityChecks();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(securityMocks.removePassword).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(storageMocks.hasEncryptedJournalContent).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.countRemoteJournalRows).toHaveBeenCalledTimes(3);
    expect(loggerMocks.warn).not.toHaveBeenCalledWith(
      "[Journal] Ignored password reset session after proof could not be consumed",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => finishRemoval());

    expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: /diary lock removed/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not remove the diary lock when reset proof changes before it can be consumed", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "reset-proof-race", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "reset-proof-race", userId: "owner-user-id", receivedAt: Date.now() }),
    );
    storageMocks.hasEncryptedJournalContent.mockImplementationOnce(async () => {
      safeJsonStore.values.set(
        SK.JOURNAL_PASSWORD_RESET_PROOF,
        JSON.stringify({ nonce: "reset-proof-race-stale", userId: "owner-user-id", receivedAt: Date.now() }),
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
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "encrypted-proof", startedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(
      () => {
        expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
      },
      { timeout: 10_000 },
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "encrypted-proof", userId: "owner-user-id", receivedAt: Date.now() }),
    );
    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { id: "owner-user-id", email: "owner@example.invalid" },
      });
    });

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
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "reset-proof-url", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "reset-proof-url", userId: "owner-user-id", receivedAt: Date.now() }),
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
      JSON.stringify({ nonce: "stale-proof", userId: "owner-user-id", receivedAt: Date.now() }),
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
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "native-proof-1", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "native-proof-1", userId: "owner-user-id", receivedAt: Date.now() }),
    );

    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    expect(await screen.findByRole(
      "dialog",
      { name: /diary lock removed/i },
      { timeout: 10_000 },
    )).toBeInTheDocument();
    expect(securityMocks.removePassword).toHaveBeenCalledTimes(1);
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET)).toBe(false);
    expect(safeJsonStore.values.has(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBe(false);
  });

  it("ignores native cold-start reset when stored proof nonce does not match", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "native-proof-expected", startedAt: Date.now() }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "native-proof-other", userId: "owner-user-id", receivedAt: Date.now() }),
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
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "native-proof-2", startedAt: Date.now() }),
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
        userId: "owner-user-id",
        nonce: "expired-proof",
        startedAt: Date.now() - 601_000,
      }),
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "expired-proof", userId: "owner-user-id", receivedAt: Date.now() }),
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
        user: { id: "owner-user-id", email: "Owner@Example.Invalid" },
      });
    });

    expect(securityMocks.removePassword).not.toHaveBeenCalled();
    const resetAlert = await screen.findByRole("alert");
    expect(resetAlert).toHaveTextContent(/nothing changed/i);
    expect(resetAlert).toHaveTextContent(/entries remain protected/i);
    expect(screen.queryByRole("dialog", { name: /diary lock removed/i })).not.toBeInTheDocument();
  });

  it("shows a same-device proof error when the auth callback has no matching proof", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    window.history.replaceState({}, "", "/people-first-app/?nav=v2&journalReset=missing-proof-copy");
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET,
      JSON.stringify({ email: "owner@example.invalid", userId: "owner-user-id", nonce: "missing-proof-copy", startedAt: Date.now() }),
    );
    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    await waitFor(
      () => {
        expect(supabaseMocks.authStateCallback).toEqual(expect.any(Function));
      },
      { timeout: 10_000 },
    );
    safeJsonStore.values.set(
      SK.JOURNAL_PASSWORD_RESET_PROOF,
      JSON.stringify({ nonce: "missing-proof-copy-stale", userId: "owner-user-id", receivedAt: Date.now() }),
    );
    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { id: "owner-user-id", email: "owner@example.invalid" },
      });
    });

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "This browser could not confirm the email link. Open the link on the same device or request a new one.",
        );
      },
      { timeout: 10_000 },
    );
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
      JSON.stringify({ nonce: pendingReset.nonce, userId: pendingReset.userId, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { id: "owner-user-id", email: "Owner@Example.Invalid" },
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
      JSON.stringify({ nonce: pendingReset.nonce, userId: pendingReset.userId, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { id: "owner-user-id", email: "owner@example.invalid" },
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
      JSON.stringify({ nonce: pendingReset.nonce, userId: pendingReset.userId, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("INITIAL_SESSION", {
        user: { id: "owner-user-id", email: "owner@example.invalid" },
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
    const cooldownCopy = screen.getByText(/please wait.*60 seconds.*before/i);
    expect(cooldownCopy).not.toHaveAttribute("aria-live");
    expect(resendButton).toHaveAttribute("aria-describedby", cooldownCopy.id);
  });

  it("shows recovery feedback when verified reset cannot remove the diary lock", async () => {
    Object.assign(securityMocks.state, {
      hasPassword: true,
      isLocked: true,
    });
    securityMocks.removePassword.mockResolvedValueOnce({
      status: "blocked",
      blocker: "storage-failed",
      recoveryAction: "retry",
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
      JSON.stringify({ nonce: pendingReset.nonce, userId: pendingReset.userId, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { id: "owner-user-id", email: "owner@example.invalid" },
      });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This device could not read the complete diary. Keep the app open, reload, and try again. Nothing was changed.",
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
      JSON.stringify({ nonce: pendingReset.nonce, userId: pendingReset.userId, receivedAt: Date.now() }),
    );

    await act(async () => {
      await supabaseMocks.authStateCallback?.("SIGNED_IN", {
        user: { id: "owner-user-id", email: "owner@example.invalid" },
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
      JSON.stringify({ nonce: pendingReset.nonce, userId: pendingReset.userId, receivedAt: Date.now() }),
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
    storageMocks.commitPendingJournalEntryDelete.mockRejectedValueOnce(
      new Error("offline delete failed"),
    );

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
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete retained entry/i }));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.queryByText("Retained entry")).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
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

  it("does not restore stale UI when the durable delete marker can no longer be cancelled", async () => {
    mediaQueryMocks.matches = true;
    const deletedEntry = {
      id: "entry-delete-won",
      date: "2026-06-12",
      title: "Delete already won",
      content: "This row must not be resurrected after the durable marker is gone.",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1_781_321_000_000,
      updatedAt: 1_781_321_000_000,
    };
    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [deletedEntry],
      totalCount: 1,
      hasMore: false,
      nextCursor: null,
    });
    storageMocks.commitPendingJournalEntryDelete.mockRejectedValueOnce(
      new Error("commit outcome unknown"),
    );
    storageMocks.cancelPendingJournalEntryDeletes.mockResolvedValueOnce([]);

    render(<JournalModule startOpen disableCardShell hideCloseButton presentation="page" />);
    expect(await screen.findByText("Delete already won")).toBeInTheDocument();
    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [],
      totalCount: 0,
      hasMore: false,
      nextCursor: null,
    });
    const readsBeforeDelete = storageMocks.getEntriesPage.mock.calls.length;

    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete delete already won/i }));
        await Promise.resolve();
      });
      await act(async () => {
        vi.advanceTimersByTime(5_000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.queryByText("Delete already won")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Couldn't delete this entry. It has been restored."),
      ).not.toBeInTheDocument();
      expect(storageMocks.getEntriesPage.mock.calls.length).toBeGreaterThan(readsBeforeDelete);
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
    storageMocks.commitPendingJournalEntryDelete.mockReturnValueOnce(
      new Promise(() => undefined),
    );

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
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete commit started/i }));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(storageMocks.commitPendingJournalEntryDelete).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not shorten the undo window when the diary unmounts", async () => {
    mediaQueryMocks.matches = true;
    const retainedEntry = {
      id: "entry-durable-undo",
      date: "2026-06-12",
      title: "Durable undo",
      content: "Keep the undo promise after navigation.",
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
    const { unmount } = render(
      <JournalModule startOpen disableCardShell hideCloseButton presentation="page" />,
    );
    expect(await screen.findByText("Durable undo")).toBeInTheDocument();

    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete durable undo/i }));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(storageMocks.stagePendingJournalEntryDelete).toHaveBeenCalledTimes(1);
      unmount();
      await act(async () => {
        vi.advanceTimersByTime(5_000);
        await Promise.resolve();
      });
      expect(storageMocks.commitPendingJournalEntryDelete).not.toHaveBeenCalled();
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
    storageMocks.commitPendingJournalEntryDelete.mockReturnValueOnce(
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
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete unmounted delete/i }));
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });
      expect(storageMocks.commitPendingJournalEntryDelete).toHaveBeenCalledTimes(1);

      hapticsMocks.light.mockClear();
      unmount();

      await act(async () => {
        rejectDelete(new Error("late delete failure"));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(storageMocks.commitPendingJournalEntryDelete).toHaveBeenCalledTimes(1);
      expect(hapticsMocks.light).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("undoes a rapid batch of pending deletions without committing either entry", async () => {
    mediaQueryMocks.matches = true;
    const firstEntry = {
      id: "entry-batch-first",
      date: "2026-06-12",
      title: "First batch entry",
      content: "First entry kept inside the shared undo window.",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1_781_321_000_000,
      updatedAt: 1_781_321_000_000,
    };
    const secondEntry = {
      ...firstEntry,
      id: "entry-batch-second",
      title: "Second batch entry",
      content: "Second entry kept inside the shared undo window.",
      createdAt: firstEntry.createdAt + 1,
      updatedAt: firstEntry.updatedAt + 1,
    };
    const staged: Array<{ id: string; expiresAt: number }> = [];
    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [firstEntry, secondEntry],
      totalCount: 2,
      hasMore: false,
      nextCursor: null,
    });
    storageMocks.stagePendingJournalEntryDelete.mockImplementation(
      async (id: string, expiresAt: number) => {
        const nextExpiry = Math.max(expiresAt, ...staged.map((item) => item.expiresAt));
        const existing = staged.find((item) => item.id === id);
        if (existing) existing.expiresAt = nextExpiry;
        else staged.push({ id, expiresAt: nextExpiry });
        for (const marker of staged) marker.expiresAt = nextExpiry;
        return staged.map((marker) => ({ ...marker }));
      },
    );

    render(<JournalModule startOpen disableCardShell hideCloseButton presentation="page" />);
    expect(await screen.findByText("First batch entry")).toBeInTheDocument();
    expect(screen.getByText("Second batch entry")).toBeInTheDocument();

    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete first batch entry/i }));
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete second batch entry/i }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.queryByText("First batch entry")).not.toBeInTheDocument();
      expect(screen.queryByText("Second batch entry")).not.toBeInTheDocument();
      expect(screen.getByText("Entries deleted")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /undo/i })).toHaveLength(1);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /undo/i }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(storageMocks.cancelPendingJournalEntryDeletes).toHaveBeenCalledWith([
        "entry-batch-first",
        "entry-batch-second",
      ]);
      expect(screen.getByText("First batch entry")).toBeInTheDocument();
      expect(screen.getByText("Second batch entry")).toBeInTheDocument();
      vi.advanceTimersByTime(5_000);
      expect(storageMocks.commitPendingJournalEntryDelete).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not restore an entry when permanent deletion wins at the undo deadline", async () => {
    mediaQueryMocks.matches = true;
    const deadlineEntry = {
      id: "entry-undo-deadline",
      date: "2026-06-12",
      title: "Deadline entry",
      content: "Only one terminal delete outcome is allowed.",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1_781_321_000_000,
      updatedAt: 1_781_321_000_000,
    };
    let resolveCancellation: (ids: string[]) => void = () => undefined;
    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [deadlineEntry],
      totalCount: 1,
      hasMore: false,
      nextCursor: null,
    });
    storageMocks.cancelPendingJournalEntryDeletes.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCancellation = resolve;
      }),
    );

    render(<JournalModule startOpen disableCardShell hideCloseButton presentation="page" />);
    expect(await screen.findByText("Deadline entry")).toBeInTheDocument();

    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete deadline entry/i }));
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        vi.advanceTimersByTime(4_999);
        fireEvent.click(screen.getByRole("button", { name: /undo/i }));
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });

      expect(storageMocks.commitPendingJournalEntryDelete).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveCancellation([]);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.queryByText("Deadline entry")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores the undo action from a durable marker after the diary remounts", async () => {
    mediaQueryMocks.matches = true;
    const pendingEntry = {
      id: "entry-restart-undo",
      date: "2026-06-12",
      title: "Restart-safe entry",
      content: "Private content remains in the journal table, not in the undo marker.",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1_781_321_000_000,
      updatedAt: 1_781_321_000_000,
    };
    storageMocks.getEntriesPage.mockResolvedValue({
      entries: [],
      totalCount: 1,
      hasMore: false,
      nextCursor: null,
    });
    storageMocks.getPendingJournalEntryDeletes.mockResolvedValue([
      { id: pendingEntry.id, expiresAt: Date.now() + 5_000 },
    ]);
    storageMocks.getEntryById.mockResolvedValue(pendingEntry);

    render(<JournalModule startOpen disableCardShell hideCloseButton presentation="page" />);

    const undo = await screen.findByRole(
      "button",
      { name: /undo/i },
      { timeout: 3_000 },
    );
    expect(screen.queryByText("Restart-safe entry")).not.toBeInTheDocument();
    fireEvent.click(undo);

    expect(
      await screen.findByText("Restart-safe entry", {}, { timeout: 3_000 }),
    ).toBeInTheDocument();
    expect(storageMocks.cancelPendingJournalEntryDeletes).toHaveBeenCalledWith([
      "entry-restart-undo",
    ]);
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

  it("inspects a selected backup and waits for explicit confirmation before importing", async () => {
    mediaQueryMocks.matches = true;
    render(
      <JournalModule
        startOpen
        disableCardShell
        hideCloseButton
        presentation="page"
      />,
    );

    fireEvent.click(screen.getByTestId("journal-sidebar-nav-settings"));
    expect((await screen.findAllByText(/diary settings/i)).length).toBeGreaterThan(0);

    const file = new File(["{}"], "journal-backup.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("journal-import-input"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(journalImportMocks.inspectJournalBackup).toHaveBeenCalledWith(file);
    });
    expect(journalImportMocks.importJournalBackup).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", { name: /import backup/i });
    expect(dialog).toHaveTextContent("journal-backup.json");
    expect(dialog).toHaveTextContent("2");

    fireEvent.click(within(dialog).getByRole("button", { name: /import backup/i }));

    await waitFor(() => {
      expect(journalImportMocks.importJournalBackup).toHaveBeenCalledWith(file);
    });
    expect(await screen.findByText(/skipped: 1/i)).toBeInTheDocument();
  });
});
