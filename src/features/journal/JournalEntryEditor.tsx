import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Check, Smile, Camera, Hash, Trash2, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn, getToday } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { registerModalCloseCallback } from '@/lib/androidBackHandler';
import type { JournalEntry, JournalPhoto } from './types';
import type { MoodType } from '@/types';
import { MAX_PHOTOS_PER_ENTRY, MAX_STICKERS_PER_ENTRY } from './types';
import { JournalStickerPicker } from './JournalStickerPicker';
import { JournalPhotoPicker } from './JournalPhotoPicker';
import { JournalPhotoGallery } from './JournalPhotoGallery';

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
  mood?: MoodType;
  tags: string[];
  savedAt: number;
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
    mood?: MoodType;
    tags: string[];
    date?: string;
  }) => Promise<void>;
  onAddPhoto: (file: File, entryId: string) => Promise<JournalPhoto>;
  onRemovePhoto: (photoId: string, entryId: string) => Promise<void>;
  onDelete?: () => void;
  onBack: () => void;
}

export function JournalEntryEditor({
  entry,
  onSave,
  onAddPhoto,
  onRemovePhoto,
  onDelete,
  onBack,
}: JournalEntryEditorProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const draftKey = getDraftKey(entry?.id || null);

  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [stickers, setStickers] = useState<string[]>(entry?.stickers || []);
  const [photoIds, setPhotoIds] = useState<string[]>(entry?.photoIds || []);
  const [mood, setMood] = useState<MoodType | undefined>(entry?.mood);
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [showStickers, setShowStickers] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState<DraftData | null>(null);
  const [promptsHidden, setPromptsHidden] = useState(false);

  const entryId = entry?.id || '__draft__';

  // Initial values for isDirty check
  const initialRef = useRef({
    title: entry?.title || '',
    content: entry?.content || '',
    stickers: JSON.stringify(entry?.stickers || []),
    photoIds: JSON.stringify(entry?.photoIds || []),
    mood: entry?.mood,
    tags: JSON.stringify(entry?.tags || []),
  });

  const isDirty = useMemo(() => {
    const init = initialRef.current;
    return title !== init.title || content !== init.content ||
      JSON.stringify(stickers) !== init.stickers ||
      JSON.stringify(photoIds) !== init.photoIds ||
      mood !== init.mood ||
      JSON.stringify(tags) !== init.tags;
  }, [title, content, stickers, photoIds, mood, tags]);

  const wordCount = useMemo(() => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  const randomPrompts = useMemo(() => {
    const prompts = PROMPT_KEYS.map((key, i) => ts[key] || DEFAULT_PROMPTS[i]);
    const shuffled = [...prompts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasContent = content.trim() || title.trim() || stickers.length > 0 || photoIds.length > 0 || mood;

  // ── Load draft on mount ──
  useEffect(() => {
    const draft = loadDraft(draftKey);
    if (draft) setDraftAvailable(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save draft (3s debounce) ──
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (title || content || stickers.length > 0 || mood || tags.length > 0) {
        saveDraft(draftKey, { title, content, stickers, photoIds, mood, tags, savedAt: Date.now() });
      }
    }, 3000);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [title, content, stickers, photoIds, mood, tags, draftKey]);

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

  // Android back button (priority order)
  useEffect(() => {
    if (showUnsavedDialog) return registerModalCloseCallback(() => { setShowUnsavedDialog(false); return true; });
    if (showDeleteConfirm) return registerModalCloseCallback(() => { setShowDeleteConfirm(false); return true; });
    if (showStickers) return registerModalCloseCallback(() => { setShowStickers(false); return true; });
    if (showPhotos) return registerModalCloseCallback(() => { setShowPhotos(false); return true; });
    if (showMood) return registerModalCloseCallback(() => { setShowMood(false); return true; });
    if (showTags) return registerModalCloseCallback(() => { setShowTags(false); return true; });
  }, [showUnsavedDialog, showDeleteConfirm, showStickers, showPhotos, showMood, showTags]);

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
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        content: content.trim(),
        stickers,
        photoIds,
        mood,
        tags,
        date: entry?.date || getToday(),
      });
      clearDraft(draftKey);
      toast.success(title.trim() ? `"${title.trim().slice(0, 30)}"` : (ts.journalEntrySaved || 'Entry saved'));
      onBack();
    } finally {
      setSaving(false);
    }
  }, [title, content, stickers, photoIds, mood, tags, entry, onSave, onBack, draftKey, hasContent, ts]);

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
    <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-slide-up">
      {/* Header — frosted glass */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        <span className="text-xs text-muted-foreground">
          {entry?.date || getToday()}
        </span>

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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                {ts.journalWritingPrompts || 'Writing prompts'}
              </span>
              <button
                onClick={() => setPromptsHidden(true)}
                className="p-1 rounded hover:bg-muted/50"
              >
                <X className="w-3 h-3 text-muted-foreground/50" />
              </button>
            </div>
            <div className="space-y-1.5">
              {randomPrompts.map((prompt, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => handlePromptTap(prompt)}
                  className="block w-full text-left text-xs text-muted-foreground/70 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-h-[36px]"
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
          <div className="flex gap-1 flex-wrap">
            {stickers.map((s, i) => (
              <button
                key={i}
                onClick={() => handleRemoveSticker(i)}
                className="text-lg px-1.5 py-0.5 rounded hover:bg-muted/50 active:scale-90 transition-transform min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                {s}
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

        {/* Word count */}
        {wordCount > 0 && (
          <p className="text-[10px] text-muted-foreground/40">
            {wordCount} {ts.journalWords || 'words'}
          </p>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className={cn(
        'border-t border-border/30 bg-background/95 backdrop-blur-sm px-4 py-2',
        'flex items-center gap-1',
        'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
      )}>
        <button
          onClick={() => { closeAllPickers(); setShowStickers(true); }}
          disabled={stickers.length >= MAX_STICKERS_PER_ENTRY}
          className={cn(
            'p-2.5 rounded-lg hover:bg-muted/50 transition-colors',
            'disabled:opacity-40',
            'min-w-[44px] min-h-[44px] flex items-center justify-center',
          )}
        >
          <Smile className="w-5 h-5 text-muted-foreground" />
        </button>

        <button
          onClick={() => { closeAllPickers(); setShowPhotos(true); }}
          disabled={photoIds.length >= MAX_PHOTOS_PER_ENTRY}
          className={cn(
            'p-2.5 rounded-lg hover:bg-muted/50 transition-colors',
            'disabled:opacity-40',
            'min-w-[44px] min-h-[44px] flex items-center justify-center',
          )}
        >
          <Camera className="w-5 h-5 text-muted-foreground" />
        </button>

        <button
          onClick={() => { closeAllPickers(); setShowMood(!showMood); }}
          className="p-2.5 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <span className="text-base">{mood ? MOOD_OPTIONS.find(m => m.mood === mood)?.emoji : '\u{1F3AD}'}</span>
        </button>

        <button
          onClick={() => { closeAllPickers(); setShowTags(!showTags); }}
          className="p-2.5 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Hash className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Inline mood picker */}
      {showMood && (
        <div className="border-t border-border/20 bg-background px-4 py-2 flex items-center justify-center gap-2 pb-[env(safe-area-inset-bottom)]">
          {MOOD_OPTIONS.map(opt => (
            <motion.button
              key={opt.mood}
              whileTap={{ scale: 0.9 }}
              onClick={() => { setMood(mood === opt.mood ? undefined : opt.mood); setShowMood(false); }}
              className={cn(
                'text-2xl p-2 rounded-xl transition-all min-w-[48px] min-h-[48px] flex items-center justify-center',
                mood === opt.mood
                  ? 'bg-primary/15 shadow-sm'
                  : 'hover:bg-muted/50',
              )}
            >
              {opt.emoji}
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
  );
}
