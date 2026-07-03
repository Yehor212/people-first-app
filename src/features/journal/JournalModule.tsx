import {
  useState,
  useEffect,
  useCallback,
  useId,
  useRef,
  useMemo,
  Suspense,
  memo,
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
  Upload,
  BarChart3,
  Flame,
  PanelLeftOpen,
  Star,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "framer-motion";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn, formatDate, getToday } from "@/lib/utils";
import { V2_SHELL_ICONS } from "@/lib/v2IconSystem";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { consumePendingDiaryEditorOpen, subscribeToDiaryEditorOpen } from "@/lib/diaryDeepLinkIntent";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import { createFocusTrap, getFocusableElements, announceSuccess, announceError } from "@/lib/a11y";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { IS_DESKTOP_RUNTIME } from "@/lib/env";
import { Switch } from "@/components/ui/switch";
import { SplashScreen, type SplashThemePreference } from "@/components/SplashScreen";
import { triggerSync } from "@/storage/cloudSync";
import { settingsRepo } from "@/storage/db";
import type { Database } from "@/types/supabase";
import { useJournal } from "./useJournal";
import { useJournalSecurity } from "./useJournalSecurity";
import { JournalLockScreen } from "./JournalLockScreen";
import { SidebarCompact, type DiarySidebarSection } from "./SidebarCompact";
import { DiaryEntrySuggestionCard } from "./DiaryEntrySuggestionCard";
import { OnThisDayCard } from "./OnThisDayCard";
import { JournalOnboardingHints, useJournalOnboarding } from "./JournalOnboardingHints";
import { JournalCalendar } from "./JournalCalendar";
import { formatLocalizedCount } from "./journalWordCount";
import { getEntryCount, hasEncryptedJournalContent, hasEncryptedJournalMedia } from "./journalStorage";
import {
  createGratitudeSpaceCapture,
  createQuietReleaseSession,
  getQuietReleaseTraceSummaries,
  linkEntryToSpace,
} from "./journalHubStorage";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw, storageRemove } from "@/lib/safeJson";
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
import type {
  JournalEntry,
  JournalEntryPrefill,
  JournalEntrySuggestion,
  JournalReleaseTraceSummary,
} from "./types";
import { DiaryMiniOrb } from "./DiaryMiniOrb";
import { DiaryWallpaper } from "./DiaryWallpaper";
import { getJournalPreviewText } from "./journalDisplay";
import { getJournalQuote } from "./journalQuotes";

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

// Lazy-load JournalStats because it is a dense stats surface.
const LazyJournalStats = lazyWithRetry(
  () => import("./JournalStats").then((m) => ({ default: m.JournalStats })),
  "JournalStats"
);

type DeferredJournalModule = Record<string, ComponentType<any>>;
type JournalSettingsContentComponent =
  typeof import("./JournalSettingsContent").JournalSettingsContent;
type ExportPickerDialogComponent = typeof import("./ExportPickerDialog").ExportPickerDialog;
type RemovePasswordConfirmDialogComponent =
  typeof import("./RemovePasswordConfirmDialog").RemovePasswordConfirmDialog;
type KeyboardShortcutsOverlayComponent =
  typeof import("./KeyboardShortcutsOverlay").KeyboardShortcutsOverlay;
type StreakCelebrationComponent = typeof import("./StreakCelebration").StreakCelebration;
type JournalCalendarFullComponent = typeof import("./JournalCalendarFull").JournalCalendarFull;

const deferredJournalModules = import.meta.glob<DeferredJournalModule>(
  "./{ExportPickerDialog,JournalCalendarFull,JournalSettingsContent,KeyboardShortcutsOverlay,RemovePasswordConfirmDialog,StreakCelebration}.tsx",
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

type JournalPasswordResetRequest = {
  email: string;
  nonce: string;
  startedAt: number;
};

const JOURNAL_PASSWORD_RESET_WINDOW_MS = 600_000;

function normalizeJournalResetEmail(email: string | null | undefined): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function createJournalPasswordResetNonce(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
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

function hasJournalPasswordResetRedirectProof(pending: JournalPasswordResetRequest): boolean {
  if (typeof window === "undefined") return false;

  return getJournalPasswordResetNonceFromUrl(window.location.href) === pending.nonce;
}

function hasJournalPasswordResetProof(pending: JournalPasswordResetRequest): boolean {
  return (
    hasJournalPasswordResetRedirectProof(pending) ||
    hasStoredJournalPasswordResetProof(pending.nonce, JOURNAL_PASSWORD_RESET_WINDOW_MS)
  );
}

function serializeJournalPasswordResetRequest(email: string, nonce: string): string {
  return JSON.stringify({
    email: normalizeJournalResetEmail(email),
    nonce,
    startedAt: Date.now(),
  } satisfies JournalPasswordResetRequest);
}

function parseJournalPasswordResetRequest(raw: string | null): JournalPasswordResetRequest | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<JournalPasswordResetRequest>;
    const email = normalizeJournalResetEmail(parsed.email);
    const nonce = typeof parsed.nonce === "string" ? parsed.nonce.trim() : "";
    const startedAt = Number(parsed.startedAt);
    if (!email || !nonce || !Number.isFinite(startedAt)) return null;
    return { email, nonce, startedAt };
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

function JournalCompactEmptyListShell({
  ts,
  onNewEntry,
}: {
  ts: Record<string, string>;
  onNewEntry: () => void;
}) {
  const currentJournalQuote = getJournalQuote(ts);

  return (
    <div className="space-y-3 pb-4" data-testid="journal-compact-empty-list">
      <div className="rounded-2xl border border-border/25 bg-card/45 p-4 text-center backdrop-blur-xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.10] text-primary">
          <PenLine className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {ts.journalEmpty || "Your diary is empty"}
        </h3>
        <p className="mx-auto mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
          {ts.journalEmptyHint || "Start writing to capture your thoughts, feelings, and memories."}
        </p>
        <figure
          className="mx-auto mt-3 max-w-[240px] text-xs italic leading-relaxed text-muted-foreground"
          aria-label={ts.journalReflectionQuoteLabel || "A quiet quote"}
          dir="auto"
        >
          <blockquote>{currentJournalQuote}</blockquote>
        </figure>
        <button
          type="button"
          onClick={onNewEntry}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_14px_34px_hsl(var(--primary)/0.20)] motion-safe:transition-transform active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {ts.journalWriteFirstEntry || ts.journalNewEntry || "Write first entry"}
        </button>
      </div>
    </div>
  );
}

const FAVORITE_ENTRY_TAGS = new Set([
  "favorite",
  "favorites",
  "favourite",
  "favourites",
  "starred",
  "fav",
  "обране",
  "избранное",
  "favorito",
  "favoritos",
  "favori",
  "favoris",
  "favorit",
  "favoriten",
  "お気に入り",
  "المفضلة",
  "מועדף",
  "מועדפים",
]);

function isFavoriteJournalEntry(entry: Pick<JournalEntry, "tags">): boolean {
  return entry.tags.some((tag) => FAVORITE_ENTRY_TAGS.has(tag.trim().toLowerCase()));
}

function JournalFavoritesPanel({
  entries,
  onOpenEntry,
  onNewEntry,
  privateMode,
  ts,
}: {
  entries: JournalEntry[];
  onOpenEntry: (entryId: string) => void;
  onNewEntry: () => void;
  privateMode: boolean;
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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.12] text-primary">
            <Star className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-foreground">
              {ts.journalFavorites || "Favorites"}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {ts.journalFavoritesEmptyHint || "Add a favorite tag to an entry to keep it here."}
            </p>
          </div>
        </div>

        {favorites.length === 0 ? (
          <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-border/45 bg-background/55 p-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-primary/20 bg-primary/[0.10] text-primary">
              <Star className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {ts.journalFavoritesEmptyTitle || "No favorites yet"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {ts.journalFavoritesEmptyHint || "Add a favorite tag to an entry to keep it here."}
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
                    <span className="block truncate text-base font-bold text-foreground">
                      {ts.journalPrivateEntry || ts.privateMode || "Private entry"}
                    </span>
                    <span className="mt-2 block max-h-12 overflow-hidden text-sm leading-relaxed text-muted-foreground">
                      {ts.journalPrivateEntryHint || "Unlock private mode to view this memory."}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary/75">
                      {entry.date}
                    </span>
                    <span className="mt-2 block truncate text-base font-bold text-foreground">
                      {entry.title || ts.journalEntryTitle || "Entry"}
                    </span>
                    <span className="mt-2 block max-h-12 overflow-hidden text-sm leading-relaxed text-muted-foreground">
                      {getJournalPreviewText(entry.content, ts) || ts.journalEmptyHint || "A quiet saved moment."}
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
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
  const [calendarMode, setCalendarMode] = useState<"strip" | "full">(() => {
    return storageGetRaw(SK.JOURNAL_CALENDAR_MODE, "strip") as "strip" | "full";
  });
  const [privateMode, setPrivateMode] = useState(() => {
    return storageGetRaw(SK.JOURNAL_PRIVATE_MODE) === "true";
  });

  const [showExportPicker, setShowExportPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  type ResetStep = "idle" | "checking" | "no-account" | "unavailable" | "confirm" | "sending" | "sent" | "success";
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [emailLockRemovalBlocked, setEmailLockRemovalBlocked] = useState(true);
  const lastResetOtpRef = useRef(0);
  const resetRequestSeqRef = useRef(0);
  const resetDialogRef = useRef<HTMLDivElement | null>(null);
  const resetCancelRef = useRef<HTMLButtonElement | null>(null);
  const resetTitleId = useId();
  const resetDescriptionId = useId();
  const resetErrorId = useId();
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [showRemovePasswordConfirm, setShowRemovePasswordConfirm] = useState(false);
  const [removePasswordSubmitting, setRemovePasswordSubmitting] = useState(false);
  const [celebratingStreak, setCelebratingStreak] = useState<number | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const {
    sidebarState,
    setSidebarState,
    toggleSidebar,
    isExpanded,
    isCollapsed,
  } = useSidebarState();
  const initialSuggestionConsumedRef = useRef(false);
  const initialSuggestionRef = useRef<JournalEntrySuggestion | null>(initialEntrySuggestion);
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null);
  const settingsReturnTabRef = useRef<DiarySidebarSection>("entry");
  const editorSettingsRequestRef = useRef<(() => void) | null>(null);

  if (initialEntrySuggestion && !initialSuggestionConsumedRef.current) {
    initialSuggestionRef.current = initialEntrySuggestion;
  }
  useSidebarKeyboard(sidebarState, toggleSidebar, setSidebarState);
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

  const closeSettings = useCallback((restoreFocus = true) => {
    setShowPasswordSettings(false);
    setDiaryTabSection(settingsReturnTabRef.current === "settings" ? "entry" : settingsReturnTabRef.current);
    setSettingsSection("overview");

    if (!restoreFocus) return;
    settingsReturnFocusRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => settingsReturnFocusRef.current?.focus({ preventScroll: true }));
  }, []);

  const checkEmailLockRemovalAvailable = useCallback(async () => {
    if (!isEmailLockRemovalAvailable) return false;
    if (security.vaultKey) return true;

    try {
      const [hasEncryptedContent, hasEncryptedMedia] = await Promise.all([
        hasEncryptedJournalContent(),
        hasEncryptedJournalMedia(),
      ]);
      return !hasEncryptedContent && !hasEncryptedMedia;
    } catch (error) {
      logger.warn("[Journal] Email lock removal availability check failed:", error);
      return false;
    }
  }, [isEmailLockRemovalAvailable, security.vaultKey]);

  const canOfferEmailLockRemoval = isEmailLockRemovalAvailable && !emailLockRemovalBlocked;

  useEffect(() => {
    let cancelled = false;

    if (!isEmailLockRemovalAvailable || !security.hasPassword || !security.isLocked || security.loading) {
      setEmailLockRemovalBlocked(true);
      return undefined;
    }

    setEmailLockRemovalBlocked(true);
    void checkEmailLockRemovalAvailable().then((available) => {
      if (!cancelled) setEmailLockRemovalBlocked(!available);
    });

    return () => {
      cancelled = true;
    };
  }, [checkEmailLockRemovalAvailable, isEmailLockRemovalAvailable, security.hasPassword, security.isLocked, security.loading]);

  const closeResetDialog = useCallback(() => {
    if (resetStep === "sending") return;
    if (resetStep === "sent") {
      storageRemove(SK.JOURNAL_PASSWORD_RESET);
      clearJournalPasswordResetProof();
      clearJournalPasswordResetParamFromCurrentUrl();
    }
    resetRequestSeqRef.current += 1;
    setResetStep("idle");
    setResetEmail("");
    setResetError("");
  }, [resetStep]);

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

  // Undo delete state (soft-delete → 5s timer → commit)
  type PendingDelete = {
    id: string;
    entry: (typeof journal.entries)[0];
  };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteCommitMessage, setDeleteCommitMessage] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const deleteFeedbackTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isMountedRef = useRef(true);
  const pendingDeleteRef = useRef(pendingDelete);
  useEffect(() => {
    pendingDeleteRef.current = pendingDelete;
  }, [pendingDelete]);
  useEffect(
    () => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        clearTimeout(deleteTimerRef.current);
        clearTimeout(deleteFeedbackTimerRef.current);
        if (pendingDeleteRef.current) {
          journal
            .commitDeleteEntry(pendingDeleteRef.current.id)
            .catch((err) => logger.warn("[Journal]", "Cleanup commitDelete failed:", err));
        }
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only: journal ref is stable, intentionally excluded to avoid re-running cleanup
    []
  );

  // Streak calculation from all entry dates
  const streak = useMemo(() => {
    const allDates = [...journal.entryDates.keys()].sort().reverse();
    if (allDates.length === 0) return 0;
    const todayStr = getToday();
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    if (allDates[0] !== todayStr && allDates[0] !== yesterdayStr) return 0;
    let count = 1;
    for (let i = 1; i < allDates.length; i++) {
      const prev = new Date(allDates[i - 1] + "T00:00:00");
      const curr = new Date(allDates[i] + "T00:00:00");
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      if (diffDays === 1) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [journal.entryDates]);


  const lastEntryDate = useMemo(() => {
    const dates = [...journal.entryDates.keys()].sort().reverse();
    return dates[0] ?? null;
  }, [journal.entryDates]);
  const streakFreeze = useStreakFreeze(streak, lastEntryDate);

  const daysSinceLastEntry = useMemo(
    () => getDaysSinceLastEntry(journal.entryDates),
    [journal.entryDates]
  );

  const todayMood = useMemo(() => {
    const today = getToday();
    return journal.entryDates.get(today);
  }, [journal.entryDates]);

  const hasTodayEntry = useMemo(() => {
    const today = getToday();
    return journal.entryDates.has(today);
  }, [journal.entryDates]);

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

  const getActiveDraftDate = useCallback(() => journal.selectedDate ?? getToday(), [journal.selectedDate]);

  const handleNewEntry = useCallback(() => {
    entryModeRef.current = "fab";
    setPortalEntryPrefill({ date: getActiveDraftDate() });
    journal.editEntry(null);
  }, [getActiveDraftDate, journal]);

  useEffect(() => {
    const openEditor = () => {
      handleNewEntry();
    };

    if (consumePendingDiaryEditorOpen()) {
      handleNewEntry();
    }

    return subscribeToDiaryEditorOpen(openEditor);
  }, [handleNewEntry]);

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
    initialSuggestionConsumedRef.current = true;
    handleNewEntryWithPrefill(suggestion.prefill);
    onInitialEntrySuggestionConsumed?.();
  }, [handleNewEntryWithPrefill, onInitialEntrySuggestionConsumed]);

  const handleDismissInitialEntrySuggestion = useCallback(() => {
    initialSuggestionConsumedRef.current = true;
    initialSuggestionRef.current = null;
    onInitialEntrySuggestionConsumed?.();
  }, [onInitialEntrySuggestionConsumed]);

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

  useEffect(() => {
    if (privateMode && (journal.view === "viewing" || journal.view === "editing")) {
      handleGoBack();
    }
  }, [handleGoBack, journal.view, privateMode]);

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
    if (showPasswordSettings) {
      closeSettings(false);
    }
    setDiaryTabSection("stats");
    journal.openStats();
  }, [closeSettings, journal, showPasswordSettings]);

  const handleNewEntryFromShell = useCallback(() => {
    if (showPasswordSettings) {
      closeSettings(false);
    }
    handleNewEntry();
  }, [closeSettings, handleNewEntry, showPasswordSettings]);

  const handleOpenEntryFromShell = useCallback(
    (id: string) => {
      if (showPasswordSettings) {
        closeSettings(false);
      }
      setDiaryTabSection("entry");
      handleOpenEntry(id);
    },
    [closeSettings, handleOpenEntry, showPasswordSettings]
  );

  const handleOpenFavoriteEntry = useCallback(
    (id: string) => {
      if (showPasswordSettings) {
        closeSettings(false);
      }
      setDiaryTabSection("favorites");
      handleOpenEntry(id);
    },
    [closeSettings, handleOpenEntry, showPasswordSettings]
  );

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
      closeSettings(false);
    }
    setShowMobileDiarySidebar(true);
    void haptics.light();
  }, [closeSettings, showPasswordSettings]);

  const handleOpenFavorites = useCallback(() => {
    if (showPasswordSettings) {
      closeSettings(false);
    }

    if (journal.view === "viewing" || journal.view === "stats") {
      handleGoBack();
    }

    if (journal.view !== "editing") {
      setDiaryTabSection("favorites");
    }

    if (sidebarState === "collapsed") {
      setSidebarState("expanded");
      requestAnimationFrame(() => sidebarContentRef.current?.focus());
    }

    void haptics.light();
  }, [closeSettings, handleGoBack, journal.view, setSidebarState, showPasswordSettings, sidebarState]);

  const handleShowDiaryPanel = useCallback(() => {
    if (showPasswordSettings) {
      closeSettings(false);
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
  }, [closeSettings, handleGoBack, journal.view, setSidebarState, showPasswordSettings, sidebarState]);

  const handleSaveEntry = useCallback(
    async (data: Parameters<typeof journal.createEntry>[0]) => {
      const isNew = !journal.activeEntryId;
      const spaceIds = getPrefillSpaceIds(activeEntryPrefill);
      if (journal.activeEntryId) {
        await journal.updateEntry(journal.activeEntryId, data);
      } else {
        const entry = await journal.createEntry(data);
        if (spaceIds.length > 0) {
          await Promise.all(spaceIds.map((spaceId) => linkEntryToSpace(entry.id, spaceId)));
        }
      }
      setPortalEntryPrefill(null);
      // Trigger cloud sync after save to reduce data loss risk
      try {
        triggerSync();
      } catch {
        /* graceful: cloud sync is secondary; data already saved to IndexedDB */
      }
      // Streak milestone celebration (only for new entries on today's date)
      if (isNew && rewardsEnabled) {
        const entryDate = data.date || getToday();
        const newStreak = entryDate === getToday() && !hasTodayEntry ? streak + 1 : 0;
        const milestones = [7, 14, 30, 60, 100];
        const isStreakMilestone = milestones.includes(newStreak);

        // Award XP, treats, plant story flower (IA Blueprint Wave A)
        rewardUser("journal", {
          treats: 10,
          treatReason: "Journal entry",
          haptic: haptics.journalSaved,
          sound: isStreakMilestone ? null : undefined,
        });

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
    },
    [activeEntryPrefill, journal, rewardsEnabled, streak, hasTodayEntry, rewardUser]
  );

  const recoverFailedDelete = useCallback(
    (failedDelete: PendingDelete, err: unknown) => {
      logger.warn("[Journal]", "commitDelete failed:", err);
      if (!isMountedRef.current) return;
      journal.restoreEntry(failedDelete.entry);
      setPendingDelete((current) => (current?.id === failedDelete.id ? null : current));
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
    (id: string) => {
      // Commit any previous pending delete first
      if (pendingDelete) {
        const previousPendingDelete = pendingDelete;
        clearTimeout(deleteTimerRef.current);
        pendingDeleteRef.current = null;
        journal
          .commitDeleteEntry(previousPendingDelete.id)
          .then(() => {
            if (!isMountedRef.current) return;
            setPendingDelete((current) =>
              current?.id === previousPendingDelete.id ? null : current
            );
          })
          .catch((err) => recoverFailedDelete(previousPendingDelete, err));
      }
      // Soft-delete: remove from UI, keep in storage for 5s
      const entry = journal.softDeleteEntry(id);
      if (!entry) return;
      clearTimeout(deleteFeedbackTimerRef.current);
      setDeleteCommitMessage(null);
      setPendingDelete({ id, entry });
      // Haptic confirmation when slide-out starts (shouldTriggerHaptics check is inside hapticSuccess)
      void hapticSuccess();
      const deleteToCommit = { id, entry };
      deleteTimerRef.current = setTimeout(() => {
        pendingDeleteRef.current = null;
        setPendingDelete((current) => (current?.id === id ? null : current));
        journal
          .commitDeleteEntry(id)
          .then(() => {
            if (!isMountedRef.current) return;
            setPendingDelete((current) => (current?.id === id ? null : current));
          })
          .catch((err) => recoverFailedDelete(deleteToCommit, err));
      }, 5000);
    },
    [journal, pendingDelete, recoverFailedDelete]
  );

  const handleUndoDelete = useCallback(() => {
    if (!pendingDelete) return;
    clearTimeout(deleteTimerRef.current);
    clearTimeout(deleteFeedbackTimerRef.current);
    journal.restoreEntry(pendingDelete.entry);
    setPendingDelete(null);
    setDeleteCommitMessage(null);
    void haptics.light();
  }, [pendingDelete, journal]);

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
      if (!(await checkEmailLockRemovalAvailable())) {
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
      setResetEmail(session.user.email);
      setResetStep("confirm");
    } catch {
      if (!isCurrentResetRequest()) return;
      setResetStep("no-account");
    }
  };

  const handleSendResetLink = async () => {
    if (resetStep === "sending") return;
    if (!resetEmail) return;
    const requestSeq = ++resetRequestSeqRef.current;
    const requestedEmail = resetEmail;
    const resetNonce = createJournalPasswordResetNonce();

    const isCurrentResetRequest = () => requestSeq === resetRequestSeqRef.current;

    // M2: OTP cooldown — prevent abuse by enforcing 60s between sends
    const now = Date.now();
    if (now - lastResetOtpRef.current < 60_000) {
      const remaining = Math.ceil((60_000 - (now - lastResetOtpRef.current)) / 1000);
      setResetError(
        (ts.journalResetCooldown || "Please wait {seconds}s before requesting another link.").replace(
          "{seconds}",
          String(remaining),
        )
      );
      return;
    }
    setResetStep("sending");
    setResetError("");
    try {
      const supabase = await loadJournalSupabase();
      if (!isCurrentResetRequest()) return;
      if (!supabase) {
        setResetStep("no-account");
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: requestedEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: withJournalPasswordResetNonce(getAuthRedirectUrl(), resetNonce),
        },
      });
      if (!isCurrentResetRequest()) return;
      if (error) {
        logger.warn("[Journal] Password reset link failed:", error);
        setResetError(ts.journalResetSendFailed || "Failed to send link. Check your connection.");
        setResetStep("confirm");
        return;
      }
      lastResetOtpRef.current = now;
      storageSetRaw(SK.JOURNAL_PASSWORD_RESET, serializeJournalPasswordResetRequest(requestedEmail, resetNonce));
      clearJournalPasswordResetProof();
      setResetStep("sent");
    } catch {
      if (!isCurrentResetRequest()) return;
      setResetError(ts.journalResetSendFailed || "Failed to send link. Check your connection.");
      setResetStep("confirm");
    }
  };

  const consumeVerifiedPasswordReset = useCallback(
    async (sessionEmail: string | null | undefined) => {
      const pending = parseJournalPasswordResetRequest(storageGetRaw(SK.JOURNAL_PASSWORD_RESET));
      if (!pending) return false;

      if (Date.now() - pending.startedAt >= JOURNAL_PASSWORD_RESET_WINDOW_MS) {
        storageRemove(SK.JOURNAL_PASSWORD_RESET);
        clearJournalPasswordResetProof();
        clearJournalPasswordResetParamFromCurrentUrl();
        return false;
      }

      const signedInEmail = normalizeJournalResetEmail(sessionEmail);
      if (!signedInEmail || signedInEmail !== pending.email) {
        logger.warn("[Journal] Ignored password reset sign-in for a different account");
        return false;
      }

      if (!hasJournalPasswordResetProof(pending)) {
        logger.warn("[Journal] Ignored password reset session without redirect proof");
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

      consumeJournalPasswordResetProof(pending.nonce, JOURNAL_PASSWORD_RESET_WINDOW_MS);
      clearJournalPasswordResetParamFromCurrentUrl();

      setResetEmail(pending.email);

      try {
        await security.removePassword();
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
        setResetError(
          ts.journalLockRemoveFailed ||
            "Unlock your diary first, then try removing the lock again.",
        );
        setResetStep("unavailable");
        return false;
      }
    },
    [checkEmailLockRemovalAvailable, security, ts.journalLockRemoveFailed, ts.journalPasswordRemoveSuccess, ts.journalResetSuccess],
  );

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
    isPagePresentation,
  ]);

  // Security touch on interaction
  useEffect(() => {
    if (moduleState === "open") security.touch();
  }, [moduleState, security]);

  // Auto-close success after 2s
  useEffect(() => {
    if (resetStep !== "success") return;
    const timer = setTimeout(closeResetDialog, 2000);
    return () => clearTimeout(timer);
  }, [closeResetDialog, resetStep]);

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
      return;
    }

    let disposed = false;
    let subscription: { unsubscribe: () => void } | undefined;

    void loadJournalSupabase()
      .then(async (supabase) => {
        if (disposed || !supabase) return;

        if (resetStep === "idle" && hasJournalPasswordResetProof(pending)) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!disposed) {
              await consumeVerifiedPasswordReset(session?.user?.email);
            }
          } catch (error) {
            logger.warn("[Journal] Password reset session check failed:", error);
          }
        }

        if (disposed) return;

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event !== "SIGNED_IN") return;
          void consumeVerifiedPasswordReset(session?.user?.email);
        });
        subscription = data.subscription;
      })
      .catch((err) => logger.warn("[Journal]", "Password reset listener failed:", err));

    return () => {
      disposed = true;
      subscription?.unsubscribe();
    };
  }, [consumeVerifiedPasswordReset, resetStep]);

  const mobileDiarySectionButtonClass = useCallback((active: boolean) => cn(
    "flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center motion-safe:transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]",
    active
      ? "bg-primary/[0.14] text-primary shadow-[inset_0_1px_0_hsl(var(--card)/0.52),0_12px_30px_-24px_hsl(var(--primary)/0.82)]"
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
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
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {ts.journalTitle || "Diary"}
              </h3>
              {security.hasPassword && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <Lock className="w-2.5 h-2.5" />
                  {ts.journalProtected || "Protected"}
                </span>
              )}
            </div>
          </div>

          {/* Today status badge + draft badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            {hasDraft && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/15 px-2 py-1 rounded-full">
                <PenLine className="w-3 h-3" />
                {ts.journalDraftBadge || "Draft"}
              </span>
            )}
            {hasTodayEntry ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                {ts.journalTodayComplete || "Done today"}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/15 px-2 py-1 rounded-full">
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
              <span className="font-semibold text-foreground">{entryCount}</span>{" "}
              {formatLocalizedCount(
                entryCount,
                language,
                ts,
                "journalEntryCount",
                ts.journalEntries || "entries"
              )}
            </span>
          )}
          {streak > 0 && (
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
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 rtl:scale-x-[-1]" />
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
        "w-full h-full flex flex-col",
        isPagePresentation
          ? "v2-fullscreen-page relative z-[1] min-h-[var(--app-viewport-height)] bg-transparent overflow-hidden"
          : "md:my-4 md:mx-4 md:h-[calc(100%-2rem)] md:rounded-2xl md:bg-background md:shadow-2xl md:border md:border-border/20 md:overflow-hidden",
        !isPagePresentation &&
          "lg:max-w-none lg:mx-0 lg:my-0 lg:h-full lg:rounded-none lg:shadow-none lg:border-0 lg:overflow-hidden"
      )}
    >
      {/* Security gate */}
      {security.isLocked && !security.loading && (
        <>
          {/* Header with close */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/30">
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
              <h2 className="truncate text-base font-bold text-foreground">{ts.journalTitle || "Diary"}</h2>
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
            onForgotPassword={canOfferEmailLockRemoval ? handleForgotPassword : undefined}
            onBiometricUnlock={security.biometricEnabled ? security.unlockWithBiometric : undefined}
            biometricAvailable={security.biometricAvailable && security.biometricEnabled}
            emailLockRemovalAvailable={canOfferEmailLockRemoval}
          />

          {/* Secure password reset dialog (email verification) */}
          {resetStep !== "idle" && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] motion-safe:animate-fade-in dark:bg-black/50"
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-h-[calc(100dvh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom)_-_2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-card p-5 shadow-xl lg:max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id={resetTitleId} className="sr-only">
                  {resetStep === "success"
                    ? ts.journalResetSuccess || "Diary lock removed"
                    : resetStep === "sent"
                      ? ts.journalResetLinkSent || "Check your email"
                      : resetStep === "no-account" || resetStep === "unavailable"
                        ? ts.journalPasswordForgot || "Can't open the lock?"
                        : ts.journalResetViaEmail || "Remove lock by email"}
                </h3>
                <p id={resetDescriptionId} className="sr-only">
                  {resetStep === "sent"
                    ? ts.journalResetCheckEmail ||
                      "Click the link in your email to remove the diary lock. This page will update automatically."
                    : resetStep === "no-account"
                      ? ts.journalResetNoAccount ||
                        "Sign in to your account in Settings to use email lock removal"
                      : resetStep === "unavailable"
                        ? ts.journalResetEncryptedUnavailable ||
                          "This diary is encrypted with your password. Email verification cannot remove this lock while encrypted content is locked."
                      : resetStep === "success"
                        ? ts.journalResetSuccess || "Diary lock removed"
                        : ts.journalResetConfirm || "We'll send a verification link to"}
                </p>
                {/* Checking session */}
                {resetStep === "checking" && (
                  <div className="flex flex-col items-center justify-center gap-4 py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
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
                      {ts.journalResetEncryptedUnavailable ||
                        "This diary is encrypted with your password. Email verification cannot remove this lock while encrypted content is locked. Unlock with your password to remove it."}
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
                    <p className="mb-4 break-all text-center text-sm font-medium text-foreground" dir="ltr">
                      <bdi>{maskEmail(resetEmail)}</bdi>
                    </p>
                    {resetError && (
                      <p id={resetErrorId} role="alert" className="mb-3 text-center text-xs text-destructive">{resetError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        ref={resetCancelRef}
                        onClick={closeResetDialog}
                        aria-disabled={resetStep === "sending"}
                        className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px] aria-disabled:opacity-50"
                      >
                        {ts.cancel || "Cancel"}
                      </button>
                      <button
                        onClick={handleSendResetLink}
                        aria-disabled={resetStep === "sending"}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-medium min-h-[44px]",
                          "bg-primary text-primary-foreground",
                          "aria-disabled:opacity-50 flex items-center justify-center gap-2"
                        )}
                      >
                        {resetStep === "sending" && (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
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
                    <p className="mb-4 break-all text-center text-sm font-medium text-foreground" dir="ltr">
                      <bdi>{maskEmail(resetEmail)}</bdi>
                    </p>
                    <p className="text-xs text-muted-foreground text-center mb-4">
                      {ts.journalResetCheckEmail ||
                        "Click the link in your email to remove the diary lock. This page will update automatically."}
                    </p>
                    {resetError && (
                      <p id={resetErrorId} role="alert" className="mb-3 text-center text-xs text-destructive">{resetError}</p>
                    )}
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" aria-hidden="true" />
                      <span className="text-xs text-muted-foreground">
                        {ts.journalResetWaiting || "Waiting for verification..."}
                      </span>
                    </div>
                    <button
                      onClick={handleSendResetLink}
                      className="w-full py-2 text-xs text-muted-foreground hover:text-foreground motion-safe:transition-colors min-h-[44px]"
                    >
                      {ts.journalResetResend || "Resend link"}
                    </button>
                    <button
                      ref={resetCancelRef}
                      onClick={closeResetDialog}
                      className="w-full py-2 text-xs text-muted-foreground hover:text-foreground motion-safe:transition-colors min-h-[44px]"
                    >
                      {ts.cancel || "Cancel"}
                    </button>
                  </>
                )}

                {/* Success */}
                {resetStep === "success" && (
                  <div className="py-4">
                    <div className="flex justify-center mb-3">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </motion.div>
                    </div>
                    <p className="text-sm font-medium text-foreground text-center">
                      {ts.journalResetSuccess || "Diary lock removed"}
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </>
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
                  entries={journal.allEntries}
                  activeEntryId={journal.activeEntryId}
                  privateMode={privateMode}
                  onOpenEntry={handleOpenEntryFromShell}
                  onNewEntry={handleNewEntryFromShell}
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
                        {streak > 0 && (
                          <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-orange-500/10 bg-gradient-to-r from-orange-500/15 to-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-orange-500 motion-safe:animate-streak-fire-glow">
                            <Flame className="h-3 w-3" aria-hidden="true" />
                            {streak}
                          </span>
                        )}
                        <StreakFreezeIndicator
                          availableFreezes={streakFreeze.availableFreezes}
                          isStreakFrozen={streakFreeze.isStreakFrozen}
                        />
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
                        {journal.allEntries.length > 0 ? (
                          <OnThisDayCard
                            entries={journal.allEntries}
                            onOpenEntry={handleOpenEntryFromShell}
                            onDismiss={() => {
                              /* handled internally */
                            }}
                            privateMode={privateMode}
                          />
                        ) : null}
                        {journal.loadError ? (
                          <JournalLoadErrorPanel ts={ts} onRetry={journal.refresh} compact />
                        ) : journal.totalCount === 0 && !journal.loading ? (
                          <JournalCompactEmptyListShell
                            ts={ts}
                            onNewEntry={handleNewEntryFromShell}
                          />
                        ) : (
                          <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                            <LazyJournalEntryList
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
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-border/20 px-5 py-4">
                        <div className="min-w-0">
                          <h2 className="text-base font-semibold text-foreground">
                            {ts.journalSettings || "Diary Settings"}
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {ts.journalLockHint || "Protect your diary and choose how it behaves."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => closeSettings()}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                            onPrivateModeChange={(checked) => {
                              setPrivateMode(checked);
                              storageSetRaw(SK.JOURNAL_PRIVATE_MODE, String(checked));
                            }}
                            onOpenExport={() => {
                              if (!isDiaryDesktopLayout) {
                                closeSettings(false);
                              }
                              setShowExportPicker(true);
                            }}
                            onRequestRemovePassword={() => setShowRemovePasswordConfirm(true)}
                          />
                        </Suspense>
                      </div>
                    </div>
                  ) : journal.view === "editing" ? (
                    <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                      <LazyJournalEntryEditor
                        entry={journal.activeEntry}
                        entryPrefill={activeEntryPrefill}
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
                        onBack={handleGoBack}
                        onToggleHabit={onToggleHabit}
                        onAddGratitude={handleAddGratitudeWithSpace}
                        onRequestSettings={openSettings}
                        onBindSettingsRequestHandler={(handler) => {
                          editorSettingsRequestRef.current = handler;
                        }}
                        useSharedDiaryWallpaper={showJournalSidebarAtmosphere}
                        desktop
                      />
                    </Suspense>
                  ) : journal.view === "viewing" && journal.activeEntry ? (
                    <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                      <LazyJournalEntryViewer
                        entry={journal.activeEntry}
                        onEdit={() => journal.editEntry(journal.activeEntryId)}
                        onDelete={() => handleDeleteEntry(journal.activeEntry?.id || "")}
                        onBack={handleGoBack}
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
                      <LazyJournalStats entries={journal.allEntries} onBack={handleStatsBack} privateMode={privateMode} />
                    </Suspense>
                  ) : diaryTabSection === "favorites" ? (
                    <JournalFavoritesPanel
                      entries={journal.allEntries}
                      onOpenEntry={handleOpenFavoriteEntry}
                      onNewEntry={handleNewEntryFromShell}
                      privateMode={privateMode}
                      ts={ts}
                    />
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-8">
                      <div className="flex min-h-full flex-col gap-4">
                        {listHeaderContent}

                        {hasInitialEntrySuggestion && !autoCreateInitialEntry ? (
                          <DiaryEntrySuggestionCard
                            suggestion={initialSuggestionRef.current!}
                            onStart={handleUseInitialEntrySuggestion}
                            onDismiss={handleDismissInitialEntrySuggestion}
                          />
                        ) : null}

                        {!autoCreateInitialEntry && visibleExtraSuggestions.map((suggestion, index) => (
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
                          <div className="relative flex min-h-[420px] flex-1 overflow-hidden rounded-[28px] border border-border/40 bg-card/30">
                            <Suspense fallback={null}>
                              <LazyDiaryEmptyCanvas
                                onNewEntry={handleNewEntry}
                                onNewEntryWithPrompt={(prompt) => {
                                  handleNewEntryWithPrefill({ content: prompt });
                                }}
                                streak={streak}
                                entriesThisWeek={
                                  journal.entries.filter((e) => {
                                    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                                    return e.createdAt > weekAgo;
                                  }).length
                                }
                                showWallpaper={!isPagePresentation}
                              />
                            </Suspense>
                          </div>
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
                <AnimatePresence>
                  {journal.view === "editing" && (
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
                          entry={journal.activeEntry}
                          entryPrefill={activeEntryPrefill}
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
                          onBack={handleGoBack}
                          onToggleHabit={onToggleHabit}
                          onAddGratitude={handleAddGratitudeWithSpace}
                        />
                      </Suspense>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* List / Viewer / Stats crossfade */}
                <AnimatePresence mode="wait">
                  {journal.view === "stats" && (
                    <motion.div
                      key="stats"
                      initial={shouldAnimate() ? { opacity: 0 } : undefined}
                      animate={{ opacity: 1 }}
                      exit={shouldAnimate() ? { opacity: 0 } : undefined}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "flex flex-col flex-1 min-h-0 bg-background",
                        showJournalLightAtmosphere && "journal-light-panel"
                      )}
                    >
                      <div className="flex items-center justify-between border-b border-border/30 bg-gradient-to-r from-primary/[0.03] via-background/80 to-primary/[0.02] px-4 py-3 backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]">
                        <button
                          type="button"
                          onClick={handleStatsBack}
                          className={mobileHeaderActionClass}
                          aria-label={ts.back || "Back"}
                        >
                          <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
                        </button>
                        <div className="min-w-0 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">
                            {ts.journalStatsTitle || "Statistics"}
                          </p>
                          <h2 className="truncate text-base font-black text-foreground">
                            {ts.journalMemoryPortalTitle || "Memory portal"}
                          </h2>
                        </div>
                        <span className="min-h-[44px] min-w-[44px]" aria-hidden="true" />
                      </div>

                      <div className="relative flex-1 min-h-0">
                        <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                          <LazyMemoryPortalCanvas
                            ts={ts}
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
                    </motion.div>
                  )}

                  {journal.view === "viewing" && journal.activeEntry && (
                    <motion.div
                      key="viewing"
                      initial={shouldAnimate() ? { opacity: 0 } : undefined}
                      animate={{ opacity: 1 }}
                      exit={shouldAnimate() ? { opacity: 0 } : undefined}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col flex-1 min-h-0"
                    >
                      <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                        <LazyJournalEntryViewer
                          entry={journal.activeEntry}
                          onEdit={() => journal.editEntry(journal.activeEntryId)}
                          onDelete={() => handleDeleteEntry(journal.activeEntry?.id || "")}
                          onBack={handleGoBack}
                        />
                      </Suspense>
                    </motion.div>
                  )}

                  {journal.view === "list" && (
                    <motion.div
                      key="list"
                      initial={shouldAnimate() ? { opacity: 0 } : undefined}
                      animate={{ opacity: 1 }}
                      exit={shouldAnimate() ? { opacity: 0 } : undefined}
                      transition={{ duration: 0.2 }}
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
                              <h2 className="truncate text-base font-bold leading-none text-foreground">
                                {ts.journalTitle || "Diary"}
                              </h2>
                              {streak > 0 && (
                                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-orange-500/10 bg-gradient-to-r from-orange-500/15 to-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-orange-500 motion-safe:animate-streak-fire-glow">
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
                              <PanelLeftOpen className="pointer-events-none h-5 w-5" aria-hidden="true" />
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
                            title={ts.journalEntry || "Entry"}
                            aria-label={ts.journalEntry || "Entry"}
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

                                {hasInitialEntrySuggestion && !autoCreateInitialEntry ? (
                                  <div className="mb-3">
                                    <DiaryEntrySuggestionCard
                                      suggestion={initialSuggestionRef.current!}
                                      onStart={handleUseInitialEntrySuggestion}
                                      onDismiss={handleDismissInitialEntrySuggestion}
                                      compact
                                    />
                                  </div>
                                ) : null}

                                {!autoCreateInitialEntry && visibleExtraSuggestions.map((suggestion, index) => (
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

                                {journal.allEntries.length > 0 ? (
                                  <OnThisDayCard
                                    entries={journal.allEntries}
                                    onOpenEntry={handleOpenEntry}
                                    onDismiss={() => {
                                      /* handled internally */
                                    }}
                                    privateMode={privateMode}
                                  />
                                ) : null}

                                <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                                  <LazyJournalEntryList
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
                                </Suspense>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {typeof document !== "undefined" ? createPortal(
                        <AnimatePresence>
                          {!isDiaryDesktopLayout && showMobileDiarySidebar ? (
                          <>
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
                              exit={shouldAnimate() ? { x: isRTL ? 32 : -32 } : undefined}
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
                                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70">
                                    {ts.journalEntry || "Entry"}
                                  </p>
                                  <h2 className="truncate text-lg font-black text-foreground">
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

                              <div className="grid shrink-0 grid-cols-4 gap-2 border-b border-border/20 px-3 py-3">
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
                                  <span className="text-[10px] font-bold">{ts.journalEntry || "Entry"}</span>
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
                                  <span className="text-[10px] font-bold">{ts.statistics || "Stats"}</span>
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
                                  <span className="text-[10px] font-bold">{ts.journalFavorites || "Favorites"}</span>
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
                                  <span className="text-[10px] font-bold">{ts.settings || "Settings"}</span>
                                </button>
                              </div>

                              <div
                                className="shrink-0 border-b border-border/20 px-3 py-2"
                                data-testid="journal-mobile-diary-sidebar-calendar"
                              >
                                {calendarMode === "full" ? (
                                  <Suspense fallback={null}>
                                    <LazyJournalCalendarFull
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
                                {journal.loadError ? (
                                  <JournalLoadErrorPanel ts={ts} onRetry={journal.refresh} compact />
                                ) : journal.totalCount === 0 && !journal.loading ? (
                                  <JournalCompactEmptyListShell
                                    ts={ts}
                                    onNewEntry={() => {
                                      closeMobileDiarySidebar(false);
                                      handleNewEntryFromShell();
                                    }}
                                  />
                                ) : (
                                  <Suspense fallback={<JournalDeferredPanelFallback label={t.loading || "Loading..."} />}>
                                    <LazyJournalEntryList
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
                          </>
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
                                        closeSettings(false);
                                        onOpenNavMenu();
                                      }}
                                      className={mobileHeaderMenuClass}
                                      title={ts.navV2OpenMenu || "Open menu"}
                                      aria-label={ts.navV2OpenMenu || "Open menu"}
                                      aria-expanded={navMenuOpen}
                                      aria-controls="nav-v2-drawer"
                                      data-testid="journal-settings-nav-menu"
                                    >
                                      <JournalMenuIcon className="pointer-events-none h-5 w-5" aria-hidden="true" />
                                    </button>
                                  ) : null}
                                  <h3 className="truncate text-base font-semibold text-foreground">
                                    {ts.journalSettings || "Diary Settings"}
                                  </h3>
                                </div>
                                <button
                                  type="button"
                                  ref={mobileSettingsCloseRef}
                                  onClick={() => closeSettings()}
                                  className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                                  onPrivateModeChange={(checked) => {
                                    setPrivateMode(checked);
                                    storageSetRaw(SK.JOURNAL_PRIVATE_MODE, String(checked));
                                  }}
                                  onOpenExport={() => {
                                    closeSettings(false);
                                    setShowExportPicker(true);
                                  }}
                                  onRequestRemovePassword={() => setShowRemovePasswordConfirm(true)}
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

                              {/* Reminder toggle */}
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
                                    onCheckedChange={reminder.setEnabled}
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
                                        if (!isNaN(h) && !isNaN(m)) void reminder.setTime(h, m);
                                      }}
                                      className="px-2 py-1 rounded-lg bg-muted/50 border border-border/30 text-sm text-foreground min-h-[44px]"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Import */}
                              <div className="mt-4 pt-4 border-t border-border/20">
                                <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">
                                  {ts.journalDataSection || "Data"}
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={importing}
                                    className="flex-1 py-2.5 rounded-xl bg-muted/50 text-foreground text-sm font-medium min-h-[44px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                                  >
                                    {importing ? (
                                      <Loader2
                                        className="w-3.5 h-3.5 animate-spin"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                                    )}
                                    {ts.journalImport || "Import"}
                                  </button>
                                </div>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".json"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    e.target.value = "";
                                    setImporting(true);
                                    setImportFeedback(null);
                                    try {
                                      const { importJournalBackup } =
                                        await import("./journalImport");
                                      const result = await importJournalBackup(file);
                                      void journal.refresh();
                                      const importedLabel = formatLocalizedCount(
                                        result.imported,
                                        language,
                                        ts,
                                        "journalEntryCount",
                                        ts.journalImportEntries || "entries"
                                      );
                                      if (result.errors.length > 0) {
                                        const errorLabel = formatLocalizedCount(
                                          result.errors.length,
                                          language,
                                          ts,
                                          "journalImportErrorCount",
                                          ts.journalImportErrors || "errors"
                                        );
                                        const msg = `${ts.journalImportPartial || "Imported with errors"}: ${importedLabel}, ${errorLabel}`;
                                        setImportFeedback({
                                          type: "error",
                                          message: msg,
                                        });
                                        announceError(msg);
                                      } else {
                                        const msg = `${ts.journalImportSuccess || "Import complete"}: ${importedLabel}`;
                                        setImportFeedback({
                                          type: "success",
                                          message: msg,
                                        });
                                        announceSuccess(msg);
                                      }
                                      setTimeout(() => setImportFeedback(null), 5000);
                                    } catch {
                                      const msg = ts.journalImportFailed || "Import failed";
                                      setImportFeedback({
                                        type: "error",
                                        message: msg,
                                      });
                                      announceError(msg);
                                      setTimeout(() => setImportFeedback(null), 5000);
                                    } finally {
                                      setImporting(false);
                                    }
                                  }}
                                />
                                {importFeedback && (
                                  <p
                                    className={cn(
                                      "text-xs mt-2 px-3 py-2 rounded-lg text-center",
                                      importFeedback.type === "success"
                                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                        : "bg-destructive/10 text-destructive"
                                    )}
                                  >
                                    {importFeedback.message}
                                  </p>
                                )}
                              </div>
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
                    </motion.div>
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
                {pendingDelete ? ts.entryDeleted || "Entry deleted" : deleteCommitMessage}
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

      {/* Remove password confirmation dialog */}
      {showRemovePasswordConfirm && (
        <Suspense fallback={<JournalModalDeferredFallback label={t.loading || "Loading..."} />}>
          <LazyRemovePasswordConfirmDialog
            ts={ts}
            onClose={() => setShowRemovePasswordConfirm(false)}
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

      {/* Streak milestone celebration overlay */}
      <AnimatePresence>
        {celebratingStreak !== null && (
          <Suspense fallback={null}>
            <LazyStreakCelebration streak={celebratingStreak} onDone={() => setCelebratingStreak(null)} />
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
