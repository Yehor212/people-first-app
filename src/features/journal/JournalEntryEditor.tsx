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
  Mic,
  Mic2,
  Moon,
  Palette,
  Shuffle,
  Square,
  Sparkles,
  Sticker,
  Target,
  Eye,
  EyeOff,
  Fingerprint,
  SlidersHorizontal,
  Wind,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { cn, getToday } from "@/lib/utils";
import { zenMotion } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";
import { getLocale } from "@/lib/timeUtils";
import { useModalA11y } from "@/hooks/useModalA11y";
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
import { getJournalDisplayTag } from "./journalDisplay";
import {
  MAX_PHOTOS_PER_ENTRY,
  MAX_STICKERS_PER_ENTRY,
  MAX_AUDIO_PER_ENTRY,
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
import { useTypingDynamics } from "@/hooks/useTypingDynamics";
import { TypingDynamicsMirror } from "@/components/diary/TypingDynamicsMirror";
import type { TranslationStrings } from "@/i18n/types";

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
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS =
  "border-border/60 bg-background/90 text-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-primary dark:border-white/10 dark:bg-background/70 dark:text-foreground dark:hover:bg-primary/15";
const JOURNAL_STYLE_TOOLBAR_BUTTON_ACTIVE_CLASS =
  "border-primary/60 bg-background/95 text-foreground shadow-sm shadow-primary/10 ring-1 ring-primary/35 dark:bg-background/80";
const JOURNAL_STYLE_TOOLBAR_BUTTON_MUTED_ACTIVE_CLASS = "border-border/70 bg-muted text-foreground";
const JOURNAL_STYLE_TOOLBAR_BUTTON_DANGER_ACTIVE_CLASS =
  "border-destructive/45 bg-destructive/10 text-foreground";
const JOURNAL_STYLE_TOOLBAR_SWATCH_BASE_CLASS =
  "h-11 w-11 rounded-full shrink-0 border-2 motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const JOURNAL_STYLE_TOOLBAR_SWATCH_IDLE_CLASS = "border-border/70 shadow-sm dark:border-white/20";
const JOURNAL_STYLE_TOOLBAR_SWATCH_ACTIVE_CLASS =
  "scale-110 border-primary shadow-md shadow-primary/20";
const JOURNAL_STYLE_TOOLBAR_PATTERN_BASE_CLASS =
  "flex h-11 w-11 rounded-lg flex-shrink-0 items-center justify-center border-2 motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// ── Component ──

interface JournalEntryEditorProps {
  entry: JournalEntry | null;
  entryPrefill?: JournalEntryPrefill | null;
  onSave: (data: {
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
  /** Desktop master-detail mode: render inline instead of fixed overlay */
  desktop?: boolean;
  /** Use the shared V2 DiaryWallpaper behind the desktop editor instead of the editor canvas. */
  useSharedDiaryWallpaper?: boolean;
  onRequestSettings?: () => void;
  onBindSettingsRequestHandler?: (handler: (() => void) | null) => void;
}

export const JournalEntryEditor = memo(function JournalEntryEditor({
  entry,
  entryPrefill,
  onSave,
  onAddPhoto,
  onRemovePhoto,
  onAddAudio,
  onRemoveAudio,
  onDelete,
  onBack,
  onToggleHabit,
  onAddGratitude,
  desktop,
  useSharedDiaryWallpaper = false,
  onRequestSettings,
  onBindSettingsRequestHandler,
}: JournalEntryEditorProps) {
  const themeTransition = useThemeTransition();
  const paperRef = useRef<HTMLDivElement>(null);
  const [floatingFocusPhotoId, setFloatingFocusPhotoId] = useState<string | null>(null);
  const state = useJournalEditorState({
    entry,
    entryPrefill,
    onSave,
    onAddPhoto,
    onRemovePhoto,
    onAddAudio,
    onRemoveAudio,
    onDelete,
    onBack,
    onToggleHabit,
    onAddGratitude,
    desktop,
  });

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
    saveSuccess,
    handleRetry,
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
    handlePromptTap,
    handleEditorInput,
    handleEditorPaste,
    handleEditorDrop,
    cycleFontSize,
    handleContentScroll,
    handleTemplateSelect,
    handleTemplateClose,
  } = state;

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

  // EP8_US002: Typing dynamics for mini-orb with delayed unmount
  const typingDynamics = useTypingDynamics(editorRef);
  const [orbMounted, setOrbMounted] = useState(false);
  const [mobileToolsCollapsed, setMobileToolsCollapsed] = useState(false);
  const [settingsDraftError, setSettingsDraftError] = useState<string | null>(null);
  const [panicUnlockError, setPanicUnlockError] = useState<string | null>(null);
  const orbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const panicUnlockButtonRef = useRef<HTMLButtonElement>(null);

  const styleToolsLabel = ts.journalStyleTools || "Style tools";
  const sceneToolLabel = ts.diaryScene || "Scene";
  const backgroundToolLabel = ts.journalHubBackground || "Background";
  const motionToolLabel = ts.diaryMotion || ts.diaryParticleSpeed || "Motion";
  const textureToolLabel = ts.diaryTexture || "Texture";
  const tagsToolLabel = ts.journalToolbarTags || "Tags";
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
  const fontSizeToolLabel = t.ariaFontSize + ": " + FONT_SIZES[fontSize];
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
  const backgroundAriaLabel = `${backgroundToolLabel}: ${backgroundIntensityLabel}`;
  const particleSpeedAriaLabel = `${motionToolLabel}: ${particleSpeedLabel}`;
  const textureAriaLabel = `${textureToolLabel}: ${paperTextureLabel}`;
  const selectedSceneMeta = BG_PATTERN_LIST.find((pat) => pat.name === bgPattern);
  const selectedSceneLabel = selectedSceneMeta
    ? getJournalTranslation(ts, selectedSceneMeta.i18nKey, selectedSceneMeta.name)
    : bgPattern;
  const selectedStyleStatusItems = [
    `${sceneToolLabel}: ${selectedSceneLabel}`,
    `${textureToolLabel}: ${paperTextureLabel}`,
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
    photoToolLabel + ": " + (ts.journalPhotoRemainingCountZero || "0 photos remaining");
  const moodLabels: Record<MoodType, string> = {
    great: ts.moodGreat || "Great",
    good: ts.moodGood || "Good",
    okay: ts.moodOkay || "Okay",
    bad: ts.moodBad || "Bad",
    terrible: ts.moodTerrible || ts.terrible || "Terrible",
  };
  const slashDisabledCommandIds = useMemo(
    () => (entry || draftAvailable ? new Set<CommandId>(["template"]) : new Set<CommandId>()),
    [entry, draftAvailable]
  );

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

  useEffect(() => {
    if (!showTags) return;
    const frame = requestAnimationFrame(() => {
      const input = tagInputRef.current;
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [showTags]);

  const closeDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(false);
  }, [setShowDeleteConfirm]);

  const closeUnsavedDialog = useCallback(() => {
    setShowUnsavedDialog(false);
  }, [setShowUnsavedDialog]);

  const closeSettingsConfirm = useCallback(() => {
    setShowSettingsConfirm(false);
  }, [setShowSettingsConfirm]);

  const closeVoicePrivacyConfirm = useCallback(() => {
    setShowVoicePrivacyConfirm(false);
  }, [setShowVoicePrivacyConfirm]);

  const closeRecordingOverlay = useCallback(() => {
    handleDiscardRecording();
  }, [handleDiscardRecording]);

  const recordingDialogTitleId = "journal-recording-dialog-title";
  const recordingDialogDescriptionId = "journal-recording-dialog-description";
  const voicePrivacyDialogTitleId = "journal-voice-privacy-title";
  const voicePrivacyDialogDescriptionId = "journal-voice-privacy-description";
  const panicLockDialogTitleId = "journal-panic-lock-title";
  const panicLockDialogDescriptionId = "journal-panic-lock-description";

  const deleteDialogA11y = useModalA11y(showDeleteConfirm, closeDeleteConfirm);
  const unsavedDialogA11y = useModalA11y(showUnsavedDialog, closeUnsavedDialog);
  const settingsDialogA11y = useModalA11y(showSettingsConfirm, closeSettingsConfirm);
  const recordingDialogA11y = useModalA11y(showRecordingOverlay, closeRecordingOverlay);
  const voicePrivacyDialogA11y = useModalA11y(showVoicePrivacyConfirm, closeVoicePrivacyConfirm);
  const panicLockDialogA11y = useModalA11y(panicLocked, handlePanicLockCloseRequest);

  useEffect(() => {
    if (typingDynamics.isTyping) {
      // Clear any pending unmount
      if (orbTimerRef.current) {
        clearTimeout(orbTimerRef.current);
        orbTimerRef.current = null;
      }
      setOrbMounted(true);
    } else if (orbMounted) {
      // Delay unmount by 500ms to allow fade-out animation to complete
      // (isTyping already waits 5s after last keystroke before going false)
      orbTimerRef.current = setTimeout(() => setOrbMounted(false), 600);
    }
    return () => {
      if (orbTimerRef.current) clearTimeout(orbTimerRef.current);
    };
  }, [typingDynamics.isTyping, orbMounted]);

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
      await persistDraftNow();
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
      role={desktop ? undefined : "region"}
      aria-label={ts.journalEntryTitle || "Diary Entry"}
      data-testid="journal-entry-editor"
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
        <div className="flex items-center justify-between gap-2">
          {/* LEFT: Back + Title */}
          <div className={cn("flex items-center min-w-0", desktop ? "gap-3" : "gap-1.5 flex-1")}>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleBack}
              className={cn(
                "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg py-2 text-muted-foreground hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground motion-safe:transition-all",
                desktop ? "px-3" : "px-2"
              )}
              aria-label={ts.back || "Back"}
            >
              <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
              <span className="text-sm max-[420px]:sr-only">{t.journalMapLabel}</span>
            </motion.button>
            <div className={cn("min-w-0", !desktop && "max-w-[8rem]")}>
              <div
                className={cn(
                  "font-bold tracking-tight truncate font-display",
                  desktop ? "text-sm" : "text-xs"
                )}
                style={{ color: diaryTheme.accentColor }}
              >
                {title || ts.diaryTimeCapsule || "TIME CAPSULE"}
              </div>
              <div className="relative inline-flex min-h-[44px] items-center">
                <span
                  className="pointer-events-none flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[11px] text-foreground/70 whitespace-nowrap"
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
                  className="absolute inset-0 min-h-[44px] w-full cursor-pointer opacity-0"
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Style toggle + Actions */}
          <div className={cn("flex items-center flex-shrink-0", desktop ? "gap-2" : "gap-1")}>
            {/* Style panel toggle stays in the desktop header; mobile exposes it in the bottom tool tray. */}
            {desktop && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  setShowPromptsDropdown(false);
                  setShowStyleBar((v) => !v);
                }}
                className={cn(
                  "p-2 rounded-lg motion-safe:transition-all min-w-[44px] min-h-[44px] flex items-center justify-center",
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
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/10 text-muted-foreground hover:text-red-400 motion-safe:transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                "p-2 rounded-lg motion-safe:transition-all min-w-[44px] min-h-[44px] flex items-center justify-center",
                privacyShieldActive
                  ? "bg-violet-500/15 text-violet-400"
                  : "hover:bg-white/10 text-muted-foreground"
              )}
              aria-label={ts.diaryPrivacyShield || "Privacy"}
              aria-pressed={privacyShieldActive}
            >
              {privacyShieldActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </motion.button>

            <motion.button
              whileTap={saveSuccess ? {} : { scale: 0.92 }}
              whileHover={saveSuccess ? {} : { scale: 1.03 }}
              onClick={handleSave}
              disabled={saveState === "saving" || !hasContent}
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
            <SaveIndicator state={saveState} onRetry={handleRetry} />
          </div>
        ) : null}

        {/* ROW 2: Collapsible style panel */}
        <AnimatePresence>
          {desktop && showStyleBar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
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
                          whileTap={{ scale: 0.95 }}
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
                          whileTap={{ scale: 0.95 }}
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
                          Aa <span className="text-[11px]">{label}</span>
                        </motion.button>
                      );
                    })}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={cycleFontSize}
                      className={cn(
                        JOURNAL_STYLE_TOOLBAR_BUTTON_BASE_CLASS,
                        JOURNAL_STYLE_TOOLBAR_BUTTON_IDLE_CLASS
                      )}
                      aria-label={fontSizeToolLabel}
                    >
                      A
                      <span className="ms-0.5 text-[11px] font-medium">{FONT_SIZES[fontSize]}</span>
                    </motion.button>
                  </div>

                  {/* Prompts button (new entries only) */}
                  {!entry && (
                    <div className="relative flex-shrink-0">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
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
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setMood(mood === opt.mood ? undefined : opt.mood)}
                        aria-label={moodLabels[opt.mood]}
                        aria-pressed={mood === opt.mood}
                        className={cn(
                          "flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-transparent text-foreground motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
                      whileTap={{ scale: 0.95 }}
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
                      whileTap={{ scale: 0.95 }}
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
                    <span className="px-1 text-[11px] font-semibold uppercase text-muted-foreground/80">
                      {paperToolLabel}
                    </span>
                    {(["dark", "milky", "white"] as PaperColor[]).map((pc) => (
                      <motion.button
                        key={pc}
                        whileTap={{ scale: 0.85 }}
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
                    <span className="px-1 text-[11px] font-semibold uppercase text-muted-foreground/80">
                      {inkToolLabel}
                    </span>
                    {INK_COLORS.map((c) => (
                      <motion.button
                        key={c.hex}
                        whileTap={{ scale: 0.85 }}
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
                      whileTap={{ scale: 0.95 }}
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
                      whileTap={{ scale: 0.95 }}
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
                      whileTap={{ scale: 0.95 }}
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
                      <span aria-hidden="true" className="text-[10px] font-medium opacity-75">
                        {backgroundIntensityLabel}
                      </span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
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
                      <span aria-hidden="true" className="text-[10px] font-medium opacity-75">
                        {particleSpeedLabel}
                      </span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
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
                      <span aria-hidden="true" className="text-[10px] font-medium opacity-75">
                        {paperTextureLabel}
                      </span>
                    </motion.button>
                  </div>

                  {/* Atmospheric pattern capsule */}
                  <div className={JOURNAL_STYLE_TOOLBAR_GROUP_CLASS} aria-label={sceneToolLabel}>
                    <span className="px-1 text-[11px] font-semibold uppercase text-muted-foreground/80">
                      {sceneToolLabel}
                    </span>
                    {BG_PATTERN_LIST.map((pat) => {
                      const isActive = pat.name === bgPattern;
                      const isNone = pat.name === "none";
                      return (
                        <motion.button
                          key={pat.name}
                          whileTap={{ scale: 0.85 }}
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
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/70 flex items-center gap-1.5">
                          <Lightbulb className="w-3 h-3" aria-hidden="true" />
                          {ts.journalWritingPrompts || "Writing prompts"}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPromptSeed((s) => s + 1)}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-foreground/75 hover:bg-primary/10 hover:text-primary"
                            aria-label={t.ariaShufflePrompts}
                          >
                            <Shuffle className="w-3 h-3 text-foreground/70" />
                          </button>
                          <button
                            onClick={() => setShowPromptsDropdown(false)}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-foreground/75 hover:bg-primary/10 hover:text-primary"
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
                          whileTap={{ scale: 0.97 }}
                          transition={{
                            delay: i * 0.04,
                            type: "spring",
                            stiffness: 300,
                            damping: 25,
                          }}
                          onClick={() => handlePromptTap(prompt)}
                          className="block min-h-[44px] w-full rounded-xl px-3 py-2.5 text-start text-xs text-foreground/75 motion-safe:transition-all hover:bg-primary/10 hover:text-foreground"
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
            style={{
              backgroundColor: paperColors.bg,
              color: paperColors.text,
              borderColor: paperColors.border,
              ...getPaperTextureStyle(paperTexture, paperColor === "dark"),
              ...sharedWallpaperPaperStyle,
            }}
          >
            {/* Floating photos live on the paper itself so saved coordinates match what the user sees. */}
            {Object.keys(photoLayout).length > 0 && (
              <FloatingMediaLayer
                entryId={entryId}
                photoIds={photoIds}
                layout={photoLayout}
                onLayoutChange={setPhotoLayout}
                onReturnToGallery={handleReturnToGallery}
                containerRef={paperRef}
                focusPhotoId={floatingFocusPhotoId}
                onPhotoFocusHandled={handleFloatingPhotoFocusHandled}
              />
            )}

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
                setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
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
                  className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.08] px-4 py-3 text-sm leading-relaxed"
                  style={{ color: paperColors.text }}
                >
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{selectedPrompt}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPrompt(null)}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
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
                    className="px-1.5 py-0.5 rounded-lg hover:bg-muted/50 active:scale-90 motion-safe:transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label={`${ts.journalRemoveSticker || "Remove sticker"} ${s}`}
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
                onFloatPhoto={handleFloatPhotoWithFocus}
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
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive motion-safe:transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-[var(--diary-text,hsl(var(--foreground)))]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">{audioNotice}</span>
              </div>
            )}

            {audioError && (
              <div
                role="alert"
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">{audioError}</span>
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
                  <div className="w-2 h-2 rounded-full bg-red-500 motion-safe:animate-pulse" />
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
                    className="p-1 rounded-md hover:bg-red-500/20 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                {tags.map((tag) => {
                  const displayTag = getJournalDisplayTag(tag);
                  if (!displayTag) return null;
                  return (
                    <button
                      key={tag}
                      onClick={() => setTags((prev) => prev.filter((t2) => t2 !== tag))}
                      className="flex min-h-[44px] items-center gap-1 rounded-full bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20 motion-safe:transition-colors"
                      aria-label={formatRemoveTagLabel(displayTag)}
                    >
                      {displayTag} &times;
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
                      className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/10 text-sm text-foreground outline-none placeholder:text-foreground/50 min-h-[44px]"
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
              {!formatHintDismissed && <DiaryFormatHint onDismiss={handleDismissFormatHint} />}
            </AnimatePresence>

            {/* Content editor (contenteditable WYSIWYG) */}
            <div
              ref={editorRef}
              contentEditable
              role="textbox"
              aria-multiline="true"
              aria-label={ts.journalEntryBody || "Diary entry body"}
              dir="auto"
              tabIndex={0}
              suppressContentEditableWarning
              className="w-full max-w-prose mx-auto min-h-[260px] bg-transparent border-none outline-none resize-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent [&_blockquote]:border-s-2 [&_blockquote]:border-current/20 [&_blockquote]:ps-3 [&_blockquote]:italic [&_code]:bg-black/5 dark:[&_code]:bg-black/5 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_del]:line-through empty:before:content-[attr(data-placeholder)] empty:before:text-current empty:before:pointer-events-none leading-[1.8]"
              style={{
                fontSize: FONT_SIZES[fontSize],
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
                  scrollArea.scrollTo({ behavior: "smooth", top: targetTop });
                }, 300);
              }}
              data-placeholder={ts.journalEntryPlaceholder || "What's on your mind?"}
            />

            {/* Word count + char count + reading time + auto-save indicator */}
            <div className="flex items-center gap-3 pt-2">
              {wordCount > 0 && (
                <div className="flex items-center gap-2" style={{ color: paperColors.muted }}>
                  <span className="text-[11px] font-medium">
                    {formatJournalWordCount(wordCount, language, ts)}
                  </span>
                  <span className="text-[11px] font-medium">
                    {formatLocalizedCount(
                      content.length,
                      language,
                      ts,
                      "journalCharacterCount",
                      ts.journalChars || "chars"
                    )}
                  </span>
                  {wordCount >= 50 && (
                    <span className="text-[11px] font-medium">
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
                    className="text-[10px] text-green-500/60 flex items-center gap-0.5"
                  >
                    <Check className="w-2.5 h-2.5" /> {ts.journalDraftSaved || "Saved"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* EP8_US002: Typing dynamics mini-orb — bottom-right corner */}
            <AnimatePresence>
              {orbMounted && (
                <motion.div
                  key="typing-orb"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    opacity: {
                      duration: typingDynamics.isTyping ? 0.3 : 0.5,
                      ease: "easeOut",
                    },
                  }}
                  className="pointer-events-none absolute bottom-2 end-2 z-40"
                  aria-hidden="true"
                >
                  <TypingDynamicsMirror dynamics={typingDynamics} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {/* END content area */}

      {/* ═══ BOTTOM GLASS TOOLBAR (Magic) ═══ */}
      <div
        className={cn(
          "journal-editor-chrome relative z-50 flex-shrink-0 w-full border-t backdrop-blur-[20px] motion-safe:transition-all",
          desktop
            ? "px-6 py-3 pb-[max(0.75rem,var(--safe-bottom))] bg-background/85 border-border/20 shadow-lg"
            : mobileToolsCollapsed
              ? "px-3 py-1.5 pb-[max(0.5rem,var(--safe-bottom))] bg-background/85 border-primary/10 shadow-xl"
              : "px-3 py-2 pb-[max(0.75rem,var(--safe-bottom))] bg-background/90 border-primary/15 shadow-2xl"
        )}
      >
        {!desktop && mobileToolsCollapsed ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleMobileToolsExpand}
            className="mx-auto flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 text-xs font-semibold text-primary shadow-sm"
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
                  <span className="truncate text-xs font-semibold text-foreground/80">
                    {ts.journalMobileTools || "Tools"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleMobileToolsCollapse}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground motion-safe:transition-colors hover:bg-primary/10 hover:text-primary"
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
                  exit={{ opacity: 0, height: 0, y: 10 }}
                  transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                  role="group"
                  aria-label={styleToolsLabel}
                  className="mb-2 overflow-hidden rounded-3xl border border-primary/15 bg-primary/5 p-2 shadow-inner"
                >
                  <span className="sr-only" aria-live="polite">
                    {selectedStyleStatus}
                  </span>
                  <div className="grid gap-2 grid-cols-2 pb-1">
                    <div className="col-span-2 flex flex-wrap items-center gap-1 rounded-2xl border border-border/50 bg-background/75 p-1">
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
                              "min-h-[44px] rounded-xl border px-3 text-xs font-semibold motion-safe:transition-all",
                              isActive
                                ? "border-primary/30 bg-primary text-primary-foreground"
                                : "border-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary"
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
                      className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-2xl border border-border/60 bg-background/75 px-3 text-sm font-semibold text-foreground"
                      aria-label={fontSizeToolLabel}
                    >
                      A
                      <span className="text-[10px] text-muted-foreground">
                        {FONT_SIZES[fontSize]}
                      </span>
                    </button>

                    {!entry && (
                      <button
                        type="button"
                        onClick={() => setShowPromptsDropdown(!showPromptsDropdown)}
                        className={cn(
                          "flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold motion-safe:transition-all",
                          showPromptsDropdown
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}
                        aria-expanded={showPromptsDropdown}
                      >
                        <Lightbulb className="h-4 w-4" aria-hidden="true" />
                        {ts.journalWritingPrompts || "Prompts"}
                      </button>
                    )}

                    <div className="col-span-2 flex flex-wrap items-center gap-1 rounded-2xl border border-border/50 bg-background/75 p-1">
                      <span className="w-full px-1 text-[11px] font-semibold uppercase text-muted-foreground/80">
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
                            "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground motion-safe:transition-all",
                            mood === opt.mood ? "" : "hover:bg-primary/10 hover:text-primary"
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
                        </button>
                      ))}
                    </div>

                    <div className="col-span-2 flex flex-wrap items-center gap-1 rounded-2xl border border-border/50 bg-background/75 p-1">
                      <span className="w-full px-1 text-[11px] font-semibold uppercase text-muted-foreground/80">
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

                    <div className="col-span-2 flex flex-wrap items-center gap-1 rounded-2xl border border-border/50 bg-background/75 p-1">
                      <span className="w-full px-1 text-[11px] font-semibold uppercase text-muted-foreground/80">
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
                      className="col-span-2 flex flex-wrap items-center gap-1 rounded-2xl border border-border/50 bg-background/75 p-1"
                      aria-label={sceneToolLabel}
                    >
                      <span className="w-full px-1 text-[11px] font-semibold uppercase text-muted-foreground/80">
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
                        "flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold motion-safe:transition-all",
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
                      <span className="flex flex-col items-start leading-tight">
                        <span>{backgroundToolLabel}</span>
                        <span className="text-[10px] font-medium opacity-75">
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
                        "flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold motion-safe:transition-all",
                        useSharedDiaryWallpaper && "hidden",
                        particleSpeed !== "off"
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                      aria-label={particleSpeedAriaLabel}
                      aria-pressed={particleSpeed !== "off"}
                    >
                      <Gauge className="h-4 w-4" aria-hidden="true" />
                      <span className="flex flex-col items-start leading-tight">
                        <span>{motionToolLabel}</span>
                        <span className="text-[10px] font-medium opacity-75">
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
                        "flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold motion-safe:transition-all",
                        paperTexture !== "clean"
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                      aria-label={textureAriaLabel}
                      aria-pressed={paperTexture !== "clean"}
                    >
                      <Layers className="h-4 w-4" aria-hidden="true" />
                      <span className="flex flex-col items-start leading-tight">
                        <span>{textureToolLabel}</span>
                        <span className="text-[10px] font-medium opacity-75">
                          {paperTextureLabel}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTags(!showTags)}
                      className={cn(
                        "flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold motion-safe:transition-all",
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
                      onClick={() => {
                        collapseMobileToolsForSurface();
                        setShowStickers(true);
                      }}
                      disabled={stickers.length >= MAX_STICKERS_PER_ENTRY}
                      className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 text-xs font-semibold text-muted-foreground motion-safe:transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-40"
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
                      className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 text-xs font-semibold text-muted-foreground motion-safe:transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-40"
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
                        "flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold motion-safe:transition-all",
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
                        <div className="mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
                            <Lightbulb className="h-3 w-3" aria-hidden="true" />
                            {ts.journalWritingPrompts || "Writing prompts"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPromptSeed((s) => s + 1)}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            aria-label={t.ariaShufflePrompts}
                          >
                            <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPromptsDropdown(false)}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            aria-label={ts.close || "Close"}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        {randomPrompts.map((prompt, i) => (
                          <button
                            key={`${promptSeed}-${i}`}
                            type="button"
                            onClick={() => handlePromptTap(prompt)}
                            className="block min-h-[44px] w-full rounded-xl px-3 py-2 text-start text-xs text-muted-foreground motion-safe:transition-colors hover:bg-primary/10 hover:text-foreground"
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
              className={cn(
                desktop
                  ? "flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1.5 px-1.5"
                  : "grid grid-cols-4 gap-1.5"
              )}
            >
              {!desktop && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleMobileStyleToggle}
                  className={cn(
                    "rounded-2xl font-medium border motion-safe:transition-all flex items-center min-h-[50px] min-w-0 px-2 py-2 text-[10px] leading-tight flex-col justify-center gap-1",
                    showStyleBar
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                  )}
                  aria-expanded={showStyleBar}
                  aria-pressed={showStyleBar}
                  aria-label={ts.diaryStyle || "Style"}
                >
                  <Palette className="w-4 h-4" aria-hidden="true" />
                  <span className="max-w-full truncate">{ts.diaryStyle || "Style"}</span>
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  void hapticTap();
                  collapseMobileToolsForSurface();
                  setShowPhotos(true);
                }}
                disabled={photoIds.length >= MAX_PHOTOS_PER_ENTRY}
                aria-label={
                  photoIds.length >= MAX_PHOTOS_PER_ENTRY ? photoLimitLabel : photoToolLabel
                }
                title={photoIds.length >= MAX_PHOTOS_PER_ENTRY ? photoLimitLabel : photoToolLabel}
                className={cn(
                  "rounded-2xl font-medium text-muted-foreground border border-transparent hover:bg-primary/10 hover:text-primary motion-safe:transition-all flex items-center disabled:opacity-40",
                  desktop
                    ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                    : "min-h-[50px] min-w-0 px-2 py-2 text-[10px] leading-tight flex-col justify-center gap-1"
                )}
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full truncate">{ts.diarySnapshot || "Photo"}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
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
                    : "min-h-[50px] min-w-0 px-2 py-2 text-[10px] leading-tight flex-col justify-center gap-1",
                  showBurnWidget
                    ? "bg-destructive/10 text-destructive border-destructive/25"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                )}
                aria-pressed={showBurnWidget}
              >
                <Flame className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full truncate">
                  {ts.journalBurnShort || ts.journalBurnButton || "Burn"}
                </span>
              </motion.button>
              {onAddGratitude && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
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
                      : "min-h-[50px] min-w-0 px-2 py-2 text-[10px] leading-tight flex-col justify-center gap-1",
                    showGratitudeWidget
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                  )}
                  aria-pressed={showGratitudeWidget}
                >
                  <Leaf className="w-4 h-4" aria-hidden="true" />
                  <span className="max-w-full truncate">
                    {ts.journalGratitudeShort || ts.journalGratitudeTitle || "Gratitude"}
                  </span>
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  void hapticTap();
                  if (!showBreathe) collapseMobileToolsForSurface();
                  setShowBreathe(!showBreathe);
                }}
                className={cn(
                  "rounded-2xl font-medium border motion-safe:transition-all flex items-center",
                  desktop
                    ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                    : "min-h-[50px] min-w-0 px-2 py-2 text-[10px] leading-tight flex-col justify-center gap-1",
                  showBreathe
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                )}
                aria-pressed={showBreathe}
              >
                <Wind className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full truncate">{ts.diaryBreathe || "Breathe"}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  void hapticTap();
                  if (!zenFocusActive) collapseMobileToolsForSurface();
                  setZenFocusActive(!zenFocusActive);
                }}
                className={cn(
                  "rounded-2xl font-medium border motion-safe:transition-all flex items-center",
                  desktop
                    ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                    : "min-h-[50px] min-w-0 px-2 py-2 text-[10px] leading-tight flex-col justify-center gap-1",
                  zenFocusActive
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                )}
                aria-pressed={zenFocusActive}
              >
                <Target className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full truncate">{ts.diaryFocusRay || "Focus"}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  void hapticTap();
                  if (!showHabits) collapseMobileToolsForSurface();
                  setShowHabits(!showHabits);
                }}
                className={cn(
                  "rounded-2xl font-medium border motion-safe:transition-all flex items-center",
                  desktop
                    ? "px-4 py-2 text-sm gap-2 flex-shrink-0 min-h-[48px]"
                    : "min-h-[50px] min-w-0 px-2 py-2 text-[10px] leading-tight flex-col justify-center gap-1",
                  showHabits
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                )}
                aria-pressed={showHabits}
              >
                <ListChecks className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full truncate">{ts.journalHabitsSection || "Habits"}</span>
                {completedHabitCount > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] leading-none text-primary">
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
          onSelectFile={async (file) => {
            await handleAddPhoto(file);
          }}
          onClose={() => setShowPhotos(false)}
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
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-muted px-3 text-sm font-medium text-foreground"
              >
                {ts.journalVoicePrivacyCancel || ts.cancel || "Not now"}
              </button>
              <button
                type="button"
                onClick={handleConfirmDictation}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
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
            role="dialog"
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

              <p
                id={recordingDialogTitleId}
                className="text-sm font-semibold mb-1 text-[var(--diary-text,hsl(var(--foreground)))]"
              >
                {ts.journalRecording || "Recording"}
              </p>
              <p className="text-2xl font-mono font-bold tabular-nums mb-4 text-[var(--diary-text,hsl(var(--foreground)))]">
                {formatRecordingTime(recorder.duration)}
              </p>
              <p
                id={recordingDialogDescriptionId}
                className="text-[10px] mb-4 text-[var(--diary-muted,hsl(var(--muted-foreground)))]"
              >
                {ts.journalAudioMaxDuration || "Max 5 minutes"}
              </p>

              <button
                onClick={handleStopRecording}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-semibold",
                  "bg-red-500 text-white",
                  "flex items-center justify-center gap-2",
                  "active:scale-[0.98] motion-safe:transition-transform min-h-[44px]"
                )}
              >
                <Square className="w-4 h-4" aria-hidden="true" />
                {ts.journalRecordingStopKeep || ts.journalRecordingStop || "Stop & keep"}
              </button>
              <button
                onClick={handleDiscardRecording}
                className={cn(
                  "mt-2 w-full py-3 rounded-xl text-sm font-semibold",
                  "bg-background/70 text-foreground border border-border/60",
                  "flex items-center justify-center gap-2",
                  "active:scale-[0.98] motion-safe:transition-transform min-h-[44px]"
                )}
              >
                <X className="w-4 h-4" aria-hidden="true" />
                {ts.journalRecordingDiscard || "Discard"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <div className="flex gap-2">
              <button
                onClick={closeDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
              >
                {ts.cancel || "Cancel"}
              </button>
              <button
                onClick={() => {
                  closeDeleteConfirm();
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
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSaveAndClose}
                disabled={saveState === "saving" || !hasContent}
                aria-describedby={!hasContent ? "journal-save-close-disabled-hint" : undefined}
                className={cn(
                  "w-full py-2.5 rounded-xl text-sm font-medium min-h-[44px]",
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
                className="w-full py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-medium min-h-[44px]"
              >
                {ts.journalDiscard || "Discard"}
              </button>
              <button
                onClick={closeUnsavedDialog}
                className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
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
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground text-sm font-medium min-h-[44px]"
              >
                {ts.journalSaveDraftOpenSettings || "Save Draft and Open Settings"}
              </button>
              <button
                onClick={closeSettingsConfirm}
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
            <DiaryBreatheWidget />
            <button
              ref={panicUnlockButtonRef}
              type="button"
              onClick={() => {
                void handlePanicUnlock();
              }}
              className="flex min-h-[44px] min-w-[44px] items-center gap-2 px-6 py-3 rounded-xl bg-white/10 dark:bg-white/10 border border-white/20 dark:border-white/20 text-white/80 text-sm font-medium backdrop-blur-sm active:scale-95 motion-safe:transition-transform"
            >
              <Fingerprint className="w-5 h-5" aria-hidden="true" />
              {ts.journalUnlockBiometric || "Unlock"}
            </button>
            {panicUnlockError ? (
              <div
                role="alert"
                className="mx-6 flex max-w-[320px] items-start gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-left text-xs font-medium text-white/80 backdrop-blur-sm dark:border-white/15 dark:bg-white/10"
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
              collapseMobileToolsForSurface();
              setShowPhotos(true);
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
