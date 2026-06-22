import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Image,
  ListChecks,
  PanelBottomOpen,
  PenLine,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sprout,
  Target,
  Timer,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PremiumLoader } from "@/components/PremiumLoader";
import { cn, getToday } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { shouldAnimate } from "@/lib/animationUtils";
import type { GratitudeEntry } from "@/types";
import { BurnThoughtWidget } from "./BurnThoughtWidget";
import { DiaryBreatheWidget } from "./DiaryBreatheWidget";
import { GratitudeBloomWidget } from "./GratitudeBloomWidget";
import { JournalEntryList } from "./JournalEntryList";
import { JournalTemplatePicker } from "./JournalTemplatePicker";
import { getJournalIcon } from "./journalHubIcons";
import {
  DEFAULT_JOURNAL_HUB_PREFERENCES,
  createJournalPracticeSession,
  getJournalHubPreferences,
  getJournalSpaces,
  saveJournalHubPreferences,
} from "./journalHubStorage";
import type {
  JournalEntry,
  JournalEntryPrefill,
  JournalHubAction,
  JournalHubBackground,
  JournalHubDensity,
  JournalHubMotion,
  JournalHubPreferences,
  JournalHubView,
  JournalSpace,
} from "./types";

type EntryGroup = { label: string; key: string; entries: JournalEntry[] };

interface JournalHubShellProps {
  ts: Record<string, string>;
  groupedEntries: EntryGroup[];
  allEntries: JournalEntry[];
  totalCount: number;
  loading: boolean;
  daysSinceLastEntry?: number | null;
  privateMode?: boolean;
  beforeList?: ReactNode;
  onOpenEntry: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onSwipeDelete?: (id: string) => void;
  onNewEntry: () => void;
  onNewEntryWithPrefill: (prefill: JournalEntryPrefill) => void;
  onAddGratitude?: (entry: GratitudeEntry) => void;
  onReleaseThought?: () => void | Promise<void>;
  onOpenStats: () => void;
}

const VIEW_META: Record<
  JournalHubView,
  { labelKey: string; fallback: string; icon: LucideIcon }
> = {
  today: { labelKey: "journalHubToday", fallback: "Today", icon: Sparkles },
  entries: { labelKey: "journalHubEntries", fallback: "Entries", icon: BookOpen },
  spaces: { labelKey: "journalHubSpaces", fallback: "Spaces", icon: PanelBottomOpen },
  practices: { labelKey: "journalHubPractices", fallback: "Practices", icon: Timer },
  library: { labelKey: "journalHubLibrary", fallback: "Library", icon: ListChecks },
};

const ACTION_META: Record<
  JournalHubAction,
  { labelKey: string; fallback: string; icon: LucideIcon }
> = {
  write: { labelKey: "journalHubActionWrite", fallback: "Write", icon: PenLine },
  quickNote: { labelKey: "journalHubActionQuickNote", fallback: "Quick note", icon: Sparkles },
  photo: { labelKey: "journalHubActionPhoto", fallback: "Photo note", icon: Image },
  gratitude: { labelKey: "journalHubActionGratitude", fallback: "Gratitude", icon: Sprout },
  resetThought: { labelKey: "journalHubActionResetThought", fallback: "Release thought", icon: Sparkles },
  focusNote: { labelKey: "journalHubActionFocusNote", fallback: "Focus note", icon: Timer },
  template: { labelKey: "journalHubActionTemplate", fallback: "Template", icon: ListChecks },
};

const DENSITY_OPTIONS: JournalHubDensity[] = ["compact", "balanced", "calm"];
const MOTION_OPTIONS: JournalHubMotion[] = ["system", "quiet", "expressive"];
const BACKGROUND_OPTIONS: JournalHubBackground[] = ["clean", "grain", "depth"];

function label(ts: Record<string, string>, key: string, fallback: string): string {
  return ts[key] || fallback;
}

function getSpaceDisplayName(
  ts: Record<string, string>,
  space: JournalSpace,
  privateMode: boolean,
): string {
  if (privateMode) {
    return label(ts, "journalHubSpacePrivate", label(ts, "privateMode", "Private"));
  }
  return space.name || (space.nameKey ? label(ts, space.nameKey, space.id) : space.id);
}

function getSpaceDescription(
  ts: Record<string, string>,
  space: JournalSpace,
  privateMode: boolean,
): string {
  if (privateMode) return "";
  return space.descriptionKey ? label(ts, space.descriptionKey, "") : "";
}

export function JournalHubShell({
  ts,
  groupedEntries,
  allEntries,
  totalCount,
  loading,
  daysSinceLastEntry,
  privateMode = false,
  beforeList,
  onOpenEntry,
  onDeleteEntry,
  onSwipeDelete,
  onNewEntry,
  onNewEntryWithPrefill,
  onAddGratitude,
  onReleaseThought,
  onOpenStats,
}: JournalHubShellProps) {
  const reducedMotion = useReducedMotion();
  const [preferences, setPreferences] = useState<JournalHubPreferences>(
    DEFAULT_JOURNAL_HUB_PREFERENCES,
  );
  const [spaces, setSpaces] = useState<JournalSpace[]>([]);
  const [activeView, setActiveView] = useState<JournalHubView>("today");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [practiceScene, setPracticeScene] = useState<"gratitude" | "resetThought" | "focusNote" | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const animate = shouldAnimate() && !reducedMotion && preferences.motion !== "quiet";
  const today = getToday();
  const todayEntries = useMemo(() => allEntries.filter((entry) => entry.date === today), [allEntries, today]);
  const recentEntry = allEntries[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getJournalHubPreferences(), getJournalSpaces()]).then(([prefs, loadedSpaces]) => {
      if (cancelled) return;
      setPreferences(prefs);
      setActiveView(prefs.homeView);
      setSpaces(loadedSpaces);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePreferences = useCallback(async (patch: Partial<Omit<JournalHubPreferences, "id" | "updatedAt">>) => {
    const next = await saveJournalHubPreferences(patch);
    setPreferences(next);
    if (!next.visibleViews.includes(activeView)) {
      setActiveView(next.visibleViews[0] ?? "today");
    }
  }, [activeView]);

  const closeTransientPanels = useCallback(() => {
    setCaptureOpen(false);
    setPracticeScene(null);
    setTemplatePickerOpen(false);
  }, []);

  useEffect(() => {
    if (!captureOpen && !practiceScene && !customizing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (customizing) {
        setCustomizing(false);
        return;
      }
      closeTransientPanels();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [captureOpen, closeTransientPanels, customizing, practiceScene]);

  const startPrefilledEntry = useCallback(
    (prefill: JournalEntryPrefill) => {
      closeTransientPanels();
      onNewEntryWithPrefill(prefill);
    },
    [closeTransientPanels, onNewEntryWithPrefill],
  );

  const runAction = useCallback(
    async (action: JournalHubAction) => {
      void haptics.light();
      if (action === "write") {
        closeTransientPanels();
        onNewEntry();
        return;
      }
      if (action === "quickNote") {
        startPrefilledEntry({
          title: label(ts, "journalHubQuickNoteTitle", "Quick note"),
          content: "",
          tags: ["quick-note"],
        });
        return;
      }
      if (action === "photo") {
        startPrefilledEntry({
          title: label(ts, "journalHubPhotoNoteTitle", "Photo note"),
          content: label(ts, "journalHubPhotoNotePrompt", "Add the image, then write what this moment means."),
          tags: ["photo-note"],
        });
        return;
      }
      if (action === "gratitude") {
        setCaptureOpen(false);
        setTemplatePickerOpen(false);
        setPracticeScene("gratitude");
        return;
      }
      if (action === "resetThought") {
        setCaptureOpen(false);
        setTemplatePickerOpen(false);
        setPracticeScene("resetThought");
        return;
      }
      if (action === "focusNote") {
        setCaptureOpen(false);
        setTemplatePickerOpen(false);
        setPracticeScene("focusNote");
        return;
      }
      setCaptureOpen(false);
      setTemplatePickerOpen(true);
    },
    [closeTransientPanels, onNewEntry, startPrefilledEntry, ts],
  );

  const startFocusEntry = useCallback(async () => {
    await createJournalPracticeSession({ practiceId: "focus-note", durationSeconds: 180 });
    startPrefilledEntry({
      title: label(ts, "journalHubFocusNoteTitle", "Focus note"),
      content: label(ts, "journalHubFocusNotePrompt", "What needs your clean attention right now?"),
      tags: ["focus"],
    });
  }, [startPrefilledEntry, ts]);

  const changeView = useCallback((view: JournalHubView) => {
    setActiveView(view);
    setCaptureOpen(false);
    setPracticeScene(null);
    void haptics.light();
  }, []);

  if (loading) {
    return (
      <div
        className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 px-6 text-center"
        data-testid="journal-hub-loading"
      >
        <PremiumLoader size="md" label={label(ts, "loading", "Loading")} />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {label(ts, "journalHubLoading", "Preparing your space")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {label(ts, "journalHubLoadingHint", "Your notes, spaces, and practices are coming into focus.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden",
        preferences.background === "depth" && "bg-gradient-to-b from-primary/5 via-transparent to-background",
        preferences.background === "grain" && "bg-muted/20",
      )}
      data-testid="journal-hub-shell"
      data-density={preferences.density}
      data-motion={preferences.motion}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {label(ts, "journalHubEyebrow", "ZenFlow Hub")}
            </p>
            <h3 className="truncate text-xl font-bold text-foreground">
              {label(ts, VIEW_META[activeView].labelKey, VIEW_META[activeView].fallback)}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setCustomizing(true)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-border/40 bg-card/80 text-muted-foreground shadow-sm backdrop-blur-xl motion-safe:transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={label(ts, "journalHubCustomize", "Customize hub")}
            data-testid="journal-hub-customize"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={animate ? { opacity: 0, y: 10 } : { opacity: 1 }}
            animate={{ opacity: 1, y: 0 }}
            exit={animate ? { opacity: 0, y: -8 } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {activeView === "today" && (
              <TodayView
                ts={ts}
                todayCount={todayEntries.length}
                totalCount={totalCount}
                recentEntry={recentEntry}
                privateMode={privateMode}
                onOpenRecent={() => recentEntry && onOpenEntry(recentEntry.id)}
                onAction={runAction}
                onOpenStats={onOpenStats}
                spaces={spaces}
              />
            )}

            {activeView === "entries" && (
              <div className="space-y-3" data-testid="journal-hub-entries">
                {beforeList}
                <JournalEntryList
                  groupedEntries={groupedEntries}
                  allEntries={allEntries}
                  onOpenEntry={onOpenEntry}
                  onDeleteEntry={onDeleteEntry}
                  onSwipeDelete={onSwipeDelete}
                  onNewEntry={onNewEntry}
                  totalCount={totalCount}
                  loading={false}
                  daysSinceLastEntry={daysSinceLastEntry}
                  privateMode={privateMode}
                  onAddGratitude={onAddGratitude}
                  showFab={false}
                />
              </div>
            )}

            {activeView === "spaces" && <SpacesView ts={ts} spaces={spaces} privateMode={privateMode} onAction={runAction} />}
            {activeView === "practices" && <PracticesView ts={ts} onAction={runAction} />}
            {activeView === "library" && (
              <LibraryView ts={ts} onAction={runAction} onSearchEntries={() => changeView("entries")} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {practiceScene && (
          <PracticeScene
            ts={ts}
            scene={practiceScene}
            animate={animate}
            onClose={() => setPracticeScene(null)}
            onAddGratitude={onAddGratitude}
            onFallbackGratitude={(entry) => {
              startPrefilledEntry({
                title: label(ts, "journalHubPracticeGratitude", "Gratitude"),
                content: entry.text,
                tags: ["gratitude"],
              });
            }}
            onStartFocus={startFocusEntry}
            onReleaseThought={onReleaseThought}
          />
        )}
      </AnimatePresence>

      <CaptureFan
        ts={ts}
        open={captureOpen}
        actions={preferences.dockActions}
        onToggle={() => setCaptureOpen((value) => !value)}
        onRunAction={runAction}
      />

      <HubDock
        ts={ts}
        activeView={activeView}
        visibleViews={preferences.visibleViews}
        collapsed={dockCollapsed}
        onViewChange={changeView}
        onCollapseChange={setDockCollapsed}
      />

      <AnimatePresence>
        {customizing && (
          <CustomizationSheet
            ts={ts}
            preferences={preferences}
            onClose={() => setCustomizing(false)}
            onChange={updatePreferences}
          />
        )}
      </AnimatePresence>

      {templatePickerOpen && (
        <JournalTemplatePicker
          onClose={() => setTemplatePickerOpen(false)}
          onSelect={(content, templateId) => {
            setTemplatePickerOpen(false);
            startPrefilledEntry({
              title: "",
              content,
              tags: templateId ? ["template"] : [],
            });
          }}
        />
      )}
    </section>
  );
}

function PracticeScene({
  ts,
  scene,
  animate,
  onClose,
  onAddGratitude,
  onFallbackGratitude,
  onStartFocus,
  onReleaseThought,
}: {
  ts: Record<string, string>;
  scene: "gratitude" | "resetThought" | "focusNote";
  animate: boolean;
  onClose: () => void;
  onAddGratitude?: (entry: GratitudeEntry) => void;
  onFallbackGratitude: (entry: GratitudeEntry) => void;
  onStartFocus: () => void;
  onReleaseThought?: () => void | Promise<void>;
}) {
  const sceneMeta = {
    gratitude: {
      icon: Sprout,
      title: label(ts, "journalHubPracticeGratitude", "Gratitude"),
      subtitle: label(ts, "journalHubPracticeGratitudeDesc", "Save one small thing that was worth noticing."),
    },
    resetThought: {
      icon: Sparkles,
      title: label(ts, "journalHubPracticeReset", "Release thought"),
      subtitle: label(ts, "journalHubPracticeResetDesc", "Unload a heavy loop without keeping it in history."),
    },
    focusNote: {
      icon: Target,
      title: label(ts, "journalHubPracticeFocus", "Focus note"),
      subtitle: label(ts, "journalHubPracticeFocusDesc", "Clarify one thing that needs attention."),
    },
  } satisfies Record<typeof scene, { icon: LucideIcon; title: string; subtitle: string }>;
  const Icon = sceneMeta[scene].icon;

  return (
    <motion.div
      className="absolute inset-0 z-[62] flex flex-col bg-background/95 backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]"
      initial={animate ? { opacity: 0 } : { opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={animate ? { opacity: 0 } : { opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={sceneMeta[scene].title}
      data-testid={`journal-hub-practice-scene-${scene}`}
    >
      <header className="shrink-0 border-b border-border/25 px-4 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="flex min-h-[52px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-foreground">{sceneMeta[scene].title}</h3>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {sceneMeta[scene].subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={label(ts, "close", "Close")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {scene === "gratitude" && (
          <GratitudeBloomWidget
            onClose={onClose}
            onPlant={(entry) => {
              if (onAddGratitude) {
                onAddGratitude(entry);
              } else {
                onFallbackGratitude(entry);
              }
            }}
            surfaceClassName="my-0 !border-primary/15 !bg-background/90"
          />
        )}
        {scene === "resetThought" && (
          <BurnThoughtWidget
            onClose={onClose}
            onReleased={onReleaseThought}
            surfaceClassName="my-0 !border-primary/15 !bg-background/90"
          />
        )}
        {scene === "focusNote" && (
          <FocusPracticeStage ts={ts} animate={animate} onClose={onClose} onStartFocus={onStartFocus} />
        )}
      </div>
    </motion.div>
  );
}

function FocusPracticeStage({
  ts,
  animate,
  onClose,
  onStartFocus,
}: {
  ts: Record<string, string>;
  animate: boolean;
  onClose: () => void;
  onStartFocus: () => void;
}) {
  const start = () => {
    void haptics.medium();
    onStartFocus();
    onClose();
  };

  return (
    <div className="rounded-[1.5rem] border border-primary/15 bg-card/80 p-5 shadow-[0_20px_70px_hsl(var(--primary)/0.12)]">
      <div className="mx-auto flex max-w-[21rem] flex-col items-center text-center">
        <div className="relative mb-3 flex h-44 w-full items-center justify-center overflow-hidden rounded-[1.5rem] border border-border/25 bg-background/70">
          <div className="absolute inset-x-10 top-1/2 h-px bg-primary/20" aria-hidden="true" />
          <motion.div
            className="absolute h-28 w-28 rounded-full border border-primary/20"
            animate={animate ? { scale: [0.92, 1.16, 0.92], opacity: [0.32, 0.72, 0.32] } : { opacity: 0.42 }}
            transition={animate ? { duration: 6, repeat: Infinity, ease: "easeInOut" } : undefined}
            aria-hidden="true"
          />
          <motion.div
            className="absolute h-20 w-20 rounded-full border border-primary/25"
            animate={animate ? { scale: [1.1, 0.88, 1.1], opacity: [0.22, 0.55, 0.22] } : { opacity: 0.32 }}
            transition={animate ? { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.8 } : undefined}
            aria-hidden="true"
          />
          <DiaryBreatheWidget animate={animate} />
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border/35 bg-background/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
          <Wind className="h-4 w-4 text-primary" aria-hidden="true" />
          {label(ts, "journalHubFocusBreathCue", "Breathe first, then write one clean note.")}
        </div>

        <h4 className="mt-5 text-2xl font-bold text-foreground">
          {label(ts, "journalHubFocusStageTitle", "One thing. Three minutes.")}
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {label(ts, "journalHubFocusStageDesc", "Let the breath animation narrow the field, then open a focused entry with the right prompt already prepared.")}
        </p>

        <button
          type="button"
          onClick={start}
          className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_16px_36px_hsl(var(--primary)/0.26)] motion-safe:transition-transform active:scale-[0.98]"
        >
          <PenLine className="h-4 w-4" aria-hidden="true" />
          {label(ts, "journalHubFocusStartWriting", "Start focus note")}
        </button>
      </div>
    </div>
  );
}

function TodayView({
  ts,
  todayCount,
  totalCount,
  recentEntry,
  privateMode,
  spaces,
  onOpenRecent,
  onAction,
  onOpenStats,
}: {
  ts: Record<string, string>;
  todayCount: number;
  totalCount: number;
  recentEntry: JournalEntry | null;
  privateMode: boolean;
  spaces: JournalSpace[];
  onOpenRecent: () => void;
  onAction: (action: JournalHubAction) => void;
  onOpenStats: () => void;
}) {
  const privateEntryLabel = label(ts, "journalPrivateEntry", label(ts, "privateMode", "Private entry"));
  const privateMetricLabel = label(ts, "privateMode", "Private");
  const todayStatusLabel = privateMode
    ? privateMetricLabel
    : todayCount > 0
      ? label(ts, "journalHubTodayCaptured", "Captured")
      : label(ts, "journalHubTodayReady", "Ready");
  const todayMetricValue = privateMode ? privateMetricLabel : String(todayCount);
  const totalMetricValue = privateMode ? privateMetricLabel : String(totalCount);
  const visibleSpaces = privateMode ? spaces.slice(0, 1) : spaces.slice(0, 4);

  return (
    <div className="space-y-3" data-testid="journal-hub-today">
      <div className="rounded-[1.25rem] border border-primary/15 bg-card/85 p-4 shadow-sm backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-primary">
              {label(ts, "journalHubTodayCard", "Your day")}
            </p>
            <h4 className="mt-1 text-2xl font-bold text-foreground">
              {todayStatusLabel}
            </h4>
          </div>
          <span className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-2xl bg-primary/10 px-3 text-sm font-bold text-primary">
            {todayMetricValue}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onAction("write")}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-3 text-sm font-semibold shadow-sm"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            {label(ts, "journalHubActionWrite", "Write")}
          </button>
          <button
            type="button"
            onClick={() => onAction("quickNote")}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-border/40 bg-background/70 px-3 text-sm font-semibold text-foreground"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {label(ts, "journalHubActionQuickNote", "Quick note")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MetricCard label={label(ts, "journalHubMetricEntries", "Entries")} value={totalMetricValue} />
        <MetricCard label={label(ts, "journalHubMetricToday", "Today")} value={todayMetricValue} />
        <button
          type="button"
          onClick={onOpenStats}
          className="min-h-[64px] rounded-2xl border border-border/35 bg-card/70 px-2 text-center text-xs font-semibold text-foreground"
        >
          {label(ts, "journalStatsTitle", "Stats")}
        </button>
      </div>

      {recentEntry && (
        <button
          type="button"
          aria-disabled={privateMode || undefined}
          onClick={() => {
            if (privateMode) return;
            onOpenRecent();
          }}
          className={cn(
            "flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border border-border/35 bg-card/70 px-4 text-start",
            privateMode && "cursor-default",
          )}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {label(ts, "journalHubContinue", "Continue")}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {privateMode ? privateEntryLabel : recentEntry.title || label(ts, "journalTemplateBlank", "Blank Entry")}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:scale-x-[-1]" aria-hidden="true" />
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        {visibleSpaces.map((space) => {
          const SpaceIcon = privateMode ? PanelBottomOpen : getJournalIcon(space.iconKey);
          const spaceName = getSpaceDisplayName(ts, space, privateMode);
          const spaceDescription = getSpaceDescription(ts, space, privateMode);
          return (
            <div
              key={space.id}
              className="min-h-[82px] rounded-2xl border border-border/30 bg-card/60 p-3"
            >
              <SpaceIcon className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
              <p className="truncate text-sm font-semibold text-foreground">
                {spaceName}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                {spaceDescription}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label: labelText, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[64px] rounded-2xl border border-border/35 bg-card/70 px-2 py-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {labelText}
      </p>
    </div>
  );
}

function SpacesView({
  ts,
  spaces,
  privateMode,
  onAction,
}: {
  ts: Record<string, string>;
  spaces: JournalSpace[];
  privateMode: boolean;
  onAction: (action: JournalHubAction) => void;
}) {
  const visibleSpaces = privateMode ? spaces.slice(0, 1) : spaces;

  return (
    <div className="space-y-3" data-testid="journal-hub-spaces">
      <SectionIntro
        icon={PanelBottomOpen}
        title={label(ts, "journalHubSpaces", "Spaces")}
        description={label(ts, "journalHubSpacesDesc", "Collect projects, life areas, and private notes without losing the day.")}
      />
      <div className="grid grid-cols-2 gap-2">
        {visibleSpaces.map((space) => {
          const SpaceIcon = privateMode ? PanelBottomOpen : getJournalIcon(space.iconKey);
          const spaceName = getSpaceDisplayName(ts, space, privateMode);
          const spaceDescription = getSpaceDescription(ts, space, privateMode);
          return (
            <button
              key={space.id}
              type="button"
              onClick={() => onAction(privateMode ? "write" : space.pinnedAction ?? "write")}
              className="min-h-[118px] rounded-2xl border border-border/35 bg-card/75 p-3 text-start shadow-sm motion-safe:transition-transform active:scale-[0.98]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                <SpaceIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 truncate text-sm font-bold text-foreground">
                {spaceName}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                {spaceDescription}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PracticesView({
  ts,
  onAction,
}: {
  ts: Record<string, string>;
  onAction: (action: JournalHubAction) => void;
}) {
  const secondaryPractices: Array<{ action: JournalHubAction; titleKey: string; fallback: string; descKey: string; desc: string; icon: LucideIcon }> = [
    {
      action: "focusNote",
      titleKey: "journalHubPracticeFocus",
      fallback: "Focus",
      descKey: "journalHubPracticeFocusDesc",
      desc: "Breathe, narrow the field, then write.",
      icon: Target,
    },
    {
      action: "resetThought",
      titleKey: "journalHubPracticeReset",
      fallback: "Release thought",
      descKey: "journalHubPracticeResetDesc",
      desc: "Release a loop without saving it.",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-3" data-testid="journal-hub-practices">
      <button
        type="button"
        onClick={() => onAction("gratitude")}
        aria-label={label(ts, "journalHubPracticeGratitude", "Gratitude")}
        className="group relative min-h-[176px] w-full overflow-hidden rounded-[1.5rem] border border-primary/20 bg-card/90 p-4 text-start shadow-[0_22px_70px_hsl(var(--primary)/0.1)]"
        data-testid="journal-hub-practice-gratitude"
      >
        <div className="absolute end-5 top-5 h-24 w-24 rounded-full border border-primary/10" aria-hidden="true" />
        <div className="absolute end-10 top-10 h-14 w-14 rounded-full border border-primary/15" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between gap-6">
          <div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sprout className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-primary">
              {label(ts, "journalHubPracticeStudio", "Practice studio")}
            </p>
            <h4 className="mt-1 text-2xl font-bold leading-tight text-foreground">
              {label(ts, "journalHubPracticeGratitude", "Gratitude")}
            </h4>
            <p className="mt-2 max-w-[15rem] text-sm leading-relaxed text-muted-foreground">
              {label(ts, "journalHubPracticeGratitudeDesc", "Save one small thing that was worth noticing.")}
            </p>
          </div>
          <span className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground motion-safe:transition-transform group-active:scale-[0.98]">
            {label(ts, "journalHubPracticeOpen", "Open scene")}
            <ChevronRight className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
          </span>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2">
        {secondaryPractices.map((practice) => (
          <button
            key={practice.action}
            type="button"
            onClick={() => onAction(practice.action)}
            aria-label={label(ts, practice.titleKey, practice.fallback)}
            className="group flex min-h-[142px] flex-col justify-between rounded-[1.25rem] border border-border/35 bg-card/75 p-3 text-start shadow-sm motion-safe:transition-transform active:scale-[0.99]"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <practice.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold leading-tight text-foreground">
                {label(ts, practice.titleKey, practice.fallback)}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {label(ts, practice.descKey, practice.desc)}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-[1.25rem] border border-border/30 bg-background/55 p-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Wind className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              {label(ts, "journalHubPractices", "Practices")}
            </p>
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {label(ts, "journalHubPracticesDesc", "Short, practical resets for attention, emotion, and writing.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LibraryView({
  ts,
  onAction,
  onSearchEntries,
}: {
  ts: Record<string, string>;
  onAction: (action: JournalHubAction) => void;
  onSearchEntries: () => void;
}) {
  return (
    <div className="space-y-3" data-testid="journal-hub-library">
      <SectionIntro
        icon={ListChecks}
        title={label(ts, "journalHubLibrary", "Library")}
        description={label(ts, "journalHubLibraryDesc", "Reusable writing structures, prompts, and search live here.")}
      />
      <button
        type="button"
        onClick={() => onAction("template")}
        className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-border/35 bg-card/75 p-3 text-start"
      >
        <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="flex-1">
          <span className="block text-sm font-bold text-foreground">
            {label(ts, "journalTemplates", "Templates")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {label(ts, "journalHubTemplatesDesc", "Start with a structure, then make it yours.")}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onSearchEntries}
        className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-border/35 bg-card/75 p-3 text-start"
      >
        <Search className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="flex-1">
          <span className="block text-sm font-bold text-foreground">
            {label(ts, "journalHubSearchArchive", "Search archive")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {label(ts, "journalHubSearchArchiveDesc", "Find older thoughts, tags, and moments.")}
          </span>
        </span>
      </button>
    </div>
  );
}

function SectionIntro({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-primary/15 bg-card/80 p-4">
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      <h4 className="mt-3 text-lg font-bold text-foreground">{title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function CaptureFan({
  ts,
  open,
  actions,
  onToggle,
  onRunAction,
}: {
  ts: Record<string, string>;
  open: boolean;
  actions: JournalHubAction[];
  onToggle: () => void;
  onRunAction: (action: JournalHubAction) => void;
}) {
  const actionList = actions.slice(0, 5);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute inset-0 z-[42] bg-background/45 backdrop-blur-sm [-webkit-backdrop-filter:blur(8px)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute bottom-[calc(8.75rem+env(safe-area-inset-bottom))] end-4 z-[48] flex flex-col items-end gap-2"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            {actionList.map((action) => {
              const meta = ACTION_META[action];
              const Icon = meta.icon;
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => onRunAction(action)}
                  className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-border/40 bg-card/95 px-3 text-sm font-semibold text-foreground shadow-lg backdrop-blur-xl"
                  data-testid={`journal-hub-capture-action-${action}`}
                >
                  <span>{label(ts, meta.labelKey, meta.fallback)}</span>
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={onToggle}
        className="absolute bottom-[calc(5.35rem+env(safe-area-inset-bottom))] end-4 z-[50] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_30px_hsl(var(--primary)/0.28)] motion-safe:transition-transform active:scale-95"
        aria-label={open ? label(ts, "close", "Close") : label(ts, "journalHubCapture", "Capture")}
        aria-expanded={open}
        data-testid="journal-hub-capture"
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.18 }}>
          <Plus className="h-6 w-6" aria-hidden="true" />
        </motion.span>
      </button>
    </>
  );
}

function HubDock({
  ts,
  activeView,
  visibleViews,
  collapsed,
  onViewChange,
  onCollapseChange,
}: {
  ts: Record<string, string>;
  activeView: JournalHubView;
  visibleViews: JournalHubView[];
  collapsed: boolean;
  onViewChange: (view: JournalHubView) => void;
  onCollapseChange: (collapsed: boolean) => void;
}) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onCollapseChange(false)}
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] start-1/2 z-[50] flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full border border-border/40 bg-card/95 px-4 text-xs font-semibold text-foreground shadow-lg backdrop-blur-xl"
        aria-label={label(ts, "journalHubShowDock", "Show navigation")}
        data-testid="journal-hub-dock-collapsed"
      >
        <PanelBottomOpen className="h-4 w-4 text-primary" aria-hidden="true" />
        {label(ts, "journalHubShowDock", "Show")}
      </button>
    );
  }

  return (
    <nav
      className="absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[49] rounded-[1.5rem] border border-border/45 bg-card/95 p-1.5 shadow-xl backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]"
      aria-label={label(ts, "journalHubNav", "Diary hub navigation")}
      data-testid="journal-hub-dock"
    >
      <button
        type="button"
        onClick={() => onCollapseChange(true)}
        className="absolute -top-5 start-1/2 inline-flex min-h-[44px] min-w-[72px] -translate-x-1/2 items-start justify-center rounded-2xl pt-3 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={label(ts, "journalHubHideDock", "Hide navigation")}
      >
        <span className="h-1 w-9 rounded-full bg-muted-foreground/30" aria-hidden="true" />
      </button>
      <div className="grid grid-cols-5 gap-1">
        {visibleViews.slice(0, 5).map((view) => {
          const meta = VIEW_META[view];
          const Icon = meta.icon;
          const selected = activeView === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => onViewChange(view)}
              className={cn(
                "flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[9px] font-semibold leading-none motion-safe:transition-colors",
                selected ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={selected ? "page" : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-full truncate">{label(ts, meta.labelKey, meta.fallback)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function CustomizationSheet({
  ts,
  preferences,
  onClose,
  onChange,
}: {
  ts: Record<string, string>;
  preferences: JournalHubPreferences;
  onClose: () => void;
  onChange: (patch: Partial<Omit<JournalHubPreferences, "id" | "updatedAt">>) => Promise<void>;
}) {
  const moveView = (view: JournalHubView, direction: -1 | 1) => {
    const views = [...preferences.visibleViews];
    const index = views.indexOf(view);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= views.length) return;
    [views[index], views[nextIndex]] = [views[nextIndex], views[index]];
    void onChange({ visibleViews: views });
  };

  const toggleView = (view: JournalHubView) => {
    const visible = preferences.visibleViews.includes(view);
    const next = visible
      ? preferences.visibleViews.filter((item) => item !== view)
      : [...preferences.visibleViews, view];
    if (next.length < 3) return;
    void onChange({ visibleViews: next, homeView: next.includes(preferences.homeView) ? preferences.homeView : next[0] });
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[64] bg-background/55 backdrop-blur-sm [-webkit-backdrop-filter:blur(8px)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label(ts, "journalHubCustomize", "Customize hub")}
        className="fixed inset-x-0 bottom-0 z-[65] max-h-[82dvh] overflow-hidden rounded-t-[1.5rem] border-t border-border/45 bg-card shadow-2xl"
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 28, opacity: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className="flex justify-center px-4 pb-1 pt-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
        </div>
        <header className="flex items-center justify-between gap-3 border-b border-border/25 px-4 pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {label(ts, "journalHubCustomize", "Customize hub")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {label(ts, "journalHubCustomizeHint", "Choose what your diary opens into.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={label(ts, "close", "Close")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="max-h-[calc(82dvh-5rem)] space-y-4 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <CustomizeGroup title={label(ts, "journalHubHomeView", "Home view")}>
            <div className="grid grid-cols-2 gap-2">
              {preferences.visibleViews.map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => void onChange({ homeView: view })}
                  className={cn(
                    "min-h-[44px] rounded-2xl border px-3 text-sm font-semibold",
                    preferences.homeView === view
                      ? "border-primary/30 bg-primary/12 text-primary"
                      : "border-border/35 bg-background/60 text-foreground",
                  )}
                >
                  {label(ts, VIEW_META[view].labelKey, VIEW_META[view].fallback)}
                </button>
              ))}
            </div>
          </CustomizeGroup>

          <CustomizeGroup title={label(ts, "journalHubVisibleTabs", "Visible tabs")}>
            <div className="space-y-2">
              {(Object.keys(VIEW_META) as JournalHubView[]).map((view) => {
                const visible = preferences.visibleViews.includes(view);
                return (
                  <div
                    key={view}
                    className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-border/35 bg-background/60 px-2"
                  >
                    <button
                      type="button"
                      onClick={() => toggleView(view)}
                      className={cn(
                        "flex min-h-[44px] flex-1 items-center gap-2 rounded-xl px-2 text-sm font-semibold",
                        visible ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full border", visible ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                        {visible && <Check className="h-3 w-3" aria-hidden="true" />}
                      </span>
                      {label(ts, VIEW_META[view].labelKey, VIEW_META[view].fallback)}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveView(view, -1)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
                      aria-label={label(ts, "journalHubMoveUp", "Move up")}
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveView(view, 1)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
                      aria-label={label(ts, "journalHubMoveDown", "Move down")}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </CustomizeGroup>

          <OptionGroup
            title={label(ts, "journalHubDensity", "Density")}
            values={DENSITY_OPTIONS}
            selected={preferences.density}
            getLabel={(value) => label(ts, `journalHubDensity${value}`, value)}
            onSelect={(density) => void onChange({ density })}
          />
          <OptionGroup
            title={label(ts, "journalHubMotion", "Motion")}
            values={MOTION_OPTIONS}
            selected={preferences.motion}
            getLabel={(value) => label(ts, `journalHubMotion${value}`, value)}
            onSelect={(motion) => void onChange({ motion })}
          />
          <OptionGroup
            title={label(ts, "journalHubBackground", "Background")}
            values={BACKGROUND_OPTIONS}
            selected={preferences.background}
            getLabel={(value) => label(ts, `journalHubBackground${value}`, value)}
            onSelect={(background) => void onChange({ background })}
          />
        </div>
      </motion.div>
    </>
  );
}

function CustomizeGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h4>
      {children}
    </section>
  );
}

function OptionGroup<T extends string>({
  title,
  values,
  selected,
  getLabel,
  onSelect,
}: {
  title: string;
  values: T[];
  selected: T;
  getLabel: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  return (
    <CustomizeGroup title={title}>
      <div className="grid grid-cols-3 gap-2">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={cn(
              "min-h-[44px] rounded-2xl border px-2 text-xs font-semibold capitalize",
              selected === value
                ? "border-primary/30 bg-primary/12 text-primary"
                : "border-border/35 bg-background/60 text-foreground",
            )}
          >
            {getLabel(value)}
          </button>
        ))}
      </div>
    </CustomizeGroup>
  );
}
