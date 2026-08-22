import { memo, useEffect, useCallback, useState, useRef, useLayoutEffect, useMemo } from "react";
import {
  ArrowLeft,
  AlertCircle,
  Camera,
  ChevronDown,
  ChevronUp,
  Check,
  CircleOff,
  Trash2,
  X,
  Calendar,
  Flame,
  Gauge,
  Layers,
  Leaf,
  Lightbulb,
  ListChecks,
  Loader2,
  Mic,
  Mic2,
  Moon,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Square,
  Sparkles,
  Sticker,
  Target,
  Eye,
  EyeOff,
  Fingerprint,
  SlidersHorizontal,
  Star,
  Wind,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { cn, getToday, interpolate } from "@/lib/utils";
import { shouldAnimate, zenMotion, zenTap } from "@/lib/animationUtils";
import { easings } from "@/lib/motion";
import { hapticTap } from "@/lib/haptics";
import { getLocale } from "@/lib/timeUtils";
import { useModalA11y } from "@/hooks/useModalA11y";
import { focusModalRecoveryAction } from "@/hooks/useModalKeyboard";
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
import type { JournalDraftCommitContext } from "./journalStorage";
import type { MoodType } from "@/types";
import { getJournalDisplayTag } from "./journalDisplay";
import {
  isFavoriteJournalEntry,
  isJournalFavoriteTag,
  setJournalEntryFavorite,
} from "./journalFavorite";
import {
  MAX_PHOTOS_PER_ENTRY,
  MAX_STICKERS_PER_ENTRY,
  MAX_AUDIO_PER_ENTRY,
  FONT_SIZES,
  getScaledJournalFontSize,
  PAPER_COLORS,
  PAPER_TEXTURE_NAMES,
} from "./types";
import { BG_PATTERN_LIST, getBgPatternStyle, getPaperTextureStyle } from "./diaryBgPatterns";
import { JournalStickerPicker } from "./JournalStickerPicker";
import { JOURNAL_PHOTO_ACCEPT, JournalPhotoPicker } from "./JournalPhotoPicker";
import { JournalPhotoGallery } from "./JournalPhotoGallery";
import { JournalAudioPlayer } from "./JournalAudioPlayer";
import { StickerRenderer } from "./StickerRenderer";
import { JournalTemplatePicker } from "./JournalTemplatePicker";
import { JournalHabitSection } from "./JournalHabitSection";
import { DiaryCanvas } from "./DiaryCanvas";
import { BurnThoughtWidget } from "./BurnThoughtWidget";
import { GratitudeBloomWidget } from "./GratitudeBloomWidget";
import { DiaryBreatheWidget } from "./DiaryBreatheWidget";
import { DiaryMiniOrb } from "./DiaryMiniOrb";
import { ZenFocusMode } from "./ZenFocusMode";
import { PrivacyShield } from "./PrivacyShield";
import { FloatingMediaLayer } from "./FloatingMediaLayer";
import { DiaryFormatToolbar } from "./DiaryFormatToolbar";
import { SlashCommandMenu, type CommandId } from "./SlashCommandMenu";
import { SaveIndicator } from "./SaveIndicator";
import { ThemeTransitionOverlay, useThemeTransition } from "./ThemeTransitionOverlay";
import { formatJournalWordCount, formatLocalizedCount } from "./journalWordCount";
// PhotoGridLayout available for viewer/card use — editor uses FloatingMediaLayer + JournalPhotoGallery
export { PhotoGridLayout } from "./PhotoGridLayout";
import { DiaryFormatHint } from "./DiaryFormatHint";
import { DIARY_FONTS, DIARY_FONT_NAMES } from "./types";
import { useJournalEditorState } from "./useJournalEditorState";
import { formatRecordingTime } from "./useJournalEditorHelpers";
import type { TranslationStrings } from "@/i18n/types";
import { isJournalPhotoPlaced } from "./photoLayout";
import { isNative } from "@/lib/platform";
import type { JournalSaveCompletion } from "./save-ceremony/journalSaveCeremonyContract";

// Local aliases to avoid name collision with the hook's `theme` state
const DIARY_FONTS_LOCAL = DIARY_FONTS;
const DIARY_FONT_NAMES_LOCAL = DIARY_FONT_NAMES;

function getJournalTranslation(
  translations: TranslationStrings,
  key: string,
  fallback: string
): string {
  if (!(key in translations)) return fallback;
  const value = translations[key as keyof TranslationStrings];
  return typeof value === "string" && value ? value : fallback;
}

type DiaryAccentStyle = Readonly<{
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
  boxShadow?: string;
}>;

const DIARY_ACCENTS = {
  purple: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    color: "#c084fc",
    borderColor: "rgba(168, 85, 247, 0.30)",
  },
  cyan: {
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    color: "#22d3ee",
    borderColor: "rgba(6, 182, 212, 0.30)",
  },
  emerald: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#34d399",
    borderColor: "rgba(16, 185, 129, 0.30)",
  },
  orange: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    color: "#fb923c",
    borderColor: "rgba(249, 115, 22, 0.30)",
  },
  violet: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    color: "#a78bfa",
    borderColor: "rgba(139, 92, 246, 0.30)",
  },
  pink: {
    backgroundColor: "rgba(236, 72, 153, 0.15)",
    color: "#f472b6",
    borderColor: "rgba(236, 72, 153, 0.30)",
  },
  blue: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    color: "#60a5fa",
    borderColor: "rgba(59, 130, 246, 0.30)",
  },
  rose: {
    backgroundColor: "rgba(244, 63, 94, 0.15)",
    color: "#fb7185",
    borderColor: "rgba(244, 63, 94, 0.30)",
  },
  green: { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#4ade80" },
  amber: { backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" },
  red: { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#f87171" },
} as const satisfies Record<string, DiaryAccentStyle>;

function withInsetRing(style: DiaryAccentStyle, ringColor: string): React.CSSProperties {
  return { ...style, boxShadow: `inset 0 0 0 2px ${ringColor}` };
}

const ATMOSPHERE_THEMES = [
  {
    name: "dark" as const,
    i18nKey: "diaryThemeCosmos",
    label: "Cosmos",
    activeStyle: DIARY_ACCENTS.purple,
  },
  {
    name: "ocean" as const,
    i18nKey: "diaryThemeOcean",
    label: "Ocean",
    activeStyle: DIARY_ACCENTS.cyan,
  },
  {
    name: "forest" as const,
    i18nKey: "diaryThemeForest",
    label: "Forest",
    activeStyle: DIARY_ACCENTS.emerald,
  },
  {
    name: "sunset" as const,
    i18nKey: "diaryThemeSunset",
    label: "Sunset",
    activeStyle: DIARY_ACCENTS.orange,
  },
  {
    name: "lavender" as const,
    i18nKey: "diaryThemeLavender",
    label: "Lavender",
    activeStyle: DIARY_ACCENTS.violet,
  },
  {
    name: "rose" as const,
    i18nKey: "diaryThemeRose",
    label: "Rose",
    activeStyle: DIARY_ACCENTS.pink,
  },
  {
    name: "midnight" as const,
    i18nKey: "diaryThemeMidnight",
    label: "Midnight",
    activeStyle: DIARY_ACCENTS.blue,
  },
  {
    name: "cherry" as const,
    i18nKey: "diaryThemeCherry",
    label: "Cherry",
    activeStyle: DIARY_ACCENTS.rose,
  },
] as const;

const MOOD_OPTIONS: {
  mood: MoodType;
  activeStyle: React.CSSProperties;
}[] = [
  {
    mood: "great",
    activeStyle: withInsetRing(DIARY_ACCENTS.green, "rgba(74, 222, 128, 0.40)"),
  },
  {
    mood: "good",
    activeStyle: withInsetRing(DIARY_ACCENTS.emerald, "rgba(52, 211, 153, 0.40)"),
  },
  {
    mood: "okay",
    activeStyle: withInsetRing(DIARY_ACCENTS.amber, "rgba(251, 191, 36, 0.40)"),
  },
  {
    mood: "bad",
    activeStyle: withInsetRing(DIARY_ACCENTS.orange, "rgba(251, 146, 60, 0.40)"),
  },
  {
    mood: "terrible",
    activeStyle: withInsetRing(DIARY_ACCENTS.red, "rgba(248, 113, 113, 0.40)"),
  },
];

const INK_COLORS = [
  { hex: "#ffffff", label: "White" },
  { hex: "#34d399", label: "Emerald" },
  { hex: "#fbbf24", label: "Gold" },
  { hex: "#fb7185", label: "Rose" },
];

const LIGHT_PAPER_READABLE_INK_COLORS: Record<string, string> = {
  "#34d399": "#047857",
  "#fbbf24": "#92400e",
  "#fb7185": "#be123c",
};

function resolveReadableInkColor(inkColor: string, paperColor: PaperColor): string {
  if (inkColor === "#ffffff") return PAPER_COLORS[paperColor].text;
  if (paperColor === "dark") return inkColor;
  return LIGHT_PAPER_READABLE_INK_COLORS[inkColor] || inkColor;
}

const JOURNAL_STYLE_TOOLBAR_SURFACE_CLASS =
  "rounded-3xl border border-border/60 bg-background/90 p-2 shadow-lg shadow-foreground/5 backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)] dark:border-white/10 dark:bg-background/75";
const JOURNAL_STYLE_TOOLBAR_FLOW_CLASS = "flex flex-wrap items-center gap-2";
const JOURNAL_STYLE_TOOLBAR_GROUP_CLASS =
  "flex min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-background/85 p-1.5 shadow-sm dark:border-white/10 dark:bg-background/70";
const JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS =
  "inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS =
  "border-border/60 bg-background/90 text-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-primary dark:border-white/10 dark:bg-background/70 dark:text-foreground dark:hover:bg-primary/15";
const JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS =
  "border-primary/60 bg-background/95 text-foreground shadow-sm shadow-primary/10 ring-1 ring-primary/35 dark:bg-background/80";
const JOURNAL_STYLE_TOOLBAR_BUTTON_MUTED_ACTIVE_CLASS = "border-border/70 bg-muted text-foreground";
const JOURNAL_STYLE_TOOLBAR_BUTTON_DANGER_ACTIVE_CLASS =
  "border-destructive/45 bg-destructive/10 text-foreground";
const JOURNAL_STYLE_TOOLBAR_SWATCH_BASE_CLASS =
  "h-12 w-12 rounded-full shrink-0 border-2 motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const JOURNAL_STYLE_TOOLBAR_SWATCH_IDLE_CLASS = "border-border/70 shadow-sm dark:border-white/20";
const JOURNAL_STYLE_TOOLBAR_SWATCH_ACTIVE_CLASS =
  "scale-110 border-primary shadow-md shadow-primary/20";
const JOURNAL_STYLE_TOOLBAR_PATTERN_BASE_CLASS =
  "flex h-12 w-12 rounded-lg flex-shrink-0 items-center justify-center border-2 motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// ── Component ──

interface JournalEntryEditorProps {
  entry: JournalEntry | null;
  entryPrefill?: JournalEntryPrefill | null;
  milestonesEnabled?: boolean;
  onSave: (
    data: {
      title: string;
      content: string;
      stickers: string[];
      photoIds: string[];
      audioIds?: string[];
      mood?: MoodType;
      tags: string[];
      templateId?: string;
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
      photoLayout?: JournalEntry["photoLayout"];
    },
    draftContext: JournalDraftCommitContext
  ) => Promise<JournalSaveCompletion | void>;
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
  onPanicExit?: () => void;
  onToggleHabit?: (habitId: string, date: string) => void;
  onAddGratitude?: (entry: import("@/types").GratitudeEntry) => void;
  onReleaseThought?: () => void | Promise<void>;
  /** Desktop master-detail mode: render inline instead of fixed overlay */
  desktop?: boolean;
  /** Use the shared V2 DiaryWallpaper behind the desktop editor instead of the editor canvas. */
  useSharedDiaryWallpaper?: boolean;
  onRequestSettings?: () => void;
  onBindSettingsRequestHandler?: (handler: (() => void) | null) => void;
  onBindExitRequestHandler?: (handler: (() => void) | null) => void;
  onExitRequestCancelled?: () => void;
  onDirtyStateChange?: (dirty: boolean) => void;
}

export const JournalEntryEditor = memo(function JournalEntryEditor({
  entry,
  entryPrefill,
  milestonesEnabled,
  onSave,
  onAddPhoto,
  onRemovePhoto,
  onAddAudio,
  onRemoveAudio,
  onDelete,
  onBack,
  onPanicExit,
  onToggleHabit,
  onAddGratitude,
  onReleaseThought,
  desktop,
  useSharedDiaryWallpaper = false,
  onRequestSettings,
  onBindSettingsRequestHandler,
  onBindExitRequestHandler,
  onExitRequestCancelled,
  onDirtyStateChange,
}: JournalEntryEditorProps) {
  const themeTransition = useThemeTransition();
  const paperRef = useRef<HTMLDivElement>(null);
  const [floatingFocusPhotoId, setFloatingFocusPhotoId] = useState<string | null>(null);
  const desktopPhotoInputRef = useRef<HTMLInputElement>(null);
  const [desktopInitialPhotoFile, setDesktopInitialPhotoFile] = useState<File | null>(null);
  const state = useJournalEditorState({
    entry,
    entryPrefill,
    milestonesEnabled,
    onSave,
    onAddPhoto,
    onRemovePhoto,
    onAddAudio,
    onRemoveAudio,
    onDelete,
    onBack,
    onExitRequestCancelled,
    onToggleHabit,
    onAddGratitude,
    desktop,
  });

  useEffect(() => {
    onDirtyStateChange?.(state.isDirty);
  }, [onDirtyStateChange, state.isDirty]);

  const {
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
    // content
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
    // save
    saveState,
    saveFailureReason,
    saveSuccess,
    handleRetry,
    retryAudioLoad,
    // milestones (wired in future: confetti overlay + milestone toast)
    milestoneTriggered: _milestoneTriggered,
    showConfetti: _showConfetti,
    onConfettiComplete: _onConfettiComplete,
    // ui panels
    showStickers,
    setShowStickers,
    showPhotos,
    setShowPhotos,
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
    draftLoadError,
    draftLoadInUse,
    draftReady,
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
    requestRemoveAudio,
    cancelRemoveAudio,
    confirmRemoveAudio,
    retryAudioSave,
    handleToggleDictation,
    handleConfirmDictation,
    handleStartRecording,
    handleStopRecording,
    handleDiscardRecording,
    requestDiscardRecording,
    cancelDiscardRecording,
    handlePromptTap,
    handleEditorInput,
    handleEditorPaste,
    handleEditorDrop,
    cycleFontSize,
    handleContentScroll,
    handleTemplateSelect,
    handleTemplateClose,
  } = state;
  const saveInteractionLocked = saveState === "saving" || saveState === "saved";

  const handleFloatPhotoWithFocus = useCallback(
    (photoId: string) => {
      handleFloatPhoto(photoId);
      setFloatingFocusPhotoId(photoId);
    },
    [handleFloatPhoto]
  );

  const handleFloatingPhotoFocusHandled = useCallback((photoId: string) => {
    setFloatingFocusPhotoId((current) => (current === photoId ? null : current));
  }, []);

  const placedPhotoIds = useMemo(
    () => photoIds.filter((photoId) => isJournalPhotoPlaced(photoLayout[photoId])),
    [photoIds, photoLayout]
  );
  const galleryPhotoIds = useMemo(
    () => photoIds.filter((photoId) => !isJournalPhotoPlaced(photoLayout[photoId])),
    [photoIds, photoLayout]
  );

  const [mobileToolsCollapsed, setMobileToolsCollapsed] = useState(true);
  const [settingsDraftError, setSettingsDraftError] = useState<string | null>(null);
  const [panicUnlockError, setPanicUnlockError] = useState<string | null>(null);
  const [panicExitBusy, setPanicExitBusy] = useState(false);
  const [panicExitNeedsConfirmation, setPanicExitNeedsConfirmation] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const panicUnlockButtonRef = useRef<HTMLButtonElement>(null);
  const recordingDiscardCancelRef = useRef<HTMLButtonElement>(null);
  const recordingRetryRef = useRef<HTMLButtonElement>(null);
  const audioRemovalCancelRef = useRef<HTMLButtonElement>(null);
  const mobileToolsButtonRef = useRef<HTMLButtonElement>(null);

  const styleToolsLabel = ts.journalStyleTools || "Style tools";
  const sceneToolLabel = ts.diaryScene || "Scene";
  const backgroundToolLabel = ts.journalHubBackground || "Background";
  const motionToolLabel = ts.diaryMotion || ts.diaryParticleSpeed || "Motion";
  const textureToolLabel = ts.diaryTexture || "Texture";
  const tagsToolLabel = ts.journalToolbarTags || "Tags";
  const isFavorite = isFavoriteJournalEntry({ tags });
  const favoriteToolLabel = isFavorite
    ? ts.journalRemoveFavorite || "Remove from favorites"
    : ts.journalAddFavorite || "Add to favorites";
  const toggleFavorite = () => {
    setTags((current) =>
      setJournalEntryFavorite(current, !isFavoriteJournalEntry({ tags: current }))
    );
    void hapticTap();
  };
  const stickerToolLabel = ts.journalToolbarSticker || "Sticker";
  const paperToolLabel = ts.journalToolbarPaper || "Paper";
  const inkToolLabel = ts.journalToolbarInk || "Ink";
  const paperColorLabels: Record<PaperColor, string> = {
    white: ts.journalPaperSoftWhite || PAPER_COLORS.white.label,
    dark: ts.journalPaperDark || PAPER_COLORS.dark.label,
    milky: ts.journalPaperMilky || PAPER_COLORS.milky.label,
  };
  const inkColorLabels: Record<string, string> = {
    "#ffffff": ts.journalInkWhite || "Default ink",
    "#34d399": ts.journalInkEmerald || "Emerald",
    "#fbbf24": ts.journalInkGold || "Gold",
    "#fb7185": ts.journalInkRose || "Rose",
  };
  const paperTextureLabels: Record<PaperTexture, string> = {
    clean: ts.diaryTextureClean || "Clean",
    dots: ts.diaryTextureDots || "Dots",
    grid: ts.diaryTextureGrid || "Grid",
    lines: ts.diaryTextureLines || "Lines",
    linen: ts.diaryTextureLinen || "Linen",
    craft: ts.diaryTextureCraft || "Craft",
  };
  const recordToolLabel = ts.journalToolbarRecord || ts.diaryRecord || "Record";
  const voiceToolLabel = ts.journalToolbarVoice || ts.diaryVoice || "Voice";
  const photoToolLabel = ts.journalToolbarPhoto || ts.diarySnapshot || "Photo";
  const fontSizeToolLabel = interpolate(ts.journalFontSizeSelected || "Font size: {value}", {
    value: FONT_SIZES[fontSize],
  });
  const backgroundIntensityLabel =
    bgIntensity === "full"
      ? ts.diaryBackgroundFull || "Full"
      : bgIntensity === "dim"
        ? ts.diaryBackgroundDim || "Dim"
        : ts.diaryBackgroundOff || "Off";
  const particleSpeedLabel =
    particleSpeed === "slow"
      ? ts.diaryParticleSpeedSlow || "Slow"
      : particleSpeed === "drift"
        ? ts.diaryParticleSpeedDrift || "Drift"
        : ts.diaryParticleSpeedOff || "Off";
  const paperTextureLabel = paperTextureLabels[paperTexture];
  const backgroundAriaLabel = interpolate(ts.journalBackgroundSelected || "Background: {value}", {
    value: backgroundIntensityLabel,
  });
  const particleSpeedAriaLabel = interpolate(ts.journalMotionSelected || "Motion: {value}", {
    value: particleSpeedLabel,
  });
  const textureAriaLabel = interpolate(ts.journalTextureSelected || "Texture: {value}", {
    value: paperTextureLabel,
  });
  const selectedSceneMeta = BG_PATTERN_LIST.find((pat) => pat.name === bgPattern);
  const selectedSceneLabel = selectedSceneMeta
    ? getJournalTranslation(ts, selectedSceneMeta.i18nKey, selectedSceneMeta.name)
    : bgPattern;
  const selectedStyleStatusItems = [
    interpolate(ts.journalSceneSelected || "Scene: {value}", { value: selectedSceneLabel }),
    interpolate(ts.journalTextureSelected || "Texture: {value}", { value: paperTextureLabel }),
  ];
  if (!useSharedDiaryWallpaper) {
    selectedStyleStatusItems.push(backgroundAriaLabel, particleSpeedAriaLabel);
  }
  const selectedStyleStatus = selectedStyleStatusItems.join(". ");
  const readableInkColor = resolveReadableInkColor(inkColor, paperColor);
  const inkSwatchColor = (hex: string) =>
    hex === "#ffffff" ? paperColors.text : resolveReadableInkColor(hex, paperColor);
  const formatRemoveTagLabel = (tag: string) =>
    (ts.journalRemoveTag || "Remove tag {tag}").replace("{tag}", tag);
  const formatRemoveAudioLabel = (audio: JournalAudio) =>
    (ts.journalRemoveAudio || "Remove audio {duration}").replace(
      "{duration}",
      formatRecordingTime(audio.duration)
    );
  const stickerLimitLabel = stickerToolLabel + ": " + MAX_STICKERS_PER_ENTRY;
  const recordLimitLabel =
    ts.journalAudioMaxReached || recordToolLabel + ": " + MAX_AUDIO_PER_ENTRY;
  const photoLimitLabel =
    photoToolLabel +
    ": " +
    formatLocalizedCount(0, language, ts, "journalPhotoRemainingCount", "0 photos remaining");
  const moodLabels: Record<MoodType, string> = {
    great: ts.moodGreat || "Great",
    good: ts.moodGood || "Good",
    okay: ts.moodOkay || "Okay",
    bad: ts.moodBad || "Bad",
    terrible: ts.moodTerrible || ts.terrible || "Terrible",
  };
  const slashDisabledCommandIds = useMemo(() => {
    const disabled =
      entry || draftAvailable ? new Set<CommandId>(["template"]) : new Set<CommandId>();
    if (!draftReady || photoIds.length >= MAX_PHOTOS_PER_ENTRY) disabled.add("photo");
    return disabled;
  }, [draftAvailable, draftReady, entry, photoIds.length]);

  const handlePanicLockCloseRequest = useCallback(() => {
    setPanicUnlockError(ts.journalPanicLockUnlockRequired || "Use Unlock to return to your diary.");
    requestAnimationFrame(() => panicUnlockButtonRef.current?.focus());
  }, [ts.journalPanicLockUnlockRequired]);

  const handlePanicUnlock = useCallback(async () => {
    void hapticTap();
    setPanicUnlockError(null);

    try {
      const { default: BiometricAuth } = await import("@/plugins/BiometricPlugin");
      const result = await BiometricAuth.authenticate({
        reason: ts.journalUnlockBiometric || "Unlock your private diary",
      });

      if (result.success) {
        setPanicLocked(false);
        return;
      }

      setPanicUnlockError(
        result.error || ts.authUnexpectedError || "Unlock failed. Please try again."
      );
    } catch {
      setPanicUnlockError(ts.authUnexpectedError || "Unlock failed. Please try again.");
    }
  }, [setPanicLocked, ts.authUnexpectedError, ts.journalUnlockBiometric]);

  const handlePanicExit = useCallback(async () => {
    if (!onPanicExit || panicExitBusy) return;
    if (panicExitNeedsConfirmation) {
      onPanicExit();
      return;
    }

    setPanicExitBusy(true);
    setPanicUnlockError(null);
    try {
      if (isDirty || hasImmediateChanges() || hasPendingRecording) {
        const saved = await persistDraftWithActiveRecording();
        if (!saved) {
          setPanicExitNeedsConfirmation(true);
          setPanicUnlockError(
            ts.journalPanicExitSaveError ||
              "Your latest changes could not be saved. The diary is still hidden. Leave without saving only if you are ready to lose those changes."
          );
          return;
        }
      }
      onPanicExit();
    } catch {
      setPanicExitNeedsConfirmation(true);
      setPanicUnlockError(
        ts.journalPanicExitSaveError ||
          "Your latest changes could not be saved. The diary is still hidden. Leave without saving only if you are ready to lose those changes."
      );
    } finally {
      setPanicExitBusy(false);
    }
  }, [
    hasImmediateChanges,
    hasPendingRecording,
    isDirty,
    onPanicExit,
    panicExitBusy,
    panicExitNeedsConfirmation,
    persistDraftWithActiveRecording,
    ts.journalPanicExitSaveError,
  ]);

  const handleMobileToolsCollapse = useCallback(() => {
    void hapticTap();
    setMobileToolsCollapsed(true);
    setShowStyleBar(false);
    setShowPromptsDropdown(false);
  }, [setShowPromptsDropdown, setShowStyleBar]);

  const handleMobileToolsExpand = useCallback(() => {
    void hapticTap();
    setMobileToolsCollapsed(false);
  }, []);

  const handleMobileStyleToggle = useCallback(() => {
    void hapticTap();
    setMobileToolsCollapsed(false);
    setShowPromptsDropdown(false);
    setShowStyleBar((value) => !value);
  }, [setShowPromptsDropdown, setShowStyleBar]);

  const collapseMobileToolsForSurface = useCallback(() => {
    if (!desktop) {
      setMobileToolsCollapsed(true);
    }
    setShowStyleBar(false);
    setShowPromptsDropdown(false);
  }, [desktop, setShowPromptsDropdown, setShowStyleBar]);

  const requestPhotoSelection = useCallback(() => {
    if (!draftReady || photoIds.length >= MAX_PHOTOS_PER_ENTRY) return;
    collapseMobileToolsForSurface();
    if (isNative) {
      setShowPhotos(true);
      return;
    }
    desktopPhotoInputRef.current?.click();
  }, [collapseMobileToolsForSurface, draftReady, photoIds.length, setShowPhotos]);

  useEffect(() => {
    if (!showTags) return;
    const frame = requestAnimationFrame(() => {
      const input = tagInputRef.current;
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ behavior: shouldAnimate() ? "smooth" : "auto", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [showTags]);

  const closeDeleteConfirm = useCallback(() => {
    if (deleteSubmitting) return;
    setShowDeleteConfirm(false);
  }, [deleteSubmitting, setShowDeleteConfirm]);

  const closeUnsavedDialog = useCallback(() => {
    if (discardSubmitting) return;
    setShowUnsavedDialog(false);
    onExitRequestCancelled?.();
  }, [discardSubmitting, onExitRequestCancelled, setShowUnsavedDialog]);

  const closeSettingsConfirm = useCallback(() => {
    setShowSettingsConfirm(false);
  }, [setShowSettingsConfirm]);

  const closeVoicePrivacyConfirm = useCallback(() => {
    setShowVoicePrivacyConfirm(false);
  }, [setShowVoicePrivacyConfirm]);

  const closeRecordingOverlay = useCallback(() => {
    if (recordingDiscardPending) {
      cancelDiscardRecording();
      return;
    }
    if (audioSaveRetryAvailable) {
      requestDiscardRecording();
      return;
    }
    handleStopRecording();
  }, [
    audioSaveRetryAvailable,
    cancelDiscardRecording,
    handleStopRecording,
    recordingDiscardPending,
    requestDiscardRecording,
  ]);

  useEffect(() => {
    if (!recordingDiscardPending) return;
    const frame = requestAnimationFrame(() => recordingDiscardCancelRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [recordingDiscardPending]);

  useEffect(() => {
    if (!audioRemovalPendingId) return;
    const frame = requestAnimationFrame(() => audioRemovalCancelRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [audioRemovalPendingId]);

  const recordingDialogTitleId = "journal-recording-dialog-title";
  const recordingDialogDescriptionId = "journal-recording-dialog-description";
  const audioRemovalDialogTitleId = "journal-audio-remove-confirm-title";
  const audioRemovalDialogDescriptionId = "journal-audio-remove-confirm-description";
  const voicePrivacyDialogTitleId = "journal-voice-privacy-title";
  const voicePrivacyDialogDescriptionId = "journal-voice-privacy-description";
  const panicLockDialogTitleId = "journal-panic-lock-title";
  const panicLockDialogDescriptionId = "journal-panic-lock-description";

  const deleteDialogA11y = useModalA11y(showDeleteConfirm, closeDeleteConfirm);
  const unsavedDialogA11y = useModalA11y(showUnsavedDialog, closeUnsavedDialog);
  const settingsDialogA11y = useModalA11y(showSettingsConfirm, closeSettingsConfirm);
  const recordingDialogA11y = useModalA11y(showRecordingOverlay, closeRecordingOverlay, mobileToolsButtonRef);
  const audioRemovalDialogA11y = useModalA11y(
    Boolean(audioRemovalPendingId),
    cancelRemoveAudio,
  );
  const voicePrivacyDialogA11y = useModalA11y(showVoicePrivacyConfirm, closeVoicePrivacyConfirm);
  const panicLockDialogA11y = useModalA11y(panicLocked, handlePanicLockCloseRequest);

  useEffect(() => {
    if (!audioSaveRetryAvailable) return;
    const frame = requestAnimationFrame(() => {
      focusModalRecoveryAction(
        recordingDialogA11y.modalRef.current,
        recordingRetryRef.current,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [audioSaveRetryAvailable, recordingDialogA11y.modalRef]);

  // T3: Markdown shortcut auto-conversion on input
  const handleMarkdownShortcuts = useCallback(
    (_e: Event) => {
      const editor = editorRef.current;
      if (!editor) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      // Only process if cursor is inside editor
      if (!editor.contains(range.commonAncestorContainer)) return;

      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return;
      const text = node.textContent || "";
      const cursorPos = range.startOffset;

      // Get text up to cursor
      const textBefore = text.slice(0, cursorPos);

      // Bold: **text**
      const boldMatch = textBefore.match(/\*\*(.+?)\*\*$/);
      if (boldMatch) {
        const fullMatch = boldMatch[0];
        const content = boldMatch[1];
        const startIdx = cursorPos - fullMatch.length;

        // Replace markdown with plain text, then apply bold
        const textNode = node as Text;
        const before = text.slice(0, startIdx);
        const after = text.slice(cursorPos);
        textNode.textContent = before + content + after;

        // Select the content text and apply bold
        const newRange = document.createRange();
        newRange.setStart(textNode, startIdx);
        newRange.setEnd(textNode, startIdx + content.length);
        sel.removeAllRanges();
        sel.addRange(newRange);
        document.execCommand("bold", false);

        // Collapse cursor to end
        sel.collapseToEnd();
        void hapticTap();
        handleEditorInput();
        return;
      }

      // Italic: *text* (but not **)
      const italicMatch = textBefore.match(/(?<!\*)\*([^*]+?)\*$/);
      if (italicMatch) {
        const fullMatch = italicMatch[0];
        const content = italicMatch[1];
        const startIdx = cursorPos - fullMatch.length;

        const textNode = node as Text;
        const before = text.slice(0, startIdx);
        const after = text.slice(cursorPos);
        textNode.textContent = before + content + after;

        const newRange = document.createRange();
        newRange.setStart(textNode, startIdx);
        newRange.setEnd(textNode, startIdx + content.length);
        sel.removeAllRanges();
        sel.addRange(newRange);
        document.execCommand("italic", false);

        sel.collapseToEnd();
        void hapticTap();
        handleEditorInput();
        return;
      }

      // Link: [text](url)
      const linkMatch = textBefore.match(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)$/);
      if (linkMatch) {
        const fullMatch = linkMatch[0];
        const linkText = linkMatch[1];
        const url = linkMatch[2];
        const startIdx = cursorPos - fullMatch.length;

        const textNode = node as Text;
        const before = text.slice(0, startIdx);
        const after = text.slice(cursorPos);
        textNode.textContent = before + linkText + after;

        const newRange = document.createRange();
        newRange.setStart(textNode, startIdx);
        newRange.setEnd(textNode, startIdx + linkText.length);
        sel.removeAllRanges();
        sel.addRange(newRange);

        // Validate URL before creating link
        try {
          const parsed = new URL(url);
          if (["http:", "https:"].includes(parsed.protocol)) {
            document.execCommand("createLink", false, url);
          }
        } catch {
          // Invalid URL — skip link creation
        }

        sel.collapseToEnd();
        void hapticTap();
        handleEditorInput();
      }
    },
    [editorRef, handleEditorInput]
  );

  const syncEditorCommandContent = useCallback(() => {
    handleEditorInput();
    requestAnimationFrame(() => handleEditorInput());
  }, [handleEditorInput]);

  // T3: Attach markdown shortcut listener to editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.addEventListener("input", handleMarkdownShortcuts);
    return () => editor.removeEventListener("input", handleMarkdownShortcuts);
  }, [editorRef, handleMarkdownShortcuts]);

  const handleRequestSettings = useCallback(() => {
    if (!onRequestSettings) return;

    setSettingsDraftError(null);
    if (isDirty || hasImmediateChanges()) {
      setShowSettingsConfirm(true);
      return;
    }

    onRequestSettings();
  }, [hasImmediateChanges, isDirty, onRequestSettings, setShowSettingsConfirm]);

  const handleSaveDraftAndOpenSettings = useCallback(async () => {
    try {
      const persisted = await persistDraftNow();
      if (!persisted) {
        setSettingsDraftError(
          ts.journalDraftSaveFailed ||
            ts.settingsSaveFailed ||
            "Could not save this draft. Please try again."
        );
        return;
      }
      setSettingsDraftError(null);
      setShowSettingsConfirm(false);
      onRequestSettings?.();
    } catch {
      setSettingsDraftError(
        ts.journalDraftSaveFailed ||
          ts.settingsSaveFailed ||
          "Could not save this draft. Please try again."
      );
    }
  }, [persistDraftNow, onRequestSettings, setShowSettingsConfirm, ts]);

  useLayoutEffect(() => {
    onBindSettingsRequestHandler?.(onRequestSettings ? handleRequestSettings : null);
    return () => onBindSettingsRequestHandler?.(null);
  }, [handleRequestSettings, onBindSettingsRequestHandler, onRequestSettings]);

  useLayoutEffect(() => {
    onBindExitRequestHandler?.(handleBack);
    return () => onBindExitRequestHandler?.(null);
  }, [handleBack, onBindExitRequestHandler]);

  const editorShellStyle = {
    ...diaryStyle,
    "--diary-keyboard-inset": `${keyboardInset}px`,
    backgroundColor: useSharedDiaryWallpaper ? "transparent" : diaryStyle.backgroundColor,
    bottom: desktop ? undefined : `${keyboardInset}px`,
  } as React.CSSProperties;

  const sharedWallpaperPaperStyle = useSharedDiaryWallpaper
    ? ({
        backgroundColor: `color-mix(in srgb, ${paperColors.bg} 68%, transparent)`,
        borderColor: `color-mix(in srgb, ${paperColors.border} 62%, hsl(var(--border)))`,
        boxShadow: "0 24px 80px hsl(var(--background) / 0.34)",
        WebkitBackdropFilter: "blur(22px) saturate(1.12)",
        backdropFilter: "blur(22px) saturate(1.12)",
      } as React.CSSProperties)
    : null;

  const editorShell = (
    <div
      ref={editorOverlayRef}
      role={desktop ? undefined : "dialog"}
      aria-modal={desktop ? undefined : true}
      aria-label={ts.journalEntryTitle || "Diary Entry"}
      data-testid="journal-entry-editor"
      aria-busy={saveState === "saving"}
      className={cn(
        "journal-entry-editor-shell flex flex-col overflow-hidden text-foreground",
        desktop
          ? "relative isolate h-full min-h-0 overflow-hidden"
          : "fixed inset-x-0 top-0 z-[60] min-h-0 max-h-[var(--app-viewport-height)]"
      )}
      style={editorShellStyle}
    >
      {/* Canvas decorative background */}
      {!useSharedDiaryWallpaper && (
        <DiaryCanvas
          accentColor={diaryTheme.accentColor}
          isActive={bgIntensity !== "off"}
          theme={diaryTheme.theme}
          intensity={bgIntensity}
          particleSpeed={particleSpeed}
          scrollContainerRef={scrollAreaRef}
          scope={desktop ? "container" : "viewport"}
        />
      )}

      {/* Atmospheric background pattern overlay (Layer 1 — behind paper, above canvas) */}
      {bgPattern !== "none" && (
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={getBgPatternStyle(bgPattern)}
        />
      )}

      {/* ═══ GLASS TOOLBAR ═══ */}
      <div
        className={cn(
          "journal-editor-chrome relative z-50 flex-shrink-0 w-full flex flex-col border-b",
          desktop
            ? "gap-3 px-6 py-3 pt-[max(0.75rem,var(--safe-top))] bg-background/95 backdrop-blur-sm shadow-sm border-border/15"
            : "gap-2 px-3 py-2 pt-[max(0.5rem,var(--safe-top))] bg-background/90 backdrop-blur-xl shadow-lg border-border/20"
        )}
      >
        {/* ROW 1: Navigation & Atmosphere */}
        <div className="grid grid-cols-1 items-start gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center">
          {/* LEFT: Back + Title */}
          <div className={cn("flex w-full min-w-0 items-start", desktop ? "gap-3" : "gap-1.5")}>
            <motion.button
              whileTap={zenTap.icon}
              onClick={handleBack}
              disabled={saveInteractionLocked}
              aria-disabled={saveInteractionLocked}
              className={cn(
                "flex min-h-[48px] min-w-[48px] items-center justify-center gap-1.5 rounded-lg py-2 text-muted-foreground hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground motion-safe:transition-all",
                desktop ? "px-3" : "px-2"
              )}
              aria-label={ts.back || "Back"}
            >
              <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
              <span className="text-sm max-[420px]:sr-only">{t.journalMapLabel}</span>
            </motion.button>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "font-bold tracking-tight whitespace-normal break-words [overflow-wrap:anywhere] font-display",
                  desktop ? "text-sm" : "text-xs"
                )}
                style={{ color: diaryTheme.accentColor }}
              >
                {title || ts.diaryTimeCapsule || "TIME CAPSULE"}
              </div>
              <div className="relative inline-flex min-h-[48px] items-center max-w-full">
                <span
                  className="pointer-events-none flex min-h-[48px] items-center gap-1 rounded-lg px-2 text-xs text-foreground/70 max-w-full flex-wrap whitespace-normal break-words [overflow-wrap:anywhere]"
                  aria-hidden="true"
                >
                  <Calendar className="w-3 h-3" aria-hidden="true" />
                  {new Date(date + "T00:00:00").toLocaleDateString(getLocale(language), {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  max={getToday()}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                  aria-label={ts.journalEntryDate || "Entry date"}
                  className="absolute inset-0 min-h-[48px] w-full cursor-pointer opacity-0"
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Style toggle + Actions */}
          <div
            className={cn(
              "flex flex-shrink-0 items-center justify-self-end",
              desktop ? "gap-2" : "gap-1"
            )}
          >
            {/* Style panel toggle stays in the desktop header; mobile exposes it in the bottom tool tray. */}
            {desktop && (
              <motion.button
                whileTap={zenTap.icon}
                onClick={() => {
                  setShowPromptsDropdown(false);
                  setShowStyleBar((v) => !v);
                }}
                className={cn(
                  "p-2 rounded-lg motion-safe:transition-all min-w-[48px] min-h-[48px] flex items-center justify-center",
                  showStyleBar
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-white/10 text-muted-foreground"
                )}
                aria-label={ts.diaryStyle || "Style"}
                aria-pressed={showStyleBar}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </motion.button>
            )}

            {entry && onDelete && (
              <motion.button
                whileTap={zenTap.icon}
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/10 text-muted-foreground hover:text-red-400 motion-safe:transition-all min-w-[48px] min-h-[48px] flex items-center justify-center"
                aria-label={ts.delete || "Delete"}
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            )}

            {/* Privacy Shield toggle */}
            <motion.button
              whileTap={zenTap.icon}
              onClick={() => setPrivacyShieldActive((active) => !active)}
              className={cn(
                "p-2 rounded-lg motion-safe:transition-all min-w-[48px] min-h-[48px] flex items-center justify-center",
                privacyShieldActive
                  ? "bg-violet-500/15 text-violet-400"
                  : "hover:bg-white/10 text-muted-foreground"
              )}
              aria-label={ts.diaryPrivacyShield || "Screen shield"}
              title={
                ts.diaryPrivacyShieldHint ||
                "Temporarily conceals the editor on this screen. It does not lock the diary."
              }
              aria-pressed={privacyShieldActive}
            >
              {privacyShieldActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </motion.button>

            <motion.button
              whileTap={saveSuccess ? {} : { scale: 0.92 }}
              whileHover={saveSuccess ? {} : { scale: 1.03 }}
              onClick={handleSave}
              disabled={saveInteractionLocked || !hasContent || !draftReady}
              aria-label={ts.journalSave || "Save"}
              aria-busy={saveState === "saving"}
              className={cn(
                "flex items-center gap-1.5 py-2 rounded-xl text-sm font-medium min-h-[48px] motion-safe:transition-all",
                desktop ? "px-4" : "px-3 min-w-[48px]",
                saveSuccess
                  ? "bg-primary/20 text-primary border border-primary/40 shadow-sm"
                  : "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 hover:shadow-sm",
                "disabled:opacity-40"
              )}
            >
              <AnimatePresence mode="wait">
                {saveSuccess ? (
                  <motion.span
                    key="success"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: [0, 1.3, 1], rotate: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
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
                    <span className="max-[380px]:sr-only">{ts.journalSave || "Save"}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {saveState !== "idle" ? (
          <div className={cn("min-w-0", desktop ? "self-end max-w-[min(28rem,100%)]" : "w-full")}>
            <SaveIndicator
              state={saveState}
              onRetry={handleRetry}
              retryLabel={
                saveFailureReason === "conflict" ? ts.journalSaveConflictRetry : undefined
              }
              errorTitle={
                saveFailureReason === "conflict" ? ts.journalSaveConflictTitle : undefined
              }
              errorHint={saveFailureReason === "conflict" ? ts.journalSaveConflictHint : undefined}
            />
          </div>
        ) : null}

        {/* ROW 2: Collapsible style panel */}
        <AnimatePresence>
          {desktop && showStyleBar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: easings.emphasizedDecelerate }}
              className="overflow-hidden"
            >
              <div className={JOURNAL_STYLE_TOOLBAR_SURFACE_CLASS}>
                <div
                  className={JOURNAL_STYLE_TOOLBAR_FLOW_CLASS}
                  role="group"
                  aria-label={styleToolsLabel}
                >
                  <span className="sr-only" aria-live="polite">
                    {selectedStyleStatus}
                  </span>
                  {/* Atmosphere capsule */}
                  <div className={JOURNAL_STYLE_TOOLBAR_GROUP_CLASS}>
                    {ATMOSPHERE_THEMES.map((at) => {
                      const isActive = at.name === diaryTheme.theme;
                      return (
                        <motion.button
                          key={at.name}
                          whileTap={zenTap.icon}
                          onClick={() => {
                            themeTransition.triggerTransition();
                            diaryTheme.setTheme(at.name);
                          }}
                          className={cn(
                            JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                            "text-xs",
                            isActive
                              ? JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS
                              : JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                          )}
                          style={
                            isActive
                              ? {
                                  borderColor: at.activeStyle.borderColor,
                                }
                              : undefined
                          }
                          aria-pressed={isActive}
                        >
                          {ts[at.i18nKey] || at.label}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Fonts + Size capsule */}
                  <div className={JOURNAL_STYLE_TOOLBAR_GROUP_CLASS}>
                    {DIARY_FONT_NAMES_LOCAL.map((name) => {
                      const isActive = name === diaryTheme.font;
                      const label =
                        name === "outfit"
                          ? ts.diaryFontSans || "Sans"
                          : name === "cormorant"
                            ? ts.diaryFontSerif || "Serif"
                            : name === "dancing"
                              ? ts.diaryFontScript || "Italic"
                              : ts.diaryFontHandwriting || "Hand";
                      return (
                        <motion.button
                          key={name}
                          whileTap={zenTap.icon}
                          onClick={() => diaryTheme.setFont(name)}
                          className={cn(
                            JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                            "gap-1.5 px-4",
                            isActive
                              ? JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS
                              : JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                          )}
                          style={{
                            fontFamily: DIARY_FONTS_LOCAL[name].family,
                            fontStyle: DIARY_FONTS_LOCAL[name].style,
                          }}
                          aria-pressed={name === diaryTheme.font}
                        >
                          Aa <span className="text-xs">{label}</span>
                        </motion.button>
                      );
                    })}
                    <motion.button
                      whileTap={zenTap.icon}
                      onClick={cycleFontSize}
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                      )}
                      aria-label={fontSizeToolLabel}
                    >
                      A<span className="ms-0.5 text-xs font-medium">{FONT_SIZES[fontSize]}</span>
                    </motion.button>
                  </div>

                  {/* Prompts button (new entries only) */}
                  {!entry && (
                    <div className="relative flex-shrink-0">
                      <motion.button
                        whileTap={zenTap.icon}
                        onClick={() => setShowPromptsDropdown(!showPromptsDropdown)}
                        className={cn(
                          JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                          "gap-1.5",
                          showPromptsDropdown
                            ? JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS
                            : JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                        )}
                        aria-expanded={showPromptsDropdown}
                      >
                        <Lightbulb className="w-4 h-4" aria-hidden="true" />
                        {ts.journalPromptsShort || ts.journalPrompt || "Prompts"}
                      </motion.button>
                    </div>
                  )}

                  {/* Features capsule */}
                  <div className={JOURNAL_STYLE_TOOLBAR_GROUP_CLASS}>
                    {MOOD_OPTIONS.map((opt) => (
                      <motion.button
                        key={opt.mood}
                        whileTap={zenTap.cell}
                        onClick={() => setMood(mood === opt.mood ? undefined : opt.mood)}
                        aria-label={moodLabels[opt.mood]}
                        aria-pressed={mood === opt.mood}
                        className={cn(
                          "flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-transparent text-foreground motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          mood === opt.mood
                            ? ""
                            : "hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
                        )}
                        style={mood === opt.mood ? opt.activeStyle : undefined}
                      >
                        <DiaryMiniOrb
                          mood={opt.mood}
                          size="micro"
                          className={cn(
                            "scale-[0.72] opacity-100 brightness-125 saturate-150 motion-safe:transition-all",
                            mood === opt.mood && "scale-[0.86] brightness-110"
                          )}
                        />
                      </motion.button>
                    ))}
                    <motion.button
                      whileTap={zenTap.icon}
                      onClick={() => setShowTags(!showTags)}
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        "gap-1.5",
                        showTags
                          ? JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS
                          : JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                      )}
                      aria-label={tagsToolLabel}
                      aria-pressed={showTags}
                      aria-expanded={showTags}
                    >
                      <ListChecks className="w-4 h-4" aria-hidden="true" />
                      {tagsToolLabel}
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={zenTap.icon}
                      onClick={toggleFavorite}
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        "gap-1.5",
                        isFavorite
                          ? JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS
                          : JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                      )}
                      aria-label={favoriteToolLabel}
                      aria-pressed={isFavorite}
                      data-testid="journal-favorite-toggle"
                    >
                      <Star
                        className="h-4 w-4"
                        fill={isFavorite ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
                      <span className="sr-only">{favoriteToolLabel}</span>
                    </motion.button>
                    <motion.button
                      whileTap={zenTap.icon}
                      onClick={() => {
                        collapseMobileToolsForSurface();
                        setShowStickers(true);
                      }}
                      disabled={stickers.length >= MAX_STICKERS_PER_ENTRY}
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS,
                        "gap-1.5 disabled:opacity-40"
                      )}
                      aria-label={
                        stickers.length >= MAX_STICKERS_PER_ENTRY
                          ? stickerLimitLabel
                          : stickerToolLabel
                      }
                      title={
                        stickers.length >= MAX_STICKERS_PER_ENTRY
                          ? stickerLimitLabel
                          : stickerToolLabel
                      }
                    >
                      <Sticker className="w-4 h-4" aria-hidden="true" />
                      {stickerToolLabel}
                    </motion.button>
                  </div>

                  {/* Paper color capsule */}
                  <div className={JOURNAL_STYLE_TOOLBAR_GROUP_CLASS} aria-label={paperToolLabel}>
                    <span className="px-1 text-xs font-semibold uppercase text-muted-foreground/80">
                      {paperToolLabel}
                    </span>
                    {(["dark", "milky", "white"] as PaperColor[]).map((pc) => (
                      <motion.button
                        key={pc}
                        whileTap={zenTap.cell}
                        onClick={() => setPaperColor(pc)}
                        className={cn(
                          JOURNAL_STYLE_TOOLBAR_SWATCH_BASE_CLASS,
                          paperColor === pc
                            ? JOURNAL_STYLE_TOOLBAR_SWATCH_ACTIVE_CLASS
                            : JOURNAL_STYLE_TOOLBAR_SWATCH_IDLE_CLASS
                        )}
                        style={{ background: PAPER_COLORS[pc].bg }}
                        aria-label={paperColorLabels[pc]}
                        aria-pressed={paperColor === pc}
                      />
                    ))}
                  </div>

                  {/* Ink capsule */}
                  <div className={JOURNAL_STYLE_TOOLBAR_GROUP_CLASS} aria-label={inkToolLabel}>
                    <span className="px-1 text-xs font-semibold uppercase text-muted-foreground/80">
                      {inkToolLabel}
                    </span>
                    {INK_COLORS.map((c) => (
                      <motion.button
                        key={c.hex}
                        whileTap={zenTap.cell}
                        onClick={() => setInkColor(c.hex)}
                        className={cn(
                          JOURNAL_STYLE_TOOLBAR_SWATCH_BASE_CLASS,
                          inkColor === c.hex
                            ? JOURNAL_STYLE_TOOLBAR_SWATCH_ACTIVE_CLASS
                            : JOURNAL_STYLE_TOOLBAR_SWATCH_IDLE_CLASS
                        )}
                        style={{ background: inkSwatchColor(c.hex) }}
                        aria-label={inkColorLabels[c.hex] || c.label}
                        aria-pressed={inkColor === c.hex}
                      />
                    ))}
                  </div>

                  {/* Media capsule (Record + Voice — Photo moved to bottom toolbar) */}
                  <div className={JOURNAL_STYLE_TOOLBAR_GROUP_CLASS}>
                    <motion.button
                      whileTap={zenTap.icon}
                      onClick={() => handleStartRecording()}
                      disabled={audioIds.length >= MAX_AUDIO_PER_ENTRY}
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS,
                        "gap-2 px-4 disabled:opacity-40"
                      )}
                      aria-label={
                        audioIds.length >= MAX_AUDIO_PER_ENTRY ? recordLimitLabel : recordToolLabel
                      }
                      title={
                        audioIds.length >= MAX_AUDIO_PER_ENTRY ? recordLimitLabel : recordToolLabel
                      }
                    >
                      <Mic className="w-4 h-4" aria-hidden="true" />
                      {recordToolLabel}
                    </motion.button>
                    <motion.button
                      whileTap={zenTap.icon}
                      onClick={handleToggleDictation}
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        "gap-2 px-4",
                        voice.isListening
                          ? JOURNAL_STYLE_TOOLBAR_BUTTON_DANGER_ACTIVE_CLASS
                          : JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                      )}
                      aria-label={voiceToolLabel}
                      aria-pressed={voice.isListening}
                    >
                      <Mic2 className="w-4 h-4" aria-hidden="true" />
                      {voice.isListening ? ts.journalDictateStop || "Stop" : voiceToolLabel}
                    </motion.button>
                  </div>

                  {/* Visual capsule (BG + Speed + Texture) */}
                  <div className={JOURNAL_STYLE_TOOLBAR_GROUP_CLASS}>
                    <motion.button
                      whileTap={zenTap.icon}
                      onClick={() =>
                        setBgIntensity((prev) =>
                          prev === "full" ? "dim" : prev === "dim" ? "off" : "full"
                        )
                      }
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        "gap-1.5 text-xs",
                        useSharedDiaryWallpaper && "hidden",
                        bgIntensity === "full"
                          ? JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS
                          : bgIntensity === "dim"
                            ? JOURNAL_STYLE_TOOLBAR_BUTTON_MUTED_ACTIVE_CLASS
                            : JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                      )}
                      aria-label={backgroundAriaLabel}
                      aria-pressed={bgIntensity !== "off"}
                    >
                      {bgIntensity === "full" ? (
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : bgIntensity === "dim" ? (
                        <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <CircleOff className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span className="sr-only">
                        {backgroundToolLabel}: {backgroundIntensityLabel}
                      </span>
                      <span aria-hidden="true">{backgroundToolLabel}</span>
                      <span aria-hidden="true" className="text-xs font-medium opacity-75">
                        {backgroundIntensityLabel}
                      </span>
                    </motion.button>
                    <motion.button
                      whileTap={zenTap.icon}
                      onClick={() =>
                        setParticleSpeed((prev) =>
                          prev === "slow" ? "drift" : prev === "drift" ? "off" : "slow"
                        )
                      }
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        "gap-1.5 text-xs",
                        useSharedDiaryWallpaper && "hidden",
                        particleSpeed === "drift"
                          ? JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS
                          : particleSpeed === "slow"
                            ? JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS
                            : JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                      )}
                      aria-label={particleSpeedAriaLabel}
                      aria-pressed={particleSpeed !== "off"}
                    >
                      <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="sr-only">
                        {motionToolLabel}: {particleSpeedLabel}
                      </span>
                      <span aria-hidden="true">{motionToolLabel}</span>
                      <span aria-hidden="true" className="text-xs font-medium opacity-75">
                        {particleSpeedLabel}
                      </span>
                    </motion.button>
                    <motion.button
                      whileTap={zenTap.icon}
                      onClick={() => {
                        const idx = PAPER_TEXTURE_NAMES.indexOf(paperTexture);
                        setPaperTexture(
                          PAPER_TEXTURE_NAMES[(idx + 1) % PAPER_TEXTURE_NAMES.length]
                        );
                      }}
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        "gap-1.5 text-xs",
                        paperTexture !== "clean"
                          ? JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS
                          : JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                      )}
                      aria-label={textureAriaLabel}
                      aria-pressed={paperTexture !== "clean"}
                    >
                      <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="sr-only">
                        {textureToolLabel}: {paperTextureLabel}
                      </span>
                      <span aria-hidden="true">{textureToolLabel}</span>
                      <span aria-hidden="true" className="text-xs font-medium opacity-75">
                        {paperTextureLabel}
                      </span>
                    </motion.button>
                  </div>

                  {/* Atmospheric pattern capsule */}
                  <div className={JOURNAL_STYLE_TOOLBAR_GROUP_CLASS} aria-label={sceneToolLabel}>
                    <span className="px-1 text-xs font-semibold uppercase text-muted-foreground/80">
                      {sceneToolLabel}
                    </span>
                    {BG_PATTERN_LIST.map((pat) => {
                      const isActive = pat.name === bgPattern;
                      const isNone = pat.name === "none";
                      return (
                        <motion.button
                          key={pat.name}
                          whileTap={zenTap.cell}
                          onClick={() => setBgPattern(pat.name)}
                          className={cn(
                            JOURNAL_STYLE_TOOLBAR_PATTERN_BASE_CLASS,
                            isActive
                              ? "scale-110 border-primary shadow-lg shadow-primary/20"
                              : "border-border/70 hover:border-primary/35 dark:border-white/20 dark:hover:border-primary/40",
                            isNone &&
                              !isActive &&
                              "border-dashed border-border/70 dark:border-white/25"
                          )}
                          style={isNone ? undefined : { background: pat.swatch }}
                          aria-label={getJournalTranslation(ts, pat.i18nKey, pat.name)}
                          aria-pressed={isActive}
                          title={getJournalTranslation(ts, pat.i18nKey, pat.name)}
                        >
                          {isNone && <CircleOff className="w-3.5 h-3.5 text-muted-foreground" />}
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
                      className="mx-1 mt-2 space-y-1.5 rounded-2xl border border-border/60 bg-popover/95 p-3 shadow-2xl backdrop-blur-xl dark:border-white/10"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={zenMotion.gentle}
                    >
                      <div className="flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between mb-1">
                        <span className="flex min-w-0 items-center gap-1.5 whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70">
                          <Lightbulb className="w-3 h-3" aria-hidden="true" />
                          {ts.journalWritingPrompts || "Writing prompts"}
                        </span>
                        <div className="flex items-center self-end gap-1">
                          <button
                            onClick={() => setPromptSeed((s) => s + 1)}
                            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-foreground/75 hover:bg-primary/10 hover:text-primary"
                            aria-label={t.ariaShufflePrompts}
                          >
                            <Shuffle className="w-3 h-3 text-foreground/70" />
                          </button>
                          <button
                            onClick={() => setShowPromptsDropdown(false)}
                            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-foreground/75 hover:bg-primary/10 hover:text-primary"
                            aria-label={ts.close || "Close"}
                          >
                            <X className="w-3 h-3 text-foreground/70" />
                          </button>
                        </div>
                      </div>
                      {randomPrompts.map((prompt, i) => (
                        <motion.button
                          key={`${promptSeed}-${i}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileTap={zenTap.cell}
                          transition={{
                            delay: i * 0.04,
                            type: "spring",
                            stiffness: 300,
                            damping: 25,
                          }}
                          onClick={() => handlePromptTap(prompt)}
                          className="block min-h-[48px] w-full rounded-xl px-3 py-2.5 text-start text-xs text-foreground/75 motion-safe:transition-all hover:bg-primary/10 hover:text-foreground"
                        >
                          {prompt}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ROW 3: Content area */}
      {/* ═══ CONTENT AREA ═══ */}
      <div ref={contentAreaRef} className="flex-1 relative overflow-hidden">
        <div
          ref={scrollAreaRef}
          className={cn(
            "absolute inset-0 overflow-y-auto z-10",
            desktop
              ? "px-8 pt-[clamp(80px,18vh,140px)] pb-[clamp(100px,22vh,160px)]"
              : "px-3 pt-6 pb-[calc(2rem+var(--diary-keyboard-inset,0px))] scroll-pb-[calc(8rem+var(--diary-keyboard-inset,0px))]"
          )}
          onScroll={handleContentScroll}
        >
          <div
            ref={paperRef}
            data-testid="journal-editor-paper"
            className={cn(
              "journal-editor-paper-surface relative max-w-4xl mx-auto rounded-2xl border p-4 sm:p-6 md:p-8 min-h-[60dvh] space-y-4 [contain:layout_style_paint]",
              desktop ? "shadow-md max-w-3xl" : "shadow-2xl",
              zenFocusActive && "zen-focus-active"
            )}
            style={
              {
                backgroundColor: paperColors.bg,
                color: paperColors.text,
                borderColor: paperColors.border,
                "--journal-paper-text": paperColors.text,
                "--journal-paper-muted": paperColors.muted,
                ...getPaperTextureStyle(paperTexture, paperColor === "dark"),
                ...sharedWallpaperPaperStyle,
              } as React.CSSProperties
            }
          >
            {/* Draft restore banner */}
            <AnimatePresence>
              {draftLoadError && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-4 mt-2 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 p-3"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--journal-paper-text)]">
                    {draftLoadInUse
                      ? ts.journalDraftInUse ||
                        "This entry is open in another window. Close it there, then try again."
                      : ts.journalLoadFailedHint ||
                        "This load attempt did not change your entries. Try loading again."}
                  </span>
                  <button
                    type="button"
                    onClick={() => void retryDraftLoad()}
                    className="min-h-[48px] rounded-lg px-3 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    {ts.journalRetryLoad || "Retry loading"}
                  </button>
                </motion.div>
              )}
              {draftAvailable && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mx-4 mt-2 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-xs text-[var(--journal-paper-text)] flex-1">
                      {ts.journalDraftFound || "Unsaved draft found"}
                    </span>
                    <button
                      onClick={handleRestoreDraft}
                      disabled={draftDismissSubmitting}
                      className="text-xs font-medium text-primary px-2 py-1 rounded-lg hover:bg-primary/10 min-h-[48px]"
                    >
                      {ts.journalRestore || "Restore"}
                    </button>
                    <button
                      onClick={() => void handleDismissDraft()}
                      disabled={draftDismissSubmitting}
                      className="p-1 rounded hover:bg-muted/50 min-w-[48px] min-h-[48px] flex items-center justify-center"
                      aria-label={ts.dismiss || "Dismiss"}
                    >
                      <X className="w-3.5 h-3.5 text-[var(--journal-paper-muted)]" />
                    </button>
                  </div>
                  {draftDismissError ? (
                    <p role="alert" className="mx-4 mt-2 text-xs font-medium text-destructive">
                      {draftDismissError}
                    </p>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Title */}
            <input
              type="text"
              disabled={!draftReady || saveInteractionLocked}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={ts.journalEntryTitle || "Title (optional)"}
              aria-label={ts.journalEntryTitle || "Entry title"}
              dir="auto"
              autoFocus={!entry}
              className="w-full text-2xl font-bold tracking-tight bg-transparent border-none outline-none"
              style={{
                color: readableInkColor,
                fontFamily: diaryTheme.fontFamily,
                fontStyle: diaryTheme.fontStyle,
              }}
              maxLength={100}
              onFocus={(e) => {
                const el = e.target;
                setTimeout(
                  () =>
                    el.scrollIntoView({
                      behavior: shouldAnimate() ? "smooth" : "auto",
                      block: "center",
                    }),
                  300
                );
              }}
            />

            {/* Selected writing prompt; guidance only, never saved into the entry body. */}
            <AnimatePresence>
              {selectedPrompt && (
                <motion.div
                  id="journal-selected-prompt"
                  data-testid="journal-selected-prompt"
                  role="note"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={zenMotion.gentle}
                  className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-relaxed"
                  style={{ color: paperColors.text }}
                >
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{selectedPrompt}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPrompt(null)}
                    className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label={ts.close || "Close"}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stickers */}
            {stickers.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {stickers.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleRemoveSticker(i)}
                    className="px-1.5 py-0.5 rounded-lg hover:bg-muted/50 active:scale-90 motion-safe:transition-transform min-w-[48px] min-h-[48px] flex items-center justify-center"
                    aria-label={`${ts.journalRemoveSticker || "Remove sticker"} ${s}`}
                  >
                    <StickerRenderer emoji={s} size="md" />
                  </button>
                ))}
              </div>
            )}

            {/* Photos (gallery shows only non-floating photos) */}
            {galleryPhotoIds.length > 0 && (
              <JournalPhotoGallery
                entryId={entryId}
                photoIds={galleryPhotoIds}
                photoLayout={photoLayout}
                onRemovePhoto={handleRemovePhoto}
                onFloatPhoto={handleFloatPhotoWithFocus}
                editable
              />
            )}

            {/* Audio recordings */}
            {audioRecordings.length > 0 && (
              <div className="space-y-1.5">
                {audioRecordings.map((audio, audioIndex) => (
                  <div key={audio.id} className="flex items-center gap-1.5">
                    <div className="flex-1">
                      <JournalAudioPlayer
                        src={audio.data}
                        duration={audio.duration}
                        index={audioIndex + 1}
                      />
                    </div>
                    <button
                      onClick={() => requestRemoveAudio(audio.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive motion-safe:transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
                      aria-label={formatRemoveAudioLabel(audio)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {audioNotice && (
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-[48px] items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-[var(--diary-text,hsl(var(--foreground)))]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">{audioNotice}</span>
              </div>
            )}

            {audioError && (
              <div
                role="alert"
                className="flex min-h-[48px] flex-wrap items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{audioError}</span>
                {audioLoadRetryAvailable && (
                  <button
                    type="button"
                    onClick={retryAudioLoad}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-destructive/30 px-3 font-semibold motion-safe:transition-[background-color,transform] hover:bg-destructive/10 active:scale-[0.98]"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>{ts.journalAudioLoadRetry || "Try loading audio again"}</span>
                  </button>
                )}
              </div>
            )}

            {/* Voice dictation indicator */}
            <AnimatePresence>
              {voice.isListening && (
                <motion.div
                  initial={shouldAnimate() ? { opacity: 0, height: 0 } : false}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={
                    shouldAnimate()
                      ? { opacity: 0, height: 0 }
                      : { opacity: 1, height: "auto" }
                  }
                  transition={shouldAnimate() ? zenMotion.gentle : zenMotion.instant}
                  className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" />
                    <span className="text-xs font-medium text-primary">
                      {ts.journalDictating || "Listening..."}
                    </span>
                    {voice.transcript && !privacyShieldActive && (
                      <span className="basis-full whitespace-normal break-words [overflow-wrap:anywhere] text-xs text-muted-foreground/60">
                        {voice.transcript.slice(-60)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleDictation}
                    className="p-1 rounded-md hover:bg-primary/20 min-w-[48px] min-h-[48px] flex items-center justify-center"
                    aria-label={ts.stop || "Stop"}
                  >
                    <Square className="w-3 h-3 text-primary" aria-hidden="true" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tags */}
            {tags.some((tag) => !isJournalFavoriteTag(tag)) && (
              <div className="flex gap-1.5 flex-wrap">
                {tags
                  .filter((tag) => !isJournalFavoriteTag(tag))
                  .map((tag) => {
                    const displayTag = getJournalDisplayTag(tag);
                    if (!displayTag) return null;
                    return (
                      <button
                        key={tag}
                        onClick={() => setTags((prev) => prev.filter((t2) => t2 !== tag))}
                        className="flex min-h-[48px] items-center gap-1 rounded-full max-w-full min-w-0 bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20 motion-safe:transition-colors"
                        aria-label={formatRemoveTagLabel(displayTag)}
                      >
                        <span className="max-w-full min-w-0 whitespace-normal break-words text-start [overflow-wrap:anywhere]">
                          {displayTag} &times;
                        </span>
                      </button>
                    );
                  })}
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
                      ref={tagInputRef}
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder={ts.journalTagPlaceholder || "Add tag..."}
                      aria-label={ts.journalTagPlaceholder || "Add tag"}
                      className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/10 text-sm text-foreground outline-none placeholder:text-foreground/50 min-h-[48px]"
                      autoFocus
                      maxLength={30}
                    />
                    <motion.button
                      whileTap={zenTap.icon}
                      type="submit"
                      className="px-4 py-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm font-medium min-h-[48px]"
                    >
                      {ts.journalAdd || "Add"}
                    </motion.button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Burn-a-thought widget (inline, above textarea) */}
            <AnimatePresence>
              {showBurnWidget && (
                <BurnThoughtWidget onClose={handleCloseBurn} onReleased={onReleaseThought} />
              )}
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
              {!formatHintDismissed && <DiaryFormatHint onDismiss={handleDismissFormatHint} />}
            </AnimatePresence>

            {/* Content editor (contenteditable WYSIWYG) */}
            <div
              ref={editorRef}
              contentEditable={draftReady && !saveInteractionLocked}
              aria-disabled={!draftReady || saveInteractionLocked}
              role="textbox"
              aria-multiline="true"
              aria-label={ts.journalEntryBody || "Diary entry body"}
              dir="auto"
              tabIndex={0}
              suppressContentEditableWarning
              className="w-full max-w-prose mx-auto min-h-[260px] bg-transparent border-none outline-none resize-none rounded-xl [unicode-bidi:plaintext] [overflow-wrap:anywhere] focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent [&_blockquote]:border-s-2 [&_blockquote]:border-current/20 [&_blockquote]:ps-3 [&_blockquote]:italic [&_code]:bg-black/5 dark:[&_code]:bg-black/5 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_del]:line-through empty:before:content-[attr(data-placeholder)] empty:before:text-current empty:before:pointer-events-none leading-[1.8]"
              style={{
                fontSize: getScaledJournalFontSize(fontSize),
                fontFamily: diaryTheme.fontFamily,
                fontStyle: diaryTheme.fontStyle,
                color: readableInkColor,
              }}
              onInput={handleEditorInput}
              onPaste={handleEditorPaste}
              onDrop={handleEditorDrop}
              onFocus={(e) => {
                const el = e.currentTarget;
                const scrollArea = scrollAreaRef.current;
                if (!scrollArea) return;
                setTimeout(() => {
                  const targetTop = Math.max(
                    0,
                    el.offsetTop - (scrollArea.clientHeight - el.clientHeight) / 2
                  );
                  scrollArea.scrollTo({
                    behavior: shouldAnimate() ? "smooth" : "auto",
                    top: targetTop,
                  });
                }, 300);
              }}
              data-placeholder={ts.journalEntryPlaceholder || "What's on your mind?"}
            />

            {/* Word count + char count + reading time + auto-save indicator */}
            <div
              data-testid="journal-entry-metrics"
              className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2"
            >
              {wordCount > 0 && (
                <div
                  className="flex flex-wrap items-center gap-x-2 gap-y-1"
                  style={{ color: paperColors.muted }}
                >
                  <span className="text-xs font-medium">
                    {formatJournalWordCount(wordCount, language, ts)}
                  </span>
                  <span className="text-xs font-medium">
                    {formatLocalizedCount(
                      content.length,
                      language,
                      ts,
                      "journalCharacterCount",
                      ts.journalChars || "chars"
                    )}
                  </span>
                  {wordCount >= 50 && (
                    <span className="text-xs font-medium">
                      ~
                      {formatLocalizedCount(
                        Math.ceil(wordCount / 200),
                        language,
                        ts,
                        "journalReadingTimeCount",
                        ts.journalMinRead || "min read"
                      )}
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
                    className="flex items-center gap-0.5 text-xs text-green-500/60"
                  >
                    <Check className="w-2.5 h-2.5" /> {ts.journalDraftSaved || "Saved"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Kept after the entry text in reading order; absolute positioning preserves the canvas layout. */}
            {placedPhotoIds.length > 0 && (
              <FloatingMediaLayer
                entryId={entryId}
                photoIds={placedPhotoIds}
                layout={photoLayout}
                onLayoutChange={setPhotoLayout}
                onLayoutCommit={() => {
                  void checkpointPhotoLayout();
                }}
                onReturnToGallery={handleReturnToGallery}
                containerRef={paperRef}
                focusPhotoId={floatingFocusPhotoId}
                onPhotoFocusHandled={handleFloatingPhotoFocusHandled}
              />
            )}
          </div>
        </div>
      </div>
      {/* END content area */}

      {!isNative ? (
        <input
          ref={desktopPhotoInputRef}
          type="file"
          accept={JOURNAL_PHOTO_ACCEPT}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          disabled={!draftReady || photoIds.length >= MAX_PHOTOS_PER_ENTRY}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            event.currentTarget.value = "";
            if (!file) return;
            setDesktopInitialPhotoFile(file);
            setShowPhotos(true);
          }}
        />
      ) : null}

      {/* ═══ BOTTOM GLASS TOOLBAR (Magic) ═══ */}
      <div
        data-testid="journal-mobile-tools-panel"
        className={cn(
          "journal-editor-chrome relative z-50 flex-shrink-0 w-full border-t backdrop-blur-[20px] motion-safe:transition-all",
          desktop
            ? "px-6 py-3 pb-[max(0.75rem,var(--safe-bottom))] bg-background/85 border-border/20 shadow-lg"
            : mobileToolsCollapsed
              ? "px-3 py-1.5 pb-[max(0.5rem,var(--safe-bottom))] bg-background/85 border-primary/10 shadow-xl"
              : "max-h-[calc(var(--app-viewport-height)*0.72)] touch-pan-y overflow-y-auto overscroll-contain px-3 py-2 pb-[max(0.75rem,var(--safe-bottom))] bg-background/90 border-primary/15 shadow-2xl"
        )}
      >
        {!desktop && mobileToolsCollapsed ? (
          <motion.button
            ref={mobileToolsButtonRef}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            whileTap={zenTap.button}
            onClick={handleMobileToolsExpand}
            className="mx-auto flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 text-xs font-semibold text-primary shadow-sm"
            aria-expanded={false}
            aria-label={ts.journalMobileTools || "Tools"}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
            <span>{ts.journalMobileTools || "Tools"}</span>
          </motion.button>
        ) : (
          <>
            {!desktop && (
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere] text-xs font-semibold text-foreground/80">
                    {ts.journalMobileTools || "Tools"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleMobileToolsCollapse}
                  className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground motion-safe:transition-colors hover:bg-primary/10 hover:text-primary"
                  aria-expanded={true}
                  aria-label={ts.close || "Close"}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            <AnimatePresence initial={false}>
              {!desktop && showStyleBar && (
                <motion.div
                  key="mobile-style-tray"
                  initial={{ opacity: 0, height: 0, y: 10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: 10, transition: { duration: 0.24, ease: easings.emphasizedAccelerate } }}
                  transition={{ duration: 0.24, ease: easings.emphasizedDecelerate }}
                  role="group"
                  aria-label={styleToolsLabel}
                  className="mb-2 max-h-[min(56dvh,28rem)] overflow-y-auto overscroll-contain rounded-3xl border border-primary/25 bg-background/95 p-2 shadow-inner"
                >
                  <span className="sr-only" aria-live="polite">
                    {selectedStyleStatus}
                  </span>
                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 pb-1">
                    <div className="col-span-full flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-background/90 p-1">
                      <span className="w-full px-2 pt-1 text-xs font-semibold uppercase text-foreground/75 whitespace-normal break-words">
                        {ts.journalThemeLabel || "Theme"}
                      </span>
                      {ATMOSPHERE_THEMES.map((at) => {
                        const isActive = at.name === diaryTheme.theme;
                        return (
                          <button
                            key={at.name}
                            type="button"
                            onClick={() => {
                              themeTransition.triggerTransition();
                              diaryTheme.setTheme(at.name);
                            }}
                            className={cn(
                              "min-h-[48px] rounded-xl border px-3 max-w-full min-w-0 text-xs font-semibold whitespace-normal break-words [overflow-wrap:anywhere] motion-safe:transition-all",
                              isActive
                                ? "border-primary/30 bg-primary text-primary-foreground"
                                : "border-transparent text-foreground/80 hover:bg-primary/10 hover:text-primary"
                            )}
                            aria-pressed={isActive}
                          >
                            {ts[at.i18nKey] || at.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={cycleFontSize}
                      className="flex min-h-[48px] min-w-0 items-center justify-start gap-2 rounded-2xl border border-border/60 bg-background/90 px-3 text-sm font-semibold text-foreground whitespace-normal break-words [overflow-wrap:anywhere]"
                      aria-label={fontSizeToolLabel}
                    >
                      <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="text-xs text-foreground/80">{fontSizeToolLabel}</span>
                    </button>

                    {!entry && (
                      <button
                        ref={recordingRetryRef}
                        type="button"
                        onClick={() => setShowPromptsDropdown(!showPromptsDropdown)}
                        className={cn(
                          "flex min-h-[48px] min-w-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold whitespace-normal break-words [overflow-wrap:anywhere] motion-safe:transition-all",
                          showPromptsDropdown
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-border/60 bg-background/90 text-foreground/80 hover:bg-primary/10 hover:text-primary"
                        )}
                        aria-expanded={showPromptsDropdown}
                      >
                        <Lightbulb className="h-4 w-4" aria-hidden="true" />
                        {ts.journalWritingPrompts || "Prompts"}
                      </button>
                    )}

                    <div className="col-span-full flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-background/90 p-1">
                      <span className="w-full px-1 text-xs font-semibold uppercase text-foreground/75 whitespace-normal break-words">
                        {ts.journalToolbarMood || "Mood"}
                      </span>
                      {MOOD_OPTIONS.map((opt) => (
                        <button
                          key={opt.mood}
                          type="button"
                          onClick={() => setMood(mood === opt.mood ? undefined : opt.mood)}
                          aria-label={moodLabels[opt.mood]}
                          aria-pressed={mood === opt.mood}
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-primary/[0.06] text-foreground motion-safe:transition-all",
                            mood === opt.mood
                              ? ""
                              : "hover:border-primary/35 hover:bg-primary/12 hover:text-primary"
                          )}
                          style={mood === opt.mood ? opt.activeStyle : undefined}
                        >
                          <DiaryMiniOrb
                            mood={opt.mood}
                            size="micro"
                            className={cn(
                              "scale-[0.72] opacity-100 brightness-150 saturate-[1.7] motion-safe:transition-all",
                              mood === opt.mood && "scale-[0.86] brightness-110"
                            )}
                          />
                        </button>
                      ))}
                    </div>

                    <div className="col-span-full flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-background/90 p-1">
                      <span className="w-full px-1 text-xs font-semibold uppercase text-foreground/75 whitespace-normal break-words">
                        {paperToolLabel}
                      </span>
                      {(["dark", "milky", "white"] as PaperColor[]).map((pc) => (
                        <button
                          key={pc}
                          type="button"
                          onClick={() => setPaperColor(pc)}
                          className={cn(
                            JOURNAL_STYLE_TOOLBAR_SWATCH_BASE_CLASS,
                            paperColor === pc
                              ? JOURNAL_STYLE_TOOLBAR_SWATCH_ACTIVE_CLASS
                              : JOURNAL_STYLE_TOOLBAR_SWATCH_IDLE_CLASS
                          )}
                          style={{ background: PAPER_COLORS[pc].bg }}
                          aria-label={paperColorLabels[pc]}
                          aria-pressed={paperColor === pc}
                        />
                      ))}
                    </div>

                    <div className="col-span-full flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-background/90 p-1">
                      <span className="w-full px-1 text-xs font-semibold uppercase text-foreground/75 whitespace-normal break-words">
                        {inkToolLabel}
                      </span>
                      {INK_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setInkColor(c.hex)}
                          className={cn(
                            JOURNAL_STYLE_TOOLBAR_SWATCH_BASE_CLASS,
                            inkColor === c.hex
                              ? JOURNAL_STYLE_TOOLBAR_SWATCH_ACTIVE_CLASS
                              : JOURNAL_STYLE_TOOLBAR_SWATCH_IDLE_CLASS
                          )}
                          style={{ background: inkSwatchColor(c.hex) }}
                          aria-label={inkColorLabels[c.hex] || c.label}
                          aria-pressed={inkColor === c.hex}
                        />
                      ))}
                    </div>

                    <div
                      className="col-span-full flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-background/90 p-1"
                      aria-label={sceneToolLabel}
                    >
                      <span className="w-full px-1 text-xs font-semibold uppercase text-foreground/75 whitespace-normal break-words">
                        {sceneToolLabel}
                      </span>
                      {BG_PATTERN_LIST.map((pat) => {
                        const isActive = pat.name === bgPattern;
                        const isNone = pat.name === "none";
                        return (
                          <button
                            key={pat.name}
                            type="button"
                            onClick={() => setBgPattern(pat.name)}
                            className={cn(
                              JOURNAL_STYLE_TOOLBAR_PATTERN_BASE_CLASS,
                              isActive
                                ? "scale-110 border-primary shadow-lg shadow-primary/20"
                                : "border-border/70 hover:border-primary/35 dark:border-white/20 dark:hover:border-primary/40",
                              isNone &&
                                !isActive &&
                                "border-dashed border-border/70 dark:border-white/25"
                            )}
                            style={isNone ? undefined : { background: pat.swatch }}
                            aria-label={getJournalTranslation(ts, pat.i18nKey, pat.name)}
                            aria-pressed={isActive}
                            title={getJournalTranslation(ts, pat.i18nKey, pat.name)}
                          >
                            {isNone && (
                              <CircleOff
                                className="h-4 w-4 text-muted-foreground"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setBgIntensity((prev) =>
                          prev === "full" ? "dim" : prev === "dim" ? "off" : "full"
                        )
                      }
                      className={cn(
                        "flex min-h-[48px] min-w-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold whitespace-normal break-words [overflow-wrap:anywhere] motion-safe:transition-all",
                        useSharedDiaryWallpaper && "hidden",
                        bgIntensity !== "off"
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                      aria-label={backgroundAriaLabel}
                      aria-pressed={bgIntensity !== "off"}
                    >
                      {bgIntensity === "full" ? (
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                      ) : bgIntensity === "dim" ? (
                        <Moon className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <CircleOff className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="flex min-w-0 flex-col items-start leading-tight">
                        <span className="max-w-full whitespace-normal break-words [overflow-wrap:anywhere]">
                          {backgroundToolLabel}
                        </span>
                        <span className="max-w-full whitespace-normal break-words [overflow-wrap:anywhere] text-xs font-medium opacity-75">
                          {backgroundIntensityLabel}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setParticleSpeed((prev) =>
                          prev === "slow" ? "drift" : prev === "drift" ? "off" : "slow"
                        )
                      }
                      className={cn(
                        "flex min-h-[48px] min-w-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold whitespace-normal break-words [overflow-wrap:anywhere] motion-safe:transition-all",
                        useSharedDiaryWallpaper && "hidden",
                        particleSpeed !== "off"
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                      aria-label={particleSpeedAriaLabel}
                      aria-pressed={particleSpeed !== "off"}
                    >
                      <Gauge className="h-4 w-4" aria-hidden="true" />
                      <span className="flex min-w-0 flex-col items-start leading-tight">
                        <span className="max-w-full whitespace-normal break-words [overflow-wrap:anywhere]">
                          {motionToolLabel}
                        </span>
                        <span className="max-w-full whitespace-normal break-words [overflow-wrap:anywhere] text-xs font-medium opacity-75">
                          {particleSpeedLabel}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const idx = PAPER_TEXTURE_NAMES.indexOf(paperTexture);
                        setPaperTexture(
                          PAPER_TEXTURE_NAMES[(idx + 1) % PAPER_TEXTURE_NAMES.length]
                        );
                      }}
                      className={cn(
                        "flex min-h-[48px] min-w-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold whitespace-normal break-words [overflow-wrap:anywhere] motion-safe:transition-all",
                        paperTexture !== "clean"
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                      aria-label={textureAriaLabel}
                      aria-pressed={paperTexture !== "clean"}
                    >
                      <Layers className="h-4 w-4" aria-hidden="true" />
                      <span className="flex min-w-0 flex-col items-start leading-tight">
                        <span className="max-w-full whitespace-normal break-words [overflow-wrap:anywhere]">
                          {textureToolLabel}
                        </span>
                        <span className="max-w-full whitespace-normal break-words [overflow-wrap:anywhere] text-xs font-medium opacity-75">
                          {paperTextureLabel}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTags(!showTags)}
                      className={cn(
                        "flex min-h-[48px] min-w-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold whitespace-normal break-words [overflow-wrap:anywhere] motion-safe:transition-all",
                        showTags
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                      aria-label={tagsToolLabel}
                      aria-pressed={showTags}
                      aria-expanded={showTags}
                    >
                      <ListChecks className="h-4 w-4" aria-hidden="true" />
                      {tagsToolLabel}
                    </button>

                    <button
                      type="button"
                      onClick={toggleFavorite}
                      className={cn(
                        "flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-2xl border px-3 motion-safe:transition-all",
                        isFavorite
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                      aria-label={favoriteToolLabel}
                      aria-pressed={isFavorite}
                      data-testid="journal-favorite-toggle"
                    >
                      <Star
                        className="h-4 w-4"
                        fill={isFavorite ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        collapseMobileToolsForSurface();
                        setShowStickers(true);
                      }}
                      disabled={stickers.length >= MAX_STICKERS_PER_ENTRY}
                      className="flex min-h-[48px] min-w-0 items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 text-xs font-semibold text-muted-foreground whitespace-normal break-words [overflow-wrap:anywhere] motion-safe:transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                      aria-label={
                        stickers.length >= MAX_STICKERS_PER_ENTRY
                          ? stickerLimitLabel
                          : stickerToolLabel
                      }
                      title={
                        stickers.length >= MAX_STICKERS_PER_ENTRY
                          ? stickerLimitLabel
                          : stickerToolLabel
                      }
                    >
                      <Sticker className="h-4 w-4" aria-hidden="true" />
                      {ts.journalToolbarSticker || "Sticker"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        collapseMobileToolsForSurface();
                        void handleStartRecording();
                      }}
                      disabled={audioIds.length >= MAX_AUDIO_PER_ENTRY}
                      className="flex min-h-[48px] min-w-0 items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 text-xs font-semibold text-muted-foreground whitespace-normal break-words [overflow-wrap:anywhere] motion-safe:transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                      aria-label={
                        audioIds.length >= MAX_AUDIO_PER_ENTRY ? recordLimitLabel : recordToolLabel
                      }
                      title={
                        audioIds.length >= MAX_AUDIO_PER_ENTRY ? recordLimitLabel : recordToolLabel
                      }
                    >
                      <Mic className="h-4 w-4" aria-hidden="true" />
                      {recordToolLabel}
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleDictation}
                      className={cn(
                        "flex min-h-[48px] min-w-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold whitespace-normal break-words [overflow-wrap:anywhere] motion-safe:transition-all",
                        voice.isListening
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                      aria-label={voiceToolLabel}
                      aria-pressed={voice.isListening}
                    >
                      <Mic2 className="h-4 w-4" aria-hidden="true" />
                      {voice.isListening ? ts.journalDictateStop || "Stop" : voiceToolLabel}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showPromptsDropdown && (
                      <motion.div
                        ref={promptsDropdownRef}
                        className="mt-2 rounded-2xl border border-border/60 bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={zenMotion.gentle}
                      >
                        <div className="mb-1 flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                          <span className="flex min-w-0 items-center gap-1.5 whitespace-normal break-words text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
                            <Lightbulb className="h-3 w-3" aria-hidden="true" />
                            {ts.journalWritingPrompts || "Writing prompts"}
                          </span>
                          <div className="flex items-center self-end gap-1">
                            <button
                              type="button"
                              onClick={() => setPromptSeed((s) => s + 1)}
                              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              aria-label={t.ariaShufflePrompts}
                            >
                              <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowPromptsDropdown(false)}
                              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              aria-label={ts.close || "Close"}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        {randomPrompts.map((prompt, i) => (
                          <button
                            key={`${promptSeed}-${i}`}
                            type="button"
                            onClick={() => handlePromptTap(prompt)}
                            className="block min-h-[48px] w-full rounded-xl px-3 py-2 text-start text-xs text-muted-foreground motion-safe:transition-colors hover:bg-primary/10 hover:text-foreground"
                          >
                            {prompt}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              data-testid="journal-mobile-tools"
              className={cn(
                desktop
                  ? "flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1.5 px-1.5"
                  : "zf-auto-fit-grid-9 grid gap-1.5"
              )}
            >
              {!desktop && (
                <motion.button
                  type="button"
                  whileTap={zenTap.icon}
                  onClick={handleMobileStyleToggle}
                  className={cn(
                    "rounded-2xl font-medium border motion-safe:transition-all flex items-center min-h-[50px] min-w-0 px-2 py-2 text-xs leading-tight flex-col justify-center gap-1",
                    showStyleBar
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                  )}
                  aria-expanded={showStyleBar}
                  aria-pressed={showStyleBar}
                  aria-label={ts.diaryStyle || "Style"}
                >
                  <Palette className="w-4 h-4" aria-hidden="true" />
                  <span className="max-w-full whitespace-normal break-words text-center [hyphens:manual] [overflow-wrap:break-word]">
                    {ts.diaryStyle || "Style"}
                  </span>
                </motion.button>
              )}
              <motion.button
                type="button"
                whileTap={zenTap.icon}
                onClick={() => {
                  void hapticTap();
                  requestPhotoSelection();
                }}
                disabled={!draftReady || photoIds.length >= MAX_PHOTOS_PER_ENTRY}
                aria-label={
                  photoIds.length >= MAX_PHOTOS_PER_ENTRY ? photoLimitLabel : photoToolLabel
                }
                title={photoIds.length >= MAX_PHOTOS_PER_ENTRY ? photoLimitLabel : photoToolLabel}
                className={cn(
                  "rounded-2xl font-medium text-muted-foreground border border-transparent hover:bg-primary/10 hover:text-primary motion-safe:transition-all flex items-center disabled:opacity-40",
                  desktop
                    ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                    : "min-h-[50px] min-w-0 px-2 py-2 text-xs leading-tight flex-col justify-center gap-1"
                )}
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full whitespace-normal break-words text-center [hyphens:manual] [overflow-wrap:break-word]">
                  {ts.diarySnapshot || "Photo"}
                </span>
              </motion.button>
              <motion.button
                whileTap={zenTap.icon}
                onClick={() => {
                  void hapticTap();
                  if (!showBurnWidget) collapseMobileToolsForSurface();
                  setShowBurnWidget((v) => !v);
                  setShowGratitudeWidget(false);
                }}
                className={cn(
                  "rounded-2xl font-medium border motion-safe:transition-all flex items-center",
                  desktop
                    ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                    : "min-h-[50px] min-w-0 px-2 py-2 text-xs leading-tight flex-col justify-center gap-1",
                  showBurnWidget
                    ? "bg-destructive/10 text-destructive border-destructive/25"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                )}
                aria-pressed={showBurnWidget}
              >
                <Flame className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full whitespace-normal break-words text-center [hyphens:manual] [overflow-wrap:break-word]">
                  {ts.journalBurnShort || ts.journalBurnButton || "Burn"}
                </span>
              </motion.button>
              {onAddGratitude && (
                <motion.button
                  whileTap={zenTap.icon}
                  onClick={() => {
                    void hapticTap();
                    if (!showGratitudeWidget) collapseMobileToolsForSurface();
                    setShowGratitudeWidget((v) => !v);
                    setShowBurnWidget(false);
                  }}
                  className={cn(
                    "rounded-2xl font-medium border motion-safe:transition-all flex items-center",
                    desktop
                      ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                      : "min-h-[50px] min-w-0 px-2 py-2 text-xs leading-tight flex-col justify-center gap-1",
                    showGratitudeWidget
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                  )}
                  aria-pressed={showGratitudeWidget}
                >
                  <Leaf className="w-4 h-4" aria-hidden="true" />
                  <span className="max-w-full whitespace-normal break-words text-center [hyphens:manual] [overflow-wrap:break-word]">
                    {ts.journalGratitudeShort || ts.journalGratitudeTitle || "Gratitude"}
                  </span>
                </motion.button>
              )}
              <motion.button
                whileTap={zenTap.icon}
                onClick={() => {
                  void hapticTap();
                  if (!showBreathe) collapseMobileToolsForSurface();
                  setShowBreathe(!showBreathe);
                }}
                className={cn(
                  "rounded-2xl font-medium border motion-safe:transition-all flex items-center",
                  desktop
                    ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                    : "min-h-[50px] min-w-0 px-2 py-2 text-xs leading-tight flex-col justify-center gap-1",
                  showBreathe
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                )}
                aria-pressed={showBreathe}
              >
                <Wind className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full whitespace-normal break-words text-center [hyphens:manual] [overflow-wrap:break-word]">
                  {ts.diaryBreathe || "Breathe"}
                </span>
              </motion.button>
              <motion.button
                whileTap={zenTap.icon}
                onClick={() => {
                  void hapticTap();
                  if (!zenFocusActive) collapseMobileToolsForSurface();
                  setZenFocusActive(!zenFocusActive);
                }}
                className={cn(
                  "rounded-2xl font-medium border motion-safe:transition-all flex items-center",
                  desktop
                    ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                    : "min-h-[50px] min-w-0 px-2 py-2 text-xs leading-tight flex-col justify-center gap-1",
                  zenFocusActive
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                )}
                aria-pressed={zenFocusActive}
              >
                <Target className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full whitespace-normal break-words text-center [hyphens:manual] [overflow-wrap:break-word]">
                  {ts.diaryFocusRay || "Focus"}
                </span>
              </motion.button>
              <motion.button
                whileTap={zenTap.icon}
                onClick={() => {
                  void hapticTap();
                  if (!showHabits) collapseMobileToolsForSurface();
                  setShowHabits(!showHabits);
                }}
                className={cn(
                  "rounded-2xl font-medium border motion-safe:transition-all flex items-center",
                  desktop
                    ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                    : "min-h-[50px] min-w-0 px-2 py-2 text-xs leading-tight flex-col justify-center gap-1",
                  showHabits
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                )}
                aria-pressed={showHabits}
              >
                <ListChecks className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full whitespace-normal break-words text-center [hyphens:manual] [overflow-wrap:break-word]">
                  {ts.journalHabitsSection || "Habits"}
                </span>
                {completedHabitCount > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs leading-none text-primary">
                    {completedHabitCount}/{habitSnapshot.length}
                  </span>
                )}
              </motion.button>
            </div>
          </>
        )}
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
          initialFile={desktopInitialPhotoFile}
          onSelectFile={async (file, signal) => {
            await handleAddPhoto(file, signal);
          }}
          onClose={() => {
            setShowPhotos(false);
            setDesktopInitialPhotoFile(null);
          }}
          currentCount={photoIds.length}
          maxCount={MAX_PHOTOS_PER_ENTRY}
        />
      )}

      {/* Template picker for new entries */}
      {showTemplatePicker && !entry && !draftAvailable && (
        <JournalTemplatePicker onSelect={handleTemplateSelect} onClose={handleTemplateClose} />
      )}

      {/* Voice privacy confirmation */}
      {showVoicePrivacyConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 dark:bg-black/50 motion-safe:animate-fade-in"
          onClick={closeVoicePrivacyConfirm}
        >
          <motion.div
            ref={voicePrivacyDialogA11y.modalRef}
            onKeyDown={voicePrivacyDialogA11y.handleKeyDown}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={voicePrivacyDialogTitleId}
            aria-describedby={voicePrivacyDialogDescriptionId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={zenMotion.gentle}
            className="mx-4 max-w-[340px] rounded-2xl border border-[var(--diary-border,hsl(var(--border)/0.3))] bg-[var(--diary-bg,hsl(var(--card)))] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-[var(--diary-text,hsl(var(--foreground)))]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Mic2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 id={voicePrivacyDialogTitleId} className="text-base font-semibold">
                {ts.journalVoicePrivacyTitle || "Voice privacy check"}
              </h3>
            </div>
            <p
              id={voicePrivacyDialogDescriptionId}
              className="mb-4 text-sm leading-relaxed text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
            >
              {ts.journalVoicePrivacyDescription ||
                "Your browser may process speech recognition outside ZenFlow. Use it only if you are comfortable with that."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeVoicePrivacyConfirm}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-muted px-3 text-sm font-medium text-foreground"
              >
                {ts.journalVoicePrivacyCancel || ts.cancel || "Not now"}
              </button>
              <button
                type="button"
                onClick={handleConfirmDictation}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
              >
                {ts.journalVoicePrivacyContinue || ts.journalToolbarVoice || "Start voice"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Recording overlay */}
      <AnimatePresence>
        {showRecordingOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role={recordingDiscardPending || audioSaveRetryAvailable ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby={recordingDialogTitleId}
            aria-describedby={recordingDialogDescriptionId}
            className="fixed inset-0 z-[65] bg-black/60 dark:bg-black/60 flex items-center justify-center"
          >
            <motion.div
              ref={recordingDialogA11y.modalRef}
              onKeyDown={recordingDialogA11y.handleKeyDown}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={zenMotion.gentle}
              className="rounded-2xl p-6 max-w-[280px] mx-4 text-center shadow-xl bg-[var(--diary-bg,hsl(var(--card)))] border border-[var(--diary-border,hsl(var(--border)/0.3))]"
            >
              {!recordingDiscardPending ? (
                audioSaveRetryAvailable ? (
                  <>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                      <AlertCircle className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p
                      id={recordingDialogTitleId}
                      className="text-base font-semibold text-[var(--diary-text,hsl(var(--foreground)))]"
                    >
                      {ts.journalAudioSaveRetryTitle || "Recording not added yet"}
                    </p>
                    <p
                      id={recordingDialogDescriptionId}
                      className="mt-2 text-sm leading-relaxed text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
                    >
                      {ts.journalAudioSaveRetryDescription ||
                        "Your recording is still here. Try adding it again or discard it."}
                    </p>
                    <div className="mt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={retryAudioSave}
                        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        {ts.journalAudioSaveRetry || "Try again"}
                      </button>
                      <button
                        type="button"
                        onClick={requestDiscardRecording}
                        className="min-h-[48px] w-full rounded-xl border border-[var(--diary-border,hsl(var(--border)/0.3))] px-3 text-sm font-medium text-[var(--diary-text,hsl(var(--foreground)))]"
                      >
                        {ts.journalRecordingDiscard || "Discard"}
                      </button>
                    </div>
                  </>
                ) : (
                <>
                  {/* Permission and recording state */}
                  <div className="flex justify-center mb-4">
                    {recorder.isRequestingPermission ? (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Mic className="h-6 w-6" aria-hidden="true" />
                      </div>
                    ) : (
                      <motion.div
                        animate={!recorder.isPaused && shouldAnimate() ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                        transition={
                          shouldAnimate()
                            ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                            : zenMotion.instant
                        }
                        className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/25">
                          <div className="h-4 w-4 rounded-full bg-destructive" />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <p
                    id={recordingDialogTitleId}
                    className="text-sm font-semibold mb-1 text-[var(--diary-text,hsl(var(--foreground)))]"
                  >
                    {recorder.isRequestingPermission
                      ? ts.journalAudioPreparing || "Preparing microphone..."
                      : recorder.isFinalizing
                      ? ts.journalSaving || "Saving..."
                      : recorder.isPaused
                      ? ts.journalRecordingPaused || "Recording paused"
                      : ts.journalRecording || "Recording"}
                  </p>
                  {!recorder.isRequestingPermission ? (
                    <p className="text-2xl font-mono font-bold tabular-nums mb-4 text-[var(--diary-text,hsl(var(--foreground)))]">
                      {formatRecordingTime(recorder.duration)}
                    </p>
                  ) : null}
                  <p
                    id={recordingDialogDescriptionId}
                    className="mb-4 text-xs text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
                  >
                    {recorder.isRequestingPermission
                      ? ts.journalAudioPreparingDescription ||
                        "Choose Allow in the system prompt. Recording starts only after permission is granted."
                      : ts.journalAudioMaxDuration || "Max 5 minutes"}
                  </p>

                  <div className="flex gap-2">
                    {!recorder.isRequestingPermission && !recorder.isFinalizing ? (
                      <button
                        type="button"
                        onClick={recorder.isPaused ? recorder.resume : recorder.pause}
                        className={cn(
                          "min-h-[48px] flex-1 rounded-xl border border-[var(--diary-border,hsl(var(--border)/0.3))]",
                          "flex items-center justify-center gap-2 px-3 text-sm font-semibold",
                          "bg-[var(--diary-bg,hsl(var(--card)))] text-[var(--diary-text,hsl(var(--foreground)))]",
                          "active:scale-[0.98] motion-safe:transition-transform"
                        )}
                      >
                        {recorder.isPaused ? (
                          <Play className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Pause className="h-4 w-4" aria-hidden="true" />
                        )}
                        {recorder.isPaused ? ts.resume || "Resume" : ts.pause || "Pause"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      disabled={recorder.isFinalizing}
                      aria-busy={recorder.isFinalizing}
                      className={cn(
                        "min-h-[48px] flex-1 rounded-xl px-3 text-sm font-semibold",
                        "bg-destructive text-destructive-foreground",
                        "flex items-center justify-center gap-2",
                        "active:scale-[0.98] motion-safe:transition-transform disabled:opacity-60"
                      )}
                    >
                      {recorder.isRequestingPermission ? (
                        <X className="h-4 w-4" aria-hidden="true" />
                      ) : recorder.isFinalizing ? (
                        <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                      ) : (
                        <Square className="w-4 h-4" aria-hidden="true" />
                      )}
                      {recorder.isRequestingPermission
                        ? ts.cancel || "Cancel"
                        : recorder.isFinalizing
                        ? ts.journalSaving || "Saving..."
                        : ts.journalRecordingStopKeep || ts.journalRecordingStop || "Stop & keep"}
                    </button>
                  </div>
                  {!recorder.isRequestingPermission ? <button
                    onClick={requestDiscardRecording}
                    className={cn(
                      "mt-2 w-full py-3 rounded-xl text-sm font-semibold",
                      "border border-[var(--diary-border,hsl(var(--border)/0.3))] bg-[var(--diary-bg,hsl(var(--card)))] text-[var(--diary-text,hsl(var(--foreground)))]",
                      "flex items-center justify-center gap-2",
                      "active:scale-[0.98] motion-safe:transition-transform min-h-[48px]"
                    )}
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                    {ts.journalRecordingDiscard || "Discard"}
                  </button> : null}
                </>
                )
              ) : (
                <>
                  <p
                    id={recordingDialogTitleId}
                    className="text-base font-semibold text-[var(--diary-text,hsl(var(--foreground)))]"
                  >
                    {ts.journalRecordingDiscardTitle || "Discard this recording?"}
                  </p>
                  <p
                    id={recordingDialogDescriptionId}
                    className="mt-2 text-sm leading-relaxed text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
                  >
                    {ts.journalRecordingDiscardDescription ||
                      "This audio has not been added to the entry. Discarding it cannot be undone."}
                  </p>
                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      ref={recordingDiscardCancelRef}
                      type="button"
                      onClick={cancelDiscardRecording}
                      className="min-h-[48px] w-full rounded-xl bg-muted px-3 text-sm font-medium text-foreground"
                    >
                      {ts.cancel || "Cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardRecording}
                      className="min-h-[48px] w-full rounded-xl bg-destructive px-3 text-sm font-semibold text-destructive-foreground"
                    >
                      {ts.journalRecordingDiscard || "Discard"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio removal confirmation */}
      {audioRemovalPendingId && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 dark:bg-black/50 motion-safe:animate-fade-in"
          onClick={cancelRemoveAudio}
        >
          <motion.div
            ref={audioRemovalDialogA11y.modalRef}
            onKeyDown={audioRemovalDialogA11y.handleKeyDown}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={audioRemovalDialogTitleId}
            aria-describedby={audioRemovalDialogDescriptionId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={shouldAnimate() ? zenMotion.gentle : zenMotion.instant}
            className="mx-4 w-full max-w-[320px] rounded-2xl border border-[var(--diary-border,hsl(var(--border)/0.3))] bg-[var(--diary-bg,hsl(var(--card)))] p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={audioRemovalDialogTitleId}
              className="text-base font-semibold text-[var(--diary-text,hsl(var(--foreground)))]"
            >
              {ts.journalAudioRemoveTitle || "Remove this recording?"}
            </h3>
            <p
              id={audioRemovalDialogDescriptionId}
              className="mt-2 text-sm leading-relaxed text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
            >
              {entry?.audioIds?.includes(audioRemovalPendingId)
                ? ts.journalAudioRemoveDescriptionStaged ||
                  "This recording will be removed when you save. If you discard your changes, it will stay in the entry."
                : ts.journalAudioRemoveDescription ||
                  "This recording will be removed from the entry. This cannot be undone."}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => {
                  void confirmRemoveAudio();
                }}
                disabled={audioRemovalSubmitting}
                className="min-h-[48px] flex-1 rounded-xl bg-destructive px-3 text-sm font-semibold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ts.journalAudioRemoveConfirm || "Remove recording"}
              </button>
              <button
                ref={audioRemovalCancelRef}
                type="button"
                onClick={cancelRemoveAudio}
                disabled={audioRemovalSubmitting}
                className="min-h-[48px] flex-1 rounded-xl bg-muted px-3 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ts.cancel || "Cancel"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 dark:bg-black/50 flex items-center justify-center motion-safe:animate-fade-in"
          onClick={closeDeleteConfirm}
        >
          <motion.div
            ref={deleteDialogA11y.modalRef}
            onKeyDown={deleteDialogA11y.handleKeyDown}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="journal-delete-confirm-title"
            aria-describedby="journal-delete-confirm-description"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={zenMotion.gentle}
            className="rounded-2xl p-5 max-w-[300px] mx-4 shadow-xl bg-[var(--diary-bg,hsl(var(--card)))] border border-[var(--diary-border,hsl(var(--border)/0.3))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="journal-delete-confirm-title"
              className="text-base font-semibold mb-2 text-[var(--diary-text,hsl(var(--foreground)))]"
            >
              {ts.journalDeleteEntry || "Delete Entry?"}
            </h3>
            <p
              id="journal-delete-confirm-description"
              className="text-sm mb-4 text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
            >
              {ts.journalDeleteConfirm || "Are you sure you want to delete this entry?"}
            </p>
            {deleteError ? (
              <p role="alert" className="mb-4 text-sm text-destructive">
                {deleteError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                onClick={closeDeleteConfirm}
                disabled={deleteSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[48px]"
              >
                {ts.cancel || "Cancel"}
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleteSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium min-h-[48px]"
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
          className="fixed inset-0 z-[70] bg-black/50 dark:bg-black/50 flex items-center justify-center motion-safe:animate-fade-in"
          onClick={closeUnsavedDialog}
        >
          <motion.div
            ref={unsavedDialogA11y.modalRef}
            onKeyDown={unsavedDialogA11y.handleKeyDown}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="journal-unsaved-confirm-title"
            aria-describedby="journal-unsaved-confirm-description"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={zenMotion.gentle}
            className="rounded-2xl p-5 max-w-[300px] mx-4 shadow-xl bg-[var(--diary-bg,hsl(var(--card)))] border border-[var(--diary-border,hsl(var(--border)/0.3))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="journal-unsaved-confirm-title"
              className="text-base font-semibold mb-2 text-[var(--diary-text,hsl(var(--foreground)))]"
            >
              {ts.journalDiscardTitle || "Unsaved Changes"}
            </h3>
            <p
              id="journal-unsaved-confirm-description"
              className="text-sm mb-4 text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
            >
              {ts.journalDiscardMessage || "You have unsaved changes."}
            </p>
            {!draftReady ? (
              <p
                id="journal-save-close-unavailable-hint"
                role="alert"
                className="mb-3 text-sm text-destructive"
              >
                {draftLoadInUse
                  ? ts.journalDraftInUse ||
                    "This entry is open in another window. Close it there, then try again."
                  : ts.journalLoadFailedHint ||
                    "This load attempt did not change your entries. Try loading again."}
              </p>
            ) : null}
            {discardError ? (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {discardError}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSaveAndClose}
                disabled={saveInteractionLocked || !hasContent || !draftReady}
                aria-describedby={
                  !draftReady
                    ? "journal-save-close-unavailable-hint"
                    : !hasContent
                      ? "journal-save-close-disabled-hint"
                      : undefined
                }
                className={cn(
                  "w-full py-2.5 rounded-xl text-sm font-medium min-h-[48px]",
                  "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
                  "disabled:opacity-50"
                )}
              >
                {ts.journalSaveClose || "Save & Close"}
              </button>
              {!hasContent && (
                <p
                  id="journal-save-close-disabled-hint"
                  className="px-2 text-xs leading-relaxed text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
                >
                  {ts.journalWriteFirstEntry || "Write first entry"}
                </p>
              )}
              <button
                onClick={handleDiscard}
                disabled={discardSubmitting}
                className="w-full py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-medium min-h-[48px]"
              >
                {discardSubmitting ? ts.loading || "Working..." : ts.journalDiscard || "Discard"}
              </button>
              <button
                onClick={closeUnsavedDialog}
                disabled={discardSubmitting}
                className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[48px]"
              >
                {ts.journalKeepWriting || "Keep Writing"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showSettingsConfirm && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 dark:bg-black/50 flex items-center justify-center motion-safe:animate-fade-in"
          onClick={closeSettingsConfirm}
        >
          <motion.div
            ref={settingsDialogA11y.modalRef}
            onKeyDown={settingsDialogA11y.handleKeyDown}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="journal-settings-confirm-title"
            aria-describedby="journal-settings-confirm-description"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={zenMotion.gentle}
            className="rounded-2xl p-5 max-w-[320px] mx-4 shadow-xl bg-[var(--diary-bg,hsl(var(--card)))] border border-[var(--diary-border,hsl(var(--border)/0.3))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="journal-settings-confirm-title"
              className="text-base font-semibold mb-2 text-[var(--diary-text,hsl(var(--foreground)))]"
            >
              {ts.journalSettings || "Diary Settings"}
            </h3>
            <p
              id="journal-settings-confirm-description"
              className="text-sm mb-4 text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
            >
              {ts.journalSaveDraftOpenSettingsDescription}
            </p>
            {settingsDraftError ? (
              <p
                role="alert"
                className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
              >
                {settingsDraftError}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  void handleSaveDraftAndOpenSettings();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground text-sm font-medium min-h-[48px]"
              >
                {ts.journalSaveDraftOpenSettings || "Save Draft and Open Settings"}
              </button>
              <button
                onClick={closeSettingsConfirm}
                className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[48px]"
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
            ref={panicLockDialogA11y.modalRef}
            onKeyDown={panicLockDialogA11y.handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby={panicLockDialogTitleId}
            aria-describedby={panicLockDialogDescriptionId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-6 backdrop-blur-[20px] bg-[rgba(2,6,17,0.8)]"
          >
            <div className="max-w-sm px-6 text-center">
              <h2 id={panicLockDialogTitleId} className="text-lg font-semibold text-white">
                {ts.journalPanicLockTitle || "Diary locked"}
              </h2>
              <p id={panicLockDialogDescriptionId} className="mt-2 text-sm text-white/70">
                {ts.journalPanicLockDescription || "Unlock to return to your private diary."}
              </p>
            </div>
            <DiaryBreatheWidget initiallyPaused />
            <button
              ref={panicUnlockButtonRef}
              type="button"
              onClick={() => {
                void handlePanicUnlock();
              }}
              className="flex min-h-[48px] min-w-[48px] items-center gap-2 px-6 py-3 rounded-xl bg-white/10 dark:bg-white/10 border border-white/20 dark:border-white/20 text-white/80 text-sm font-medium backdrop-blur-sm active:scale-95 motion-safe:transition-transform"
            >
              <Fingerprint className="w-5 h-5" aria-hidden="true" />
              {ts.journalUnlockBiometric || "Unlock"}
            </button>
            {onPanicExit ? (
              <div className="mx-6 flex max-w-[320px] flex-col items-center gap-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    void handlePanicExit();
                  }}
                  disabled={panicExitBusy}
                  className="min-h-[48px] rounded-xl px-5 py-2.5 text-sm font-medium text-white/80 underline decoration-white/30 underline-offset-4 disabled:cursor-wait disabled:opacity-60"
                >
                  {panicExitNeedsConfirmation
                    ? ts.journalPanicLeaveWithoutSaving || "Leave without saving"
                    : ts.journalPanicLeave || "Leave diary"}
                </button>
                <p className="text-xs leading-5 text-white/60">
                  {ts.journalPanicLeaveHint ||
                    "Save your draft, then return to a concealed diary list."}
                </p>
              </div>
            ) : null}
            {panicUnlockError ? (
              <div
                role="alert"
                className="mx-6 flex max-w-[320px] items-start gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-start text-xs font-medium text-white/80 backdrop-blur-sm dark:border-white/15 dark:bg-white/10"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                <span>{panicUnlockError}</span>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Theme transition overlay (crossfade blur on theme change) */}
      <ThemeTransitionOverlay
        isTransitioning={themeTransition.isTransitioning}
        onTransitionEnd={themeTransition.onTransitionEnd}
      />

      {/* Floating format toolbar (Telegram-style — appears on text selection) */}
      <DiaryFormatToolbar
        editorRef={editorRef}
        scrollContainerRef={scrollAreaRef}
        onContentChange={handleEditorInput}
      />

      {/* Slash command menu (Notion-style — appears on typing /) */}
      <SlashCommandMenu
        editorRef={editorRef}
        disabledCommandIds={slashDisabledCommandIds}
        onCommand={(cmd) => {
          switch (cmd) {
            case "mood":
              setMobileToolsCollapsed(false);
              setShowStyleBar(true);
              setShowPromptsDropdown(false);
              syncEditorCommandContent();
              break;
            case "heading":
              document.execCommand("formatBlock", false, "h2");
              syncEditorCommandContent();
              break;
            case "quote":
              document.execCommand("formatBlock", false, "blockquote");
              syncEditorCommandContent();
              break;
            case "checklist":
              document.execCommand("insertHTML", false, "<div>☐&nbsp;</div>");
              syncEditorCommandContent();
              break;
            case "breathe":
              collapseMobileToolsForSurface();
              setShowBreathe(true);
              syncEditorCommandContent();
              break;
            case "gratitude":
              collapseMobileToolsForSurface();
              setShowGratitudeWidget(true);
              setShowBurnWidget(false);
              syncEditorCommandContent();
              break;
            case "burn":
              collapseMobileToolsForSurface();
              setShowBurnWidget(true);
              setShowGratitudeWidget(false);
              syncEditorCommandContent();
              break;
            case "focus":
              collapseMobileToolsForSurface();
              setZenFocusActive(true);
              syncEditorCommandContent();
              break;
            case "template":
              collapseMobileToolsForSurface();
              setShowTemplatePicker(true);
              syncEditorCommandContent();
              break;
            case "photo":
              requestPhotoSelection();
              syncEditorCommandContent();
              break;
            case "audio":
              collapseMobileToolsForSurface();
              syncEditorCommandContent();
              void handleStartRecording();
              break;
          }
        }}
        onClose={() => {
          /* handled internally */
        }}
      />
    </div>
  );

  return desktop || typeof document === "undefined"
    ? editorShell
    : createPortal(editorShell, document.body);
});
