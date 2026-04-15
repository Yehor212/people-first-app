import { useState, useEffect, useCallback, useRef, useMemo, Suspense, memo } from "react";
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
  Download,
  Upload,
  BarChart3,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import { createFocusTrap, announceSuccess, announceError } from "@/lib/a11y";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabaseClient";
import { useJournal } from "./useJournal";
import { useJournalSecurity } from "./useJournalSecurity";
import { JournalLockScreen } from "./JournalLockScreen";
import { JournalEntryList } from "./JournalEntryList";
import { JournalEntryEditor } from "./JournalEntryEditor";
import { JournalEntryViewer } from "./JournalEntryViewer";
import { ExportPickerDialog } from "./ExportPickerDialog";
import { RemovePasswordConfirmDialog } from "./RemovePasswordConfirmDialog";
import { JournalCalendar } from "./JournalCalendar";
import { JournalCalendarFull } from "./JournalCalendarFull";
import { getEntryCount } from "./journalStorage";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw, storageRemove } from "@/lib/safeJson";
import { StickerRenderer } from "./StickerRenderer";
import {
  PanelLayout,
  LayoutPanel,
  ResizeHandle,
  usePanelRef,
} from "@/components/layout/PanelLayout";
import { useJournalReminder, getDaysSinceLastEntry } from "./useJournalReminder";
import { useScreenSecurity } from "./useScreenSecurity";
import { ParticleBackground } from "@/components/stats/ParticleBackground";
import { useGamificationStore } from "@/stores";
import { haptics, hapticSuccess } from "@/lib/haptics";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy-load JournalStats to avoid CJS TDZ (Recharts)
const LazyJournalStats = lazyWithRetry(
  () => import("./JournalStats").then((m) => ({ default: m.JournalStats })),
  "JournalStats"
);

type ModuleState = "card" | "open";

interface JournalModuleProps {
  onToggleHabit?: (habitId: string, date: string) => void;
  onAddGratitude?: (entry: import("@/types").GratitudeEntry) => void;
}

const MOOD_EMOJI: Record<string, string> = {
  great: "\u{1F604}",
  good: "\u{1F642}",
  okay: "\u{1F610}",
  bad: "\u{1F614}",
  terrible: "\u{1F622}",
};

export const JournalModule = memo(function JournalModule({
  onToggleHabit,
  onAddGratitude,
}: JournalModuleProps = {}) {
  const { t, isRTL, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const rewardUser = useGamificationStore((s) => s.rewardUser);
  const [moduleState, setModuleState] = useState<ModuleState>("card");
  const [entryCount, setEntryCount] = useState(0);
  const [showPasswordSettings, setShowPasswordSettings] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return storageGetRaw(SK.JOURNAL_SIDEBAR_COLLAPSED, "true") !== "false";
  });
  const sidebarPanelRef = usePanelRef();
  const sidebarContentRef = useRef<HTMLDivElement>(null);

  useBackHandler(showExportPicker, () => setShowExportPicker(false));

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
        setShowPasswordSettings(false);
        setShowChangePassword(false);
      } else if (activeDialog === "export") {
        setShowExportPicker(false);
      } else if (activeDialog === "remove") {
        setShowRemovePasswordConfirm(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showPasswordSettings, showExportPicker, showRemovePasswordConfirm]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Secure password reset via email verification
  type ResetStep = "idle" | "checking" | "no-account" | "confirm" | "sending" | "sent" | "success";
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");

  const journal = useJournal();
  const security = useJournalSecurity();
  const reminder = useJournalReminder({
    reminderTitle: ts.journalReminderNotifTitle || "Time to Write",
    reminderBody:
      ts.journalReminderNotifBody || "Take a moment to capture your thoughts and feelings.",
  });
  const screenSecurity = useScreenSecurity(moduleState === "open");

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

  const handleOpen = () => {
    setModuleState("open");
  };

  const handleClose = () => {
    journal.goBack();
    setModuleState("card");
    security.lock();
  };

  const handleNewEntry = () => {
    journal.editEntry(null);
  };

  const handleSaveEntry = useCallback(
    async (data: Parameters<typeof journal.createEntry>[0]) => {
      const isNew = !journal.activeEntryId;
      if (journal.activeEntryId) {
        await journal.updateEntry(journal.activeEntryId, data);
      } else {
        await journal.createEntry(data);
      }
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
    [journal, streak, hasTodayEntry, rewardUser]
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
  const isLgScreen = useMediaQuery("(min-width: 1024px)");
  useScrollLock(moduleState === "open");
  useModalA11y(moduleState === "open" && !isLgScreen, handleClose);

  // Collapse sidebar on mount if user preference says collapsed (default: collapsed)
  const initialCollapseApplied = useRef(false);
  useEffect(() => {
    if (!isLgScreen || initialCollapseApplied.current) return;
    initialCollapseApplied.current = true;
    if (sidebarCollapsed) {
      sidebarPanelRef.current?.collapse();
    }
  }, [isLgScreen, sidebarCollapsed, sidebarPanelRef]);

  // Auto-collapse sidebar when entering edit mode on desktop (writing focus)
  useEffect(() => {
    if (journal.view === "editing" && isLgScreen && !sidebarCollapsed) {
      sidebarPanelRef.current?.collapse();
    }
  }, [journal.view, isLgScreen, sidebarCollapsed, sidebarPanelRef]);

  // Keyboard shortcut: Ctrl+\ (Cmd+\ on Mac) to toggle sidebar
  useEffect(() => {
    if (!isLgScreen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        if (sidebarCollapsed) {
          sidebarPanelRef.current?.expand();
        } else {
          sidebarPanelRef.current?.collapse();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isLgScreen, sidebarCollapsed, sidebarPanelRef]);

  // Focus trap for main overlay (skip on desktop — sidebar must be accessible)
  useEffect(() => {
    if (moduleState !== "open" || !overlayRef.current || isLgScreen) return;
    return createFocusTrap(overlayRef.current);
  }, [moduleState, isLgScreen]);

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
        setShowPasswordSettings(false);
        setShowChangePassword(false);
        return true;
      });
    if (journal.view !== "list") {
      return registerModalCloseCallback(() => {
        journal.goBack();
        return true;
      });
    }
    return registerModalCloseCallback(() => {
      setModuleState("card");
      security.lock();
      return true;
    });
  }, [moduleState, resetStep, showPasswordSettings, journal, security]);

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
  if (moduleState === "card") {
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
          "transition-all duration-300",
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
                <StickerRenderer emoji={MOOD_EMOJI[todayMood]} size="xs" />
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
              {ts.journalEntries || "entries"}
            </span>
          )}
          {streak > 0 && (
            <span className="text-xs font-semibold text-orange-500">
              {"\u{1F525}"} {streak} {ts.journalStreak || "streak"}
            </span>
          )}
          <span className="flex-1" />
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 rtl:scale-x-[-1]" />
        </div>
      </motion.button>
    );
  }

  // ── Full-screen overlay (portal to escape PullToRefresh transform ancestor) ──
  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={ts.journalTitle || "Diary"}
      className={cn(
        "fixed inset-0 z-[60] bg-background flex items-start justify-center animate-slide-up h-screen overflow-hidden",
        "md:bg-background/80 md:backdrop-blur-sm",
        "lg:left-[var(--sidebar-width,256px)] lg:bg-background lg:backdrop-blur-none lg:transition-[left] lg:duration-300 lg:items-stretch"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        className={cn(
          "w-full h-full flex flex-col md:my-4 md:mx-4 md:h-[calc(100%-2rem)] md:rounded-2xl md:bg-background md:shadow-2xl md:border md:border-border/20 md:overflow-hidden",
          "lg:max-w-none lg:mx-0 lg:my-0 lg:h-full lg:rounded-none lg:shadow-none lg:border-0 lg:overflow-hidden"
        )}
      >
        {/* Security gate */}
        {security.isLocked && !security.loading && (
          <>
            {/* Header with close */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <h2 className="text-base font-bold text-foreground">{ts.journalTitle || "Diary"}</h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={ts.close || "Close"}
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>
            <JournalLockScreen
              mode="unlock"
              cooldownRemaining={security.cooldownRemaining}
              failedAttempts={security.failedAttempts}
              onUnlock={security.unlock}
              onSetPassword={security.setPassword}
              onForgotPassword={handleForgotPassword}
              onBiometricUnlock={
                security.biometricEnabled ? security.unlockWithBiometric : undefined
              }
              biometricAvailable={security.biometricAvailable && security.biometricEnabled}
            />

            {/* Secure password reset dialog (email verification) */}
            {resetStep !== "idle" && (
              <div
                className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center animate-fade-in"
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
                        className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                      >
                        {ts.journalResetResend || "Resend link"}
                      </button>
                      <button
                        onClick={closeResetDialog}
                        className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
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

        {/* Password setup (first time, no password yet) */}
        {!security.loading &&
          security.hasPassword === false &&
          moduleState === "open" &&
          !journal.loading &&
          journal.totalCount === 0 &&
          showPasswordSettings && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <h2 className="text-base font-bold text-foreground">
                  {ts.journalPasswordSetup || "Set Diary Password"}
                </h2>
                <button
                  onClick={() => setShowPasswordSettings(false)}
                  className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={ts.close || "Close"}
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>
              <JournalLockScreen
                mode="setup"
                cooldownRemaining={0}
                failedAttempts={0}
                onUnlock={async () => false}
                onSetPassword={security.setPassword}
              />
            </>
          )}

        {/* Main content (unlocked or no password) */}
        {!security.isLocked &&
          !security.loading &&
          !(showPasswordSettings && security.hasPassword === false && journal.totalCount === 0) && (
            <>
              {isLgScreen ? (
                /* ═══ DESKTOP: Master-detail split ═══ */
                <PanelLayout className="flex-1 min-h-0">
                  {/* LEFT PANEL: collapsible entry list */}
                  <LayoutPanel
                    panelRef={sidebarPanelRef}
                    defaultSize={30}
                    minSize={20}
                    maxSize={45}
                    collapsible
                    collapsedSize={0}
                    onCollapse={() => {
                      setSidebarCollapsed(true);
                      storageSetRaw(SK.JOURNAL_SIDEBAR_COLLAPSED, "true");
                    }}
                    onExpand={() => {
                      setSidebarCollapsed(false);
                      storageSetRaw(SK.JOURNAL_SIDEBAR_COLLAPSED, "false");
                      // WCAG 2.4.3: move focus into expanded sidebar content
                      requestAnimationFrame(() => sidebarContentRef.current?.focus());
                    }}
                  >
                    <div
                      id="journal-sidebar-panel"
                      ref={sidebarContentRef}
                      tabIndex={-1}
                      className="flex flex-col border-e border-border/30 bg-card h-full overflow-hidden outline-none"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-foreground">
                            {ts.journalTitle || "Diary"}
                          </h2>
                          {streak > 0 && (
                            <span className="text-[10px] font-bold text-orange-500 bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0 animate-streak-fire-glow">
                              {streak} {"\u{1F525}"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => journal.openStats()}
                            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title={ts.journalStatsTitle || "Statistics"}
                            aria-label={ts.journalStatsTitle || "Statistics"}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowPasswordSettings(true)}
                            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title={ts.journalSettings || "Diary settings"}
                            aria-label={ts.settings || "Settings"}
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleClose}
                            className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label={ts.close || "Close"}
                          >
                            <X className="w-5 h-5 text-foreground" />
                          </button>
                        </div>
                      </div>

                      {/* Calendar */}
                      <div className="px-4 py-2 border-b border-border/20">
                        {calendarMode === "full" ? (
                          <JournalCalendarFull
                            entryDates={journal.entryDates}
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
                            selectedDate={journal.selectedDate}
                            onSelectDate={journal.setSelectedDate}
                            onToggleMode={() => {
                              setCalendarMode("full");
                              storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "full");
                            }}
                          />
                        )}
                      </div>

                      {/* Entry list */}
                      <div className="relative flex-1 overflow-y-auto px-3 py-3">
                        <div className="relative z-[1]">
                          <JournalEntryList
                            groupedEntries={journal.groupedEntries}
                            onOpenEntry={journal.openEntry}
                            onDeleteEntry={handleDeleteEntry}
                            onSwipeDelete={handleDeleteEntry}
                            onNewEntry={handleNewEntry}
                            totalCount={journal.totalCount}
                            loading={journal.loading}
                            daysSinceLastEntry={daysSinceLastEntry}
                            privateMode={privateMode}
                            onAddGratitude={onAddGratitude}
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  </LayoutPanel>

                  <ResizeHandle />

                  {/* RIGHT PANEL: editor / viewer / stats / empty */}
                  <LayoutPanel defaultSize={70} maxSize={85}>
                    <div className="flex flex-col min-w-0 h-full bg-background relative">
                      {/* Toggle button: expand/collapse sidebar */}
                      <button
                        onClick={() => {
                          if (sidebarCollapsed) {
                            sidebarPanelRef.current?.expand();
                          } else {
                            sidebarPanelRef.current?.collapse();
                          }
                        }}
                        className="absolute ltr:left-2 rtl:right-2 top-3 z-40 p-2 bg-card rounded-lg shadow-md hover:bg-accent transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label={
                          sidebarCollapsed
                            ? ts.diarySidebarShow || "Show entries"
                            : ts.diarySidebarHide || "Hide entries"
                        }
                        aria-expanded={!sidebarCollapsed}
                        aria-controls="journal-sidebar-panel"
                      >
                        {sidebarCollapsed ? (
                          <PanelLeftOpen className="w-4 h-4" />
                        ) : (
                          <PanelLeftClose className="w-4 h-4" />
                        )}
                      </button>
                      {journal.view === "editing" ? (
                        <JournalEntryEditor
                          entry={journal.activeEntry}
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
                          onBack={journal.goBack}
                          onToggleHabit={onToggleHabit}
                          onAddGratitude={onAddGratitude}
                          desktop
                          sidebarCollapsed={sidebarCollapsed}
                          onToggleSidebar={() => {
                            if (sidebarCollapsed) {
                              sidebarPanelRef.current?.expand();
                            } else {
                              sidebarPanelRef.current?.collapse();
                            }
                          }}
                        />
                      ) : journal.view === "viewing" && journal.activeEntry ? (
                        <JournalEntryViewer
                          entry={journal.activeEntry}
                          onEdit={() => journal.editEntry(journal.activeEntryId)}
                          onDelete={() => handleDeleteEntry(journal.activeEntry?.id || "")}
                          onBack={journal.goBack}
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
                          <LazyJournalStats entries={journal.allEntries} onBack={journal.goBack} />
                        </Suspense>
                      ) : (
                        /* Empty state — no entry selected */
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none">
                          <PenLine className="w-16 h-16 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">
                            {ts.journalSelectEntry || "Select an entry or start writing"}
                          </p>
                        </div>
                      )}
                    </div>
                  </LayoutPanel>
                </PanelLayout>
              ) : (
                /* ═══ MOBILE: existing single-view behavior ═══ */
                <>
                  {/* Editor overlays on top with its own fixed positioning */}
                  {journal.view === "editing" && (
                    <JournalEntryEditor
                      entry={journal.activeEntry}
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
                      onBack={journal.goBack}
                      onToggleHabit={onToggleHabit}
                      onAddGratitude={onAddGratitude}
                    />
                  )}

                  {/* List / Viewer / Stats crossfade */}
                  <AnimatePresence mode="wait">
                    {journal.view === "stats" && (
                      <motion.div
                        key="stats"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col flex-1 min-h-0"
                      >
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
                          <LazyJournalStats entries={journal.allEntries} onBack={journal.goBack} />
                        </Suspense>
                      </motion.div>
                    )}

                    {journal.view === "viewing" && journal.activeEntry && (
                      <motion.div
                        key="viewing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col flex-1 min-h-0"
                      >
                        <JournalEntryViewer
                          entry={journal.activeEntry}
                          onEdit={() => journal.editEntry(journal.activeEntryId)}
                          onDelete={() => handleDeleteEntry(journal.activeEntry?.id || "")}
                          onBack={journal.goBack}
                        />
                      </motion.div>
                    )}

                    {journal.view === "list" && (
                      <motion.div
                        key="list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col flex-1 min-h-0"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-gradient-to-r from-primary/[0.03] via-background/80 to-primary/[0.02] backdrop-blur-xl">
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-foreground">
                              {ts.journalTitle || "Diary"}
                            </h2>
                            {streak > 0 && (
                              <span className="text-[10px] font-bold text-orange-500 bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0 animate-streak-fire-glow">
                                {streak} {"\u{1F525}"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => journal.openStats()}
                              className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                              title={ts.journalStatsTitle || "Statistics"}
                              aria-label={ts.journalStatsTitle || "Statistics"}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShowPasswordSettings(true)}
                              className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                              title={ts.journalSettings || "Diary settings"}
                              aria-label={ts.settings || "Settings"}
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleClose}
                              className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                              aria-label={ts.close || "Close"}
                            >
                              <X className="w-5 h-5 text-foreground" />
                            </button>
                          </div>
                        </div>

                        {/* Calendar */}
                        <div className="px-4 py-2 border-b border-border/10 bg-gradient-to-b from-transparent to-muted/5">
                          {calendarMode === "full" ? (
                            <JournalCalendarFull
                              entryDates={journal.entryDates}
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
                              selectedDate={journal.selectedDate}
                              onSelectDate={journal.setSelectedDate}
                              onToggleMode={() => {
                                setCalendarMode("full");
                                storageSetRaw(SK.JOURNAL_CALENDAR_MODE, "full");
                              }}
                            />
                          )}
                        </div>

                        {/* Entry list */}
                        <div className="relative flex-1 overflow-y-auto px-4 py-3">
                          <ParticleBackground count={6} color="primary" />
                          <div className="relative z-[1]">
                            <JournalEntryList
                              groupedEntries={journal.groupedEntries}
                              onOpenEntry={journal.openEntry}
                              onDeleteEntry={handleDeleteEntry}
                              onSwipeDelete={handleDeleteEntry}
                              onNewEntry={handleNewEntry}
                              totalCount={journal.totalCount}
                              loading={journal.loading}
                              daysSinceLastEntry={daysSinceLastEntry}
                              privateMode={privateMode}
                              onAddGratitude={onAddGratitude}
                            />
                          </div>
                        </div>

                        {/* Password settings bottom sheet — mobile only (desktop rendered below ternary) */}
                        {!isLgScreen && showPasswordSettings && (
                          <>
                            <div
                              className="fixed inset-0 z-[64] bg-black/30 animate-fade-in"
                              onClick={() => {
                                setShowPasswordSettings(false);
                                setShowChangePassword(false);
                              }}
                            />
                            <div
                              role="dialog"
                              aria-modal="true"
                              aria-label={ts.journalSettings || "Diary Settings"}
                              className="fixed bottom-0 inset-x-0 z-[65] animate-slide-up pb-safe lg:max-w-4xl lg:mx-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Handle bar */}
                              <div className="flex justify-center pt-2 pb-1 bg-card rounded-t-2xl">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                              </div>
                              <div className="bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                                <h3 className="text-base font-semibold text-foreground mb-4">
                                  {ts.journalSettings || "Diary Settings"}
                                </h3>
                                {security.hasPassword ? (
                                  showChangePassword ? (
                                    <div>
                                      <JournalLockScreen
                                        mode="change"
                                        cooldownRemaining={0}
                                        failedAttempts={0}
                                        onUnlock={async () => false}
                                        onSetPassword={async () => {}}
                                        onChangePassword={async (oldPw, newPw) => {
                                          const ok = await security.changePassword(oldPw, newPw);
                                          if (ok) {
                                            setShowChangePassword(false);
                                            setShowPasswordSettings(false);
                                          }
                                          return ok;
                                        }}
                                      />
                                      <button
                                        onClick={() => setShowChangePassword(false)}
                                        className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                                      >
                                        {ts.cancel || "Cancel"}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <button
                                        onClick={() => setShowChangePassword(true)}
                                        className="w-full py-3 rounded-xl bg-primary/10 text-primary text-sm font-medium min-h-[44px]"
                                      >
                                        {ts.journalPasswordChange || "Change Password"}
                                      </button>
                                      <button
                                        onClick={() => setShowRemovePasswordConfirm(true)}
                                        className="w-full py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium min-h-[44px]"
                                      >
                                        {ts.journalPasswordRemove || "Remove Password Lock"}
                                      </button>
                                    </div>
                                  )
                                ) : (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-3">
                                      {ts.journalPasswordHint ||
                                        "Protect your diary with a password"}
                                    </p>
                                    <JournalLockScreen
                                      mode="setup"
                                      cooldownRemaining={0}
                                      failedAttempts={0}
                                      onUnlock={async () => false}
                                      onSetPassword={async (pw) => {
                                        await security.setPassword(pw);
                                        setShowPasswordSettings(false);
                                      }}
                                    />
                                  </div>
                                )}
                                {/* Biometric toggle (only if password set + biometric available) */}
                                {security.hasPassword && security.biometricAvailable && (
                                  <div className="mt-4 pt-4 border-t border-border/20">
                                    <div className="flex items-center justify-between min-h-[44px]">
                                      <div>
                                        <p className="text-sm font-medium text-foreground">
                                          {ts.journalBiometricEnable || "Biometric Unlock"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {ts.journalBiometricSubtitle ||
                                            "Use fingerprint or face to unlock"}
                                        </p>
                                      </div>
                                      <Switch
                                        checked={security.biometricEnabled}
                                        onCheckedChange={security.setBiometricEnabled}
                                        aria-label={ts.journalBiometricEnable || "Biometric Unlock"}
                                        className="mt-0.5 shrink-0"
                                      />
                                    </div>
                                  </div>
                                )}

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
                                        aria-label={
                                          ts.journalScreenshotBlock || "Block Screenshots"
                                        }
                                        className="mt-0.5 shrink-0"
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Private mode toggle */}
                                <div className="mt-4 pt-4 border-t border-border/20">
                                  <div className="flex items-center justify-between min-h-[44px]">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">
                                        {ts.journalPrivateMode || "Hide previews"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {ts.journalPrivateModeHint ||
                                          "Show only titles in entry list"}
                                      </p>
                                    </div>
                                    <Switch
                                      checked={privateMode}
                                      onCheckedChange={(checked) => {
                                        setPrivateMode(checked);
                                        storageSetRaw(SK.JOURNAL_PRIVATE_MODE, String(checked));
                                      }}
                                      aria-label={ts.journalPrivateMode || "Hide previews"}
                                      className="mt-0.5 shrink-0"
                                    />
                                  </div>
                                </div>

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

                                {/* Export / Import */}
                                <div className="mt-4 pt-4 border-t border-border/20">
                                  <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">
                                    {ts.journalDataSection || "Data"}
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setShowExportPicker(true)}
                                      disabled={exporting}
                                      className="flex-1 py-2.5 rounded-xl bg-muted/50 text-foreground text-sm font-medium min-h-[44px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                      {exporting ? (
                                        <Loader2
                                          className="w-3.5 h-3.5 animate-spin"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <Download className="w-3.5 h-3.5" />
                                      )}
                                      {ts.journalExport || "Export"}
                                    </button>
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
                                        <Upload className="w-3.5 h-3.5" />
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
                                        if (result.errors.length > 0) {
                                          const msg = `${ts.journalImportPartial || "Imported with errors"}: ${result.imported} ${ts.journalImportEntries || "entries"}, ${result.errors.length} ${ts.journalImportErrors || "errors"}`;
                                          setImportFeedback({
                                            type: "error",
                                            message: msg,
                                          });
                                          announceError(msg);
                                        } else {
                                          const msg = `${ts.journalImportSuccess || "Import complete"}: ${result.imported} ${ts.journalImportEntries || "entries"}`;
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

                                <button
                                  onClick={() => {
                                    setShowPasswordSettings(false);
                                    setShowChangePassword(false);
                                    setShowExportPicker(false);
                                  }}
                                  className="w-full mt-4 py-2.5 text-sm text-muted-foreground min-h-[44px]"
                                >
                                  {ts.cancel || "Cancel"}
                                </button>
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
              )}
            </>
          )}
      </div>

      {/* Desktop: Password settings modal (mobile uses bottom sheet inside its branch) */}
      {isLgScreen && showPasswordSettings && (
        <>
          <div
            className="fixed inset-0 z-[64] bg-black/30 animate-fade-in"
            onClick={() => {
              setShowPasswordSettings(false);
              setShowChangePassword(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={ts.journalSettings || "Diary Settings"}
            className="fixed inset-0 md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl z-[65] bg-card overflow-y-auto"
          >
            <div className="sticky top-0 bg-card border-b border-border p-5 z-10 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                {ts.journalSettings || "Diary Settings"}
              </h3>
              <button
                onClick={() => setShowPasswordSettings(false)}
                aria-label={ts.close || "Close"}
                className="p-2 hover:bg-muted rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {security.hasPassword ? (
                showChangePassword ? (
                  <div>
                    <JournalLockScreen
                      mode="change"
                      cooldownRemaining={0}
                      failedAttempts={0}
                      // INTENTIONAL: no-op stubs — JournalLockScreen requires all handlers but change mode only uses onChangePassword
                      onUnlock={async () => false}
                      onSetPassword={async () => {
                        /* unused in change mode */
                      }}
                      onChangePassword={async (oldPw, newPw) => {
                        const ok = await security.changePassword(oldPw, newPw);
                        if (ok) {
                          setShowChangePassword(false);
                          setShowPasswordSettings(false);
                        }
                        return ok;
                      }}
                    />
                    <button
                      onClick={() => setShowChangePassword(false)}
                      className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                    >
                      {ts.cancel || "Cancel"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowChangePassword(true)}
                      className="w-full py-3 rounded-xl bg-primary/10 text-primary text-sm font-medium min-h-[44px]"
                    >
                      {ts.journalPasswordChange || "Change Password"}
                    </button>
                    <button
                      onClick={() => setShowRemovePasswordConfirm(true)}
                      className="w-full py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium min-h-[44px]"
                    >
                      {ts.journalPasswordRemove || "Remove Password Lock"}
                    </button>
                  </div>
                )
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {ts.journalPasswordHint || "Protect your diary with a password"}
                  </p>
                  <JournalLockScreen
                    mode="setup"
                    cooldownRemaining={0}
                    failedAttempts={0}
                    // INTENTIONAL: no-op stub — setup mode only uses onSetPassword
                    onUnlock={async () => false}
                    onSetPassword={async (pw) => {
                      await security.setPassword(pw);
                      setShowPasswordSettings(false);
                    }}
                  />
                </div>
              )}

              {/* Biometric toggle */}
              {security.hasPassword && security.biometricAvailable && (
                <div className="mt-4 pt-4 border-t border-border/20">
                  <div className="flex items-center justify-between min-h-[44px]">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {ts.journalBiometricEnable || "Biometric Unlock"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ts.journalBiometricSubtitle || "Use fingerprint or face to unlock"}
                      </p>
                    </div>
                    <Switch
                      checked={security.biometricEnabled}
                      onCheckedChange={security.setBiometricEnabled}
                      aria-label={ts.journalBiometricEnable || "Biometric Unlock"}
                      className="mt-0.5 shrink-0"
                    />
                  </div>
                </div>
              )}

              {/* Private mode toggle */}
              <div className="mt-4 pt-4 border-t border-border/20">
                <div className="flex items-center justify-between min-h-[44px]">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {ts.journalPrivateMode || "Hide previews"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ts.journalPrivateModeHint || "Show only titles in entry list"}
                    </p>
                  </div>
                  <Switch
                    checked={privateMode}
                    onCheckedChange={(checked) => {
                      setPrivateMode(checked);
                      storageSetRaw(SK.JOURNAL_PRIVATE_MODE, String(checked));
                    }}
                    aria-label={ts.journalPrivateMode || "Hide previews"}
                    className="mt-0.5 shrink-0"
                  />
                </div>
              </div>

              {/* Export data */}
              <div className="mt-4 pt-4 border-t border-border/20">
                <button
                  onClick={() => {
                    setShowPasswordSettings(false);
                    setShowExportPicker(true);
                  }}
                  className="w-full py-3 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
                >
                  {ts.journalExport || "Export Diary Data"}
                </button>
              </div>
            </div>
          </div>
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
            setShowPasswordSettings(false);
          }}
        />
      )}
    </div>,
    document.body
  );
});
