import {
  startTransition,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
  useDeferredValue,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Plus,
  Search,
  X,
  Loader2,
  PenLine,
  Layers3,
  ChevronRight,
  Briefcase,
  Lightbulb,
  LockKeyhole,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { createPortal } from "react-dom";
import { cn, parseLocalDate } from "@/lib/utils";
import { getRoleHsl, getRoleTone, getSpaceVisualRole } from "@/lib/nonOrbVisualRoles";
import { V2_JOURNAL_ICONS, V2_SHELL_ICONS } from "@/lib/v2IconSystem";
import { springs, stagger } from "@/config/animations";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import type {
  JournalEntry,
  JournalEntryPrefill,
  JournalEntryLink,
  JournalReleaseTraceSummary,
  JournalSpace,
  JournalSpaceCapture,
} from "./types";
import type { GratitudeEntry } from "@/types";
import { JournalEntryCard } from "./JournalEntryCard";
import { ContextMenu } from "@/components/desktop/ContextMenu";
import { useInputMethod } from "@/hooks/useInputMethod";
import { JournalCaptureLauncher } from "./JournalCaptureLauncher";
import { JournalAiConsentDialog } from "./JournalAiConsentDialog";
import {
  GRATITUDE_SPACE_ID,
  createJournalSpaceCapture,
  getJournalSpaceCaptures,
  getJournalSpaces,
  getSpaceEntryLinks,
  linkEntryToSpace,
  saveJournalSpace,
  unlinkEntryFromSpace,
} from "./journalHubStorage";
import auroraMountainsUrl from "@/assets/journal/aurora-mountains.webp";
import { logger } from "@/lib/logger";
import type { SemanticSearchResult } from "@/lib/journalAI";
import { SUPABASE_PUBLIC_API_KEY, SUPABASE_URL } from "@/lib/env";
import { Quote } from "lucide-react";
import { getJournalListDateFilter } from "./journalListFilters";
import { getJournalQuote } from "./journalQuotes";
import { useJournalToday } from "./useJournalToday";
import { formatLocalizedCount } from "./journalWordCount";
import { getLocale } from "@/lib/timeUtils";
import { useThemeStore } from "@/stores/themeStore";
import { scheduleIdle } from "@/lib/scheduleIdle";
import { getJournalDayOfYear, shiftJournalDate } from "./journalDateUtils";
import { getVisibleJournalTags } from "./journalFavorite";
import {
  flushJournalAiConsentRevocation,
  grantJournalAiConsent,
  isJournalAiConsentGranted,
  revokeJournalAiConsent,
  subscribeJournalAiConsent,
} from "./journalAiConsent";
import { isJournalRequestTimeoutError, withJournalRequestTimeout } from "./journalRequestTimeout";

const JOURNAL_AI_AVAILABLE = Boolean(SUPABASE_URL && SUPABASE_PUBLIC_API_KEY);
const JOURNAL_SPACE_MEMORY_FALLBACK_MS = import.meta.env.MODE === "test" ? 650 : 4500;
const JOURNAL_SPACE_MEMORY_MIN_DELAY_MS = import.meta.env.MODE === "test" ? 120 : 2800;

const JOURNAL_MEMORY_HORIZONTAL_RULE_STYLE: CSSProperties = {
  backgroundImage: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.34), transparent)",
};
const JOURNAL_MEMORY_VERTICAL_RULE_STYLE: CSSProperties = {
  backgroundImage: "linear-gradient(180deg, transparent, hsl(var(--primary) / 0.24), transparent)",
};
const DAILY_REFLECTION_CARD_STYLE: CSSProperties = {
  backgroundImage: [
    "linear-gradient(135deg, hsl(var(--primary) / 0.10), transparent 42%)",
    "repeating-linear-gradient(180deg, transparent 0 23px, hsl(var(--border) / 0.07) 24px 25px)",
  ].join(", "),
};
const DAILY_REFLECTION_RULE_STYLE: CSSProperties = {
  backgroundImage: "linear-gradient(180deg, transparent, hsl(var(--primary) / 0.42), transparent)",
};

function getJournalMemoryFieldStyle(backgroundImage: string): CSSProperties {
  return {
    backgroundImage,
    backgroundPosition: "center top, center top, 0 0, 0 0, 0 0",
    backgroundSize: "cover, cover, auto, auto, auto",
  };
}

function getCreateShortcutStyle(backgroundImage: string): CSSProperties {
  return { backgroundImage, backgroundSize: "cover", backgroundPosition: "center" };
}

function getEmptyParticleStyle(particle: { x: string; y: string; size: number }): CSSProperties {
  return { left: particle.x, top: particle.y, width: particle.size, height: particle.size };
}

function getEmptySparkleStyle(sparkle: { x: number; y: number }): CSSProperties {
  return {
    left: `calc(50% + ${sparkle.x}px)`,
    top: `calc(50% + ${sparkle.y}px)`,
  };
}

function getSpacesSheetBackdropStyle(isPaperTheme: boolean): CSSProperties {
  return {
    backgroundImage: [
      "linear-gradient(180deg, hsl(var(--primary) / 0.11), transparent 34%)",
      isPaperTheme
        ? [
            "radial-gradient(circle at 28% 16%, hsl(var(--zf-role-space) / 0.24), transparent 34%)",
            "radial-gradient(circle at 82% 4%, hsl(var(--zf-role-energy) / 0.18), transparent 30%)",
            "linear-gradient(160deg, hsl(var(--card) / 0.94), hsl(var(--surface-overlay) / 0.90))",
          ].join(", ")
        : `linear-gradient(180deg, hsl(var(--card) / 0.36), hsl(var(--card) / 0.94)), url(${auroraMountainsUrl})`,
    ].join(", "),
    backgroundSize: "cover",
    backgroundPosition: "center top",
  };
}

function idsFingerprint(items: Array<{ id: string; updatedAt?: number }>): string {
  if (items.length === 0) return "";
  return items.map((item) => `${item.id}:${item.updatedAt ?? ""}`).join("|");
}

function linksFingerprint(items: JournalEntryLink[]): string {
  if (items.length === 0) return "";
  return items
    .map((item) => `${item.id}:${item.entryId}:${item.targetType}:${item.targetId}`)
    .join("|");
}

async function searchJournalSemanticLazy(query: string): Promise<SemanticSearchResult[]> {
  const { searchJournalSemantic } = await import("@/lib/journalAI");
  return searchJournalSemantic(query);
}

async function canUseJournalAi(): Promise<boolean> {
  if (!JOURNAL_AI_AVAILABLE) return false;
  const { supabase } = await import("@/lib/supabaseClient");
  return Boolean(supabase);
}

/** Daily first-party reflection prompts — no unverified attribution or pressure framing. */
const DAILY_REFLECTIONS: { translationId: string; fallback: string }[] = [
  {
    translationId: "journalReflectionPrompt1",
    fallback: "Name the moment that is asking for attention.",
  },
  {
    translationId: "journalReflectionPrompt2",
    fallback: "Write one true sentence about today.",
  },
  {
    translationId: "journalReflectionPrompt3",
    fallback: "Notice what changed in your body, mood, or focus.",
  },
  {
    translationId: "journalReflectionPrompt4",
    fallback: "Keep only the detail you want future you to remember.",
  },
  {
    translationId: "journalReflectionPrompt5",
    fallback: "Start small: a place, a feeling, a next step.",
  },
  {
    translationId: "journalReflectionPrompt6",
    fallback: "Park the thought here so you can revisit it later.",
  },
];

const JournalEntryIcon = V2_JOURNAL_ICONS.entry;
const CreateFolderIcon = V2_JOURNAL_ICONS.createFolder;
const OpenFolderIcon = V2_JOURNAL_ICONS.openFolder;
const GratitudeFolderIcon = V2_JOURNAL_ICONS.gratitudeFolder;
const QuietReleaseIcon = V2_JOURNAL_ICONS.quietRelease;
const AiSearchIcon = V2_SHELL_ICONS.insight;

function getSafeSpaceCoverImageUrl(coverImage: string | undefined): string | null {
  const value = coverImage?.trim();
  if (!value) return null;
  if (/^(?:https?:)?\/\//i.test(value)) return null;
  if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,/i.test(value)) return value;
  if (/^blob:/i.test(value)) return value;
  if (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("assets/")
  ) {
    return value;
  }
  if (typeof window === "undefined") return null;

  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.href : null;
  } catch {
    return null;
  }
}

function toCssImageUrl(imageUrl: string): string {
  return "url(" + JSON.stringify(imageUrl) + ")";
}

function getDailyReflection(): (typeof DAILY_REFLECTIONS)[0] {
  const dayOfYear = getJournalDayOfYear();
  return DAILY_REFLECTIONS[dayOfYear % DAILY_REFLECTIONS.length];
}

function JournalMemoryBackdrop() {
  const isPaperTheme = useThemeStore((state) => state.appliedTheme === "paper");
  const fieldClass = isPaperTheme ? "journal-memory-field--paper" : "journal-memory-field--night";
  const backgroundImage = isPaperTheme
    ? [
        "radial-gradient(circle at 52% 2%, hsl(var(--zf-role-energy) / 0.26), transparent 30%)",
        "radial-gradient(circle at 16% 20%, hsl(var(--zf-role-space) / 0.24), transparent 32%)",
        "radial-gradient(circle at 88% 34%, hsl(var(--zf-role-diary) / 0.18), transparent 36%)",
        "linear-gradient(165deg, hsl(var(--background) / 0.34), hsl(var(--card) / 0.72) 46%, hsl(var(--surface-overlay) / 0.88))",
        "repeating-linear-gradient(104deg, transparent 0 30px, hsl(var(--border) / 0.15) 31px 32px)",
      ].join(", ")
    : [
        "linear-gradient(180deg, hsl(var(--background) / 0.32), hsl(var(--background) / 0.92))",
        `url(${auroraMountainsUrl})`,
        "linear-gradient(145deg, hsl(var(--primary) / 0.10), transparent 34%)",
        "linear-gradient(315deg, hsl(var(--accent) / 0.08), transparent 42%)",
        "repeating-linear-gradient(105deg, transparent 0 26px, hsl(var(--border) / 0.08) 27px 28px)",
      ].join(", ");

  return (
    <>
      <div
        aria-hidden="true"
        data-surface={isPaperTheme ? "journal-memory-paper" : "journal-memory-night"}
        className="pointer-events-none absolute inset-x-[-14px] top-[-18px] bottom-0 -z-10 overflow-hidden rounded-[2rem]"
      >
        <div
          className={cn("journal-memory-field absolute inset-0 opacity-80", fieldClass)}
          style={getJournalMemoryFieldStyle(backgroundImage)}
        />
        <div
          className="absolute inset-x-8 top-24 h-px opacity-70"
          style={JOURNAL_MEMORY_HORIZONTAL_RULE_STYLE}
        />
        <div
          className="absolute bottom-20 start-5 h-28 w-px opacity-50"
          style={JOURNAL_MEMORY_VERTICAL_RULE_STYLE}
        />
      </div>
    </>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: stagger.perItem / 1000 } },
} satisfies Variants;

/** Capped stagger: items beyond index 4 appear instantly (no delay).
 *  Telegram-style: subtle y + scale with snappy spring. */
const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 28,
      delay: stagger.delayForIndex(i),
    },
  }),
};

/** Static variants when prefers-reduced-motion is active */
const staticVariants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
} satisfies Variants;

function formatReleaseTraceTime(
  timestamp: number,
  language: ReturnType<typeof useLanguage>["language"]
): string {
  try {
    return new Intl.DateTimeFormat(getLocale(language), {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

function formatReleaseTraceTitle(
  trace: JournalReleaseTraceSummary,
  language: ReturnType<typeof useLanguage>["language"],
  ts: Record<string, string>
): string {
  if (trace.count === 1) {
    return ts.journalReleaseTraceSingle || "Thought released";
  }
  return formatLocalizedCount(
    trace.count,
    language,
    ts,
    "journalReleaseTraceCount",
    ts.journalReleaseTraceCountOther || "release records"
  );
}

function getCaptureDisplayTitle(capture: JournalSpaceCapture, ts: Record<string, string>): string {
  if (capture.sourceType === "gratitude") {
    return ts.journalSpaceGratitudeCaptureTitle || "Gratitude";
  }
  return capture.title;
}

function getCaptureFieldPrompt(
  capture: JournalSpaceCapture,
  field: JournalSpaceCapture["fields"][number],
  ts: Record<string, string>
): string {
  if (capture.sourceType === "gratitude" && field.prompt === "gratitude") {
    return ts.journalSpaceGratitudeCapturePrompt || "What I appreciated";
  }
  return field.prompt;
}

type JournalSpaceOption = {
  id: string;
  name: string;
  description: string;
  count: number;
  iconKey: JournalSpace["iconKey"] | "layers";
  accent: JournalSpace["accent"];
  private: boolean;
  custom: boolean;
  kind?: JournalSpace["kind"];
  coverKey?: string;
  coverImage?: string;
  autoSource?: JournalSpace["autoSource"];
  locked?: boolean;
};

interface JournalEntryListProps {
  groupedEntries: { label: string; key: string; entries: JournalEntry[] }[];
  allEntries?: JournalEntry[];
  onOpenEntry: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onSwipeDelete?: (id: string) => void;
  onNewEntry: () => void;
  onAddGratitude?: (entry: GratitudeEntry) => void | Promise<void>;
  totalCount: number;
  loading?: boolean;
  selectedDate?: string | null;
  today?: string;
  daysSinceLastEntry?: number | null;
  privateMode?: boolean;
  /** Compact single-column mode for desktop left panel */
  compact?: boolean;
  /** Currently active entry ID (desktop master-detail) — for active/dimmed styling */
  activeEntryId?: string | null;
  /** Hide legacy speed dial when another mobile command surface owns capture actions. */
  showFab?: boolean;
  /** Hide folder/space workspace on compact chrome where the route shell owns secondary actions. */
  showSpaces?: boolean;
  /** Use the parent page wallpaper instead of the list-local memory backdrop. */
  useSharedDiaryWallpaper?: boolean;
  /** Open a new entry with contextual defaults, for example a selected folder tag. */
  onNewEntryWithPrefill?: (prefill: JournalEntryPrefill) => void;
  /** Mobile V2 can focus the selected day instead of showing older groups below it. */
  selectedDateOnly?: boolean;
  releaseTraceSummaries?: Map<string, JournalReleaseTraceSummary>;
  onReleaseThought?: () => void | Promise<void>;
}

export const JournalEntryList = memo(function JournalEntryList({
  groupedEntries,
  allEntries,
  onOpenEntry,
  onDeleteEntry,
  onSwipeDelete,
  onNewEntry,
  onAddGratitude,
  totalCount,
  loading = false,
  selectedDate,
  today,
  privateMode = false,
  compact = false,
  activeEntryId = null,
  showFab = true,
  showSpaces = true,
  useSharedDiaryWallpaper = false,
  onNewEntryWithPrefill,
  selectedDateOnly = false,
  releaseTraceSummaries,
  onReleaseThought,
}: JournalEntryListProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const lifecycleToday = useJournalToday();
  const currentDay = today ?? lifecycleToday;
  const currentJournalQuote = getJournalQuote(ts, parseLocalDate(currentDay), { scope: "all" });
  const { isMouse } = useInputMethod();
  const reducedMotion = useReducedMotion();
  const isPaperTheme = useThemeStore((state) => state.appliedTheme === "paper");
  const activeContainerVariants = reducedMotion ? staticVariants : containerVariants;
  const activeItemVariants = reducedMotion ? staticVariants : itemVariants;

  // Stable handlers that accept ID — prevents inline arrows from defeating memo on JournalEntryCard
  const handleTap = useCallback(
    (id: string) => {
      if (privateMode) return;
      onOpenEntry(id);
    },
    [onOpenEntry, privateMode]
  );
  const handleDelete = useCallback((id: string) => onDeleteEntry(id), [onDeleteEntry]);
  const handleSwipeDelete = useCallback((id: string) => onSwipeDelete?.(id), [onSwipeDelete]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Defer the debounced value so list filtering doesn't block input responsiveness (INP)
  const deferredSearch = useDeferredValue(debouncedSearch);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [journalSpaces, setJournalSpaces] = useState<JournalSpace[]>([]);
  const [spacesSheetOpen, setSpacesSheetOpen] = useState(false);
  const [activeSpaceModeId, setActiveSpaceModeId] = useState<string | null>(null);
  const [activeStudioId, setActiveStudioId] = useState<string | null>(null);
  const [activeStudioMode, setActiveStudioMode] = useState<"compose" | "board">("compose");
  const [studioDrafts, setStudioDrafts] = useState<Record<string, string[]>>({});
  const [spaceCaptures, setSpaceCaptures] = useState<JournalSpaceCapture[]>([]);
  const [lastCaptureId, setLastCaptureId] = useState<string | null>(null);
  const [studioSaving, setStudioSaving] = useState(false);
  const [folderCreatorOpen, setFolderCreatorOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderSaving, setFolderSaving] = useState(false);
  const [spaceEntryLinks, setSpaceEntryLinks] = useState<JournalEntryLink[]>([]);
  const [routeEntryId, setRouteEntryId] = useState<string | null>(null);
  const [routeSavingKey, setRouteSavingKey] = useState<string | null>(null);
  const closeEntryActions = useCallback(() => setRouteEntryId(null), []);
  const closeSpacesLayer = useCallback(() => {
    if (activeStudioId) {
      setActiveStudioId(null);
      return;
    }
    if (folderCreatorOpen) {
      setFolderCreatorOpen(false);
      setFolderError(null);
      return;
    }
    setSpacesSheetOpen(false);
  }, [activeStudioId, folderCreatorOpen]);
  const entryActionsA11y = useModalA11y(Boolean(routeEntryId), closeEntryActions);
  const spacesOpenerRef = useRef<HTMLButtonElement>(null);
  const spacesSheetA11y = useModalA11y(spacesSheetOpen, closeSpacesLayer, spacesOpenerRef);
  const previousFolderCreatorOpenRef = useRef(folderCreatorOpen);

  useEffect(() => {
    const wasOpen = previousFolderCreatorOpenRef.current;
    previousFolderCreatorOpenRef.current = folderCreatorOpen;
    if (!wasOpen || folderCreatorOpen || !spacesSheetOpen) return;
    const frame = requestAnimationFrame(() => {
      spacesSheetA11y.modalRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [folderCreatorOpen, spacesSheetA11y.modalRef, spacesSheetOpen]);
  const handleEntryActions = useCallback((entry: JournalEntry) => {
    setRouteEntryId(entry.id);
  }, []);

  // Account-backed private search state
  const [aiMode, setAiMode] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSearchError, setAiSearchError] = useState(false);
  const [aiResults, setAiResults] = useState<SemanticSearchResult[]>([]);
  const [aiConsentBusy, setAiConsentBusy] = useState(false);
  const [aiConsentError, setAiConsentError] = useState(false);
  const [aiConsentDialogOpen, setAiConsentDialogOpen] = useState(false);
  const [aiSearchConsentGranted, setAiSearchConsentGranted] = useState(isJournalAiConsentGranted);
  const aiToggleButtonRef = useRef<HTMLButtonElement>(null);
  const aiConsentRequestSeqRef = useRef(0);
  const aiConsentRequestActiveRef = useRef(false);

  const rollbackCancelledAiConsent = useCallback(() => {
    void revokeJournalAiConsent().catch((error) => {
      logger.warn("[Journal] Failed to roll back cancelled AI consent", error);
    });
  }, []);

  const cancelAiConsent = useCallback(() => {
    const shouldRollback = aiConsentRequestActiveRef.current;
    aiConsentRequestSeqRef.current += 1;
    aiConsentRequestActiveRef.current = false;
    setAiConsentBusy(false);
    setAiConsentDialogOpen(false);
    setAiConsentError(false);
    if (shouldRollback) rollbackCancelledAiConsent();
  }, [rollbackCancelledAiConsent]);

  useEffect(
    () => () => {
      aiConsentRequestSeqRef.current += 1;
      if (!aiConsentRequestActiveRef.current) return;
      aiConsentRequestActiveRef.current = false;
      rollbackCancelledAiConsent();
    },
    [rollbackCancelledAiConsent]
  );

  useEffect(() => {
    const syncConsent = () => {
      const granted = isJournalAiConsentGranted();
      setAiSearchConsentGranted(granted);
      if (granted) return;
      setAiMode(false);
      setAiResults([]);
      setAiSearching(false);
    };
    const unsubscribe = subscribeJournalAiConsent(syncConsent);
    void flushJournalAiConsentRevocation().finally(syncConsent);
    return unsubscribe;
  }, []);

  // Debounce local text search and account-backed private search separately.
  useEffect(() => {
    const delay = aiMode ? 800 : 300;
    const timer = setTimeout(() => setDebouncedSearch(searchInput), delay);
    return () => clearTimeout(timer);
  }, [searchInput, aiMode]);

  useEffect(() => {
    if (!showSpaces) return;
    let mounted = true;
    const spacesHandle = scheduleIdle(
      () => {
        void getJournalSpaces()
          .then((spaces) => {
            if (!mounted) return;
            if (idsFingerprint(spaces) === idsFingerprint(journalSpaces)) return;
            startTransition(() => {
              setJournalSpaces(spaces);
            });
          })
          .catch((error) => {
            logger.warn("[Journal] Failed to load folders", error);
          });
      },
      650,
      120
    );
    const memoryHandle = scheduleIdle(
      () => {
        void Promise.all([getJournalSpaceCaptures(), getSpaceEntryLinks()])
          .then(([captures, links]) => {
            if (!mounted) return;
            if (
              idsFingerprint(captures) === idsFingerprint(spaceCaptures) &&
              linksFingerprint(links) === linksFingerprint(spaceEntryLinks)
            ) {
              return;
            }
            startTransition(() => {
              setSpaceCaptures(captures);
              setSpaceEntryLinks(links);
            });
          })
          .catch((error) => {
            logger.warn("[Journal] Failed to load space memory", error);
          });
      },
      JOURNAL_SPACE_MEMORY_FALLBACK_MS,
      JOURNAL_SPACE_MEMORY_MIN_DELAY_MS
    );
    return () => {
      mounted = false;
      spacesHandle.cancel();
      memoryHandle.cancel();
    };
  }, [journalSpaces, showSpaces, spaceCaptures, spaceEntryLinks]);

  const refreshSpaceMemory = useCallback(async () => {
    try {
      const [spaces, captures, links] = await Promise.all([
        getJournalSpaces(),
        getJournalSpaceCaptures(),
        getSpaceEntryLinks(),
      ]);
      setJournalSpaces(spaces);
      setSpaceCaptures(captures);
      setSpaceEntryLinks(links);
    } catch (error) {
      logger.warn("[Journal] Failed to refresh spaces", error);
    }
  }, []);

  const handleAddGratitudeToSpaces = useCallback(
    async (entry: GratitudeEntry) => {
      await Promise.resolve(onAddGratitude?.(entry));
      await refreshSpaceMemory();
    },
    [onAddGratitude, refreshSpaceMemory]
  );

  useBackHandler(!!activeSpaceModeId && !spacesSheetOpen, () => {
    setActiveSpaceModeId(null);
    setActiveStudioMode("compose");
  });

  useEffect(() => {
    if (!activeSpaceModeId || spacesSheetOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveSpaceModeId(null);
        setActiveStudioMode("compose");
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [activeSpaceModeId, spacesSheetOpen]);

  useEffect(() => {
    if (!privateMode) return;
    setAiMode(false);
    setAiResults([]);
    setAiSearching(false);
  }, [privateMode]);

  // Private search effect
  useEffect(() => {
    if (privateMode || !aiMode || !debouncedSearch.trim()) {
      setAiResults([]);
      setAiSearching(false);
      setAiSearchError(false);
      return;
    }

    let cancelled = false;
    setAiSearching(true);
    setAiSearchError(false);

    searchJournalSemanticLazy(debouncedSearch.trim())
      .then((results) => {
        if (!cancelled) {
          setAiResults(results);
          setAiSearchError(false);
        }
      })
      .catch((error) => {
        logger.warn("[Journal] Private search failed", error);
        if (!cancelled) {
          setAiResults([]);
          setAiSearchError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setAiSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [aiMode, debouncedSearch, privateMode]);

  const activateAiMode = useCallback(() => {
    setAiMode(true);
  }, []);

  const confirmAiConsent = useCallback(async () => {
    if (aiConsentBusy) return;
    const requestSeq = ++aiConsentRequestSeqRef.current;
    aiConsentRequestActiveRef.current = true;
    setAiConsentBusy(true);
    setAiConsentError(false);
    try {
      const consent = await withJournalRequestTimeout(grantJournalAiConsent());
      if (requestSeq !== aiConsentRequestSeqRef.current) return;
      if (consent.status !== "granted") {
        throw new Error(`AI consent could not be granted: ${consent.status}`);
      }
      aiConsentRequestActiveRef.current = false;
      setAiSearchConsentGranted(true);
      setAiConsentDialogOpen(false);
      activateAiMode();
    } catch (error) {
      if (requestSeq !== aiConsentRequestSeqRef.current) return;
      aiConsentRequestActiveRef.current = false;
      logger.warn("[Journal] Failed to grant AI search consent", error);
      setAiConsentError(true);
      if (isJournalRequestTimeoutError(error)) rollbackCancelledAiConsent();
    } finally {
      if (requestSeq === aiConsentRequestSeqRef.current) setAiConsentBusy(false);
    }
  }, [activateAiMode, aiConsentBusy, rollbackCancelledAiConsent]);

  // Toggle private account-backed search. Lexical mode does not upload an index.
  const toggleAiMode = useCallback(() => {
    if (!JOURNAL_AI_AVAILABLE || privateMode || aiConsentBusy) return;
    if (aiMode) {
      setAiMode(false);
      setAiResults([]);
      setAiSearching(false);
      setAiConsentError(false);
      return;
    }

    setAiConsentBusy(true);
    setAiConsentError(false);
    void canUseJournalAi()
      .then(async (available) => {
        if (!available) throw new Error("AI search is unavailable");

        if (!aiSearchConsentGranted) {
          setAiConsentDialogOpen(true);
          return;
        }
        activateAiMode();
      })
      .catch((error) => {
        logger.warn("[Journal] Failed to initialize AI search", error);
        setAiConsentError(true);
      })
      .finally(() => setAiConsentBusy(false));
  }, [aiConsentBusy, aiMode, aiSearchConsentGranted, activateAiMode, privateMode]);

  const allEntriesForSpaces = useMemo(
    () => allEntries ?? groupedEntries.flatMap((group) => group.entries),
    [allEntries, groupedEntries]
  );

  const spaceLinkCountBySpaceId = useMemo(() => {
    const counts = new Map<string, number>();
    spaceEntryLinks.forEach((link) => {
      if (link.targetType !== "space") return;
      counts.set(link.targetId, (counts.get(link.targetId) ?? 0) + 1);
    });
    return counts;
  }, [spaceEntryLinks]);

  const spaceCaptureCountBySpaceId = useMemo(() => {
    const counts = new Map<string, number>();
    spaceCaptures.forEach((capture) => {
      counts.set(capture.spaceId, (counts.get(capture.spaceId) ?? 0) + 1);
    });
    return counts;
  }, [spaceCaptures]);

  const folderItems = useMemo<JournalSpaceOption[]>(() => {
    if (!showSpaces) return [];
    return journalSpaces
      .filter(
        (space) =>
          space.id === GRATITUDE_SPACE_ID ||
          space.autoSource === "gratitude" ||
          space.kind !== "system"
      )
      .map((space) => {
        const isGratitudeSpace =
          space.id === GRATITUDE_SPACE_ID || space.autoSource === "gratitude";
        const name = space.nameKey ? ts[space.nameKey] || space.nameKey : space.name || "";
        const description = space.descriptionKey
          ? ts[space.descriptionKey] || ""
          : space.description?.trim() ||
            ts.journalFolderEmptyHint ||
            "Create a first note here and it will stay connected to this folder.";
        const linkedCount = spaceLinkCountBySpaceId.get(space.id) ?? 0;
        const captureCount = spaceCaptureCountBySpaceId.get(space.id) ?? 0;
        return {
          id: space.id,
          name,
          description,
          count: linkedCount + captureCount,
          iconKey: space.iconKey,
          accent: space.accent,
          private: space.private,
          custom: !isGratitudeSpace,
          kind: space.kind,
          coverKey: space.coverKey,
          coverImage: space.coverImage,
          autoSource: space.autoSource,
          locked: space.locked,
        };
      })
      .filter((space) => space.name.trim().length > 0);
  }, [journalSpaces, showSpaces, spaceCaptureCountBySpaceId, spaceLinkCountBySpaceId, ts]);

  const spaceOptions = useMemo(() => folderItems, [folderItems]);

  const visibleSpaceOptions = useMemo(
    () => (privateMode ? spaceOptions.slice(0, 1) : spaceOptions),
    [privateMode, spaceOptions]
  );

  const activeStudio = useMemo(
    () => spaceOptions.find((space) => space.id === activeStudioId) || null,
    [activeStudioId, spaceOptions]
  );

  const activeStudioCaptures = useMemo(
    () => spaceCaptures.filter((capture) => capture.spaceId === activeStudioId),
    [activeStudioId, spaceCaptures]
  );

  const activeSpaceMode = useMemo(
    () => spaceOptions.find((space) => space.id === activeSpaceModeId) || null,
    [activeSpaceModeId, spaceOptions]
  );

  useEffect(() => {
    if (!activeSpaceMode) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector('[data-testid="journal-space-mode"]');
      if (!(target instanceof HTMLElement) || typeof target.scrollIntoView !== "function") {
        return;
      }
      target.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeSpaceMode]);

  const activeSpaceModeCaptures = useMemo(
    () => spaceCaptures.filter((capture) => capture.spaceId === activeSpaceModeId),
    [activeSpaceModeId, spaceCaptures]
  );

  const getSpaceIcon = useCallback((iconKey: JournalSpaceOption["iconKey"]) => {
    if (iconKey === "layers") return Layers3;
    if (iconKey === "briefcase") return Briefcase;
    if (iconKey === "lightbulb") return Lightbulb;
    if (iconKey === "moon") return LockKeyhole;
    if (iconKey === "leaf" || iconKey === "sprout") return GratitudeFolderIcon;
    if (iconKey === "bookOpen" || iconKey === "penLine") return JournalEntryIcon;
    return OpenFolderIcon;
  }, []);

  const getSpaceCoverStyle = useCallback(
    (space: JournalSpaceOption) => {
      const fallbackCover = isPaperTheme
        ? [
            "radial-gradient(circle at 28% 22%, hsl(var(--zf-role-space) / 0.26), transparent 36%)",
            "radial-gradient(circle at 82% 18%, hsl(var(--zf-role-energy) / 0.18), transparent 34%)",
            "linear-gradient(145deg, hsl(var(--card) / 0.86), hsl(var(--surface-overlay) / 0.78))",
          ].join(", ")
        : `url(${auroraMountainsUrl})`;
      const safeCoverImage = getSafeSpaceCoverImageUrl(space.coverImage);
      const coverImage = safeCoverImage ? toCssImageUrl(safeCoverImage) : fallbackCover;
      const role = getSpaceVisualRole(space);
      const accentGlow = space.private
        ? "radial-gradient(circle at 34% 28%, hsl(var(--zf-role-rest) / 0.24), transparent 36%)"
        : `radial-gradient(circle at 34% 28%, ${getRoleHsl(role, 0.26)}, transparent 34%)`;
      return {
        backgroundImage: [
          accentGlow,
          "linear-gradient(145deg, hsl(var(--card) / 0.20), hsl(var(--background) / 0.74))",
          coverImage,
        ].join(", "),
        backgroundPosition: "center",
        backgroundSize: "cover",
      };
    },
    [isPaperTheme]
  );

  const getSpaceDisplayIcon = useCallback(
    (space: JournalSpaceOption) => (privateMode ? OpenFolderIcon : getSpaceIcon(space.iconKey)),
    [getSpaceIcon, privateMode]
  );

  const getSpaceDisplayVisualRole = useCallback(
    (space: JournalSpaceOption) => (privateMode ? ("space" as const) : getSpaceVisualRole(space)),
    [privateMode]
  );

  const getSpaceDisplayCoverStyle = useCallback(
    (space: JournalSpaceOption) => (privateMode ? undefined : getSpaceCoverStyle(space)),
    [getSpaceCoverStyle, privateMode]
  );

  const getSpaceExperience = useCallback(
    (space: JournalSpaceOption) => {
      if (privateMode) {
        return {
          mode: ts.privateMode || "Private",
          action: ts.journalSpaceAddEntry || ts.journalWriteInFolder || "Add entry",
          prefillTitle: ts.journalPrivateEntry || ts.privateMode || "Private entry",
          prefillContent: "",
        };
      }

      if (space.custom && space.autoSource !== "gratitude") {
        return {
          mode: ts.journalFolders || "Folder",
          action: ts.journalSpaceAddEntry || ts.journalWriteInFolder || "Add entry",
          prefillTitle: space.name,
          prefillContent: "",
        };
      }

      const id = space.id.toLowerCase();
      const normalizedName = space.name.trim().toLowerCase();
      const kind =
        space.id === "space-all"
          ? "All"
          : space.autoSource === "gratitude" || id.includes("gratitude")
            ? "Gratitude"
            : space.private || id.includes("private") || normalizedName.includes("private")
              ? "Private"
              : id.includes("personal") ||
                  normalizedName.includes("personal") ||
                  space.iconKey === "leaf"
                ? "Personal"
                : id.includes("ideas") ||
                    normalizedName.includes("ideas") ||
                    space.iconKey === "lightbulb"
                  ? "Ideas"
                  : "Projects";

      return {
        mode: ts[`journalSpaceMode${kind}`] || space.description,
        action: ts[`journalSpaceAction${kind}`] || ts.journalWriteInSpace || "Write in space",
        prefillTitle: ts[`journalSpacePrefillTitle${kind}`] || space.name,
        prefillContent: ts[`journalSpacePrefillContent${kind}`] || "",
      };
    },
    [privateMode, ts]
  );

  const getStudioPrompts = useCallback(
    (space: JournalSpaceOption) => {
      const experience = getSpaceExperience(space);
      const prompts = experience.prefillContent
        .split(/\n+/)
        .map((line) => line.trim().replace(/[:：]$/, ""))
        .filter(Boolean);
      return prompts.length > 0 ? prompts : [ts.journalCapturePlaceholder || "Write here"];
    },
    [getSpaceExperience, ts]
  );

  const handleSelectSpace = useCallback((space: JournalSpaceOption) => {
    setSelectedSpaceId(space.id === "space-all" ? null : space.id);
    setSelectedTag(space.id.startsWith("tag-") ? space.name : null);
    setSpacesSheetOpen(false);
    setFolderCreatorOpen(false);
    setFolderError(null);
  }, []);

  const handleOpenStudio = useCallback(
    (space: JournalSpaceOption) => {
      setActiveSpaceModeId(space.id);
      setActiveStudioId(null);
      setActiveStudioMode(
        spaceCaptures.some((capture) => capture.spaceId === space.id) ? "board" : "compose"
      );
      setSpacesSheetOpen(false);
      setFolderCreatorOpen(false);
      setFolderError(null);
    },
    [spaceCaptures]
  );

  const handleStudioFieldChange = useCallback((spaceId: string, index: number, value: string) => {
    setStudioDrafts((current) => {
      const nextValues = [...(current[spaceId] || [])];
      nextValues[index] = value;
      return { ...current, [spaceId]: nextValues };
    });
  }, []);

  const activeDraftDate = getJournalListDateFilter(true, selectedDate) ?? currentDay;

  const getSpaceDisplayName = useCallback(
    (space: JournalSpaceOption) =>
      privateMode ? ts.journalHubSpacePrivate || ts.privateMode || "Private space" : space.name,
    [privateMode, ts]
  );

  const getSpaceDisplayDescription = useCallback(
    (space: JournalSpaceOption) => (privateMode ? "" : space.description),
    [privateMode]
  );

  const buildStudioPrefill = useCallback(
    (space: JournalSpaceOption, capture?: JournalSpaceCapture): JournalEntryPrefill => {
      const experience = getSpaceExperience(space);
      const fields =
        capture?.fields ??
        getStudioPrompts(space).map((prompt, index) => ({
          prompt,
          value: studioDrafts[space.id]?.[index]?.trim() || "",
        }));
      const content = fields
        .map((field) => (field.value ? `${field.prompt}\n${field.value}` : `${field.prompt}\n`))
        .join("\n\n");

      return {
        title: capture?.title || experience.prefillTitle,
        content,
        tags: privateMode || space.id === "space-all" ? [] : [space.name],
        date: capture?.date || activeDraftDate,
        spaceId:
          !privateMode && space.id.startsWith("space-") && space.id !== "space-all"
            ? space.id
            : undefined,
      };
    },
    [activeDraftDate, getSpaceExperience, getStudioPrompts, privateMode, studioDrafts]
  );

  const handleSaveStudioCapture = useCallback(
    async (space: JournalSpaceOption) => {
      const experience = getSpaceExperience(space);
      const prompts = getStudioPrompts(space);
      const values = studioDrafts[space.id] || [];
      const fields = prompts.map((prompt, index) => ({
        prompt,
        value: values[index]?.trim() || "",
      }));
      const hasContent = fields.some((field) => field.value.length > 0);
      if (!hasContent || studioSaving) return;

      setStudioSaving(true);
      try {
        const capture = await createJournalSpaceCapture({
          spaceId: space.id,
          spaceName: space.name,
          mode: experience.mode,
          title: experience.prefillTitle,
          fields,
          date: activeDraftDate,
        });
        setSpaceCaptures((current) => [
          capture,
          ...current.filter((item) => item.id !== capture.id),
        ]);
        setStudioDrafts((current) => ({ ...current, [space.id]: [] }));
        setLastCaptureId(capture.id);
        setActiveStudioMode("board");
      } catch (error) {
        logger.error("[Journal] Failed to save space capture", error);
      } finally {
        setStudioSaving(false);
      }
    },
    [activeDraftDate, getSpaceExperience, getStudioPrompts, studioDrafts, studioSaving]
  );

  const handleOpenCaptureInEditor = useCallback(
    (space: JournalSpaceOption, capture?: JournalSpaceCapture) => {
      setSpacesSheetOpen(false);
      setActiveStudioId(null);
      setActiveSpaceModeId(null);
      setFolderCreatorOpen(false);
      setFolderError(null);

      if (onNewEntryWithPrefill) {
        onNewEntryWithPrefill(buildStudioPrefill(space, capture));
        return;
      }
      onNewEntry();
    },
    [buildStudioPrefill, onNewEntry, onNewEntryWithPrefill]
  );

  const handleCreateFolder = useCallback(async () => {
    const normalized = folderName.trim().replace(/\s+/g, " ");
    const normalizedDescription = folderDescription.trim().replace(/\s+/g, " ");
    if (normalized.length < 2) {
      setFolderError(
        ts.journalSpaceNameTooShort || ts.journalFolderNameTooShort || "Use at least 2 characters"
      );
      return;
    }

    const exists = folderItems.some(
      (space) => space.name.trim().toLowerCase() === normalized.toLowerCase()
    );
    if (exists) {
      setFolderError(
        ts.journalSpaceDuplicate || ts.journalFolderDuplicate || "This space already exists"
      );
      return;
    }

    setFolderSaving(true);
    setFolderError(null);
    try {
      const timestamp = Date.now();
      const created = await saveJournalSpace({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? `space-${crypto.randomUUID()}`
            : `space-${timestamp}`,
        name: normalized,
        description: normalizedDescription || undefined,
        iconKey: "folder",
        accent: "primary",
        private: false,
        kind: "user",
        coverKey: "folder",
        pinnedAction: "write",
        sortOrder: Math.max(40, ...journalSpaces.map((space) => space.sortOrder || 0)) + 10,
      });
      setJournalSpaces((current) =>
        [...current.filter((space) => space.id !== created.id), created].sort(
          (a, b) => a.sortOrder - b.sortOrder
        )
      );
      setSelectedTag(null);
      setSelectedSpaceId(null);
      setActiveSpaceModeId(null);
      setActiveStudioId(null);
      setActiveStudioMode("compose");
      setFolderName("");
      setFolderDescription("");
      setFolderCreatorOpen(false);
      setSpacesSheetOpen(false);
    } catch (error) {
      logger.error("[Journal] Failed to create folder", error);
      setFolderError(
        ts.journalSpaceCreateFailed || ts.journalFolderCreateFailed || "Could not create space"
      );
    } finally {
      setFolderSaving(false);
    }
  }, [folderDescription, folderItems, folderName, journalSpaces, ts]);

  // Writing stats for mini-bar
  const thisWeekCount = useMemo(() => {
    const weekStart = shiftJournalDate(currentDay, -6);
    let count = 0;
    groupedEntries.forEach((g) =>
      g.entries.forEach((e) => {
        if (e.date >= weekStart && e.date <= currentDay) count++;
      })
    );
    return count;
  }, [groupedEntries, currentDay]);

  // Use the same all-time source as spaces so actions work for entries outside the selected day.
  const entriesById = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    allEntriesForSpaces.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, [allEntriesForSpaces]);
  const routeEntry = useMemo(
    () => (routeEntryId ? (entriesById.get(routeEntryId) ?? null) : null),
    [entriesById, routeEntryId]
  );

  const routeableSpaces = useMemo(
    () => spaceOptions.filter((space) => space.id !== "space-all" && space.id.startsWith("space-")),
    [spaceOptions]
  );

  const selectedSpace = useMemo(
    () => spaceOptions.find((space) => space.id === selectedSpaceId) || null,
    [selectedSpaceId, spaceOptions]
  );

  const getEntrySpaceIds = useCallback(
    (entryId: string) =>
      new Set(
        spaceEntryLinks
          .filter((link) => link.entryId === entryId && link.targetType === "space")
          .map((link) => link.targetId)
      ),
    [spaceEntryLinks]
  );

  const getEntriesForSpace = useCallback(
    (space: JournalSpaceOption) => {
      if (space.id === "space-all") return allEntriesForSpaces;
      const linkedEntryIds = new Set(
        spaceEntryLinks
          .filter((link) => link.targetType === "space" && link.targetId === space.id)
          .map((link) => link.entryId)
      );
      return allEntriesForSpaces.filter((entry) => linkedEntryIds.has(entry.id));
    },
    [allEntriesForSpaces, spaceEntryLinks]
  );

  const handleToggleEntrySpace = useCallback(
    async (entryId: string, space: JournalSpaceOption) => {
      const savingKey = `${entryId}:${space.id}`;
      setRouteSavingKey(savingKey);
      try {
        const linked = getEntrySpaceIds(entryId).has(space.id);
        if (linked) {
          await unlinkEntryFromSpace(entryId, space.id);
        } else {
          await linkEntryToSpace(entryId, space.id);
        }
        setSpaceEntryLinks(await getSpaceEntryLinks());
      } catch (error) {
        logger.error("[Journal] Failed to route entry to space", error);
      } finally {
        setRouteSavingKey(null);
      }
    },
    [getEntrySpaceIds]
  );

  // Private search results mapped to local entries.
  const aiMatchedEntries = useMemo(() => {
    if (privateMode || !aiMode || aiResults.length === 0) return [];
    return aiResults
      .map((r) => {
        const entry = entriesById.get(r.entry_id);
        return entry ? { entry, similarity: r.similarity } : null;
      })
      .filter((r): r is { entry: JournalEntry; similarity: number } => r !== null);
  }, [aiMode, aiResults, entriesById, privateMode]);

  // Filter entries by deferred search + mood + tag (text mode only)
  // Uses deferredSearch so the list filters in the background without blocking input
  const filteredGroups = useMemo(() => {
    if (aiMode) return []; // AI mode uses aiMatchedEntries instead
    const q = deferredSearch.toLowerCase().trim();
    const dateFilter = getJournalListDateFilter(selectedDateOnly, selectedDate);
    return groupedEntries
      .map((group) => ({
        ...group,
        entries: group.entries.filter((e) => {
          if (dateFilter && e.date !== dateFilter) return false;
          if (q) {
            if (privateMode) return false;
            if (
              !(
                e.title.toLowerCase().includes(q) ||
                e.content.toLowerCase().includes(q) ||
                getVisibleJournalTags(e.tags).some((tag) => tag.toLowerCase().includes(q))
              )
            ) {
              return false;
            }
          }
          if (selectedTag && !getVisibleJournalTags(e.tags).includes(selectedTag)) return false;
          if (selectedSpaceId) {
            const linkedToSpace = spaceEntryLinks.some(
              (link) =>
                link.entryId === e.id &&
                link.targetType === "space" &&
                link.targetId === selectedSpaceId
            );
            if (!linkedToSpace) return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.entries.length > 0);
  }, [
    groupedEntries,
    deferredSearch,
    selectedDate,
    selectedDateOnly,
    selectedSpaceId,
    selectedTag,
    spaceEntryLinks,
    aiMode,
    privateMode,
  ]);

  const filteredEntries = useMemo(
    () => filteredGroups.flatMap((group) => group.entries),
    [filteredGroups]
  );
  const visibleFilteredEntries = privateMode ? filteredEntries.slice(0, 1) : filteredEntries;
  const visibleEntryCount = privateMode
    ? 0
    : selectedDateOnly
      ? filteredEntries.length
      : totalCount;
  const privateMetricLabel = ts.privateMode || "Private";
  const releaseTraceDate = activeDraftDate;
  const releaseTrace = releaseTraceSummaries?.get(releaseTraceDate);

  const hasActiveFilters = deferredSearch || selectedTag || selectedSpaceId;
  const activeFilterSpaceName = selectedSpace?.name ?? selectedTag;
  const showSpaceSwitcher = showSpaces;
  const showAiToggle = JOURNAL_AI_AVAILABLE && !privateMode;

  const renderQuietReleaseTrace = () => {
    if (privateMode || !releaseTrace || releaseTrace.count <= 0) return null;

    const time = formatReleaseTraceTime(releaseTrace.latestAt, language);
    const title = formatReleaseTraceTitle(releaseTrace, language, ts);
    const trailing =
      releaseTrace.count === 1
        ? time
        : (ts.journalReleaseTraceLatest || "latest {time}").replace("{time}", time);

    return (
      <motion.div
        data-testid="journal-quiet-release-trace"
        initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[hsl(var(--cosmic-nebula-purple)/0.18)] bg-card/45 px-3 py-2.5 shadow-[0_14px_38px_hsl(var(--background)/0.16)] backdrop-blur-xl"
        aria-label={`${title}, ${trailing}`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-2 start-2 w-px rounded-full bg-gradient-to-b from-[hsl(var(--cosmic-nebula-cyan)/0.68)] to-[hsl(var(--cosmic-nebula-purple)/0.58)]"
        />
        <div className="flex min-h-[44px] items-center gap-3 ps-2">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[hsl(var(--cosmic-nebula-purple)/0.24)] bg-[hsl(var(--cosmic-nebula-cyan)/0.08)] text-[hsl(var(--cosmic-nebula-cyan))] shadow-[0_0_24px_hsl(var(--cosmic-nebula-purple)/0.12)]">
            <span
              className="absolute h-5 w-5 rounded-full bg-[hsl(var(--cosmic-nebula-purple)/0.12)] blur-sm"
              aria-hidden="true"
            />
            <QuietReleaseIcon className="relative h-4 w-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 text-sm font-semibold leading-snug text-foreground/90">
            <span>{title}</span>
            <span className="text-muted-foreground/45" aria-hidden="true">
              {" "}
              ·{" "}
            </span>
            <span className="text-xs font-medium text-muted-foreground/70">{trailing}</span>
          </p>
        </div>
      </motion.div>
    );
  };

  const getEntrySpaceActionLabel = useCallback(
    (entry: JournalEntry) => {
      const entrySpaceIds = getEntrySpaceIds(entry.id);
      const assignedSpaces = routeableSpaces.filter((space) => entrySpaceIds.has(space.id));
      return assignedSpaces.length > 0
        ? assignedSpaces.map((space) => space.name).join(", ")
        : ts.journalSpaceAddToSpace || "Add to space";
    },
    [getEntrySpaceIds, routeableSpaces, ts]
  );

  const getEntryContextItems = useCallback(
    (entry: JournalEntry, currentSpace?: JournalSpaceOption) => {
      const items: {
        label: string;
        action: () => void;
        icon?: ReactNode;
        destructive?: boolean;
      }[] = [];

      if (!privateMode) {
        items.push({
          label: ts.open || "Open",
          icon: <JournalEntryIcon className="h-4 w-4" aria-hidden="true" />,
          action: () => handleTap(entry.id),
        });
      }

      if (!privateMode && currentSpace && currentSpace.id !== "space-all") {
        items.push({
          label: ts.journalSpaceRemoveEntry || "Remove",
          icon: <OpenFolderIcon className="h-4 w-4" aria-hidden="true" />,
          action: () => void handleToggleEntrySpace(entry.id, currentSpace),
        });
      }

      if (!privateMode && routeableSpaces.length > 0) {
        items.push({
          label: ts.journalSpaceAddToSpace || "Add to space",
          icon: <CreateFolderIcon className="h-4 w-4" aria-hidden="true" />,
          action: () => setRouteEntryId(entry.id),
        });
      }

      if (!privateMode) {
        items.push({
          label: ts.delete || "Delete",
          icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
          action: () => handleDelete(entry.id),
          destructive: true,
        });
      }

      return items;
    },
    [handleDelete, handleTap, handleToggleEntrySpace, privateMode, routeableSpaces.length, ts]
  );

  const renderEntryActionsSheet = () => {
    if (!routeEntry || typeof document === "undefined") return null;

    const entry = routeEntry;
    const entrySpaceIds = getEntrySpaceIds(entry.id);
    const privateEntryLabel = ts.journalPrivateEntry || ts.privateMode || "Private entry";
    const assignedLabel = privateMode ? privateEntryLabel : getEntrySpaceActionLabel(entry);
    const title = privateMode
      ? privateEntryLabel
      : entry.title?.trim() || ts.journalEntry || "Entry";

    return createPortal(
      <AnimatePresence>
        {routeEntryId && (
          <>
            <motion.button
              type="button"
              aria-label={ts.close || "Close"}
              className="fixed inset-0 z-[9998] cursor-default bg-background/78 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0.12 : 0.18 }}
              onClick={() => setRouteEntryId(null)}
            />
            <motion.div
              ref={entryActionsA11y.modalRef}
              onKeyDown={entryActionsA11y.handleKeyDown}
              role="dialog"
              aria-modal="true"
              aria-label={ts.more || "More"}
              data-testid="journal-entry-actions-sheet"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: reducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed start-[max(0.75rem,var(--safe-inline-start))] end-[max(0.75rem,var(--safe-inline-end))] bottom-[calc(var(--safe-bottom)+0.75rem)] z-[9999] mx-auto max-h-[calc(var(--app-viewport-height)-var(--safe-top)-var(--safe-bottom)-1.5rem)] max-w-[390px] overflow-y-auto overscroll-contain rounded-[1.6rem] border border-border/25 bg-card/95 p-3 shadow-[0_26px_90px_hsl(var(--background)/0.48)] backdrop-blur-2xl"
            >
              <div className="flex items-start gap-3 rounded-2xl border border-border/18 bg-background/38 p-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <JournalEntryIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-normal break-words text-sm font-bold text-foreground">
                    {title}
                  </p>
                  <p className="mt-0.5 whitespace-normal break-words text-xs text-muted-foreground/70">
                    {assignedLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRouteEntryId(null)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground motion-safe:transition-[background-color,color] hover:bg-muted/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  aria-label={ts.close || "Close"}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                {!privateMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRouteEntryId(null);
                      handleTap(entry.id);
                    }}
                    className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-border/18 bg-background/42 px-3 text-start text-sm font-semibold text-foreground motion-safe:transition-[background-color,transform] hover:bg-muted/45 active:scale-[0.99]"
                  >
                    <JournalEntryIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>{ts.open || "Open"}</span>
                  </button>
                ) : null}

                {!privateMode && routeableSpaces.length > 0 ? (
                  <div className="rounded-2xl border border-border/18 bg-background/32 p-2">
                    <p className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                      {ts.journalFolders || ts.journalHubSpaces || "Folders"}
                    </p>
                    <div className="grid gap-1.5" data-testid="journal-entry-actions-space-list">
                      {routeableSpaces.map((space) => {
                        const linked = entrySpaceIds.has(space.id);
                        const Icon = getSpaceIcon(space.iconKey);
                        const saving = routeSavingKey === `${entry.id}:${space.id}`;
                        return (
                          <button
                            key={`${entry.id}-${space.id}`}
                            type="button"
                            onClick={() => void handleToggleEntrySpace(entry.id, space)}
                            disabled={saving}
                            aria-pressed={linked}
                            className={cn(
                              "flex min-h-[48px] items-center justify-between gap-3 rounded-xl border px-3 text-start text-sm font-semibold motion-safe:transition-[background-color,border-color,transform] active:scale-[0.99]",
                              linked
                                ? "border-primary/35 bg-primary/15 text-primary"
                                : "border-border/16 bg-card/42 text-muted-foreground hover:bg-muted/45 hover:text-foreground"
                            )}
                          >
                            <span className="inline-flex min-w-0 flex-1 items-center gap-2">
                              {saving ? (
                                <Loader2
                                  className="h-4 w-4 flex-shrink-0 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : linked ? (
                                <CheckCircle2
                                  className="h-4 w-4 flex-shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                              )}
                              <span className="min-w-0 whitespace-normal break-words">
                                {space.name}
                              </span>
                            </span>
                            <span className="flex-shrink-0 text-xs font-medium text-muted-foreground/55">
                              {linked ? ts.done || "done" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {!privateMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRouteEntryId(null);
                      handleDelete(entry.id);
                    }}
                    className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 text-start text-sm font-semibold text-destructive motion-safe:transition-[background-color,transform] hover:bg-destructive/15 active:scale-[0.99]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>{ts.delete || "Delete"}</span>
                  </button>
                ) : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    );
  };

  const renderSpaceWorkspace = (space: JournalSpaceOption) => {
    const Icon = getSpaceDisplayIcon(space);
    const experience = getSpaceExperience(space);
    const spaceEntries = getEntriesForSpace(space);
    const q = deferredSearch.toLowerCase().trim();
    const visibleSpaceEntries = q
      ? privateMode
        ? []
        : spaceEntries.filter(
            (entry) =>
              entry.title.toLowerCase().includes(q) ||
              entry.content.toLowerCase().includes(q) ||
              getVisibleJournalTags(entry.tags).some((tag) => tag.toLowerCase().includes(q))
          )
      : privateMode
        ? spaceEntries.slice(0, 1)
        : spaceEntries;
    const captures = activeSpaceModeCaptures;
    const visibleCaptures = q
      ? privateMode
        ? []
        : captures.filter((capture) => {
            const title = getCaptureDisplayTitle(capture, ts).toLowerCase();
            return (
              title.includes(q) ||
              capture.date.toLowerCase().includes(q) ||
              capture.fields.some((field) => {
                const prompt = getCaptureFieldPrompt(capture, field, ts).toLowerCase();
                return prompt.includes(q) || field.value.toLowerCase().includes(q);
              })
            );
          })
      : privateMode
        ? captures.slice(0, 1)
        : captures;
    const spaceItemCount = spaceEntries.length + captures.length;
    const showExactSpaceCount = !privateMode && spaceItemCount > 0;
    const hasVisibleSpaceContent = visibleSpaceEntries.length > 0 || visibleCaptures.length > 0;
    const visualRole = getSpaceDisplayVisualRole(space);
    const tone = getRoleTone(visualRole);
    const spaceDisplayName = getSpaceDisplayName(space);
    const spaceDisplayDescription = getSpaceDisplayDescription(space);

    const handleExit = () => {
      setActiveSpaceModeId(null);
      setActiveStudioMode("compose");
      setSearchInput("");
    };

    const handleAddEntry = () => {
      if (onNewEntryWithPrefill) {
        onNewEntryWithPrefill({
          title: experience.prefillTitle,
          content: experience.prefillContent,
          tags: privateMode || space.id === "space-all" ? [] : [space.name],
          date: activeDraftDate,
          spaceId:
            !privateMode && space.id.startsWith("space-") && space.id !== "space-all"
              ? space.id
              : undefined,
        });
        return;
      }
      onNewEntry();
    };

    return (
      <motion.section
        key={space.id}
        data-testid="journal-space-mode"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: reducedMotion ? 0.16 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-3"
        data-visual-role={visualRole}
      >
        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            data-testid="journal-space-mode-exit"
            onClick={handleExit}
            className={
              "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-border/25 bg-card/50 text-muted-foreground backdrop-blur-xl motion-safe:transition-[background-color,border-color] hover:bg-card/60 " +
              tone.focusRingClass
            }
            aria-label={ts.back || ts.close || "Back"}
          >
            <ChevronRight className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden="true" />
          </button>
          <span
            className={
              "relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border bg-card/50 shadow-[0_18px_42px_hsl(var(--foreground)/0.08)] backdrop-blur-xl " +
              tone.borderClass +
              " " +
              tone.textClass
            }
            style={getSpaceDisplayCoverStyle(space)}
          >
            <span
              aria-hidden="true"
              className={"absolute inset-1 rounded-full border opacity-70 " + tone.borderClass}
            />
            <Icon
              className="relative h-6 w-6 drop-shadow-[0_0_12px_currentColor]"
              aria-hidden="true"
            />
            {showExactSpaceCount ? (
              <span
                data-testid="journal-space-mode-count"
                className="absolute bottom-0 end-0 flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full border border-background/50 bg-background/80 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-foreground shadow-[0_8px_18px_hsl(var(--background)/0.32)] backdrop-blur-md"
              >
                {spaceItemCount}
              </span>
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={
                "whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.18em] " +
                tone.textClass
              }
            >
              {experience.mode}
            </p>
            <h2
              data-testid="journal-space-mode-title"
              className="whitespace-normal break-words text-2xl font-bold leading-tight text-foreground"
            >
              {spaceDisplayName}
            </h2>
            <p className="mt-0.5 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground/72">
              {spaceDisplayDescription}
            </p>
          </div>
        </div>

        {renderDailyReflectionPrompt()}

        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground/50">
            {privateMode
              ? privateMetricLabel
              : formatLocalizedCount(
                  spaceItemCount,
                  language,
                  ts,
                  "journalEntryCount",
                  ts.journalEntries || "entries"
                )}
          </span>
          <div className="h-3 w-px bg-border/20" />
          <span className="text-xs text-muted-foreground/50">
            {ts.journalSpaceLatestActivity || "Latest activity"}
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={ts.journalSearch || "Search entries..."}
            aria-label={ts.journalSearch || "Search entries"}
            className="w-full rounded-xl border border-border/30 bg-muted/50 py-2.5 pe-9 ps-9 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute end-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
              aria-label={ts.clear || "Clear search"}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {visibleCaptures.length > 0 ? (
          <motion.div
            variants={activeContainerVariants}
            initial="hidden"
            animate="show"
            className={cn(
              "space-y-2",
              compact
                ? "space-y-1.5"
                : "md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0"
            )}
          >
            <AnimatePresence mode="popLayout">
              {visibleCaptures.map((capture, index) => (
                <motion.article
                  key={`${space.id}-${capture.id}`}
                  data-testid={`journal-space-capture-card-${capture.id}`}
                  variants={activeItemVariants}
                  custom={index}
                  layout
                  exit={{ x: -300, opacity: 0 }}
                  transition={{
                    ...springs.quick,
                    layout: { type: "spring", stiffness: 300, damping: 30 },
                  }}
                  className={
                    "relative overflow-hidden rounded-[1.35rem] border bg-card/60 p-3 shadow-[0_18px_48px_hsl(var(--foreground)/0.06)] backdrop-blur-xl " +
                    tone.borderClass
                  }
                >
                  <div
                    aria-hidden="true"
                    className={
                      "absolute -end-12 -top-16 h-32 w-32 rounded-full blur-2xl " + tone.softBgClass
                    }
                  />
                  <div className="relative flex items-start gap-3">
                    <span
                      className={
                        "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border " +
                        tone.iconClass
                      }
                      style={getSpaceDisplayCoverStyle(space)}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={
                              "whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.16em] " +
                              tone.textClass
                            }
                          >
                            {privateMode
                              ? ts.privateMode || "Private"
                              : capture.mode || experience.mode}
                          </p>
                          <h3 className="mt-1 whitespace-normal break-words text-sm font-bold text-foreground">
                            {privateMode
                              ? ts.journalPrivateEntry || ts.privateMode || "Private entry"
                              : getCaptureDisplayTitle(capture, ts)}
                          </h3>
                        </div>
                        <span className="flex-shrink-0 rounded-full border border-border/20 bg-background/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                          {privateMode ? ts.privateMode || "Private" : capture.date}
                        </span>
                      </div>
                      {privateMode ? (
                        <div className="mt-3 rounded-2xl border border-border/20 bg-background/40 p-3">
                          <p className="text-sm font-semibold text-muted-foreground">
                            {ts.journalPrivateEntry || ts.privateMode || "Private entry"}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 grid gap-2">
                            {capture.fields
                              .filter((field) => field.value.trim().length > 0)
                              .map((field, fieldIndex) => (
                                <div
                                  key={`${capture.id}-${field.prompt}-${fieldIndex}`}
                                  className="rounded-2xl border border-border/20 bg-background/40 p-3"
                                >
                                  <p className="whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                                    {getCaptureFieldPrompt(capture, field, ts)}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                                    {field.value}
                                  </p>
                                </div>
                              ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenCaptureInEditor(space, capture)}
                            className={
                              "mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border px-3 text-xs font-bold motion-safe:transition-colors " +
                              tone.iconClass +
                              " " +
                              tone.focusRingClass
                            }
                          >
                            <PenLine className="h-4 w-4" aria-hidden="true" />
                            {ts.journalCaptureOpenEditor || "Open as entry"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : null}

        {visibleSpaceEntries.length > 0 ? (
          <motion.div
            variants={activeContainerVariants}
            initial="hidden"
            animate="show"
            className={cn(
              "space-y-2",
              compact
                ? "space-y-1.5"
                : "md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0"
            )}
          >
            <AnimatePresence mode="popLayout">
              {visibleSpaceEntries.map((entry, index) => (
                <motion.div
                  key={`${space.id}-${entry.id}`}
                  variants={activeItemVariants}
                  custom={index}
                  layout
                  exit={{ x: -300, opacity: 0 }}
                  transition={{
                    ...springs.quick,
                    layout: { type: "spring", stiffness: 300, damping: 30 },
                  }}
                >
                  <ContextMenu
                    enabled={isMouse && !privateMode}
                    trigger={
                      <JournalEntryCard
                        entry={entry}
                        onTap={handleTap}
                        onDelete={handleDelete}
                        onActions={handleEntryActions}
                        onLongPress={handleEntryActions}
                        onSwipeDelete={handleSwipeDelete}
                        privateMode={privateMode}
                        searchQuery={debouncedSearch}
                        isActive={activeEntryId === entry.id}
                        dimmed={!!activeEntryId && activeEntryId !== entry.id}
                      />
                    }
                    items={[...getEntryContextItems(entry, space)]}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : null}

        {!hasVisibleSpaceContent ? (
          <div className="flex flex-col items-center rounded-[1.6rem] border border-border/25 bg-card/45 px-4 py-10 text-center shadow-[0_18px_48px_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
            <span
              className={
                "relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border " +
                tone.iconClass
              }
              style={getSpaceDisplayCoverStyle(space)}
            >
              <Icon className="relative h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-base font-bold text-foreground">
              {q
                ? ts.journalNoMatchingEntries || "No entries match your search"
                : ts.journalSpaceEmpty || "This space is empty"}
            </p>
            <p className="mt-1 max-w-[250px] text-sm leading-relaxed text-muted-foreground/72">
              {q
                ? ts.journalNoMatchingHint || "Try a different keyword or clear your filters"
                : ts.journalFolderEmptyHint ||
                  "Create a first note here and it will stay connected to this folder."}
            </p>
            <button
              type="button"
              data-testid="journal-space-add-entry"
              onClick={handleAddEntry}
              className={
                "mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-[hsl(var(--zf-night-0))] shadow-[0_14px_34px_hsl(var(--background)/0.22)] " +
                tone.railClass +
                " " +
                tone.focusRingClass
              }
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {ts.journalSpaceAddEntry || "Add entry"}
            </button>
          </div>
        ) : null}

        {showFab ? (
          <button
            type="button"
            data-testid="journal-space-floating-add"
            onClick={handleAddEntry}
            className={
              "fixed bottom-[calc(5.5rem+var(--safe-bottom))] end-[max(1.25rem,var(--safe-inline-end))] z-40 inline-flex h-14 w-14 items-center justify-center rounded-full text-[hsl(var(--zf-night-0))] shadow-[0_18px_42px_hsl(var(--background)/0.28)] motion-safe:transition-transform active:scale-[0.96] " +
              tone.railClass +
              " " +
              tone.focusRingClass
            }
            aria-label={ts.journalSpaceAddEntry || "Add entry"}
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : null}
      </motion.section>
    );
  };

  const renderDailyReflectionPrompt = () => {
    const reflection =
      selectedDateOnly && selectedDate && selectedDate !== currentDay
        ? {
            translationId: "journalReflectionPromptPast",
            fallback: "Write one true sentence you remember about this day.",
          }
        : getDailyReflection();
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-primary/10 bg-card/55 p-3.5 shadow-[0_18px_45px_hsl(var(--foreground)/0.06)] backdrop-blur-xl"
        style={DAILY_REFLECTION_CARD_STYLE}
      >
        <Quote className="absolute top-2 end-2 w-7 h-7 text-primary/10" />
        <div
          aria-hidden="true"
          className="absolute inset-y-3 start-0 w-px"
          style={DAILY_REFLECTION_RULE_STYLE}
        />
        <p className="text-sm font-serif italic leading-relaxed pe-7 text-foreground/85">
          {ts[reflection.translationId] || reflection.fallback}
        </p>
      </div>
    );
  };

  const renderSpaceShortcut = () => {
    const createTone = getRoleTone("space");
    const createShortcutBackground = isPaperTheme
      ? [
          "radial-gradient(circle at 42% 24%, hsl(var(--zf-role-space) / 0.30), transparent 35%)",
          "radial-gradient(circle at 78% 20%, hsl(var(--zf-role-energy) / 0.20), transparent 32%)",
          "linear-gradient(145deg, hsl(var(--card) / 0.82), hsl(var(--surface-overlay) / 0.74))",
        ].join(", ")
      : [
          "linear-gradient(135deg, hsl(var(--zf-role-space) / 0.16), transparent 50%)",
          `linear-gradient(180deg, hsl(var(--card) / 0.55), hsl(var(--card) / 0.18)), url(${auroraMountainsUrl})`,
        ].join(", ");
    return (
      <div className="flex min-w-0 items-start gap-3 px-1 py-1" data-testid="journal-space-rail">
        <button
          ref={spacesOpenerRef}
          type="button"
          data-testid="journal-space-switcher"
          onClick={() => {
            setSpacesSheetOpen(true);
            setFolderCreatorOpen(true);
            setFolderName("");
            setFolderDescription("");
            setFolderError(null);
          }}
          className={
            "group relative flex w-[calc(4.375rem*var(--font-scale))] max-w-[8rem] flex-none flex-col items-center gap-1.5 text-center motion-safe:transition-transform active:scale-[0.98] " +
            createTone.textClass
          }
          aria-label={ts.journalCreateFolder || ts.journalFolders || "Folders"}
          aria-expanded={spacesSheetOpen}
          data-visual-role="space"
        >
          <span
            className={
              "relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-card/50 shadow-[0_18px_42px_hsl(var(--foreground)/0.08)] backdrop-blur-xl motion-safe:transition-[background-color,border-color,box-shadow,transform] group-hover:scale-[1.02] " +
              createTone.borderClass
            }
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 opacity-85"
              style={getCreateShortcutStyle(createShortcutBackground)}
            />
            <span
              aria-hidden="true"
              className={
                "absolute inset-2 rounded-full border opacity-80 motion-safe:transition-transform group-hover:scale-105 " +
                createTone.borderClass
              }
            />
            <CreateFolderIcon
              className="relative h-7 w-7 drop-shadow-[0_0_12px_currentColor]"
              aria-hidden="true"
            />
          </span>
          <span className="block w-full whitespace-normal break-words px-0.5 text-xs font-semibold leading-tight text-muted-foreground/80">
            {ts.journalFolderCreate || ts.journalSpaceCreate || "Create"}
          </span>
        </button>

        <div
          className="min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto pb-1"
          data-testid="journal-space-rail-list"
        >
          <div className="flex min-h-[88px] items-start gap-3 pe-2">
            {visibleSpaceOptions.map((space) => {
              const Icon = getSpaceDisplayIcon(space);
              const visualRole = getSpaceDisplayVisualRole(space);
              const tone = getRoleTone(visualRole);
              const spaceDisplayName = getSpaceDisplayName(space);
              return (
                <button
                  key={space.id}
                  type="button"
                  data-testid={`journal-space-rail-item-${space.id}`}
                  onClick={() => handleOpenStudio(space)}
                  aria-label={
                    privateMode
                      ? spaceDisplayName
                      : `${spaceDisplayName}${space.count > 0 ? `, ${space.count}` : ""}`
                  }
                  className="group relative flex w-[calc(5.5rem*var(--font-scale))] max-w-[9rem] flex-none snap-start flex-col items-center gap-1.5 text-center motion-safe:transition-transform active:scale-[0.98]"
                  data-visual-role={visualRole}
                >
                  <span
                    className={
                      "relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border bg-card/50 shadow-[0_18px_42px_hsl(var(--foreground)/0.08)] backdrop-blur-xl motion-safe:transition-[border-color,box-shadow,transform] group-hover:scale-[1.02] " +
                      tone.borderClass +
                      " " +
                      tone.textClass
                    }
                    style={getSpaceDisplayCoverStyle(space)}
                  >
                    <span
                      aria-hidden="true"
                      className={
                        "absolute inset-1 rounded-full border opacity-70 " + tone.borderClass
                      }
                    />
                    <span
                      aria-hidden="true"
                      className={
                        "absolute h-10 w-10 rounded-full opacity-0 blur-md motion-safe:transition-opacity group-hover:opacity-100 " +
                        tone.softBgClass
                      }
                    />
                    <Icon
                      className="relative h-6 w-6 drop-shadow-[0_0_12px_currentColor]"
                      aria-hidden="true"
                    />
                    {!privateMode && space.count > 0 ? (
                      <span
                        data-testid={`journal-space-rail-count-${space.id}`}
                        className="absolute bottom-0 end-0 flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full border border-background/50 bg-background/80 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-foreground shadow-[0_8px_18px_hsl(var(--background)/0.32)] backdrop-blur-md"
                      >
                        {space.count}
                      </span>
                    ) : null}
                  </span>
                  <span className="block w-full whitespace-normal break-words px-0.5 text-xs font-semibold leading-tight text-foreground/90">
                    {spaceDisplayName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Loading skeleton — shimmer gradient + staggered spring entrance
  if (loading) {
    return (
      <div className="space-y-3 pb-24">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...springs.quick, delay: stagger.delayForIndex(i) }}
            className="rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm border border-border/20"
          >
            <div className="flex">
              <div className="w-1 bg-gradient-to-b from-primary/20 to-primary/5 rounded-s" />
              <div className="flex-1 p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-muted-foreground/8 skeleton-shimmer" />
                  <div className="h-3.5 bg-muted-foreground/8 rounded-full w-24 skeleton-shimmer" />
                </div>
                <div className="h-2.5 bg-muted-foreground/6 rounded-full w-full skeleton-shimmer" />
                <div className="h-2.5 bg-muted-foreground/6 rounded-full w-2/3 skeleton-shimmer" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-2 bg-muted-foreground/5 rounded-full w-12 skeleton-shimmer" />
                  <div className="h-2 bg-muted-foreground/5 rounded-full w-16 skeleton-shimmer" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .skeleton-shimmer {
            background: linear-gradient(90deg, transparent 25%, hsl(var(--muted-foreground) / 0.06) 50%, transparent 75%);
            background-size: 200% 100%;
            animation: shimmer 1.8s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  // Empty state
  if (compact && totalCount === 0 && !showSpaces && !spacesSheetOpen && !activeSpaceMode) {
    return (
      <div className="space-y-3 pb-4" data-testid="journal-compact-empty-list">
        {renderQuietReleaseTrace()}
        <div className="journal-diary-glass-panel rounded-2xl border border-border/30 p-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <PenLine className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {ts.journalEmpty || "Your diary is empty"}
          </h3>
          <p className="mx-auto mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
            {ts.journalEmptyHint ||
              "Start writing to capture your thoughts, feelings, and memories."}
          </p>
          <p
            className="mx-auto mt-3 max-w-[240px] text-xs italic leading-relaxed text-muted-foreground"
            dir="auto"
          >
            {currentJournalQuote}
          </p>
          <button
            type="button"
            onClick={onNewEntry}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_14px_34px_hsl(var(--primary)/0.20)] motion-safe:transition-transform active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {ts.journalWriteFirstEntry || ts.journalNewEntry || "Write first entry"}
          </button>
        </div>
      </div>
    );
  }

  if (totalCount === 0 && !spacesSheetOpen && !activeSpaceMode) {
    return (
      <div className="relative isolate space-y-3 pb-24" data-testid="journal-empty-list">
        {!useSharedDiaryWallpaper && <JournalMemoryBackdrop />}
        {renderDailyReflectionPrompt()}
        {renderQuietReleaseTrace()}
        {renderSpaceShortcut()}
        <JournalCaptureLauncher
          variant="inline"
          onNewEntry={onNewEntry}
          onAddGratitude={handleAddGratitudeToSpaces}
          onFocusEntry={onNewEntry}
          onReleaseThought={onReleaseThought}
        />
        <div className="journal-diary-glass-panel relative flex flex-col items-center justify-center rounded-[1.6rem] border border-border/30 px-6 py-14">
          {/* Ambient floating particles */}
          {[
            { x: "15%", y: "10%", size: 7, idx: 0 },
            { x: "80%", y: "20%", size: 9, idx: 1 },
            { x: "70%", y: "70%", size: 6, idx: 2 },
            { x: "25%", y: "80%", size: 8, idx: 3 },
          ].map((p) => (
            <div
              key={p.idx}
              className={cn(
                "absolute rounded-full bg-primary/12 blur-[1px] motion-reduce:hidden",
                !reducedMotion && `animate-particle-float-${(p.idx % 5) + 1}`
              )}
              style={getEmptyParticleStyle(p)}
            />
          ))}

          <div className="relative w-24 h-24 mb-5">
            <motion.div
              animate={reducedMotion ? undefined : { y: [0, -8, 0] }}
              transition={
                reducedMotion ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }
              className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-primary/16 bg-primary/10 shadow-[inset_0_1px_0_hsl(var(--card)/0.62),0_22px_58px_-48px_hsl(var(--foreground)/0.52)]"
            >
              <PenLine className="h-9 w-9 text-primary" aria-hidden="true" />
            </motion.div>
            {/* Sparkle dots */}
            {[
              { x: -10, y: -6, delay: 0 },
              { x: 22, y: -10, delay: 0.7 },
              { x: 24, y: 20, delay: 1.4 },
              { x: -8, y: 22, delay: 2.1 },
            ].map((sparkle, i) => (
              <motion.div
                key={i}
                animate={reducedMotion ? undefined : { opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={
                  reducedMotion
                    ? undefined
                    : {
                        duration: 2,
                        repeat: Infinity,
                        delay: sparkle.delay,
                        ease: "easeInOut",
                      }
                }
                className="absolute h-1.5 w-1.5 rounded-full bg-primary/34 motion-reduce:hidden"
                style={getEmptySparkleStyle(sparkle)}
              />
            ))}
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {ts.journalEmpty || "Your diary is empty"}
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-2 max-w-[260px]">
            {ts.journalEmptyHint ||
              "Start writing to capture your thoughts, feelings, and memories."}
          </p>
          <p
            className="mb-6 text-center text-xs italic leading-relaxed text-muted-foreground"
            dir="auto"
          >
            {currentJournalQuote}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate space-y-3 pb-24">
      {!useSharedDiaryWallpaper && <JournalMemoryBackdrop />}

      {/* Daily first-party reflection prompt */}
      {!activeSpaceMode && renderDailyReflectionPrompt()}

      {/* Writing stats mini-bar */}
      {!activeSpaceMode && visibleEntryCount > 0 && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground/50">
            {formatLocalizedCount(
              visibleEntryCount,
              language,
              ts,
              "journalEntryCount",
              ts.journalEntries || "entries"
            )}
          </span>
          {!selectedDateOnly && (
            <>
              <div className="w-px h-3 bg-border/20" />
              <span className="text-xs text-muted-foreground/50">
                {formatLocalizedCount(
                  thisWeekCount,
                  language,
                  ts,
                  "journalThisWeekCount",
                  ts.journalThisWeek || "this week"
                )}
              </span>
            </>
          )}
        </div>
      )}

      {/* Search bar with AI toggle */}
      {!activeSpaceMode && (
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={
              aiMode
                ? ts.journalAiSearchPlaceholder || "Describe what you're looking for..."
                : ts.journalSearch || "Search entries..."
            }
            aria-label={ts.journalSearch || "Search entries"}
            className={cn(
              "w-full ps-9 py-2.5 rounded-xl text-sm",
              "bg-muted/50 border border-border/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              "placeholder:text-muted-foreground/50",
              showAiToggle && (searchInput || aiSearching)
                ? "pe-24"
                : showAiToggle || searchInput || aiSearching
                  ? "pe-14"
                  : "pe-9",
              aiMode && "border-purple-500/30 ring-1 ring-purple-500/20"
            )}
          />
          <div className="absolute end-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {(searchInput || aiSearching) && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setAiResults([]);
                }}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={ts.clear || "Clear search"}
              >
                {aiSearching ? (
                  <Loader2
                    className="w-3.5 h-3.5 text-purple-500 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <X className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            )}
            {showAiToggle && (
              <button
                ref={aiToggleButtonRef}
                onClick={toggleAiMode}
                disabled={aiConsentBusy}
                aria-busy={aiConsentBusy}
                className={cn(
                  "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  aiMode
                    ? "bg-purple-500/15 text-purple-500"
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
                aria-label={
                  aiMode
                    ? ts.journalAiSwitchToTextSearch || "Switch to text search"
                    : ts.journalAiSwitchToAiSearch || "Switch to private search"
                }
                title={
                  aiMode
                    ? ts.journalAiSearchOn || "Private search on"
                    : ts.journalAiSwitchToAiSearch || "Private search"
                }
              >
                {aiConsentBusy ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <AiSearchIcon className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {!activeSpaceMode && aiConsentError ? (
        <p role="alert" className="mt-2 text-xs leading-5 text-destructive">
          {ts.journalAiConsentUnavailable ||
            "Private search could not be enabled. Your diary stays unchanged; try again when you are online."}
        </p>
      ) : null}

      {!activeSpaceMode && !hasActiveFilters && renderQuietReleaseTrace()}

      {/* Spaces highlight entry */}
      {!activeSpaceMode && renderSpaceShortcut()}

      {/* Spaces sheet */}
      {showSpaceSwitcher && !activeSpaceMode && typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {spacesSheetOpen && (
                <>
                  <motion.button
                    type="button"
                    aria-label={ts.close || "Close"}
                    className="fixed inset-0 z-[9998] cursor-default bg-[hsl(var(--background))]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => {
                      setSpacesSheetOpen(false);
                      setActiveStudioId(null);
                      setFolderCreatorOpen(false);
                      setFolderName("");
                      setFolderDescription("");
                      setFolderError(null);
                    }}
                  />
                  <motion.div
                    ref={spacesSheetA11y.modalRef}
                    onKeyDown={spacesSheetA11y.handleKeyDown}
                    role="dialog"
                    aria-modal="true"
                    tabIndex={-1}
                    aria-label={ts.journalFolders || ts.journalHubSpaces || "Folders"}
                    initial={reducedMotion ? { opacity: 0 } : { y: 28, scale: 0.98 }}
                    animate={reducedMotion ? { opacity: 1 } : { y: 0, scale: 1 }}
                    exit={reducedMotion ? { opacity: 0 } : { y: 20, scale: 0.98 }}
                    transition={{ duration: reducedMotion ? 0.16 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                    onMouseDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      setSpacesSheetOpen(false);
                      setActiveStudioId(null);
                      setFolderCreatorOpen(false);
                      setFolderName("");
                      setFolderDescription("");
                      setFolderError(null);
                    }}
                    className="fixed inset-x-0 top-0 z-[9999] flex h-[var(--app-viewport-height)] items-center justify-center overflow-y-auto bg-[hsl(var(--background))] ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pt-[calc(var(--safe-top)+1rem)] pb-[calc(var(--safe-bottom)+1rem)]"
                    data-testid="journal-spaces-sheet"
                  >
                    <div
                      aria-hidden="true"
                      className="hidden"
                      style={getSpacesSheetBackdropStyle(isPaperTheme)}
                    />
                    <div className="relative flex max-h-[calc(var(--app-viewport-height)-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-[390px] flex-col">
                      <div className="hidden">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/75">
                            ZenFlow
                          </p>
                          <h2 className="whitespace-normal break-words text-lg font-bold text-foreground">
                            {ts.journalFolders || ts.journalHubSpaces || "Folders"}
                          </h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            data-testid="journal-space-create-toggle"
                            onClick={() => {
                              setFolderCreatorOpen((current) => !current);
                              setFolderError(null);
                            }}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary motion-safe:transition-[background-color,transform] hover:bg-primary/20 active:scale-[0.98]"
                            aria-expanded={folderCreatorOpen}
                            aria-label={
                              ts.journalCreateFolder || ts.journalCreateSpace || "Create folder"
                            }
                          >
                            <Plus className="h-5 w-5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSpacesSheetOpen(false);
                              setActiveStudioId(null);
                              setFolderCreatorOpen(false);
                              setFolderError(null);
                            }}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border/25 bg-background/45 text-muted-foreground motion-safe:transition-[background-color,transform] hover:bg-muted/55 active:scale-[0.98]"
                            aria-label={ts.close || "Close"}
                          >
                            <X className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="min-h-0 overflow-visible bg-transparent p-0">
                        <AnimatePresence initial={false}>
                          {folderCreatorOpen && (
                            <motion.div
                              initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={
                                reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }
                              }
                              transition={{ duration: 0.2 }}
                              className="relative overflow-hidden rounded-[1.4rem] border border-primary/20 bg-[hsl(var(--card))] p-3 shadow-[0_28px_90px_hsl(var(--background)/0.42)]"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSpacesSheetOpen(false);
                                  setFolderCreatorOpen(false);
                                  setFolderName("");
                                  setFolderDescription("");
                                  setFolderError(null);
                                }}
                                className="absolute end-3 top-3 z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border/25 bg-background/55 text-muted-foreground motion-safe:transition-[background-color,transform] hover:bg-muted/55 active:scale-[0.98]"
                                aria-label={ts.close || "Close"}
                              >
                                <X className="h-5 w-5" aria-hidden="true" />
                              </button>
                              <div className="flex items-start gap-3 rounded-xl border border-border/20 bg-card/45 p-3 pe-14">
                                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                                  <CreateFolderIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                  <p className="whitespace-normal break-words text-sm font-bold text-foreground">
                                    {ts.journalCreateFolder ||
                                      ts.journalCreateSpace ||
                                      "Create folder"}
                                  </p>
                                  <p className="mt-0.5 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground/70">
                                    {ts.journalFolderEmptyHint ||
                                      "Create a first note here and it will stay connected to this folder."}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center">
                                <input
                                  value={folderName}
                                  data-testid="journal-space-name-input"
                                  onChange={(event) => {
                                    setFolderName(event.target.value);
                                    if (folderError) setFolderError(null);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") void handleCreateFolder();
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      const spacesSheet = event.currentTarget.closest<HTMLElement>(
                                        '[data-testid="journal-spaces-sheet"]'
                                      );
                                      spacesSheet?.focus({ preventScroll: true });
                                      setFolderCreatorOpen(false);
                                      setFolderDescription("");
                                      setFolderError(null);
                                    }
                                  }}
                                  autoFocus
                                  placeholder={
                                    ts.journalFolderNamePlaceholder ||
                                    ts.journalSpaceNamePlaceholder ||
                                    "Folder name"
                                  }
                                  className="min-h-[44px] w-full min-w-0 flex-1 rounded-xl border border-border/30 bg-card/70 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/35"
                                />
                                <button
                                  type="button"
                                  data-testid="journal-space-create-submit"
                                  onClick={() => void handleCreateFolder()}
                                  disabled={folderSaving}
                                  className="inline-flex min-h-[44px] min-w-[44px] w-full items-center justify-center rounded-xl bg-primary px-3 text-center text-xs font-semibold text-primary-foreground whitespace-normal break-words disabled:opacity-50 min-[420px]:w-auto"
                                >
                                  {folderSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  ) : (
                                    ts.journalFolderCreate || ts.journalSpaceCreate || "Create"
                                  )}
                                </button>
                              </div>
                              <textarea
                                value={folderDescription}
                                data-testid="journal-space-description-input"
                                onChange={(event) => setFolderDescription(event.target.value)}
                                placeholder={
                                  ts.journalFolderDescriptionPlaceholder || "Description"
                                }
                                className="mt-2 min-h-[76px] w-full resize-none rounded-xl border border-border/30 bg-card/70 px-3 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/35"
                                maxLength={180}
                              />
                              {folderError ? (
                                <p className="mt-1.5 whitespace-normal break-words px-1 text-xs font-medium text-destructive">
                                  {folderError}
                                </p>
                              ) : null}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {!folderCreatorOpen && (
                          <AnimatePresence mode="wait" initial={false}>
                            {activeStudio ? (
                              <motion.div
                                key={`studio-${activeStudio.id}`}
                                data-testid="journal-capture-studio"
                                initial={
                                  reducedMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, x: 18, scale: 0.98 }
                                }
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={
                                  reducedMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, x: -12, scale: 0.98 }
                                }
                                transition={{ duration: 0.2 }}
                                className="space-y-3"
                              >
                                {(() => {
                                  const Icon = getSpaceDisplayIcon(activeStudio);
                                  const experience = getSpaceExperience(activeStudio);
                                  const prompts = getStudioPrompts(activeStudio);
                                  const values = studioDrafts[activeStudio.id] || [];
                                  const filledCount = values.filter((value) =>
                                    value?.trim()
                                  ).length;
                                  const focusedCapture =
                                    activeStudioCaptures.find(
                                      (capture) => capture.id === lastCaptureId
                                    ) || activeStudioCaptures[0];
                                  if (activeStudioMode === "board") {
                                    return (
                                      <>
                                        <div className="relative overflow-hidden rounded-[1.35rem] border border-primary/25 bg-background/60 p-3 backdrop-blur-xl">
                                          <div
                                            aria-hidden="true"
                                            className="absolute -inset-x-10 -top-16 h-32 rounded-full bg-primary/10 blur-2xl"
                                          />
                                          <div className="relative flex items-start gap-3">
                                            <button
                                              type="button"
                                              data-testid="journal-capture-back"
                                              onClick={() => {
                                                setActiveStudioId(null);
                                                setActiveStudioMode("compose");
                                              }}
                                              className="inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-2xl border border-border/25 bg-background/50 text-muted-foreground motion-safe:transition-[background-color,transform] hover:bg-muted/[0.52] active:scale-[0.98]"
                                              aria-label={
                                                ts.journalCaptureBack || "Back to studios"
                                              }
                                            >
                                              <ChevronRight
                                                className="h-4 w-4 rotate-180 rtl:rotate-0"
                                                aria-hidden="true"
                                              />
                                            </button>
                                            <span className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[1.15rem] border border-primary/25 bg-primary/10 text-primary shadow-[0_0_30px_hsl(var(--primary)/0.12)]">
                                              <span
                                                className="absolute inset-1 rounded-[0.9rem] border border-primary/[0.14]"
                                                aria-hidden="true"
                                              />
                                              <CheckCircle2
                                                className="relative h-5 w-5"
                                                aria-hidden="true"
                                              />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.18em] text-primary/[0.72]">
                                                {experience.mode}
                                              </p>
                                              <h3 className="mt-0.5 whitespace-normal break-words text-lg font-bold text-foreground">
                                                {ts.journalCaptureBoardTitle || "Space board"}
                                              </h3>
                                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground/[0.74]">
                                                {getSpaceDisplayName(activeStudio)} ·{" "}
                                                {formatLocalizedCount(
                                                  activeStudioCaptures.length,
                                                  language,
                                                  ts,
                                                  "journalEntryCount",
                                                  ts.journalEntries || "entries"
                                                )}
                                              </p>
                                            </div>
                                          </div>
                                        </div>

                                        {focusedCapture ? (
                                          <div
                                            data-testid="journal-capture-board-card"
                                            className="relative overflow-hidden rounded-[1.35rem] border border-primary/20 bg-card/60 p-3 backdrop-blur-xl"
                                          >
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="min-w-0">
                                                <p className="whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.16em] text-primary/[0.70]">
                                                  {ts.journalCaptureSavedToSpace ||
                                                    "Saved in space"}
                                                </p>
                                                <h4 className="mt-1 whitespace-normal break-words text-sm font-bold text-foreground">
                                                  {privateMode
                                                    ? ts.journalPrivateEntry ||
                                                      ts.privateMode ||
                                                      "Private entry"
                                                    : getCaptureDisplayTitle(focusedCapture, ts)}
                                                </h4>
                                              </div>
                                              <span className="rounded-full border border-border/20 bg-background/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                                                {privateMode
                                                  ? ts.privateMode || "Private"
                                                  : focusedCapture.date}
                                              </span>
                                            </div>
                                            {privateMode ? (
                                              <div className="mt-3 rounded-2xl border border-border/20 bg-background/45 p-3">
                                                <p className="text-sm font-semibold text-muted-foreground">
                                                  {ts.journalPrivateEntry ||
                                                    ts.privateMode ||
                                                    "Private entry"}
                                                </p>
                                              </div>
                                            ) : (
                                              <div className="mt-3 grid gap-2">
                                                {!privateMode &&
                                                  focusedCapture.fields
                                                    .filter(
                                                      (field) => field.value.trim().length > 0
                                                    )
                                                    .map((field) => (
                                                      <div
                                                        key={`${focusedCapture.id}-${field.prompt}`}
                                                        className="rounded-2xl border border-border/20 bg-background/45 p-3"
                                                      >
                                                        <p className="whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                                                          {getCaptureFieldPrompt(
                                                            focusedCapture,
                                                            field,
                                                            ts
                                                          )}
                                                        </p>
                                                        <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                                                          {field.value}
                                                        </p>
                                                      </div>
                                                    ))}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="rounded-[1.35rem] border border-border/25 bg-card/50 p-4 text-sm leading-relaxed text-muted-foreground">
                                            {ts.journalCaptureBoardEmpty ||
                                              "Captures saved here stay inside this space until you choose to open one as a diary entry."}
                                          </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                          <button
                                            type="button"
                                            data-testid="journal-capture-new"
                                            onClick={() => setActiveStudioMode("compose")}
                                            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-border/25 bg-background/50 px-3 text-center text-xs font-semibold text-muted-foreground whitespace-normal break-words motion-safe:transition-[background-color,transform] hover:bg-muted/50 active:scale-[0.98]"
                                          >
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                            {ts.journalCaptureCreateAnother || "New capture"}
                                          </button>
                                          <button
                                            type="button"
                                            data-testid="journal-capture-open-editor"
                                            aria-disabled={privateMode || undefined}
                                            onClick={() => {
                                              if (privateMode || !focusedCapture) return;
                                              handleOpenCaptureInEditor(
                                                activeStudio,
                                                focusedCapture
                                              );
                                            }}
                                            disabled={!focusedCapture || privateMode}
                                            className={cn(
                                              "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/15 px-3 text-center text-xs font-bold text-primary whitespace-normal break-words shadow-[0_0_28px_hsl(var(--primary)/0.12)] motion-safe:transition-[background-color,transform,box-shadow] disabled:opacity-50 active:scale-[0.98]",
                                              privateMode ? "cursor-default" : "hover:bg-primary/20"
                                            )}
                                          >
                                            <PenLine className="h-4 w-4" aria-hidden="true" />
                                            {ts.journalCaptureOpenEditor || "Open as entry"}
                                          </button>
                                        </div>
                                      </>
                                    );
                                  }
                                  return (
                                    <>
                                      <div className="relative overflow-hidden rounded-[1.35rem] border border-primary/25 bg-background/60 p-3 backdrop-blur-xl">
                                        <div
                                          aria-hidden="true"
                                          className="absolute -inset-x-10 -top-16 h-32 rounded-full bg-primary/10 blur-2xl"
                                        />
                                        <div className="relative flex items-start gap-3">
                                          <button
                                            type="button"
                                            data-testid="journal-capture-back"
                                            onClick={() => setActiveStudioId(null)}
                                            className="inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-2xl border border-border/25 bg-background/50 text-muted-foreground motion-safe:transition-[background-color,transform] hover:bg-muted/52 active:scale-[0.98]"
                                            aria-label={ts.journalCaptureBack || "Back to studios"}
                                          >
                                            <ChevronRight
                                              className="h-4 w-4 rotate-180 rtl:rotate-0"
                                              aria-hidden="true"
                                            />
                                          </button>
                                          <span className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[1.15rem] border border-primary/25 bg-primary/10 text-primary shadow-[0_0_30px_hsl(var(--primary)/0.12)]">
                                            <span
                                              className="absolute inset-1 rounded-[0.9rem] border border-primary/[0.14]"
                                              aria-hidden="true"
                                            />
                                            <span
                                              className="absolute h-9 w-9 rounded-full bg-primary/10 motion-safe:animate-pulse"
                                              aria-hidden="true"
                                            />
                                            <Icon className="relative h-5 w-5" aria-hidden="true" />
                                          </span>
                                          <div className="min-w-0 flex-1">
                                            <p className="whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.18em] text-primary/[0.72]">
                                              {experience.mode}
                                            </p>
                                            <h3 className="mt-0.5 whitespace-normal break-words text-lg font-bold text-foreground">
                                              {getSpaceDisplayName(activeStudio)}
                                            </h3>
                                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground/[0.74]">
                                              {getSpaceDisplayDescription(activeStudio)}
                                            </p>
                                          </div>
                                        </div>
                                        <div
                                          className="mt-3 flex items-center gap-1.5"
                                          aria-label={
                                            ts.journalCaptureProgress || "Capture progress"
                                          }
                                        >
                                          {prompts.map((prompt, index) => (
                                            <span
                                              key={`${prompt}-${index}`}
                                              className={cn(
                                                "h-1.5 flex-1 rounded-full motion-safe:transition-colors",
                                                values[index]?.trim()
                                                  ? "bg-primary"
                                                  : "bg-muted-foreground/[0.18]"
                                              )}
                                            />
                                          ))}
                                          <span className="ms-2 text-xs font-medium text-muted-foreground/[0.58]">
                                            {filledCount}/{prompts.length}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        {prompts.map((prompt, index) => (
                                          <label
                                            key={`${activeStudio.id}-${prompt}-${index}`}
                                            className="relative block overflow-hidden rounded-[1.15rem] border border-border/25 bg-card/50 p-3 ps-5 backdrop-blur-xl"
                                          >
                                            <span
                                              aria-hidden="true"
                                              className="absolute bottom-3 start-3 top-3 w-px rounded-full bg-primary/20"
                                            />
                                            <span className="mb-2 block whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/[0.72]">
                                              {prompt}
                                            </span>
                                            <textarea
                                              data-testid={`journal-capture-field-${index}`}
                                              value={values[index] || ""}
                                              onChange={(event) =>
                                                handleStudioFieldChange(
                                                  activeStudio.id,
                                                  index,
                                                  event.target.value
                                                )
                                              }
                                              placeholder={
                                                ts.journalCapturePlaceholder || "Write here..."
                                              }
                                              className="min-h-[82px] w-full resize-none rounded-xl border border-border/25 bg-background/60 px-3 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/30"
                                            />
                                          </label>
                                        ))}
                                      </div>

                                      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                                        <button
                                          type="button"
                                          data-testid="journal-capture-filter"
                                          onClick={() => handleSelectSpace(activeStudio)}
                                          className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-border/25 bg-background/50 px-3 text-center text-xs font-semibold text-muted-foreground whitespace-normal break-words motion-safe:transition-[background-color,transform] hover:bg-muted/50 active:scale-[0.98]"
                                        >
                                          {activeStudio.id === "space-all"
                                            ? ts.all || "All"
                                            : getSpaceDisplayName(activeStudio)}
                                        </button>
                                        <button
                                          type="button"
                                          data-testid="journal-capture-save"
                                          onClick={() => void handleSaveStudioCapture(activeStudio)}
                                          disabled={filledCount === 0 || studioSaving}
                                          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/15 px-3 text-center text-xs font-bold text-primary whitespace-normal break-words shadow-[0_0_28px_hsl(var(--primary)/0.12)] motion-safe:transition-[background-color,transform,box-shadow] hover:bg-primary/20 disabled:opacity-50 active:scale-[0.98]"
                                        >
                                          {studioSaving ? (
                                            <Loader2
                                              className="h-4 w-4 animate-spin"
                                              aria-hidden="true"
                                            />
                                          ) : (
                                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                          )}
                                          {ts.journalCaptureSaveToSpace || "Save to space"}
                                        </button>
                                      </div>
                                    </>
                                  );
                                })()}
                              </motion.div>
                            ) : (
                              <motion.div
                                key="studio-list"
                                initial={
                                  reducedMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, x: -12, scale: 0.99 }
                                }
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={
                                  reducedMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, x: 12, scale: 0.99 }
                                }
                                transition={{ duration: 0.18 }}
                                className="space-y-3"
                              >
                                <p className="px-1 text-xs text-muted-foreground/70">
                                  {visibleSpaceOptions.length > 0
                                    ? ts.journalFolders || "Folders"
                                    : ts.journalFolderEmpty || "No folders yet"}
                                </p>
                                <div
                                  className="grid gap-2"
                                  data-testid="journal-capture-studio-list"
                                >
                                  {visibleSpaceOptions.length === 0 ? (
                                    <div className="rounded-[1.25rem] border border-dashed border-border/30 bg-background/40 p-4 text-sm leading-relaxed text-muted-foreground/75">
                                      {ts.journalFolderEmptyHint ||
                                        "Create your first folder with the plus button. Gratitudes will appear here automatically after your first gratitude."}
                                    </div>
                                  ) : (
                                    visibleSpaceOptions.map((space) => {
                                      const Icon = getSpaceDisplayIcon(space);
                                      const experience = getSpaceExperience(space);
                                      const visualRole = getSpaceDisplayVisualRole(space);
                                      const tone = getRoleTone(visualRole);
                                      const spaceDisplayName = getSpaceDisplayName(space);
                                      const spaceDisplayDescription =
                                        getSpaceDisplayDescription(space);
                                      return (
                                        <button
                                          key={space.id}
                                          type="button"
                                          data-testid={`journal-space-option-${space.id}`}
                                          onClick={() => handleOpenStudio(space)}
                                          className={
                                            "group relative min-h-[76px] overflow-hidden rounded-2xl border bg-background/50 p-3 text-start shadow-[0_10px_28px_hsl(var(--foreground)/0.06)] motion-safe:transition-[background-color,border-color,box-shadow,transform] hover:bg-background/60 active:scale-[0.99] " +
                                            tone.borderClass
                                          }
                                          data-visual-role={visualRole}
                                        >
                                          <span
                                            aria-hidden="true"
                                            className={
                                              "absolute inset-y-4 start-7 w-px rounded-full " +
                                              tone.softBgClass
                                            }
                                          />
                                          <div className="relative flex items-center gap-3">
                                            <span
                                              className={
                                                "relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border shadow-[0_14px_28px_hsl(var(--background)/0.20)] " +
                                                tone.iconClass
                                              }
                                              style={
                                                space.autoSource === "gratitude"
                                                  ? getSpaceDisplayCoverStyle(space)
                                                  : undefined
                                              }
                                            >
                                              <span
                                                aria-hidden="true"
                                                className={
                                                  "absolute inset-1 rounded-[0.75rem] border opacity-70 " +
                                                  tone.borderClass
                                                }
                                              />
                                              <span
                                                aria-hidden="true"
                                                className={
                                                  "absolute h-9 w-9 rounded-full opacity-0 blur-sm motion-safe:transition-opacity group-hover:opacity-100 " +
                                                  tone.softBgClass
                                                }
                                              />
                                              <Icon
                                                className="relative h-5 w-5"
                                                aria-hidden="true"
                                              />
                                              {!privateMode && space.count > 0 ? (
                                                <span className="absolute bottom-1 end-1 min-h-[24px] min-w-[24px] rounded-full border border-background/40 bg-background/70 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-foreground backdrop-blur-md">
                                                  {space.count}
                                                </span>
                                              ) : null}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                <span className="min-w-0 whitespace-normal break-words text-sm font-bold text-foreground">
                                                  {spaceDisplayName}
                                                </span>
                                                {space.private ? (
                                                  <LockKeyhole
                                                    className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/65"
                                                    aria-hidden="true"
                                                  />
                                                ) : null}
                                              </span>
                                              <span
                                                className={
                                                  "mt-0.5 block whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.14em] " +
                                                  tone.textClass
                                                }
                                              >
                                                {experience.mode}
                                              </span>
                                              <span className="mt-0.5 block whitespace-normal break-words text-xs leading-relaxed text-muted-foreground/70">
                                                {spaceDisplayDescription}
                                              </span>
                                              <span className="mt-1.5 flex items-center justify-between gap-2">
                                                <span className="text-xs font-medium text-muted-foreground/[0.55]">
                                                  {privateMode
                                                    ? privateMetricLabel
                                                    : formatLocalizedCount(
                                                        space.count,
                                                        language,
                                                        ts,
                                                        "journalEntryCount",
                                                        ts.journalEntries || "entries"
                                                      )}
                                                </span>
                                                <span
                                                  className={
                                                    "inline-flex min-h-[44px] min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold " +
                                                    tone.iconClass
                                                  }
                                                >
                                                  <PenLine
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden="true"
                                                  />
                                                  <span className="min-w-0 whitespace-normal break-words">
                                                    {experience.action}
                                                  </span>
                                                </span>
                                              </span>
                                            </span>
                                            <ChevronRight
                                              className="h-4 w-4 flex-shrink-0 text-muted-foreground/45 rtl:rotate-180"
                                              aria-hidden="true"
                                            />
                                          </div>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body
          )
        : null}

      {renderEntryActionsSheet()}

      <AnimatePresence mode="wait" initial={false}>
        {activeSpaceMode ? renderSpaceWorkspace(activeSpaceMode) : null}
      </AnimatePresence>

      {/* Account-backed private search results */}
      {!activeSpaceMode && aiMode && debouncedSearch.trim() && !aiSearching && (
        <>
          {aiSearchError ? (
            <div className="flex flex-col items-center py-8 text-center" role="status">
              <Search className="mb-2 h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
              <p className="text-sm text-muted-foreground mb-1">
                {ts.journalAiSearchUnavailable || "Private search is unavailable right now"}
              </p>
              <p className="mb-3 max-w-[240px] whitespace-normal break-words text-xs text-muted-foreground/50">
                {ts.journalAiSearchUnavailableHint ||
                  "Your entries are still here. Try standard search or retry later."}
              </p>
            </div>
          ) : aiMatchedEntries.length > 0 ? (
            <motion.div
              variants={activeContainerVariants}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              <AnimatePresence mode="popLayout">
                {aiMatchedEntries.map(({ entry, similarity }, index) => (
                  <motion.div
                    key={entry.id}
                    variants={activeItemVariants}
                    custom={index}
                    layout
                    exit={{ x: -300, opacity: 0 }}
                    transition={{
                      ...springs.quick,
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                    }}
                    className="relative"
                  >
                    <div className="absolute top-2 end-2 z-10 rounded-md bg-purple-500/10 px-1.5 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                      {Math.round(similarity * 100)}%
                    </div>
                    {/* A11Y-OK: ContextMenu uses Radix with built-in aria; trigger is JournalEntryCard which has its own aria-labels */}
                    <ContextMenu
                      enabled={isMouse && !privateMode}
                      trigger={
                        // A11Y-OK: JournalEntryCard has role=button + tabIndex + aria internally
                        <JournalEntryCard
                          entry={entry}
                          onTap={handleTap}
                          onDelete={handleDelete}
                          onActions={handleEntryActions}
                          onLongPress={handleEntryActions}
                          onSwipeDelete={handleSwipeDelete}
                          privateMode={privateMode}
                          searchQuery={debouncedSearch}
                          isActive={activeEntryId === entry.id}
                          dimmed={!!activeEntryId && activeEntryId !== entry.id}
                        />
                      }
                      items={[...getEntryContextItems(entry)]}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <Search className="mb-2 h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
              <p className="text-sm text-muted-foreground mb-1">
                {ts.journalNoAiResults || "No similar entries found"}
              </p>
              <p className="mb-3 max-w-[220px] whitespace-normal break-words text-xs text-muted-foreground/50">
                {ts.journalNoAiResultsHint || "Try describing your thoughts differently"}
              </p>
            </div>
          )}
        </>
      )}

      {/* Text search: entries for the active diary surface. Day grouping is intentionally not shown here. */}
      {!activeSpaceMode && !aiMode && visibleFilteredEntries.length > 0 && (
        <motion.div
          variants={activeContainerVariants}
          initial="hidden"
          animate="show"
          className={cn(
            "space-y-2",
            compact ? "space-y-1.5" : "md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0"
          )}
        >
          <AnimatePresence mode="popLayout">
            {visibleFilteredEntries.map((entry, index) => (
              <motion.div
                key={entry.id}
                variants={activeItemVariants}
                custom={index}
                layout
                exit={{ x: -300, opacity: 0 }}
                transition={{
                  ...springs.quick,
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                }}
              >
                {/* A11Y-OK: ContextMenu uses Radix with built-in aria; trigger is JournalEntryCard which has its own aria-labels */}
                <ContextMenu
                  enabled={isMouse && !privateMode}
                  trigger={
                    // A11Y-OK: JournalEntryCard has role=button + tabIndex + aria internally
                    <JournalEntryCard
                      entry={entry}
                      onTap={handleTap}
                      onDelete={handleDelete}
                      onActions={handleEntryActions}
                      onLongPress={handleEntryActions}
                      onSwipeDelete={handleSwipeDelete}
                      privateMode={privateMode}
                      searchQuery={debouncedSearch}
                      isActive={activeEntryId === entry.id}
                      dimmed={!!activeEntryId && activeEntryId !== entry.id}
                    />
                  }
                  items={[...getEntryContextItems(entry)]}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* No results after filtering (text mode) */}
      {!activeSpaceMode && !aiMode && hasActiveFilters && filteredEntries.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-border/25 bg-card/45 px-4 py-8 text-center backdrop-blur-xl">
          {selectedTag && !deferredSearch ? (
            <OpenFolderIcon className="mb-2 h-8 w-8 text-primary/70" aria-hidden="true" />
          ) : (
            <Search className="mb-2 h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
          )}
          <p className="text-sm text-muted-foreground mb-1">
            {activeFilterSpaceName && !deferredSearch
              ? ts.journalSpaceEmpty || "This space is empty"
              : ts.journalNoMatchingEntries || "No entries match your search"}
          </p>
          <p className="mb-3 max-w-[220px] whitespace-normal break-words text-xs text-muted-foreground/50">
            {activeFilterSpaceName && !deferredSearch
              ? ts.journalSpaceEmptyHint ||
                "Create a first note here and it will stay connected to this space."
              : ts.journalNoMatchingHint || "Try a different keyword or clear your filters"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {activeFilterSpaceName && !deferredSearch && onNewEntryWithPrefill ? (
              <button
                onClick={() =>
                  onNewEntryWithPrefill({
                    tags: privateMode ? [] : [activeFilterSpaceName],
                    date: activeDraftDate,
                    spaceId: privateMode ? undefined : (selectedSpaceId ?? undefined),
                  })
                }
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
              >
                {ts.journalWriteInSpace || "Write in space"}
              </button>
            ) : null}
            <button
              onClick={() => {
                setSearchInput("");
                setSelectedTag(null);
                setSelectedSpaceId(null);
              }}
              className="text-xs text-primary font-medium px-3 py-1.5 rounded-lg hover:bg-primary/10 motion-safe:transition-colors min-h-[44px]"
            >
              {ts.journalClearAllFilters || "Clear all filters"}
            </button>
          </div>
        </div>
      )}

      {showFab && !activeSpaceMode && (
        <JournalCaptureLauncher
          onNewEntry={onNewEntry}
          onAddGratitude={handleAddGratitudeToSpaces}
          onFocusEntry={onNewEntry}
          onReleaseThought={onReleaseThought}
        />
      )}
      <JournalAiConsentDialog
        open={aiConsentDialogOpen}
        busy={aiConsentBusy}
        error={aiConsentError}
        ts={ts}
        restoreFocusTo={aiToggleButtonRef}
        onCancel={cancelAiConsent}
        onConfirm={confirmAiConsent}
      />
    </div>
  );
});
