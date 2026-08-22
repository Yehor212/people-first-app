import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ChevronRight,
  Image,
  Mic,
  PenLine,
  Sparkles,
  Sprout,
  Target,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ParticleBackground } from "@/components/stats/ParticleBackground";
import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { SplashScreen, type SplashThemePreference } from "@/components/SplashScreen";
import { useBackHandler } from "@/hooks/useBackHandler";
import { hapticMedium, hapticSuccess, hapticTap } from "@/lib/haptics";
import { shouldAnimate } from "@/lib/animationUtils";
import { easings } from "@/lib/motion";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw } from "@/lib/safeJson";
import { cn, getToday } from "@/lib/utils";
import { getLocale } from "@/lib/timeUtils";
import type { Language } from "@/i18n/types";
import type { GratitudeEntry, MoodEntry } from "@/types";
import { BurnThoughtWidget } from "./BurnThoughtWidget";
import { DiaryBreatheWidget } from "./DiaryBreatheWidget";
import { GratitudeBloomWidget } from "./GratitudeBloomWidget";
import { JournalEntryList } from "./JournalEntryList";
import { OnThisDayCard } from "./OnThisDayCard";
import { TimeOfDayGradient } from "./TimeOfDayGradient";
import {
  MEMORY_PORTAL_ACTION_ICON_KEYS,
  ZODIAC_CONSTELLATIONS,
  buildMemoryPortalNodes,
  getEntriesForPortalDate,
  getMemoryPortalMoodSignal,
  getZodiacSignForBirthDate,
  loadMemoryPortalPreferences,
  type MemoryPortalAction,
  type MemoryPortalNode,
} from "./memoryPortal";
import type { JournalEntry, JournalEntryPrefill, JournalReleaseTraceSummary } from "./types";
import { getVisibleJournalTags } from "./journalFavorite";

type EntryGroup = { label: string; key: string; entries: JournalEntry[] };

interface MemoryPortalCanvasProps {
  ts: Record<string, string>;
  language?: Language;
  entries: JournalEntry[];
  moods?: MoodEntry[];
  groupedEntries: EntryGroup[];
  listTotalCount: number;
  loading?: boolean;
  loadingTheme?: SplashThemePreference;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onOpenEntry: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onSwipeDelete?: (id: string) => void;
  onNewEntry: () => void;
  onNewEntryWithPrefill: (prefill: JournalEntryPrefill) => void;
  onAddGratitude?: (entry: GratitudeEntry) => void;
  releaseTraceSummaries?: Map<string, JournalReleaseTraceSummary>;
  onReleaseThought?: () => void | Promise<void>;
  daysSinceLastEntry?: number | null;
  privateMode?: boolean;
  beforeList?: ReactNode;
  showList?: boolean;
  showDayCapsuleButton?: boolean;
  showActionToggle?: boolean;
}

const ACTION_ICONS = {
  write: PenLine,
  voice: Mic,
  photo: Image,
  gratitude: Sprout,
  burn: Sparkles,
  focus: Target,
} satisfies Record<MemoryPortalAction, typeof PenLine>;
const ACTION_FAN_LONG_PRESS_MS = 430;

function formatPortalDate(date: string, locale: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", weekday: "short" }).format(parsed);
}

function getActionLabel(ts: Record<string, string>, action: MemoryPortalAction): string {
  const labels: Record<MemoryPortalAction, string> = {
    write: ts.journalFabNewEntry || ts.journalNewEntry || "New entry",
    voice: ts.journalVoiceNote || "Voice",
    photo: ts.journalPhotoAdd || "Photo",
    gratitude: ts.gratitude || ts.journalQuickGratitude || "Gratitude",
    burn: ts.journalBurnAThought || "Burn thought",
    focus: ts.focus || "Focus",
  };
  return labels[action];
}

function portalPrefillForAction(action: MemoryPortalAction, date: string, ts: Record<string, string>): JournalEntryPrefill {
  const titleByAction: Record<MemoryPortalAction, string> = {
    write: "",
    voice: ts.journalVoiceNote || "Voice note",
    photo: ts.journalPhotoAdd || "Photo",
    gratitude: ts.gratitude || "Gratitude",
    burn: "",
    focus: ts.focus || "Focus",
  };

  const contentByAction: Record<MemoryPortalAction, string> = {
    write: "",
    voice: ts.journalVoiceNotePrompt || "",
    photo: ts.journalPhotoPrompt || "",
    gratitude: ts.gratitudeTemplate1 || "",
    burn: "",
    focus: ts.focusLabelPrompt || "",
  };

  return {
    title: titleByAction[action],
    content: contentByAction[action],
    tags: [`portal-${action}`],
    date,
  };
}

function nodeSizeClass(size: MemoryPortalNode["size"]): string {
  if (size === "lg") return "h-5 w-5";
  if (size === "md") return "h-4 w-4";
  return "h-3 w-3";
}

function nodePulseClass(size: MemoryPortalNode["size"]): string {
  if (size === "lg") return "h-12 w-12";
  if (size === "md") return "h-10 w-10";
  return "h-8 w-8";
}

const EMPTY_PORTAL_ENTRIES: JournalEntry[] = [];
const EMPTY_PORTAL_MOODS: MoodEntry[] = [];

function buildPrivateMemoryPortalNode(date: string): MemoryPortalNode {
  return {
    id: "memory-node-private",
    entryId: "private",
    date,
    title: "Private",
    x: 50,
    y: 52,
    size: "md",
    hasMedia: false,
    hasAudio: false,
    wordCount: 0,
    createdAt: 0,
    isSelectedDay: true,
  };
}

export const MemoryPortalCanvas = memo(function MemoryPortalCanvas({
  ts,
  language = "en",
  entries,
  moods = [],
  groupedEntries,
  listTotalCount,
  loading = false,
  loadingTheme = "auto",
  selectedDate,
  onSelectDate,
  onOpenEntry,
  onDeleteEntry,
  onSwipeDelete,
  onNewEntry,
  onNewEntryWithPrefill,
  onAddGratitude,
  releaseTraceSummaries,
  onReleaseThought,
  daysSinceLastEntry,
  privateMode = false,
  beforeList,
  showList = true,
  showDayCapsuleButton = false,
  showActionToggle = false,
}: MemoryPortalCanvasProps) {
  const locale = getLocale(language);
  const reducedMotion = useReducedMotion();
  const animate = shouldAnimate() && !reducedMotion;
  const preferences = useMemo(() => loadMemoryPortalPreferences(), []);
  const activeDate = selectedDate ?? getToday();
  const visualEntries = privateMode ? EMPTY_PORTAL_ENTRIES : entries;
  const visualMoods = privateMode ? EMPTY_PORTAL_MOODS : moods;
  const nodes = useMemo(() => buildMemoryPortalNodes(visualEntries, activeDate), [activeDate, visualEntries]);
  const moodSignal = useMemo(
    () => getMemoryPortalMoodSignal(visualEntries, visualMoods, activeDate),
    [activeDate, visualEntries, visualMoods]
  );
  const zodiacSign = useMemo(
    () => getZodiacSignForBirthDate(storageGetRaw(SK.USER_BIRTH_DATE, "")),
    []
  );
  const capsuleEntries = useMemo(
    () => getEntriesForPortalDate(entries, activeDate),
    [activeDate, entries]
  );
  const visibleCapsuleEntries = privateMode ? capsuleEntries.slice(0, 1) : capsuleEntries.slice(0, 3);
  const visibleNodes = useMemo(
    () => (privateMode && entries.length > 0 ? [buildPrivateMemoryPortalNode(activeDate)] : nodes),
    [activeDate, entries.length, nodes, privateMode]
  );
  const recentNodes = visibleNodes.slice(0, 9);
  const [actionFanOpen, setActionFanOpen] = useState(false);
  const [activeScene, setActiveScene] = useState<MemoryPortalAction | null>(null);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startYRef = useRef<number | null>(null);
  const pointerDownAtRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const prevSelectedDateRef = useRef<string | null>(selectedDate);
  const safeAreaStyle = {
    "--memory-portal-safe-top": "var(--safe-top)",
    "--memory-portal-safe-bottom": "var(--safe-bottom)",
    "--memory-portal-nav-reserve":
      "max(var(--safe-bottom), var(--zenflow-test-nav-inset-bottom, 0px))",
  } as CSSProperties;

  useBackHandler(actionFanOpen, () => setActionFanOpen(false));
  useBackHandler(capsuleOpen, () => setCapsuleOpen(false));
  useBackHandler(Boolean(activeScene), () => setActiveScene(null));

  useEffect(() => {
    if (selectedDate && prevSelectedDateRef.current !== selectedDate) {
      setCapsuleOpen(true);
    }
    prevSelectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!actionFanOpen && !capsuleOpen && !activeScene) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setActionFanOpen(false);
      setCapsuleOpen(false);
      setActiveScene(null);
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [actionFanOpen, activeScene, capsuleOpen]);

  const openFan = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTriggeredRef.current = true;
    setActionFanOpen(true);
    void hapticMedium();
  }, []);

  const closeFan = useCallback(() => {
    setActionFanOpen(false);
    longPressTriggeredRef.current = false;
  }, []);

  const openCapsuleForDate = useCallback(
    (date: string) => {
      onSelectDate(date);
      setCapsuleOpen(true);
      void hapticTap();
    },
    [onSelectDate]
  );

  const startEntry = useCallback(
    (action: MemoryPortalAction = "write") => {
      closeFan();
      setActiveScene(null);
      if (action === "write") {
        onNewEntry();
        return;
      }
      onNewEntryWithPrefill(portalPrefillForAction(action, activeDate, ts));
    },
    [activeDate, closeFan, onNewEntry, onNewEntryWithPrefill, ts]
  );

  const handleAction = useCallback(
    (action: MemoryPortalAction) => {
      void hapticTap();
      if (action === "gratitude" || action === "burn" || action === "focus") {
        setActiveScene(action);
        closeFan();
        return;
      }
      startEntry(action);
    },
    [closeFan, startEntry]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      startYRef.current = event.clientY;
      pointerDownAtRef.current = Date.now();
      longPressTriggeredRef.current = false;
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(openFan, ACTION_FAN_LONG_PRESS_MS);
    },
    [openFan]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (startYRef.current == null) return;
      if (startYRef.current - event.clientY > 30) {
        openFan();
      }
    },
    [openFan]
  );

  const handlePointerEnd = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    startYRef.current = null;
    const heldForMs = pointerDownAtRef.current == null ? 0 : Date.now() - pointerDownAtRef.current;
    pointerDownAtRef.current = null;
    if (heldForMs >= ACTION_FAN_LONG_PRESS_MS) {
      openFan();
      return;
    }
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    startEntry("write");
  }, [openFan, startEntry]);

  const handleCoreKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startEntry("write");
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        openFan();
      }
    },
    [openFan, startEntry]
  );

  const actionOrder = preferences.actionOrder.filter((action) => MEMORY_PORTAL_ACTION_ICON_KEYS[action]);

  if (loading) {
    return (
      <SplashScreen
        loadingFadeOut={false}
        subtitle={ts.initializingApp || "Preparing your zen space..."}
        theme={loadingTheme}
        instant
      />
    );
  }

  return (
    <div
      data-testid="memory-portal-canvas"
      style={safeAreaStyle}
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-3 pb-[calc(0.75rem+var(--memory-portal-nav-reserve))] scroll-pb-[calc(7rem+var(--memory-portal-nav-reserve))]"
    >
      <section
        className="zf-memory-portal-surface relative overflow-hidden rounded-[2rem] border border-primary/15 bg-background/75 shadow-[0_22px_80px_hsl(var(--primary)/0.10)]"
        aria-label={ts.journalMemoryPortalTitle || "Memory portal"}
      >
        <TimeOfDayGradient />
        <ParticleBackground count={entries.length > 0 ? 10 : 7} color="primary" />

        <div className="zf-memory-portal-glow pointer-events-none absolute inset-0" />

          <div className="relative z-[1] flex flex-col items-stretch gap-3 px-5 pt-5 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
            <div className="min-w-0 flex-1">
            <p className="whitespace-normal break-words text-xs font-bold uppercase tracking-[0.22em] text-primary/75">
              {ts.journalMemoryPortalEyebrow || "Memory portal"}
            </p>
            <h3 className="mt-1 whitespace-normal break-words text-2xl font-black tracking-normal text-foreground">
              {selectedDate ? formatPortalDate(selectedDate, locale) : ts.journalToday || "Today"}
            </h3>
            <p className="mt-1 max-w-none whitespace-normal break-words text-xs leading-relaxed text-muted-foreground min-[420px]:max-w-[230px]">
              {entries.length > 0
                ? ts.journalMemoryPortalHint || "Your entries are gathered into one living map."
                : ts.journalMemoryPortalEmptyHint ||
                  "Start from the core. One note is enough to light the first node."}
            </p>
          </div>

          {showDayCapsuleButton ? (
            <button
              type="button"
              onClick={() => openCapsuleForDate(activeDate)}
              className="press-stable flex min-h-[44px] min-w-[44px] self-end items-center justify-center rounded-full border border-border/25 bg-card/60 text-muted-foreground backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] motion-safe:transition-colors hover:text-foreground min-[420px]:self-auto"
              aria-label={ts.journalDayCapsule || "Day capsule"}
              data-testid="memory-portal-day-capsule-button"
            >
              <ChevronRight className="h-4 w-4 rotate-90" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="absolute inset-x-4 bottom-6 top-24 z-[2]">
          {zodiacSign ? (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-[12%] h-[58%] opacity-45"
              data-testid="memory-portal-zodiac"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {ZODIAC_CONSTELLATIONS[zodiacSign].slice(0, -1).map((point, index) => {
                const next = ZODIAC_CONSTELLATIONS[zodiacSign][index + 1];
                return (
                  <line
                    key={`${zodiacSign}-line-${index}`}
                    x1={point[0]}
                    y1={point[1]}
                    x2={next[0]}
                    y2={next[1]}
                    className="stroke-primary/20"
                    strokeWidth="0.65"
                    strokeLinecap="round"
                  />
                );
              })}
              {ZODIAC_CONSTELLATIONS[zodiacSign].map((point, index) => (
                <circle
                  key={`${zodiacSign}-star-${index}`}
                  cx={point[0]}
                  cy={point[1]}
                  r={index === 0 ? 1.5 : 1.05}
                  className="fill-primary/45"
                />
              ))}
            </svg>
          ) : null}

          {preferences.constellationVisible && recentNodes.length > 1 ? (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              {recentNodes.slice(0, -1).map((node, index) => {
                const next = recentNodes[index + 1];
                return (
                  <line
                    key={`${node.id}-${next.id}`}
                    x1={node.x}
                    y1={node.y}
                    x2={next.x}
                    y2={next.y}
                    className="stroke-primary/15"
                    strokeWidth="0.7"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
          ) : null}

          <AnimatePresence>
            {recentNodes.map((node, index) => (
              <motion.button
                key={node.id}
                type="button"
                className={cn(
                  "absolute flex min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                )}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                initial={animate ? { opacity: 0, scale: 0.65 } : false}
                animate={
                  animate
                    ? {
                        opacity: 1,
                        scale: node.isSelectedDay ? [1, 1.08, 1] : 1,
                        y: preferences.motionIntensity === "quiet" ? 0 : [0, index % 2 === 0 ? -4 : 4, 0],
                      }
                    : { opacity: 1, scale: 1 }
                }
                exit={{ opacity: 0, scale: 0.8 }}
                transition={
                  animate
                    ? {
                        opacity: { duration: 0.22, delay: index * 0.04 },
                        scale: { duration: 3.8, repeat: Infinity, ease: "easeInOut" },
                        y: { duration: 8 + index, repeat: Infinity, ease: "easeInOut" },
                      }
                    : undefined
                }
                onClick={() => openCapsuleForDate(node.date)}
                aria-label={
                  privateMode
                    ? `${ts.journalHubSpacePrivate || "Private"} ${formatPortalDate(node.date, locale)}`
                    : `${node.title} ${formatPortalDate(node.date, locale)}`
                }
                data-testid="memory-portal-node"
              >
                <span
                  className={cn(
                    "absolute rounded-full bg-primary/10 blur-sm",
                    nodePulseClass(node.size),
                    node.isSelectedDay && "ring-1 ring-primary/25"
                  )}
                />
                <span
                  className={cn(
                    "relative rounded-full border border-primary/40 bg-primary/75 shadow-[0_0_22px_hsl(var(--primary)/0.35)]",
                    nodeSizeClass(node.size)
                  )}
                />
              </motion.button>
            ))}
          </AnimatePresence>

          <div className="absolute left-1/2 top-[52%] z-[25] -translate-x-1/2 -translate-y-1/2">
            <motion.button
              type="button"
              className="group relative flex min-h-[112px] min-w-[112px] items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label={ts.journalMemoryPortalCore || "Write from portal core"}
              data-testid="memory-portal-core"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onKeyDown={handleCoreKeyDown}
              whileTap={animate ? { scale: 0.96 } : undefined}
            >
              <motion.span
                className="absolute h-[112px] w-[112px] rounded-full border border-primary/20 bg-primary/5 shadow-[0_0_70px_hsl(var(--primary)/0.20)]"
                animate={animate ? { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] } : undefined}
                transition={animate ? { duration: 4.5, repeat: Infinity, ease: "easeInOut" } : undefined}
              />
              <span className="absolute h-[74px] w-[74px] rounded-full border border-primary/25 bg-background/80 backdrop-blur-md [-webkit-backdrop-filter:blur(12px)]" />
              <MiniValenceOrb
                valence={moodSignal.valence}
                hasEntry={moodSignal.hasMoodSignal}
                size="lg"
                chrome="refine"
                containerClassName="relative z-[2]"
              />
              <span className="sr-only">{ts.journalStartYourStory || "Start your story"}</span>
            </motion.button>

            {showActionToggle ? (
              <button
                type="button"
                onClick={openFan}
                className="press-stable absolute -bottom-1 left-1/2 z-[27] flex min-h-[44px] min-w-[44px] -translate-x-1/2 items-center justify-center rounded-full border border-primary/20 bg-card/80 text-primary shadow-[0_10px_34px_hsl(var(--primary)/0.16)] backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]"
                aria-label={ts.journalMemoryPortalActions || "Open portal actions"}
                data-testid="memory-portal-action-toggle"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <AnimatePresence>
          {actionFanOpen ? (
            <>
              <motion.button
                type="button"
                className="absolute inset-0 z-[20] cursor-default"
                aria-label={ts.close || "Close"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeFan}
              />
              <div className="pointer-events-none absolute inset-x-3 bottom-[calc(1rem+var(--memory-portal-safe-bottom))] top-[calc(5rem+var(--memory-portal-safe-top))] z-[30] flex items-end">
                <div className="pointer-events-auto grid max-h-full w-full grid-cols-2 gap-2 overflow-y-auto overscroll-contain rounded-[1.75rem] border border-primary/15 bg-background/90 p-2 shadow-[0_24px_70px_hsl(var(--background)/0.72)] backdrop-blur-2xl [-webkit-backdrop-filter:blur(22px)]">
                  {actionOrder.map((action, index) => {
                    const Icon = ACTION_ICONS[action];
                    return (
                      <motion.button
                        key={action}
                        type="button"
                        className="flex min-h-[52px] min-w-0 items-center gap-2 rounded-[1.35rem] border border-primary/20 bg-card/90 px-3 py-2 text-xs font-semibold text-foreground shadow-[0_12px_38px_hsl(var(--primary)/0.16)]"
                        initial={animate ? { opacity: 0, y: 16 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={animate ? { opacity: 0, y: 12 } : { opacity: 0 }}
                        transition={
                          animate
                            ? {
                                type: "spring",
                                stiffness: 360,
                                damping: 26,
                                delay: index * 0.025,
                              }
                            : { duration: 0.12 }
                        }
                        onClick={() => handleAction(action)}
                        aria-label={getActionLabel(ts, action)}
                        data-testid={`memory-portal-action-${action}`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 whitespace-normal break-words text-start leading-tight">
                          {getActionLabel(ts, action)}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeScene ? (
            <motion.div
              key={activeScene}
              className="absolute inset-x-3 top-[calc(4rem+var(--memory-portal-safe-top))] z-[38] max-h-[calc(100%-5rem)] overflow-y-auto rounded-[1.75rem] border border-primary/15 bg-background/95 p-3 shadow-[0_28px_90px_hsl(var(--background)/0.88)] backdrop-blur-2xl [-webkit-backdrop-filter:blur(22px)]"
              initial={animate ? { opacity: 0, y: 18, scale: 0.96 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={animate ? { opacity: 0, y: 12, scale: 0.98 } : { opacity: 0 }}
              transition={{ duration: 0.24, ease: easings.emphasizedDecelerate }}
              data-testid={`memory-portal-scene-${activeScene}`}
            >
              {activeScene === "gratitude" && onAddGratitude ? (
                <GratitudeBloomWidget
                  surfaceClassName="my-0 border-primary/15 bg-card/70 shadow-none"
                  onClose={() => setActiveScene(null)}
                  onPlant={(entry) => {
                    onAddGratitude(entry);
                    void hapticSuccess();
                  }}
                />
              ) : null}

              {activeScene === "burn" ? (
                <BurnThoughtWidget
                  surfaceClassName="my-0 border-primary/15 bg-card/70 shadow-none"
                  onClose={() => setActiveScene(null)}
                  onReleased={onReleaseThought}
                />
              ) : null}

              {activeScene === "focus" ? (
                <div className="px-4 py-5 text-center">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      <Target className="h-4 w-4" aria-hidden="true" />
                      {ts.focus || "Focus"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveScene(null)}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground"
                      aria-label={ts.close || "Close"}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <DiaryBreatheWidget animate={animate} />
                  <p className="mx-auto max-w-[240px] text-sm leading-relaxed text-muted-foreground">
                    {ts.journalFocusPortalHint || "Let the noise narrow into one clean sentence."}
                  </p>
                  <button
                    type="button"
                    onClick={() => startEntry("focus")}
                    className="mt-5 min-h-[44px] rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_14px_38px_hsl(var(--primary)/0.22)]"
                  >
                    {ts.journalFocusOpenEntry || ts.journalNewEntry || "Open focused note"}
                  </button>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {capsuleOpen ? (
          <motion.section
            className="relative z-[3] -mt-9 mx-2 mb-[calc(1rem+var(--memory-portal-nav-reserve))] rounded-[1.6rem] border border-primary/15 bg-card/92 p-4 shadow-[0_22px_70px_hsl(var(--background)/0.72)] backdrop-blur-2xl [-webkit-backdrop-filter:blur(22px)]"
            initial={animate ? { opacity: 0, y: 22, scale: 0.97 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={animate ? { opacity: 0, y: 16, scale: 0.98 } : { opacity: 0 }}
            transition={{ duration: 0.24, ease: easings.emphasizedDecelerate }}
            data-testid="memory-portal-day-capsule"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">
                  {ts.journalDayCapsule || "Day capsule"}
                </p>
                <h4 className="mt-1 text-lg font-black text-foreground">{formatPortalDate(activeDate, locale)}</h4>
              </div>
              <button
                type="button"
                onClick={() => setCapsuleOpen(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground"
                aria-label={ts.close || "Close"}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border/20 bg-background/45 px-3 py-2">
                <p className="whitespace-normal break-words text-xs text-muted-foreground">
                  {ts.journalEntries || "Entries"}
                </p>
                <p className="whitespace-normal break-words text-base font-black text-foreground">
                  {privateMode ? ts.journalHubSpacePrivate || ts.privateMode || "Private" : capsuleEntries.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/20 bg-background/45 px-3 py-2">
                <p className="whitespace-normal break-words text-xs text-muted-foreground">
                  {ts.journalPhotoAdd || "Media"}
                </p>
                <p className="whitespace-normal break-words text-base font-black text-foreground">
                  {privateMode ? ts.journalHubSpacePrivate || ts.privateMode || "Private" : capsuleEntries.filter((entry) => entry.photoIds.length > 0 || (entry.audioIds?.length ?? 0) > 0).length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/20 bg-background/45 px-3 py-2">
                <p className="whitespace-normal break-words text-xs text-muted-foreground">
                  {ts.focus || "Focus"}
                </p>
                <p className="whitespace-normal break-words text-base font-black text-foreground">
                  {privateMode ? ts.journalHubSpacePrivate || ts.privateMode || "Private" : capsuleEntries.filter((entry) => entry.tags.includes("portal-focus")).length}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {visibleCapsuleEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-disabled={privateMode || undefined}
                  onClick={() => {
                    if (privateMode) return;
                    onOpenEntry(entry.id);
                  }}
                  className={cn(
                    "flex min-h-[52px] w-full items-start justify-between gap-3 rounded-2xl border border-border/20 bg-background/50 px-3 py-3 text-start",
                    privateMode && "cursor-default",
                  )}
                  data-testid="memory-portal-capsule-entry"
                >
                  <span className="min-w-0">
                    <span className="block whitespace-normal break-words text-sm font-bold text-foreground">
                      {privateMode ? ts.journalHubSpacePrivate || "Private" : entry.title || ts.journalEntryTitle || "Untitled"}
                    </span>
                    {!privateMode && getVisibleJournalTags(entry.tags).length > 0 ? (
                      <span className="block whitespace-normal [overflow-wrap:anywhere] text-xs text-muted-foreground">
                        {getVisibleJournalTags(entry.tags).slice(0, 3).join(" ")}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:scale-x-[-1]" aria-hidden="true" />
                </button>
              ))}
              {capsuleEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/25 px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {ts.journalQuietDay || "This day is still quiet"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ts.journalQuietDayHint || "Add one line and the map will remember it."}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => startEntry("write")}
                className="min-h-[44px] whitespace-normal break-words rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                {ts.journalNewEntry || "Write"}
              </button>
              <button
                type="button"
                onClick={() => onNewEntryWithPrefill({ date: activeDate, tags: ["day-capsule"] })}
                className="min-h-[44px] whitespace-normal break-words rounded-full border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary"
              >
                {ts.journalAdd || "Add"}
              </button>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {showList ? (
        <div className="relative z-[1] mt-4 pb-[calc(1.5rem+var(--memory-portal-nav-reserve))]">
          {beforeList}
          {entries.length > 0 ? <OnThisDayCard entries={entries} onOpenEntry={onOpenEntry} onDismiss={() => {}}  privateMode={privateMode} /> : null}
          {listTotalCount > 0 || loading ? (
            <JournalEntryList
              groupedEntries={groupedEntries}
              allEntries={entries}
              onOpenEntry={onOpenEntry}
              onDeleteEntry={onDeleteEntry}
              onSwipeDelete={onSwipeDelete}
              onNewEntry={onNewEntry}
              totalCount={listTotalCount}
              loading={loading}
              daysSinceLastEntry={daysSinceLastEntry}
              privateMode={privateMode}
              onAddGratitude={onAddGratitude}
              releaseTraceSummaries={releaseTraceSummaries}
              onReleaseThought={onReleaseThought}
              showFab={false}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
