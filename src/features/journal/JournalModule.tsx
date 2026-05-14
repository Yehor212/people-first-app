import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
  memo,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Lock,
  ChevronRight,
  X,
  Settings,
  Loader2,
  CheckCircle2,
  Mail,
  PenLine,
  Upload,
  BarChart3,
  Flame,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "framer-motion";
import { cn, formatDate, getToday } from "@/lib/utils";
import { V2_SHELL_ICONS } from "@/lib/v2IconSystem";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import { createFocusTrap, announceSuccess, announceError } from "@/lib/a11y";
import { Switch } from "@/components/ui/switch";
import { SplashScreen, type SplashThemePreference } from "@/components/SplashScreen";
import { supabase } from "@/lib/supabaseClient";
import { useJournal } from "./useJournal";
import { useJournalSecurity } from "./useJournalSecurity";
import { JournalLockScreen } from "./JournalLockScreen";
import { JournalEntryList } from "./JournalEntryList";
import { MemoryPortalCanvas } from "./MemoryPortalCanvas";
import { SidebarCompact } from "./SidebarCompact";
import { DiaryEmptyCanvas } from "./DiaryEmptyCanvas";
import { DiaryEntrySuggestionCard } from "./DiaryEntrySuggestionCard";
import { OnThisDayCard } from "./OnThisDayCard";
import { JournalOnboardingHints, useJournalOnboarding } from "./JournalOnboardingHints";
import { KeyboardShortcutsOverlay } from "./KeyboardShortcutsOverlay";
import { JournalEntryEditor } from "./JournalEntryEditor";
import { JournalEntryViewer } from "./JournalEntryViewer";
import { ExportPickerDialog } from "./ExportPickerDialog";
import { RemovePasswordConfirmDialog } from "./RemovePasswordConfirmDialog";
import { JournalCalendar } from "./JournalCalendar";
import { JournalCalendarFull } from "./JournalCalendarFull";
import { formatLocalizedCount } from "./journalWordCount";
import { getEntryCount } from "./journalStorage";
import {
  createGratitudeSpaceCapture,
  createQuietReleaseSession,
  getQuietReleaseTraceSummaries,
  linkEntryToSpace,
} from "./journalHubStorage";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw, storageRemove } from "@/lib/safeJson";
import { useJournalReminder, getDaysSinceLastEntry } from "./useJournalReminder";
import { useScreenSecurity } from "./useScreenSecurity";
import { useGamificationStore, useUserDataStore } from "@/stores";
import { useThemeStore } from "@/stores/themeStore";
import { haptics, hapticSuccess } from "@/lib/haptics";
import { shouldAnimate } from "@/lib/animationUtils";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useSidebarKeyboard } from "@/hooks/useSidebarKeyboard";
import { useEntryTransition } from "@/hooks/useEntryTransition";
import { springs } from "@/config/animations";
import { StreakCelebration } from "./StreakCelebration";
import { useStreakFreeze, StreakFreezeIndicator } from "./StreakFreeze";
import { JournalSettingsContent, type JournalSettingsSection } from "./JournalSettingsContent";
import type { JournalEntryPrefill, JournalEntrySuggestion, JournalReleaseTraceSummary } from "./types";
import { DiaryMiniOrb } from "./DiaryMiniOrb";

function getPrefillSpaceIds(prefill: JournalEntryPrefill | null | undefined): string[] {
  if (!prefill) return [];
  return Array.from(new Set([prefill.spaceId, ...(prefill.spaceIds ?? [])])).filter(
    (spaceId): spaceId is string => Boolean(spaceId && spaceId !== "space-all" && spaceId.startsWith("space-")),
  );
}

// Lazy-load JournalStats to avoid CJS TDZ (Recharts)
const LazyJournalStats = lazyWithRetry(
  () => import("./JournalStats").then((m) => ({ default: m.JournalStats })),
  "JournalStats"
);

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
}: JournalModuleProps = {}) {
  const { t, isRTL, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const isPagePresentation = presentation === "page";
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const showJournalLightAtmosphere =
    isPagePresentation && appliedTheme === "paper";
  const mobileHeaderMenuClass =
    "flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-full border border-border/50 bg-card/70 p-0 text-foreground/90 shadow-[0_14px_34px_hsl(var(--foreground)/0.16)] backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] motion-safe:transition-[transform,background-color,border-color,color,box-shadow] motion-safe:duration-200 motion-safe:ease-out hover:bg-card/85 active:scale-95 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  const mobileHeaderActionClass =
    "press-stable flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl p-2 text-muted-foreground motion-safe:transition-[background-color,color,box-shadow] motion-safe:duration-150 hover:bg-muted/50 hover:text-foreground active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45";
  const rewardUser = useGamificationStore((s) => s.rewardUser);
  const moodEntries = useUserDataStore((s) => s.moods);
  const [moduleState, setModuleState] = useState<ModuleState>(
    startOpen || disableCardShell || isPagePresentation ? "open" : "card"
  );
  const [entryCount, setEntryCount] = useState(0);
  const [showPasswordSettings, setShowPasswordSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<JournalSettingsSection>("overview");
  const [calendarMode, setCalendarMode] = useState<"strip" | "full">(() => {
    return storageGetRaw(SK.JOURNAL_CALENDAR_MODE, "strip") as "strip" | "full";
  });
  const [privateMode, setPrivateMode] = useState(() => {
    return storageGetRaw(SK.JOURNAL_PRIVATE_MODE) === "true";
  });

  const [showExportPicker, setShowExportPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [showRemovePasswordConfirm, setShowRemovePasswordConfirm] = useState(false);
  const [celebratingStreak, setCelebratingStreak] = useState<number | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const {
    sidebarState,
    setSidebarState,
    toggleSidebar,
    toggleSidebarCollapsed,
    isExpanded,
    isCollapsed,
  } = useSidebarState();
  const initialSuggestionConsumedRef = useRef(false);
  const initialSuggestionRef = useRef<JournalEntrySuggestion | null>(initialEntrySuggestion);
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null);
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
  const entryTransition = useEntryTransition();
  const onboarding = useJournalOnboarding();
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const isSidebarCollapsed = isCollapsed;

  useBackHandler(showExportPicker, () => setShowExportPicker(false));

  const closeSettings = useCallback((restoreFocus = true) => {
    setShowPasswordSettings(false);
    setSettingsSection("overview");

    if (!restoreFocus) return;
    requestAnimationFrame(() => settingsReturnFocusRef.current?.focus());
  }, []);

  const openSettings = useCallback((section: JournalSettingsSection = "overview") => {
    settingsReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSettingsSection(section);
    setShowPasswordSettings(true);
  }, []);

  // Consolidated Escape key handler for inline sub-dialogs (password, export, remove-confirm)
  useEffect(() => {
    const activeDialog = showPasswordSettings
      ? "password"
      : showExportPicker
        ? "export"
        : showRemovePasswordConfirm
          ? "remove"
          : null;
    if (!activeDialog) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activeDialog === "password") {
        closeSettings();
      } else if (activeDialog === "export") {
        setShowExportPicker(false);
      } else if (activeDialog === "remove") {
        setShowRemovePasswordConfirm(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    closeSettings,
    showPasswordSettings,
    showExportPicker,
    showRemovePasswordConfirm,
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Secure password reset via email verification
  type ResetStep = "idle" | "checking" | "no-account" | "confirm" | "sending" | "sent" | "success";
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");

  const journal = useJournal();
  const [releaseTraceSummaries, setReleaseTraceSummaries] = useState<Map<string, JournalReleaseTraceSummary>>(
    () => new Map(),
  );
  const security = useJournalSecurity();
  const reminder = useJournalReminder({
    reminderTitle: ts.journalReminderNotifTitle || "Time to Write",
    reminderBody:
      ts.journalReminderNotifBody || "Take a moment to capture your thoughts and feelings.",
  });
  const screenSecurity = useScreenSecurity(moduleState === "open");

  const releaseTraceDates = useMemo(() => {
    const dates = new Map<string, number>();
    releaseTraceSummaries.forEach((summary, date) => {
      if (summary.count > 0) dates.set(date, summary.count);
    });
    return dates;
  }, [releaseTraceSummaries]);

  useEffect(() => {
    let cancelled = false;
    void getQuietReleaseTraceSummaries()
      .then((summaries) => {
        if (!cancelled) setReleaseTraceSummaries(summaries);
      })
      .catch((error) => {
        logger.warn("[Journal] Failed to load quiet release traces", error);
      });
    return () => {
      cancelled = true;
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
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    entry: (typeof journal.entries)[0];
  } | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingDeleteRef = useRef(pendingDelete);
  useEffect(() => {
    pendingDeleteRef.current = pendingDelete;
  }, [pendingDelete]);
  useEffect(
    () => () => {
      clearTimeout(deleteTimerRef.current);
      if (pendingDeleteRef.current) {
        journal
          .commitDeleteEntry(pendingDeleteRef.current.id)
          .catch((err) => logger.warn("[Journal]", "Cleanup commitDelete failed:", err));
      }
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

  // Streak freeze (Duolingo-style — miss a day without breaking streak)
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

  const handleNewEntry = useCallback(() => {
    entryModeRef.current = "fab";
    setPortalEntryPrefill(null);
    journal.editEntry(null);
  }, [journal]);

  const handleNewEntryWithPrefill = useCallback(
    (prefill: JournalEntryPrefill) => {
      entryModeRef.current = "fab";
      setPortalEntryPrefill(prefill);
      journal.editEntry(null);
    },
    [journal]
  );

  const handleUseInitialEntrySuggestion = useCallback(() => {
    if (!initialSuggestionRef.current) return;
    initialSuggestionConsumedRef.current = true;
    handleNewEntry();
    onInitialEntrySuggestionConsumed?.();
  }, [handleNewEntry, onInitialEntrySuggestionConsumed]);

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
          const { triggerSync } = await import("@/storage/cloudSync");
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
    if (
      journal.view === "list" &&
      !initialEntrySuggestion &&
      initialSuggestionConsumedRef.current
    ) {
      initialSuggestionRef.current = null;
    }
  }, [journal.view, initialEntrySuggestion]);

  const activeEntryPrefill: JournalEntryPrefill | null = !journal.activeEntry
    ? (portalEntryPrefill ?? initialSuggestionRef.current?.prefill ?? null)
    : null;

  const isLgScreen = useMediaQuery("(min-width: 1024px)");
  const showEntrySuggestionCards = isLgScreen;

  const hasInitialEntrySuggestion =
    showEntrySuggestionCards &&
    !!initialSuggestionRef.current &&
    !initialSuggestionConsumedRef.current &&
    journal.view === "list";

  const visibleExtraSuggestions = useMemo(
    () =>
      showEntrySuggestionCards
        ? extraSuggestions.filter((suggestion, index) => {
            const key = suggestion.id || `${suggestion.source}-${suggestion.committedAt || index}`;
            return !dismissedSuggestionIds.includes(key);
          })
        : [],
    [dismissedSuggestionIds, extraSuggestions, showEntrySuggestionCards],
  );

  const handleUseExtraSuggestion = useCallback(
    (suggestion: JournalEntrySuggestion) => {
      handleNewEntryWithPrefill(suggestion.prefill);
    },
    [handleNewEntryWithPrefill],
  );

  const handleDismissExtraSuggestion = useCallback((suggestion: JournalEntrySuggestion) => {
    const key =
      suggestion.id ||
      `${suggestion.source}-${suggestion.committedAt || suggestion.prefill.date || "draft"}`;
    setDismissedSuggestionIds((prev) => [...prev, key]);
  }, []);

  const handleOpenEntry = useCallback(
    (id: string) => {
      entryModeRef.current = "card";
      setPortalEntryPrefill(null);
      entryTransition.startTransition(id);
      journal.openEntry(id);
      // Complete transition after layout animation settles (~350ms spring duration)
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => entryTransition.completeTransition(), 350);
    },
    [journal, entryTransition]
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

  const handleShellSettingsRequest = useCallback(() => {
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
      handleOpenEntry(id);
    },
    [closeSettings, handleOpenEntry, showPasswordSettings]
  );

  const handleToggleDiaryPanel = useCallback(() => {
    const nextState = toggleSidebarCollapsed();
    if (nextState === "expanded") {
      requestAnimationFrame(() => sidebarContentRef.current?.focus());
    }
    void haptics.light();
  }, [toggleSidebarCollapsed]);

  const handleShowDiaryPanel = useCallback(() => {
    if (showPasswordSettings) {
      closeSettings(false);
    }

    if (journal.view === "viewing" || journal.view === "stats") {
      handleGoBack();
    }

    if (sidebarState === "collapsed") {
      setSidebarState("expanded");
      requestAnimationFrame(() => sidebarContentRef.current?.focus());
      void haptics.light();
    }
  }, [
    closeSettings,
    handleGoBack,
    journal.view,
    setSidebarState,
    showPasswordSettings,
    sidebarState,
  ]);

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
        const { triggerSync } = await import("@/storage/cloudSync");
        triggerSync();
      } catch {
        /* graceful: cloud sync is secondary; data already saved to IndexedDB */
      }
      // Streak milestone celebration (only for new entries on today's date)
      if (isNew) {
        // Award XP, treats, plant story flower (IA Blueprint Wave A)
        rewardUser("journal", {
          treats: 10,
          treatReason: "Journal entry",
          haptic: haptics.journalSaved,
        });

        const entryDate = data.date || getToday();
        if (entryDate === getToday() && !hasTodayEntry) {
          const newStreak = streak + 1;
          const milestones = [7, 14, 30, 60, 100];
          if (milestones.includes(newStreak)) {
            setCelebratingStreak(newStreak);
            try {
              const { playStreakMilestone } = await import("@/lib/audioManager");
              playStreakMilestone();
            } catch {
              /* graceful: celebration audio is decorative */
            }
          }
        }
      }
    },
    [activeEntryPrefill, journal, streak, hasTodayEntry, rewardUser]
  );

  const handleDeleteEntry = useCallback(
    (id: string) => {
      // Commit any previous pending delete first
      if (pendingDelete) {
        clearTimeout(deleteTimerRef.current);
        journal
          .commitDeleteEntry(pendingDelete.id)
          .catch((err) => logger.warn("[Journal]", "commitDelete failed:", err));
      }
      // Soft-delete: remove from UI, keep in storage for 5s
      const entry = journal.softDeleteEntry(id);
      if (!entry) return;
      setPendingDelete({ id, entry });
      // Haptic confirmation when slide-out starts (shouldTriggerHaptics check is inside hapticSuccess)
      void hapticSuccess();
      deleteTimerRef.current = setTimeout(() => {
        journal
          .commitDeleteEntry(id)
          .catch((err) => logger.warn("[Journal]", "commitDelete failed:", err));
        setPendingDelete(null);
      }, 5000);
    },
    [journal, pendingDelete]
  );

  const handleUndoDelete = useCallback(() => {
    if (!pendingDelete) return;
    clearTimeout(deleteTimerRef.current);
    journal.restoreEntry(pendingDelete.entry);
    setPendingDelete(null);
    void haptics.light();
  }, [pendingDelete, journal]);

  const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    return `${local[0]}${"*".repeat(Math.min(local.length - 1, 5))}@${domain}`;
  };

  const handleForgotPassword = async () => {
    setResetStep("checking");
    setResetError("");
    if (!supabase) {
      setResetStep("no-account");
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        setResetStep("no-account");
        return;
      }
      setResetEmail(session.user.email);
      setResetStep("confirm");
    } catch {
      setResetStep("no-account");
    }
  };

  const lastResetOtpRef = useRef(0);

  const handleSendResetLink = async () => {
    if (!supabase || !resetEmail) return;

    // M2: OTP cooldown — prevent abuse by enforcing 60s between sends
    const now = Date.now();
    if (now - lastResetOtpRef.current < 60_000) {
      const remaining = Math.ceil((60_000 - (now - lastResetOtpRef.current)) / 1000);
      setResetError(
        ts.journalResetCooldown || `Please wait ${remaining}s before requesting another link.`
      );
      return;
    }
    lastResetOtpRef.current = now;

    setResetStep("sending");
    setResetError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: resetEmail,
        options: { shouldCreateUser: false },
      });
      if (error) {
        setResetError(error.message);
        setResetStep("confirm");
        return;
      }
      storageSetRaw(SK.JOURNAL_PASSWORD_RESET, String(Date.now()));
      setResetStep("sent");
    } catch {
      setResetError(ts.journalResetSendFailed || "Failed to send link. Check your connection.");
      setResetStep("confirm");
    }
  };

  const closeResetDialog = () => {
    setResetStep("idle");
    setResetEmail("");
    setResetError("");
  };

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

  // Load entry count for card preview
  useEffect(() => {
    getEntryCount()
      .then(setEntryCount)
      .catch((err) => logger.warn("[Journal]", "Entry count failed:", err));
  }, [journal.totalCount]);

  // Check for unsaved draft (for card badge)
  useEffect(() => {
    if (moduleState !== "card") return;
    import("@/storage/db")
      .then(({ settingsRepo }) => {
        settingsRepo
          .get("journal_draft_new")
          .then((record) => {
            setHasDraft(!!record?.value);
          })
          .catch((err) => {
            logger.warn("[Journal]", "Draft check failed:", err);
            setHasDraft(false);
          });
      })
      .catch((err) => {
        logger.warn("[Journal]", "DB module load failed:", err);
        setHasDraft(false);
      });
  }, [moduleState, journal.totalCount]);

  // Android back button handling
  useEffect(() => {
    if (moduleState !== "open") return;
    if (resetStep !== "idle")
      return registerModalCloseCallback(() => {
        closeResetDialog();
        return true;
      });
    if (showPasswordSettings)
      return registerModalCloseCallback(() => {
        closeSettings();
        return true;
      });
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
    moduleState,
    resetStep,
    showPasswordSettings,
    journal,
    security,
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
  }, [resetStep]);

  // Magic link fallback: listen for auth state change when waiting for code
  useEffect(() => {
    if (resetStep !== "sent" || !supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const pending = storageGetRaw(SK.JOURNAL_PASSWORD_RESET);
        if (pending && Date.now() - Number(pending) < 600_000) {
          await security.removePassword();
          storageRemove(SK.JOURNAL_PASSWORD_RESET);
          setResetStep("success");
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [resetStep, security]);

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
      className={cn(
        "w-full h-full flex flex-col",
        isPagePresentation
          ? "relative z-[1] min-h-screen bg-transparent overflow-hidden"
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
              {onOpenNavMenu ? (
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
            onForgotPassword={handleForgotPassword}
            onBiometricUnlock={security.biometricEnabled ? security.unlockWithBiometric : undefined}
            biometricAvailable={security.biometricAvailable && security.biometricEnabled}
          />

          {/* Secure password reset dialog (email verification) */}
          {resetStep !== "idle" && (
            <div
              className="fixed inset-0 z-[70] bg-black/50 dark:bg-black/50 flex items-center justify-center motion-safe:animate-fade-in"
              onClick={closeResetDialog}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card rounded-2xl p-5 max-w-sm lg:max-w-md w-full mx-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Checking session */}
                {resetStep === "checking" && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2
                      className="w-6 h-6 animate-spin text-primary"
                      aria-label={t.loading || "Loading..."}
                    />
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
                      {ts.journalPasswordForgot || "Forgot Password?"}
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      {ts.journalResetNoAccount ||
                        "Sign in to your account in Settings to enable password recovery"}
                    </p>
                    <button
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
                      {ts.journalResetViaEmail || "Reset via email"}
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-1">
                      {ts.journalResetConfirm || "We'll send a verification link to"}
                    </p>
                    <p className="text-sm font-medium text-foreground text-center mb-4">
                      {maskEmail(resetEmail)}
                    </p>
                    {resetError && (
                      <p className="text-xs text-destructive text-center mb-3">{resetError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={closeResetDialog}
                        disabled={resetStep === "sending"}
                        className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px] disabled:opacity-50"
                      >
                        {ts.cancel || "Cancel"}
                      </button>
                      <button
                        onClick={handleSendResetLink}
                        disabled={resetStep === "sending"}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-medium min-h-[44px]",
                          "bg-primary text-primary-foreground",
                          "disabled:opacity-50 flex items-center justify-center gap-2"
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
                    <p className="text-sm font-medium text-foreground text-center mb-4">
                      {maskEmail(resetEmail)}
                    </p>
                    <p className="text-xs text-muted-foreground text-center mb-4">
                      {ts.journalResetCheckEmail ||
                        "Click the link in your email to remove the diary password. This page will update automatically."}
                    </p>
                    {resetError && (
                      <p className="text-xs text-destructive text-center mb-3">{resetError}</p>
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
                      {ts.journalResetSuccess || "Diary password removed"}
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
          {isLgScreen ? (
            <LayoutGroup>
              <div className="flex flex-1 min-h-0">
                <SidebarCompact
                  collapsed={isSidebarCollapsed}
                  entries={journal.allEntries}
                  activeEntryId={journal.activeEntryId}
                  onOpenEntry={handleOpenEntryFromShell}
                  onNewEntry={handleNewEntryFromShell}
                  onOpenStats={handleOpenStats}
                  onOpenSettings={handleShellSettingsRequest}
                  onShowList={handleShowDiaryPanel}
                  onToggleSidebar={handleToggleDiaryPanel}
                />

                <div
                  className={cn(
                    "min-w-0 overflow-hidden border-e border-border/30 bg-card motion-safe:transition-[width,opacity] motion-safe:duration-300",
                    isExpanded ? "w-[360px] opacity-100" : "w-0 border-e-0 opacity-0",
                    showJournalLightAtmosphere && "journal-light-panel"
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
                          onClick={handleOpenStats}
                          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title={ts.journalStatsTitle || "Statistics"}
                          aria-label={ts.journalStatsTitle || "Statistics"}
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleShellSettingsRequest}
                          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title={ts.journalSettings || "Diary settings"}
                          aria-label={ts.settings || "Settings"}
                        >
                          <Settings className="w-4 h-4" />
                        </button>
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
                        <JournalCalendarFull
                          entryDates={journal.entryDates}
                          releaseTraceDates={releaseTraceDates}
                          selectedDate={journal.selectedDate}
                          onSelectDate={journal.setSelectedDate}
                          onToggleMode={() => {
                            setCalendarMode("strip");
                            storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "strip");
                          }}
                        />
                      ) : (
                        <JournalCalendar
                          entryDates={journal.entryDates}
                          releaseTraceDates={releaseTraceDates}
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
                        <OnThisDayCard
                          entries={journal.allEntries}
                          onOpenEntry={handleOpenEntryFromShell}
                          onDismiss={() => {
                            /* handled internally */
                          }}
                        />
                        <JournalEntryList
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
                          activeEntryId={journal.activeEntryId}
                        />
                      </div>
                    </motion.div>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col bg-background",
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
                        <JournalSettingsContent
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
                      </div>
                    </div>
                  ) : journal.view === "editing" ? (
                    <JournalEntryEditor
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
                      desktop
                    />
                  ) : journal.view === "viewing" && journal.activeEntry ? (
                    <JournalEntryViewer
                      entry={journal.activeEntry}
                      onEdit={() => journal.editEntry(journal.activeEntryId)}
                      onDelete={() => handleDeleteEntry(journal.activeEntry?.id || "")}
                      onBack={handleGoBack}
                    />
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
                      <LazyJournalStats entries={journal.allEntries} onBack={handleGoBack} />
                    </Suspense>
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

                        {!autoCreateInitialEntry && visibleExtraSuggestions.map((suggestion) => (
                          <DiaryEntrySuggestionCard
                            key={
                              suggestion.id ||
                              `${suggestion.source}-${suggestion.committedAt || suggestion.prefill.date || "draft"}`
                            }
                            suggestion={suggestion}
                            onStart={() => handleUseExtraSuggestion(suggestion)}
                            onDismiss={() => handleDismissExtraSuggestion(suggestion)}
                          />
                        ))}

                        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-[28px] border border-border/40 bg-card/30">
                          <DiaryEmptyCanvas
                            onNewEntry={handleNewEntry}
                            onNewEntryWithPrompt={(_prompt) => {
                              handleNewEntry();
                            }}
                            streak={streak}
                            entriesThisWeek={
                              journal.entries.filter((e) => {
                                const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                                return e.createdAt > weekAgo;
                              }).length
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </LayoutGroup>
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
                      <JournalEntryEditor
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
                          onClick={handleGoBack}
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
                        <MemoryPortalCanvas
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
                      <JournalEntryViewer
                        entry={journal.activeEntry}
                        onEdit={() => journal.editEntry(journal.activeEntryId)}
                        onDelete={() => handleDeleteEntry(journal.activeEntry?.id || "")}
                        onBack={handleGoBack}
                      />
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
                      <div className="flex items-center justify-between gap-3 border-b border-border/30 bg-gradient-to-r from-primary/[0.03] via-background/80 to-primary/[0.02] px-4 py-3 backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {onOpenNavMenu ? (
                            <button
                              type="button"
                              onClick={onOpenNavMenu}
                              className={mobileHeaderMenuClass}
                              title={ts.navV2OpenMenu || "Open menu"}
                              aria-label={ts.navV2OpenMenu || "Open menu"}
                              aria-expanded={navMenuOpen}
                              aria-controls="nav-v2-drawer"
                              data-testid="journal-mobile-nav-menu"
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
                            onClick={handleOpenStats}
                            className={mobileHeaderActionClass}
                            title={ts.journalStatsTitle || "Statistics"}
                            aria-label={ts.journalStatsTitle || "Statistics"}
                            data-testid="journal-mobile-stats"
                          >
                            <BarChart3 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => openSettings()}
                            className={mobileHeaderActionClass}
                            title={ts.journalSettings || "Diary settings"}
                            aria-label={ts.settings || "Settings"}
                            data-testid="journal-mobile-settings"
                          >
                            <Settings className="h-4 w-4" aria-hidden="true" />
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

                      {/* Calendar */}
                      <div className="border-b border-border/10 bg-gradient-to-b from-transparent to-muted/5 px-4 py-2">
                        {calendarMode === "full" ? (
                          <JournalCalendarFull
                            entryDates={journal.entryDates}
                            releaseTraceDates={releaseTraceDates}
                            selectedDate={journal.selectedDate}
                            onSelectDate={journal.setSelectedDate}
                            onToggleMode={() => {
                              setCalendarMode("strip");
                              storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "strip");
                            }}
                          />
                        ) : (
                          <JournalCalendar
                            entryDates={journal.entryDates}
                            releaseTraceDates={releaseTraceDates}
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
                        ) : (
                          <div className="relative flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
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

                            {!autoCreateInitialEntry && visibleExtraSuggestions.map((suggestion) => (
                              <div
                                key={
                                  suggestion.id ||
                                  `${suggestion.source}-${suggestion.committedAt || suggestion.prefill.date || "draft"}`
                                }
                                className="mb-3"
                              >
                                <DiaryEntrySuggestionCard
                                  suggestion={suggestion}
                                  onStart={() => handleUseExtraSuggestion(suggestion)}
                                  onDismiss={() => handleDismissExtraSuggestion(suggestion)}
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
                              />
                            ) : null}

                            <JournalEntryList
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
                              selectedDateOnly
                            />
                          </div>
                        )}
                      </div>

                      {/* Password settings bottom sheet — mobile only (desktop rendered below ternary) */}
                      {!isLgScreen && showPasswordSettings && (
                        <>
                          <div
                            className="fixed inset-0 z-[64] bg-black/30 dark:bg-black/30 motion-safe:animate-fade-in"
                            onClick={() => closeSettings()}
                          />
                          <div
                            role="dialog"
                            aria-modal="true"
                            aria-label={ts.journalSettings || "Diary Settings"}
                            className="fixed bottom-0 inset-x-0 z-[65] flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] flex-col overflow-hidden motion-safe:animate-slide-up pb-safe lg:max-w-4xl lg:mx-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Handle bar */}
                            <div className="flex shrink-0 justify-center pt-2 pb-1 bg-card rounded-t-2xl">
                              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                              <div className="mb-4 flex items-center justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  {onOpenNavMenu ? (
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
                                  onClick={() => closeSettings()}
                                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                  aria-label={ts.close || "Close"}
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              </div>

                              <JournalSettingsContent
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

                              {/* Screenshot blocking (native only) */}
                              {screenSecurity.isNative && (
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
                                      className="px-2 py-1 rounded-lg bg-muted/50 border border-border/30 text-sm text-foreground min-h-[36px]"
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
                        <ExportPickerDialog
                          ts={ts}
                          language={language}
                          exporting={exporting}
                          setExporting={setExporting}
                          onClose={() => setShowExportPicker(false)}
                        />
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
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 inset-x-4 z-[55] flex justify-center pointer-events-none"
          >
            <div className="bg-foreground text-background rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg max-w-sm w-full pointer-events-auto">
              <span className="text-sm flex-1">{ts.entryDeleted || "Entry deleted"}</span>
              <button
                onClick={handleUndoDelete}
                className="text-sm font-semibold text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                {ts.undo || "Undo"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove password confirmation dialog */}
      {showRemovePasswordConfirm && (
        <RemovePasswordConfirmDialog
          ts={ts}
          onClose={() => setShowRemovePasswordConfirm(false)}
          onConfirm={async () => {
            await security.removePassword();
            setShowRemovePasswordConfirm(false);
            setSettingsSection("overview");
          }}
        />
      )}

      {/* Keyboard shortcuts overlay */}
      <KeyboardShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Streak milestone celebration overlay */}
      <AnimatePresence>
        {celebratingStreak !== null && (
          <StreakCelebration streak={celebratingStreak} onDone={() => setCelebratingStreak(null)} />
        )}
      </AnimatePresence>
    </div>
  );

  if (isPagePresentation) {
    return (
      <section
        ref={overlayRef}
        aria-label={ts.journalTitle || "Diary"}
        className="relative flex min-h-screen w-full flex-col bg-background lg:h-screen lg:overflow-hidden"
        dir={isRTL ? "rtl" : "ltr"}
        data-testid="journal-page-shell"
      >
        {showJournalLightAtmosphere && (
          <div
            className="journal-light-atmosphere"
            aria-hidden="true"
            data-testid="journal-light-atmosphere"
          >
            <span className="journal-light-atmosphere__sheet" />
            <span className="journal-light-atmosphere__fiber journal-light-atmosphere__fiber--one" />
            <span className="journal-light-atmosphere__fiber journal-light-atmosphere__fiber--two" />
            <span className="journal-light-atmosphere__botanical" />
          </div>
        )}
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
        "fixed inset-0 z-[60] bg-background flex items-start justify-center motion-safe:animate-slide-up h-screen overflow-hidden",
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
