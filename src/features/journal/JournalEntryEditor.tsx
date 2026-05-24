import { memo, useEffect, useCallback, useState, useRef, useLayoutEffect } from "react";
import {
  ArrowLeft,
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
import { cn, getToday } from "@/lib/utils";
import { zenMotion } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";
import { getLocale } from "@/lib/timeUtils";
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
import { SlashCommandMenu } from "./SlashCommandMenu";
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

// Local aliases to avoid name collision with the hook's `theme` state
const DIARY_FONTS_LOCAL = DIARY_FONTS;
const DIARY_FONT_NAMES_LOCAL = DIARY_FONT_NAMES;

type DiaryAccentStyle = Readonly<{
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
  boxShadow?: string;
}>;

const DIARY_ACCENTS = {
  purple: { backgroundColor: "rgba(168, 85, 247, 0.15)", color: "#c084fc", borderColor: "rgba(168, 85, 247, 0.30)" },
  cyan: { backgroundColor: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", borderColor: "rgba(6, 182, 212, 0.30)" },
  emerald: { backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.30)" },
  orange: { backgroundColor: "rgba(249, 115, 22, 0.15)", color: "#fb923c", borderColor: "rgba(249, 115, 22, 0.30)" },
  violet: { backgroundColor: "rgba(139, 92, 246, 0.15)", color: "#a78bfa", borderColor: "rgba(139, 92, 246, 0.30)" },
  pink: { backgroundColor: "rgba(236, 72, 153, 0.15)", color: "#f472b6", borderColor: "rgba(236, 72, 153, 0.30)" },
  blue: { backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", borderColor: "rgba(59, 130, 246, 0.30)" },
  rose: { backgroundColor: "rgba(244, 63, 94, 0.15)", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.30)" },
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
];

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
  onRequestSettings,
  onBindSettingsRequestHandler,
}: JournalEntryEditorProps) {
  const themeTransition = useThemeTransition();
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
    handleRetry: _handleRetry,
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
    handlePromptTap,
    handleEditorInput,
    cycleFontSize,
    handleContentScroll,
    handleTemplateSelect,
    handleTemplateClose,
  } = state;

  // EP8_US002: Typing dynamics for mini-orb with delayed unmount
  const typingDynamics = useTypingDynamics(editorRef);
  const [orbMounted, setOrbMounted] = useState(false);
  const [mobileToolsCollapsed, setMobileToolsCollapsed] = useState(false);
  const orbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMobileToolsCollapse = useCallback(() => {
    void hapticTap();
    setMobileToolsCollapsed(true);
    setShowStyleBar(false);
  }, [setShowStyleBar]);

  const handleMobileToolsExpand = useCallback(() => {
    void hapticTap();
    setMobileToolsCollapsed(false);
  }, []);

  const handleMobileStyleToggle = useCallback(() => {
    void hapticTap();
    setMobileToolsCollapsed(false);
    setShowStyleBar((value) => !value);
  }, [setShowStyleBar]);

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

  // T3: Attach markdown shortcut listener to editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.addEventListener("input", handleMarkdownShortcuts);
    return () => editor.removeEventListener("input", handleMarkdownShortcuts);
  }, [editorRef, handleMarkdownShortcuts]);

  const handleRequestSettings = useCallback(() => {
    if (!onRequestSettings) return;

    if (isDirty || hasImmediateChanges()) {
      setShowSettingsConfirm(true);
      return;
    }

    onRequestSettings();
  }, [hasImmediateChanges, isDirty, onRequestSettings, setShowSettingsConfirm]);

  const handleSaveDraftAndOpenSettings = useCallback(async () => {
    await persistDraftNow();
    setShowSettingsConfirm(false);
    onRequestSettings?.();
  }, [persistDraftNow, onRequestSettings, setShowSettingsConfirm]);

  useLayoutEffect(() => {
    onBindSettingsRequestHandler?.(onRequestSettings ? handleRequestSettings : null);
    return () => onBindSettingsRequestHandler?.(null);
  }, [handleRequestSettings, onBindSettingsRequestHandler, onRequestSettings]);

  return (
    <div
      ref={editorOverlayRef}
      role={desktop ? undefined : "dialog"}
      aria-modal={desktop ? undefined : true}
      aria-label={ts.journalEntryTitle || "Diary Entry"}
      className={cn(
        "flex flex-col overflow-hidden text-foreground",
        desktop
          ? "relative isolate h-full min-h-0 overflow-hidden"
          : "fixed inset-0 z-[60] h-screen supports-[height:100svh]:h-[100svh]"
      )}
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
        scope={desktop ? "container" : "viewport"}
      />

      {/* Atmospheric background pattern overlay (Layer 1 — behind paper, above canvas) */}
      {bgPattern !== "none" && !desktop && (
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={getBgPatternStyle(bgPattern)}
        />
      )}

      {/* ═══ GLASS TOOLBAR ═══ */}
      <div
        className={cn(
          "relative z-50 flex-shrink-0 w-full flex flex-col border-b",
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
                "flex items-center gap-1.5 py-2 rounded-lg text-muted-foreground hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground motion-safe:transition-all min-h-[44px]",
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
              <div className="relative">
                <button
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  className="text-[11px] flex items-center gap-1 text-foreground/70 hover:text-muted-foreground motion-safe:transition-colors whitespace-nowrap"
                >
                  <Calendar className="w-3 h-3" aria-hidden="true" />
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
          <div className={cn("flex items-center flex-shrink-0", desktop ? "gap-2" : "gap-1")}>
            {/* Style panel toggle stays in the desktop header; mobile exposes it in the bottom tool tray. */}
            {desktop && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowStyleBar((v) => !v)}
                className={cn(
                  "p-2 rounded-lg motion-safe:transition-all min-w-[44px] min-h-[44px] flex items-center justify-center",
                  showStyleBar
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-white/10 text-muted-foreground"
                )}
                aria-label={ts.diaryStyle || "Style"}
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
            >
              {privacyShieldActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </motion.button>

            <motion.button
              whileTap={saveSuccess ? {} : { scale: 0.92 }}
              whileHover={saveSuccess ? {} : { scale: 1.03 }}
              onClick={saveSuccess ? undefined : handleSave}
              disabled={!saveSuccess && (saveState === "saving" || !hasContent)}
              className={cn(
                "flex items-center gap-1.5 py-2 rounded-xl text-sm font-medium min-h-[44px] motion-safe:transition-all",
                desktop ? "px-4" : "px-3 min-w-[44px]",
                saveSuccess
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 hover:shadow-sm",
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
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1.5 px-1.5 pt-1">
                {/* Atmosphere capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 dark:bg-black/30 p-1.5 rounded-xl border border-white/5 dark:border-white/5 flex-shrink-0">
                  {ATMOSPHERE_THEMES.map((at) => {
                    const isActive = at.name === diaryTheme.theme;
                    return (
                      <motion.button
                        key={at.name}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          themeTransition.triggerTransition();
                          diaryTheme.setTheme(at.name);
                          setBgPattern("none");
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border motion-safe:transition-all",
                          isActive
                            ? ""
                            : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground"
                        )}
                        style={isActive ? at.activeStyle : undefined}
                      >
                        {ts[at.i18nKey] || at.label}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Fonts + Size capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 dark:bg-black/30 p-1.5 rounded-xl border border-white/5 dark:border-white/5 flex-shrink-0">
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
                          "px-4 py-2 rounded-lg text-sm font-medium border motion-safe:transition-all flex items-center gap-1.5",
                          isActive
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground"
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
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-transparent text-muted-foreground hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground motion-safe:transition-all"
                    aria-label={t.ariaFontSize}
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
                        "px-3 py-2 rounded-lg text-sm font-medium border motion-safe:transition-all flex items-center gap-1.5",
                        showPromptsDropdown
                          ? "bg-[hsl(var(--zf-memory)/0.14)] text-[hsl(var(--zf-memory))] border-[hsl(var(--zf-memory)/0.30)]"
                          : "bg-black/30 dark:bg-black/30 text-muted-foreground border-white/5 dark:border-white/5 hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground"
                      )}
                    >
                      <Lightbulb className="w-4 h-4" aria-hidden="true" />
                      {ts.journalPromptsShort || ts.journalPrompt || "Prompts"}
                    </motion.button>
                  </div>
                )}

                {/* Features capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 dark:bg-black/30 p-1.5 rounded-xl border border-white/5 dark:border-white/5 flex-shrink-0">
                  {MOOD_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.mood}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setMood(mood === opt.mood ? undefined : opt.mood)}
                      aria-label={opt.mood}
                      aria-pressed={mood === opt.mood}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground motion-safe:transition-all",
                        mood === opt.mood
                          ? ""
                          : "hover:bg-white/10 dark:hover:bg-white/10"
                      )}
                      style={mood === opt.mood ? opt.activeStyle : undefined}
                    >
                      <DiaryMiniOrb
                        mood={opt.mood}
                        size="micro"
                        className={cn(
                          "scale-[0.56] opacity-70 motion-safe:transition-all",
                          mood === opt.mood && "scale-[0.72] opacity-100"
                        )}
                      />
                    </motion.button>
                  ))}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowTags(!showTags)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium border motion-safe:transition-all",
                      showTags
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    #
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowStickers(true)}
                    disabled={stickers.length >= MAX_STICKERS_PER_ENTRY}
                    className="px-3 py-2 rounded-lg text-sm border border-transparent bg-transparent text-muted-foreground hover:bg-white/10 dark:hover:bg-white/10 motion-safe:transition-all disabled:opacity-40"
                    aria-label={ts.journalToolbarSticker || "Sticker"}
                  >
                    <Sticker className="w-4 h-4" aria-hidden="true" />
                  </motion.button>
                </div>

                {/* Paper color capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 dark:bg-black/30 p-1.5 rounded-xl border border-white/5 dark:border-white/5 flex-shrink-0">
                  {(["dark", "milky", "white"] as PaperColor[]).map((pc) => (
                    <motion.button
                      key={pc}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setPaperColor(pc)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 motion-safe:transition-all",
                        paperColor === pc
                          ? "border-white/60 dark:border-white/60 scale-110"
                          : "border-white/10 dark:border-white/10"
                      )}
                      style={{ background: PAPER_COLORS[pc].bg }}
                      aria-label={PAPER_COLORS[pc].label}
                    />
                  ))}
                </div>

                {/* Ink capsule */}
                <div className="flex items-center gap-1.5 bg-black/30 dark:bg-black/30 p-1.5 rounded-xl border border-white/5 dark:border-white/5 flex-shrink-0">
                  {INK_COLORS.map((c) => (
                    <motion.button
                      key={c.hex}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setInkColor(c.hex)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 motion-safe:transition-all",
                        inkColor === c.hex
                          ? "border-white/60 dark:border-white/60 scale-110"
                          : "border-white/10 dark:border-white/10"
                      )}
                      style={{ background: c.hex }}
                      aria-label={c.label}
                    />
                  ))}
                </div>

                {/* Media capsule (Record + Voice — Photo moved to bottom toolbar) */}
                <div className="flex items-center gap-1.5 bg-black/30 dark:bg-black/30 p-1.5 rounded-xl border border-white/5 dark:border-white/5 flex-shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleStartRecording()}
                    disabled={audioIds.length >= MAX_AUDIO_PER_ENTRY}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-transparent hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground motion-safe:transition-all flex items-center gap-2 disabled:opacity-40"
                  >
                    <Mic className="w-4 h-4" aria-hidden="true" />
                    {ts.diaryRecord || "Record"}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleToggleDictation}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border motion-safe:transition-all flex items-center gap-2",
                      voice.isListening
                        ? "bg-red-500/15 text-red-400 border-red-500/30"
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    <Mic2 className="w-4 h-4" aria-hidden="true" />
                    {voice.isListening ? ts.journalDictateStop || "Stop" : ts.diaryVoice || "Voice"}
                  </motion.button>
                </div>

                {/* Visual capsule (BG + Speed + Texture) */}
                <div className="flex items-center gap-1.5 bg-black/30 dark:bg-black/30 p-1.5 rounded-xl border border-white/5 dark:border-white/5 flex-shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      setBgIntensity((prev) =>
                        prev === "full" ? "dim" : prev === "dim" ? "off" : "full"
                      )
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border motion-safe:transition-all flex items-center gap-1.5",
                      bgIntensity === "full"
                        ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                        : bgIntensity === "dim"
                          ? "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30"
                          : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    {bgIntensity === "full" ? (
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : bgIntensity === "dim" ? (
                      <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <CircleOff className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>BG</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      setParticleSpeed((prev) =>
                        prev === "slow" ? "drift" : prev === "drift" ? "off" : "slow"
                      )
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border motion-safe:transition-all flex items-center gap-1.5",
                      particleSpeed === "drift"
                        ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                        : particleSpeed === "slow"
                          ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                          : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                    {ts.diaryParticleSpeed || "Speed"}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const idx = PAPER_TEXTURE_NAMES.indexOf(paperTexture);
                      setPaperTexture(PAPER_TEXTURE_NAMES[(idx + 1) % PAPER_TEXTURE_NAMES.length]);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border motion-safe:transition-all flex items-center gap-1.5",
                      paperTexture !== "clean"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-white/10 dark:hover:bg-white/10 hover:text-foreground"
                    )}
                  >
                    <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                    {paperTexture === "clean" ? ts.diaryTexture || "Texture" : paperTexture}
                  </motion.button>
                </div>

                {/* Atmospheric pattern capsule */}
                <div className="flex items-center gap-1 bg-black/30 dark:bg-black/30 p-1.5 rounded-xl border border-white/5 dark:border-white/5 flex-shrink-0">
                  {BG_PATTERN_LIST.map((pat) => {
                    const isActive = pat.name === bgPattern;
                    const isNone = pat.name === "none";
                    return (
                      <motion.button
                        key={pat.name}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setBgPattern(pat.name)}
                        className={cn(
                          "w-8 h-8 rounded-lg border-2 motion-safe:transition-all flex-shrink-0 flex items-center justify-center",
                          isActive
                            ? "border-white/60 dark:border-white/60 scale-110 shadow-lg"
                            : "border-white/10 dark:border-white/10 hover:border-white/25 dark:hover:border-white/25",
                          isNone &&
                            !isActive &&
                            "border-dashed border-white/20 dark:border-white/20"
                        )}
                        style={isNone ? undefined : { background: pat.swatch }}
                        aria-label={ts[pat.i18nKey] || pat.name}
                        title={ts[pat.i18nKey] || pat.name}
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
                    className="mx-4 mt-2 p-3 rounded-xl bg-popover/95 backdrop-blur-xl border border-white/10 dark:border-white/10 shadow-2xl space-y-1.5"
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
                          className="p-1.5 rounded-lg hover:bg-white/10 dark:hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          aria-label={t.ariaShufflePrompts}
                        >
                          <Shuffle className="w-3 h-3 text-foreground/70" />
                        </button>
                        <button
                          onClick={() => setShowPromptsDropdown(false)}
                          className="p-1 rounded hover:bg-white/10 dark:hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                        className="block w-full text-start text-xs px-3 py-2.5 rounded-xl min-h-[40px] text-muted-foreground hover:text-white hover:bg-white/10 dark:hover:bg-white/10 motion-safe:transition-all"
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
          className={cn(
            "absolute inset-0 overflow-y-auto z-10",
            desktop
              ? "px-8 pt-[clamp(80px,18vh,140px)] pb-[clamp(100px,22vh,160px)]"
              : "px-3 pt-6 pb-8"
          )}
          onScroll={handleContentScroll}
        >
          <div
            className={cn(
              "relative max-w-4xl mx-auto rounded-2xl border p-4 sm:p-6 md:p-8 min-h-[60dvh] space-y-4 [contain:layout_style_paint]",
              desktop ? "shadow-md max-w-3xl" : "shadow-2xl",
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
              aria-label={ts.journalEntryTitle || "Entry title"}
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

            {/* Stickers */}
            {stickers.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {stickers.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleRemoveSticker(i)}
                    className="px-1.5 py-0.5 rounded-lg hover:bg-muted/50 active:scale-90 motion-safe:transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive motion-safe:transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTags((prev) => prev.filter((t2) => t2 !== tag))}
                    className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 motion-safe:transition-colors min-h-[32px]"
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
              suppressContentEditableWarning
              className="w-full max-w-prose mx-auto min-h-[260px] bg-transparent border-none outline-none resize-none [&_blockquote]:border-l-2 [&_blockquote]:border-current/20 [&_blockquote]:ps-3 [&_blockquote]:italic [&_code]:bg-black/5 dark:[&_code]:bg-black/5 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_del]:line-through empty:before:content-[attr(data-placeholder)] empty:before:opacity-40 empty:before:pointer-events-none leading-[1.8]"
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
                    {formatJournalWordCount(wordCount, language, ts)}
                  </span>
                  <span className="text-[10px] opacity-40">
                    {formatLocalizedCount(
                      content.length,
                      language,
                      ts,
                      "journalCharacterCount",
                      ts.journalChars || "chars"
                    )}
                  </span>
                  {wordCount >= 50 && (
                    <span className="text-[10px] opacity-40">
                      ~{formatLocalizedCount(
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
                  className="absolute bottom-2 right-2 z-40 pointer-events-none"
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
          "relative z-50 flex-shrink-0 w-full border-t backdrop-blur-[20px] motion-safe:transition-all",
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
                  className="flex min-h-[36px] min-w-[44px] items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground motion-safe:transition-colors hover:bg-primary/10 hover:text-primary"
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
                  className="mb-2 overflow-hidden rounded-3xl border border-primary/15 bg-primary/5 p-2 shadow-inner"
                >
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-border/50 bg-background/75 p-1">
                      {ATMOSPHERE_THEMES.map((at) => {
                        const isActive = at.name === diaryTheme.theme;
                        return (
                          <button
                            key={at.name}
                            type="button"
                            onClick={() => {
                              themeTransition.triggerTransition();
                              diaryTheme.setTheme(at.name);
                              setBgPattern("none");
                            }}
                            className={cn(
                              "min-h-[36px] rounded-xl border px-3 text-xs font-semibold motion-safe:transition-all",
                              isActive
                                ? "border-primary/30 bg-primary text-primary-foreground"
                                : "border-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            )}
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
                      aria-label={t.ariaFontSize}
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
                      >
                        <Lightbulb className="h-4 w-4" aria-hidden="true" />
                        {ts.journalWritingPrompts || "Prompts"}
                      </button>
                    )}

                    <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-border/50 bg-background/75 p-1">
                      {MOOD_OPTIONS.map((opt) => (
                        <button
                          key={opt.mood}
                          type="button"
                          onClick={() => setMood(mood === opt.mood ? undefined : opt.mood)}
                          aria-label={opt.mood}
                          aria-pressed={mood === opt.mood}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground motion-safe:transition-all",
                            mood === opt.mood
                              ? ""
                              : "hover:bg-primary/10 hover:text-primary"
                          )}
                          style={mood === opt.mood ? opt.activeStyle : undefined}
                        >
                          <DiaryMiniOrb
                            mood={opt.mood}
                            size="micro"
                            className={cn(
                              "scale-[0.56] opacity-70 motion-safe:transition-all",
                              mood === opt.mood && "scale-[0.72] opacity-100"
                            )}
                          />
                        </button>
                      ))}
                    </div>

                    <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-border/50 bg-background/75 p-1">
                      {(["dark", "milky", "white"] as PaperColor[]).map((pc) => (
                        <button
                          key={pc}
                          type="button"
                          onClick={() => setPaperColor(pc)}
                          className={cn(
                            "h-9 w-9 rounded-full border-2 motion-safe:transition-all",
                            paperColor === pc ? "scale-110 border-primary" : "border-border"
                          )}
                          style={{ background: PAPER_COLORS[pc].bg }}
                          aria-label={PAPER_COLORS[pc].label}
                        />
                      ))}
                    </div>

                    <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-border/50 bg-background/75 p-1">
                      {INK_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setInkColor(c.hex)}
                          className={cn(
                            "h-9 w-9 rounded-full border-2 motion-safe:transition-all",
                            inkColor === c.hex ? "scale-110 border-primary" : "border-border"
                          )}
                          style={{ background: c.hex }}
                          aria-label={c.label}
                        />
                      ))}
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
                        bgIntensity !== "off"
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      {bgIntensity === "full" ? (
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                      ) : bgIntensity === "dim" ? (
                        <Moon className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <CircleOff className="h-4 w-4" aria-hidden="true" />
                      )}
                      BG
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
                        particleSpeed !== "off"
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      <Gauge className="h-4 w-4" aria-hidden="true" />
                      {ts.diaryParticleSpeed || "Speed"}
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
                    >
                      <Layers className="h-4 w-4" aria-hidden="true" />
                      {paperTexture === "clean" ? ts.diaryTexture || "Texture" : paperTexture}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTags(!showTags)}
                      className={cn(
                        "flex min-h-[44px] shrink-0 items-center rounded-2xl border px-3 text-sm font-semibold motion-safe:transition-all",
                        showTags
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/75 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      #
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowStickers(true)}
                      disabled={stickers.length >= MAX_STICKERS_PER_ENTRY}
                      className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 text-xs font-semibold text-muted-foreground motion-safe:transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                      aria-label={ts.journalToolbarSticker || "Sticker"}
                    >
                      <Sticker className="h-4 w-4" aria-hidden="true" />
                      {ts.journalToolbarSticker || "Sticker"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartRecording()}
                      disabled={audioIds.length >= MAX_AUDIO_PER_ENTRY}
                      className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 text-xs font-semibold text-muted-foreground motion-safe:transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                    >
                      <Mic className="h-4 w-4" aria-hidden="true" />
                      {ts.journalToolbarRecord || ts.diaryRecord || "Record"}
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
                    >
                      <Mic2 className="h-4 w-4" aria-hidden="true" />
                      {voice.isListening
                        ? ts.journalDictateStop || "Stop"
                        : ts.journalToolbarVoice || "Voice"}
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
                            className="flex min-h-[36px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            aria-label={t.ariaShufflePrompts}
                          >
                            <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        {randomPrompts.map((prompt, i) => (
                          <button
                            key={`${promptSeed}-${i}`}
                            type="button"
                            onClick={() => handlePromptTap(prompt)}
                            className="block min-h-[40px] w-full rounded-xl px-3 py-2 text-start text-xs text-muted-foreground motion-safe:transition-colors hover:bg-primary/10 hover:text-foreground"
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
                  setShowPhotos(true);
                }}
                disabled={photoIds.length >= MAX_PHOTOS_PER_ENTRY}
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
              >
                <Wind className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full truncate">{ts.diaryBreathe || "Breathe"}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  void hapticTap();
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
              >
                <Target className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full truncate">{ts.diaryFocusRay || "Focus"}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  void hapticTap();
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
          onSelectFile={(file) => handleAddPhoto(file)}
          onClose={() => setShowPhotos(false)}
          currentCount={photoIds.length}
          maxCount={MAX_PHOTOS_PER_ENTRY}
        />
      )}

      {/* Template picker for new entries */}
      {showTemplatePicker && !entry && !draftAvailable && (
        <JournalTemplatePicker onSelect={handleTemplateSelect} onClose={handleTemplateClose} />
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
            aria-label={t.ariaRecording}
            className="fixed inset-0 z-[65] bg-black/60 dark:bg-black/60 flex items-center justify-center"
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
                  "active:scale-[0.98] motion-safe:transition-transform min-h-[44px]"
                )}
              >
                <Square className="w-4 h-4" aria-hidden="true" />
                {ts.journalRecordingStop || "Stop Recording"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 dark:bg-black/50 flex items-center justify-center motion-safe:animate-fade-in"
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
          className="fixed inset-0 z-[70] bg-black/50 dark:bg-black/50 flex items-center justify-center motion-safe:animate-fade-in"
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
                disabled={saveState === "saving"}
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

      {showSettingsConfirm && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 dark:bg-black/50 flex items-center justify-center motion-safe:animate-fade-in"
          onClick={() => setShowSettingsConfirm(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={zenMotion.gentle}
            className="rounded-2xl p-5 max-w-[320px] mx-4 shadow-xl bg-[var(--diary-bg,hsl(var(--card)))] border border-[var(--diary-border,hsl(var(--border)/0.3))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2 text-[var(--diary-text,hsl(var(--foreground)))]">
              {ts.journalSettings || "Diary Settings"}
            </h3>
            <p className="text-sm mb-4 text-[var(--diary-muted,hsl(var(--muted-foreground)))]">
              Save this draft before opening settings so you can continue exactly where you left
              off.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  void handleSaveDraftAndOpenSettings();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground text-sm font-medium min-h-[44px]"
              >
                Save Draft & Open Settings
              </button>
              <button
                onClick={() => setShowSettingsConfirm(false)}
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
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 dark:bg-white/10 border border-white/20 dark:border-white/20 text-white/80 text-sm font-medium backdrop-blur-sm active:scale-95 motion-safe:transition-transform"
            >
              <Fingerprint className="w-5 h-5" aria-hidden="true" />
              {ts.journalUnlockBiometric || "Unlock"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Theme transition overlay (crossfade blur on theme change) */}
      <ThemeTransitionOverlay
        isTransitioning={themeTransition.isTransitioning}
        onTransitionEnd={themeTransition.onTransitionEnd}
      />

      {/* Floating format toolbar (Telegram-style — appears on text selection) */}
      <DiaryFormatToolbar editorRef={editorRef} scrollContainerRef={scrollAreaRef} />

      {/* Slash command menu (Notion-style — appears on typing /) */}
      <SlashCommandMenu
        editorRef={editorRef}
        onCommand={(cmd) => {
          switch (cmd) {
            case "mood":
              /* scroll to mood section — already visible at top */ break;
            case "heading":
              document.execCommand("formatBlock", false, "h2");
              break;
            case "quote":
              document.execCommand("formatBlock", false, "blockquote");
              break;
            case "checklist":
              document.execCommand("insertHTML", false, '<div><input type="checkbox" /> </div>');
              break;
            case "breathe":
              setShowBreathe(true);
              break;
            case "gratitude":
              setShowGratitudeWidget(true);
              setShowBurnWidget(false);
              break;
            case "burn":
              setShowBurnWidget(true);
              setShowGratitudeWidget(false);
              break;
            case "focus":
              setZenFocusActive(true);
              break;
            case "template":
              /* template auto-shows for new entries */ break;
            case "photo":
              setShowPhotos(true);
              break;
            case "audio":
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
});
