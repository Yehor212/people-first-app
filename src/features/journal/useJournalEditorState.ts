import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { ClipboardEvent as ReactClipboardEvent, DragEvent as ReactDragEvent } from "react";
import { getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationStrings } from "@/i18n/types";
import { useScrollLock } from "@/hooks/useScrollLock";
import { usePanicGesture } from "@/hooks/usePanicGesture";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { createFocusTrap, announceError, announceSuccess } from "@/lib/a11y";
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
import {
  JOURNAL_DRAFT_ENTRY_ID,
  MAX_STICKERS_PER_ENTRY,
  MAX_PHOTOS_PER_ENTRY,
  MAX_AUDIO_PER_ENTRY,
  countWordsHtml,
  PAPER_COLORS,
} from "./types";
import { useJournalVoice } from "./useJournalVoice";
import { useAudioRecorder } from "./useAudioRecorder";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { safeJsonParse, storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { useDiaryTheme } from "./useDiaryTheme";
import { sanitizeRichContent } from "@/lib/sanitize";
import { getJournalEditorContent } from "./journalDisplay";
import { useThemeStore, type AppliedTheme } from "@/stores/themeStore";
import {
  clearJournalDraft as clearDraft,
  getJournalDraftKey as getDraftKey,
  loadJournalDraft as loadDraft,
  saveJournalDraft as saveDraft,
  type JournalDraftData as DraftData,
} from "./journalDraftStorage";
import { commitDraftMediaToEntry, deleteDraftMedia } from "./journalStorage";
import { isSupportedJournalPhotoFile, MAX_JOURNAL_PHOTO_FILE_SIZE } from "./JournalPhotoPicker";
import { normalizeJournalStyleFields } from "./journalStyleFields";

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

function getDefaultEditorTheme(
  appliedTheme: AppliedTheme
): Pick<EditorSnapshot, "theme" | "inkColor" | "paperColor" | "bgIntensity" | "particleSpeed"> {
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

function isMicrophonePermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(error.name);
}

function getAudioStartFailureMessage(ts: TranslationStrings, error: unknown): string {
  if (isMicrophonePermissionError(error)) {
    return (
      ts.journalAudioPermissionDenied ||
      ts.journalAudioError ||
      "Microphone permission is needed to record audio."
    );
  }
  return ts.journalAudioError || "Failed to save audio";
}

export function sanitizeJournalTag(value: string): string {
  return value.trim().replace(/[^\p{L}\p{M}\p{N}_-]/gu, "");
}

function insertPlainTextIntoEditor(editor: HTMLElement, value: string): void {
  if (!value) return;
  editor.focus();

  if (typeof document !== "undefined" && document.queryCommandSupported?.("insertText")) {
    const inserted = document.execCommand("insertText", false, value);
    if (inserted) return;
  }

  const selection = typeof window !== "undefined" ? window.getSelection() : null;
  if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
    editor.appendChild(document.createTextNode(value));
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(value);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getDroppedPhotoLayout(
  clientX: number,
  clientY: number,
  container: HTMLElement | null
): { x: number; y: number; width: number } {
  if (!container) return { x: 50, y: 64, width: 200 };
  const rect = container.getBoundingClientRect();
  const x = rect.width > 0 ? ((clientX - rect.left) / rect.width) * 100 : 50;
  const y = rect.height > 0 ? ((clientY - rect.top) / rect.height) * 100 : 64;
  return {
    x: Math.max(8, Math.min(92, x)),
    y: Math.max(8, Math.min(92, Math.max(64, y))),
    width: 200,
  };
}

export function createEditorSnapshot(
  entry: JournalEntry | null,
  prefill: JournalEntryPrefill | null,
  appliedTheme: AppliedTheme = "ink"
): EditorSnapshot {
  const defaults = getDefaultEditorTheme(appliedTheme);
  const style = normalizeJournalStyleFields(entry);
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
    theme: style.theme || defaults.theme,
    font: style.font || "caveat",
    inkColor: style.inkColor || defaults.inkColor,
    paperTexture: style.paperTexture || "clean",
    paperColor: style.paperColor || defaults.paperColor,
    bgIntensity: style.bgIntensity || defaults.bgIntensity,
    particleSpeed: style.particleSpeed || defaults.particleSpeed,
    bgPattern: style.bgPattern || "none",
    fontSize: style.fontSize || "medium",
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
] as const;

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
  const ts = t;

  const prefill = !entry ? (entryPrefill ?? null) : null;
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
  const audioIdsRef = useRef<string[]>(entry?.audioIds || []);
  const stagedAddedPhotoIdsRef = useRef<Set<string>>(new Set());
  const stagedAddedAudioIdsRef = useRef<Set<string>>(new Set());
  const stagedRemovedPhotoIdsRef = useRef<Set<string>>(new Set());
  const stagedRemovedAudioIdsRef = useRef<Set<string>>(new Set());
  const saveHandledAudioDataRef = useRef<string | null>(null);

  const draftKey = getDraftKey(entry?.id || null);

  // === Content State ===
  const [title, setTitle] = useState(initialSnapshotRef.current.title);
  const [date, setDate] = useState(initialSnapshotRef.current.date);
  const [content, setContent] = useState(initialSnapshotRef.current.content);
  const [stickers, setStickers] = useState<string[]>(entry?.stickers || []);
  const [photoIds, setPhotoIds] = useState<string[]>(entry?.photoIds || []);
  const [audioIds, setAudioIds] = useState<string[]>(entry?.audioIds || []);
  const [audioRecordings, setAudioRecordings] = useState<JournalAudio[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodType | undefined>(initialSnapshotRef.current.mood);
  const [tags, setTags] = useState<string[]>(
    safeJsonParse<string[]>(initialSnapshotRef.current.tags, [])
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
  const [showVoicePrivacyConfirm, setShowVoicePrivacyConfirm] = useState(false);
  const [voicePrivacyAccepted, setVoicePrivacyAccepted] = useState(false);
  const [showPromptsDropdown, setShowPromptsDropdown] = useState(false);

  // === Draft State ===
  const [draftAvailable, setDraftAvailable] = useState<DraftData | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState(0);

  // === Diary Premium Features ===
  const diaryTheme = useDiaryTheme(
    initialSnapshotRef.current.theme,
    initialSnapshotRef.current.font
  );
  const [showStyleBar, setShowStyleBar] = useState(false);
  const [showBurnWidget, setShowBurnWidget] = useState(false);
  const [showGratitudeWidget, setShowGratitudeWidget] = useState(false);
  const [zenFocusActive, setZenFocusActive] = useState(false);
  const [, setShowActionSheet] = useState(false);
  const [, setToolbarHidden] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  // === Canvas/Atmosphere State ===
  const [bgIntensity, setBgIntensity] = useState<BackgroundIntensity>(
    initialSnapshotRef.current.bgIntensity
  );
  const [particleSpeed, setParticleSpeed] = useState<ParticleSpeed>(
    initialSnapshotRef.current.particleSpeed
  );
  const [inkColor, setInkColor] = useState(initialSnapshotRef.current.inkColor);
  const [paperTexture, setPaperTexture] = useState<PaperTexture>(
    initialSnapshotRef.current.paperTexture
  );
  const [paperColor, setPaperColor] = useState<PaperColor>(initialSnapshotRef.current.paperColor);
  const [bgPattern, setBgPattern] = useState<DiaryBgPattern>(
    initialSnapshotRef.current.bgPattern
  );
  const [fontSize, setFontSize] = useState<FontSizeName>(initialSnapshotRef.current.fontSize);
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
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const paperColors = PAPER_COLORS[paperColor];
  const entryId = entry?.id || JOURNAL_DRAFT_ENTRY_ID;
  const isExistingEntry = entryId !== JOURNAL_DRAFT_ENTRY_ID;

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
    isRecording ||
    showRecordingOverlay ||
    mood ||
    habitSnapshot.length > 0;

  const setEditorContent = useCallback((nextContent: string) => {
    const html = sanitizeRichContent(nextContent);
    contentRef.current = html;
    if (contentSyncRef.current) {
      clearTimeout(contentSyncRef.current);
      contentSyncRef.current = undefined;
    }
    setContent(html);
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== html) {
      editor.innerHTML = html;
    }
  }, []);

  const saveDraftSnapshot = useCallback(
    async (nextAudioIds = audioIdsRef.current) => {
      if (
        !title &&
        photoIds.length === 0 &&
        !contentRef.current &&
        stickers.length === 0 &&
        !mood &&
        tags.length === 0 &&
        nextAudioIds.length === 0 &&
        habitSnapshot.length === 0
      ) {
        return;
      }

      const savedAt = Date.now();
      await saveDraft(draftKey, {
        title,
        date,
        content: contentRef.current,
        stickers,
        photoIds,
        audioIds: nextAudioIds,
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
    },
    [
      title,
      photoIds,
      stickers,
      mood,
      tags,
      habitSnapshot,
      draftKey,
      date,
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
    ]
  );

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
      void saveDraftSnapshot(audioIds).catch((err) =>
        logger.warn("[Journal] Draft autosave failed:", err)
      );
    }, 3000);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    title,
    content,
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
    saveDraftSnapshot,
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
      if (saveHandledAudioDataRef.current === audioData) return;
      let cancelled = false;
      const storeRecording = async () => {
        try {
          const data = audioData;
          if (!data) return;
          const audio = await onAddAudio(
            data,
            duration,
            mimeType,
            isExistingEntry ? JOURNAL_DRAFT_ENTRY_ID : entryId
          );
          if (cancelled) return;
          if (isExistingEntry) stagedAddedAudioIdsRef.current.add(audio.id);
          const nextAudioIds = [...audioIdsRef.current, audio.id];
          audioIdsRef.current = nextAudioIds;
          setAudioError(null);
          setAudioIds(nextAudioIds);
          setAudioRecordings((prev) => [...prev, audio]);
          void saveDraftSnapshot(nextAudioIds).catch((err) =>
            logger.warn("[Journal] Recording draft save failed:", err)
          );
          resetRecorder();
          setShowRecordingOverlay(false);
        } catch (err) {
          if (cancelled) return;
          const message = ts.journalAudioError || "Failed to save audio";
          logger.warn("[Journal]", "Audio save failed:", err);
          setAudioError(message);
          announceError(message);
          resetRecorder();
          setShowRecordingOverlay(false);
        }
      };
      void storeRecording();
      return () => {
        cancelled = true;
      };
    }
  }, [
    audioData,
    isRecording,
    onAddAudio,
    entryId,
    isExistingEntry,
    duration,
    mimeType,
    resetRecorder,
    saveDraftSnapshot,
    ts,
  ]);

  useEffect(() => {
    audioIdsRef.current = audioIds;
  }, [audioIds]);

  useEffect(() => {
    if (!showRecordingOverlay || !recorder.error || recorder.isRecording) return;
    setShowRecordingOverlay(false);
    const message = ts.journalAudioError || "Failed to save audio";
    setAudioError(message);
    announceError(message);
  }, [recorder.error, recorder.isRecording, showRecordingOverlay, ts]);

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

  // iOS/WKWebView visual viewport resize: reserve software keyboard space.
  useEffect(() => {
    if (desktop) {
      setKeyboardInset(0);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const updateKeyboardInset = () => {
      const nextInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardInset(nextInset);
      if (nextInset > 48) {
        setToolbarHidden(false);
      }
    };

    updateKeyboardInset();
    vv.addEventListener("resize", updateKeyboardInset);
    vv.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("orientationchange", updateKeyboardInset);
    return () => {
      vv.removeEventListener("resize", updateKeyboardInset);
      vv.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("orientationchange", updateKeyboardInset);
    };
  }, [desktop]);

  // === Handlers ===

  const handleBack = useCallback(() => {
    if (isDirty || contentRef.current !== initialSnapshotRef.current.content) {
      setShowUnsavedDialog(true);
    } else {
      void clearDraft(draftKey);
      onBack();
    }
  }, [isDirty, draftKey, onBack]);

  const flushActiveRecordingForSave = useCallback(
    async (force = false): Promise<string[]> => {
      if (!force && !recorder.isRecording) return audioIdsRef.current;
      const captured = await recorder.stop();
      if (!captured?.data) return audioIdsRef.current;

      saveHandledAudioDataRef.current = captured.data;
      try {
        const audio = await onAddAudio(
          captured.data,
          captured.duration,
          captured.mimeType,
          isExistingEntry ? JOURNAL_DRAFT_ENTRY_ID : entryId
        );
        if (isExistingEntry) stagedAddedAudioIdsRef.current.add(audio.id);
        const nextAudioIds = [...audioIdsRef.current, audio.id];
        audioIdsRef.current = nextAudioIds;
        setAudioError(null);
        setAudioIds(nextAudioIds);
        setAudioRecordings((prev) => [...prev, audio]);
        resetRecorder();
        setShowRecordingOverlay(false);
        return nextAudioIds;
      } catch (err) {
        const message = ts.journalAudioError || "Failed to save audio";
        setAudioError(message);
        announceError(message);
        resetRecorder();
        setShowRecordingOverlay(false);
        throw err;
      } finally {
        saveHandledAudioDataRef.current = null;
      }
    },
    [entryId, isExistingEntry, onAddAudio, recorder, resetRecorder, ts]
  );

  const handleSave = useCallback(async () => {
    if (!hasContent) return;
    // Stop any active voice/recording before saving
    if (voice.isListening) voice.stop();
    setSaveState("saving");
    saveStartRef.current = Date.now();
    try {
      const shouldFlushRecording = recorder.isRecording || showRecordingOverlay;
      const audioIdsForSave = shouldFlushRecording
        ? await flushActiveRecordingForSave(shouldFlushRecording)
        : audioIdsRef.current;

      const stagedAddedPhotoIds = isExistingEntry ? [...stagedAddedPhotoIdsRef.current] : [];
      const stagedAddedAudioIds = isExistingEntry ? [...stagedAddedAudioIdsRef.current] : [];
      const stagedRemovedPhotoIds = isExistingEntry ? [...stagedRemovedPhotoIdsRef.current] : [];
      const stagedRemovedAudioIds = isExistingEntry ? [...stagedRemovedAudioIdsRef.current] : [];

      if (isExistingEntry) {
        await commitDraftMediaToEntry(entryId, {
          photoIds: stagedAddedPhotoIds,
          audioIds: stagedAddedAudioIds,
        });
      }

      await onSave({
        title: title.trim(),
        content: contentRef.current.trim(),
        stickers,
        photoIds,
        audioIds: audioIdsForSave.length > 0 ? audioIdsForSave : undefined,
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
      if (isExistingEntry) {
        await Promise.all([
          ...stagedRemovedPhotoIds.map((photoId) => onRemovePhoto(photoId, entryId)),
          ...stagedRemovedAudioIds.map((audioId) => onRemoveAudio(audioId, entryId)),
        ]);
        stagedAddedPhotoIdsRef.current.clear();
        stagedAddedAudioIdsRef.current.clear();
        stagedRemovedPhotoIdsRef.current.clear();
        stagedRemovedAudioIdsRef.current.clear();
      }
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
    mood,
    tags,
    date,
    onSave,
    onBack,
    draftKey,
    hasContent,
    showRecordingOverlay,
    ts,
    voice,
    recorder,
    flushActiveRecordingForSave,
    isExistingEntry,
    entryId,
    onRemovePhoto,
    onRemoveAudio,
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

  const handleRetry = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const handleSaveAndClose = useCallback(async () => {
    setShowUnsavedDialog(false);
    await handleSave();
  }, [handleSave]);

  const persistDraftNow = useCallback(async () => {
    const hasDraftPayload = Boolean(
      title.trim() ||
      contentRef.current.trim() ||
      stickers.length > 0 ||
      photoIds.length > 0 ||
      audioIdsRef.current.length > 0 ||
      mood ||
      tags.length > 0 ||
      habitSnapshot.length > 0
    );
    if (!(isDirty || hasContent || hasDraftPayload)) return false;

    const savedAt = Date.now();
    await saveDraft(draftKey, {
      title,
      date,
      content: contentRef.current,
      stickers,
      photoIds,
      audioIds: audioIdsRef.current,
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

  useEffect(() => {
    const flushDraftForBackground = () => {
      void persistDraftNow().catch((err) =>
        logger.warn("[Journal] Background draft save failed:", err)
      );
    };
    const flushDraftWhenHidden = () => {
      if (document.hidden) flushDraftForBackground();
    };

    document.addEventListener("visibilitychange", flushDraftWhenHidden);
    window.addEventListener("pagehide", flushDraftForBackground);
    return () => {
      document.removeEventListener("visibilitychange", flushDraftWhenHidden);
      window.removeEventListener("pagehide", flushDraftForBackground);
    };
  }, [persistDraftNow]);

  const cleanupStagedExistingMedia = useCallback(async () => {
    if (!isExistingEntry) return;
    const stagedPhotoIds = [...stagedAddedPhotoIdsRef.current];
    const stagedAudioIds = [...stagedAddedAudioIdsRef.current];
    stagedAddedPhotoIdsRef.current.clear();
    stagedAddedAudioIdsRef.current.clear();
    stagedRemovedPhotoIdsRef.current.clear();
    stagedRemovedAudioIdsRef.current.clear();

    await Promise.all([
      ...stagedPhotoIds.map((photoId) => onRemovePhoto(photoId, JOURNAL_DRAFT_ENTRY_ID)),
      ...stagedAudioIds.map((audioId) => onRemoveAudio(audioId, JOURNAL_DRAFT_ENTRY_ID)),
    ]);
  }, [isExistingEntry, onRemoveAudio, onRemovePhoto]);

  const deleteNewEntryDraftMedia = useCallback(async () => {
    if (entryId !== JOURNAL_DRAFT_ENTRY_ID) return;
    try {
      await deleteDraftMedia();
    } catch (err) {
      logger.warn("[Journal] Draft media cleanup failed:", err);
    }
  }, [entryId]);

  const handleDiscard = useCallback(async () => {
    await clearDraft(draftKey);
    if (isExistingEntry) {
      try {
        await cleanupStagedExistingMedia();
      } catch (err) {
        logger.warn("[Journal] Staged media cleanup failed:", err);
      }
    } else {
      await deleteNewEntryDraftMedia();
    }
    setShowUnsavedDialog(false);
    onBack();
  }, [cleanupStagedExistingMedia, deleteNewEntryDraftMedia, draftKey, isExistingEntry, onBack]);

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
        if (showVoicePrivacyConfirm) {
          setShowVoicePrivacyConfirm(false);
          return;
        }
        if (showRecordingOverlay) {
          void recorder.stop();
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
    showVoicePrivacyConfirm,
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
        void recorder.stop();
        setShowRecordingOverlay(false);
        return true;
      });
    if (showVoicePrivacyConfirm)
      return registerModalCloseCallback(() => {
        setShowVoicePrivacyConfirm(false);
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
    showVoicePrivacyConfirm,
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
    setEditorContent(draftAvailable.content);
    setStickers(draftAvailable.stickers);
    setPhotoIds(draftAvailable.photoIds);
    if (isExistingEntry) {
      const originalPhotoIds = new Set(entry?.photoIds || []);
      stagedAddedPhotoIdsRef.current = new Set(
        draftAvailable.photoIds.filter((photoId) => !originalPhotoIds.has(photoId))
      );
      stagedRemovedPhotoIdsRef.current = new Set(
        (entry?.photoIds || []).filter((photoId) => !draftAvailable.photoIds.includes(photoId))
      );
    }
    const restoredAudioIds = draftAvailable.audioIds || [];
    setAudioIds(restoredAudioIds);
    audioIdsRef.current = restoredAudioIds;
    if (isExistingEntry) {
      const originalAudioIds = new Set(entry?.audioIds || []);
      stagedAddedAudioIdsRef.current = new Set(
        restoredAudioIds.filter((audioId) => !originalAudioIds.has(audioId))
      );
      stagedRemovedAudioIdsRef.current = new Set(
        (entry?.audioIds || []).filter((audioId) => !restoredAudioIds.includes(audioId))
      );
    }
    if (restoredAudioIds.length > 0) {
      import("./journalStorage")
        .then(async ({ getAudioById }) => {
          const recordings = await Promise.all(
            restoredAudioIds.map((audioId) => getAudioById(audioId))
          );
          setAudioRecordings(
            recordings.filter((audio): audio is NonNullable<typeof audio> => !!audio)
          );
        })
        .catch((err) => {
          logger.warn("[Journal] Draft audio restore failed:", err);
          setAudioRecordings([]);
        });
    } else {
      setAudioRecordings([]);
    }
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
  }, [
    draftAvailable,
    diaryTheme,
    entry?.audioIds,
    entry?.photoIds,
    isExistingEntry,
    setEditorContent,
  ]);

  const handleDismissDraft = useCallback(async () => {
    await clearDraft(draftKey);
    if (isExistingEntry && draftAvailable) {
      const originalPhotoIds = new Set(entry?.photoIds || []);
      const originalAudioIds = new Set(entry?.audioIds || []);
      const draftAddedPhotoIds = draftAvailable.photoIds.filter(
        (photoId) => !originalPhotoIds.has(photoId)
      );
      const draftAddedAudioIds = (draftAvailable.audioIds || []).filter(
        (audioId) => !originalAudioIds.has(audioId)
      );
      await Promise.all([
        ...draftAddedPhotoIds.map((photoId) => onRemovePhoto(photoId, JOURNAL_DRAFT_ENTRY_ID)),
        ...draftAddedAudioIds.map((audioId) => onRemoveAudio(audioId, JOURNAL_DRAFT_ENTRY_ID)),
      ]);
    } else {
      await deleteNewEntryDraftMedia();
    }
    setDraftAvailable(null);
  }, [
    deleteNewEntryDraftMedia,
    draftAvailable,
    draftKey,
    entry?.audioIds,
    entry?.photoIds,
    isExistingEntry,
    onRemoveAudio,
    onRemovePhoto,
  ]);

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
    async (file: File): Promise<JournalPhoto> => {
      try {
        const photo = await onAddPhoto(file, isExistingEntry ? JOURNAL_DRAFT_ENTRY_ID : entryId);
        if (isExistingEntry) stagedAddedPhotoIdsRef.current.add(photo.id);
        setPhotoIds((prev) => [...prev, photo.id]);
        return photo;
      } catch (error) {
        logger.error("[Journal] Photo upload failed:", error);
        throw error;
      }
    },
    [onAddPhoto, entryId, isExistingEntry]
  );

  const handleRemovePhoto = useCallback(
    async (photoId: string) => {
      try {
        if (isExistingEntry) {
          if (stagedAddedPhotoIdsRef.current.has(photoId)) {
            await onRemovePhoto(photoId, JOURNAL_DRAFT_ENTRY_ID);
            stagedAddedPhotoIdsRef.current.delete(photoId);
          } else {
            stagedRemovedPhotoIdsRef.current.add(photoId);
          }
        } else {
          await onRemovePhoto(photoId, entryId);
        }
        setPhotoIds((prev) => prev.filter((id) => id !== photoId));
        setPhotoLayout((prev) => {
          if (!prev[photoId]) return prev;
          const next = { ...prev };
          delete next[photoId];
          return next;
        });
      } catch (err) {
        logger.error("[Journal] Photo removal failed:", err);
      }
    },
    [onRemovePhoto, entryId, isExistingEntry]
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
    const tag = sanitizeJournalTag(tagInput);
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setTagInput("");
    setShowTags(false);
  }, [tagInput, tags]);

  const handleRemoveAudio = useCallback(
    async (audioId: string) => {
      try {
        if (isExistingEntry) {
          if (stagedAddedAudioIdsRef.current.has(audioId)) {
            await onRemoveAudio(audioId, JOURNAL_DRAFT_ENTRY_ID);
            stagedAddedAudioIdsRef.current.delete(audioId);
          } else {
            stagedRemovedAudioIdsRef.current.add(audioId);
          }
        } else {
          await onRemoveAudio(audioId, entryId);
        }
        setAudioIds((prev) => prev.filter((id) => id !== audioId));
        audioIdsRef.current = audioIdsRef.current.filter((id) => id !== audioId);
        setAudioRecordings((prev) => prev.filter((a) => a.id !== audioId));
      } catch (err) {
        logger.error("[Journal] Audio removal failed:", err);
      }
    },
    [onRemoveAudio, entryId, isExistingEntry]
  );

  const getVoiceUnsupportedMessage = useCallback(
    () =>
      ts.journalVoiceNotSupported ||
      voice.error ||
      "Speech recognition is not supported in this browser.",
    [ts.journalVoiceNotSupported, voice.error]
  );

  const handleConfirmDictation = useCallback(() => {
    setShowVoicePrivacyConfirm(false);
    if (!voice.isSupported) {
      const message = getVoiceUnsupportedMessage();
      setAudioError(message);
      announceError(message);
      return;
    }
    setVoicePrivacyAccepted(true);
    setAudioError(null);
    voice.start();
  }, [getVoiceUnsupportedMessage, voice]);

  const handleToggleDictation = useCallback(() => {
    if (voice.isListening) {
      voice.stop();
      return;
    }
    if (!voice.isSupported) {
      const message = getVoiceUnsupportedMessage();
      setAudioError(message);
      announceError(message);
      return;
    }
    if (!voicePrivacyAccepted) {
      setShowVoicePrivacyConfirm(true);
      return;
    }
    setAudioError(null);
    voice.start();
  }, [getVoiceUnsupportedMessage, voice, voicePrivacyAccepted]);

  const handleStartRecording = useCallback(async () => {
    if (!recorder.isSupported) {
      const message =
        ts.journalAudioUnsupported ||
        ts.journalAudioError ||
        "Audio recording is not supported on this device.";
      setAudioError(message);
      announceError(message);
      return;
    }
    if (audioIds.length >= MAX_AUDIO_PER_ENTRY) {
      const message = ts.journalAudioMaxReached || `Maximum ${MAX_AUDIO_PER_ENTRY} recordings`;
      setAudioError(message);
      announceError(message);
      return;
    }
    setShowStickers(false);
    setShowPhotos(false);
    setShowMood(false);
    setShowTags(false);
    setShowStyleBar(false);
    setShowActionSheet(false);
    setShowVoicePrivacyConfirm(false);
    setShowRecordingOverlay(true);
    setAudioError(null);
    setAudioNotice(null);
    try {
      await recorder.start();
    } catch (err) {
      setShowRecordingOverlay(false);
      const message = getAudioStartFailureMessage(ts, err);
      logger.warn("[Journal]", "Recording failed to start:", err);
      setAudioError(message);
      announceError(message);
    }
  }, [recorder, audioIds.length, ts]);

  const handleStopRecording = useCallback(() => {
    void recorder.stop();
    // audioData effect will handle storing
  }, [recorder]);

  const handleDiscardRecording = useCallback(() => {
    void recorder.discard();
    resetRecorder();
    setShowRecordingOverlay(false);
    setAudioError(null);
    setAudioNotice(null);
  }, [recorder, resetRecorder]);

  const closeAllPickers = useCallback(() => {
    setShowStickers(false);
    setShowPhotos(false);
    setShowMood(false);
    setShowTags(false);
    setShowStyleBar(false);
    setShowActionSheet(false);
    setShowVoicePrivacyConfirm(false);
  }, []);

  const handlePromptTap = useCallback((prompt: string) => {
    setSelectedPrompt(prompt);
    setShowPromptsDropdown(false);
    focusTimeoutRef.current = setTimeout(() => editorRef.current?.focus(), 100);
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

  const syncEditorContentSoon = useCallback(() => {
    handleEditorInput();
    requestAnimationFrame(() => handleEditorInput());
  }, [handleEditorInput]);

  const handleEditorPaste = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      insertPlainTextIntoEditor(editorRef.current ?? event.currentTarget, text);
      syncEditorContentSoon();
    },
    [syncEditorContentSoon]
  );

  const handleEditorDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        if (photoIds.length >= MAX_PHOTOS_PER_ENTRY) {
          announceError(ts.journalPhotoRemainingCountZero || "No photos remaining");
          return;
        }
        const file = files.find(isSupportedJournalPhotoFile);
        if (!file) {
          announceError(
            ts.journalPhotoInvalidType ||
              "Unsupported file type. Please use JPEG, PNG, WebP, or HEIC."
          );
          return;
        }
        if (file.size > MAX_JOURNAL_PHOTO_FILE_SIZE) {
          announceError(
            ts.journalPhotoTooLarge || "Image too large (max 10 MB). Try a smaller image."
          );
          return;
        }

        const paperSurface = event.currentTarget.closest<HTMLElement>(
          '[data-testid="journal-editor-paper"]'
        );
        const layout = getDroppedPhotoLayout(
          event.clientX,
          event.clientY,
          paperSurface ?? contentAreaRef.current ?? event.currentTarget
        );
        void handleAddPhoto(file)
          .then((photo) => {
            setPhotoLayout((previous) => ({ ...previous, [photo.id]: layout }));
            announceSuccess(ts.journalPhotoAdd || "Photo added");
          })
          .catch((error) => {
            logger.error("[Journal] Dropped photo upload failed:", error);
            announceError(ts.journalPhotoError || "Failed to add photo. Try again.");
          });
        return;
      }

      const text = event.dataTransfer.getData("text/plain");
      insertPlainTextIntoEditor(editorRef.current ?? event.currentTarget, text);
      syncEditorContentSoon();
    },
    [handleAddPhoto, photoIds.length, syncEditorContentSoon, ts]
  );

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
    () => ({
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
      setEditorContent(templateContent);
      setShowTemplatePicker(false);
      focusTimeoutRef.current = setTimeout(() => editorRef.current?.focus(), 100);
    },
    [setEditorContent]
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
    audioError,
    audioNotice,
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
    setShowTemplatePicker,
    showRecordingOverlay,
    showVoicePrivacyConfirm,
    setShowVoicePrivacyConfirm,
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
    selectedPrompt,
    setSelectedPrompt,

    // derived
    isDirty,
    hasImmediateChanges,
    wordCount,
    completedHabitCount,
    hasContent,
    entryId,
    diaryStyle,
    keyboardInset,

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
    handleConfirmDictation,
    handleStartRecording,
    handleStopRecording,
    handleDiscardRecording,
    closeAllPickers,
    handlePromptTap,
    handleEditorInput,
    handleEditorPaste,
    handleEditorDrop,
    cycleFontSize,
    handleContentScroll,
    handleTemplateSelect,
    handleTemplateClose,
  };
}

export type JournalEditorState = ReturnType<typeof useJournalEditorState>;
