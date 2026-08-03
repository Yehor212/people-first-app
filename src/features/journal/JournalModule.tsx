import {
  useState,
  useEffect,
  useCallback,
  useId,
  useRef,
  useMemo,
  Suspense,
  Fragment,
  memo,
  type ChangeEvent,
  type ComponentProps,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Lock,
  ChevronRight,
  X,
  Settings,
  Loader2,
  CheckCircle2,
  Mail,
  PenLine,
  Plus,
  BarChart3,
  Flame,
  PanelLeftOpen,
  Star,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup, useIsPresent, useReducedMotion } from "framer-motion";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn, formatDate } from "@/lib/utils";
import { V2_SHELL_ICONS } from "@/lib/v2IconSystem";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { consumePendingDiaryEditorOpen, subscribeToDiaryEditorOpen } from "@/lib/diaryDeepLinkIntent";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import { createFocusTrap, getFocusableElements, announceSuccess, announceError } from "@/lib/a11y";
import { AUTH_COMPLETE_EVENT, getAuthRedirectUrl } from "@/lib/authRedirect";
import { createPkceAttemptRedirectUrl } from "@/lib/pkceAttemptStorage";
import {
  ENABLE_JOURNAL_SAVE_CEREMONY,
  IS_DESKTOP_RUNTIME,
} from "@/lib/env";
import { Switch } from "@/components/ui/switch";
import { SplashScreen, type SplashThemePreference } from "@/components/SplashScreen";
import { triggerSync } from "@/storage/cloudSync";
import { settingsRepo } from "@/storage/db";
import type { Database } from "@/types/supabase";
import { useJournal } from "./useJournal";
import { useJournalToday } from "./useJournalToday";
import { useJournalSecurity } from "./useJournalSecurity";
import { JournalLockScreen } from "./JournalLockScreen";
import { SidebarCompact, type DiarySidebarSection } from "./SidebarCompact";
import { DiaryEntrySuggestionCard } from "./DiaryEntrySuggestionCard";
import { JournalOnboardingHints, useJournalOnboarding } from "./JournalOnboardingHints";
import { JournalCalendar } from "./JournalCalendar";
import { formatLocalizedCount } from "./journalWordCount";
import { formatJournalCivilDate, formatJournalDuration, isNextJournalDate, shiftJournalDate } from "./journalDateUtils";
import {
  cancelPendingJournalEntryDeletes,
  getEntryById,
  getEntryCount,
  getPendingJournalEntryDeletes,
  hasEncryptedJournalContent,
  hasEncryptedJournalMedia,
  stagePendingJournalEntryDelete,
  type PendingJournalEntryDelete,
} from "./journalStorage";
import { JOURNAL_DELETE_UNDO_WINDOW_MS } from "./journalDeletePolicy";
import { hasEncryptedJournalDrafts } from "./journalDraftStorage";
import {
  createGratitudeSpaceCapture,
  createQuietReleaseSession,
  getQuietReleaseTraceSummaries,
  hasEncryptedJournalHubContent,
  linkEntryToSpace,
} from "./journalHubStorage";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageReadRaw, storageSetRaw, storageRemove } from "@/lib/safeJson";
import {
  JOURNAL_PASSWORD_RESET_PARAM,
  clearJournalPasswordResetParamFromCurrentUrl,
  clearJournalPasswordResetProof,
  consumeJournalPasswordResetProof,
  getJournalPasswordResetNonceFromUrl,
  hasStoredJournalPasswordResetProof,
} from "@/lib/journalPasswordResetHandoff";
import { scheduleIdle } from "@/lib/scheduleIdle";
import { useJournalReminder, getDaysSinceLastEntry } from "./useJournalReminder";
import { useScreenSecurity } from "./useScreenSecurity";
import {
  isJournalRequestTimeoutError,
  withJournalRequestTimeout,
} from "./journalRequestTimeout";
import { useGamificationStore, useUserDataStore } from "@/stores";
import { useThemeStore } from "@/stores/themeStore";
import { haptics, hapticSuccess } from "@/lib/haptics";
import { shouldAnimate } from "@/lib/animationUtils";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useEntryTransition } from "@/hooks/useEntryTransition";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useSidebarKeyboard } from "@/hooks/useSidebarKeyboard";
import { springs } from "@/config/animations";
import { useStreakFreeze, StreakFreezeIndicator } from "./StreakFreeze";
import type { JournalSettingsSection } from "./JournalSettingsContent";
import type { JournalImportInspection } from "./journalImport";
import type {
  JournalEntry,
  JournalEntryPrefill,
  JournalEntrySuggestion,
  JournalReleaseTraceSummary,
} from "./types";
import { JournalSaveCeremonyHost } from "./save-ceremony/JournalSaveCeremonyHost";
import {
  commitJournalSaveAndCaptureTheme,
  createJournalSaveCommitReceipt,
  type JournalSaveCommitReceipt,
  type JournalSaveCompletion,
} from "./save-ceremony/journalSaveCeremonyContract";
import { preloadJournalSaveCeremonyRuntime } from "./save-ceremony/journalSaveCeremonyRuntime";
import {
  captureJournalSaveCeremonyLifecycle,
  invalidateJournalSaveCeremonyLifecycle,
  markJournalSaveCeremonyLifecycleActive,
  mayPresentJournalSaveCeremony,
  type JournalSaveCeremonyLifecycleToken,
} from "./save-ceremony/journalSaveCeremonyLifecycle";
import { isNative, platform } from "@/lib/platform";
import { DiaryMiniOrb } from "./DiaryMiniOrb";
import { DiaryWallpaper } from "./DiaryWallpaper";
import { getJournalPreviewText } from "./journalDisplay";
import { isFavoriteJournalEntry, setJournalEntryFavorite } from "./journalFavorite";

interface JournalSaveCeremonyPresentation {
  receipt: JournalSaveCommitReceipt;
  lifecycle: JournalSaveCeremonyLifecycleToken;
}

function getPrefillSpaceIds(prefill: JournalEntryPrefill | null | undefined): string[] {
  if (!prefill) return [];
  return Array.from(new Set([prefill.spaceId, ...(prefill.spaceIds ?? [])])).filter(
    (spaceId): spaceId is string => Boolean(spaceId && spaceId !== "space-all" && spaceId.startsWith("space-")),
  );
}

function getSuggestionDismissKey(suggestion: JournalEntrySuggestion, index = 0): string {
  return (
    suggestion.id ||
    `${suggestion.source}-${suggestion.committedAt || suggestion.prefill.date || index}`
  );
}

function waitForJournalDeleteDeadline(delay: number, signal: AbortSignal): Promise<boolean> {
  const boundedDelay = Number.isFinite(delay)
    ? Math.min(JOURNAL_DELETE_UNDO_WINDOW_MS, Math.max(0, Math.trunc(delay)))
    : 0;

  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (elapsed: boolean) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", handleAbort);
      resolve(elapsed);
    };
    const timerId = window.setTimeout(() => finish(true), boundedDelay);
    function handleAbort() {
      window.clearTimeout(timerId);
      finish(false);
    }
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

// Lazy-load JournalStats because it is a dense stats surface.
const LazyJournalStats = lazyWithRetry(
  () => import("./JournalStats").then((m) => ({ default: m.JournalStats })),
  "JournalStats"
);

type DeferredJournalModule = Record<string, ComponentType<any>>;
type JournalSettingsContentComponent =
  typeof import("./JournalSettingsContent").JournalSettingsContent;
type ExportPickerDialogComponent = typeof import("./ExportPickerDialog").ExportPickerDialog;
type JournalImportConfirmDialogComponent =
  typeof import("./JournalImportConfirmDialog").JournalImportConfirmDialog;
type RemovePasswordConfirmDialogComponent =
  typeof import("./RemovePasswordConfirmDialog").RemovePasswordConfirmDialog;
type KeyboardShortcutsOverlayComponent =
  typeof import("./KeyboardShortcutsOverlay").KeyboardShortcutsOverlay;
type StreakCelebrationComponent = typeof import("./StreakCelebration").StreakCelebration;
type JournalCalendarFullComponent = typeof import("./JournalCalendarFull").JournalCalendarFull;

const deferredJournalModules = import.meta.glob<DeferredJournalModule>(
  "./{ExportPickerDialog,JournalCalendarFull,JournalImportConfirmDialog,JournalSettingsContent,KeyboardShortcutsOverlay,RemovePasswordConfirmDialog,StreakCelebration}.tsx",
);

function lazyDeferredJournalComponent<T extends ComponentType<any>>(
  modulePath: keyof typeof deferredJournalModules,
  exportName: string,
) {
  return lazyWithRetry<T>(async () => {
    const loadModule = deferredJournalModules[modulePath];
    if (!loadModule) {
      throw new Error(`Missing deferred journal module: ${String(modulePath)}`);
    }

    const module = await loadModule();
    const component = module[exportName];
    if (!component) {
      throw new Error(`Missing deferred journal export: ${exportName}`);
    }

    return { default: component as T };
  }, exportName);
}

const LazyJournalSettingsContent = lazyDeferredJournalComponent<JournalSettingsContentComponent>(
  "./JournalSettingsContent.tsx",
  "JournalSettingsContent",
);

const LazyExportPickerDialog = lazyDeferredJournalComponent<ExportPickerDialogComponent>(
  "./ExportPickerDialog.tsx",
  "ExportPickerDialog",
);

const LazyJournalImportConfirmDialog =
  lazyDeferredJournalComponent<JournalImportConfirmDialogComponent>(
    "./JournalImportConfirmDialog.tsx",
    "JournalImportConfirmDialog",
  );

const LazyRemovePasswordConfirmDialog =
  lazyDeferredJournalComponent<RemovePasswordConfirmDialogComponent>(
    "./RemovePasswordConfirmDialog.tsx",
    "RemovePasswordConfirmDialog",
  );

const LazyKeyboardShortcutsOverlay =
  lazyDeferredJournalComponent<KeyboardShortcutsOverlayComponent>(
    "./KeyboardShortcutsOverlay.tsx",
    "KeyboardShortcutsOverlay",
  );

const LazyStreakCelebration = lazyDeferredJournalComponent<StreakCelebrationComponent>(
  "./StreakCelebration.tsx",
  "StreakCelebration",
);

const LazyJournalCalendarFull = lazyDeferredJournalComponent<JournalCalendarFullComponent>(
  "./JournalCalendarFull.tsx",
  "JournalCalendarFull",
);

const LazyDiaryEmptyCanvas = lazyWithRetry(
  () => import("./DiaryEmptyCanvas").then((m) => ({ default: m.DiaryEmptyCanvas })),
  "DiaryEmptyCanvas",
);

const LazyJournalEntryEditor = lazyWithRetry(
  () => import("./JournalEntryEditor").then((m) => ({ default: m.JournalEntryEditor })),
  "JournalEntryEditor",
);

const LazyJournalEntryViewer = lazyWithRetry(
  () => import("./JournalEntryViewer").then((m) => ({ default: m.JournalEntryViewer })),
  "JournalEntryViewer",
);

const LazyMemoryPortalCanvas = lazyWithRetry(
  () => import("./MemoryPortalCanvas").then((m) => ({ default: m.MemoryPortalCanvas })),
  "MemoryPortalCanvas",
);

const LazyJournalEntryList = lazyWithRetry(
  () => import("./JournalEntryList").then((m) => ({ default: m.JournalEntryList })),
  "JournalEntryList",
);

async function loadJournalSupabase(): Promise<SupabaseClient<Database> | null> {
  const { supabase } = await import("@/lib/supabaseClient");
  return supabase;
}

async function accountHasRemoteJournalData(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  const results = await Promise.all([
    client.from("journal_entries").select("id", { count: "exact", head: true }),
    client.from("journal_photos").select("id", { count: "exact", head: true }),
    client.from("journal_audio").select("id", { count: "exact", head: true }),
  ]);

  for (const result of results) {
    if (result.error) throw result.error;
    if (!Number.isSafeInteger(result.count)) {
      throw new Error("Diary cloud preflight did not return a verified row count");
    }
  }

  return results.some((result) => (result.count ?? 0) > 0);
}

type JournalPasswordResetRequest = {
  email: string;
  userId: string;
  nonce: string;
  startedAt: number;
};

const JOURNAL_PASSWORD_RESET_WINDOW_MS = 600_000;
const JOURNAL_PASSWORD_RESET_RESEND_COOLDOWN_MS = 60_000;
const JOURNAL_PASSWORD_RESET_AUTH_EVENTS = new Set(["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"]);
const JOURNAL_RESET_PROTECTED_DETAIL_EN = "Nothing changed; your entries remain protected.";

function withJournalResetProtectedDetail(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("nothing changed") || normalized.includes("entries remain protected")) {
    return message;
  }

  const isLegacyEnglishResetCopy =
    normalized.includes("this browser could not confirm the email link") ||
    normalized.includes("this email link was not confirmed") ||
    normalized.includes("encrypted with your password");

  return isLegacyEnglishResetCopy ? message + " " + JOURNAL_RESET_PROTECTED_DETAIL_EN : message;
}

function normalizeJournalResetEmail(email: string | null | undefined): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function createJournalPasswordResetNonce(): string | null {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) return null;

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getJournalAuthErrorDebugInfo(error: unknown): { code?: string; name?: string; status?: number } {
  if (!error || typeof error !== "object") return {};

  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    name: typeof record.name === "string" ? record.name : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
  };
}

function withJournalPasswordResetNonce(redirectUrl: string, nonce: string): string {
  try {
    const url = new URL(redirectUrl);
    url.searchParams.set(JOURNAL_PASSWORD_RESET_PARAM, nonce);
    return url.toString();
  } catch {
    const separator = redirectUrl.includes("?") ? "&" : "?";
    return `${redirectUrl}${separator}${JOURNAL_PASSWORD_RESET_PARAM}=${encodeURIComponent(nonce)}`;
  }
}

function buildAccountSettingsUrl(): string {
  if (typeof window === "undefined") return "/settings?nav=v2&navLayout=phone&settingsSection=account";

  try {
    const current = new URL(window.location.href);
    const base = current.pathname === "/people-first-app" || current.pathname.startsWith("/people-first-app/")
      ? "/people-first-app"
      : "";
    const params = new URLSearchParams(current.search);
    params.set("nav", "v2");
    if (!params.has("navLayout")) params.set("navLayout", "phone");
    params.set("settingsSection", "account");
    params.delete(JOURNAL_PASSWORD_RESET_PARAM);
    return `${base}/settings?${params.toString()}`;
  } catch {
    return "/settings?nav=v2&navLayout=phone&settingsSection=account";
  }
}

function dispatchNavigationPopState(): void {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  } catch {
    window.dispatchEvent(new Event("popstate"));
  }
}


function hasJournalPasswordResetProof(pending: JournalPasswordResetRequest): boolean {
  return hasStoredJournalPasswordResetProof(
    pending.nonce,
    pending.userId,
    JOURNAL_PASSWORD_RESET_WINDOW_MS,
  );
}

function serializeJournalPasswordResetRequest(email: string, userId: string, nonce: string): string {
  return JSON.stringify({
    email: normalizeJournalResetEmail(email),
    userId: userId.trim(),
    nonce,
    startedAt: Date.now(),
  } satisfies JournalPasswordResetRequest);
}

function parseJournalPasswordResetRequest(raw: string | null): JournalPasswordResetRequest | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<JournalPasswordResetRequest>;
    const email = normalizeJournalResetEmail(parsed.email);
    const userId = typeof parsed.userId === "string" ? parsed.userId.trim() : "";
    const nonce = typeof parsed.nonce === "string" ? parsed.nonce.trim() : "";
    const startedAt = Number(parsed.startedAt);
    if (!email || !userId || !nonce || !Number.isFinite(startedAt)) return null;
    return { email, userId, nonce, startedAt };
  } catch {
    return null;
  }
}

function JournalDeferredPanelFallback({
  label = "Loading...",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-[320px] flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label={label} />
    </div>
  );
}

const InertJournalMotionDiv = motion.div as ComponentType<
  ComponentProps<typeof motion.div> & { inert?: "" }
>;

function JournalMobileViewSurface({
  children,
  className,
  shouldAnimate,
  view,
}: {
  children: ReactNode;
  className: string;
  shouldAnimate: boolean;
  view: "stats" | "viewing" | "list";
}) {
  const isPresent = useIsPresent();

  return (
    <InertJournalMotionDiv
      inert={!isPresent ? "" : undefined}
      aria-hidden={!isPresent ? true : undefined}
      initial={shouldAnimate ? { opacity: 0 } : undefined}
      animate={{ opacity: 1 }}
      exit={shouldAnimate ? { opacity: 0 } : undefined}
      transition={{ duration: 0.2 }}
      className={cn(className, !isPresent && "pointer-events-none")}
      data-journal-mobile-view={view}
    >
      {children}
    </InertJournalMotionDiv>
  );
}

function JournalSettingsDeferredFallback({
  label = "Loading...",
}: {
  label?: string;
}) {
  return (
    <div
      className="space-y-4 pb-1"
      role="status"
      aria-label={label}
      data-testid="journal-settings-fallback"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="journal-settings-fallback-card rounded-[28px] border border-border/50 bg-card/65 p-5 shadow-sm backdrop-blur-sm"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary/10 motion-safe:animate-pulse" />
            <div className="min-w-0 flex-1 space-y-3 pt-1">
              <div className="h-4 w-2/5 rounded-full bg-foreground/12 motion-safe:animate-pulse" />
              <div className="h-3 w-4/5 rounded-full bg-muted-foreground/14 motion-safe:animate-pulse" />
            </div>
          </div>
          <div className="journal-settings-fallback-row mt-5 flex min-h-[44px] items-center justify-between gap-4">
            <div className="h-3 w-1/2 rounded-full bg-muted-foreground/12 motion-safe:animate-pulse" />
            <div className="h-8 w-16 rounded-full bg-primary/12 motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function JournalModalDeferredFallback({
  label = "Loading...",
}: {
  label?: string;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 dark:bg-black/40 motion-safe:animate-fade-in" />
      <div
        role="status"
        aria-live="polite"
        aria-label={label}
        className="fixed inset-x-4 top-1/2 z-[71] mx-auto flex min-h-[132px] max-w-sm -translate-y-1/2 items-center justify-center rounded-2xl bg-card p-6 shadow-xl lg:max-w-lg"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </div>
    </>
  );
}

export function JournalLoadErrorPanel({
  ts,
  onRetry,
  compact = false,
}: {
  ts: Record<string, string>;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="journal-load-error"
      className={cn(
        "rounded-2xl border border-border/50 bg-card/85 p-4 text-center text-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]",
        compact ? "mx-0" : "mx-auto max-w-md"
      )}
    >
      <AlertCircle className="mx-auto mb-2 h-5 w-5 text-primary/80 forced-colors:text-[CanvasText]" aria-hidden="true" />
      <h3 className="text-sm font-bold text-foreground forced-colors:text-[CanvasText]">
        {ts.journalLoadFailed || "Diary needs another moment to load"}
      </h3>
      <p className="mx-auto mt-1 max-w-[280px] text-xs leading-relaxed text-muted-foreground forced-colors:text-[CanvasText]">
        {ts.journalLoadFailedHint || "This load attempt did not change your entries. Try loading again."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-border/55 bg-background/80 px-4 text-xs font-bold text-foreground shadow-sm motion-safe:transition-[background-color,border-color,color,transform] hover:bg-muted/65 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 forced-colors:border-[ButtonText] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]"
      >
        {ts.journalRetryLoad || "Retry loading"}
      </button>
    </div>
  );
}

export function JournalBackgroundLoadNotice({
  ts,
  onRetry,
}: {
  ts: Record<string, string>;
  onRetry: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="journal-background-load-notice"
      className="mb-3 rounded-2xl border border-border/50 bg-card/80 p-3 text-start text-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {ts.journalHistoryLoadFailed || "Some older entries are not available yet"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {ts.journalHistoryLoadFailedHint || "The entries shown are safe. Try again to load the rest."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-border/55 bg-background/80 px-3 text-xs font-bold text-foreground motion-safe:transition-colors hover:bg-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            {ts.journalRetryHistory || "Try older entries again"}
          </button>
        </div>
      </div>
    </div>
  );
}

function JournalCompactEmptyListShell({
  ts,
}: {
  ts: Record<string, string>;
}) {
  return (
    <div className="pb-4" data-testid="journal-compact-empty-list">
      <div className="flex min-h-[44px] items-center gap-2 px-2 text-sm text-muted-foreground">
        <PenLine className="h-4 w-4 shrink-0 text-primary/75" aria-hidden="true" />
        <p>{ts.journalEmpty || "No diary entries yet"}</p>
      </div>
    </div>
  );
}

export function JournalFavoritesPanel({
  entries,
  onOpenEntry,
  onNewEntry,
  privateMode,
  language,
  historyLoading,
  historyLoadError,
  onRetryHistory,
  ts,
}: {
  entries: JournalEntry[];
  onOpenEntry: (entryId: string) => void;
  onNewEntry: () => void;
  privateMode: boolean;
  language: Parameters<typeof formatJournalCivilDate>[1];
  historyLoading: boolean;
  historyLoadError: boolean;
  onRetryHistory: () => void;
  ts: Record<string, string>;
}) {
  const favorites = entries.filter(isFavoriteJournalEntry);
  const visibleFavorites = privateMode ? favorites.slice(0, 1) : favorites;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 lg:px-8"
      aria-label={ts.journalFavorites || "Favorites"}
      data-testid="journal-favorites-panel"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4">
        <div className="flex items-center gap-3 rounded-[28px] border border-border/35 bg-card/65 p-4 shadow-[0_18px_55px_hsl(var(--foreground)/0.07)] backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Star className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-foreground">
              {ts.journalFavorites || "Favorites"}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {ts.journalFavoritesEmptyHint || "Use the star on an entry to keep it here."}
            </p>
          </div>
        </div>

        {favorites.length === 0 && historyLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[240px] flex-1 flex-col items-center justify-center rounded-[28px] border border-border/35 bg-background/55 p-6 text-center"
          >
            <Loader2 className="mb-3 h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-muted-foreground">
              {ts.journalHistoryLoadPending || "Loading older diary entries…"}
            </p>
          </div>
        ) : favorites.length === 0 && historyLoadError ? (
          <div className="flex min-h-[240px] flex-1 items-center justify-center">
            <JournalBackgroundLoadNotice ts={ts} onRetry={onRetryHistory} />
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-border/45 bg-background/55 p-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary">
              <Star className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {ts.journalFavoritesEmptyTitle || "No favorites yet"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {ts.journalFavoritesEmptyHint || "Use the star on an entry to keep it here."}
            </p>
            <button
              type="button"
              onClick={onNewEntry}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_14px_34px_hsl(var(--primary)/0.20)] motion-safe:transition-transform active:scale-[0.98]"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              {ts.journalNewEntry || "Write first entry"}
            </button>
          </div>
        ) : (
          <>
            {historyLoadError ? (
              <JournalBackgroundLoadNotice ts={ts} onRetry={onRetryHistory} />
            ) : historyLoading ? (
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {ts.journalHistoryLoadPending || "Loading older diary entries…"}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleFavorites.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-disabled={privateMode || undefined}
                onClick={() => {
                  if (privateMode) return;
                  onOpenEntry(entry.id);
                }}
                className={cn(
                  "min-h-[120px] rounded-[24px] border border-border/35 bg-card/70 p-4 text-start shadow-[0_12px_34px_hsl(var(--foreground)/0.06)] backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)] motion-safe:transition-[transform,border-color,box-shadow] active:scale-[0.99]",
                  privateMode && "cursor-default",
                  !privateMode && "hover:border-primary/30 hover:shadow-[0_18px_48px_hsl(var(--primary)/0.12)]",
                )}
              >
                {privateMode ? (
                  <>
                    <span className="block whitespace-normal break-words text-base font-bold text-foreground">
                      {ts.journalPrivateEntry || ts.privateMode || "Private entry"}
                    </span>
                    <span className="mt-2 block whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
                      {ts.journalPrivateEntryHint || "Unlock private mode to view this memory."}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary/75">
                      {formatJournalCivilDate(entry.date, language, "short")}
                    </span>
                    <span className="mt-2 block whitespace-normal break-words text-base font-bold text-foreground">
                      {entry.title || ts.journalEntryTitle || "Entry"}
                    </span>
                    <span className="mt-2 block line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {getJournalPreviewText(entry.content, ts) || ts.journalEmptyHint || "A quiet saved moment."}
                    </span>
                  </>
                )}
              </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

type ModuleState = "card" | "open";

interface JournalModuleProps {
  onToggleHabit?: (habitId: string, date: string) => void;
  onAddGratitude?: (entry: import("@/types").GratitudeEntry) => void;
  startOpen?: boolean;
  disableCardShell?: boolean;
  hideCloseButton?: boolean;
  presentation?: "dialog" | "page";
  initialEntrySuggestion?: JournalEntrySuggestion | null;
  extraSuggestions?: JournalEntrySuggestion[];
  listHeaderContent?: ReactNode;
  onInitialEntrySuggestionConsumed?: () => void;
  autoCreateInitialEntry?: boolean;
  loadingTheme?: SplashThemePreference;
  onOpenNavMenu?: () => void;
  navMenuOpen?: boolean;
  showAppNavMenu?: boolean;
  rewardsEnabled?: boolean;
}

const JOURNAL_SIDEBAR_PANEL_ID = "journal-sidebar-panel";
const JournalMenuIcon = V2_SHELL_ICONS.menu;

interface JournalPrivateModeState {
  enabled: boolean;
  persistenceError: boolean;
}

function readJournalPrivateModeState(): JournalPrivateModeState {
  const stored = storageReadRaw(SK.JOURNAL_PRIVATE_MODE);
  if (!stored.ok) return { enabled: true, persistenceError: true };
  if (stored.value === null || stored.value === "false") {
    return { enabled: false, persistenceError: false };
  }
  if (stored.value === "true") return { enabled: true, persistenceError: false };
  return { enabled: true, persistenceError: true };
}

export const JournalModule = memo(function JournalModule({
  onToggleHabit,
  onAddGratitude,
  startOpen = false,
  disableCardShell = false,
  hideCloseButton = false,
  presentation = "dialog",
  initialEntrySuggestion = null,
  extraSuggestions = [],
  listHeaderContent,
  onInitialEntrySuggestionConsumed,
  autoCreateInitialEntry = false,
  loadingTheme = "auto",
  onOpenNavMenu,
  navMenuOpen = false,
  showAppNavMenu = false,
  rewardsEnabled = true,
}: JournalModuleProps = {}) {
  const { t, isRTL, language } = useLanguage();
  const today = useJournalToday();
  const ts = t as unknown as Record<string, string>;
  const isPagePresentation = presentation === "page";
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const showJournalLightAtmosphere =
    isPagePresentation && appliedTheme === "paper";
  const showJournalSidebarAtmosphere = isPagePresentation;
  const mobileHeaderMenuClass =
    "flex h-[48px] w-[48px] shrink-0 touch-manipulation items-center justify-center rounded-full border border-border/50 bg-card/70 p-0 text-foreground/90 shadow-[0_14px_34px_hsl(var(--foreground)/0.16)] backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] motion-safe:transition-[transform,background-color,border-color,color,box-shadow] motion-safe:duration-200 motion-safe:ease-out hover:bg-card/85 active:scale-95 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  const mobileHeaderActionClass =
    "press-stable flex h-[48px] w-[48px] shrink-0 touch-manipulation items-center justify-center rounded-xl p-0 text-muted-foreground motion-safe:transition-[background-color,color,box-shadow] motion-safe:duration-150 hover:bg-muted/50 hover:text-foreground active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45";
  const mobileHeaderTabClass =
    "press-stable flex min-h-[48px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl p-0 text-muted-foreground motion-safe:transition-[background-color,color,box-shadow] motion-safe:duration-150 hover:bg-muted/50 hover:text-foreground active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45";
  const rewardUser = useGamificationStore((s) => s.rewardUser);
  const moodEntries = useUserDataStore((s) => s.moods);
  const [moduleState, setModuleState] = useState<ModuleState>(
    startOpen || disableCardShell || isPagePresentation ? "open" : "card"
  );
  const [entryCount, setEntryCount] = useState(0);
  const [showPasswordSettings, setShowPasswordSettings] = useState(false);
  const [showMobileDiarySidebar, setShowMobileDiarySidebar] = useState(false);
  const [diaryTabSection, setDiaryTabSection] = useState<DiarySidebarSection>("entry");
  const [settingsSection, setSettingsSection] = useState<JournalSettingsSection>("overview");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [calendarMode, setCalendarMode] = useState<"strip" | "full">(() => {
    return storageGetRaw(SK.JOURNAL_CALENDAR_MODE, "strip") as "strip" | "full";
  });
  const [privateModeState, setPrivateModeState] = useState(readJournalPrivateModeState);
  const privateMode = privateModeState.enabled;
  const saveCeremonyMotionAllowed = useShouldAnimate();
  const saveCeremonyMotionAllowedRef = useRef(saveCeremonyMotionAllowed);
  saveCeremonyMotionAllowedRef.current = saveCeremonyMotionAllowed;

  const [showExportPicker, setShowExportPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
type ResetStep =
    | "idle"
    | "checking"
    | "no-account"
    | "service-error"
    | "unavailable"
    | "confirm"
    | "sending"
    | "sent"
    | "success";
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOwnerUserId, setResetOwnerUserId] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetResendRemaining, setResetResendRemaining] = useState(0);
  const lastResetOtpRef = useRef(0);
  const resetRequestSeqRef = useRef(0);
  const resetSendInFlightRef = useRef(false);
  const resetConsumeFlightRef = useRef<{ nonce: string; promise: Promise<boolean> } | null>(null);
  const resetDialogRef = useRef<HTMLDivElement | null>(null);
  const resetCancelRef = useRef<HTMLButtonElement | null>(null);
  const resetTitleId = useId();
  const resetDescriptionId = useId();
  const resetErrorId = useId();
  const desktopSettingsBusyStatusId = useId();
  const mobileSettingsBusyStatusId = useId();
  const resetEncryptedUnavailableMessage = withJournalResetProtectedDetail(
    ts.journalResetEncryptedUnavailable ||
      "This diary is encrypted with your password. Email verification cannot remove this lock while encrypted content is locked. Nothing changed; your entries remain protected. Unlock with your password to remove it.",
  );
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [pendingJournalImport, setPendingJournalImport] = useState<{
    file: File;
    inspection: JournalImportInspection;
  } | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [showRemovePasswordConfirm, setShowRemovePasswordConfirm] = useState(false);
  const [removePasswordSubmitting, setRemovePasswordSubmitting] = useState(false);
  const [celebratingStreak, setCelebratingStreak] = useState<number | null>(null);
  const [saveCeremonyPresentation, setSaveCeremonyPresentation] =
    useState<JournalSaveCeremonyPresentation | null>(null);
  const saveCeremonyPreloadRequestedRef = useRef(false);
  const saveCeremonyPreloadHandleRef =
    useRef<ReturnType<typeof scheduleIdle> | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [favoriteMutationPending, setFavoriteMutationPending] = useState(false);
  const favoriteMutationPendingRef = useRef(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const [deferredInitialSuggestionKey, setDeferredInitialSuggestionKey] = useState<string | null>(null);
  const {
    sidebarState,
    setSidebarState,
    toggleSidebar,
    isExpanded,
    isCollapsed,
  } = useSidebarState();
  const initialSuggestionConsumedRef = useRef(false);
  const initialSuggestionRef = useRef<JournalEntrySuggestion | null>(initialEntrySuggestion);
  const currentInitialSuggestionKey = initialEntrySuggestion
    ? getSuggestionDismissKey(initialEntrySuggestion)
    : null;
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null);
  const getPasswordRemovalFocusFallback = useCallback(
    () => document.querySelector<HTMLElement>('[data-testid="journal-password-setup-action"]'),
    [],
  );
  const settingsReturnTabRef = useRef<DiarySidebarSection>("entry");
  const editorSettingsRequestRef = useRef<(() => void) | null>(null);
  const editorExitRequestRef = useRef<(() => void) | null>(null);
  const pendingEditorExitActionRef = useRef<(() => void) | null>(null);

  if (initialEntrySuggestion && !initialSuggestionConsumedRef.current) {
    initialSuggestionRef.current = initialEntrySuggestion;
  }
  useSidebarKeyboard(sidebarState, toggleSidebar, setSidebarState);

  const handleEditorDirtyStateChange = useCallback((dirty: boolean) => {
    if (
      !ENABLE_JOURNAL_SAVE_CEREMONY ||
      !dirty ||
      !saveCeremonyMotionAllowed ||
      saveCeremonyPreloadRequestedRef.current
    ) {
      return;
    }
    saveCeremonyPreloadRequestedRef.current = true;
    saveCeremonyPreloadHandleRef.current = scheduleIdle(() => {
      saveCeremonyPreloadHandleRef.current = null;
      if (!saveCeremonyMotionAllowedRef.current) {
        saveCeremonyPreloadRequestedRef.current = false;
        return;
      }
      void preloadJournalSaveCeremonyRuntime().catch(() => {
        logger.warn("[JournalSaveCeremony] idle preload unavailable", {
          code: "journal_save_ceremony_preload_error",
        });
      });
    });
  }, [saveCeremonyMotionAllowed]);

  useEffect(() => {
    if (saveCeremonyMotionAllowed) return;
    saveCeremonyPreloadHandleRef.current?.cancel();
    saveCeremonyPreloadHandleRef.current = null;
    saveCeremonyPreloadRequestedRef.current = false;
  }, [saveCeremonyMotionAllowed]);

  useEffect(
    () => () => {
      saveCeremonyPreloadHandleRef.current?.cancel();
      saveCeremonyPreloadHandleRef.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!ENABLE_JOURNAL_SAVE_CEREMONY) return;

    const markActive = () => markJournalSaveCeremonyLifecycleActive();
    const invalidate = () => invalidateJournalSaveCeremonyLifecycle();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") invalidate();
      else markActive();
    };
    const handlePageShow = () => {
      if (document.visibilityState !== "hidden") markActive();
    };

    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", invalidate);
    window.addEventListener("pageshow", handlePageShow);
    if (IS_DESKTOP_RUNTIME) {
      window.addEventListener("blur", invalidate);
      window.addEventListener("focus", markActive);
    }

    let disposed = false;
    let nativeHandle: { remove: () => Promise<void> } | null = null;
    if (isNative) {
      void import("@capacitor/app")
        .then(async ({ App }) => {
          const state = await App.getState();
          if (disposed) return;
          if (state.isActive) markActive();
          else invalidate();
          nativeHandle = await App.addListener(
            "appStateChange",
            ({ isActive }) => {
              if (isActive) markActive();
              else invalidate();
            },
          );
          if (disposed) {
            await nativeHandle.remove();
            nativeHandle = null;
          }
        })
        .catch(() => {
          if (disposed) return;
          logger.warn("[JournalSaveCeremony] native lifecycle unavailable", {
            code: "journal_save_ceremony_native_lifecycle_error",
            platform,
          });
          invalidate();
        });
    }

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", invalidate);
      window.removeEventListener("pageshow", handlePageShow);
      if (IS_DESKTOP_RUNTIME) {
        window.removeEventListener("blur", invalidate);
        window.removeEventListener("focus", markActive);
      }
      void nativeHandle?.remove().catch(() => {
        logger.warn("[JournalSaveCeremony] native lifecycle cleanup unavailable", {
          code: "journal_save_ceremony_native_lifecycle_cleanup_error",
          platform,
        });
      });
      invalidate();
    };
  }, []);
  // ? key → show keyboard shortcuts overlay
  useEffect(() => {
    if (moduleState !== "open") return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        setShowShortcuts((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [moduleState]);
  const reducedMotion = useReducedMotion();
  const isLgScreen = useMediaQuery("(min-width: 1024px)");
  const isEmailLockRemovalAvailable = !IS_DESKTOP_RUNTIME;
  const isDiaryDesktopLayout = useMediaQuery("(min-width: 1280px)");
  const entryTransition = useEntryTransition();
  const onboarding = useJournalOnboarding();
  const security = useJournalSecurity();
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const mobileDiarySidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDiarySidebarCloseRef = useRef<HTMLButtonElement>(null);
  const mobileDiarySidebarRef = useRef<HTMLElement | null>(null);
  const mobileSettingsPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileSettingsCloseRef = useRef<HTMLButtonElement>(null);
  const isSidebarCollapsed = isCollapsed;
  const closeMobileDiarySidebar = useCallback((restoreFocus = true) => {
    setShowMobileDiarySidebar(false);
    if (restoreFocus) {
      mobileDiarySidebarTriggerRef.current?.focus({ preventScroll: true });
      requestAnimationFrame(() => mobileDiarySidebarTriggerRef.current?.focus({ preventScroll: true }));
    }
  }, []);

  useBackHandler(showExportPicker, () => {
    if (!exporting) setShowExportPicker(false);
  });
  useBackHandler(showMobileDiarySidebar, closeMobileDiarySidebar);

  const settingsDismissBlocked = settingsBusy || importing || removePasswordSubmitting;

  const closeSettings = useCallback((restoreFocus = true): boolean => {
    if (settingsDismissBlocked) return false;
    if (settingsSection !== "overview") {
      if (restoreFocus) {
        setSettingsSection("overview");
        return false;
      }
    }

    setShowPasswordSettings(false);
    setDiaryTabSection(settingsReturnTabRef.current === "settings" ? "entry" : settingsReturnTabRef.current);
    setSettingsSection("overview");

    if (!restoreFocus) return true;
    settingsReturnFocusRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => settingsReturnFocusRef.current?.focus({ preventScroll: true }));
    return true;
  }, [settingsDismissBlocked, settingsSection]);

  const checkLocalEmailLockRemovalAvailable = useCallback(async () => {
    if (!isEmailLockRemovalAvailable) return false;
    if (security.vaultKey) return true;

    try {
      const encryptedState = await Promise.all([
        hasEncryptedJournalContent(),
        hasEncryptedJournalMedia(),
        hasEncryptedJournalDrafts(),
        hasEncryptedJournalHubContent(),
      ]);
      return encryptedState.every((isEncrypted) => !isEncrypted);
    } catch (error) {
      logger.warn("[Journal] Email lock removal availability check failed:", error);
      return false;
    }
  }, [isEmailLockRemovalAvailable, security.vaultKey]);

  const checkEmailLockRemovalAvailable = useCallback(async (
    suppliedClient?: SupabaseClient<Database>,
  ) => {
    if (!(await checkLocalEmailLockRemovalAvailable())) return false;
    if (security.vaultKey) return true;

    const client = suppliedClient ?? await loadJournalSupabase();
    if (!client) return false;
    return !(await accountHasRemoteJournalData(client));
  }, [checkLocalEmailLockRemovalAvailable, security.vaultKey]);

  const closeResetDialog = useCallback(() => {
    resetRequestSeqRef.current += 1;
    if (resetSendInFlightRef.current) {
      resetSendInFlightRef.current = false;
      storageRemove(SK.JOURNAL_PASSWORD_RESET);
      clearJournalPasswordResetProof();
    }
    setResetStep("idle");
    setResetEmail("");
    setResetOwnerUserId("");
    setResetError("");
  }, []);

  const handleOpenAccountSettings = useCallback(() => {
    closeResetDialog();
    if (typeof window === "undefined") return;

    const nextUrl = buildAccountSettingsUrl();
    window.history.pushState({ navV2Page: "settings" }, "", nextUrl);
    dispatchNavigationPopState();
  }, [closeResetDialog]);

  const updateResetResendRemaining = useCallback((now = Date.now()) => {
    const nextAllowedAt = lastResetOtpRef.current + JOURNAL_PASSWORD_RESET_RESEND_COOLDOWN_MS;
    const remaining = Math.max(0, Math.ceil((nextAllowedAt - now) / 1000));
    setResetResendRemaining(remaining);
    return remaining;
  }, []);

  const openSettings = useCallback((
    section: JournalSettingsSection = "overview",
    returnFocusElement?: HTMLElement | null,
  ) => {
    settingsReturnFocusRef.current = returnFocusElement ?? (
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    );
    settingsReturnTabRef.current = diaryTabSection === "settings" ? settingsReturnTabRef.current : diaryTabSection;
    setShowMobileDiarySidebar(false);
    setDiaryTabSection("settings");
    setSettingsSection(section);
    setShowPasswordSettings(true);
  }, [diaryTabSection]);

  // Consolidated Escape key handler for inline sub-dialogs (password, export, remove-confirm)
  useEffect(() => {
    const activeDialog = resetStep !== "idle"
      ? "reset"
      : showRemovePasswordConfirm
      ? "remove"
      : showExportPicker
        ? "export"
        : showPasswordSettings
          ? "password"
          : showMobileDiarySidebar
            ? "mobile-sidebar"
            : null;
    if (!activeDialog) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (activeDialog === "reset") {
        closeResetDialog();
      } else if (activeDialog === "password") {
        closeSettings();
      } else if (activeDialog === "export") {
        if (exporting) return;
        setShowExportPicker(false);
      } else if (activeDialog === "remove") {
        if (removePasswordSubmitting) return;
        setShowRemovePasswordConfirm(false);
      } else if (activeDialog === "mobile-sidebar") {
        closeMobileDiarySidebar();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [
    closeSettings,
    closeMobileDiarySidebar,
    resetStep,
    showPasswordSettings,
    showExportPicker,
    showRemovePasswordConfirm,
    showMobileDiarySidebar,
    exporting,
    removePasswordSubmitting,
    closeResetDialog,
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFeedbackTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const importRequestSeqRef = useRef(0);

  useEffect(() => {
    if (!showMobileDiarySidebar) return;
    mobileDiarySidebarCloseRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => mobileDiarySidebarCloseRef.current?.focus({ preventScroll: true }));
  }, [showMobileDiarySidebar]);

  useEffect(() => {
    if (!showMobileDiarySidebar || !mobileDiarySidebarRef.current) return;

    const drawer = mobileDiarySidebarRef.current;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements(drawer);
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus({ preventScroll: true });
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus({ preventScroll: true });
      }
    };

    drawer.addEventListener("keydown", handleKeyDown);
    return () => drawer.removeEventListener("keydown", handleKeyDown);
  }, [showMobileDiarySidebar]);

  useEffect(() => {
    if (!showPasswordSettings || isDiaryDesktopLayout) return;
    mobileSettingsCloseRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => mobileSettingsCloseRef.current?.focus({ preventScroll: true }));
  }, [isDiaryDesktopLayout, showPasswordSettings]);

  useEffect(() => {
    if (
      !showPasswordSettings ||
      isDiaryDesktopLayout ||
      showRemovePasswordConfirm ||
      !mobileSettingsPanelRef.current
    ) return;

    const panel = mobileSettingsPanelRef.current;
    const restoreFocusToPanel = () => {
      mobileSettingsCloseRef.current?.focus({ preventScroll: true });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements(panel);
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus({ preventScroll: true });
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus({ preventScroll: true });
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && panel.contains(event.target)) return;
      restoreFocusToPanel();
    };

    panel.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      panel.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [isDiaryDesktopLayout, showPasswordSettings, showRemovePasswordConfirm]);

  const journal = useJournal();
  const [mobileEditorSurfacePresent, setMobileEditorSurfacePresent] =
    useState(false);
  useEffect(() => {
    if (isDiaryDesktopLayout) {
      setMobileEditorSurfacePresent(false);
    } else if (journal.view === "editing") {
      setMobileEditorSurfacePresent(true);
    }
  }, [isDiaryDesktopLayout, journal.view]);
  const handleMobileEditorExitComplete = useCallback(() => {
    if (journal.view !== "editing") {
      setMobileEditorSurfacePresent(false);
    }
  }, [journal.view]);
  const [releaseTraceSummaries, setReleaseTraceSummaries] = useState<Map<string, JournalReleaseTraceSummary>>(
    () => new Map(),
  );
  const handleModuleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    security.touch();
    if (event.key !== "Escape" || !showMobileDiarySidebar) return;

    event.preventDefault();
    event.stopPropagation();
    closeMobileDiarySidebar();
  }, [closeMobileDiarySidebar, security, showMobileDiarySidebar]);
  const refreshJournalRef = useRef(journal.refresh);
  useEffect(() => {
    refreshJournalRef.current = journal.refresh;
  }, [journal.refresh]);
  const reminder = useJournalReminder({
    reminderTitle: ts.journalReminderNotifTitle || "Time to Write",
    reminderBody:
      ts.journalReminderNotifBody || "Take a moment to capture your thoughts and feelings.",
  });
  const screenSecurity = useScreenSecurity(moduleState === "open");

  useEffect(() => {
    if (security.loading || security.isLocked) return;
    void refreshJournalRef.current();
  }, [security.isLocked, security.loading, security.vaultKey]);

  const releaseTraceDates = useMemo(() => {
    const dates = new Map<string, number>();
    releaseTraceSummaries.forEach((summary, date) => {
      if (summary.count > 0) dates.set(date, summary.count);
    });
    return dates;
  }, [releaseTraceSummaries]);

  useEffect(() => {
    let cancelled = false;
    const handle = scheduleIdle(
      () => {
        void getQuietReleaseTraceSummaries()
          .then((summaries) => {
            if (!cancelled) setReleaseTraceSummaries(summaries);
          })
          .catch((error) => {
            logger.warn("[Journal] Failed to load quiet release traces", error);
          });
      },
      9000,
      5200,
    );
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, []);

  const handleReleaseThought = useCallback(async () => {
    try {
      const session = await createQuietReleaseSession({ durationSeconds: 4 });
      const timestamp = session.completedAt ?? session.startedAt;
      const date = formatDate(new Date(timestamp));
      setReleaseTraceSummaries((current) => {
        const next = new Map(current);
        const existing = next.get(date);
        next.set(date, {
          date,
          count: (existing?.count ?? 0) + 1,
          latestAt: Math.max(existing?.latestAt ?? 0, timestamp),
        });
        return next;
      });
    } catch (error) {
      logger.error("[Journal] Failed to store quiet release trace", error);
      throw error;
    }
  }, []);

  const handleAddGratitudeWithSpace = useCallback(
    async (entry: import("@/types").GratitudeEntry) => {
      await Promise.resolve(onAddGratitude?.(entry));
      try {
        await createGratitudeSpaceCapture(entry);
      } catch (error) {
        logger.warn("[Journal] Failed to save gratitude space capture", error);
      }
    },
    [onAddGratitude],
  );

  // Durable undo state: storage keeps only id + expiry; private content remains in journalEntries.
  type PendingDelete = PendingJournalEntryDelete & {
    id: string;
    entry: (typeof journal.entries)[0];
  };
  const [pendingDeletes, setPendingDeletes] = useState<PendingDelete[]>([]);
  const pendingDelete = pendingDeletes[0] ?? null;
  const [deleteCommitMessage, setDeleteCommitMessage] = useState<string | null>(null);
  const deleteTimerAbortRef = useRef<AbortController>();
  const deleteFeedbackTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isMountedRef = useRef(true);
  const pendingDeleteRef = useRef<PendingDelete[]>(pendingDeletes);
  const pendingDeleteHydratedRef = useRef(false);
  const pendingDeleteStageIdsRef = useRef(new Set<string>());
  useEffect(() => {
    pendingDeleteRef.current = pendingDeletes;
  }, [pendingDeletes]);
  useEffect(
    () => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        deleteTimerAbortRef.current?.abort();
        clearTimeout(deleteFeedbackTimerRef.current);
        clearTimeout(importFeedbackTimerRef.current);
        importRequestSeqRef.current += 1;
      };
    },
    []
  );

  useEffect(() => {
    if (journal.loading) {
      pendingDeleteHydratedRef.current = false;
      return;
    }
    if (pendingDeleteHydratedRef.current) return;
    pendingDeleteHydratedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const markers = await getPendingJournalEntryDeletes();
        const hydrated = await Promise.all(
          markers.map(async (marker) => {
            const entry = await getEntryById(marker.id);
            return entry ? { ...marker, entry } : null;
          }),
        );
        if (cancelled || !isMountedRef.current) return;
        const pending = hydrated.filter((item): item is PendingDelete => item !== null);
        const missingIds = markers
          .filter((marker) => !pending.some((item) => item.id === marker.id))
          .map((marker) => marker.id);
        if (missingIds.length > 0) {
          await cancelPendingJournalEntryDeletes(missingIds);
        }
        if (cancelled || !isMountedRef.current) return;
        if (pending.length === 0 && pendingDeleteRef.current.length === 0) return;
        pendingDeleteRef.current = pending;
        setPendingDeletes(pending);
      } catch (error) {
        logger.warn("[Journal] Failed to restore pending delete window", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [journal.loading]);

  const showImportFeedback = useCallback(
    (feedback: { type: "success" | "error"; message: string }) => {
      if (!isMountedRef.current) return;
      clearTimeout(importFeedbackTimerRef.current);
      setImportFeedback(feedback);
      importFeedbackTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setImportFeedback(null);
      }, 5000);
    },
    [],
  );

  const handleJournalImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || importing) return;

      const requestSeq = ++importRequestSeqRef.current;
      clearTimeout(importFeedbackTimerRef.current);
      setImportFeedback(null);
      setImporting(true);

      try {
        const { inspectJournalBackup } = await import("./journalImport");
        const inspection = await inspectJournalBackup(file);
        if (requestSeq !== importRequestSeqRef.current || !isMountedRef.current) return;
        if (!inspection.canImport) {
          const message = ts.journalImportFailed || "Import failed";
          showImportFeedback({ type: "error", message });
          announceError(message);
          return;
        }
        setPendingJournalImport({ file, inspection });
      } catch (error) {
        logger.warn("[Journal] Backup inspection failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        if (requestSeq !== importRequestSeqRef.current || !isMountedRef.current) return;
        const message = ts.journalImportFailed || "Import failed";
        showImportFeedback({ type: "error", message });
        announceError(message);
      } finally {
        if (requestSeq === importRequestSeqRef.current && isMountedRef.current) {
          setImporting(false);
        }
      }
    },
    [importing, showImportFeedback, ts],
  );

  const handleConfirmJournalImport = useCallback(async () => {
    if (!pendingJournalImport || importing) return;

    const requestSeq = ++importRequestSeqRef.current;
    const { file } = pendingJournalImport;
    setImportFeedback(null);
    setImporting(true);

    try {
      const { importJournalBackup } = await import("./journalImport");
      const result = await importJournalBackup(file);
      if (requestSeq !== importRequestSeqRef.current || !isMountedRef.current) return;

      await journal.refresh();
      const importedLabel = formatLocalizedCount(
        result.imported,
        language,
        ts,
        "journalEntryCount",
        ts.journalImportEntries || "entries",
      );
      const skippedLabel =
        result.skipped > 0
          ? `, ${ts.importSkipped || "skipped"}: ${new Intl.NumberFormat(language).format(result.skipped)}`
          : "";
      const deletedLabel =
        result.deleted > 0
          ? `, ${ts.journalImportRemoved || "removed"}: ${new Intl.NumberFormat(language).format(result.deleted)}`
          : "";
      const syncPendingLabel = result.syncPending
        ? `. ${ts.journalImportSyncPending || "Saved on this device; sync will retry automatically."}`
        : "";

      if (result.errors.length > 0) {
        const errorLabel = formatLocalizedCount(
          result.errors.length,
          language,
          ts,
          "journalImportErrorCount",
          ts.journalImportErrors || "errors",
        );
        const message = `${ts.journalImportPartial || "Imported with errors"}: ${importedLabel}${skippedLabel}${deletedLabel}, ${errorLabel}${syncPendingLabel}`;
        showImportFeedback({ type: "error", message });
        announceError(message);
      } else {
        const message = `${ts.journalImportSuccess || "Import complete"}: ${importedLabel}${skippedLabel}${deletedLabel}${syncPendingLabel}`;
        showImportFeedback({ type: "success", message });
        announceSuccess(message);
      }
      setPendingJournalImport(null);
    } catch (error) {
      logger.warn("[Journal] Backup import failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      if (requestSeq !== importRequestSeqRef.current || !isMountedRef.current) return;
      const message = ts.journalImportFailed || "Import failed";
      showImportFeedback({ type: "error", message });
      announceError(message);
    } finally {
      if (requestSeq === importRequestSeqRef.current && isMountedRef.current) {
        setImporting(false);
      }
    }
  }, [importing, journal, language, pendingJournalImport, showImportFeedback, ts]);

  // Streak calculation from all entry dates
  const streak = useMemo(() => {
    const allDates = [...journal.entryDates.keys()].sort().reverse();
    if (allDates.length === 0) return 0;
    const yesterdayStr = shiftJournalDate(today, -1);
    if (allDates[0] !== today && allDates[0] !== yesterdayStr) return 0;
    let count = 1;
    for (let i = 1; i < allDates.length; i++) {
      if (isNextJournalDate(allDates[i], allDates[i - 1])) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [journal.entryDates, today]);


  const lastEntryDate = useMemo(() => {
    const dates = [...journal.entryDates.keys()].sort().reverse();
    return dates[0] ?? null;
  }, [journal.entryDates]);
  const streakFreeze = useStreakFreeze(streak, lastEntryDate, today);

  const daysSinceLastEntry = useMemo(
    () => getDaysSinceLastEntry(journal.entryDates, today),
    [journal.entryDates, today]
  );

  const todayMood = useMemo(() => journal.entryDates.get(today), [journal.entryDates, today]);

  const hasTodayEntry = useMemo(() => journal.entryDates.has(today), [journal.entryDates, today]);

  // --- CALLBACKS (declare BEFORE hooks that reference them — prevents TDZ in production builds) ---
  const overlayRef = useRef<HTMLDivElement>(null);
  /** Tracks how the editor was opened: "fab" = FAB button, "card" = entry card tap */
  const entryModeRef = useRef<"fab" | "card">("card");
  const [portalEntryPrefill, setPortalEntryPrefill] = useState<JournalEntryPrefill | null>(null);
  // Tracked timers for entry transitions — cleared on unmount/cancel to prevent setState-after-unmount leaks
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    },
    []
  );

  const handleOpen = () => {
    setDeferredInitialSuggestionKey(null);
    setModuleState("open");
  };

  const handleClose = () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    entryTransition.cancelTransition();
    journal.goBack();
    if (!disableCardShell) {
      setModuleState("card");
      security.lock();
    }
  };

  const getActiveDraftDate = useCallback(() => journal.selectedDate ?? today, [journal.selectedDate, today]);

  const requestEditorExit = useCallback(
    (action: () => void) => {
      if (journal.view !== "editing") {
        action();
        return;
      }

      const requestExit = editorExitRequestRef.current;
      if (!requestExit) {
        logger.warn("[Journal] Editor exit request was unavailable while editing");
        return;
      }

      pendingEditorExitActionRef.current = action;
      requestExit();
    },
    [journal.view]
  );

  const handleNewEntry = useCallback(() => {
    entryModeRef.current = "fab";
    setPortalEntryPrefill({ date: getActiveDraftDate() });
    journal.editEntry(null);
  }, [getActiveDraftDate, journal]);

  useEffect(() => {
    const openEditor = () => {
      requestEditorExit(handleNewEntry);
    };

    if (consumePendingDiaryEditorOpen()) {
      requestEditorExit(handleNewEntry);
    }

    return subscribeToDiaryEditorOpen(openEditor);
  }, [handleNewEntry, requestEditorExit]);

  const handleNewEntryWithPrefill = useCallback(
    (prefill: JournalEntryPrefill) => {
      entryModeRef.current = "fab";
      setPortalEntryPrefill({
        ...prefill,
        date: prefill.date ?? getActiveDraftDate(),
      });
      journal.editEntry(null);
    },
    [getActiveDraftDate, journal]
  );

  const handleUseInitialEntrySuggestion = useCallback(() => {
    const suggestion = initialSuggestionRef.current;
    if (!suggestion) return;
    setDeferredInitialSuggestionKey(null);
    initialSuggestionConsumedRef.current = true;
    handleNewEntryWithPrefill(suggestion.prefill);
    onInitialEntrySuggestionConsumed?.();
  }, [handleNewEntryWithPrefill, onInitialEntrySuggestionConsumed]);

  const handleDismissInitialEntrySuggestion = useCallback(() => {
    const suggestion = initialSuggestionRef.current;
    if (!suggestion) return;
    setDeferredInitialSuggestionKey(getSuggestionDismissKey(suggestion));
  }, []);

  useEffect(() => {
    if (!autoCreateInitialEntry) return;
    if (journal.loading || journal.view !== "list") return;
    if (!initialSuggestionRef.current || initialSuggestionConsumedRef.current) return;

    const suggestion = initialSuggestionRef.current;
    initialSuggestionConsumedRef.current = true;
    initialSuggestionRef.current = null;
    void journal
      .createEntry({
        title: suggestion.prefill.title || "",
        content: suggestion.prefill.content || "",
        stickers: [],
        photoIds: [],
        audioIds: [],
        mood: suggestion.prefill.mood,
        tags: suggestion.prefill.tags || [],
        date: suggestion.prefill.date,
      })
      .then(async (entry) => {
        const spaceIds = getPrefillSpaceIds(suggestion.prefill);
        if (spaceIds.length > 0) {
          await Promise.all(spaceIds.map((spaceId) => linkEntryToSpace(entry.id, spaceId)));
        }
        onInitialEntrySuggestionConsumed?.();
        try {
          triggerSync();
        } catch {
          /* graceful: cloud sync is secondary; data already saved to IndexedDB */
        }
      })
      .catch((error) => {
        initialSuggestionConsumedRef.current = false;
        initialSuggestionRef.current = suggestion;
        logger.warn("[Journal]", "Failed to create entry from mood handoff", error);
      });
  }, [autoCreateInitialEntry, journal, journal.loading, journal.view, onInitialEntrySuggestionConsumed]);

  useEffect(() => {
    if (journal.view === "list" && !initialEntrySuggestion) {
      initialSuggestionRef.current = null;
      initialSuggestionConsumedRef.current = false;
      setDeferredInitialSuggestionKey(null);
    }
  }, [journal.view, initialEntrySuggestion]);

  const activeEntryPrefill: JournalEntryPrefill | null = !journal.activeEntry
    ? portalEntryPrefill
    : null;

  const showAppNavMenuButton = showAppNavMenu && !!onOpenNavMenu;
  const showEntrySuggestionCards = isDiaryDesktopLayout;

  const hasInitialEntrySuggestion =
    !!initialEntrySuggestion &&
    !!initialSuggestionRef.current &&
    !initialSuggestionConsumedRef.current &&
    deferredInitialSuggestionKey !== currentInitialSuggestionKey &&
    journal.view === "list";

  const visibleExtraSuggestions = useMemo(
    () =>
      showEntrySuggestionCards
        ? extraSuggestions.filter((suggestion, index) => {
            return !dismissedSuggestionIds.includes(getSuggestionDismissKey(suggestion, index));
          })
        : [],
    [dismissedSuggestionIds, extraSuggestions, showEntrySuggestionCards],
  );

  const handleUseExtraSuggestion = useCallback(
    (suggestion: JournalEntrySuggestion, index: number) => {
      setDismissedSuggestionIds((prev) => [...prev, getSuggestionDismissKey(suggestion, index)]);
      handleNewEntryWithPrefill(suggestion.prefill);
    },
    [handleNewEntryWithPrefill],
  );

  const handleDismissExtraSuggestion = useCallback((suggestion: JournalEntrySuggestion, index: number) => {
    setDismissedSuggestionIds((prev) => [...prev, getSuggestionDismissKey(suggestion, index)]);
  }, []);

  const handleOpenEntry = useCallback(
    (id: string) => {
      if (privateMode) return;
      entryModeRef.current = "card";
      setPortalEntryPrefill(null);
      entryTransition.startTransition(id);
      journal.openEntry(id);
      // Complete transition after layout animation settles (~350ms spring duration)
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => entryTransition.completeTransition(), 350);
    },
    [journal, entryTransition, privateMode]
  );

  /** Reverse entry transition before navigating back to list */
  const handleGoBack = useCallback(() => {
    setPortalEntryPrefill(null);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (
      entryTransition.transitionState === "settled" ||
      entryTransition.transitionState === "morphing-forward"
    ) {
      entryTransition.reverseTransition();
      // Wait for reverse animation, then finalize
      transitionTimerRef.current = setTimeout(() => {
        entryTransition.finishReverse();
        journal.goBack();
      }, 300);
    } else {
      entryTransition.cancelTransition();
      journal.goBack();
    }
  }, [journal, entryTransition]);

  const handleEditorBack = useCallback(() => {
    const pendingAction = pendingEditorExitActionRef.current;
    pendingEditorExitActionRef.current = null;
    if (pendingAction) {
      pendingAction();
      return;
    }
    handleGoBack();
  }, [handleGoBack]);

  const handleEditorExitRequestCancelled = useCallback(() => {
    pendingEditorExitActionRef.current = null;
  }, []);

  const handlePrivateModeChange = useCallback((checked: boolean) => {
    const persisted = storageSetRaw(SK.JOURNAL_PRIVATE_MODE, String(checked));
    const concealCurrentScreen = checked || !persisted;
    setPrivateModeState({
      enabled: concealCurrentScreen,
      persistenceError: !persisted,
    });
    if (concealCurrentScreen && (journal.view === "viewing" || journal.view === "editing")) {
      handleGoBack();
    }
  }, [handleGoBack, journal.view]);

  const handlePanicExitFromEditor = useCallback(() => {
    const persisted = storageSetRaw(SK.JOURNAL_PRIVATE_MODE, "true");
    setPrivateModeState({ enabled: true, persistenceError: !persisted });
    security.lock();
    handleGoBack();
  }, [handleGoBack, security]);

  const handleStatsBack = useCallback(() => {
    setDiaryTabSection("entry");
    handleGoBack();
  }, [handleGoBack]);

  const handleShellSettingsRequest = useCallback(() => {
    setDiaryTabSection("settings");
    if (journal.view === "editing" && editorSettingsRequestRef.current) {
      editorSettingsRequestRef.current();
      return;
    }

    openSettings();
  }, [journal.view, openSettings]);

  const handleOpenStats = useCallback(() => {
    requestEditorExit(() => {
      if (showPasswordSettings) {
        if (!closeSettings(false)) return;
      }
      setDiaryTabSection("stats");
      journal.openStats();
    });
  }, [closeSettings, journal, requestEditorExit, showPasswordSettings]);

  const handleNewEntryFromShell = useCallback(() => {
    requestEditorExit(() => {
      if (showPasswordSettings) {
        if (!closeSettings(false)) return;
      }
      handleNewEntry();
    });
  }, [closeSettings, handleNewEntry, requestEditorExit, showPasswordSettings]);

  const handleOpenEntryFromShell = useCallback(
    (id: string) => {
      requestEditorExit(() => {
        if (showPasswordSettings) {
          if (!closeSettings(false)) return;
        }
        setDiaryTabSection("entry");
        handleOpenEntry(id);
      });
    },
    [closeSettings, handleOpenEntry, requestEditorExit, showPasswordSettings]
  );

  const handleOpenFavoriteEntry = useCallback(
    (id: string) => {
      requestEditorExit(() => {
        if (showPasswordSettings) {
          if (!closeSettings(false)) return;
        }
        setDiaryTabSection("favorites");
        handleOpenEntry(id);
      });
    },
    [closeSettings, handleOpenEntry, requestEditorExit, showPasswordSettings]
  );

  const handleToggleActiveEntryFavorite = useCallback(() => {
    const entry = journal.activeEntry;
    if (!entry || favoriteMutationPendingRef.current) return;

    favoriteMutationPendingRef.current = true;
    setFavoriteMutationPending(true);
    const nextFavorite = !isFavoriteJournalEntry(entry);
    void journal
      .updateEntry(entry.id, {
        tags: setJournalEntryFavorite(entry.tags, nextFavorite),
      })
      .then(() => {
        try {
          triggerSync();
        } catch (error) {
          logger.warn("[Journal]", "Favorite sync scheduling failed:", error);
        }
      })
      .catch((error) => {
        logger.error("[Journal]", "Favorite update failed:", error);
        announceError(ts.journalSaveFailed || "Could not save this change.");
      })
      .finally(() => {
        favoriteMutationPendingRef.current = false;
        setFavoriteMutationPending(false);
      });
  }, [journal, ts.journalSaveFailed]);

  const handleToggleDiaryPanel = useCallback(() => {
    const nextState = isCollapsed ? "expanded" : "collapsed";
    setSidebarState(nextState);
    if (nextState === "expanded") {
      requestAnimationFrame(() => sidebarContentRef.current?.focus());
    }
    void haptics.light();
  }, [isCollapsed, setSidebarState]);

  const handleOpenMobileDiarySidebar = useCallback(() => {
    if (showPasswordSettings) {
      if (!closeSettings(false)) return;
    }
    setShowMobileDiarySidebar(true);
    void haptics.light();
  }, [closeSettings, showPasswordSettings]);

  const handleOpenFavorites = useCallback(() => {
    requestEditorExit(() => {
      if (showPasswordSettings) {
        if (!closeSettings(false)) return;
      }

      if (journal.view === "viewing" || journal.view === "stats") {
        handleGoBack();
      }

      setDiaryTabSection("favorites");

      if (sidebarState === "collapsed") {
        setSidebarState("expanded");
        requestAnimationFrame(() => sidebarContentRef.current?.focus());
      }

      void haptics.light();
    });
  }, [closeSettings, handleGoBack, journal.view, requestEditorExit, setSidebarState, showPasswordSettings, sidebarState]);

  const handleShowDiaryPanel = useCallback(() => {
    requestEditorExit(() => {
      if (showPasswordSettings) {
        if (!closeSettings(false)) return;
      }

      setDiaryTabSection("entry");

      if (journal.view === "viewing" || journal.view === "stats") {
        handleGoBack();
      }

      if (sidebarState === "collapsed") {
        setSidebarState("expanded");
        requestAnimationFrame(() => sidebarContentRef.current?.focus());
      }

      void haptics.light();
    });
  }, [closeSettings, handleGoBack, journal.view, requestEditorExit, setSidebarState, showPasswordSettings, sidebarState]);

  const handleSaveEntry = useCallback(
    async (
      data: Parameters<typeof journal.createEntry>[0],
      draftContext: NonNullable<Parameters<typeof journal.createEntry>[1]>,
    ): Promise<JournalSaveCompletion> => {
      const saveLifecycle = captureJournalSaveCeremonyLifecycle();
      const isNew = !journal.activeEntryId;
      const operation = isNew ? "create" : "update";
      const spaceIds = getPrefillSpaceIds(activeEntryPrefill);
      const { appliedTheme: committedTheme } =
        await commitJournalSaveAndCaptureTheme(
          async () => {
            if (journal.activeEntryId) {
              await journal.updateEntry(
                journal.activeEntryId,
                data,
                draftContext,
              );
            } else {
              await journal.createEntry(data, draftContext, spaceIds);
            }
          },
          () => useThemeStore.getState().appliedTheme,
        );
      setPortalEntryPrefill(null);
      // Secondary effects must never turn a durable local save into a failed save.
      try {
        triggerSync();
      } catch {
        /* graceful: cloud sync is secondary; data already saved to IndexedDB */
      }

      let isStreakMilestone = false;
      // Streak milestone celebration (only for new entries on today's date)
      if (isNew && rewardsEnabled) {
        const entryDate = data.date || today;
        const newStreak = entryDate === today && !hasTodayEntry ? streak + 1 : 0;
        const milestones = [7, 14, 30, 60, 100];
        isStreakMilestone = milestones.includes(newStreak);

        try {
          rewardUser("journal", {
            treats: 10,
            treatReason: "Journal entry",
            skipPopup: true,
            sound: null,
          });
        } catch {
          logger.warn("[Journal] Post-commit reward was deferred", {
            code: "journal_reward_post_commit_error",
          });
        }

        if (isStreakMilestone) {
          setCelebratingStreak(newStreak);
          try {
            const { playStreakMilestone } = await import("@/lib/audioManager");
            playStreakMilestone();
          } catch {
            /* graceful: celebration audio is decorative */
          }
        }
      }

      if (isStreakMilestone) {
        return { feedbackHandled: true, ceremonyReceipt: null };
      }

      const ceremonyReceipt =
        ENABLE_JOURNAL_SAVE_CEREMONY &&
        mayPresentJournalSaveCeremony(saveLifecycle)
        ? createJournalSaveCommitReceipt({
            operation,
            appliedTheme: committedTheme,
          })
        : null;
      if (ceremonyReceipt) {
        setSaveCeremonyPresentation({
          receipt: ceremonyReceipt,
          lifecycle: saveLifecycle,
        });
      }
      return { feedbackHandled: false, ceremonyReceipt };
    },
    [
      activeEntryPrefill,
      hasTodayEntry,
      journal,
      rewardsEnabled,
      rewardUser,
      streak,
      today,
    ]
  );

  const handleSaveCeremonyConsume = useCallback((nonce: string) => {
    setSaveCeremonyPresentation((current) =>
      current?.receipt.nonce === nonce ? null : current,
    );
  }, []);

  const recoverFailedDelete = useCallback(
    async (failedDelete: PendingDelete, err: unknown) => {
      logger.warn("[Journal]", "commitDelete failed:", err);
      if (!isMountedRef.current) return;
      let cancelledIds: string[];
      try {
        cancelledIds = await cancelPendingJournalEntryDeletes([failedDelete.id]);
      } catch (cancelError) {
        logger.warn("[Journal] Failed to cancel durable delete marker", cancelError);
        return;
      }
      if (!isMountedRef.current) return;
      if (!cancelledIds.includes(failedDelete.id)) {
        setPendingDeletes((current) => current.filter((item) => item.id !== failedDelete.id));
        try {
          await journal.refresh();
        } catch (refreshError) {
          logger.warn("[Journal] Failed to refresh after an uncertain delete outcome", refreshError);
        }
        return;
      }
      journal.restoreEntry(failedDelete.entry);
      setPendingDeletes((current) => current.filter((item) => item.id !== failedDelete.id));
      setDeleteCommitMessage(
        ts.entryDeleteFailedRestored || "Couldn't delete this entry. It has been restored."
      );
      clearTimeout(deleteFeedbackTimerRef.current);
      deleteFeedbackTimerRef.current = setTimeout(() => setDeleteCommitMessage(null), 5000);
      void haptics.light();
    },
    [journal, ts.entryDeleteFailedRestored]
  );

  const handleDeleteEntry = useCallback(
    async (id: string): Promise<boolean> => {
      if (
        pendingDeleteStageIdsRef.current.has(id) ||
        pendingDeleteRef.current.some((item) => item.id === id)
      ) {
        return false;
      }
      pendingDeleteStageIdsRef.current.add(id);
      try {
        const expiresAt = Date.now() + JOURNAL_DELETE_UNDO_WINDOW_MS;
        const markers = await stagePendingJournalEntryDelete(id, expiresAt);
        if (!isMountedRef.current) return false;
        const entry = journal.softDeleteEntry(id);
        if (!entry) {
          await cancelPendingJournalEntryDeletes([id]);
          return false;
        }
        clearTimeout(deleteFeedbackTimerRef.current);
        setDeleteCommitMessage(null);
        setPendingDeletes((current) => {
          const entriesById = new Map(current.map((item) => [item.id, item.entry]));
          entriesById.set(id, entry);
          const next = markers.flatMap((marker) => {
            const markerEntry = entriesById.get(marker.id);
            return markerEntry ? [{ ...marker, entry: markerEntry }] : [];
          });
          pendingDeleteRef.current = next;
          return next;
        });
        void hapticSuccess();
        return true;
      } catch (error) {
        logger.warn("[Journal] Failed to stage diary deletion", error);
        if (!isMountedRef.current) return false;
        setDeleteCommitMessage(
          ts.entryDeleteFailedRestored || "Couldn't delete this entry. It has been restored."
        );
        return false;
      } finally {
        pendingDeleteStageIdsRef.current.delete(id);
      }
    },
    [journal, ts.entryDeleteFailedRestored]
  );

  const handleUndoDelete = useCallback(async () => {
    const pending = pendingDeleteRef.current;
    if (pending.length === 0) return;
    let cancelledIds: string[];
    try {
      cancelledIds = await cancelPendingJournalEntryDeletes(
        pending.map((item) => item.id),
      );
    } catch (error) {
      logger.warn("[Journal] Failed to cancel pending diary deletion", error);
      return;
    }
    if (!isMountedRef.current || cancelledIds.length === 0) return;
    const cancelledIdSet = new Set(cancelledIds);
    deleteTimerAbortRef.current?.abort();
    clearTimeout(deleteFeedbackTimerRef.current);
    const remaining = pendingDeleteRef.current.filter(
      (item) => !cancelledIdSet.has(item.id),
    );
    pendingDeleteRef.current = remaining;
    setPendingDeletes(remaining);
    for (const item of pending) {
      if (cancelledIdSet.has(item.id)) journal.restoreEntry(item.entry);
    }
    setDeleteCommitMessage(null);
    void haptics.light();
  }, [journal]);

  const commitExpiredPendingDeletes = useCallback(() => {
    const now = Date.now();
    const expired = pendingDeleteRef.current.filter((item) => item.expiresAt <= now);
    if (expired.length === 0) return;
    const remaining = pendingDeleteRef.current.filter((item) => item.expiresAt > now);
    pendingDeleteRef.current = remaining;
    setPendingDeletes(remaining);
    for (const item of expired) {
      void journal.commitDeleteEntry(item.id).catch((error) =>
        recoverFailedDelete(item, error),
      );
    }
  }, [journal, recoverFailedDelete]);

  useEffect(() => {
    deleteTimerAbortRef.current?.abort();
    if (pendingDeletes.length === 0) return;
    const earliestExpiry = Math.min(...pendingDeletes.map((item) => item.expiresAt));
    const delay = Math.max(0, earliestExpiry - Date.now());
    const abortController = new AbortController();
    deleteTimerAbortRef.current = abortController;
    void waitForJournalDeleteDeadline(delay, abortController.signal).then((elapsed) => {
      if (elapsed && isMountedRef.current) commitExpiredPendingDeletes();
    });
    return () => abortController.abort();
  }, [commitExpiredPendingDeletes, pendingDeletes]);

  const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    return `${local[0]}${"*".repeat(Math.min(local.length - 1, 5))}@${domain}`;
  };

  const handleForgotPassword = async () => {
    const requestSeq = ++resetRequestSeqRef.current;
    const isCurrentResetRequest = () => requestSeq === resetRequestSeqRef.current;

    setResetStep("checking");
    setResetError("");
    try {
      if (!(await checkLocalEmailLockRemovalAvailable())) {
        if (!isCurrentResetRequest()) return;
        setResetStep("unavailable");
        return;
      }

      const supabase = await loadJournalSupabase();
      if (!isCurrentResetRequest()) return;
      if (!supabase) {
        setResetStep("no-account");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isCurrentResetRequest()) return;
      if (!session?.user?.email) {
        setResetStep("no-account");
        return;
      }
      if (!(await checkEmailLockRemovalAvailable(supabase))) {
        if (!isCurrentResetRequest()) return;
        setResetStep("unavailable");
        return;
      }
      setResetEmail(session.user.email);
      setResetOwnerUserId(session.user.id);
      setResetStep("confirm");
    } catch (error) {
      if (!isCurrentResetRequest()) return;
      logger.warn("[Journal] Password reset account check failed", getJournalAuthErrorDebugInfo(error));
      setResetError(
        ts.journalResetServiceUnavailable ||
          "We could not check your account. Check your connection and try again.",
      );
      setResetStep("service-error");
    }
  };

  const handleSendResetLink = async () => {
    if (resetStep === "sending") return;
    if (!resetEmail || !resetOwnerUserId) return;
    const requestSeq = ++resetRequestSeqRef.current;
    const requestedEmail = resetEmail;
    const requestedUserId = resetOwnerUserId;

    const isCurrentResetRequest = () => requestSeq === resetRequestSeqRef.current;

    // M2: OTP cooldown — prevent abuse by enforcing 60s between sends
    const now = Date.now();
    const remaining = updateResetResendRemaining(now);
    if (remaining > 0) {
      setResetError(
        formatJournalDuration(
          ts.journalResetCooldown || "Please wait {duration} before requesting another link.",
          remaining,
          language,
        )
      );
      return;
    }

    const resetNonce = createJournalPasswordResetNonce();
    if (!resetNonce) {
      logger.warn("[Journal] Secure password reset nonce generation is unavailable");
      setResetError(ts.journalResetSendFailed || "Failed to send link. Check your connection.");
      setResetStep("confirm");
      return;
    }

    setResetStep("sending");
    setResetError("");
    resetSendInFlightRef.current = true;
    storageSetRaw(
      SK.JOURNAL_PASSWORD_RESET,
      serializeJournalPasswordResetRequest(requestedEmail, requestedUserId, resetNonce),
    );
    clearJournalPasswordResetProof();
    try {
      const supabase = await loadJournalSupabase();
      if (!isCurrentResetRequest()) return;
      if (!supabase) {
        storageRemove(SK.JOURNAL_PASSWORD_RESET);
        lastResetOtpRef.current = 0;
        setResetResendRemaining(0);
        setResetStep("no-account");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isCurrentResetRequest()) return;
      if (
        session?.user?.id !== requestedUserId ||
        normalizeJournalResetEmail(session?.user?.email) !== normalizeJournalResetEmail(requestedEmail)
      ) {
        storageRemove(SK.JOURNAL_PASSWORD_RESET);
        clearJournalPasswordResetProof();
        setResetError(
          ts.journalResetWrongAccount ||
            "Open this link while signed in to the same account that requested it.",
        );
        setResetStep("confirm");
        return;
      }

      const resetRedirectUrl = createPkceAttemptRedirectUrl(
        withJournalPasswordResetNonce(getAuthRedirectUrl(), resetNonce),
        "email-otp",
      ).redirectUrl;
      const { error } = await withJournalRequestTimeout(
        supabase.auth.signInWithOtp({
          email: requestedEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: resetRedirectUrl,
          },
        }),
      );
      if (!isCurrentResetRequest()) return;
      if (error) {
        logger.warn("[Journal] Password reset link failed", getJournalAuthErrorDebugInfo(error));
        storageRemove(SK.JOURNAL_PASSWORD_RESET);
        clearJournalPasswordResetProof();
        lastResetOtpRef.current = 0;
        setResetResendRemaining(0);
        setResetError(ts.journalResetSendFailed || "Failed to send link. Check your connection.");
        setResetStep("confirm");
        return;
      }
      lastResetOtpRef.current = now;
      updateResetResendRemaining(now);
      storageSetRaw(
        SK.JOURNAL_PASSWORD_RESET,
        serializeJournalPasswordResetRequest(requestedEmail, requestedUserId, resetNonce),
      );
      clearJournalPasswordResetProof();
      setResetStep("sent");
    } catch (error) {
      if (!isCurrentResetRequest()) return;
      logger.warn("[Journal] Password reset link failed", getJournalAuthErrorDebugInfo(error));
      if (isJournalRequestTimeoutError(error)) {
        lastResetOtpRef.current = now;
        updateResetResendRemaining(now);
        setResetError(
          ts.journalResetSendTimedOut ||
            "This is taking longer than expected. Check your email before trying again.",
        );
        setResetStep("confirm");
        return;
      }
      storageRemove(SK.JOURNAL_PASSWORD_RESET);
      clearJournalPasswordResetProof();
      lastResetOtpRef.current = 0;
      setResetResendRemaining(0);
      setResetError(ts.journalResetSendFailed || "Failed to send link. Check your connection.");
      setResetStep("confirm");
    } finally {
      if (isCurrentResetRequest()) resetSendInFlightRef.current = false;
    }
  };

  const showResetLinkConfirmationError = useCallback((email: string, message?: string) => {
    setResetEmail(email);
    setResetError(withJournalResetProtectedDetail(
      message || ts.journalResetCodeWrong || "Verification link could not be confirmed. Try again.",
    ));
    setResetStep("confirm");
  }, [ts.journalResetCodeWrong]);

  const consumeVerifiedPasswordReset = useCallback(
    async (
      sessionEmail: string | null | undefined,
      sessionUserId: string | null | undefined,
    ) => {
      const pending = parseJournalPasswordResetRequest(storageGetRaw(SK.JOURNAL_PASSWORD_RESET));
      if (!pending) return false;

      const existingFlight = resetConsumeFlightRef.current;
      if (existingFlight?.nonce === pending.nonce) return existingFlight.promise;

      const flight = Promise.resolve().then(async (): Promise<boolean> => {

        if (Date.now() - pending.startedAt >= JOURNAL_PASSWORD_RESET_WINDOW_MS) {
        storageRemove(SK.JOURNAL_PASSWORD_RESET);
        clearJournalPasswordResetProof();
        clearJournalPasswordResetParamFromCurrentUrl();
        showResetLinkConfirmationError(
          pending.email,
          ts.journalResetExpired || "This verification link expired. Send a new link.",
        );
        return false;
        }

        const signedInEmail = normalizeJournalResetEmail(sessionEmail);
        if (
          !signedInEmail ||
          signedInEmail !== pending.email ||
          !sessionUserId ||
          sessionUserId !== pending.userId
        ) {
        logger.warn("[Journal] Ignored password reset sign-in for a different account");
        clearJournalPasswordResetProof();
        clearJournalPasswordResetParamFromCurrentUrl();
        showResetLinkConfirmationError(
          pending.email,
          ts.journalResetWrongAccount || "Open this link while signed in to the same account that requested it.",
        );
        return false;
        }

        if (!hasJournalPasswordResetProof(pending)) {
        logger.warn("[Journal] Ignored password reset session without redirect proof");
        clearJournalPasswordResetProof();
        clearJournalPasswordResetParamFromCurrentUrl();
        showResetLinkConfirmationError(
          pending.email,
          ts.journalResetMissingProof || "This browser could not confirm the email link. Open the link on the same device or request a new one.",
        );
        return false;
        }

        if (!(await checkEmailLockRemovalAvailable())) {
        storageRemove(SK.JOURNAL_PASSWORD_RESET);
        clearJournalPasswordResetProof();
        clearJournalPasswordResetParamFromCurrentUrl();
        setResetEmail(pending.email);
        setResetError("");
        setResetStep("unavailable");
        return false;
        }

        if (!consumeJournalPasswordResetProof(
          pending.nonce,
          pending.userId,
          JOURNAL_PASSWORD_RESET_WINDOW_MS,
        )) {
        logger.warn("[Journal] Ignored password reset session after proof could not be consumed");
        clearJournalPasswordResetParamFromCurrentUrl();
        showResetLinkConfirmationError(
          pending.email,
          ts.journalResetMissingProof || "This browser could not confirm the email link. Open the link on the same device or request a new one.",
        );
        return false;
        }
        clearJournalPasswordResetParamFromCurrentUrl();

        setResetEmail(pending.email);

        try {
        await security.removePassword({ allowVerifiedEmptyDiary: true });
        storageRemove(SK.JOURNAL_PASSWORD_RESET);
        clearJournalPasswordResetProof();
        setResetError("");
        setResetStep("success");
        announceSuccess(
          ts.journalPasswordRemoveSuccess || ts.journalResetSuccess || "Diary lock removed",
        );
        return true;
        } catch (error) {
        logger.warn("[Journal] Verified reset could not remove the diary lock:", error);
        storageRemove(SK.JOURNAL_PASSWORD_RESET);
        clearJournalPasswordResetProof();
        const lockRemoveMessage =
          ts.journalLockRemoveFailed ||
          "Unlock your diary first, then try removing the lock again.";
        setResetError(
          lockRemoveMessage.includes("entries remain protected")
            ? lockRemoveMessage
            : `${lockRemoveMessage} Nothing changed; your entries remain protected.`,
        );
        setResetStep("unavailable");
        return false;
        }
      });

      resetConsumeFlightRef.current = { nonce: pending.nonce, promise: flight };
      try {
        return await flight;
      } finally {
        if (resetConsumeFlightRef.current?.promise === flight) {
          resetConsumeFlightRef.current = null;
        }
      }
    },
    [checkEmailLockRemovalAvailable, security, showResetLinkConfirmationError, ts.journalLockRemoveFailed, ts.journalPasswordRemoveSuccess, ts.journalResetExpired, ts.journalResetMissingProof, ts.journalResetSuccess, ts.journalResetWrongAccount],
  );

  const handleSetNewPasswordAfterReset = useCallback(() => {
    resetRequestSeqRef.current += 1;
    setResetStep("idle");
    setResetEmail("");
    setResetOwnerUserId("");
    setResetError("");
    openSettings("password-setup");
  }, [openSettings]);

  // --- HOOKS (all callbacks declared above — safe from TDZ in production minified chunks) ---
  useScrollLock(moduleState === "open" && !isPagePresentation);
  useModalA11y(
    moduleState === "open" && !isLgScreen && !disableCardShell && !isPagePresentation,
    handleClose
  );

  // Focus trap for main overlay (skip on desktop — sidebar must be accessible)
  useEffect(() => {
    if (moduleState !== "open" || !overlayRef.current || isLgScreen || isPagePresentation) return;
    return createFocusTrap(overlayRef.current);
  }, [moduleState, isLgScreen, isPagePresentation]);

  useEffect(() => {
    if (resetStep === "idle" || !resetDialogRef.current) return;

    const initialFocus =
      resetCancelRef.current && !resetCancelRef.current.disabled
        ? resetCancelRef.current
        : null;

    if (!initialFocus) {
      resetDialogRef.current.focus({ preventScroll: true });
    }

    return createFocusTrap(resetDialogRef.current, { initialFocus });
  }, [resetStep]);

  // Load entry count for card preview
  useEffect(() => {
    if (isPagePresentation) return;
    getEntryCount()
      .then(setEntryCount)
      .catch((err) => logger.warn("[Journal]", "Entry count failed:", err));
  }, [isPagePresentation, journal.totalCount]);

  // Check for unsaved draft (for card badge)
  useEffect(() => {
    if (moduleState !== "card") return;
    settingsRepo
      .get("journal_draft_new")
      .then((record) => {
        setHasDraft(!!record?.value);
      })
      .catch((err) => {
        logger.warn("[Journal]", "Draft check failed:", err);
        setHasDraft(false);
      });
  }, [moduleState, journal.totalCount]);

  // Android back button handling
  useEffect(() => {
    if (moduleState !== "open") return;
    if (showExportPicker)
      return registerModalCloseCallback(() => {
        if (exporting) return true;
        setShowExportPicker(false);
        return true;
      });
    if (resetStep !== "idle")
      return registerModalCloseCallback(() => {
        closeResetDialog();
        return true;
      });
    if (showRemovePasswordConfirm)
      return registerModalCloseCallback(() => {
        if (removePasswordSubmitting) return true;
        setShowRemovePasswordConfirm(false);
        return true;
      });
    if (showMobileDiarySidebar)
      return registerModalCloseCallback(() => {
        closeMobileDiarySidebar();
        return true;
      });
    if (showPasswordSettings)
      return registerModalCloseCallback(() => {
        closeSettings();
        return true;
      });
    if (journal.view === "stats") {
      return registerModalCloseCallback(() => {
        handleStatsBack();
        return true;
      });
    }
    if (journal.view === "editing") {
      return registerModalCloseCallback(() => {
        requestEditorExit(handleGoBack);
        return true;
      });
    }
    if (journal.view !== "list") {
      return registerModalCloseCallback(() => {
        handleGoBack();
        return true;
      });
    }
    if (isPagePresentation) return;
    return registerModalCloseCallback(() => {
      setModuleState("card");
      security.lock();
      return true;
    });
  }, [
    closeSettings,
    closeResetDialog,
    moduleState,
    showExportPicker,
    exporting,
    resetStep,
    showRemovePasswordConfirm,
    removePasswordSubmitting,
    showPasswordSettings,
    showMobileDiarySidebar,
    closeMobileDiarySidebar,
    journal,
    security,
    handleStatsBack,
    handleGoBack,
    requestEditorExit,
    isPagePresentation,
  ]);

  // Security touch on interaction
  useEffect(() => {
    if (moduleState === "open") security.touch();
  }, [moduleState, security]);

  useEffect(() => {
    if (resetResendRemaining <= 0) return;

    const timer = setInterval(() => updateResetResendRemaining(), 1000);
    return () => clearInterval(timer);
  }, [resetResendRemaining, updateResetResendRemaining]);

  // Magic link fallback: pending reset can complete after reload or in a new tab.
  useEffect(() => {
    const pending = parseJournalPasswordResetRequest(storageGetRaw(SK.JOURNAL_PASSWORD_RESET));
    if (!pending) {
      if (typeof window !== "undefined" && getJournalPasswordResetNonceFromUrl(window.location.href)) {
        clearJournalPasswordResetProof();
        clearJournalPasswordResetParamFromCurrentUrl();
      }
      return;
    }

    if (Date.now() - pending.startedAt >= JOURNAL_PASSWORD_RESET_WINDOW_MS) {
      storageRemove(SK.JOURNAL_PASSWORD_RESET);
      clearJournalPasswordResetProof();
      clearJournalPasswordResetParamFromCurrentUrl();
      showResetLinkConfirmationError(
        pending.email,
        ts.journalResetExpired || "This verification link expired. Send a new link.",
      );
      return;
    }

    if (lastResetOtpRef.current < pending.startedAt) {
      lastResetOtpRef.current = pending.startedAt;
      updateResetResendRemaining();
    }

    let disposed = false;
    let subscription: { unsubscribe: () => void } | undefined;
    let removeAuthCompleteListener: (() => void) | undefined;

    void loadJournalSupabase()
      .then(async (supabase) => {
        if (disposed || !supabase) return;

        const completeFromCurrentSessionIfProofReady = async () => {
          if (disposed || (resetStep !== "idle" && resetStep !== "sent")) return;

          const currentPending = parseJournalPasswordResetRequest(storageGetRaw(SK.JOURNAL_PASSWORD_RESET));
          if (!currentPending || !hasJournalPasswordResetProof(currentPending)) return;

          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!disposed) {
              await consumeVerifiedPasswordReset(session?.user?.email, session?.user?.id);
            }
          } catch (error) {
            logger.warn(
              "[Journal] Password reset session check failed",
              getJournalAuthErrorDebugInfo(error),
            );
          }
        };

        await completeFromCurrentSessionIfProofReady();

        if (disposed) return;

        const handleAuthComplete = () => {
          void completeFromCurrentSessionIfProofReady();
        };
        window.addEventListener(AUTH_COMPLETE_EVENT, handleAuthComplete);
        removeAuthCompleteListener = () => window.removeEventListener(AUTH_COMPLETE_EVENT, handleAuthComplete);

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (!JOURNAL_PASSWORD_RESET_AUTH_EVENTS.has(event)) return;
          const currentPending = parseJournalPasswordResetRequest(storageGetRaw(SK.JOURNAL_PASSWORD_RESET));
          if (!currentPending) return;
          void consumeVerifiedPasswordReset(session?.user?.email, session?.user?.id);
        });
        subscription = data.subscription;
      })
      .catch((err) => logger.warn("[Journal]", "Password reset listener failed:", err));

    return () => {
      disposed = true;
      removeAuthCompleteListener?.();
      subscription?.unsubscribe();
    };
  }, [consumeVerifiedPasswordReset, resetStep, showResetLinkConfirmationError, ts.journalResetExpired, updateResetResendRemaining]);

  const mobileDiarySectionButtonClass = useCallback((active: boolean) => cn(
    "flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center motion-safe:transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]",
    active
      ? "bg-primary/15 text-primary shadow-[inset_0_1px_0_hsl(var(--card)/0.52),0_12px_30px_-24px_hsl(var(--primary)/0.82)]"
      : "text-muted-foreground hover:bg-muted/55 hover:text-foreground"
  ), []);

  // ── Card View (collapsed in garden tab) ──
  if (moduleState === "card" && !disableCardShell && !isPagePresentation) {
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onClick={handleOpen}
        className={cn(
          "w-full rounded-2xl p-4 relative overflow-hidden text-start",
          "bg-gradient-to-br from-purple-500/10 via-violet-500/5 to-card/80",
          "backdrop-blur-md border border-purple-500/15 dark:border-purple-500/10",
          "shadow-[0_2px_20px_rgba(139,92,246,0.08)]",
          "motion-safe:transition-all motion-safe:duration-300",
          "hover:shadow-[0_4px_25px_rgba(139,92,246,0.15)]"
        )}
      >
        {/* Row 1: Title + status badge */}
        <div className="mb-3 flex flex-col items-start justify-between gap-3 min-[420px]:flex-row min-[420px]:items-center">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                "bg-gradient-to-br from-purple-500/20 to-violet-500/10"
              )}
            >
              {todayMood ? (
                <DiaryMiniOrb mood={todayMood} size="calendar" className="scale-[0.78]" />
              ) : (
                <PenLine className="w-5 h-5 text-purple-500" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="whitespace-normal break-words text-sm font-semibold text-foreground">
                {ts.journalTitle || "Diary"}
              </h3>
              {security.hasPassword && (
                <span className="flex items-center gap-1 whitespace-normal break-words text-xs text-muted-foreground/60">
                  <Lock className="w-2.5 h-2.5" />
                  {ts.journalProtected || "Protected"}
                </span>
              )}
            </div>
          </div>

          {/* Today status badge + draft badge */}
          <div className="flex w-full flex-wrap items-center gap-1.5 min-[420px]:w-auto">
            {hasDraft && (
              <span className="flex items-center gap-1 whitespace-normal break-words rounded-full border border-amber-500/15 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <PenLine className="w-3 h-3" />
                {ts.journalDraftBadge || "Draft"}
              </span>
            )}
            {hasTodayEntry ? (
              <span className="flex items-center gap-1 whitespace-normal break-words rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                {ts.journalTodayComplete || "Done today"}
              </span>
            ) : (
              <span className="flex items-center gap-1 whitespace-normal break-words rounded-full border border-purple-500/15 bg-purple-500/10 px-2 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                <PenLine className="w-3 h-3" />
                {ts.journalWriteToday || "Write today"}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Stats bar */}
        <div className="flex items-center gap-3">
          {entryCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatLocalizedCount(
                entryCount,
                language,
                ts,
                "journalEntryCount",
                ts.journalEntries || "entries"
              )}
            </span>
          )}
          {rewardsEnabled && streak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              {formatLocalizedCount(
                streak,
                language,
                ts,
                "journalStreakCount",
                ts.journalStreak || "streak"
              )}
            </span>
          )}
          <span className="flex-1" />
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 rotate-0 rtl:rotate-180" />
        </div>
      </motion.button>
    );
  }

  // ── Full-screen overlay (portal to escape PullToRefresh transform ancestor) ──
  const moduleContent = (
    <div
      onKeyDown={handleModuleKeyDown}
      onPointerDown={security.touch}
      className={cn(
        "relative w-full h-full flex flex-col",
        isPagePresentation
          ? "v2-fullscreen-page relative z-[1] min-h-[var(--app-viewport-height)] bg-transparent overflow-hidden"
          : "md:my-4 md:mx-4 md:h-[calc(100%-2rem)] md:rounded-2xl md:bg-background md:shadow-2xl md:border md:border-border/20 md:overflow-hidden",
        !isPagePresentation &&
          "lg:max-w-none lg:mx-0 lg:my-0 lg:h-full lg:rounded-none lg:shadow-none lg:border-0 lg:overflow-hidden"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleJournalImportFile}
        data-testid="journal-import-input"
      />
      {security.loadError && (
        <div
          role="alert"
          data-testid="journal-security-load-error"
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center"
        >
          <AlertCircle className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">
            {ts.journalLoadFailed || "Diary needs another moment to load"}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {ts.journalLoadFailedHint ||
              "This load attempt did not change your entries. Try loading again."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                void security.retryLoad();
              }}
              className="min-h-[44px] rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {ts.journalRetryLoad || "Retry loading"}
            </button>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[44px] rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground"
              >
                {ts.journalClose || ts.close || "Close"}
              </button>
            )}
          </div>
        </div>
      )}
      {/* Security gate */}
      {security.isLocked && !security.loading && !security.loadError && (
        <>
          {/* Header with close */}
          <div className="flex items-center justify-between gap-3 border-b border-border/30 px-4 pb-3 pt-[max(0.75rem,var(--safe-top))]">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {showAppNavMenuButton ? (
                <button
                  type="button"
                  onClick={onOpenNavMenu}
                  className={mobileHeaderMenuClass}
                  title={ts.navV2OpenMenu || "Open menu"}
                  aria-label={ts.navV2OpenMenu || "Open menu"}
                  aria-expanded={navMenuOpen}
                  aria-controls="nav-v2-drawer"
                  data-testid="journal-lock-nav-menu"
                >
                  <JournalMenuIcon className="pointer-events-none h-5 w-5" aria-hidden="true" />
                </button>
              ) : null}
              <h2 className="min-w-0 break-words whitespace-normal text-base font-bold leading-tight text-foreground [hyphens:manual] [overflow-wrap:normal]">
                {ts.journalTitle || "Diary"}
              </h2>
            </div>
            {!hideCloseButton && (
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={ts.close || "Close"}
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            )}
          </div>
          <JournalLockScreen
            mode="unlock"
            cooldownRemaining={security.cooldownRemaining}
            failedAttempts={security.failedAttempts}
            onUnlock={security.unlock}
            onSetPassword={security.setPassword}
            onForgotPassword={handleForgotPassword}
            onBiometricUnlock={security.biometricEnabled ? security.unlockWithBiometric : undefined}
            biometricAvailable={security.biometricAvailable && security.biometricEnabled}
            emailLockRemovalAvailable={isEmailLockRemovalAvailable}
          />
        </>
      )}

          {/* Secure password reset dialog (email verification) */}
          {resetStep !== "idle" && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] motion-safe:animate-fade-in dark:bg-black/50"
              onClick={closeResetDialog}
            >
              <motion.div
                ref={resetDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={resetTitleId}
                aria-describedby={resetError ? `${resetDescriptionId} ${resetErrorId}` : resetDescriptionId}
                aria-busy={resetStep === "checking" || resetStep === "sending"}
                tabIndex={-1}
                initial={reducedMotion ? false : { scale: 0.98 }}
                animate={{ scale: 1 }}
                transition={reducedMotion ? { duration: 0 } : springs.quick}
                className="isolate max-h-[calc(var(--app-viewport-height)_-_var(--safe-top)_-_var(--safe-bottom)_-_2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-border/40 bg-popover p-5 text-popover-foreground shadow-2xl lg:max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id={resetTitleId} className="sr-only">
                  {resetStep === "success"
                    ? ts.journalResetSuccess || "Diary lock removed"
                    : resetStep === "sent"
                      ? ts.journalResetLinkSent || "Check your email"
                    : resetStep === "no-account" || resetStep === "service-error" || resetStep === "unavailable"
                        ? ts.journalPasswordForgot || "Can't open the lock?"
                        : ts.journalResetViaEmail || "Remove lock by email"}
                </h3>
                <p id={resetDescriptionId} className="sr-only">
                  {resetStep === "sent"
                    ? ts.journalResetCheckEmail ||
                      "Click the link in your email to remove the diary lock. This page will update automatically."
                    : resetStep === "no-account"
                      ? ts.journalResetNoAccount ||
                        "Sign in from Account settings to remove this lock by email. Nothing changed; your diary entries remain protected."
                      : resetStep === "service-error"
                        ? ts.journalResetServiceUnavailable ||
                          "We could not check your account. Check your connection and try again."
                      : resetStep === "unavailable"
                        ? resetEncryptedUnavailableMessage
                      : resetStep === "success"
                        ? ts.journalResetSuccessDetail ||
                          "Your diary is now open without a diary password on this device. Set a new password if you want to keep it protected."
                        : ts.journalResetConfirm || "We'll send a verification link to"}
                </p>
                {/* Checking session */}
                {resetStep === "checking" && (
                  <div className="flex flex-col items-center justify-center gap-4 py-6">
                    <Loader2 className="w-6 h-6 motion-safe:animate-spin text-primary" aria-hidden="true" />
                    <div className="space-y-1 text-center">
                      <p className="text-sm font-medium text-foreground">
                        {ts.journalResetChecking || "Checking your account..."}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {ts.journalResetCheckingHint ||
                          "Keep this window open while we confirm email lock removal is available."}
                      </p>
                    </div>
                    <button
                      ref={resetCancelRef}
                      type="button"
                      onClick={closeResetDialog}
                      className="min-h-[44px] rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground"
                    >
                      {ts.journalClose || "Close"}
                    </button>
                  </div>
                )}

                {/* No account */}
                {resetStep === "no-account" && (
                  <>
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="w-6 h-6 text-muted-foreground" />
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-foreground text-center mb-2">
                      {ts.journalPasswordForgot || "Can't open the lock?"}
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      {ts.journalResetNoAccount ||
                        "Sign in to your account in Settings to use email lock removal"}
                    </p>
                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={handleOpenAccountSettings}
                        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium min-h-[44px]"
                      >
                        {ts.journalResetOpenAccountSettings || "Open account settings"}
                      </button>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="w-full py-2.5 rounded-xl bg-background/70 text-foreground text-sm font-medium min-h-[44px] border border-border/45"
                      >
                        {ts.journalResetTryAgain || "Check again"}
                      </button>
                      <button
                        ref={resetCancelRef}
                        type="button"
                        onClick={closeResetDialog}
                        className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
                      >
                        {ts.journalClose || "Close"}
                      </button>
                    </div>
                  </>
                )}

                {/* Service check failure */}
                {resetStep === "service-error" && (
                  <>
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-destructive" />
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-foreground text-center mb-2">
                      {ts.journalPasswordForgot || "Can't open the lock?"}
                    </h3>
                    <p id={resetErrorId} role="alert" className="text-sm text-muted-foreground text-center mb-4">
                      {resetError ||
                        ts.journalResetServiceUnavailable ||
                        "We could not check your account. Check your connection and try again."}
                    </p>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="mb-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium min-h-[44px]"
                    >
                      {ts.journalResetTryAgain || "Try again"}
                    </button>
                    <button
                      ref={resetCancelRef}
                      onClick={closeResetDialog}
                      className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
                    >
                      {ts.journalClose || "Close"}
                    </button>
                  </>
                )}

                {/* Email removal unavailable for encrypted locked content */}
                {resetStep === "unavailable" && (
                  <>
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Lock className="w-6 h-6 text-muted-foreground" />
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-foreground text-center mb-2">
                      {ts.journalPasswordForgot || "Can't open the lock?"}
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      {resetEncryptedUnavailableMessage}
                    </p>
                    {resetError && (
                      <p id={resetErrorId} role="alert" className="mb-3 text-center text-xs text-destructive">{resetError}</p>
                    )}
                    <button
                      ref={resetCancelRef}
                      onClick={closeResetDialog}
                      className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
                    >
                      {ts.journalClose || "Close"}
                    </button>
                  </>
                )}

                {/* Confirm send */}
                {(resetStep === "confirm" || resetStep === "sending") && (
                  <>
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mail className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-foreground text-center mb-1">
                      {ts.journalResetViaEmail || "Remove lock by email"}
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-1">
                      {ts.journalResetConfirm || "We'll send a verification link to"}
                    </p>
                    <p
                      className="mb-4 min-w-0 max-w-full whitespace-normal break-words text-center text-sm font-medium text-foreground [overflow-wrap:anywhere]"
                      dir="ltr"
                    >
                      <bdi>{maskEmail(resetEmail)}</bdi>
                    </p>
                    {resetError && (
                      <p id={resetErrorId} role="alert" className="mb-3 text-center text-xs text-destructive">{resetError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        ref={resetCancelRef}
                        type="button"
                        onClick={closeResetDialog}
                        className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
                      >
                        {ts.cancel || "Cancel"}
                      </button>
                      <button
                        type="button"
                        onClick={handleSendResetLink}
                        disabled={resetStep === "sending"}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-medium min-h-[44px]",
                          "bg-primary text-primary-foreground",
                          "disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                        )}
                      >
                        {resetStep === "sending" && (
                          <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />
                        )}
                        {ts.journalResetSendLink || "Send Link"}
                      </button>
                    </div>
                  </>
                )}

                {/* Link sent — waiting for magic link click */}
                {resetStep === "sent" && (
                  <>
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-foreground text-center mb-1">
                      {ts.journalResetLinkSent || "Check your email"}
                    </h3>
                    <p className="text-xs text-muted-foreground text-center mb-2">
                      {ts.journalResetLinkHint || "We sent a verification link to"}
                    </p>
                    <p
                      className="mb-4 min-w-0 max-w-full whitespace-normal break-words text-center text-sm font-medium text-foreground [overflow-wrap:anywhere]"
                      dir="ltr"
                    >
                      <bdi>{maskEmail(resetEmail)}</bdi>
                    </p>
                    <p className="text-xs text-muted-foreground text-center mb-4">
                      {ts.journalResetCheckEmail ||
                        "Open the link on this device or browser, then return to the diary. It verifies your account and removes the lock without revealing the old password."}
                    </p>
                    <p className="mb-4 text-center text-xs leading-relaxed text-muted-foreground">
                      {ts.journalResetTroubleshooting ||
                        "If it does not arrive, check spam or junk, keep this device signed in, and resend after the timer."}
                    </p>
                    {resetError && (
                      <p id={resetErrorId} role="alert" className="mb-3 text-center text-xs text-destructive">{resetError}</p>
                    )}
                    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 mb-3">
                      <Loader2 className="w-4 h-4 motion-safe:animate-spin text-primary" aria-hidden="true" />
                      <span className="text-xs text-muted-foreground">
                        {ts.journalResetWaiting || "Waiting for verification..."}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendResetLink}
                      disabled={resetResendRemaining > 0}
                      aria-describedby={resetResendRemaining > 0 ? "journal-reset-resend-cooldown" : undefined}
                      className="w-full py-2 text-xs text-muted-foreground hover:text-foreground motion-safe:transition-colors min-h-[44px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {ts.journalResetResend || "Resend link"}
                    </button>
                    {resetResendRemaining > 0 && (
                      <p
                        id="journal-reset-resend-cooldown"
                        aria-label={formatJournalDuration(
                          ts.journalResetCooldown || "Please wait {duration} before requesting another link.",
                          resetResendRemaining,
                          language,
                        )}
                        className="text-center text-xs text-muted-foreground"
                      >
                        {formatJournalDuration(
                          ts.journalResetCooldown || "Please wait {duration} before requesting another link.",
                          resetResendRemaining,
                          language,
                        )}
                      </p>
                    )}
                    {resetResendRemaining === 0 && (
                      <p role="status" aria-live="polite" className="sr-only">
                        {ts.journalResetResendReady || "You can request another link now."}
                      </p>
                    )}
                    <p className="mb-1 text-center text-xs leading-relaxed text-muted-foreground">
                      {ts.journalResetCloseHint ||
                        "You can close this window. The link stays valid until it expires or is used."}
                    </p>
                    <button
                      ref={resetCancelRef}
                      onClick={closeResetDialog}
                      className="w-full py-2 text-xs text-muted-foreground hover:text-foreground motion-safe:transition-colors min-h-[44px]"
                    >
                      {ts.journalClose || "Close"}
                    </button>
                  </>
                )}

                {/* Success */}
                {resetStep === "success" && (
                  <div className="py-4">
                    <div className="flex justify-center mb-3">
                      <motion.div
                        initial={reducedMotion ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={reducedMotion ? { duration: 0 } : {
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      </motion.div>
                    </div>
                    <h3 className="mb-2 text-center text-base font-semibold text-foreground">
                      {ts.journalResetSuccess || "Diary lock removed"}
                    </h3>
                    <p className="mb-4 text-center text-sm leading-relaxed text-muted-foreground">
                      {ts.journalResetSuccessDetail ||
                        "Your diary is now open without a diary password on this device. Set a new password if you want to keep it protected."}
                    </p>
                    <button
                      type="button"
                      onClick={handleSetNewPasswordAfterReset}
                      className="mb-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground min-h-[44px]"
                    >
                      {ts.journalResetSetNewPassword || "Set new diary password"}
                    </button>
                    <button
                      ref={resetCancelRef}
                      type="button"
                      onClick={closeResetDialog}
                      className="w-full rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground min-h-[44px]"
                    >
                      {ts.journalClose || "Close"}
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
      {/* Main content (unlocked or no password) */}
      {!security.isLocked && !security.loading && (
        <>
          {isDiaryDesktopLayout ? (
            <>
              <div className="flex flex-1 min-h-0">
                <SidebarCompact
                  activeSection={
                    showPasswordSettings
                      ? "settings"
                      : journal.view === "stats"
                        ? "stats"
                        : diaryTabSection === "favorites"
                          ? "favorites"
                          : journal.view === "editing" || journal.view === "viewing"
                            ? "entry"
                            : diaryTabSection
                  }
                  collapsed={isSidebarCollapsed}
                  onOpenStats={handleOpenStats}
                  onOpenFavorites={handleOpenFavorites}
                  onOpenSettings={handleShellSettingsRequest}
                  onShowList={handleShowDiaryPanel}
                  onToggleSidebar={handleToggleDiaryPanel}
                  useSharedDiaryWallpaper={showJournalSidebarAtmosphere}
                />

                <div
                  className={cn(
                    "min-w-0 flex-none overflow-hidden border-e border-border/30 bg-card/86 motion-safe:transition-[width,max-width,flex-basis,opacity] motion-safe:duration-300",
                    isExpanded
                      ? "w-[360px] max-w-[360px] basis-[360px] opacity-100"
                      : "hidden w-0 max-w-0 basis-0 border-e-0 opacity-0 pointer-events-none",
                    showJournalSidebarAtmosphere && "journal-light-sidebar-panel"
                  )}
                  aria-hidden={isSidebarCollapsed}
                  data-testid="journal-sidebar-wide"
                >
                  <div
                    id={JOURNAL_SIDEBAR_PANEL_ID}
                    ref={sidebarContentRef}
                    tabIndex={isExpanded ? -1 : undefined}
                    className="flex h-full w-[360px] flex-col overflow-hidden outline-none"
                  >
                    <motion.div
                      key="sidebar-header"
                      initial={reducedMotion ? false : { opacity: 0, x: isRTL ? 8 : -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, x: isRTL ? 8 : -8 }}
                      transition={springs.quick}
                      className="flex items-center justify-between border-b border-border/20 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-foreground">
                          {ts.journalTitle || "Diary"}
                        </h2>
                        {rewardsEnabled && (
                          <>
                            {streak > 0 && (
                              <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-orange-500/10 bg-gradient-to-r from-orange-500/15 to-amber-500/10 px-1.5 py-0.5 text-xs font-bold text-orange-500 motion-safe:animate-streak-fire-glow">
                                <Flame className="h-3 w-3" aria-hidden="true" />
                                {streak}
                              </span>
                            )}
                            <StreakFreezeIndicator
                              availableFreezes={streakFreeze.availableFreezes}
                              isStreakFrozen={streakFreeze.isStreakFrozen}
                            />
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleOpenStats}
                          className="flex h-[44px] w-[44px] items-center justify-center rounded-lg p-0 text-muted-foreground hover:bg-muted/50"
                          title={ts.journalStatsTitle || "Statistics"}
                          aria-label={ts.journalStatsTitle || "Statistics"}
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleShellSettingsRequest}
                          className="flex h-[44px] w-[44px] items-center justify-center rounded-lg p-0 text-muted-foreground hover:bg-muted/50"
                          title={ts.journalSettings || "Diary settings"}
                          aria-label={ts.settings || "Settings"}
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        {!hideCloseButton && (
                          <button
                            type="button"
                            onClick={handleClose}
                            className="flex h-[44px] w-[44px] items-center justify-center rounded-lg p-0 hover:bg-muted/50"
                            aria-label={ts.close || "Close"}
                          >
                            <X className="w-5 h-5 text-foreground" />
                          </button>
                        )}
                      </div>
                    </motion.div>

                    <motion.div
                      key="sidebar-calendar"
                      initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
                      transition={{ ...springs.smooth, delay: 0.1 }}
                      className="border-b border-border/20 px-4 py-2"
                    >
                      {calendarMode === "full" ? (
                        <Suspense fallback={null}>
                          <LazyJournalCalendarFull
                            today={today}
                            entryDates={journal.entryDates}
                            releaseTraceDates={releaseTraceDates}
                            privateMode={privateMode}
                            selectedDate={journal.selectedDate}
                            onSelectDate={journal.setSelectedDate}
                            onToggleMode={() => {
                              setCalendarMode("strip");
                              storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "strip");
                            }}
                          />
                        </Suspense>
                      ) : (
                        <JournalCalendar
                          today={today}
                          entryDates={journal.entryDates}
                          releaseTraceDates={releaseTraceDates}
                          privateMode={privateMode}
                          selectedDate={journal.selectedDate}
                          onSelectDate={journal.setSelectedDate}
                          onToggleMode={() => {
                            setCalendarMode("full");
                            storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "full");
                          }}
                        />
                      )}
                    </motion.div>

                    <motion.div
                      key="sidebar-entries"
                      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, y: 6 }}
                      transition={{ ...springs.quick, delay: 0.15 }}
                      className="relative flex-1 overflow-y-auto px-3 py-3"
                    >
                      <div className="relative z-[1]">
                        {onboarding.currentHint && (
                          <JournalOnboardingHints
                            currentHint={onboarding.currentHint}
                            position={null}
                            onDismiss={onboarding.dismissHint}
                          />
                        )}
                        {journal.historyLoadError || journal.dateLoadError ? (
                          <JournalBackgroundLoadNotice ts={ts} onRetry={journal.refresh} />
                        ) : null}
                        {journal.loadError ? (
                          <JournalLoadErrorPanel ts={ts} onRetry={journal.refresh} compact />
                        ) : journal.totalCount === 0 && !journal.loading ? (
                          <JournalCompactEmptyListShell
                            ts={ts}
                          />
                        ) : (
                          <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                            <LazyJournalEntryList
                              today={today}
                              groupedEntries={journal.groupedEntries}
                              allEntries={journal.allEntries}
                              onOpenEntry={handleOpenEntryFromShell}
                              onDeleteEntry={handleDeleteEntry}
                              onSwipeDelete={handleDeleteEntry}
                              onNewEntry={handleNewEntryFromShell}
                              onNewEntryWithPrefill={handleNewEntryWithPrefill}
                              totalCount={journal.totalCount}
                              loading={journal.loading}
                              selectedDate={journal.selectedDate}
                              daysSinceLastEntry={daysSinceLastEntry}
                              privateMode={privateMode}
                              onAddGratitude={handleAddGratitudeWithSpace}
                              releaseTraceSummaries={releaseTraceSummaries}
                              onReleaseThought={handleReleaseThought}
                              compact
                              showFab={false}
                              showSpaces={false}
                              useSharedDiaryWallpaper={showJournalSidebarAtmosphere}
                              activeEntryId={journal.activeEntryId}
                              selectedDateOnly
                            />
                          </Suspense>
                        )}
                      </div>
                    </motion.div>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col bg-background/35",
                    showJournalLightAtmosphere && "journal-light-detail-pane"
                  )}
                  data-testid="journal-detail-pane"
                >
                  {showPasswordSettings ? (
                    <div
                      className="flex min-h-0 flex-1 flex-col"
                      data-testid="journal-settings-panel"
                      aria-busy={settingsDismissBlocked}
                      aria-describedby={settingsDismissBlocked ? desktopSettingsBusyStatusId : undefined}
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-border/20 px-5 py-4">
                        <div className="min-w-0">
                          <h2 className="text-base font-semibold text-foreground">
                            {ts.journalSettings || "Diary Settings"}
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {ts.journalLockHint || "Protect your diary and choose how it behaves."}
                          </p>
                          {settingsDismissBlocked ? (
                            <p
                              id={desktopSettingsBusyStatusId}
                              role="status"
                              aria-live="polite"
                              className="mt-2 text-sm font-medium text-foreground"
                            >
                              {importing
                                ? ts.journalImporting || "Importing backup..."
                                : ts.journalSettingsBusy || "Finishing this change..."}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => closeSettings()}
                          disabled={settingsDismissBlocked}
                          aria-describedby={settingsDismissBlocked ? desktopSettingsBusyStatusId : undefined}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={ts.close || "Close"}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
                        <Suspense
                          fallback={
                            <JournalSettingsDeferredFallback label={t.loading || "Loading..."} />
                          }
                        >
                          <LazyJournalSettingsContent
                            ts={ts}
                            security={security}
                            section={settingsSection}
                            onSectionChange={setSettingsSection}
                            privateMode={privateMode}
                            privateModeError={
                              privateModeState.persistenceError
                                ? ts.journalPrivateModeSaveError ||
                                  "ZenFlow could not save this privacy setting. Your diary stays concealed on this screen; keep the app open and try again."
                                : null
                            }
                            onPrivateModeChange={handlePrivateModeChange}
                            onOpenExport={() => {
                              if (settingsBusy) return;
                              if (!isDiaryDesktopLayout) {
                                if (!closeSettings(false)) return;
                              }
                              setShowExportPicker(true);
                            }}
                            onRequestImport={() => fileInputRef.current?.click()}
                            importing={importing}
                            importFeedback={importFeedback}
                            onRequestRemovePassword={() => setShowRemovePasswordConfirm(true)}
                            onBusyChange={setSettingsBusy}
                          />
                        </Suspense>
                      </div>
                    </div>
                  ) : !privateMode && journal.view === "editing" ? (
                    <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                      <LazyJournalEntryEditor
                        key={`desktop-editor-${journal.activeEntryId ?? "new"}`}
                        entry={journal.activeEntry}
                        entryPrefill={activeEntryPrefill}
                        milestonesEnabled={rewardsEnabled}
                        onSave={handleSaveEntry}
                        onAddPhoto={journal.addPhoto}
                        onRemovePhoto={journal.removePhoto}
                        onAddAudio={journal.addAudio}
                        onRemoveAudio={journal.removeAudio}
                        onDelete={
                          journal.activeEntryId
                            ? () => handleDeleteEntry(journal.activeEntryId!)
                            : undefined
                        }
                        onBack={handleEditorBack}
                        onPanicExit={handlePanicExitFromEditor}
                        onToggleHabit={onToggleHabit}
                        onAddGratitude={handleAddGratitudeWithSpace}
                        onReleaseThought={handleReleaseThought}
                        onRequestSettings={openSettings}
                        onBindSettingsRequestHandler={(handler) => {
                          editorSettingsRequestRef.current = handler;
                        }}
                        onBindExitRequestHandler={(handler) => {
                          editorExitRequestRef.current = handler;
                        }}
                        onExitRequestCancelled={handleEditorExitRequestCancelled}
                        onDirtyStateChange={handleEditorDirtyStateChange}
                        useSharedDiaryWallpaper={showJournalSidebarAtmosphere}
                        desktop
                      />
                    </Suspense>
                  ) : !privateMode && journal.view === "viewing" && journal.activeEntry ? (
                    <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                      <LazyJournalEntryViewer
                        entry={journal.activeEntry}
                        onEdit={() => journal.editEntry(journal.activeEntryId)}
                        onDelete={() => handleDeleteEntry(journal.activeEntry?.id || "")}
                        onBack={handleGoBack}
                        onToggleFavorite={handleToggleActiveEntryFavorite}
                        favoritePending={favoriteMutationPending}
                      />
                    </Suspense>
                  ) : journal.view === "stats" ? (
                    <Suspense
                      fallback={
                        <div className="flex-1 flex items-center justify-center">
                          <Loader2
                            className="w-6 h-6 animate-spin text-primary"
                            aria-label={t.loading || "Loading..."}
                          />
                        </div>
                      }
                    >
                      <LazyJournalStats
                        today={today}
                        entries={journal.allEntries}
                        onBack={handleStatsBack}
                        privateMode={privateMode}
                      />
                    </Suspense>
                  ) : diaryTabSection === "favorites" ? (
                    <JournalFavoritesPanel
                      entries={journal.allEntries}
                      onOpenEntry={handleOpenFavoriteEntry}
                      onNewEntry={handleNewEntryFromShell}
                      privateMode={privateMode}
                      language={language}
                      historyLoading={journal.historyLoading}
                      historyLoadError={journal.historyLoadError}
                      onRetryHistory={journal.refresh}
                      ts={ts}
                    />
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-8">
                      <div className="flex min-h-full flex-col gap-4">
                        {listHeaderContent}

                        {!privateMode && hasInitialEntrySuggestion && !autoCreateInitialEntry ? (
                          <DiaryEntrySuggestionCard
                            suggestion={initialSuggestionRef.current!}
                            onStart={handleUseInitialEntrySuggestion}
                            onDismiss={handleDismissInitialEntrySuggestion}
                          />
                        ) : null}

                        {!privateMode && !autoCreateInitialEntry && visibleExtraSuggestions.map((suggestion, index) => (
                          <DiaryEntrySuggestionCard
                            key={getSuggestionDismissKey(suggestion, index)}
                            suggestion={suggestion}
                            onStart={() => handleUseExtraSuggestion(suggestion, index)}
                            onDismiss={() => handleDismissExtraSuggestion(suggestion, index)}
                          />
                        ))}

                        {journal.loading ? (
                          <JournalDeferredPanelFallback label={t.loading || "Loading..."} />
                        ) : journal.loadError ? (
                          <JournalLoadErrorPanel ts={ts} onRetry={journal.refresh} />
                        ) : (
                          <>
                            {journal.historyLoadError || journal.dateLoadError ? (
                              <JournalBackgroundLoadNotice ts={ts} onRetry={journal.refresh} />
                            ) : null}
                            <div className="relative flex min-h-[420px] flex-1 overflow-hidden rounded-[28px] border border-border/40 bg-card/30">
                              <Suspense fallback={null}>
                                <LazyDiaryEmptyCanvas
                                  onNewEntry={handleNewEntry}
                                  onNewEntryWithPrompt={(prompt) => {
                                    handleNewEntryWithPrefill({ content: prompt });
                                  }}
                                  selectedDate={journal.selectedDate}
                                  showWallpaper={!isPagePresentation}
                                />
                              </Suspense>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ═══ MOBILE: existing single-view behavior ═══ */
            <LayoutGroup>
              <>
                {/* Editor overlays on top with its own fixed positioning */}
                <AnimatePresence
                  onExitComplete={handleMobileEditorExitComplete}
                >
                  {!privateMode && journal.view === "editing" && (
                    <motion.div
                      key="editor-transition"
                      {...(shouldAnimate()
                        ? entryModeRef.current === "fab"
                          ? {
                              initial: { scale: 0, opacity: 0, transformOrigin: "bottom right" },
                              animate: { scale: 1, opacity: 1 },
                              exit: { scale: 0, opacity: 0, transformOrigin: "bottom right" },
                              transition: { type: "spring" as const, stiffness: 300, damping: 25 },
                            }
                          : {
                              layoutId: journal.activeEntryId
                                ? `entry-${journal.activeEntryId}`
                                : undefined,
                              initial: { opacity: 0 },
                              animate: { opacity: 1 },
                              exit: { opacity: 0 },
                              transition: { type: "spring" as const, stiffness: 300, damping: 25 },
                            }
                        : {})}
                      className="contents"
                    >
                      <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                        <LazyJournalEntryEditor
                          key={`mobile-editor-${journal.activeEntryId ?? "new"}`}
                          entry={journal.activeEntry}
                          entryPrefill={activeEntryPrefill}
                          milestonesEnabled={rewardsEnabled}
                          onSave={handleSaveEntry}
                          onAddPhoto={journal.addPhoto}
                          onRemovePhoto={journal.removePhoto}
                          onAddAudio={journal.addAudio}
                          onRemoveAudio={journal.removeAudio}
                          onDelete={
                            journal.activeEntryId
                              ? () => handleDeleteEntry(journal.activeEntryId!)
                              : undefined
                          }
                          onBack={handleEditorBack}
                          onPanicExit={handlePanicExitFromEditor}
                          onBindExitRequestHandler={(handler) => {
                            editorExitRequestRef.current = handler;
                          }}
                          onExitRequestCancelled={handleEditorExitRequestCancelled}
                          onDirtyStateChange={handleEditorDirtyStateChange}
                          onToggleHabit={onToggleHabit}
                          onAddGratitude={handleAddGratitudeWithSpace}
                          onReleaseThought={handleReleaseThought}
                        />
                      </Suspense>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* List / Viewer / Stats crossfade */}
                <AnimatePresence mode="wait">
                  {journal.view === "stats" && (
                    <JournalMobileViewSurface
                      key="stats"
                      view="stats"
                      shouldAnimate={shouldAnimate()}
                      className={cn(
                        "flex flex-col flex-1 min-h-0 bg-background",
                        showJournalLightAtmosphere && "journal-light-panel"
                      )}
                    >
                      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-x-2 gap-y-1 border-b border-border/30 bg-gradient-to-r from-primary/[0.03] via-background/80 to-primary/[0.02] px-4 py-3 backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]">
                        <button
                          type="button"
                          onClick={handleStatsBack}
                          className={mobileHeaderActionClass}
                          aria-label={ts.back || "Back"}
                        >
                          <ChevronRight className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden="true" />
                        </button>
                        <div className="col-span-3 row-start-2 min-w-0 text-center min-[420px]:col-span-1 min-[420px]:col-start-2 min-[420px]:row-start-1">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/70">
                            {ts.journalStatsTitle || "Statistics"}
                          </p>
                          <h2 className="min-w-0 whitespace-normal break-words text-base font-black leading-tight text-foreground [hyphens:manual]">
                            {ts.journalMemoryPortalTitle || "Memory portal"}
                          </h2>
                        </div>
                        <span className="col-start-3 row-start-1 min-h-[44px] min-w-[44px]" aria-hidden="true" />
                      </div>

                      <div className="relative flex-1 min-h-0">
                        <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                          <LazyMemoryPortalCanvas
                            ts={ts}
                            language={language}
                            entries={journal.allEntries}
                            moods={moodEntries}
                            groupedEntries={journal.groupedEntries}
                            listTotalCount={journal.entries.length}
                            loading={journal.loading}
                            loadingTheme={loadingTheme}
                            selectedDate={journal.selectedDate}
                            onSelectDate={journal.setSelectedDate}
                            onOpenEntry={handleOpenEntry}
                            onDeleteEntry={handleDeleteEntry}
                            onSwipeDelete={handleDeleteEntry}
                            onNewEntry={handleNewEntry}
                            onNewEntryWithPrefill={handleNewEntryWithPrefill}
                            daysSinceLastEntry={daysSinceLastEntry}
                            privateMode={privateMode}
                            onAddGratitude={handleAddGratitudeWithSpace}
                            releaseTraceSummaries={releaseTraceSummaries}
                            onReleaseThought={handleReleaseThought}
                            showList={false}
                          />
                        </Suspense>
                      </div>
                    </JournalMobileViewSurface>
                  )}

                  {!privateMode && journal.view === "viewing" && journal.activeEntry && (
                    <JournalMobileViewSurface
                      key="viewing"
                      view="viewing"
                      shouldAnimate={shouldAnimate()}
                      className="flex flex-col flex-1 min-h-0"
                    >
                      <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                        <LazyJournalEntryViewer
                          entry={journal.activeEntry}
                          onEdit={() => journal.editEntry(journal.activeEntryId)}
                          onDelete={() => handleDeleteEntry(journal.activeEntry?.id || "")}
                          onBack={handleGoBack}
                          onToggleFavorite={handleToggleActiveEntryFavorite}
                          favoritePending={favoriteMutationPending}
                        />
                      </Suspense>
                    </JournalMobileViewSurface>
                  )}

                  {journal.view === "list" && (
                    <JournalMobileViewSurface
                      key="list"
                      view="list"
                      shouldAnimate={shouldAnimate()}
                      className="flex flex-col flex-1 min-h-0"
                    >
                      {/* Header */}
                      <div className="border-b border-border/30 bg-gradient-to-r from-primary/[0.03] via-background/80 to-primary/[0.02] backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]">
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            {showAppNavMenuButton ? (
                              <button
                                type="button"
                                onClick={onOpenNavMenu}
                                className={mobileHeaderMenuClass}
                                title={ts.navV2OpenMenu || "Open menu"}
                                aria-label={ts.navV2OpenMenu || "Open menu"}
                                aria-expanded={navMenuOpen}
                                aria-controls="nav-v2-drawer"
                                data-testid="journal-mobile-app-nav-menu"
                              >
                                <JournalMenuIcon className="pointer-events-none h-5 w-5" aria-hidden="true" />
                              </button>
                            ) : null}
                            <div className="flex min-w-0 items-center gap-2">
                              <h2
                                className="min-w-0 break-words whitespace-normal text-base font-bold leading-tight text-foreground [hyphens:manual] [overflow-wrap:normal]"
                                data-testid="journal-mobile-title"
                              >
                                {ts.journalTitle || "Diary"}
                              </h2>
                              {rewardsEnabled && streak > 0 && (
                                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-orange-500/10 bg-gradient-to-r from-orange-500/15 to-amber-500/10 px-1.5 py-0.5 text-xs font-bold text-orange-500 motion-safe:animate-streak-fire-glow">
                                  <Flame className="h-3 w-3" aria-hidden="true" />
                                  {streak}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              ref={mobileDiarySidebarTriggerRef}
                              onClick={handleOpenMobileDiarySidebar}
                              className={mobileHeaderMenuClass}
                              title={ts.diarySidebarShow || "Open diary panel"}
                              aria-label={ts.diarySidebarShow || "Open diary panel"}
                              aria-expanded={showMobileDiarySidebar}
                              aria-controls="journal-mobile-diary-sidebar"
                              data-testid="journal-mobile-diary-sidebar-trigger"
                            >
                              <PanelLeftOpen className="pointer-events-none h-5 w-5 rtl:scale-x-[-1]" aria-hidden="true" />
                            </button>
                            {!hideCloseButton && (
                              <button
                                onClick={handleClose}
                                className={mobileHeaderActionClass}
                                aria-label={ts.close || "Close"}
                              >
                                <X className="h-5 w-5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div
                          className="grid grid-cols-4 gap-1 px-4 pb-3"
                          role="toolbar"
                          aria-label={ts.journalTitle || "Diary"}
                          data-testid="journal-mobile-section-toolbar"
                        >
                          <button
                            type="button"
                            onClick={handleShowDiaryPanel}
                            className={mobileHeaderTabClass}
                            title={ts.journalEntry || ts.journalTitle || "Entry"}
                            aria-label={ts.journalEntry || ts.journalTitle || "Entry"}
                            aria-pressed={diaryTabSection === "entry"}
                            aria-current={diaryTabSection === "entry" ? "page" : undefined}
                            data-testid="journal-mobile-entry"
                          >
                            <PenLine className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenStats}
                            className={mobileHeaderTabClass}
                            title={ts.statistics || "Statistics"}
                            aria-label={ts.statistics || "Statistics"}
                            aria-pressed={diaryTabSection === "stats"}
                            data-testid="journal-mobile-stats"
                          >
                            <BarChart3 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenFavorites}
                            className={mobileHeaderTabClass}
                            title={ts.journalFavorites || "Favorites"}
                            aria-label={ts.journalFavorites || "Favorites"}
                            aria-pressed={diaryTabSection === "favorites"}
                            aria-current={diaryTabSection === "favorites" ? "page" : undefined}
                            data-testid="journal-mobile-favorites"
                          >
                            <Star className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openSettings()}
                            className={mobileHeaderTabClass}
                            title={ts.journalSettings || "Diary settings"}
                            aria-label={ts.settings || "Settings"}
                            aria-pressed={diaryTabSection === "settings"}
                            aria-current={diaryTabSection === "settings" ? "page" : undefined}
                            data-testid="journal-mobile-settings"
                          >
                            <Settings className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {diaryTabSection === "favorites" ? (
                        <div className="relative flex-1 min-h-0">
                          <JournalFavoritesPanel
                            entries={journal.allEntries}
                            onOpenEntry={handleOpenFavoriteEntry}
                            onNewEntry={handleNewEntryFromShell}
                            privateMode={privateMode}
                            language={language}
                            historyLoading={journal.historyLoading}
                            historyLoadError={journal.historyLoadError}
                            onRetryHistory={journal.refresh}
                            ts={ts}
                          />
                        </div>
                      ) : (
                        <>
                          {/* Calendar */}
                          <div className="border-b border-border/10 bg-gradient-to-b from-transparent to-muted/5 px-4 py-2">
                            {calendarMode === "full" ? (
                              <Suspense fallback={null}>
                                <LazyJournalCalendarFull
                                  today={today}
                                  entryDates={journal.entryDates}
                                  releaseTraceDates={releaseTraceDates}
                                  privateMode={privateMode}
                                  selectedDate={journal.selectedDate}
                                  onSelectDate={journal.setSelectedDate}
                                  onToggleMode={() => {
                                    setCalendarMode("strip");
                                    storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "strip");
                                  }}
                                />
                              </Suspense>
                            ) : (
                              <JournalCalendar
                                today={today}
                                entryDates={journal.entryDates}
                                releaseTraceDates={releaseTraceDates}
                                privateMode={privateMode}
                                selectedDate={journal.selectedDate}
                                onSelectDate={journal.setSelectedDate}
                                onToggleMode={() => {
                                  setCalendarMode("full");
                                  storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "full");
                                }}
                              />
                            )}
                          </div>

                          {/* Main diary stays lightweight; the cinematic portal lives behind the stats button. */}
                          <div className="relative flex-1 min-h-0">
                            {journal.loading ? (
                              <SplashScreen
                                loadingFadeOut={false}
                                subtitle={ts.initializingApp || "Preparing your zen space..."}
                                theme={loadingTheme}
                                instant
                              />
                            ) : journal.loadError ? (
                              <div className="relative flex h-full min-h-0 flex-col justify-center overflow-y-auto px-4 pb-[calc(1rem+var(--safe-bottom))] pt-4">
                                <JournalLoadErrorPanel ts={ts} onRetry={journal.refresh} />
                              </div>
                            ) : (
                              <div className="relative flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-[calc(1rem+var(--safe-bottom))] pt-4">
                                {listHeaderContent ? <div className="mb-3">{listHeaderContent}</div> : null}

                                {!privateMode && hasInitialEntrySuggestion && !autoCreateInitialEntry ? (
                                  <div className="mb-3">
                                    <DiaryEntrySuggestionCard
                                      suggestion={initialSuggestionRef.current!}
                                      onStart={handleUseInitialEntrySuggestion}
                                      onDismiss={handleDismissInitialEntrySuggestion}
                                      compact
                                    />
                                  </div>
                                ) : null}

                                {!privateMode && !autoCreateInitialEntry && visibleExtraSuggestions.map((suggestion, index) => (
                                  <div
                                    key={getSuggestionDismissKey(suggestion, index)}
                                    className="mb-3"
                                  >
                                    <DiaryEntrySuggestionCard
                                      suggestion={suggestion}
                                      onStart={() => handleUseExtraSuggestion(suggestion, index)}
                                      onDismiss={() => handleDismissExtraSuggestion(suggestion, index)}
                                      compact
                                    />
                                  </div>
                                ))}

                                {journal.historyLoadError || journal.dateLoadError ? (
                                  <JournalBackgroundLoadNotice ts={ts} onRetry={journal.refresh} />
                                ) : null}

                                <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                                  {journal.entries.length === 0 ? (
                                    <LazyDiaryEmptyCanvas
                                      onNewEntry={handleNewEntry}
                                      onNewEntryWithPrompt={(prompt) => {
                                        handleNewEntryWithPrefill({ content: prompt });
                                      }}
                                      selectedDate={journal.selectedDate}
                                      showWallpaper={false}
                                    />
                                  ) : (
                                    <LazyJournalEntryList
                                      today={today}
                                      groupedEntries={journal.groupedEntries}
                                      allEntries={journal.allEntries}
                                      onOpenEntry={handleOpenEntry}
                                      onDeleteEntry={handleDeleteEntry}
                                      onSwipeDelete={handleDeleteEntry}
                                      onNewEntry={handleNewEntry}
                                      onNewEntryWithPrefill={handleNewEntryWithPrefill}
                                      totalCount={journal.entries.length}
                                      loading={journal.loading}
                                      selectedDate={journal.selectedDate}
                                      daysSinceLastEntry={daysSinceLastEntry}
                                      privateMode={privateMode}
                                      onAddGratitude={handleAddGratitudeWithSpace}
                                      releaseTraceSummaries={releaseTraceSummaries}
                                      onReleaseThought={handleReleaseThought}
                                      useSharedDiaryWallpaper={showJournalSidebarAtmosphere}
                                      selectedDateOnly
                                    />
                                  )}
                                </Suspense>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {typeof document !== "undefined" ? createPortal(
                        <AnimatePresence>
                          {!isDiaryDesktopLayout && showMobileDiarySidebar ? (
                          <Fragment key="mobile-diary-sidebar-layer">
                            <motion.div
                              key="mobile-diary-sidebar-backdrop"
                              initial={shouldAnimate() ? { opacity: 0 } : undefined}
                              animate={{ opacity: 1 }}
                              exit={shouldAnimate() ? { opacity: 0 } : undefined}
                              transition={{ duration: 0.18 }}
                              style={{ zIndex: 120 }}
                              className="fixed inset-0 bg-background/55 backdrop-blur-sm [-webkit-backdrop-filter:blur(12px)]"
                              onClick={() => closeMobileDiarySidebar()}
                              data-testid="journal-mobile-diary-sidebar-backdrop"
                            />
                            <motion.aside
                              key="mobile-diary-sidebar"
                              role="dialog"
                              aria-modal="true"
                              aria-label={ts.journalTitle || "Diary"}
                              id="journal-mobile-diary-sidebar"
                              ref={mobileDiarySidebarRef}
                              data-testid="journal-mobile-diary-sidebar"
                              initial={shouldAnimate() ? { x: isRTL ? 32 : -32 } : undefined}
                              animate={{ x: 0 }}
                              exit={shouldAnimate() ? {
                                x: isRTL ? 32 : -32,
                                opacity: 0,
                                transition: { type: "tween", duration: 0.16, ease: "easeOut" },
                              } : undefined}
                              transition={{ type: "spring", stiffness: 420, damping: 34 }}
                              style={{ zIndex: 121 }}
                              className={cn(
                                "fixed inset-y-0 flex w-[min(360px,88vw)] flex-col overflow-hidden border-border/35 shadow-[0_24px_80px_hsl(var(--foreground)/0.24)] backdrop-blur-2xl [-webkit-backdrop-filter:blur(22px)] pb-safe pt-safe",
                                showJournalSidebarAtmosphere ? "journal-light-sidebar-panel journal-light-sidebar-drawer bg-background/70" : "bg-background",
                                isRTL ? "right-0 border-s" : "left-0 border-e"
                              )}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/20 px-4 py-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">
                                    {ts.journalEntry || "Entry"}
                                  </p>
                                  <h2 className="min-w-0 break-words whitespace-normal text-lg font-black leading-tight text-foreground [hyphens:manual] [overflow-wrap:normal]">
                                    {ts.journalTitle || "Diary"}
                                  </h2>
                                </div>
                                <button
                                  type="button"
                                  ref={mobileDiarySidebarCloseRef}
                                  onClick={() => closeMobileDiarySidebar()}
                                  className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                                  aria-label={ts.close || "Close"}
                                  data-testid="journal-mobile-diary-sidebar-close"
                                >
                                  <X className="h-5 w-5" aria-hidden="true" />
                                </button>
                              </div>

                              <div className="grid shrink-0 grid-cols-2 min-[420px]:grid-cols-4 gap-2 border-b border-border/20 px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeMobileDiarySidebar(false);
                                    handleShowDiaryPanel();
                                  }}
                                  className={mobileDiarySectionButtonClass(diaryTabSection === "entry")}
                                  aria-label={ts.journalEntry || "Entry"}
                                  aria-current={diaryTabSection === "entry" ? "page" : undefined}
                                >
                                  <PenLine className="h-4 w-4" aria-hidden="true" />
                                  <span className="whitespace-normal break-words text-xs font-bold">{ts.journalEntry || "Entry"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeMobileDiarySidebar(false);
                                    handleOpenStats();
                                  }}
                                  className={mobileDiarySectionButtonClass(diaryTabSection === "stats")}
                                  aria-label={ts.statistics || "Statistics"}
                                  aria-current={diaryTabSection === "stats" ? "page" : undefined}
                                >
                                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                                  <span className="whitespace-normal break-words text-xs font-bold">{ts.statistics || "Stats"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeMobileDiarySidebar(false);
                                    handleOpenFavorites();
                                  }}
                                  className={mobileDiarySectionButtonClass(diaryTabSection === "favorites")}
                                  aria-label={ts.journalFavorites || "Favorites"}
                                  aria-current={diaryTabSection === "favorites" ? "page" : undefined}
                                >
                                  <Star className="h-4 w-4" aria-hidden="true" />
                                  <span className="whitespace-normal break-words text-xs font-bold">{ts.journalFavorites || "Favorites"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeMobileDiarySidebar(false);
                                    openSettings("overview", mobileDiarySidebarTriggerRef.current);
                                  }}
                                  className={mobileDiarySectionButtonClass(showPasswordSettings || diaryTabSection === "settings")}
                                  aria-label={ts.settings || "Settings"}
                                  aria-current={showPasswordSettings || diaryTabSection === "settings" ? "page" : undefined}
                                >
                                  <Settings className="h-4 w-4" aria-hidden="true" />
                                  <span className="whitespace-normal break-words text-xs font-bold">{ts.settings || "Settings"}</span>
                                </button>
                              </div>

                              <div
                                className="shrink-0 border-b border-border/20 px-3 py-2"
                                data-testid="journal-mobile-diary-sidebar-calendar"
                              >
                                {calendarMode === "full" ? (
                                  <Suspense fallback={null}>
                                      <LazyJournalCalendarFull
                                        today={today}
                                        entryDates={journal.entryDates}
                                      releaseTraceDates={releaseTraceDates}
                                      privateMode={privateMode}
                                      selectedDate={journal.selectedDate}
                                      onSelectDate={journal.setSelectedDate}
                                      onToggleMode={() => {
                                        setCalendarMode("strip");
                                        storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "strip");
                                      }}
                                    />
                                  </Suspense>
                                ) : (
                                    <JournalCalendar
                                      today={today}
                                      entryDates={journal.entryDates}
                                    releaseTraceDates={releaseTraceDates}
                                    privateMode={privateMode}
                                    selectedDate={journal.selectedDate}
                                    onSelectDate={journal.setSelectedDate}
                                    onToggleMode={() => {
                                      setCalendarMode("full");
                                      storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "full");
                                    }}
                                  />
                                )}
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                                {journal.historyLoadError || journal.dateLoadError ? (
                                  <JournalBackgroundLoadNotice ts={ts} onRetry={journal.refresh} />
                                ) : null}
                                {journal.loadError ? (
                                  <JournalLoadErrorPanel ts={ts} onRetry={journal.refresh} compact />
                                ) : journal.totalCount === 0 && !journal.loading ? (
                                  <JournalCompactEmptyListShell
                                    ts={ts}
                                  />
                                ) : (
                                  <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                                    <LazyJournalEntryList
                                      today={today}
                                      groupedEntries={journal.groupedEntries}
                                      allEntries={journal.allEntries}
                                      onOpenEntry={(entryId) => {
                                        closeMobileDiarySidebar(false);
                                        handleOpenEntryFromShell(entryId);
                                      }}
                                      onDeleteEntry={handleDeleteEntry}
                                      onSwipeDelete={handleDeleteEntry}
                                      onNewEntry={() => {
                                        closeMobileDiarySidebar(false);
                                        handleNewEntryFromShell();
                                      }}
                                      onNewEntryWithPrefill={(prefill) => {
                                        closeMobileDiarySidebar(false);
                                        handleNewEntryWithPrefill(prefill);
                                      }}
                                      totalCount={journal.totalCount}
                                      loading={journal.loading}
                                      selectedDate={journal.selectedDate}
                                      daysSinceLastEntry={daysSinceLastEntry}
                                      privateMode={privateMode}
                                      onAddGratitude={handleAddGratitudeWithSpace}
                                      releaseTraceSummaries={releaseTraceSummaries}
                                      onReleaseThought={handleReleaseThought}
                                      compact
                                      showFab={false}
                                      showSpaces={false}
                                      activeEntryId={journal.activeEntryId}
                                      useSharedDiaryWallpaper={showJournalSidebarAtmosphere}
                                      selectedDateOnly
                                    />
                                  </Suspense>
                                )}
                              </div>

                              <div className="shrink-0 border-t border-border/20 p-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeMobileDiarySidebar(false);
                                    handleNewEntryFromShell();
                                  }}
                                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_14px_34px_hsl(var(--primary)/0.22)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                                  data-testid="journal-mobile-diary-sidebar-new-entry"
                                >
                                  <Plus className="h-4 w-4" aria-hidden="true" />
                                  {ts.journalWriteEntry || ts.journalNewEntry || "New entry"}
                                </button>
                              </div>
                            </motion.aside>
                          </Fragment>
                          ) : null}
                        </AnimatePresence>,
                        document.body
                      ) : null}

                      {/* Password settings bottom sheet — mobile only (desktop rendered below ternary) */}
                      {!isDiaryDesktopLayout && showPasswordSettings && (
                        <>
                          <div
                            className="fixed inset-0 z-[64] bg-black/30 dark:bg-black/30 motion-safe:animate-fade-in"
                            onClick={() => closeSettings()}
                          />
                          <div
                            role="dialog"
                            aria-modal="true"
                            aria-label={ts.journalSettings || "Diary Settings"}
                            aria-busy={settingsDismissBlocked}
                            aria-describedby={settingsDismissBlocked ? mobileSettingsBusyStatusId : undefined}
                            ref={mobileSettingsPanelRef}
                            data-testid="journal-mobile-settings-panel"
                            className={cn(
                              "fixed bottom-0 inset-x-0 z-[65] flex max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] flex-col overflow-hidden motion-safe:animate-slide-up pb-safe lg:mx-auto lg:max-w-4xl",
                              showJournalSidebarAtmosphere
                                ? "journal-diary-glass-panel rounded-t-[28px] border border-border/35 shadow-[0_-24px_80px_hsl(var(--foreground)/0.18)]"
                                : "rounded-t-2xl bg-card",
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Handle bar */}
                            <div
                              className={cn(
                                "flex shrink-0 justify-center pb-1 pt-2",
                                showJournalSidebarAtmosphere ? "bg-transparent" : "rounded-t-2xl bg-card",
                              )}
                            >
                              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <div
                              className={cn(
                                "min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,var(--safe-bottom))]",
                                showJournalSidebarAtmosphere ? "bg-transparent" : "bg-card",
                              )}
                            >
                              <div className="mb-4 flex items-center justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  {showAppNavMenuButton ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!closeSettings(false)) return;
                                        onOpenNavMenu();
                                      }}
                                      disabled={settingsDismissBlocked}
                                      className={cn(mobileHeaderMenuClass, "disabled:cursor-not-allowed disabled:opacity-50")}
                                      title={ts.navV2OpenMenu || "Open menu"}
                                      aria-label={ts.navV2OpenMenu || "Open menu"}
                                      aria-expanded={navMenuOpen}
                                      aria-controls="nav-v2-drawer"
                                      data-testid="journal-settings-nav-menu"
                                    >
                                      <JournalMenuIcon className="pointer-events-none h-5 w-5" aria-hidden="true" />
                                    </button>
                                  ) : null}
                                  <h3 className="min-w-0 break-words whitespace-normal text-base font-semibold leading-tight text-foreground [hyphens:manual] [overflow-wrap:normal]">
                                    {ts.journalSettings || "Diary Settings"}
                                  </h3>
                                  {settingsDismissBlocked ? (
                                    <p
                                      id={mobileSettingsBusyStatusId}
                                      role="status"
                                      aria-live="polite"
                                      className="sr-only"
                                    >
                                      {importing
                                        ? ts.journalImporting || "Importing backup..."
                                        : ts.journalSettingsBusy || "Finishing this change..."}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  ref={mobileSettingsCloseRef}
                                  onClick={() => closeSettings()}
                                  disabled={settingsDismissBlocked}
                                  aria-describedby={settingsDismissBlocked ? mobileSettingsBusyStatusId : undefined}
                                  className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label={ts.close || "Close"}
                                  data-testid="journal-mobile-settings-close"
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              </div>

                              <Suspense
                                fallback={
                                  <JournalSettingsDeferredFallback label={t.loading || "Loading..."} />
                                }
                              >
                                <LazyJournalSettingsContent
                                  ts={ts}
                                  security={security}
                                  section={settingsSection}
                                  onSectionChange={setSettingsSection}
                                  privateMode={privateMode}
                                  privateModeError={
                                    privateModeState.persistenceError
                                      ? ts.journalPrivateModeSaveError ||
                                        "ZenFlow could not save this privacy setting. Your diary stays concealed on this screen; keep the app open and try again."
                                      : null
                                  }
                                  onPrivateModeChange={handlePrivateModeChange}
                                  onOpenExport={() => {
                                    if (!closeSettings(false)) return;
                                    setShowExportPicker(true);
                                  }}
                                  onRequestImport={() => fileInputRef.current?.click()}
                                  importing={importing}
                                  importFeedback={importFeedback}
                                  onRequestRemovePassword={() => setShowRemovePasswordConfirm(true)}
                                  onBusyChange={setSettingsBusy}
                                />
                              </Suspense>

                              {/* Screenshot blocking (native only) */}
                              {screenSecurity.isSupported && (
                                <div className="mt-4 pt-4 border-t border-border/20">
                                  <div className="flex items-center justify-between min-h-[44px]">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">
                                        {ts.journalScreenshotBlock || "Block Screenshots"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {ts.journalScreenshotBlockSubtitle ||
                                          "Prevent screen capture while diary is open"}
                                      </p>
                                    </div>
                                    <Switch
                                      checked={screenSecurity.enabled}
                                      onCheckedChange={screenSecurity.setEnabled}
                                      aria-label={ts.journalScreenshotBlock || "Block Screenshots"}
                                      className="mt-0.5 shrink-0"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Native reminder toggle. Web/PWA/Desktop do not have a reliable local scheduler. */}
                              {reminder.supported && (
                              <div className="mt-4 pt-4 border-t border-border/20">
                                <div className="flex items-center justify-between min-h-[44px]">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">
                                      {ts.journalReminderEnabled || "Daily reminder"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {ts.journalReminderSubtitle || "Get reminded to write"}
                                    </p>
                                  </div>
                                  <Switch
                                    checked={reminder.enabled}
                                    onCheckedChange={(enabled) => {
                                      void reminder.setEnabled(enabled).catch(() => undefined);
                                    }}
                                    aria-label={ts.journalReminderEnabled || "Daily reminder"}
                                    className="mt-0.5 shrink-0"
                                  />
                                </div>
                                {reminder.enabled && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-muted-foreground">
                                      {ts.journalReminderTime || "Time"}:
                                    </span>
                                    <input
                                      type="time"
                                      value={`${String(reminder.hour).padStart(2, "0")}:${String(reminder.minute).padStart(2, "0")}`}
                                      onChange={(e) => {
                                        const [h, m] = e.target.value.split(":").map(Number);
                                        if (!isNaN(h) && !isNaN(m)) {
                                          void reminder.setTime(h, m).catch(() => undefined);
                                        }
                                      }}
                                      className="min-h-[48px] rounded-lg border border-border/30 bg-muted/50 px-2 py-1 text-sm text-foreground"
                                    />
                                  </div>
                                )}
                                {reminder.saveError ? (
                                  <p role="status" className="mt-2 text-xs text-destructive">
                                    {reminder.saveOutcome === "unknown"
                                      ? ts.journalReminderStateUnknown ||
                                        "ZenFlow could not confirm the reminder state. Open this setting again and try once more."
                                      : ts.journalReminderSaveError ||
                                        "The reminder was not changed. Please try again."}
                                  </p>
                                ) : null}
                              </div>
                              )}

                            </div>
                          </div>
                        </>
                      )}

                      {/* Export format picker */}
                      {showExportPicker && (
                        <Suspense fallback={<JournalModalDeferredFallback label={t.loading || "Loading..."} />}>
                          <LazyExportPickerDialog
                            ts={ts}
                            language={language}
                            exporting={exporting}
                            setExporting={setExporting}
                            onClose={() => setShowExportPicker(false)}
                          />
                        </Suspense>
                      )}
                    </JournalMobileViewSurface>
                  )}
                </AnimatePresence>
              </>
            </LayoutGroup>
          )}
        </>
      )}

      {/* Undo delete snackbar */}
      <AnimatePresence>
        {(pendingDelete || deleteCommitMessage) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 inset-x-4 z-[55] flex justify-center pointer-events-none"
          >
            <div
              role="status"
              aria-live="polite"
              className="bg-foreground text-background rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg max-w-sm w-full pointer-events-auto"
            >
              <span className="text-sm flex-1">
                {pendingDelete
                  ? pendingDeletes.length > 1
                    ? ts.entriesDeleted || "Entries deleted"
                    : ts.entryDeleted || "Entry deleted"
                  : deleteCommitMessage}
              </span>
              {pendingDelete && (
                <button
                  onClick={handleUndoDelete}
                  className="text-sm font-semibold text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  {ts.undo || "Undo"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {pendingJournalImport && (
        <Suspense fallback={<JournalModalDeferredFallback label={t.loading || "Loading..."} />}>
          <LazyJournalImportConfirmDialog
            ts={ts}
            filename={pendingJournalImport.file.name}
            inspection={pendingJournalImport.inspection}
            busy={importing}
            onCancel={() => setPendingJournalImport(null)}
            onConfirm={() => void handleConfirmJournalImport()}
          />
        </Suspense>
      )}

      {/* Remove password confirmation dialog */}
      {showRemovePasswordConfirm && (
        <Suspense fallback={<JournalModalDeferredFallback label={t.loading || "Loading..."} />}>
          <LazyRemovePasswordConfirmDialog
            ts={ts}
            onClose={() => setShowRemovePasswordConfirm(false)}
            getReturnFocusFallback={getPasswordRemovalFocusFallback}
            onConfirm={async () => {
              setRemovePasswordSubmitting(true);
              try {
                await security.removePassword();
                announceSuccess(ts.journalPasswordRemoveSuccess || "Password lock removed.");
                setShowRemovePasswordConfirm(false);
                setSettingsSection("overview");
              } finally {
                setRemovePasswordSubmitting(false);
              }
            }}
          />
        </Suspense>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <Suspense fallback={null}>
          <LazyKeyboardShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </Suspense>
      )}

      {ENABLE_JOURNAL_SAVE_CEREMONY ? (
        <JournalSaveCeremonyHost
          receipt={saveCeremonyPresentation?.receipt ?? null}
          lifecycleToken={saveCeremonyPresentation?.lifecycle ?? null}
          eligible={
            journal.view === "list" &&
            !privateMode &&
            !showPasswordSettings &&
            celebratingStreak === null &&
            (isDiaryDesktopLayout || !mobileEditorSurfacePresent)
          }
          onConsume={handleSaveCeremonyConsume}
        />
      ) : null}

      {/* Streak milestone celebration overlay */}
      <AnimatePresence>
        {celebratingStreak !== null && (
          <Suspense fallback={null}>
            <LazyStreakCelebration
              streak={celebratingStreak}
              onDone={() => setCelebratingStreak(null)}
              language={language}
              translations={t}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );

  if (isPagePresentation) {
    return (
      <section
        ref={overlayRef}
        aria-label={ts.journalTitle || "Diary"}
        className="v2-fullscreen-page relative flex min-h-[var(--app-viewport-height)] w-full flex-col bg-background lg:h-[var(--app-viewport-height)] lg:overflow-hidden"
        dir={isRTL ? "rtl" : "ltr"}
        data-testid="journal-page-shell"
      >
        <DiaryWallpaper surface="page" />
        {moduleContent}
      </section>
    );
  }

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={ts.journalTitle || "Diary"}
      className={cn(
        "fixed inset-x-0 top-0 z-[60] h-[var(--app-viewport-height)] bg-background flex items-start justify-center motion-safe:animate-slide-up overflow-hidden",
        "md:bg-background/80 md:backdrop-blur-sm",
        "lg:left-[var(--sidebar-width,256px)] lg:bg-background lg:backdrop-blur-none lg:transition-[left] lg:duration-300 lg:items-stretch"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {moduleContent}
    </div>,
    document.body
  );
});
