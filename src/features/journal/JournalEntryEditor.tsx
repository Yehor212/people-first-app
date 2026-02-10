import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Check, Smile, Camera, Hash, Trash2, Sparkles, X, Calendar, Shuffle, Mic, MicOff, Circle, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn, getToday } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { registerModalCloseCallback } from '@/lib/androidBackHandler';
import type { JournalEntry, JournalPhoto, JournalAudio } from './types';
import type { MoodType } from '@/types';
import { MAX_PHOTOS_PER_ENTRY, MAX_STICKERS_PER_ENTRY, MAX_AUDIO_PER_ENTRY } from './types';
import { JournalStickerPicker } from './JournalStickerPicker';
import { JournalPhotoPicker } from './JournalPhotoPicker';
import { JournalPhotoGallery } from './JournalPhotoGallery';
import { JournalAudioPlayer } from './JournalAudioPlayer';
import { StickerRenderer } from './StickerRenderer';
import { JournalTemplatePicker } from './JournalTemplatePicker';
import { useJournalVoice } from './useJournalVoice';
import { useAudioRecorder } from './useAudioRecorder';
import { JournalHabitSection } from './JournalHabitSection';

const MOOD_OPTIONS: { mood: MoodType; emoji: string }[] = [
  { mood: 'great', emoji: '\u{1F604}' },
  { mood: 'good', emoji: '\u{1F642}' },
  { mood: 'okay', emoji: '\u{1F610}' },
  { mood: 'bad', emoji: '\u{1F614}' },
  { mood: 'terrible', emoji: '\u{1F622}' },
];

const DEFAULT_PROMPTS = [
  'What made you smile today?',
  'What challenged you today?',
  'What are you grateful for?',
  'Describe a moment that stood out today.',
  'What did you learn today?',
  'How are you feeling right now?',
  'What would you like to remember about today?',
  'What is something you accomplished?',
  'Write about someone who inspired you.',
  'What are your thoughts before sleep?',
];

const PROMPT_KEYS = [
  'journalPrompt1', 'journalPrompt2', 'journalPrompt3', 'journalPrompt4', 'journalPrompt5',
  'journalPrompt6', 'journalPrompt7', 'journalPrompt8', 'journalPrompt9', 'journalPrompt10',
];

// ── Draft helpers ──

interface DraftData {
  title: string;
  content: string;
  stickers: string[];
  photoIds: string[];
  audioIds?: string[];
  mood?: MoodType;
  tags: string[];
  savedAt: number;
}

function formatRecordingTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getDraftKey(entryId: string | null): string {
  return `journal_draft_${entryId || 'new'}`;
}

function saveDraft(key: string, data: DraftData) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

function loadDraft(key: string): DraftData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as DraftData;
    if (Date.now() - data.savedAt > 7 * 86400000) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function clearDraft(key: string) { localStorage.removeItem(key); }

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
    habitSnapshot?: { habitId: string; habitName: string; habitIcon: string; completed: boolean }[];
  }) => Promise<void>;
  onAddPhoto: (file: File, entryId: string) => Promise<JournalPhoto>;
  onRemovePhoto: (photoId: string, entryId: string) => Promise<void>;
  onAddAudio: (data: string, duration: number, mimeType: string, entryId: string) => Promise<JournalAudio>;
  onRemoveAudio: (audioId: string, entryId: string) => Promise<void>;
  onDelete?: () => void;
  onBack: () => void;
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
}: JournalEntryEditorProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const draftKey = getDraftKey(entry?.id || null);

  const [title, setTitle] = useState(entry?.title || '');
  const [date, setDate] = useState(entry?.date || getToday());
  const [content, setContent] = useState(entry?.content || '');
  const [stickers, setStickers] = useState<string[]>(entry?.stickers || []);
  const [photoIds, setPhotoIds] = useState<string[]>(entry?.photoIds || []);
  const [audioIds, setAudioIds] = useState<string[]>(entry?.audioIds || []);
  const [audioRecordings, setAudioRecordings] = useState<JournalAudio[]>([]);
  const [mood, setMood] = useState<MoodType | undefined>(entry?.mood);
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [habitSnapshot, setHabitSnapshot] = useState<{ habitId: string; habitName: string; habitIcon: string; completed: boolean }[]>(entry?.habitSnapshot || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [showStickers, setShowStickers] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(!entry);
  const [showRecordingOverlay, setShowRecordingOverlay] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState<DraftData | null>(null);
  const [promptsHidden, setPromptsHidden] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(0);

  const entryId = entry?.id || '__draft__';

  // Voice dictation + audio recording hooks
  const voice = useJournalVoice(language);
  const recorder = useAudioRecorder();
  const wasListeningRef = useRef(false);

  // Initial values for isDirty check
  const initialRef = useRef({
    title: entry?.title || '',
    content: entry?.content || '',
    stickers: JSON.stringify(entry?.stickers || []),
    photoIds: JSON.stringify(entry?.photoIds || []),
    audioIds: JSON.stringify(entry?.audioIds || []),
    mood: entry?.mood,
    tags: JSON.stringify(entry?.tags || []),
  });

  const isDirty = useMemo(() => {
    const init = initialRef.current;
    return title !== init.title || content !== init.content ||
      JSON.stringify(stickers) !== init.stickers ||
      JSON.stringify(photoIds) !== init.photoIds ||
      JSON.stringify(audioIds) !== init.audioIds ||
      mood !== init.mood ||
      JSON.stringify(tags) !== init.tags;
  }, [title, content, stickers, photoIds, audioIds, mood, tags]);

  const wordCount = useMemo(() => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  const [promptSeed, setPromptSeed] = useState(0);
  const randomPrompts = useMemo(() => {
    const prompts = PROMPT_KEYS.map((key, i) => ts[key] || DEFAULT_PROMPTS[i]);
    // Use seed to force re-shuffle
    void promptSeed;
    const shuffled = [...prompts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptSeed]);

  const hasContent = content.trim() || title.trim() || stickers.length > 0 || photoIds.length > 0 || audioIds.length > 0 || mood;

  // ── Load draft on mount ──
  useEffect(() => {
    const draft = loadDraft(draftKey);
    if (draft) {
      setDraftAvailable(draft);
      setShowTemplatePicker(false); // Don't show templates if draft exists
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save draft (3s debounce) ──
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (title || content || stickers.length > 0 || mood || tags.length > 0 || audioIds.length > 0) {
        saveDraft(draftKey, { title, content, stickers, photoIds, audioIds, mood, tags, savedAt: Date.now() });
        setDraftSavedAt(Date.now());
      }
    }, 3000);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [title, content, stickers, photoIds, audioIds, mood, tags, draftKey]);

  // Clear draft saved indicator after 2s
  useEffect(() => {
    if (!draftSavedAt) return;
    const timer = setTimeout(() => setDraftSavedAt(0), 2000);
    return () => clearTimeout(timer);
  }, [draftSavedAt]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(200, textareaRef.current.scrollHeight)}px`;
    }
  }, [content]);

  // Focus textarea on mount for new entries
  useEffect(() => {
    if (!entry) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [entry]);

  // Load existing audio recordings for editing
  useEffect(() => {
    if (entry?.audioIds && entry.audioIds.length > 0) {
      import('./journalStorage').then(({ getAudioForEntry }) => {
        getAudioForEntry(entry.id).then(setAudioRecordings);
      });
    }
  }, [entry]);

  // Append voice transcript to content when dictation stops
  useEffect(() => {
    if (wasListeningRef.current && !voice.isListening && voice.transcript) {
      setContent(prev => {
        const separator = prev && !prev.endsWith('\n') && !prev.endsWith(' ') ? ' ' : '';
        return prev + separator + voice.transcript;
      });
    }
    wasListeningRef.current = voice.isListening;
  }, [voice.isListening, voice.transcript]);

  // Handle completed audio recording — store and add to audioIds
  useEffect(() => {
    if (recorder.audioData && !recorder.isRecording) {
      const storeRecording = async () => {
        try {
          const data = recorder.audioData;
          if (!data) return;
          const audio = await onAddAudio(data, recorder.duration, recorder.mimeType, entryId);
          setAudioIds(prev => [...prev, audio.id]);
          setAudioRecordings(prev => [...prev, audio]);
          recorder.reset();
          setShowRecordingOverlay(false);
          toast.success(ts.journalAudioSaved || 'Audio saved');
        } catch {
          toast.error(ts.journalAudioError || 'Failed to save audio');
          recorder.reset();
        }
      };
      storeRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioData, recorder.isRecording]);

  // Android back button (priority order)
  useEffect(() => {
    if (showUnsavedDialog) return registerModalCloseCallback(() => { setShowUnsavedDialog(false); return true; });
    if (showDeleteConfirm) return registerModalCloseCallback(() => { setShowDeleteConfirm(false); return true; });
    if (showRecordingOverlay) return registerModalCloseCallback(() => { recorder.stop(); setShowRecordingOverlay(false); return true; });
    if (showTemplatePicker) return registerModalCloseCallback(() => { setShowTemplatePicker(false); return true; });
    if (showStickers) return registerModalCloseCallback(() => { setShowStickers(false); return true; });
    if (showPhotos) return registerModalCloseCallback(() => { setShowPhotos(false); return true; });
    if (showMood) return registerModalCloseCallback(() => { setShowMood(false); return true; });
    if (showTags) return registerModalCloseCallback(() => { setShowTags(false); return true; });
  }, [showUnsavedDialog, showDeleteConfirm, showRecordingOverlay, showTemplatePicker, showStickers, showPhotos, showMood, showTags, recorder]);

  // ── Handlers ──

  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      clearDraft(draftKey);
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
        content: content.trim(),
        stickers,
        photoIds,
        audioIds: audioIds.length > 0 ? audioIds : undefined,
        mood,
        tags,
        date,
        habitSnapshot: habitSnapshot.length > 0 ? habitSnapshot : undefined,
      });
      clearDraft(draftKey);
      toast.success(title.trim() ? `"${title.trim().slice(0, 30)}"` : (ts.journalEntrySaved || 'Entry saved'));
      onBack();
    } finally {
      setSaving(false);
    }
  }, [title, content, stickers, photoIds, audioIds, mood, tags, date, onSave, onBack, draftKey, hasContent, ts, voice, recorder, habitSnapshot]);

  const handleSaveAndClose = useCallback(async () => {
    setShowUnsavedDialog(false);
    await handleSave();
  }, [handleSave]);

  const handleDiscard = useCallback(() => {
    clearDraft(draftKey);
    setShowUnsavedDialog(false);
    onBack();
  }, [draftKey, onBack]);

  const handleRestoreDraft = () => {
    if (!draftAvailable) return;
    setTitle(draftAvailable.title);
    setContent(draftAvailable.content);
    setStickers(draftAvailable.stickers);
    setPhotoIds(draftAvailable.photoIds);
    if (draftAvailable.audioIds) setAudioIds(draftAvailable.audioIds);
    setMood(draftAvailable.mood);
    setTags(draftAvailable.tags);
    setDraftAvailable(null);
  };

  const handleDismissDraft = () => {
    clearDraft(draftKey);
    setDraftAvailable(null);
  };

  const handleAddSticker = (sticker: string) => {
    if (stickers.length >= MAX_STICKERS_PER_ENTRY) return;
    setStickers(prev => [...prev, sticker]);
    setShowStickers(false);
  };

  const handleRemoveSticker = (index: number) => {
    setStickers(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPhoto = async (file: File) => {
    try {
      const photo = await onAddPhoto(file, entryId);
      setPhotoIds(prev => [...prev, photo.id]);
    } catch {
      toast.error(ts.journalPhotoError || 'Failed to add photo');
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    await onRemovePhoto(photoId, entryId);
    setPhotoIds(prev => prev.filter(id => id !== photoId));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().replace(/[^a-zA-Z\u0430-\u044f\u0410-\u042f\u0451\u0401\u0456\u0406\u0457\u0407\u0454\u0404\u0491\u04900-9_-]/g, '');
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
    }
    setTagInput('');
    setShowTags(false);
  };

  const handleRemoveAudio = async (audioId: string) => {
    await onRemoveAudio(audioId, entryId);
    setAudioIds(prev => prev.filter(id => id !== audioId));
    setAudioRecordings(prev => prev.filter(a => a.id !== audioId));
  };

  const handleToggleDictation = () => {
    if (voice.isListening) {
      voice.stop();
    } else {
      if (!voice.isSupported) {
        toast.error(ts.journalVoiceNotSupported || 'Speech recognition not supported in this browser');
        return;
      }
      voice.start();
    }
  };

  const handleStartRecording = async () => {
    if (!recorder.isSupported) {
      toast.error(ts.journalVoiceNotSupported || 'Audio recording not supported');
      return;
    }
    if (audioIds.length >= MAX_AUDIO_PER_ENTRY) {
      toast.error(ts.journalAudioMaxReached || `Maximum ${MAX_AUDIO_PER_ENTRY} recordings`);
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
  };

  const handlePromptTap = (prompt: string) => {
    setTitle(prompt);
    setPromptsHidden(true);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background md:bg-background/80 md:backdrop-blur-sm flex items-start justify-center animate-slide-up">
      <div className="w-full h-full flex flex-col md:max-w-2xl md:my-4 md:h-[calc(100%-2rem)] md:rounded-2xl md:bg-background md:shadow-2xl md:border md:border-border/20 md:overflow-hidden">
      {/* Header — frosted glass */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        <div className="relative">
          <button
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Calendar className="w-3 h-3" />
            {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            max={getToday()}
            onChange={e => { if (e.target.value) setDate(e.target.value); }}
            className="sr-only"
            tabIndex={-1}
          />
        </div>

        <div className="flex items-center gap-2">
          {entry && onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={saving || !hasContent}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px]',
              'bg-gradient-to-r from-primary to-primary/90',
              'text-primary-foreground',
              'shadow-[0_2px_10px_rgba(var(--primary-rgb,99,102,241),0.2)]',
              'disabled:opacity-40 disabled:shadow-none transition-all',
            )}
          >
            <Check className="w-4 h-4" />
            {ts.journalSave || 'Save'}
          </motion.button>
        </div>
      </div>

      {/* Draft restore banner */}
      <AnimatePresence>
        {draftAvailable && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mt-2 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs text-foreground flex-1">
                {ts.journalDraftFound || 'Unsaved draft found'}
              </span>
              <button
                onClick={handleRestoreDraft}
                className="text-xs font-medium text-primary px-2 py-1 rounded-lg hover:bg-primary/10 min-h-[32px]"
              >
                {ts.journalRestore || 'Restore'}
              </button>
              <button
                onClick={handleDismissDraft}
                className="p-1 rounded hover:bg-muted/50 min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={ts.journalEntryTitle || 'Title (optional)'}
          className={cn(
            'w-full text-lg font-semibold bg-transparent border-none outline-none',
            'placeholder:text-muted-foreground/40',
          )}
          maxLength={100}
        />

        {/* Writing prompts (new entries only) */}
        {!entry && !content && !title && !promptsHidden && !draftAvailable && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1.5">
                <span className="text-xs">{'\u{270F}\uFE0F'}</span>
                {ts.journalWritingPrompts || 'Writing prompts'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPromptSeed(s => s + 1)}
                  className="p-1.5 rounded-lg hover:bg-muted/50 min-w-[32px] min-h-[32px] flex items-center justify-center"
                  aria-label="Shuffle prompts"
                >
                  <Shuffle className="w-3 h-3 text-muted-foreground/50" />
                </button>
                <button
                  onClick={() => setPromptsHidden(true)}
                  className="p-1 rounded hover:bg-muted/50"
                >
                  <X className="w-3 h-3 text-muted-foreground/50" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {randomPrompts.map((prompt, i) => (
                <motion.button
                  key={`${promptSeed}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
                  onClick={() => handlePromptTap(prompt)}
                  className={cn(
                    'block w-full text-left text-xs px-3.5 py-2.5 rounded-xl min-h-[40px]',
                    'bg-card/60 backdrop-blur-sm',
                    'border border-border/15',
                    'text-muted-foreground/80 hover:text-foreground',
                    'hover:bg-card/80 hover:border-primary/20 hover:shadow-sm',
                    'transition-all duration-200',
                  )}
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Mood display */}
        {mood && (
          <button
            onClick={() => setMood(undefined)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/50 text-xs min-h-[32px]"
          >
            {MOOD_OPTIONS.find(m => m.mood === mood)?.emoji} {mood}
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
                className="px-1.5 py-0.5 rounded-lg hover:bg-muted/50 active:scale-90 transition-transform min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <StickerRenderer emoji={s} size="md" />
              </button>
            ))}
          </div>
        )}

        {/* Photos */}
        {photoIds.length > 0 && (
          <JournalPhotoGallery
            entryId={entryId}
            photoIds={photoIds}
            onRemovePhoto={handleRemovePhoto}
            editable
          />
        )}

        {/* Audio recordings */}
        {audioRecordings.length > 0 && (
          <div className="space-y-1.5">
            {audioRecordings.map(audio => (
              <div key={audio.id} className="flex items-center gap-1.5">
                <div className="flex-1">
                  <JournalAudioPlayer src={audio.data} duration={audio.duration} />
                </div>
                <button
                  onClick={() => handleRemoveAudio(audio.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
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
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                {ts.journalDictating || 'Listening...'}
              </span>
              {voice.transcript && (
                <span className="text-xs text-muted-foreground/60 truncate flex-1">
                  {voice.transcript.slice(-60)}
                </span>
              )}
              <button
                onClick={() => voice.stop()}
                className="p-1 rounded-md hover:bg-red-500/20 min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <Square className="w-3 h-3 text-red-500" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => setTags(prev => prev.filter(t2 => t2 !== tag))}
                className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors min-h-[32px]"
              >
                #{tag} &times;
              </button>
            ))}
          </div>
        )}

        {/* Content textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={ts.journalEntryPlaceholder || "What's on your mind?"}
          className={cn(
            'w-full min-h-[200px] bg-transparent border-none outline-none resize-none',
            'text-sm text-foreground leading-relaxed',
            'placeholder:text-muted-foreground/40',
          )}
        />

        {/* Word count + auto-save indicator */}
        <div className="flex items-center gap-2">
          {wordCount > 0 && (
            <p className="text-[10px] text-muted-foreground/40">
              {wordCount} {ts.journalWords || 'words'}
            </p>
          )}
          <AnimatePresence>
            {draftSavedAt > 0 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] text-green-500/60 flex items-center gap-0.5"
              >
                <Check className="w-2.5 h-2.5" /> {ts.journalDraftSaved || 'Saved'}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Habit tracker section */}
        <JournalHabitSection
          date={date}
          snapshot={habitSnapshot}
          onSnapshotChange={setHabitSnapshot}
        />
      </div>

      {/* Gradient fade above toolbar */}
      <div className="h-6 bg-gradient-to-t from-background via-background/80 to-transparent -mt-6 relative z-[2] pointer-events-none" />

      {/* Bottom toolbar */}
      <div className={cn(
        'border-t border-border/30 bg-background/95 backdrop-blur-xl px-4 py-1.5',
        'flex items-center gap-1',
        'pb-[max(0.375rem,env(safe-area-inset-bottom))]',
      )}>
        <button
          onClick={() => { closeAllPickers(); setShowStickers(true); }}
          disabled={stickers.length >= MAX_STICKERS_PER_ENTRY}
          className={cn(
            'flex-1 py-1 rounded-lg hover:bg-muted/50 transition-colors',
            'disabled:opacity-40',
            'min-h-[44px] flex flex-col items-center justify-center gap-0.5',
          )}
        >
          <Smile className="w-5 h-5 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground/60">{ts.journalToolbarSticker || 'Sticker'}</span>
        </button>

        <button
          onClick={() => { closeAllPickers(); setShowPhotos(true); }}
          disabled={photoIds.length >= MAX_PHOTOS_PER_ENTRY}
          className={cn(
            'flex-1 py-1 rounded-lg hover:bg-muted/50 transition-colors',
            'disabled:opacity-40',
            'min-h-[44px] flex flex-col items-center justify-center gap-0.5',
          )}
        >
          <Camera className="w-5 h-5 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground/60">{ts.journalToolbarPhoto || 'Photo'}</span>
        </button>

        {/* Dictation button */}
        <button
          onClick={handleToggleDictation}
          className={cn(
            'flex-1 py-1 rounded-lg transition-colors',
            'min-h-[44px] flex flex-col items-center justify-center gap-0.5',
            voice.isListening
              ? 'bg-red-500/10'
              : 'hover:bg-muted/50',
          )}
        >
          {voice.isListening ? (
            <MicOff className="w-5 h-5 text-red-500" />
          ) : (
            <Mic className="w-5 h-5 text-muted-foreground" />
          )}
          <span className={cn('text-[9px]', voice.isListening ? 'text-red-500' : 'text-muted-foreground/60')}>
            {voice.isListening ? (ts.journalDictateStop || 'Stop') : (ts.journalToolbarVoice || 'Voice')}
          </span>
        </button>

        {/* Audio recording button */}
        <button
          onClick={handleStartRecording}
          disabled={audioIds.length >= MAX_AUDIO_PER_ENTRY}
          className={cn(
            'flex-1 py-1 rounded-lg hover:bg-muted/50 transition-colors',
            'disabled:opacity-40',
            'min-h-[44px] flex flex-col items-center justify-center gap-0.5',
          )}
        >
          <Circle className="w-5 h-5 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground/60">{ts.journalToolbarRecord || 'Record'}</span>
        </button>

        <button
          onClick={() => { closeAllPickers(); setShowMood(!showMood); }}
          className="flex-1 py-1 rounded-lg hover:bg-muted/50 transition-colors min-h-[44px] flex flex-col items-center justify-center gap-0.5"
        >
          <span className="text-base leading-none">{mood ? MOOD_OPTIONS.find(m => m.mood === mood)?.emoji : '\u{1F3AD}'}</span>
          <span className="text-[9px] text-muted-foreground/60">{ts.journalToolbarMood || 'Mood'}</span>
        </button>

        <button
          onClick={() => { closeAllPickers(); setShowTags(!showTags); }}
          className="flex-1 py-1 rounded-lg hover:bg-muted/50 transition-colors min-h-[44px] flex flex-col items-center justify-center gap-0.5"
        >
          <Hash className="w-5 h-5 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground/60">{ts.journalToolbarTags || 'Tags'}</span>
        </button>
      </div>

      {/* Inline mood picker */}
      {showMood && (
        <div className="border-t border-border/20 bg-background/95 backdrop-blur-xl px-4 py-3 flex items-center justify-center gap-3 pb-[env(safe-area-inset-bottom)]">
          {MOOD_OPTIONS.map(opt => (
            <motion.button
              key={opt.mood}
              whileTap={{ scale: 0.85 }}
              onClick={() => { setMood(mood === opt.mood ? undefined : opt.mood); setShowMood(false); }}
              className={cn(
                'p-2.5 rounded-xl transition-all min-w-[52px] min-h-[52px] flex items-center justify-center',
                mood === opt.mood
                  ? 'bg-primary/15 ring-2 ring-primary/30 shadow-lg animate-scale-bounce'
                  : 'hover:bg-muted/50 hover:shadow-sm',
              )}
            >
              <StickerRenderer emoji={opt.emoji} size="sm" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Inline tag input */}
      {showTags && (
        <div className="border-t border-border/20 bg-background px-4 py-2 pb-[env(safe-area-inset-bottom)]">
          <form onSubmit={e => { e.preventDefault(); handleAddTag(); }} className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              placeholder={ts.journalTagPlaceholder || 'Add tag...'}
              className="flex-1 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/30 text-sm outline-none min-h-[44px]"
              autoFocus
              maxLength={30}
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium min-h-[44px]"
            >
              {ts.journalAdd || 'Add'}
            </button>
          </form>
        </div>
      )}

      {/* Sub-pickers */}
      {showStickers && (
        <JournalStickerPicker
          onSelect={handleAddSticker}
          onClose={() => setShowStickers(false)}
        />
      )}

      {showPhotos && (
        <JournalPhotoPicker
          onSelectFile={file => handleAddPhoto(file)}
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
              setContent(templateContent);
              setPromptsHidden(true);
            }
            setShowTemplatePicker(false);
            setTimeout(() => textareaRef.current?.focus(), 100);
          }}
          onClose={() => {
            setShowTemplatePicker(false);
            setTimeout(() => textareaRef.current?.focus(), 100);
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
            className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card rounded-2xl p-6 max-w-[280px] mx-4 shadow-xl text-center"
            >
              {/* Pulsing circle */}
              <div className="flex justify-center mb-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500/25 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                  </div>
                </motion.div>
              </div>

              <p className="text-sm font-semibold text-foreground mb-1">
                {ts.journalRecording || 'Recording'}
              </p>
              <p className="text-2xl font-mono font-bold text-foreground tabular-nums mb-4">
                {formatRecordingTime(recorder.duration)}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mb-4">
                {ts.journalAudioMaxDuration || 'Max 5 minutes'}
              </p>

              <button
                onClick={handleStopRecording}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-semibold',
                  'bg-red-500 text-white',
                  'flex items-center justify-center gap-2',
                  'active:scale-[0.98] transition-transform min-h-[44px]',
                )}
              >
                <Square className="w-4 h-4" />
                {ts.journalRecordingStop || 'Stop Recording'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center animate-fade-in" onClick={() => setShowDeleteConfirm(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-5 max-w-[300px] mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground mb-2">
              {ts.journalDeleteEntry || 'Delete Entry?'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {ts.journalDeleteConfirm || 'This action cannot be undone.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
              >
                {ts.cancel || 'Cancel'}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); onDelete?.(); }}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium min-h-[44px]"
              >
                {ts.delete || 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Unsaved changes dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center animate-fade-in" onClick={() => setShowUnsavedDialog(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-5 max-w-[300px] mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground mb-2">
              {ts.journalDiscardTitle || 'Unsaved Changes'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {ts.journalDiscardMessage || 'You have unsaved changes.'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSaveAndClose}
                disabled={saving}
                className={cn(
                  'w-full py-2.5 rounded-xl text-sm font-medium min-h-[44px]',
                  'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground',
                  'disabled:opacity-50',
                )}
              >
                {ts.journalSaveClose || 'Save & Close'}
              </button>
              <button
                onClick={handleDiscard}
                className="w-full py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-medium min-h-[44px]"
              >
                {ts.journalDiscard || 'Discard'}
              </button>
              <button
                onClick={() => setShowUnsavedDialog(false)}
                className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
              >
                {ts.journalKeepWriting || 'Keep Writing'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </div>
    </div>
  );
}
