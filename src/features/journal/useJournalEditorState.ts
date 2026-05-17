import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { usePanicGesture } from "@/hooks/usePanicGesture";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { createFocusTrap, announceSuccess } from "@/lib/a11y";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import type { SaveState } from "./SaveIndicator";
import type {
  JournalEntry,
  JournalEntryPrefill,
  JournalPhoto,
  JournalAudio,
  DiaryThemeName,
  DiaryFontName,
  FontSizeName,
  PaperColor,
  BackgroundIntensity,
  ParticleSpeed,
  DiaryBgPattern,
  PaperTexture,
} from "./types";
import type { MoodType } from "@/types";
import { MAX_STICKERS_PER_ENTRY, MAX_AUDIO_PER_ENTRY, countWordsHtml, PAPER_COLORS } from "./types";
import { useJournalVoice } from "./useJournalVoice";
import { useAudioRecorder } from "./useAudioRecorder";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import {
  safeLocalStorageSet,
  safeJsonParse,
  storageGetRaw,
  storageSetRaw,
  storageRemove,
} from "@/lib/safeJson";
import { useDiaryTheme } from "./useDiaryTheme";
import { sanitizeRichContent } from "@/lib/sanitize";
import { getJournalEditorContent } from "./journalDisplay";
import { useThemeStore, type AppliedTheme } from "@/stores/themeStore";
import { settingsRepo } from "@/storage/db";

// ── Draft helpers (IndexedDB primary, localStorage fallback) ──

interface DraftData {
  title: string;
  date: string;
  content: string;
  stickers: string[];
  photoIds: string[];
  audioIds?: string[];
  mood?: MoodType;
  tags: string[];
  habitSnapshot?: {
    habitId: string;
    habitName: string;
    habitIcon: string;
    completed: boolean;
  }[];
  savedAt: number;
  // Customizations (optional for backward compat with old drafts)
  theme?: DiaryThemeName;
  font?: DiaryFontName;
  inkColor?: string;
  paperTexture?: PaperTexture;
  paperColor?: PaperColor;
  bgIntensity?: BackgroundIntensity;
  particleSpeed?: ParticleSpeed;
  bgPattern?: DiaryBgPattern;
  fontSize?: FontSizeName;
  photoLayout?: Record<string, { x: number; y: number; width: number }>;
}

function getDraftKey(entryId: string | null): string {
  return SK.journalDraft(entryId || "new");
}

async function saveDraft(key: string, data: DraftData) {
  try {
    await settingsRepo.put({ key, value: data });
  } catch {
    // Fallback to localStorage
    safeLocalStorageSet(key, data);
  }
}

async function loadDraft(key: string): Promise<DraftData | null> {
  try {
    const record = await settingsRepo.get(key);
    if (record?.value) {
      const data = record.value as DraftData;
      if (Date.now() - data.savedAt > 7 * 86400000) {
        await settingsRepo.delete(key);
        return null;
      }
      return data;
    }
    // Migrate from localStorage if exists
    const raw = storageGetRaw(key);
    if (raw) {
      const data = safeJsonParse<DraftData | null>(raw, null);
      if (!data) {
        storageRemove(key);
        return null;
      }
      if (Date.now() - data.savedAt > 7 * 86400000) {
        storageRemove(key);
        return null;
      }
      // Migrate to IndexedDB
      await settingsRepo.put({ key, value: data });
      storageRemove(key);
      return data;
    }
    return null;
  } catch {
    // Fallback to localStorage
    try {
      const raw = storageGetRaw(key);
      if (!raw) return null;
      const data = safeJsonParse<DraftData | null>(raw, null);
      if (!data) return null;
      if (Date.now() - data.savedAt > 7 * 86400000) {
        storageRemove(key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }
}

async function clearDraft(key: string) {
  try {
    await settingsRepo.delete(key);
  } catch {
    /* non-critical */
  }
  storageRemove(key);
}

interface EditorSnapshot {
  title: string;
  date: string;
  content: string;
  stickers: string;
  photoIds: string;
  audioIds: string;
  mood?: MoodType;
  tags: string;
  habitSnapshot: string;
  theme: DiaryThemeName;
  font: DiaryFontName;
  inkColor: string;
  paperTexture: PaperTexture;
  paperColor: PaperColor;
  bgIntensity: BackgroundIntensity;
  particleSpeed: ParticleSpeed;
  bgPattern: DiaryBgPattern;
  fontSize: FontSizeName;
  photoLayout: string;
}

function getDefaultEditorTheme(appliedTheme: AppliedTheme): Pick<
  EditorSnapshot,
  "theme" | "inkColor" | "paperColor" | "bgIntensity" | "particleSpeed"
> {
  if (appliedTheme === "paper") {
    return {
      theme: "light",
      inkColor: "#243936",
      paperColor: "milky",
      bgIntensity: "dim",
      particleSpeed: "slow",
    };
  }

  return {
    theme: "dark",
    inkColor: "#ffffff",
    paperColor: "dark",
    bgIntensity: "full",
    particleSpeed: "slow",
  };
}

function createEditorSnapshot(
  entry: JournalEntry | null,
  prefill: JournalEntryPrefill | null,
  appliedTheme: AppliedTheme = "ink",
): EditorSnapshot {
  const defaults = getDefaultEditorTheme(appliedTheme);
  return {
    title: entry?.title || prefill?.title || "",
    date: entry?.date || prefill?.date || getToday(),
    content: getJournalEditorContent(entry?.content || prefill?.content || ""),
    stickers: JSON.stringify(entry?.stickers || []),
    photoIds: JSON.stringify(entry?.photoIds || []),
    audioIds: JSON.stringify(entry?.audioIds || []),
    mood: entry?.mood || prefill?.mood,
    tags: JSON.stringify(entry?.tags || prefill?.tags || []),
    habitSnapshot: JSON.stringify(entry?.habitSnapshot || []),
    theme: entry?.theme || defaults.theme,
    font: entry?.font || "caveat",
    inkColor: entry?.inkColor || defaults.inkColor,
    paperTexture: entry?.paperTexture || "clean",
    paperColor: entry?.paperColor || defaults.paperColor,
    bgIntensity: entry?.bgIntensity || defaults.bgIntensity,
    particleSpeed: entry?.particleSpeed || defaults.particleSpeed,
    bgPattern: entry?.bgPattern || "none",
    fontSize: entry?.fontSize || "medium",
    photoLayout: JSON.stringify(entry?.photoLayout || {}),
  };
}

// ── Prompt constants ──

const DEFAULT_PROMPTS = [
  "What made you smile today?",
  "What challenged you today?",
  "What are you grateful for?",
  "Describe a moment that stood out today.",
  "What did you learn today?",
  "How are you feeling right now?",
  "What would you like to remember about today?",
  "What is something you accomplished?",
  "Write about someone who inspired you.",
  "What are your thoughts before sleep?",
];

const PROMPT_KEYS = [
  "journalPrompt1",
  "journalPrompt2",
  "journalPrompt3",
  "journalPrompt4",
  "journalPrompt5",
  "journalPrompt6",
  "journalPrompt7",
  "journalPrompt8",
  "journalPrompt9",
  "journalPrompt10",
];

// ── Props ──

export interface JournalEditorStateProps {
  entry: JournalEntry | null;
  entryPrefill?: JournalEntryPrefill | null;
  desktop?: boolean;
  onSave: (data: {
    title: string;
    content: string;
    stickers: string[];
    photoIds: string[];
    audioIds?: string[];
    mood?: MoodType;
    tags: string[];
    date?: string;
    habitSnapshot?: {
      habitId: string;
      habitName: string;
      habitIcon: string;
      completed: boolean;
    }[];
    theme?: DiaryThemeName;
    font?: DiaryFontName;
    inkColor?: string;
    paperTexture?: PaperTexture;
    paperColor?: PaperColor;
    bgIntensity?: BackgroundIntensity;
    particleSpeed?: ParticleSpeed;
    bgPattern?: DiaryBgPattern;
    fontSize?: FontSizeName;
    photoLayout?: Record<string, { x: number; y: number; width: number }>;
  }) => Promise<void>;
  onAddPhoto: (file: File, entryId: string) => Promise<JournalPhoto>;
  onRemovePhoto: (photoId: string, entryId: string) => Promise<void>;
  onAddAudio: (
    data: string,
    duration: number,
    mimeType: string,
    entryId: string
  ) => Promise<JournalAudio>;
  onRemoveAudio: (audioId: string, entryId: string) => Promise<void>;
  onDelete?: () => void;
  onBack: () => void;
  onToggleHabit?: (habitId: string, date: string) => void;
  onAddGratitude?: (entry: import("@/types").GratitudeEntry) => void;
}

// ── Hook ──

export function useJournalEditorState(props: JournalEditorStateProps) {
  const {
    entry,
    entryPrefill,
    desktop = false,
    onSave,
    onAddPhoto,
    onRemovePhoto,
    onAddAudio,
    onRemoveAudio,
    onBack,
  } = props;

  const { t, language } = useLanguage();
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  useScrollLock(!desktop);
  const ts = t as unknown as Record<string, string>;

  const prefill = !entry ? entryPrefill ?? null : null;
  const initialSnapshotRef = useRef(createEditorSnapshot(entry, prefill, appliedTheme));

  // === Refs ===
  const editorRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorOverlayRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollYRef = useRef(0);
  const contentRef = useRef(initialSnapshotRef.current.content);
  const contentSyncRef = useRef<ReturnType<typeof setTimeout>>();
  const lastScrollTopRef = useRef(0);
  const promptsDropdownRef = useRef<HTMLDivElement>(null);

  const draftKey = getDraftKey(entry?.id || null);

  // === Content State ===
  const [title, setTitle] = useState(initialSnapshotRef.current.title);
  const [date, setDate] = useState(initialSnapshotRef.current.date);
  const [content, setContent] = useState(initialSnapshotRef.current.content);
  const [stickers, setStickers] = useState<string[]>(entry?.stickers || []);
  const [photoIds, setPhotoIds] = useState<string[]>(entry?.photoIds || []);
  const [audioIds, setAudioIds] = useState<string[]>(entry?.audioIds || []);
  const [audioRecordings, setAudioRecordings] = useState<JournalAudio[]>([]);
  const [mood, setMood] = useState<MoodType | undefined>(initialSnapshotRef.current.mood);
  const [tags, setTags] = useState<string[]>(
    safeJsonParse<string[]>(initialSnapshotRef.current.tags, []),
  );
  const [habitSnapshot, setHabitSnapshot] = useState<
    {
      habitId: string;
      habitName: string;
      habitIcon: string;
      completed: boolean;
    }[]
  >(entry?.habitSnapshot || []);
  const [tagInput, setTagInput] = useState("");

  // === Save State (state machine replaces boolean) ===
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveStartRef = useRef(0);
  const MIN_SAVE_DISPLAY_MS = 400;

  // === Word Count Milestones ===
  const MILESTONES = useMemo(() => [100, 250, 500, 1000], []);
  const [milestoneTriggered, setMilestoneTriggered] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevWordCountRef = useRef<number | null>(null); // null = not initialized yet

  // === UI Panels State ===
  const [showStickers, setShowStickers] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showSettingsConfirm, setShowSettingsConfirm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showRecordingOverlay, setShowRecordingOverlay] = useState(false);
  const [showPromptsDropdown, setShowPromptsDropdown] = useState(false);

  // === Draft State ===
  const [draftAvailable, setDraftAvailable] = useState<DraftData | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState(0);

  // === Diary Premium Features ===
  const diaryTheme = useDiaryTheme(
    initialSnapshotRef.current.theme,
    initialSnapshotRef.current.font,
  );
  const [showStyleBar, setShowStyleBar] = useState(false);
  const [showBurnWidget, setShowBurnWidget] = useState(false);
  const [showGratitudeWidget, setShowGratitudeWidget] = useState(false);
  const [zenFocusActive, setZenFocusActive] = useState(false);
  const [, setShowActionSheet] = useState(false);
  const [, setToolbarHidden] = useState(false);

  // === Canvas/Atmosphere State ===
  const [bgIntensity, setBgIntensity] = useState<BackgroundIntensity>(
    initialSnapshotRef.current.bgIntensity,
  );
  const [particleSpeed, setParticleSpeed] = useState<ParticleSpeed>(
    initialSnapshotRef.current.particleSpeed,
  );
  const [inkColor, setInkColor] = useState(initialSnapshotRef.current.inkColor);
  const [paperTexture, setPaperTexture] = useState<PaperTexture>(
    initialSnapshotRef.current.paperTexture,
  );
  const [paperColor, setPaperColor] = useState<PaperColor>(
    initialSnapshotRef.current.paperColor,
  );
  const [bgPattern, setBgPattern] = useState<DiaryBgPattern>(entry?.bgPattern || "none");
  const [fontSize, setFontSize] = useState<FontSizeName>(entry?.fontSize || "medium");
  const [photoLayout, setPhotoLayout] = useState<
    Record<string, { x: number; y: number; width: number }>
  >(entry?.photoLayout || {});

  // === Widget State ===
  const [showBreathe, setShowBreathe] = useState(false);
  const [showHabits, setShowHabits] = useState(false);

  // === Privacy State ===
  const [privacyShieldActive, setPrivacyShieldActive] = useState(false);
  const [panicLocked, setPanicLocked] = useState(false);

  // === Format Hint ===
  const [formatHintDismissed, setFormatHintDismissed] = useState(
    () => !!storageGetRaw(SK.DIARY_FORMAT_HINT_SEEN)
  );

  // === Prompt State ===
  const [promptSeed, setPromptSeed] = useState(0);

  const paperColors = PAPER_COLORS[paperColor];
  const entryId = entry?.id || "__draft__";

  // === Panic gesture ===
  const handlePanic = useCallback(() => setPanicLocked(true), []);
  usePanicGesture(true, handlePanic);

  // === Voice dictation + audio recording hooks ===
  const voice = useJournalVoice(language);
  const recorder = useAudioRecorder();
  const { audioData, isRecording, duration, mimeType, reset: resetRecorder } = recorder;
  const wasListeningRef = useRef(false);

  // === Derived values ===
  const isDirty = useMemo(() => {
    const init = initialSnapshotRef.current;
    return (
      title !== init.title ||
      date !== init.date ||
      content !== init.content ||
      JSON.stringify(stickers) !== init.stickers ||
      JSON.stringify(photoIds) !== init.photoIds ||
      JSON.stringify(audioIds) !== init.audioIds ||
      mood !== init.mood ||
      JSON.stringify(tags) !== init.tags ||
      JSON.stringify(habitSnapshot) !== init.habitSnapshot ||
      diaryTheme.theme !== init.theme ||
      diaryTheme.font !== init.font ||
      inkColor !== init.inkColor ||
      paperTexture !== init.paperTexture ||
      paperColor !== init.paperColor ||
      bgIntensity !== init.bgIntensity ||
      particleSpeed !== init.particleSpeed ||
      bgPattern !== init.bgPattern ||
      fontSize !== init.fontSize ||
      JSON.stringify(photoLayout) !== init.photoLayout
    );
  }, [
    title,
    date,
    content,
    stickers,
    photoIds,
    audioIds,
    mood,
    tags,
    habitSnapshot,
    diaryTheme.theme,
    diaryTheme.font,
    inkColor,
    paperTexture,
    paperColor,
    bgIntensity,
    particleSpeed,
    bgPattern,
    fontSize,
    photoLayout,
  ]);

  const wordCount = useMemo(() => countWordsHtml(content), [content]);

  // === Milestone detection (fires only on upward crossing during editing) ===
  useEffect(() => {
    // Initialize prevWordCountRef on first render (prevents false milestone on load)
    if (prevWordCountRef.current === null) {
      prevWordCountRef.current = wordCount;
      return;
    }
    const prev = prevWordCountRef.current;
    for (const threshold of MILESTONES) {
      if (prev < threshold && wordCount >= threshold) {
        setMilestoneTriggered(threshold);
        void hapticTap();
        if (threshold === 1000) {
          setShowConfetti(true);
        }
        break; // Only fire the lowest newly-crossed milestone
      }
    }
    prevWordCountRef.current = wordCount;
  }, [wordCount, MILESTONES]);

  // Auto-clear milestone animation after 300ms
  useEffect(() => {
    if (milestoneTriggered === null) return;
    const timer = setTimeout(() => setMilestoneTriggered(null), 300);
    return () => clearTimeout(timer);
  }, [milestoneTriggered]);

  const onConfettiComplete = useCallback(() => setShowConfetti(false), []);

  const completedHabitCount = useMemo(
    () => habitSnapshot.filter((s) => s.completed).length,
    [habitSnapshot]
  );

  const randomPrompts = useMemo(() => {
    const prompts = PROMPT_KEYS.map((key, i) => ts[key] || DEFAULT_PROMPTS[i]);
    // Use seed to force re-shuffle
    void promptSeed;
    const shuffled = [...prompts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }, [promptSeed, ts]);

  const hasContent =
    content.trim() ||
    title.trim() ||
    stickers.length > 0 ||
    photoIds.length > 0 ||
    audioIds.length > 0 ||
    mood ||
    habitSnapshot.length > 0;

  // === Effects ===

  // Load draft on mount
  useEffect(() => {
    void loadDraft(draftKey)
      .then((draft) => {
        if (draft) {
          setDraftAvailable(draft);
          setShowTemplatePicker(false);
        }
      })
      .catch((err) => logger.warn("[Journal]", "Draft load failed:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: load draft on editor open
  }, []);

  // Auto-save draft (3s debounce)
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (
        title ||
        photoIds.length > 0 ||
        contentRef.current ||
        stickers.length > 0 ||
        mood ||
        tags.length > 0 ||
        audioIds.length > 0 ||
        habitSnapshot.length > 0
      ) {
        void saveDraft(draftKey, {
          title,
          date,
          content: contentRef.current,
          stickers,
          photoIds,
          audioIds,
          mood,
          tags,
          habitSnapshot,
          theme: diaryTheme.theme,
          font: diaryTheme.font,
          inkColor,
          paperTexture,
          paperColor,
          bgIntensity,
          particleSpeed,
          bgPattern,
          fontSize,
          photoLayout,
          savedAt: Date.now(),
        });
        setDraftSavedAt(Date.now());
      }
    }, 3000);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    title,
    date,
    stickers,
    photoIds,
    audioIds,
    mood,
    tags,
    habitSnapshot,
    draftKey,
    diaryTheme.theme,
    diaryTheme.font,
    inkColor,
    paperTexture,
    paperColor,
    bgIntensity,
    particleSpeed,
    bgPattern,
    fontSize,
    photoLayout,
  ]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      if (contentSyncRef.current) clearTimeout(contentSyncRef.current);
    };
  }, []);

  // Clear draft saved indicator after 2s
  useEffect(() => {
    if (!draftSavedAt) return;
    const timer = setTimeout(() => setDraftSavedAt(0), 2000);
    return () => clearTimeout(timer);
  }, [draftSavedAt]);

  // Initialize contenteditable with existing content on mount
  const editorInitRef = useRef(false);
  useEffect(() => {
    if (editorRef.current && !editorInitRef.current) {
      editorInitRef.current = true;
      if (content) {
        editorRef.current.innerHTML = sanitizeRichContent(content);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  // Focus trap for editor overlay
  useEffect(() => {
    if (desktop || !editorOverlayRef.current) return;
    return createFocusTrap(editorOverlayRef.current);
  }, [desktop]);

  // Load existing audio recordings for editing
  useEffect(() => {
    if (entry?.audioIds && entry.audioIds.length > 0) {
      import("./journalStorage")
        .then(({ getAudioForEntry }) => {
          getAudioForEntry(entry.id)
            .then(setAudioRecordings)
            .catch((err) => {
              logger.warn("[Journal]", "Audio load failed:", err);
              setAudioRecordings([]);
            });
        })
        .catch((err) => logger.warn("[Journal]", "Audio module load failed:", err));
    }
  }, [entry]);

  // Append voice transcript to content when dictation stops
  useEffect(() => {
    if (wasListeningRef.current && !voice.isListening && voice.transcript) {
      setContent((prev) => {
        const separator = prev && !prev.endsWith("\n") && !prev.endsWith(" ") ? " " : "";
        const next = prev + separator + voice.transcript;
        contentRef.current = next;
        return next;
      });
    }
    wasListeningRef.current = voice.isListening;
  }, [voice.isListening, voice.transcript]);

  // Handle completed audio recording — store and add to audioIds
  useEffect(() => {
    if (audioData && !isRecording) {
      let cancelled = false;
      const storeRecording = async () => {
        try {
          const data = audioData;
          if (!data) return;
          const audio = await onAddAudio(data, duration, mimeType, entryId);
          if (cancelled) return;
          setAudioIds((prev) => [...prev, audio.id]);
          setAudioRecordings((prev) => [...prev, audio]);
          resetRecorder();
          setShowRecordingOverlay(false);
        } catch {
          if (cancelled) return;
          resetRecorder();
        }
      };
      void storeRecording();
      return () => {
        cancelled = true;
      };
    }
  }, [audioData, isRecording, onAddAudio, entryId, duration, mimeType, resetRecorder]);

  // Click-outside to close prompts dropdown
  useEffect(() => {
    if (!showPromptsDropdown) return;
    const handler = (e: PointerEvent) => {
      if (promptsDropdownRef.current && !promptsDropdownRef.current.contains(e.target as Node)) {
        setShowPromptsDropdown(false);
      }
    };
    // Delay to avoid catching the opening click
    const timer = setTimeout(() => document.addEventListener("pointerdown", handler), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handler);
    };
  }, [showPromptsDropdown]);

  // Visual viewport resize (show toolbar when keyboard opens)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (vv.height < window.innerHeight * 0.75) {
        setToolbarHidden(false);
      }
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // === Handlers ===

  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      void clearDraft(draftKey);
      onBack();
    }
  }, [isDirty, draftKey, onBack]);

  const handleSave = useCallback(async () => {
    if (!hasContent) return;
    // Stop any active voice/recording before saving
    if (voice.isListening) voice.stop();
    if (recorder.isRecording) recorder.stop();
    setSaveState("saving");
    saveStartRef.current = Date.now();
    try {
      await onSave({
        title: title.trim(),
        content: contentRef.current.trim(),
        stickers,
        photoIds,
        audioIds: audioIds.length > 0 ? audioIds : undefined,
        mood,
        tags,
        date,
        habitSnapshot: habitSnapshot.length > 0 ? habitSnapshot : undefined,
        theme: diaryTheme.theme,
        font: diaryTheme.font,
        inkColor: inkColor !== "#ffffff" ? inkColor : undefined,
        paperTexture: paperTexture !== "clean" ? paperTexture : undefined,
        paperColor: paperColor !== "dark" ? paperColor : undefined,
        bgIntensity: bgIntensity !== "full" ? bgIntensity : undefined,
        particleSpeed: particleSpeed !== "slow" ? particleSpeed : undefined,
        bgPattern: bgPattern !== "none" ? bgPattern : undefined,
        fontSize: fontSize !== "medium" ? fontSize : undefined,
        photoLayout: Object.keys(photoLayout).length > 0 ? photoLayout : undefined,
      });
      // Enforce minimum display time for "saving" state (prevents flicker)
      const elapsed = Date.now() - saveStartRef.current;
      if (elapsed < MIN_SAVE_DISPLAY_MS) {
        await new Promise((r) => setTimeout(r, MIN_SAVE_DISPLAY_MS - elapsed));
      }
      void clearDraft(draftKey);
      announceSuccess(ts.journalEntrySaved || "Entry saved");
      setSaveState("saved");
      setSaveSuccess(true);
      // Auto-transition saved -> idle after 2s
      setTimeout(() => setSaveState("idle"), 2000);
      // Celebration: sound + haptic
      try {
        const { playSuccess } = await import("@/lib/audioManager");
        playSuccess();
      } catch {
        /* graceful: celebration audio is decorative */
      }
      void hapticSuccess();
      // Navigate after brief celebration
      navigationTimeoutRef.current = setTimeout(() => onBack(), 600);
    } catch (err) {
      setSaveState("error");
      logger.warn("[Journal] Save failed:", err);
    }
  }, [
    title,
    stickers,
    photoIds,
    audioIds,
    mood,
    tags,
    date,
    onSave,
    onBack,
    draftKey,
    hasContent,
    ts,
    voice,
    recorder,
    habitSnapshot,
    diaryTheme.theme,
    diaryTheme.font,
    inkColor,
    paperTexture,
    paperColor,
    bgIntensity,
    particleSpeed,
    bgPattern,
    fontSize,
    photoLayout,
  ]);

  const handleRetry = useCallback(() => { void handleSave(); }, [handleSave]);

  const handleSaveAndClose = useCallback(async () => {
    setShowUnsavedDialog(false);
    await handleSave();
  }, [handleSave]);

  const persistDraftNow = useCallback(async () => {
    if (!(isDirty || hasContent)) return false;

    const savedAt = Date.now();
    await saveDraft(draftKey, {
      title,
      date,
      content: contentRef.current,
      stickers,
      photoIds,
      audioIds,
      mood,
      tags,
      habitSnapshot,
      theme: diaryTheme.theme,
      font: diaryTheme.font,
      inkColor,
      paperTexture,
      paperColor,
      bgIntensity,
      particleSpeed,
      bgPattern,
      fontSize,
      photoLayout,
      savedAt,
    });
    setDraftSavedAt(savedAt);
    return true;
  }, [
    isDirty,
    hasContent,
    draftKey,
    title,
    date,
    stickers,
    photoIds,
    audioIds,
    mood,
    tags,
    habitSnapshot,
    diaryTheme.theme,
    diaryTheme.font,
    inkColor,
    paperTexture,
    paperColor,
    bgIntensity,
    particleSpeed,
    bgPattern,
    fontSize,
    photoLayout,
  ]);

  const handleDiscard = useCallback(() => {
    void clearDraft(draftKey);
    setShowUnsavedDialog(false);
    onBack();
  }, [draftKey, onBack]);

  // Keyboard shortcuts: Escape to close overlays/go back, Ctrl+Enter to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showStickers) {
          setShowStickers(false);
          return;
        }
        if (showPhotos) {
          setShowPhotos(false);
          return;
        }
        if (showMood) {
          setShowMood(false);
          return;
        }
        if (showTags) {
          setShowTags(false);
          return;
        }
        if (showRecordingOverlay) {
          recorder.stop();
          setShowRecordingOverlay(false);
          return;
        }
        if (showTemplatePicker) {
          setShowTemplatePicker(false);
          return;
        }
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
          return;
        }
        if (showUnsavedDialog) {
          setShowUnsavedDialog(false);
          return;
        }
        if (showSettingsConfirm) {
          setShowSettingsConfirm(false);
          return;
        }
        handleBack();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && hasContent && saveState !== "saving") {
        e.preventDefault();
        void handleSave();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    showStickers,
    showPhotos,
    showMood,
    showTags,
    showRecordingOverlay,
    showTemplatePicker,
    showDeleteConfirm,
    showUnsavedDialog,
    showSettingsConfirm,
    handleBack,
    handleSave,
    hasContent,
    saveState,
    recorder,
  ]);

  // Android back button (priority order)
  useEffect(() => {
    if (showUnsavedDialog)
      return registerModalCloseCallback(() => {
        setShowUnsavedDialog(false);
        return true;
      });
    if (showSettingsConfirm)
      return registerModalCloseCallback(() => {
        setShowSettingsConfirm(false);
        return true;
      });
    if (showDeleteConfirm)
      return registerModalCloseCallback(() => {
        setShowDeleteConfirm(false);
        return true;
      });
    if (showRecordingOverlay)
      return registerModalCloseCallback(() => {
        recorder.stop();
        setShowRecordingOverlay(false);
        return true;
      });
    if (showTemplatePicker)
      return registerModalCloseCallback(() => {
        setShowTemplatePicker(false);
        return true;
      });
    if (showStickers)
      return registerModalCloseCallback(() => {
        setShowStickers(false);
        return true;
      });
    if (showPhotos)
      return registerModalCloseCallback(() => {
        setShowPhotos(false);
        return true;
      });
    if (showMood)
      return registerModalCloseCallback(() => {
        setShowMood(false);
        return true;
      });
    if (showTags)
      return registerModalCloseCallback(() => {
        setShowTags(false);
        return true;
      });
    // Fallback: no sub-modal open -> back button triggers editor back (dirty check)
    return registerModalCloseCallback(() => {
      handleBack();
      return true;
    });
  }, [
    showUnsavedDialog,
    showDeleteConfirm,
    showRecordingOverlay,
    showTemplatePicker,
    showStickers,
    showPhotos,
    showMood,
    showTags,
    showSettingsConfirm,
    recorder,
    handleBack,
  ]);

  const handleRestoreDraft = useCallback(() => {
    if (!draftAvailable) return;
    setTitle(draftAvailable.title);
    setDate(draftAvailable.date || getToday());
    contentRef.current = draftAvailable.content;
    setContent(draftAvailable.content);
    setStickers(draftAvailable.stickers);
    setPhotoIds(draftAvailable.photoIds);
    if (draftAvailable.audioIds) setAudioIds(draftAvailable.audioIds);
    setMood(draftAvailable.mood);
    setTags(draftAvailable.tags);
    setHabitSnapshot(draftAvailable.habitSnapshot || []);
    // Restore customizations (if present in draft)
    if (draftAvailable.theme) diaryTheme.setTheme(draftAvailable.theme);
    if (draftAvailable.font) diaryTheme.setFont(draftAvailable.font);
    if (draftAvailable.inkColor) setInkColor(draftAvailable.inkColor);
    if (draftAvailable.paperTexture) setPaperTexture(draftAvailable.paperTexture);
    if (draftAvailable.paperColor) setPaperColor(draftAvailable.paperColor);
    if (draftAvailable.bgIntensity) setBgIntensity(draftAvailable.bgIntensity);
    if (draftAvailable.particleSpeed) setParticleSpeed(draftAvailable.particleSpeed);
    if (draftAvailable.bgPattern) setBgPattern(draftAvailable.bgPattern);
    if (draftAvailable.fontSize) setFontSize(draftAvailable.fontSize);
    if (draftAvailable.photoLayout) setPhotoLayout(draftAvailable.photoLayout);
    setDraftAvailable(null);
  }, [draftAvailable, diaryTheme]);

  const handleDismissDraft = useCallback(() => {
    void clearDraft(draftKey);
    setDraftAvailable(null);
  }, [draftKey]);

  const handleAddSticker = useCallback(
    (sticker: string) => {
      if (stickers.length >= MAX_STICKERS_PER_ENTRY) return;
      setStickers((prev) => [...prev, sticker]);
      setShowStickers(false);
    },
    [stickers.length]
  );

  const handleRemoveSticker = useCallback((index: number) => {
    setStickers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddPhoto = useCallback(
    async (file: File) => {
      try {
        const photo = await onAddPhoto(file, entryId);
        setPhotoIds((prev) => [...prev, photo.id]);
      } catch (error) {
        logger.error("[Journal] Photo upload failed:", error);
      }
    },
    [onAddPhoto, entryId]
  );

  const handleRemovePhoto = useCallback(
    async (photoId: string) => {
      try {
        await onRemovePhoto(photoId, entryId);
        setPhotoIds((prev) => prev.filter((id) => id !== photoId));
      } catch (err) {
        logger.error("[Journal] Photo removal failed:", err);
      }
    },
    [onRemovePhoto, entryId]
  );

  const handleReturnToGallery = useCallback((photoId: string) => {
    setPhotoLayout((prev) => {
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
  }, []);

  const handleFloatPhoto = useCallback((photoId: string) => {
    setPhotoLayout((prev) => ({
      ...prev,
      [photoId]: { x: 50, y: 50, width: 200 },
    }));
  }, []);

  const handleCloseBurn = useCallback(() => setShowBurnWidget(false), []);
  const handleCloseGratitude = useCallback(() => setShowGratitudeWidget(false), []);

  const handleAddTag = useCallback(() => {
    const tag = tagInput
      .trim()
      .replace(
        /[^a-zA-Z\u0430-\u044f\u0410-\u042f\u0451\u0401\u0456\u0406\u0457\u0407\u0454\u0404\u0491\u04900-9_-]/g,
        ""
      );
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setTagInput("");
    setShowTags(false);
  }, [tagInput, tags]);

  const handleRemoveAudio = useCallback(
    async (audioId: string) => {
      try {
        await onRemoveAudio(audioId, entryId);
        setAudioIds((prev) => prev.filter((id) => id !== audioId));
        setAudioRecordings((prev) => prev.filter((a) => a.id !== audioId));
      } catch (err) {
        logger.error("[Journal] Audio removal failed:", err);
      }
    },
    [onRemoveAudio, entryId]
  );

  const handleToggleDictation = useCallback(() => {
    if (voice.isListening) {
      voice.stop();
    } else {
      if (!voice.isSupported) {
        return;
      }
      voice.start();
    }
  }, [voice]);

  const handleStartRecording = useCallback(async () => {
    if (!recorder.isSupported) {
      return;
    }
    if (audioIds.length >= MAX_AUDIO_PER_ENTRY) {
      return;
    }
    setShowStickers(false);
    setShowPhotos(false);
    setShowMood(false);
    setShowTags(false);
    setShowStyleBar(false);
    setShowActionSheet(false);
    setShowRecordingOverlay(true);
    try {
      await recorder.start();
    } catch {
      setShowRecordingOverlay(false);
      logger.warn("[Journal]", "Recording failed to start");
    }
  }, [recorder, audioIds.length]);

  const handleStopRecording = useCallback(() => {
    recorder.stop();
    // audioData effect will handle storing
  }, [recorder]);

  const closeAllPickers = useCallback(() => {
    setShowStickers(false);
    setShowPhotos(false);
    setShowMood(false);
    setShowTags(false);
    setShowStyleBar(false);
    setShowActionSheet(false);
  }, []);

  const handlePromptTap = useCallback((prompt: string) => {
    setTitle(prompt);
    setShowPromptsDropdown(false);
  }, []);

  const hasImmediateChanges = useCallback(() => {
    const init = initialSnapshotRef.current;
    return (
      title !== init.title ||
      date !== init.date ||
      contentRef.current !== init.content ||
      JSON.stringify(stickers) !== init.stickers ||
      JSON.stringify(photoIds) !== init.photoIds ||
      JSON.stringify(audioIds) !== init.audioIds ||
      mood !== init.mood ||
      JSON.stringify(tags) !== init.tags ||
      JSON.stringify(habitSnapshot) !== init.habitSnapshot ||
      diaryTheme.theme !== init.theme ||
      diaryTheme.font !== init.font ||
      inkColor !== init.inkColor ||
      paperTexture !== init.paperTexture ||
      paperColor !== init.paperColor ||
      bgIntensity !== init.bgIntensity ||
      particleSpeed !== init.particleSpeed ||
      bgPattern !== init.bgPattern ||
      fontSize !== init.fontSize ||
      JSON.stringify(photoLayout) !== init.photoLayout
    );
  }, [
    title,
    date,
    stickers,
    photoIds,
    audioIds,
    mood,
    tags,
    habitSnapshot,
    diaryTheme.theme,
    diaryTheme.font,
    inkColor,
    paperTexture,
    paperColor,
    bgIntensity,
    particleSpeed,
    bgPattern,
    fontSize,
    photoLayout,
  ]);

  const handleEditorInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = sanitizeRichContent(el.innerHTML);
    contentRef.current = html;
    // Debounce React state sync (wordCount, isDirty) — typing stays lag-free
    if (contentSyncRef.current) clearTimeout(contentSyncRef.current);
    contentSyncRef.current = setTimeout(() => setContent(html), 300);
  }, []);

  const cycleFontSize = useCallback(() => {
    setFontSize((s) => (s === "small" ? "medium" : s === "medium" ? "large" : "small"));
  }, []);

  // Scroll-to-hide toolbar
  const scrollThreshold = 12;
  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const delta = el.scrollTop - lastScrollTopRef.current;
    lastScrollTopRef.current = el.scrollTop;
    scrollYRef.current = el.scrollTop;
    if (delta > scrollThreshold && el.scrollTop > 60) {
      setToolbarHidden(true);
    } else if (delta < -scrollThreshold) {
      setToolbarHidden(false);
    }
  }, []);

  // Scoped CSS vars for diary theme (no body mutation — isolated to this overlay)
  const diaryStyle = useMemo(
    () =>
      ({
        ...diaryTheme.themeVars,
        backgroundColor: diaryTheme.themeVars["--diary-bg"],
        color: diaryTheme.themeVars["--diary-text"],
      }),
    [diaryTheme.themeVars]
  );

  const handleDismissFormatHint = useCallback(() => {
    setFormatHintDismissed(true);
    storageSetRaw(SK.DIARY_FORMAT_HINT_SEEN, "1");
  }, []);

  const handleTemplateSelect = useCallback(
    (templateContent: string, _templateId: string | null) => {
      contentRef.current = templateContent;
      setContent(templateContent);
      setShowTemplatePicker(false);
      focusTimeoutRef.current = setTimeout(() => editorRef.current?.focus(), 100);
    },
    []
  );

  const handleTemplateClose = useCallback(() => {
    setShowTemplatePicker(false);
    focusTimeoutRef.current = setTimeout(() => editorRef.current?.focus(), 100);
  }, []);

  return {
    // i18n
    t,
    ts,
    language,

    // refs
    editorRef,
    dateInputRef,
    editorOverlayRef,
    contentAreaRef,
    scrollAreaRef,
    promptsDropdownRef,

    // content state
    title,
    setTitle,
    date,
    setDate,
    content,
    stickers,
    photoIds,
    audioIds,
    audioRecordings,
    mood,
    setMood,
    tags,
    setTags,
    habitSnapshot,
    setHabitSnapshot,
    tagInput,
    setTagInput,

    // save state
    saveState,
    saveSuccess,
    handleRetry,

    // milestones
    milestoneTriggered,
    showConfetti,
    onConfettiComplete,

    // ui panels
    showStickers,
    setShowStickers,
    showPhotos,
    setShowPhotos,
    showMood,
    setShowMood,
    showTags,
    setShowTags,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showUnsavedDialog,
    setShowUnsavedDialog,
    showSettingsConfirm,
    setShowSettingsConfirm,
    showTemplatePicker,
    showRecordingOverlay,
    showPromptsDropdown,
    setShowPromptsDropdown,

    // draft
    draftAvailable,
    draftSavedAt,

    // diary premium
    diaryTheme,
    showStyleBar,
    setShowStyleBar,
    showBurnWidget,
    setShowBurnWidget,
    showGratitudeWidget,
    setShowGratitudeWidget,
    zenFocusActive,
    setZenFocusActive,

    // canvas/atmosphere
    bgIntensity,
    setBgIntensity,
    particleSpeed,
    setParticleSpeed,
    inkColor,
    setInkColor,
    paperTexture,
    setPaperTexture,
    paperColor,
    setPaperColor,
    bgPattern,
    setBgPattern,
    fontSize,
    setFontSize,
    photoLayout,
    setPhotoLayout,
    paperColors,

    // widget
    showBreathe,
    setShowBreathe,
    showHabits,
    setShowHabits,

    // privacy
    privacyShieldActive,
    setPrivacyShieldActive,
    panicLocked,
    setPanicLocked,

    // format hint
    formatHintDismissed,
    handleDismissFormatHint,

    // prompt
    promptSeed,
    setPromptSeed,
    randomPrompts,

    // derived
    isDirty,
    hasImmediateChanges,
    wordCount,
    completedHabitCount,
    hasContent,
    entryId,
    diaryStyle,

    // voice & recorder
    voice,
    recorder,

    // handlers
    handleBack,
    handleSave,
    handleSaveAndClose,
    persistDraftNow,
    handleDiscard,
    handleRestoreDraft,
    handleDismissDraft,
    handleAddSticker,
    handleRemoveSticker,
    handleAddPhoto,
    handleRemovePhoto,
    handleReturnToGallery,
    handleFloatPhoto,
    handleCloseBurn,
    handleCloseGratitude,
    handleAddTag,
    handleRemoveAudio,
    handleToggleDictation,
    handleStartRecording,
    handleStopRecording,
    closeAllPickers,
    handlePromptTap,
    handleEditorInput,
    cycleFontSize,
    handleContentScroll,
    handleTemplateSelect,
    handleTemplateClose,
  };
}

export type JournalEditorState = ReturnType<typeof useJournalEditorState>;
