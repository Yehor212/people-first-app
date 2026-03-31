import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Check,
  Trash2,
  X,
  Calendar,
  Shuffle,
  Square,
  Sparkles,
  Eye,
  EyeOff,
  Fingerprint,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getToday } from "@/lib/utils";
import { zenMotion } from "@/lib/animationUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocale } from "@/lib/timeUtils";
import { useScrollLock } from "@/hooks/useScrollLock";
import { usePanicGesture } from "@/hooks/usePanicGesture";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { createFocusTrap, announceSuccess } from "@/lib/a11y";
import { hapticSuccess } from "@/lib/haptics";
import type {
  JournalEntry,
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
  MAX_PHOTOS_PER_ENTRY,
  MAX_STICKERS_PER_ENTRY,
  MAX_AUDIO_PER_ENTRY,
  countWordsHtml,
  FONT_SIZES,
  PAPER_COLORS,
  PAPER_TEXTURE_NAMES,
} from "./types";
import { BG_PATTERN_LIST, getBgPatternStyle, getPaperTextureStyle } from "./diaryBgPatterns";
import { JournalStickerPicker } from "./JournalStickerPicker";
import { JournalPhotoPicker } from "./JournalPhotoPicker";
import { JournalPhotoGallery } from "./JournalPhotoGallery";
import { JournalAudioPlayer } from "./JournalAudioPlayer";
import { StickerRenderer } from "./StickerRenderer";
import { JournalTemplatePicker } from "./JournalTemplatePicker";
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
import { JournalHabitSection } from "./JournalHabitSection";
import { useDiaryTheme } from "./useDiaryTheme";
import { DiaryCanvas } from "./DiaryCanvas";
import { BurnThoughtWidget } from "./BurnThoughtWidget";
import { GratitudeBloomWidget } from "./GratitudeBloomWidget";
import { DiaryBreatheWidget } from "./DiaryBreatheWidget";
import { ZenFocusMode } from "./ZenFocusMode";
import { PrivacyShield } from "./PrivacyShield";
import { FloatingMediaLayer } from "./FloatingMediaLayer";
import { DiaryFormatToolbar } from "./DiaryFormatToolbar";
import { DiaryFormatHint } from "./DiaryFormatHint";
import { sanitizeRichContent } from "@/lib/sanitize";
import { DIARY_FONTS, DIARY_FONT_NAMES } from "./types";

// Local aliases to avoid name collision with the hook's `theme` state
const DIARY_FONTS_LOCAL = DIARY_FONTS;
const DIARY_FONT_NAMES_LOCAL = DIARY_FONT_NAMES;

const ATMOSPHERE_THEMES = [
  {
    name: "dark" as const,
    i18nKey: "diaryThemeCosmos",
    label: "Cosmos",
    activeBg: "bg-purple-500/15",
    activeText: "text-purple-400",
    activeBorder: "border-purple-500/30",
  },
  {
    name: "ocean" as const,
    i18nKey: "diaryThemeOcean",
    label: "Ocean",
    activeBg: "bg-cyan-500/15",
    activeText: "text-cyan-400",
    activeBorder: "border-cyan-500/30",
  },
  {
    name: "forest" as const,
    i18nKey: "diaryThemeForest",
    label: "Forest",
    activeBg: "bg-emerald-500/15",
    activeText: "text-emerald-400",
    activeBorder: "border-emerald-500/30",
  },
  {
    name: "sunset" as const,
    i18nKey: "diaryThemeSunset",
    label: "Sunset",
    activeBg: "bg-orange-500/15",
    activeText: "text-orange-400",
    activeBorder: "border-orange-500/30",
  },
  {
    name: "lavender" as const,
    i18nKey: "diaryThemeLavender",
    label: "Lavender",
    activeBg: "bg-violet-500/15",
    activeText: "text-violet-400",
    activeBorder: "border-violet-500/30",
  },
  {
    name: "rose" as const,
    i18nKey: "diaryThemeRose",
    label: "Rose",
    activeBg: "bg-pink-500/15",
    activeText: "text-pink-400",
    activeBorder: "border-pink-500/30",
  },
  {
    name: "midnight" as const,
    i18nKey: "diaryThemeMidnight",
    label: "Midnight",
    activeBg: "bg-blue-500/15",
    activeText: "text-blue-400",
    activeBorder: "border-blue-500/30",
  },
  {
    name: "cherry" as const,
    i18nKey: "diaryThemeCherry",
    label: "Cherry",
    activeBg: "bg-rose-500/15",
    activeText: "text-rose-400",
    activeBorder: "border-rose-500/30",
  },
];

const MOOD_OPTIONS: {
  mood: MoodType;
  emoji: string;
  activeBg: string;
  activeRing: string;
}[] = [
  {
    mood: "great",
    emoji: "\u{1F604}",
    activeBg: "bg-green-500/15",
    activeRing: "ring-green-400/40",
  },
  {
    mood: "good",
    emoji: "\u{1F642}",
    activeBg: "bg-emerald-500/15",
    activeRing: "ring-emerald-400/40",
  },
  {
    mood: "okay",
    emoji: "\u{1F610}",
    activeBg: "bg-amber-500/15",
    activeRing: "ring-amber-400/40",
  },
  {
    mood: "bad",
    emoji: "\u{1F614}",
    activeBg: "bg-orange-500/15",
    activeRing: "ring-orange-400/40",
  },
  {
    mood: "terrible",
    emoji: "\u{1F622}",
    activeBg: "bg-red-500/15",
    activeRing: "ring-red-400/40",
  },
];

const INK_COLORS = [
  { hex: "#ffffff", label: "White" },
  { hex: "#34d399", label: "Emerald" },
  { hex: "#fbbf24", label: "Gold" },
  { hex: "#fb7185", label: "Rose" },
];

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

// ── Draft helpers (IndexedDB primary, localStorage fallback) ──

interface DraftData {
  title: string;
  content: string;
  stickers: string[];
  photoIds: string[];
  audioIds?: string[];
  mood?: MoodType;
  tags: string[];
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

function formatRecordingTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getDraftKey(entryId: string | null): string {
  return SK.journalDraft(entryId || "new");
}

async function saveDraft(key: string, data: DraftData) {
  try {
    const { settingsRepo } = await import("@/storage/db");
    await settingsRepo.put({ key, value: data });
  } catch {
    // Fallback to localStorage
    safeLocalStorageSet(key, data);
  }
}

async function loadDraft(key: string): Promise<DraftData | null> {
  try {
    const { settingsRepo } = await import("@/storage/db");
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
    const { settingsRepo } = await import("@/storage/db");
    await settingsRepo.delete(key);
  } catch {
    /* non-critical */
  }
  storageRemove(key);
}

// ── Component ──

interface JournalEntryEditorProps {
  entry: JournalEntry | null;
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

export function JournalEntryEditor({
  entry,
  onSave,
  onAddPhoto,
  onRemovePhoto,
  onAddAudio,
  onRemoveAudio,
  onDelete,
  onBack,
  onToggleHabit,
  onAddGratitude,
}: JournalEntryEditorProps) {
  const { t, language } = useLanguage();
  useScrollLock(true);
  const handlePanic = useCallback(() => setPanicLocked(true), []);
  usePanicGesture(true, handlePanic);
  const ts = t as unknown as Record<string, string>;
  const editorRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const editorOverlayRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollYRef = useRef(0);
  const draftKey = getDraftKey(entry?.id || null);

  const [title, setTitle] = useState(entry?.title || "");
  const [date, setDate] = useState(entry?.date || getToday());
  const [content, setContent] = useState(entry?.content || "");
  const contentRef = useRef(entry?.content || "");
  const contentSyncRef = useRef<ReturnType<typeof setTimeout>>();
  const [stickers, setStickers] = useState<string[]>(entry?.stickers || []);
  const [photoIds, setPhotoIds] = useState<string[]>(entry?.photoIds || []);
  const [audioIds, setAudioIds] = useState<string[]>(entry?.audioIds || []);
  const [audioRecordings, setAudioRecordings] = useState<JournalAudio[]>([]);
  const [mood, setMood] = useState<MoodType | undefined>(entry?.mood);
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [habitSnapshot, setHabitSnapshot] = useState<
    {
      habitId: string;
      habitName: string;
      habitIcon: string;
      completed: boolean;
    }[]
  >(entry?.habitSnapshot || []);
  const completedHabitCount = useMemo(
    () => habitSnapshot.filter((s) => s.completed).length,
    [habitSnapshot]
  );
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [showStickers, setShowStickers] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showRecordingOverlay, setShowRecordingOverlay] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState<DraftData | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState(0);

  // ── Diary premium features ──
  const diaryTheme = useDiaryTheme(entry?.theme || "dark", entry?.font || "caveat");
  const [showStyleBar, setShowStyleBar] = useState(false);
  const [showBurnWidget, setShowBurnWidget] = useState(false);
  const [showGratitudeWidget, setShowGratitudeWidget] = useState(false);
  const [zenFocusActive, setZenFocusActive] = useState(false);
  const [, setShowActionSheet] = useState(false);
  const [, setToolbarHidden] = useState(false);
  const [bgIntensity, setBgIntensity] = useState<BackgroundIntensity>(entry?.bgIntensity || "full");
  const [particleSpeed, setParticleSpeed] = useState<ParticleSpeed>(entry?.particleSpeed || "slow");
  const [showBreathe, setShowBreathe] = useState(false);
  const [showHabits, setShowHabits] = useState(false);
  const [privacyShieldActive, setPrivacyShieldActive] = useState(false);
  const [panicLocked, setPanicLocked] = useState(false);
  const [inkColor, setInkColor] = useState(entry?.inkColor || "#ffffff");
  const [paperTexture, setPaperTexture] = useState<PaperTexture>(entry?.paperTexture || "clean");
  const [paperColor, setPaperColor] = useState<PaperColor>(entry?.paperColor || "dark");
  const [bgPattern, setBgPattern] = useState<DiaryBgPattern>(entry?.bgPattern || "none");
  const paperColors = PAPER_COLORS[paperColor];
  const [fontSize, setFontSize] = useState<FontSizeName>(entry?.fontSize || "medium");
  const [showPromptsDropdown, setShowPromptsDropdown] = useState(false);
  const [formatHintDismissed, setFormatHintDismissed] = useState(
    () => !!storageGetRaw(SK.DIARY_FORMAT_HINT_SEEN)
  );
  const [photoLayout, setPhotoLayout] = useState<
    Record<string, { x: number; y: number; width: number }>
  >(entry?.photoLayout || {});
  const lastScrollTopRef = useRef(0);

  const entryId = entry?.id || "__draft__";

  // Voice dictation + audio recording hooks
  const voice = useJournalVoice(language);
  const recorder = useAudioRecorder();
  const { audioData, isRecording, duration, mimeType, reset: resetRecorder } = recorder;
  const wasListeningRef = useRef(false);

  // Initial values for isDirty check
  const initialRef = useRef({
    title: entry?.title || "",
    content: entry?.content || "",
    stickers: JSON.stringify(entry?.stickers || []),
    photoIds: JSON.stringify(entry?.photoIds || []),
    audioIds: JSON.stringify(entry?.audioIds || []),
    mood: entry?.mood,
    tags: JSON.stringify(entry?.tags || []),
  });

  const isDirty = useMemo(() => {
    const init = initialRef.current;
    return (
      title !== init.title ||
      content !== init.content ||
      JSON.stringify(stickers) !== init.stickers ||
      JSON.stringify(photoIds) !== init.photoIds ||
      JSON.stringify(audioIds) !== init.audioIds ||
      mood !== init.mood ||
      JSON.stringify(tags) !== init.tags
    );
  }, [title, content, stickers, photoIds, audioIds, mood, tags]);

  const wordCount = useMemo(() => countWordsHtml(content), [content]);

  const [promptSeed, setPromptSeed] = useState(0);
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
    mood;

  // ── Load draft on mount ──
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

  // ── Auto-save draft (3s debounce) ──
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (
        title ||
        contentRef.current ||
        stickers.length > 0 ||
        mood ||
        tags.length > 0 ||
        audioIds.length > 0
      ) {
        void saveDraft(draftKey, {
          title,
          content: contentRef.current,
          stickers,
          photoIds,
          audioIds,
          mood,
          tags,
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
    stickers,
    photoIds,
    audioIds,
    mood,
    tags,
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

  // Title auto-focuses for new entries via autoFocus prop on the input.
  // No additional textarea focus needed — user starts with the title.

  // Focus trap for editor overlay
  useEffect(() => {
    if (!editorOverlayRef.current) return;
    return createFocusTrap(editorOverlayRef.current);
  }, []);

  // ── Handlers (defined before useEffects that reference them to avoid TDZ) ──

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
    setSaving(true);
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
      void clearDraft(draftKey);
      announceSuccess(ts.journalEntrySaved || "Entry saved");
      setSaving(false);
      setSaveSuccess(true);
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
      setSaving(false);
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

  const handleSaveAndClose = useCallback(async () => {
    setShowUnsavedDialog(false);
    await handleSave();
  }, [handleSave]);

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
        handleBack();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && hasContent && !saving) {
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
    handleBack,
    handleSave,
    hasContent,
    saving,
    recorder,
  ]);

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

  // Android back button (priority order)
  useEffect(() => {
    if (showUnsavedDialog)
      return registerModalCloseCallback(() => {
        setShowUnsavedDialog(false);
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
    // Fallback: no sub-modal open → back button triggers editor back (dirty check)
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
    recorder,
    handleBack,
  ]);

  const handleRestoreDraft = () => {
    if (!draftAvailable) return;
    setTitle(draftAvailable.title);
    contentRef.current = draftAvailable.content;
    setContent(draftAvailable.content);
    setStickers(draftAvailable.stickers);
    setPhotoIds(draftAvailable.photoIds);
    if (draftAvailable.audioIds) setAudioIds(draftAvailable.audioIds);
    setMood(draftAvailable.mood);
    setTags(draftAvailable.tags);
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
  };

  const handleDismissDraft = () => {
    void clearDraft(draftKey);
    setDraftAvailable(null);
  };

  const handleAddSticker = (sticker: string) => {
    if (stickers.length >= MAX_STICKERS_PER_ENTRY) return;
    setStickers((prev) => [...prev, sticker]);
    setShowStickers(false);
  };

  const handleRemoveSticker = (index: number) => {
    setStickers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddPhoto = async (file: File) => {
    try {
      const photo = await onAddPhoto(file, entryId);
      setPhotoIds((prev) => [...prev, photo.id]);
    } catch (error) {
      logger.error("[Journal] Photo upload failed:", error);
    }
  };

  const handleRemovePhoto = useCallback(
    async (photoId: string) => {
      await onRemovePhoto(photoId, entryId);
      setPhotoIds((prev) => prev.filter((id) => id !== photoId));
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

  const handleAddTag = () => {
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
  };

  const handleRemoveAudio = async (audioId: string) => {
    await onRemoveAudio(audioId, entryId);
    setAudioIds((prev) => prev.filter((id) => id !== audioId));
    setAudioRecordings((prev) => prev.filter((a) => a.id !== audioId));
  };

  const handleToggleDictation = () => {
    if (voice.isListening) {
      voice.stop();
    } else {
      if (!voice.isSupported) {
        return;
      }
      voice.start();
    }
  };

  const handleStartRecording = async () => {
    if (!recorder.isSupported) {
      return;
    }
    if (audioIds.length >= MAX_AUDIO_PER_ENTRY) {
      return;
    }
    closeAllPickers();
    setShowRecordingOverlay(true);
    await recorder.start();
  };

  const handleStopRecording = () => {
    recorder.stop();
    // audioData effect will handle storing
  };

  const closeAllPickers = () => {
    setShowStickers(false);
    setShowPhotos(false);
    setShowMood(false);
    setShowTags(false);
    setShowStyleBar(false);
    setShowActionSheet(false);
  };

  const handlePromptTap = (prompt: string) => {
    setTitle(prompt);
    setShowPromptsDropdown(false);
  };

  // Click-outside to close prompts dropdown
  const promptsDropdownRef = useRef<HTMLDivElement>(null);
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

  // ── Scroll-to-hide toolbar ──
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

  // Scoped CSS vars for diary theme (no body mutation — isolated to this overlay)
  const diaryStyle = useMemo(
    () =>
      ({
        ...diaryTheme.themeVars,
        backgroundColor: diaryTheme.themeVars["--diary-bg"],
        color: diaryTheme.themeVars["--diary-text"],
      }) as React.CSSProperties,
    [diaryTheme.themeVars]
  );

  return (
    <div
      ref={editorOverlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={ts.journalEntryTitle || "Diary Entry"}
      className="fixed inset-0 z-[60] flex flex-col h-dvh overflow-hidden text-foreground"
      style={diaryStyle}
    >
      {/* Canvas decorative background */}
      <DiaryCanvas
        accentColor={diaryTheme.accentColor}
        isActive={bgIntensity !== "off"}
        theme={diaryTheme.theme}
        intensity={bgIntensity}
        particleSpeed={particleSpeed}
        scrollContainerRef={scrollAreaRef}
      />

      {/* Atmospheric background pattern overlay (Layer 1 — behind paper, above canvas) */}
      {bgPattern !== "none" && (
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={getBgPatternStyle(bgPattern)}
        />
      )}

      {/* ═══ GLASS TOOLBAR ═══ */}
      <div className="relative z-50 flex-shrink-0 w-full flex flex-col gap-3 px-6 py-3 pt-[max(0.75rem,var(--safe-top))] backdrop-blur-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-[linear-gradient(135deg,rgba(15,23,42,0.7),rgba(2,6,23,0.85))] border-b border-b-[rgba(255,255,255,0.08)]">
        {/* ROW 1: Navigation & Atmosphere */}
        <div className="flex items-center justify-between gap-3">
          {/* LEFT: Back + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all min-h-[44px]"
              aria-label={ts.back || "Back"}
            >
              <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
              <span className="text-sm">Map</span>
            </motion.button>
            <div className="min-w-0">
              <div
                className="text-sm font-bold tracking-tight truncate font-['Outfit',sans-serif]"
                style={{ color: diaryTheme.accentColor }}
              >
                {title || ts.diaryTimeCapsule || "TIME CAPSULE"}
              </div>
              <div className="relative">
                <button
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  className="text-[11px] flex items-center gap-1 text-foreground0 hover:text-muted-foreground transition-colors"
                >
                  <Calendar className="w-3 h-3" />
                  {new Date(date + "T00:00:00").toLocaleDateString(getLocale(language), {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  max={getToday()}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                  className="sr-only"
                  tabIndex={-1}
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Style toggle + Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Style panel toggle — reveals atmosphere, fonts, colors, etc. */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowStyleBar((v) => !v)}
              className={cn(
                "p-2 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center",
                showStyleBar
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "hover:bg-white/10 text-muted-foreground"
              )}
              aria-label={ts.diaryStyle || "Style"}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </motion.button>

            {entry && onDelete && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={ts.delete || "Delete"}
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            )}

            {/* Privacy Shield toggle */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setPrivacyShieldActive(!privacyShieldActive)}
              className={cn(
                "p-2 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center",
                privacyShieldActive
                  ? "bg-violet-500/15 text-violet-400"
                  : "hover:bg-white/10 text-muted-foreground"
              )}
              aria-label={ts.diaryPrivacyShield || "Privacy"}
            >
              {privacyShieldActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </motion.button>

            <motion.button
              whileTap={saveSuccess ? {} : { scale: 0.95 }}
              onClick={saveSuccess ? undefined : handleSave}
              disabled={!saveSuccess && (saving || !hasContent)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-all",
                saveSuccess
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25",
                "disabled:opacity-40"
              )}
            >
              <AnimatePresence mode="wait">
                {saveSuccess ? (
                  <motion.span
                    key="success"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="flex items-center"
                  >
                    <Check className="w-5 h-5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="save"
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    {ts.journalSave || "Save"}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* ROW 2: Collapsible style panel */}
        <AnimatePresence>
          {showStyleBar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1.5 px-1.5 pt-1">
                {/* Atmosphere capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5 flex-shrink-0">
                  {ATMOSPHERE_THEMES.map((at) => {
                    const isActive = at.name === diaryTheme.theme;
                    return (
                      <motion.button
                        key={at.name}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          diaryTheme.setTheme(at.name);
                          setBgPattern("none");
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                          isActive
                            ? `${at.activeBg} ${at.activeText} ${at.activeBorder}`
                            : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
                        )}
                      >
                        {ts[at.i18nKey] || at.label}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Fonts + Size capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5 flex-shrink-0">
                  {DIARY_FONT_NAMES_LOCAL.map((name) => {
                    const isActive = name === diaryTheme.font;
                    const label =
                      name === "outfit"
                        ? ts.diaryFontSans || "Sans"
                        : name === "cormorant"
                          ? ts.diaryFontSerif || "Serif"
                          : name === "dancing"
                            ? ts.diaryFontScript || "Script"
                            : ts.diaryFontHandwriting || "Hand";
                    return (
                      <motion.button
                        key={name}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => diaryTheme.setFont(name)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5",
                          isActive
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
                        )}
                        style={{ fontFamily: DIARY_FONTS_LOCAL[name].family }}
                      >
                        Aa <span className="text-[11px]">{label}</span>
                      </motion.button>
                    );
                  })}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={cycleFontSize}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-transparent text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all"
                    aria-label="Font size"
                  >
                    A<span className="text-[10px] ms-0.5 opacity-60">{FONT_SIZES[fontSize]}</span>
                  </motion.button>
                </div>

                {/* Prompts button (new entries only) */}
                {!entry && (
                  <div className="relative flex-shrink-0">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowPromptsDropdown(!showPromptsDropdown)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5",
                        showPromptsDropdown
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-black/30 text-muted-foreground border-white/5 hover:bg-white/10 hover:text-foreground"
                      )}
                    >
                      💡{" "}
                      {ts.journalWritingPrompts
                        ? ts.journalWritingPrompts.split(" ")[0]
                        : "Prompts"}
                    </motion.button>
                  </div>
                )}

                {/* Features capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5 flex-shrink-0">
                  {MOOD_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.mood}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setMood(mood === opt.mood ? undefined : opt.mood)}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                        mood === opt.mood
                          ? `${opt.activeBg} ring-2 ${opt.activeRing}`
                          : "hover:bg-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "text-base transition-transform",
                          mood === opt.mood && "scale-110"
                        )}
                      >
                        {opt.emoji}
                      </span>
                    </motion.button>
                  ))}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowTags(!showTags)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                      showTags
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    #
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowStickers(true)}
                    disabled={stickers.length >= MAX_STICKERS_PER_ENTRY}
                    className="px-3 py-2 rounded-lg text-sm border border-transparent bg-transparent text-muted-foreground hover:bg-white/10 transition-all disabled:opacity-40"
                  >
                    ⭐
                  </motion.button>
                </div>

                {/* Paper color capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5 flex-shrink-0">
                  {(["dark", "milky", "white"] as PaperColor[]).map((pc) => (
                    <motion.button
                      key={pc}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setPaperColor(pc)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-all",
                        paperColor === pc ? "border-white/60 scale-110" : "border-white/10"
                      )}
                      style={{ background: PAPER_COLORS[pc].bg }}
                      aria-label={PAPER_COLORS[pc].label}
                    />
                  ))}
                </div>

                {/* Ink capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5 flex-shrink-0">
                  {INK_COLORS.map((c) => (
                    <motion.button
                      key={c.hex}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setInkColor(c.hex)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-all",
                        inkColor === c.hex ? "border-white/60 scale-110" : "border-white/10"
                      )}
                      style={{ background: c.hex }}
                      aria-label={c.label}
                    />
                  ))}
                </div>

                {/* Media capsule (Record + Voice — Photo moved to bottom toolbar) */}
                <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5 flex-shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleStartRecording()}
                    disabled={audioIds.length >= MAX_AUDIO_PER_ENTRY}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-transparent hover:bg-white/10 hover:text-foreground transition-all flex items-center gap-2 disabled:opacity-40"
                  >
                    🎤 {ts.diaryRecord || "Record"}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleToggleDictation}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2",
                      voice.isListening
                        ? "bg-red-500/15 text-red-400 border-red-500/30"
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    🎙️{" "}
                    {voice.isListening ? ts.journalDictateStop || "Stop" : ts.diaryVoice || "Voice"}
                  </motion.button>
                </div>

                {/* Visual capsule (BG + Speed + Texture) */}
                <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5 flex-shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      setBgIntensity((prev) =>
                        prev === "full" ? "dim" : prev === "dim" ? "off" : "full"
                      )
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                      bgIntensity === "full"
                        ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                        : bgIntensity === "dim"
                          ? "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30"
                          : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    {bgIntensity === "full" ? "🌌" : bgIntensity === "dim" ? "🌑" : "⊘"} BG
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      setParticleSpeed((prev) =>
                        prev === "slow" ? "drift" : prev === "drift" ? "off" : "slow"
                      )
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                      particleSpeed === "drift"
                        ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                        : particleSpeed === "slow"
                          ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                          : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    {particleSpeed === "slow" ? "🐌" : particleSpeed === "drift" ? "🌊" : "⊘"}{" "}
                    {ts.diaryParticleSpeed || "Speed"}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const idx = PAPER_TEXTURE_NAMES.indexOf(paperTexture);
                      setPaperTexture(PAPER_TEXTURE_NAMES[(idx + 1) % PAPER_TEXTURE_NAMES.length]);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                      paperTexture !== "clean"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    ⏺ {paperTexture === "clean" ? ts.diaryTexture || "Texture" : paperTexture}
                  </motion.button>
                </div>

                {/* Atmospheric pattern capsule */}
                <div className="flex items-center gap-1 bg-black/30 p-1.5 rounded-xl border border-white/5 flex-shrink-0">
                  {BG_PATTERN_LIST.map((pat) => {
                    const isActive = pat.name === bgPattern;
                    const isNone = pat.name === "none";
                    return (
                      <motion.button
                        key={pat.name}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setBgPattern(pat.name)}
                        className={cn(
                          "w-8 h-8 rounded-lg border-2 transition-all flex-shrink-0 flex items-center justify-center",
                          isActive
                            ? "border-white/60 scale-110 shadow-lg"
                            : "border-white/10 hover:border-white/25",
                          isNone && !isActive && "border-dashed border-white/20"
                        )}
                        style={isNone ? undefined : { background: pat.swatch }}
                        aria-label={ts[pat.i18nKey] || pat.name}
                        title={ts[pat.i18nKey] || pat.name}
                      >
                        {isNone && <span className="text-xs text-muted-foreground">⊘</span>}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Prompts dropdown */}
              <AnimatePresence>
                {showPromptsDropdown && (
                  <motion.div
                    ref={promptsDropdownRef}
                    className="mx-4 mt-2 p-3 rounded-xl bg-popover/95 backdrop-blur-xl border border-white/10 shadow-2xl space-y-1.5"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={zenMotion.gentle}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground0 flex items-center gap-1.5">
                        {"\u{270F}\uFE0F"} {ts.journalWritingPrompts || "Writing prompts"}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPromptSeed((s) => s + 1)}
                          className="p-1.5 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          aria-label="Shuffle prompts"
                        >
                          <Shuffle className="w-3 h-3 text-foreground0" />
                        </button>
                        <button
                          onClick={() => setShowPromptsDropdown(false)}
                          className="p-1 rounded hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          aria-label={ts.close || "Close"}
                        >
                          <X className="w-3 h-3 text-foreground0" />
                        </button>
                      </div>
                    </div>
                    {randomPrompts.map((prompt, i) => (
                      <motion.button
                        key={`${promptSeed}-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{
                          delay: i * 0.04,
                          type: "spring",
                          stiffness: 300,
                          damping: 25,
                        }}
                        onClick={() => handlePromptTap(prompt)}
                        className="block w-full text-start text-xs px-3 py-2.5 rounded-xl min-h-[40px] text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                      >
                        {prompt}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ CONTENT AREA ═══ */}
      <div ref={contentAreaRef} className="flex-1 relative overflow-hidden">
        {/* Floating photos layer (above content, pointer-events-none container) */}
        {Object.keys(photoLayout).length > 0 && (
          <FloatingMediaLayer
            entryId={entryId}
            photoIds={photoIds}
            layout={photoLayout}
            onLayoutChange={setPhotoLayout}
            onReturnToGallery={handleReturnToGallery}
            containerRef={contentAreaRef}
          />
        )}
        <div
          ref={scrollAreaRef}
          className="absolute inset-0 overflow-y-auto pt-[140px] pb-[160px] px-4 z-10"
          onScroll={handleContentScroll}
        >
          <div
            className={cn(
              "max-w-4xl mx-auto rounded-2xl border shadow-[0_0_80px_rgba(0,0,0,0.5)] p-4 sm:p-6 md:p-8 min-h-[60dvh] space-y-4 [contain:layout_style_paint]",
              zenFocusActive && "zen-focus-active"
            )}
            style={{
              backgroundColor: paperColors.bg,
              color: paperColors.text,
              borderColor: paperColors.border,
              ...getPaperTextureStyle(paperTexture, paperColor === "dark"),
            }}
          >
            {/* Draft restore banner */}
            <AnimatePresence>
              {draftAvailable && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mx-4 mt-2 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-xs text-foreground flex-1">
                      {ts.journalDraftFound || "Unsaved draft found"}
                    </span>
                    <button
                      onClick={handleRestoreDraft}
                      className="text-xs font-medium text-primary px-2 py-1 rounded-lg hover:bg-primary/10 min-h-[44px]"
                    >
                      {ts.journalRestore || "Restore"}
                    </button>
                    <button
                      onClick={handleDismissDraft}
                      className="p-1 rounded hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label={ts.dismiss || "Dismiss"}
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={ts.journalEntryTitle || "Title (optional)"}
              autoFocus={!entry}
              className="w-full text-2xl font-bold tracking-tight bg-transparent border-none outline-none"
              style={{
                color: paperColors.text,
                fontFamily: diaryTheme.fontFamily,
              }}
              maxLength={100}
              onFocus={(e) => {
                const el = e.target;
                setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
              }}
            />

            {/* Mood display */}
            {mood && (
              <button
                onClick={() => setMood(undefined)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/50 text-xs min-h-[32px]"
              >
                {MOOD_OPTIONS.find((m) => m.mood === mood)?.emoji} {mood}
                <span className="text-muted-foreground ms-1">&times;</span>
              </button>
            )}

            {/* Stickers */}
            {stickers.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {stickers.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleRemoveSticker(i)}
                    className="px-1.5 py-0.5 rounded-lg hover:bg-muted/50 active:scale-90 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <StickerRenderer emoji={s} size="md" />
                  </button>
                ))}
              </div>
            )}

            {/* Photos (gallery shows only non-floating photos) */}
            {photoIds.filter((id) => !photoLayout[id]).length > 0 && (
              <JournalPhotoGallery
                entryId={entryId}
                photoIds={photoIds.filter((id) => !photoLayout[id])}
                onRemovePhoto={handleRemovePhoto}
                onFloatPhoto={handleFloatPhoto}
                editable
              />
            )}

            {/* Audio recordings */}
            {audioRecordings.length > 0 && (
              <div className="space-y-1.5">
                {audioRecordings.map((audio) => (
                  <div key={audio.id} className="flex items-center gap-1.5">
                    <div className="flex-1">
                      <JournalAudioPlayer src={audio.data} duration={audio.duration} />
                    </div>
                    <button
                      onClick={() => handleRemoveAudio(audio.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label={ts.delete || "Remove"}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Voice dictation indicator */}
            <AnimatePresence>
              {voice.isListening && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                    {ts.journalDictating || "Listening..."}
                  </span>
                  {voice.transcript && (
                    <span className="text-xs text-muted-foreground/60 truncate flex-1">
                      {voice.transcript.slice(-60)}
                    </span>
                  )}
                  <button
                    onClick={() => voice.stop()}
                    className="p-1 rounded-md hover:bg-red-500/20 min-w-[28px] min-h-[28px] flex items-center justify-center"
                    aria-label={ts.stop || "Stop"}
                  >
                    <Square className="w-3 h-3 text-red-500" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTags((prev) => prev.filter((t2) => t2 !== tag))}
                    className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors min-h-[32px]"
                  >
                    #{tag} &times;
                  </button>
                ))}
              </div>
            )}

            {/* Inline tag input */}
            <AnimatePresence>
              {showTags && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddTag();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder={ts.journalTagPlaceholder || "Add tag..."}
                      className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground outline-none placeholder:text-foreground0 min-h-[44px]"
                      autoFocus
                      maxLength={30}
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      className="px-4 py-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm font-medium min-h-[44px]"
                    >
                      {ts.journalAdd || "Add"}
                    </motion.button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Burn-a-thought widget (inline, above textarea) */}
            <AnimatePresence>
              {showBurnWidget && <BurnThoughtWidget onClose={handleCloseBurn} />}
            </AnimatePresence>

            {/* Gratitude bloom widget (inline, above textarea) */}
            <AnimatePresence>
              {showGratitudeWidget && onAddGratitude && (
                <GratitudeBloomWidget onClose={handleCloseGratitude} onPlant={onAddGratitude} />
              )}
            </AnimatePresence>

            {/* Breathing exercise widget (inline, above textarea) */}
            <AnimatePresence>
              {showBreathe && (
                <motion.div
                  className="my-6"
                  initial={{ opacity: 0, y: -16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.97 }}
                  transition={zenMotion.gentle}
                >
                  <DiaryBreatheWidget />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Habit tracker (toggled from bottom toolbar) */}
            <AnimatePresence>
              {showHabits && (
                <motion.div
                  className="my-6"
                  initial={{ opacity: 0, y: -16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.97 }}
                  transition={zenMotion.gentle}
                >
                  <JournalHabitSection
                    date={date}
                    snapshot={habitSnapshot}
                    onSnapshotChange={setHabitSnapshot}
                    onToggleHabit={onToggleHabit}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Format hint (onboarding — shown once) */}
            <AnimatePresence>
              {!formatHintDismissed && (
                <DiaryFormatHint
                  onDismiss={() => {
                    setFormatHintDismissed(true);
                    storageSetRaw(SK.DIARY_FORMAT_HINT_SEEN, "1");
                  }}
                />
              )}
            </AnimatePresence>

            {/* Content editor (contenteditable WYSIWYG) */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="w-full min-h-[260px] bg-transparent border-none outline-none resize-none [&_blockquote]:border-l-2 [&_blockquote]:border-current/20 [&_blockquote]:ps-3 [&_blockquote]:italic [&_code]:bg-black/5 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_del]:line-through empty:before:content-[attr(data-placeholder)] empty:before:opacity-40 empty:before:pointer-events-none leading-[1.8]"
              style={{
                fontSize: FONT_SIZES[fontSize],
                fontFamily: diaryTheme.fontFamily,
                color: inkColor !== "#ffffff" ? inkColor : paperColors.text,
              }}
              onInput={handleEditorInput}
              onFocus={(e) => {
                const el = e.target;
                setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
              }}
              data-placeholder={ts.journalEntryPlaceholder || "What's on your mind?"}
            />

            {/* Word count + char count + reading time + auto-save indicator */}
            <div className="flex items-center gap-3 pt-2">
              {wordCount > 0 && (
                <div className="flex items-center gap-2" style={{ color: paperColors.muted }}>
                  <span className="text-[10px] opacity-60">
                    {wordCount} {ts.journalWords || "words"}
                  </span>
                  <span className="text-[10px] opacity-40">
                    {content.length} {ts.journalChars || "chars"}
                  </span>
                  {wordCount >= 50 && (
                    <span className="text-[10px] opacity-40">
                      ~{Math.ceil(wordCount / 200)} {ts.journalMinRead || "min read"}
                    </span>
                  )}
                </div>
              )}
              <AnimatePresence>
                {draftSavedAt > 0 && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] text-green-500/60 flex items-center gap-0.5"
                  >
                    <Check className="w-2.5 h-2.5" /> {ts.journalDraftSaved || "Saved"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      {/* END content area */}

      {/* ═══ BOTTOM GLASS TOOLBAR (Magic) ═══ */}
      <div className="relative z-50 flex-shrink-0 w-full px-6 py-3 pb-[max(0.75rem,var(--safe-bottom))] backdrop-blur-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-[linear-gradient(135deg,rgba(15,23,42,0.7),rgba(2,6,23,0.85))] border-t border-t-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1.5 px-1.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowPhotos(true)}
            disabled={photoIds.length >= MAX_PHOTOS_PER_ENTRY}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-transparent hover:bg-white/10 hover:text-foreground transition-all flex items-center gap-2 flex-shrink-0 disabled:opacity-40 min-h-[44px]"
          >
            📸 {ts.diarySnapshot || "Photo"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowBurnWidget((v) => !v);
              setShowGratitudeWidget(false);
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 flex-shrink-0 min-h-[44px]",
              showBurnWidget
                ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
            )}
          >
            🔥 {ts.journalBurnTitle ? ts.journalBurnTitle.split(" ")[0] : "Burn"}
          </motion.button>
          {onAddGratitude && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowGratitudeWidget((v) => !v);
                setShowBurnWidget(false);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 flex-shrink-0 min-h-[44px]",
                showGratitudeWidget
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
              )}
            >
              🌱 {ts.journalGratitudeAction ? ts.journalGratitudeAction.split(" ")[0] : "Gratitude"}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowBreathe(!showBreathe)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 flex-shrink-0 min-h-[44px]",
              showBreathe
                ? "bg-teal-500/15 text-teal-400 border-teal-500/30"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
            )}
          >
            🧘 {ts.diaryBreathe || "Breathe"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setZenFocusActive(!zenFocusActive)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 flex-shrink-0 min-h-[44px]",
              zenFocusActive
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
            )}
          >
            ✍️ {ts.diaryFocusRay || "Focus"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowHabits(!showHabits)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 flex-shrink-0 min-h-[44px]",
              showHabits
                ? "bg-green-500/15 text-green-400 border-green-500/30"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground"
            )}
          >
            ✅ {ts.journalHabitsSection || "Habits"}
            {completedHabitCount > 0 && (
              <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full leading-none">
                {completedHabitCount}/{habitSnapshot.length}
              </span>
            )}
          </motion.button>
        </div>
      </div>

      {/* Sub-pickers */}
      {showStickers && (
        <JournalStickerPicker
          onSelect={handleAddSticker}
          onClose={() => setShowStickers(false)}
          mood={mood}
        />
      )}

      {showPhotos && (
        <JournalPhotoPicker
          onSelectFile={(file) => handleAddPhoto(file)}
          onClose={() => setShowPhotos(false)}
          currentCount={photoIds.length}
          maxCount={MAX_PHOTOS_PER_ENTRY}
        />
      )}

      {/* Template picker for new entries */}
      {showTemplatePicker && !entry && !draftAvailable && (
        <JournalTemplatePicker
          onSelect={(templateContent, _templateId) => {
            if (templateContent) {
              contentRef.current = templateContent;
              setContent(templateContent);
            }
            setShowTemplatePicker(false);
            focusTimeoutRef.current = setTimeout(() => editorRef.current?.focus(), 100);
          }}
          onClose={() => {
            setShowTemplatePicker(false);
            focusTimeoutRef.current = setTimeout(() => editorRef.current?.focus(), 100);
          }}
        />
      )}

      {/* Recording overlay */}
      <AnimatePresence>
        {showRecordingOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Recording"
            className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={zenMotion.gentle}
              className="rounded-2xl p-6 max-w-[280px] mx-4 text-center shadow-xl bg-[var(--diary-bg,hsl(var(--card)))] border border-[var(--diary-border,hsl(var(--border)/0.3))]"
            >
              {/* Pulsing circle */}
              <div className="flex justify-center mb-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500/25 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                  </div>
                </motion.div>
              </div>

              <p className="text-sm font-semibold mb-1 text-[var(--diary-text,hsl(var(--foreground)))]">
                {ts.journalRecording || "Recording"}
              </p>
              <p className="text-2xl font-mono font-bold tabular-nums mb-4 text-[var(--diary-text,hsl(var(--foreground)))]">
                {formatRecordingTime(recorder.duration)}
              </p>
              <p className="text-[10px] mb-4 text-[var(--diary-muted,hsl(var(--muted-foreground)))]">
                {ts.journalAudioMaxDuration || "Max 5 minutes"}
              </p>

              <button
                onClick={handleStopRecording}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-semibold",
                  "bg-red-500 text-white",
                  "flex items-center justify-center gap-2",
                  "active:scale-[0.98] transition-transform min-h-[44px]"
                )}
              >
                <Square className="w-4 h-4" />
                {ts.journalRecordingStop || "Stop Recording"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center animate-fade-in"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={zenMotion.gentle}
            className="rounded-2xl p-5 max-w-[300px] mx-4 shadow-xl bg-[var(--diary-bg,hsl(var(--card)))] border border-[var(--diary-border,hsl(var(--border)/0.3))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2 text-[var(--diary-text,hsl(var(--foreground)))]">
              {ts.journalDeleteEntry || "Delete Entry?"}
            </h3>
            <p className="text-sm mb-4 text-[var(--diary-muted,hsl(var(--muted-foreground)))]">
              {ts.journalDeleteConfirm || "This action cannot be undone."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
              >
                {ts.cancel || "Cancel"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete?.();
                }}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium min-h-[44px]"
              >
                {ts.delete || "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Unsaved changes dialog */}
      {showUnsavedDialog && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center animate-fade-in"
          onClick={() => setShowUnsavedDialog(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={zenMotion.gentle}
            className="rounded-2xl p-5 max-w-[300px] mx-4 shadow-xl bg-[var(--diary-bg,hsl(var(--card)))] border border-[var(--diary-border,hsl(var(--border)/0.3))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2 text-[var(--diary-text,hsl(var(--foreground)))]">
              {ts.journalDiscardTitle || "Unsaved Changes"}
            </h3>
            <p className="text-sm mb-4 text-[var(--diary-muted,hsl(var(--muted-foreground)))]">
              {ts.journalDiscardMessage || "You have unsaved changes."}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSaveAndClose}
                disabled={saving}
                className={cn(
                  "w-full py-2.5 rounded-xl text-sm font-medium min-h-[44px]",
                  "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
                  "disabled:opacity-50"
                )}
              >
                {ts.journalSaveClose || "Save & Close"}
              </button>
              <button
                onClick={handleDiscard}
                className="w-full py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-medium min-h-[44px]"
              >
                {ts.journalDiscard || "Discard"}
              </button>
              <button
                onClick={() => setShowUnsavedDialog(false)}
                className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
              >
                {ts.journalKeepWriting || "Keep Writing"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Zen Focus — paragraph dimming + typewriter scroll */}
      <ZenFocusMode isActive={zenFocusActive} editorRef={editorRef} />

      {/* Privacy Shield — blur text except current word */}
      <PrivacyShield isActive={privacyShieldActive} editorRef={editorRef} />

      {/* Panic Lock — glassmorphism overlay with biometric unlock */}
      <AnimatePresence>
        {panicLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-6 backdrop-blur-[20px] bg-[rgba(2,6,17,0.8)]"
          >
            <DiaryBreatheWidget />
            <button
              onClick={() => setPanicLocked(false)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white/80 text-sm font-medium backdrop-blur-sm active:scale-95 transition-transform"
            >
              <Fingerprint className="w-5 h-5" />
              {ts.journalUnlockBiometric || "Unlock"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating format toolbar (Telegram-style — appears on text selection) */}
      <DiaryFormatToolbar editorRef={editorRef} scrollContainerRef={scrollAreaRef} />
    </div>
  );
}
