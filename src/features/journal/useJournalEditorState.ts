import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type {
  ClipboardEvent as ReactClipboardEvent,
  Dispatch,
  DragEvent as ReactDragEvent,
  SetStateAction,
} from "react";
import { generateId, getToday } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationStrings } from "@/i18n/types";
import { placeJournalPhotoOnPage, returnJournalPhotoToGallery } from "./photoLayout";
import { useScrollLock } from "@/hooks/useScrollLock";
import { usePanicGesture } from "@/hooks/usePanicGesture";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { createFocusTrap, announceError, announceSuccess } from "@/lib/a11y";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { pauseAllAudio } from "@/lib/audioLifecycle";
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
  getJournalDraftMediaOwnerId,
  MAX_STICKERS_PER_ENTRY,
  MAX_PHOTOS_PER_ENTRY,
  MAX_AUDIO_PER_ENTRY,
  countWordsHtml,
  PAPER_COLORS,
} from "./types";
import { useJournalVoice } from "./useJournalVoice";
import { useAudioRecorder, type RecordedAudioCapture } from "./useAudioRecorder";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { safeJsonParse, storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { useDiaryTheme } from "./useDiaryTheme";
import { sanitizeRichContent } from "@/lib/sanitize";
import { getJournalEditorContent } from "./journalDisplay";
import { useThemeStore, type AppliedTheme } from "@/stores/themeStore";
import {
  acquireJournalDraftWriter,
  clearJournalDraft as clearDraft,
  getJournalDraftKey as getDraftKey,
  loadJournalDraft as loadDraft,
  releaseJournalDraftWriter,
  saveJournalDraft as saveDraft,
  touchJournalDraftWriter,
  JournalDraftInUseError,
  type JournalDraftData as DraftData,
} from "./journalDraftStorage";
import {
  acceptDraftPhoto,
  clearDraftPhotoCancellation,
  discardJournalDraft,
  getDraftMediaIds,
  isJournalEntryConflictError,
  markDraftPhotoCancellation,
  type JournalDraftCommitContext,
} from "./journalStorage";
import { isSupportedJournalPhotoFile, MAX_JOURNAL_PHOTO_FILE_SIZE } from "./JournalPhotoPicker";
import { normalizeJournalStyleFields } from "./journalStyleFields";
import {
  APP_RELOAD_PREPARE_EVENT,
  type AppReloadPrepareDetail,
} from "@/lib/versionCheck";
import {
  ACCOUNT_BOUNDARY_WRITERS_RESUMED_EVENT,
  ACCOUNT_BOUNDARY_WRITERS_SUSPENDED_EVENT,
  areAccountBoundaryWritersSuspended,
} from "@/lib/accountBoundaryState";
import type { JournalSaveCompletion } from "./save-ceremony/journalSaveCeremonyContract";

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
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : "";
  return ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name);
}

function getAudioStartFailureMessage(ts: TranslationStrings, error: unknown): string {
  if (isMicrophonePermissionError(error)) {
    return (
      ts.journalAudioPermissionDenied ||
      ts.journalAudioError ||
      "Microphone permission is needed to record audio."
    );
  }
  const errorName =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : "";
  if (["NotFoundError", "DevicesNotFoundError"].includes(errorName)) {
    return (
      ts.journalAudioInputMissing ||
      "No microphone was found. You can keep writing without audio."
    );
  }
  if (["NotReadableError", "TrackStartError"].includes(errorName)) {
    return (
      ts.journalAudioInputUnavailable ||
      "The microphone is busy or unavailable. You can keep writing and try again later."
    );
  }
  return (
    ts.journalAudioStartError ||
    "The microphone could not start. You can keep writing without audio."
  );
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
  milestonesEnabled?: boolean;
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
    photoLayout?: Record<
      string,
      { x: number; y: number; width: number; description?: string }
    >;
  }, draftContext: JournalDraftCommitContext) => Promise<JournalSaveCompletion | void>;
  onAddPhoto: (file: File, entryId: string, signal?: AbortSignal) => Promise<JournalPhoto>;
  onRemovePhoto: (photoId: string, entryId: string) => Promise<void>;
  onAddAudio: (
    data: string,
    duration: number,
    mimeType: string,
    entryId: string
  ) => Promise<JournalAudio>;
  onRemoveAudio: (audioId: string, entryId: string) => Promise<void>;
  onDelete?: () => boolean | void | Promise<boolean | void>;
  onBack: () => void;
  onExitRequestCancelled?: () => void;
  onToggleHabit?: (habitId: string, date: string) => void;
  onAddGratitude?: (entry: import("@/types").GratitudeEntry) => void;
}

// ── Hook ──

export function useJournalEditorState(props: JournalEditorStateProps) {
  const {
    entry,
    entryPrefill,
    desktop = false,
    milestonesEnabled = true,
    onSave,
    onAddPhoto,
    onRemovePhoto,
    onAddAudio,
    onRemoveAudio,
    onDelete,
    onBack,
    onExitRequestCancelled,
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
  const recordingPersistenceRef = useRef<{
    data: string;
    promise: Promise<string[]>;
  } | null>(null);
  const recordingDiscardGenerationRef = useRef(0);
  const committedVoiceTranscriptRef = useRef("");
  const persistDraftOnUnmountRef = useRef<(() => Promise<boolean>) | null>(null);
  const draftPersistenceSuppressedRef = useRef(false);
  const accountBoundaryWritersSuspendedRef = useRef(
    areAccountBoundaryWritersSuspended(),
  );

  const draftKey = getDraftKey(entry?.id || null);
  const draftMediaOwnerId = getJournalDraftMediaOwnerId(entry?.id || null);
  const draftWriterIdRef = useRef(generateId());

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
  const [audioLoadRetryAvailable, setAudioLoadRetryAvailable] = useState(false);
  const [audioLoadAttempt, setAudioLoadAttempt] = useState(0);
  const [audioSaveRetryAvailable, setAudioSaveRetryAvailable] = useState(false);
  const [audioSaveAttempt, setAudioSaveAttempt] = useState(0);
  const [audioRemovalPendingId, setAudioRemovalPendingId] = useState<string | null>(null);
  const [audioRemovalSubmitting, setAudioRemovalSubmitting] = useState(false);
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
  const [saveFailureReason, setSaveFailureReason] = useState<"generic" | "conflict" | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveStartRef = useRef(0);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const saveCommittedRef = useRef(false);
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
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const deleteSubmittingRef = useRef(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [discardSubmitting, setDiscardSubmitting] = useState(false);
  const discardSubmittingRef = useRef(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const [showSettingsConfirm, setShowSettingsConfirm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showRecordingOverlay, setShowRecordingOverlay] = useState(false);
  const [recordingDiscardPending, setRecordingDiscardPending] = useState(false);
  const [showVoicePrivacyConfirm, setShowVoicePrivacyConfirm] = useState(false);
  const [voicePrivacyAccepted, setVoicePrivacyAccepted] = useState(false);
  const [showPromptsDropdown, setShowPromptsDropdown] = useState(false);

  useEffect(() => {
    if (!showDeleteConfirm) setDeleteError(null);
  }, [showDeleteConfirm]);

  // === Draft State ===
  const [draftAvailable, setDraftAvailable] = useState<DraftData | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState(0);
  const [draftLoadState, setDraftLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [draftLoadFailureReason, setDraftLoadFailureReason] = useState<
    "generic" | "in-use" | null
  >(null);
  const [draftDismissSubmitting, setDraftDismissSubmitting] = useState(false);
  const [draftDismissError, setDraftDismissError] = useState<string | null>(null);

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
  type PhotoLayoutMap = NonNullable<JournalEntry["photoLayout"]>;
  const [photoLayout, setPhotoLayoutState] = useState<PhotoLayoutMap>(entry?.photoLayout || {});
  const photoLayoutRef = useRef<PhotoLayoutMap>(entry?.photoLayout || {});
  const setPhotoLayout = useCallback<Dispatch<SetStateAction<PhotoLayoutMap>>>((next) => {
    const resolved =
      typeof next === "function" ? next(photoLayoutRef.current) : next;
    photoLayoutRef.current = resolved;
    setPhotoLayoutState(resolved);
  }, []);

  // === Widget State ===
  const [showBreathe, setShowBreathe] = useState(false);
  const [showHabits, setShowHabits] = useState(false);

  // === Privacy State ===
  const [privacyShieldActive, setPrivacyShieldActive] = useState(false);
  const [panicLocked, setPanicLocked] = useState(false);

  // === Format Hint ===
  const [formatHintDismissed] = useState(
    () => !!storageGetRaw(SK.DIARY_FORMAT_HINT_SEEN)
  );

  // === Prompt State ===
  const [promptSeed, setPromptSeed] = useState(0);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const paperColors = PAPER_COLORS[paperColor];
  const entryId = entry?.id || draftMediaOwnerId;
  const isExistingEntry = Boolean(entry?.id);

  // === Voice dictation + audio recording hooks ===
  const voice = useJournalVoice(language);
  const recorder = useAudioRecorder();
  const { audioData, isRecording, duration, mimeType, reset: resetRecorder } = recorder;
  const wasListeningRef = useRef(false);

  // Concealment must also silence private media and stop active capture.
  const handlePanic = useCallback(() => {
    pauseAllAudio();
    setShowVoicePrivacyConfirm(false);
    setRecordingDiscardPending(false);
    if (voice.isListening) {
      void voice.stop().catch((error) =>
        logger.warn("[Journal] Panic dictation stop failed:", error)
      );
    }
    const wasRequestingPermission = recorder.isRequestingPermission;
    if (recorder.isRecording || recorder.isRequestingPermission || recorder.isFinalizing) {
      void recorder.stop().catch((error) =>
        logger.warn("[Journal] Panic recording stop failed:", error)
      );
    }
    if (wasRequestingPermission) setShowRecordingOverlay(false);
    setPanicLocked(true);
  }, [recorder, voice]);
  usePanicGesture(true, handlePanic);

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
      JSON.stringify(photoLayout) !== init.photoLayout ||
      voice.isListening ||
      Boolean(voice.transcript.trim()) ||
      recorder.isRecording ||
      recorder.isFinalizing ||
      recorder.isRequestingPermission ||
      Boolean(audioData)
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
    voice.isListening,
    voice.transcript,
    recorder.isRecording,
    recorder.isFinalizing,
    recorder.isRequestingPermission,
    audioData,
  ]);

  const wordCount = useMemo(() => countWordsHtml(content), [content]);

  // === Milestone detection (fires only on upward crossing during editing) ===
  useEffect(() => {
    if (!milestonesEnabled) {
      prevWordCountRef.current = wordCount;
      setMilestoneTriggered(null);
      setShowConfetti(false);
      return;
    }
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
  }, [wordCount, MILESTONES, milestonesEnabled]);

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
    voice.isListening ||
    voice.transcript.trim() ||
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

  const commitVoiceTranscript = useCallback((rawTranscript: string) => {
    const transcript = rawTranscript.trim();
    if (!transcript || committedVoiceTranscriptRef.current === transcript) return;

    const liveEditor = editorRef.current;
    const editor = liveEditor ?? document.createElement("div");
    if (!liveEditor) editor.innerHTML = sanitizeRichContent(contentRef.current);

    const existingText = editor.textContent || "";
    const separator = existingText && !/\s$/.test(existingText) ? " " : "";
    editor.appendChild(document.createTextNode(`${separator}${transcript}`));

    const nextContent = sanitizeRichContent(editor.innerHTML);
    contentRef.current = nextContent;
    setContent(nextContent);
    if (liveEditor && liveEditor.innerHTML !== nextContent) {
      liveEditor.innerHTML = nextContent;
    }
    committedVoiceTranscriptRef.current = transcript;
  }, []);

  const saveDraftSnapshot = useCallback(
    async (nextAudioIds = audioIdsRef.current) => {
      if (draftLoadState !== "ready") return;
      if (accountBoundaryWritersSuspendedRef.current) return;
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
      }, draftWriterIdRef.current);
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
      draftLoadState,
    ]
  );

  // === Effects ===

  useEffect(() => {
    const suspendWriters = () => {
      accountBoundaryWritersSuspendedRef.current = true;
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
    const resumeWriters = () => {
      accountBoundaryWritersSuspendedRef.current = false;
    };

    window.addEventListener(ACCOUNT_BOUNDARY_WRITERS_SUSPENDED_EVENT, suspendWriters);
    window.addEventListener(ACCOUNT_BOUNDARY_WRITERS_RESUMED_EVENT, resumeWriters);
    return () => {
      window.removeEventListener(ACCOUNT_BOUNDARY_WRITERS_SUSPENDED_EVENT, suspendWriters);
      window.removeEventListener(ACCOUNT_BOUNDARY_WRITERS_RESUMED_EVENT, resumeWriters);
    };
  }, []);

  const retryDraftLoad = useCallback(async () => {
    setDraftLoadState("loading");
    setDraftLoadFailureReason(null);
    try {
      await acquireJournalDraftWriter(draftKey, draftWriterIdRef.current);
      const [draft, recoveredMedia] = await Promise.all([
        loadDraft(draftKey),
        getDraftMediaIds(draftMediaOwnerId),
      ]);
      const hasRecoveredMedia =
        recoveredMedia.photoIds.length > 0 || recoveredMedia.audioIds.length > 0;
      let recoverableDraft = draft;
      if (hasRecoveredMedia) {
        const initial = initialSnapshotRef.current;
        const baseDraft: DraftData =
          draft ?? {
            title: initial.title,
            date: initial.date,
            content: initial.content,
            stickers: safeJsonParse<string[]>(initial.stickers, []),
            photoIds: safeJsonParse<string[]>(initial.photoIds, []),
            audioIds: safeJsonParse<string[]>(initial.audioIds, []),
            mood: initial.mood,
            tags: safeJsonParse<string[]>(initial.tags, []),
            habitSnapshot: safeJsonParse<DraftData["habitSnapshot"]>(
              initial.habitSnapshot,
              [],
            ),
            savedAt: Date.now(),
            theme: initial.theme,
            font: initial.font,
            inkColor: initial.inkColor,
            paperTexture: initial.paperTexture,
            paperColor: initial.paperColor,
            bgIntensity: initial.bgIntensity,
            particleSpeed: initial.particleSpeed,
            bgPattern: initial.bgPattern,
            fontSize: initial.fontSize,
            photoLayout: safeJsonParse<DraftData["photoLayout"]>(initial.photoLayout, {}),
          };
        recoverableDraft = {
          ...baseDraft,
          photoIds: [...new Set([...baseDraft.photoIds, ...recoveredMedia.photoIds])],
          audioIds: [
            ...new Set([...(baseDraft.audioIds || []), ...recoveredMedia.audioIds]),
          ],
        };
      }
      setDraftAvailable(recoverableDraft);
      if (recoverableDraft) setShowTemplatePicker(false);
      setDraftLoadState("ready");
    } catch (error) {
      logger.warn("[Journal] Draft load failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      const code = (error as { code?: unknown } | null)?.code;
      setDraftLoadFailureReason(code === "JOURNAL_DRAFT_IN_USE" ? "in-use" : "generic");
      setDraftLoadState("error");
    }
  }, [draftKey, draftMediaOwnerId]);

  // Read completion is a write prerequisite: an unreadable draft must never be
  // mistaken for an empty slot and replaced by autosave.
  useEffect(() => {
    void retryDraftLoad();
  }, [retryDraftLoad]);

  useEffect(() => {
    if (draftLoadState !== "ready") return;
    let active = true;
    const touchWriter = async () => {
      try {
        const stillOwned = await touchJournalDraftWriter(draftKey, draftWriterIdRef.current);
        if (active && !stillOwned) {
          setDraftLoadFailureReason("in-use");
          setDraftLoadState("error");
        }
      } catch (error) {
        logger.warn("[Journal] Draft ownership check failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        if (active) {
          setDraftLoadFailureReason("generic");
          setDraftLoadState("error");
        }
      }
    };
    const interval = window.setInterval(() => void touchWriter(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void touchWriter();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", touchWriter);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", touchWriter);
    };
  }, [draftKey, draftLoadState]);

  // Auto-save draft (3s debounce)
  useEffect(() => {
    if (draftLoadState !== "ready") return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      void saveDraftSnapshot(audioIds).catch((err) => {
        logger.warn("[Journal] Draft autosave failed:", err);
        setSaveFailureReason("generic");
        setSaveState("error");
      });
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
    draftLoadState,
  ]);

  // Flush the newest snapshot on route/component teardown. The ref avoids
  // re-running cleanup whenever the snapshot callback changes.
  useEffect(() => {
    const writerId = draftWriterIdRef.current;
    return () => {
      if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      if (contentSyncRef.current) clearTimeout(contentSyncRef.current);
      const releaseWriter = () =>
        releaseJournalDraftWriter(draftKey, writerId).catch((error) => {
          logger.warn("[Journal] Draft ownership release failed", {
            name: error instanceof Error ? error.name : "UnknownError",
          });
        });
      if (draftPersistenceSuppressedRef.current) {
        void releaseWriter();
        return;
      }
      void (persistDraftOnUnmountRef.current?.() ?? Promise.resolve(false))
        .catch((error) => {
          logger.warn("[Journal] Unmount draft save failed", {
            name: error instanceof Error ? error.name : "UnknownError",
          });
        })
        .finally(releaseWriter);
    };
  }, [draftKey]);

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

  useEffect(() => {
    if (desktop || !editorOverlayRef.current) return;
    const appRoot = document.getElementById("root");
    if (!appRoot || appRoot.contains(editorOverlayRef.current)) return;

    const previousInert = appRoot.inert;
    const previousAriaHidden = appRoot.getAttribute("aria-hidden");
    appRoot.inert = true;
    appRoot.setAttribute("aria-hidden", "true");

    return () => {
      appRoot.inert = previousInert;
      if (previousAriaHidden === null) {
        appRoot.removeAttribute("aria-hidden");
      } else {
        appRoot.setAttribute("aria-hidden", previousAriaHidden);
      }
    };
  }, [desktop]);

  // Load existing audio recordings for editing
  useEffect(() => {
    let cancelled = false;

    if (entry?.audioIds && entry.audioIds.length > 0) {
      const loadAudio = async () => {
        try {
          const { getAudioForEntry } = await import("./journalStorage");
          const recordings = await getAudioForEntry(entry.id);
          if (!cancelled) {
            setAudioRecordings(recordings);
            setAudioLoadRetryAvailable(false);
            setAudioError(null);
          }
        } catch (err) {
          const message =
            ts.journalAudioLoadError || "This entry's audio could not be loaded.";
          logger.warn("[Journal]", "Audio load failed:", err);
          if (!cancelled) {
            setAudioRecordings([]);
            setAudioLoadRetryAvailable(true);
            setAudioError(message);
            announceError(message);
          }
        }
      };

      void loadAudio();
    } else {
      setAudioRecordings([]);
      setAudioLoadRetryAvailable(false);
    }

    return () => {
      cancelled = true;
    };
  }, [audioLoadAttempt, entry?.audioIds, entry?.id, ts.journalAudioLoadError]);

  const retryAudioLoad = useCallback(() => {
    setAudioLoadRetryAvailable(false);
    setAudioError(null);
    setAudioLoadAttempt((attempt) => attempt + 1);
  }, []);

  // Commit the final transcript into both React state and the uncontrolled editor DOM.
  useEffect(() => {
    if (wasListeningRef.current && !voice.isListening && voice.transcript) {
      commitVoiceTranscript(voice.transcript);
    }
    wasListeningRef.current = voice.isListening;
  }, [commitVoiceTranscript, voice.isListening, voice.transcript]);

  useEffect(() => {
    if (!voice.error) return;
    const message =
      ts.journalVoiceError ||
      "Voice input stopped. Your recognized words are still here. Try again when you're ready.";
    setAudioError(message);
    announceError(message);
  }, [ts.journalVoiceError, voice.error]);

  const persistCapturedRecording = useCallback(
    (captured: RecordedAudioCapture, checkpointDraft: boolean): Promise<string[]> => {
      const activePersistence = recordingPersistenceRef.current;
      if (activePersistence?.data === captured.data) return activePersistence.promise;
      if (saveHandledAudioDataRef.current === captured.data) {
        return Promise.resolve(audioIdsRef.current);
      }

      saveHandledAudioDataRef.current = captured.data;
      const persistenceGeneration = recordingDiscardGenerationRef.current;
      const persistence = (async () => {
        try {
          const audio = await onAddAudio(
            captured.data,
            captured.duration,
            captured.mimeType,
            draftMediaOwnerId
          );
          if (recordingDiscardGenerationRef.current !== persistenceGeneration) {
            try {
              await onRemoveAudio(audio.id, draftMediaOwnerId);
            } catch (cleanupError) {
              const message =
                ts.journalAudioRemoveError || "This recording could not be removed.";
              logger.error("[Journal] Discarded audio cleanup failed:", cleanupError);
              setAudioError(message);
              announceError(message);
              throw cleanupError;
            }
            return audioIdsRef.current;
          }
          if (isExistingEntry) stagedAddedAudioIdsRef.current.add(audio.id);
          const nextAudioIds = [...audioIdsRef.current, audio.id];
          audioIdsRef.current = nextAudioIds;
          setAudioError(null);
          setAudioNotice(ts.journalAudioSaved || "Audio saved");
          setAudioSaveRetryAvailable(false);
          setAudioIds(nextAudioIds);
          setAudioRecordings((prev) => [...prev, audio]);
          if (checkpointDraft) {
            void saveDraftSnapshot(nextAudioIds).catch((err) => {
              logger.warn("[Journal] Recording draft save failed:", err);
              setSaveFailureReason("generic");
              setSaveState("error");
            });
          }
          resetRecorder();
          setShowRecordingOverlay(false);
          return nextAudioIds;
        } catch (err) {
          const message = ts.journalAudioError || "Failed to save audio";
          logger.warn("[Journal]", "Audio save failed:", err);
          setAudioError(message);
          setAudioSaveRetryAvailable(true);
          setShowRecordingOverlay(true);
          announceError(message);
          throw err;
        }
      })();
      const trackedPersistence = persistence.finally(() => {
        if (recordingPersistenceRef.current?.promise === trackedPersistence) {
          recordingPersistenceRef.current = null;
        }
      });
      recordingPersistenceRef.current = { data: captured.data, promise: trackedPersistence };
      return trackedPersistence;
    },
    [
      draftMediaOwnerId,
      isExistingEntry,
      onAddAudio,
      onRemoveAudio,
      resetRecorder,
      saveDraftSnapshot,
      ts,
    ]
  );

  // Handle completed audio recording through the same exactly-once persistence
  // promise used by Save, lifecycle flushes, and retry handling.
  useEffect(() => {
    if (!audioData || isRecording) return;
    void persistCapturedRecording(
      { data: audioData, duration, mimeType },
      true,
    ).catch(() => {
      // The persistence callback exposes the retry state and accessible error.
    });
  }, [audioData, audioSaveAttempt, duration, isRecording, mimeType, persistCapturedRecording]);

  const retryAudioSave = useCallback(() => {
    if (!audioData || isRecording) return;
    saveHandledAudioDataRef.current = null;
    recordingPersistenceRef.current = null;
    setAudioError(null);
    setAudioSaveRetryAvailable(false);
    setAudioSaveAttempt((attempt) => attempt + 1);
  }, [audioData, isRecording]);

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
    if (saveInFlightRef.current || saveCommittedRef.current) return;
    if (
      isDirty ||
      contentRef.current !== initialSnapshotRef.current.content ||
      voice.isListening ||
      Boolean(voice.transcript.trim())
    ) {
      setShowUnsavedDialog(true);
    } else {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = undefined;
      }
      // An offered recovery draft is separate from the untouched editor state.
      // Preserve it until the user explicitly restores or dismisses it.
      if (!draftAvailable) void clearDraft(draftKey);
      onBack();
    }
  }, [draftAvailable, isDirty, draftKey, onBack, voice.isListening, voice.transcript]);

  const flushActiveDictation = useCallback(async () => {
    const finalTranscript = voice.isListening
      ? await voice.stop()
      : voice.transcript;
    commitVoiceTranscript(finalTranscript);
    return finalTranscript;
  }, [commitVoiceTranscript, voice]);

  const flushActiveRecordingForSave = useCallback(
    (force = false): Promise<string[]> => {
      if (recordingPersistenceRef.current) {
        return recordingPersistenceRef.current.promise;
      }
      if (!force && !recorder.isRecording) return Promise.resolve(audioIdsRef.current);
      return (async () => {
        const captured = await recorder.stop();
        if (!captured?.data) return audioIdsRef.current;
        return persistCapturedRecording(captured, false);
      })();
    },
    [persistCapturedRecording, recorder]
  );

  const handleSave = useCallback((): Promise<void> => {
    if (!hasContent || draftLoadState !== "ready") return Promise.resolve();
    if (saveCommittedRef.current) return Promise.resolve();
    if (saveInFlightRef.current) return saveInFlightRef.current;

    const savePromise = (async () => {
    // Final recognition events can arrive after stop(); await them before serializing.
    await flushActiveDictation();
    setSaveState("saving");
    setSaveFailureReason(null);
    saveStartRef.current = Date.now();
    try {
      const shouldFlushRecording = recorder.isRecording || showRecordingOverlay;
      const audioIdsForSave = shouldFlushRecording
        ? await flushActiveRecordingForSave(shouldFlushRecording)
        : audioIdsRef.current;

      const saveCompletion = await onSave(
        {
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
          photoLayout:
            Object.keys(photoLayoutRef.current).length > 0
              ? photoLayoutRef.current
              : undefined,
        },
        { draftKey, mediaOwnerId: draftMediaOwnerId, writerId: draftWriterIdRef.current },
      );
      saveCommittedRef.current = true;
      if (isExistingEntry) {
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
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = undefined;
      }
      // The storage-layer save transaction owns draft + lease deletion. Repeating that
      // cleanup here can falsely turn an already durable entry into a failed save.
      draftPersistenceSuppressedRef.current = true;
      announceSuccess(ts.journalEntrySaved || "Entry saved");
      setSaveState("saved");
      setSaveSuccess(true);
      // Auto-transition saved -> idle after 2s
      setTimeout(() => setSaveState("idle"), 2000);
      if (!saveCompletion?.feedbackHandled) {
        try {
          const { playSuccess } = await import("@/lib/audioManager");
          playSuccess();
        } catch {
          /* graceful: celebration audio is decorative */
        }
        void hapticSuccess();
      }
      // Navigate after brief celebration
      navigationTimeoutRef.current = setTimeout(() => onBack(), 600);
    } catch (err) {
      const conflict = isJournalEntryConflictError(err);
      setSaveFailureReason(conflict ? "conflict" : "generic");
      setSaveState("error");
      if (conflict) {
        announceError(
          ts.journalSaveConflictHint ||
            "This entry changed elsewhere. Your edits are still here. Reopen it before saving.",
        );
      }
      logger.warn("[Journal] Save failed:", err);
    }
    })();

    const trackedSavePromise = savePromise.finally(() => {
      if (saveInFlightRef.current === trackedSavePromise) {
        saveInFlightRef.current = null;
      }
    });
    saveInFlightRef.current = trackedSavePromise;
    return trackedSavePromise;
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
    draftMediaOwnerId,
    hasContent,
    showRecordingOverlay,
    ts,
    flushActiveDictation,
    recorder,
    flushActiveRecordingForSave,
    isExistingEntry,
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
    draftLoadState,
  ]);

  const handleRetry = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const handleSaveAndClose = useCallback(async () => {
    setShowUnsavedDialog(false);
    await handleSave();
  }, [handleSave]);

  const persistDraftNow = useCallback(async (audioIdsForDraft = audioIdsRef.current) => {
    if (draftLoadState !== "ready") return false;
    if (accountBoundaryWritersSuspendedRef.current) return false;
    const hasDraftPayload = Boolean(
      title.trim() ||
      contentRef.current.trim() ||
      stickers.length > 0 ||
      photoIds.length > 0 ||
      audioIdsForDraft.length > 0 ||
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
      audioIds: audioIdsForDraft,
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
      photoLayout: photoLayoutRef.current,
      savedAt,
    }, draftWriterIdRef.current);
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
    draftLoadState,
  ]);

  const checkpointPhotoLayout = useCallback(async () => {
    try {
      return await persistDraftNow();
    } catch (error) {
      logger.warn("[Journal] Photo layout checkpoint failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      setSaveFailureReason("generic");
      setSaveState("error");
      return false;
    }
  }, [persistDraftNow]);

  const persistDraftWithActiveRecording = useCallback(async () => {
    await flushActiveDictation();
    const shouldFlushRecording = recorder.isRecording || showRecordingOverlay;
    const audioIdsForDraft = shouldFlushRecording
      ? await flushActiveRecordingForSave(true)
      : audioIdsRef.current;
    return persistDraftNow(audioIdsForDraft);
  }, [
    flushActiveRecordingForSave,
    flushActiveDictation,
    persistDraftNow,
    recorder.isRecording,
    showRecordingOverlay,
  ]);

  persistDraftOnUnmountRef.current = persistDraftWithActiveRecording;

  useEffect(() => {
    const flushDraftForBackground = () => {
      void persistDraftWithActiveRecording().catch((err) => {
        logger.warn("[Journal] Background draft save failed:", err);
        setSaveFailureReason("generic");
        setSaveState("error");
      });
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
  }, [persistDraftWithActiveRecording]);

  useEffect(() => {
    const flushDraftBeforeReload = (event: Event) => {
      const detail = (event as CustomEvent<AppReloadPrepareDetail>).detail;
      if (!detail?.waitUntil) return;
      detail.waitUntil(
        (async () => {
          await flushActiveDictation();
          const shouldFlushRecording = recorder.isRecording || showRecordingOverlay;
          const audioIdsForDraft = shouldFlushRecording
            ? await flushActiveRecordingForSave(true)
            : audioIdsRef.current;
          const saved = await persistDraftNow(audioIdsForDraft);
          if ((isDirty || hasContent || shouldFlushRecording) && !saved) {
            throw new Error("Journal draft was not persisted before app reload");
          }
        })()
      );
    };

    window.addEventListener(APP_RELOAD_PREPARE_EVENT, flushDraftBeforeReload);
    return () => window.removeEventListener(APP_RELOAD_PREPARE_EVENT, flushDraftBeforeReload);
  }, [
    flushActiveRecordingForSave,
    flushActiveDictation,
    hasContent,
    isDirty,
    persistDraftNow,
    recorder.isRecording,
    showRecordingOverlay,
  ]);

  const discardCurrentJournalDraft = useCallback(async () => {
    await discardJournalDraft({
      draftKey,
      mediaOwnerId: draftMediaOwnerId,
      writerId: draftWriterIdRef.current,
    });
    stagedAddedPhotoIdsRef.current.clear();
    stagedAddedAudioIdsRef.current.clear();
    stagedRemovedPhotoIdsRef.current.clear();
    stagedRemovedAudioIdsRef.current.clear();
  }, [draftKey, draftMediaOwnerId]);

  const handleDiscard = useCallback(async (): Promise<boolean> => {
    if (discardSubmittingRef.current || saveInFlightRef.current || draftLoadState !== "ready") return false;
    discardSubmittingRef.current = true;
    setDiscardSubmitting(true);
    setDiscardError(null);
    try {
      await discardCurrentJournalDraft();
      draftPersistenceSuppressedRef.current = true;
      setShowUnsavedDialog(false);
      onBack();
      return true;
    } catch (error) {
      logger.warn("[Journal] Discard cleanup failed:", error);
      setDiscardError(
        ts.journalDiscardFailed || "Couldn't discard these changes. Try again."
      );
      return false;
    } finally {
      discardSubmittingRef.current = false;
      setDiscardSubmitting(false);
    }
  }, [discardCurrentJournalDraft, draftLoadState, onBack, ts]);

  const handleDelete = useCallback(async (): Promise<boolean> => {
    if (deleteSubmittingRef.current || saveInFlightRef.current || draftLoadState !== "ready") return false;
    deleteSubmittingRef.current = true;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      if (isExistingEntry) {
        if (!onDelete) throw new Error("Existing diary entry deletion is unavailable");
        await persistDraftNow();
        if (draftTimerRef.current) {
          clearTimeout(draftTimerRef.current);
          draftTimerRef.current = undefined;
        }
        // Keep the recovery draft throughout the undo window. The permanent
        // delete removes the entry and its draft atomically in journalStorage.
        draftPersistenceSuppressedRef.current = true;
        const deleteStaged = await onDelete();
        if (deleteStaged === false) {
          throw new Error("Existing diary entry deletion was not staged");
        }
      } else {
        await discardCurrentJournalDraft();
        draftPersistenceSuppressedRef.current = true;
      }
      setShowDeleteConfirm(false);
      return true;
    } catch (error) {
      draftPersistenceSuppressedRef.current = false;
      logger.warn("[Journal] Entry deletion preparation failed:", error);
      setDeleteError(ts.journalDeleteFailed || "Couldn't delete the entry. Try again.");
      return false;
    } finally {
      deleteSubmittingRef.current = false;
      setDeleteSubmitting(false);
    }
  }, [discardCurrentJournalDraft, draftLoadState, isExistingEntry, onDelete, persistDraftNow, ts]);

  // Keyboard shortcuts: Escape to close overlays/go back, Ctrl+Enter to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (
        !panicLocked &&
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "l"
      ) {
        e.preventDefault();
        handlePanic();
        return;
      }
      if (e.key === "Escape") {
        if (panicLocked || audioRemovalPendingId) {
          e.preventDefault();
          return;
        }
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
          return;
        }
        if (showTemplatePicker) {
          setShowTemplatePicker(false);
          return;
        }
        if (showDeleteConfirm) {
          if (deleteSubmittingRef.current) {
            e.preventDefault();
            return;
          }
          setShowDeleteConfirm(false);
          return;
        }
        if (showUnsavedDialog) {
          if (discardSubmittingRef.current) {
            e.preventDefault();
            return;
          }
          setShowUnsavedDialog(false);
          onExitRequestCancelled?.();
          return;
        }
        if (showSettingsConfirm) {
          setShowSettingsConfirm(false);
          return;
        }
        handleBack();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "Enter" &&
        hasContent &&
        saveState !== "saving" &&
        !saveCommittedRef.current
      ) {
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
    recordingDiscardPending,
    showTemplatePicker,
    showDeleteConfirm,
    deleteSubmitting,
    showUnsavedDialog,
    discardSubmitting,
    showSettingsConfirm,
    panicLocked,
    audioRemovalPendingId,
    handlePanic,
    handleBack,
    handleSave,
    hasContent,
    saveState,
    recorder,
    onExitRequestCancelled,
  ]);

  // Android back button (priority order)
  useEffect(() => {
    if (showUnsavedDialog)
      return registerModalCloseCallback(() => {
        if (discardSubmittingRef.current) return true;
        setShowUnsavedDialog(false);
        onExitRequestCancelled?.();
        return true;
      });
    if (showSettingsConfirm)
      return registerModalCloseCallback(() => {
        setShowSettingsConfirm(false);
        return true;
      });
    if (showDeleteConfirm)
      return registerModalCloseCallback(() => {
        if (deleteSubmittingRef.current) return true;
        setShowDeleteConfirm(false);
        return true;
      });
    if (showRecordingOverlay)
      return registerModalCloseCallback(() => {
        if (recordingDiscardPending) {
          setRecordingDiscardPending(false);
          return true;
        }
        if (audioSaveRetryAvailable) {
          setRecordingDiscardPending(true);
          return true;
        }
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
    discardSubmitting,
    showDeleteConfirm,
    deleteSubmitting,
    showRecordingOverlay,
    recordingDiscardPending,
    audioSaveRetryAvailable,
    showVoicePrivacyConfirm,
    showTemplatePicker,
    showStickers,
    showPhotos,
    showMood,
    showTags,
    showSettingsConfirm,
    recorder,
    handleBack,
    onExitRequestCancelled,
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
            restoredAudioIds.map((audioId) =>
              getAudioById(audioId, [entryId, draftMediaOwnerId])
            )
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
    draftMediaOwnerId,
    entry?.audioIds,
    entry?.photoIds,
    entryId,
    isExistingEntry,
    setEditorContent,
    setPhotoLayout,
  ]);

  const handleDismissDraft = useCallback(async (): Promise<boolean> => {
    if (!draftAvailable || draftDismissSubmitting) return false;
    setDraftDismissSubmitting(true);
    setDraftDismissError(null);
    try {
      await discardCurrentJournalDraft();
      setDraftAvailable(null);
      return true;
    } catch (error) {
      logger.warn("[Journal] Draft dismissal cleanup failed:", error);
      setDraftDismissError(
        ts.journalDiscardFailed || "Couldn't discard this draft. Try again."
      );
      return false;
    } finally {
      setDraftDismissSubmitting(false);
    }
  }, [
    discardCurrentJournalDraft,
    draftAvailable,
    draftDismissSubmitting,
    ts,
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
    async (file: File, signal?: AbortSignal): Promise<JournalPhoto> => {
      try {
        if (draftLoadState !== "ready") {
          throw new Error("Journal draft is not ready for media writes");
        }
        signal?.throwIfAborted();
        const photo = signal
          ? await onAddPhoto(file, draftMediaOwnerId, signal)
          : await onAddPhoto(file, draftMediaOwnerId);

        const discardUnadoptedPhoto = async () => {
          try {
            await markDraftPhotoCancellation(photo.id, draftMediaOwnerId);
          } catch (markerError) {
            logger.error("[Journal] Cancelled photo marker failed", {
              name: markerError instanceof Error ? markerError.name : "UnknownError",
            });
          }
          try {
            await onRemovePhoto(photo.id, draftMediaOwnerId);
            try {
              await clearDraftPhotoCancellation(photo.id, draftMediaOwnerId);
            } catch (markerCleanupError) {
              logger.warn("[Journal] Cancelled photo marker cleanup will retry", {
                name:
                  markerCleanupError instanceof Error
                    ? markerCleanupError.name
                    : "UnknownError",
              });
            }
          } catch (cleanupError) {
            logger.error("[Journal] Cancelled photo cleanup failed", {
              name: cleanupError instanceof Error ? cleanupError.name : "UnknownError",
            });
          }
        };

        const assertDraftPhotoCanBeAdopted = async () => {
          let ownershipError: unknown = null;
          let stillOwned = false;
          try {
            signal?.throwIfAborted();
            stillOwned = await touchJournalDraftWriter(draftKey, draftWriterIdRef.current);
            signal?.throwIfAborted();
          } catch (error) {
            ownershipError = error;
          }
          const mustDiscard = signal?.aborted || !stillOwned || ownershipError !== null;
          if (!mustDiscard) return;

          await discardUnadoptedPhoto();
          if (signal?.aborted) signal.throwIfAborted();
          if (ownershipError) {
            setDraftLoadFailureReason("generic");
            setDraftLoadState("error");
            if (ownershipError instanceof Error) throw ownershipError;
            throw new Error("Journal draft ownership check failed");
          }
          setDraftLoadFailureReason("in-use");
          setDraftLoadState("error");
          throw new JournalDraftInUseError(draftKey);
        };

        await assertDraftPhotoCanBeAdopted();
        await acceptDraftPhoto(photo.id, draftMediaOwnerId);
        await assertDraftPhotoCanBeAdopted();
        if (isExistingEntry) stagedAddedPhotoIdsRef.current.add(photo.id);
        setPhotoIds((prev) => [...prev, photo.id]);
        return photo;
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          logger.error("[Journal] Photo upload failed:", error);
        }
        throw error;
      }
    },
    [
      draftKey,
      draftLoadState,
      draftMediaOwnerId,
      onAddPhoto,
      onRemovePhoto,
      isExistingEntry,
    ]
  );

  const handleRemovePhoto = useCallback(
    async (photoId: string) => {
      try {
        if (isExistingEntry) {
          if (stagedAddedPhotoIdsRef.current.has(photoId)) {
            await onRemovePhoto(photoId, draftMediaOwnerId);
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
    [draftMediaOwnerId, onRemovePhoto, entryId, isExistingEntry, setPhotoLayout]
  );

  const handleReturnToGallery = useCallback((photoId: string) => {
    setPhotoLayout((prev) => returnJournalPhotoToGallery(prev, photoId));
  }, [setPhotoLayout]);

  const handleFloatPhoto = useCallback((photoId: string) => {
    setPhotoLayout((prev) => placeJournalPhotoOnPage(prev, photoId));
    void checkpointPhotoLayout();
  }, [checkpointPhotoLayout, setPhotoLayout]);

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
    async (audioId: string): Promise<boolean> => {
      try {
        if (isExistingEntry) {
          if (stagedAddedAudioIdsRef.current.has(audioId)) {
            await onRemoveAudio(audioId, draftMediaOwnerId);
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
        setAudioError(null);
        return true;
      } catch (err) {
        const message =
          ts.journalAudioRemoveError || "This recording could not be removed.";
        logger.error("[Journal] Audio removal failed:", err);
        setAudioLoadRetryAvailable(false);
        setAudioError(message);
        announceError(message);
        return false;
      }
    },
    [draftMediaOwnerId, onRemoveAudio, entryId, isExistingEntry, ts.journalAudioRemoveError]
  );

  const requestRemoveAudio = useCallback((audioId: string) => {
    setAudioRemovalPendingId(audioId);
  }, []);

  const cancelRemoveAudio = useCallback(() => {
    if (audioRemovalSubmitting) return;
    setAudioRemovalPendingId(null);
  }, [audioRemovalSubmitting]);

  const confirmRemoveAudio = useCallback(async (): Promise<boolean> => {
    if (!audioRemovalPendingId || audioRemovalSubmitting) return false;
    setAudioRemovalSubmitting(true);
    try {
      const removed = await handleRemoveAudio(audioRemovalPendingId);
      if (removed) setAudioRemovalPendingId(null);
      return removed;
    } finally {
      setAudioRemovalSubmitting(false);
    }
  }, [audioRemovalPendingId, audioRemovalSubmitting, handleRemoveAudio]);

  const getVoiceUnsupportedMessage = useCallback(
    () =>
      ts.journalVoiceNotSupported ||
      voice.error ||
      "Speech recognition is not supported in this browser.",
    [ts.journalVoiceNotSupported, voice.error]
  );

  const handleConfirmDictation = useCallback(async () => {
    setShowVoicePrivacyConfirm(false);
    if (!voice.isSupported) {
      const message = getVoiceUnsupportedMessage();
      setAudioError(message);
      announceError(message);
      return;
    }
    pauseAllAudio();
    if (recorder.isRecording || recorder.isFinalizing) {
      try {
        await recorder.stop();
      } catch (error) {
        const message = ts.journalAudioError || "Failed to save audio";
        logger.warn("[Journal] Recording could not stop before dictation:", error);
        setAudioError(message);
        announceError(message);
        return;
      }
    }
    setVoicePrivacyAccepted(true);
    setAudioError(null);
    committedVoiceTranscriptRef.current = "";
    voice.start();
  }, [getVoiceUnsupportedMessage, recorder, ts.journalAudioError, voice]);

  const handleToggleDictation = useCallback(async () => {
    if (voice.isListening) {
      await voice.stop();
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
    pauseAllAudio();
    if (recorder.isRecording || recorder.isFinalizing) {
      try {
        await recorder.stop();
      } catch (error) {
        const message = ts.journalAudioError || "Failed to save audio";
        logger.warn("[Journal] Recording could not stop before dictation:", error);
        setAudioError(message);
        announceError(message);
        return;
      }
    }
    setAudioError(null);
    committedVoiceTranscriptRef.current = "";
    voice.start();
  }, [getVoiceUnsupportedMessage, recorder, ts.journalAudioError, voice, voicePrivacyAccepted]);

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
    pauseAllAudio();
    if (voice.isListening) {
      const finalTranscript = await voice.stop();
      commitVoiceTranscript(finalTranscript);
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
    setAudioSaveRetryAvailable(false);
    recordingDiscardGenerationRef.current += 1;
    saveHandledAudioDataRef.current = null;
    recordingPersistenceRef.current = null;
    try {
      await recorder.start();
    } catch (err) {
      setShowRecordingOverlay(false);
      const message = getAudioStartFailureMessage(ts, err);
      logger.warn("[Journal]", "Recording failed to start:", err);
      setAudioError(message);
      announceError(message);
    }
  }, [audioIds.length, commitVoiceTranscript, recorder, ts, voice]);

  const handleStopRecording = useCallback(() => {
    setRecordingDiscardPending(false);
    const wasRequestingPermission = recorder.isRequestingPermission;
    void recorder.stop()
      .then(() => {
        if (!wasRequestingPermission) return;
        resetRecorder();
        setShowRecordingOverlay(false);
      })
      .catch((error) => {
        const message = ts.journalAudioError || "Failed to save audio";
        logger.warn("[Journal] Recording failed to finalize:", error);
        setAudioError(message);
        announceError(message);
      });
    // audioData effect will handle storing
  }, [recorder, resetRecorder, ts.journalAudioError]);

  const handleDiscardRecording = useCallback(() => {
    recordingDiscardGenerationRef.current += 1;
    setRecordingDiscardPending(false);
    void recorder.discard().catch((error) =>
      logger.warn("[Journal] Recording discard failed:", error)
    );
    resetRecorder();
    setShowRecordingOverlay(false);
    setAudioError(null);
    setAudioNotice(null);
    setAudioSaveRetryAvailable(false);
    saveHandledAudioDataRef.current = null;
    recordingPersistenceRef.current = null;
  }, [recorder, resetRecorder]);

  const requestDiscardRecording = useCallback(() => {
    setRecordingDiscardPending(true);
  }, []);

  const cancelDiscardRecording = useCallback(() => {
    setRecordingDiscardPending(false);
  }, []);

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
      JSON.stringify(photoLayout) !== init.photoLayout ||
      recorder.isRecording ||
      recorder.isFinalizing ||
      recorder.isRequestingPermission ||
      Boolean(audioData)
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
    recorder.isRecording,
    recorder.isFinalizing,
    recorder.isRequestingPermission,
    audioData,
  ]);

  const hasPendingRecording =
    recorder.isRecording ||
    recorder.isFinalizing ||
    recorder.isRequestingPermission ||
    Boolean(audioData) ||
    Boolean(recordingPersistenceRef.current) ||
    showRecordingOverlay;

  const handleEditorInput = useCallback(() => {
    if (saveInFlightRef.current) return;
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
              "Unsupported file type. Please use JPEG, PNG, or WebP."
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
    [handleAddPhoto, photoIds.length, setPhotoLayout, syncEditorContentSoon, ts]
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
    audioLoadRetryAvailable,
    audioSaveRetryAvailable,
    audioRemovalPendingId,
    audioRemovalSubmitting,
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
    saveFailureReason,
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
    deleteSubmitting,
    deleteError,
    showUnsavedDialog,
    discardSubmitting,
    discardError,
    setShowUnsavedDialog,
    showSettingsConfirm,
    setShowSettingsConfirm,
    showTemplatePicker,
    setShowTemplatePicker,
    showRecordingOverlay,
    recordingDiscardPending,
    showVoicePrivacyConfirm,
    setShowVoicePrivacyConfirm,
    showPromptsDropdown,
    setShowPromptsDropdown,

    // draft
    draftAvailable,
    draftSavedAt,
     draftLoadError: draftLoadState === "error",
     draftLoadInUse: draftLoadFailureReason === "in-use",
    draftReady: draftLoadState === "ready",
    draftDismissSubmitting,
    draftDismissError,
    retryDraftLoad,

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
    hasPendingRecording,
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
    persistDraftWithActiveRecording,
    checkpointPhotoLayout,
    handleDiscard,
    handleDelete,
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
    requestRemoveAudio,
    cancelRemoveAudio,
    confirmRemoveAudio,
    retryAudioLoad,
    retryAudioSave,
    handleToggleDictation,
    handleConfirmDictation,
    handleStartRecording,
    handleStopRecording,
    handleDiscardRecording,
    requestDiscardRecording,
    cancelDiscardRecording,
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
