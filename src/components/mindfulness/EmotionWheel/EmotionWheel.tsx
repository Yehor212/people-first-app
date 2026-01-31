/**
 * EmotionWheel - Plutchik-based emotion tracker with CIRCULAR WHEEL layout
 * ADHD-friendly: Quick tap selection, 3 intensity levels, instant feedback
 * Replaces the simple 5-emoji MoodTracker with richer emotional tracking
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { MoodEntry, PrimaryEmotion, EmotionIntensity, MoodType } from '@/types';
import { generateId, getToday, cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { moodNoteSchema, sanitizeString } from '@/lib/validation';
import { logger } from '@/lib/logger';
import {
  EMOTION_ORDER,
  EMOTION_EMOJIS,
  INTENSITY_EMOJIS,
  getEmotionColor,
  getEmotionTranslations,
  emotionToMoodType,
  EMOTION_XP,
  EMOTION_WHEEL_POSITIONS,
} from '@/lib/emotionConstants';
import { AnimatedEmotionEmoji } from '@/components/AnimatedEmotionEmoji';
import { Smile, Zap, ChevronRight } from 'lucide-react';

interface EmotionWheelProps {
  entries: MoodEntry[];
  onAddEntry: (entry: MoodEntry) => void;
  onUpdateEntry?: (entry: MoodEntry) => void; // Not used in EmotionWheel but kept for MoodTracker compat
  isPrimaryCTA?: boolean;
}

type ViewState = 'wheel' | 'intensity' | 'note';

export function EmotionWheel({ entries, onAddEntry, isPrimaryCTA = false }: EmotionWheelProps) {
  const { language, t } = useLanguage();
  const [viewState, setViewState] = useState<ViewState>('wheel');
  const [selectedEmotion, setSelectedEmotion] = useState<PrimaryEmotion | null>(null);
  const [selectedIntensity, setSelectedIntensity] = useState<EmotionIntensity>('moderate');
  const [note, setNote] = useState('');

  // Responsive wheel size for 320px viewport support
  const [wheelSize, setWheelSize] = useState(280);

  useEffect(() => {
    const updateWheelSize = () => {
      // On very small screens (320px), use smaller wheel to prevent overflow
      // Page has px-4 (32px) + card has p-5 (40px) = 72px total padding
      // 320 - 72 = 248px available, so use 230px wheel
      setWheelSize(window.innerWidth < 360 ? 230 : 280);
    };
    updateWheelSize();
    window.addEventListener('resize', updateWheelSize);
    return () => window.removeEventListener('resize', updateWheelSize);
  }, []);

  // Calculate radius proportionally to wheel size (105/280 ratio)
  const wheelRadius = useMemo(() => Math.round(wheelSize * 0.375), [wheelSize]);

  const translations = getEmotionTranslations(language);
  const today = getToday();
  const todayMoods = entries.filter(m => m.date === today);
  const todayCount = todayMoods.length;

  // Handle emotion selection
  const handleSelectEmotion = useCallback((emotion: PrimaryEmotion) => {
    setSelectedEmotion(emotion);
    setViewState('intensity');
  }, []);

  // Handle intensity selection
  const handleSelectIntensity = useCallback((intensity: EmotionIntensity) => {
    setSelectedIntensity(intensity);
  }, []);

  // Save entry
  const handleSave = useCallback(() => {
    if (!selectedEmotion) return;

    // Validate and sanitize note
    let sanitizedNote: string | undefined;
    if (note.trim()) {
      const validationResult = moodNoteSchema.safeParse(note);
      if (!validationResult.success) {
        logger.warn('[EmotionWheel] Invalid note:', validationResult.error.message);
        return;
      }
      sanitizedNote = sanitizeString(validationResult.data);
    }

    // Create mood entry with emotion data
    const legacyMood: MoodType = emotionToMoodType(selectedEmotion, selectedIntensity);

    const entry: MoodEntry = {
      id: generateId(),
      mood: legacyMood,
      note: sanitizedNote,
      date: today,
      timestamp: Date.now(),
      emotion: {
        primary: selectedEmotion,
        intensity: selectedIntensity,
      },
    };

    onAddEntry(entry);

    // Reset state
    setSelectedEmotion(null);
    setSelectedIntensity('moderate');
    setNote('');
    setViewState('wheel');
  }, [selectedEmotion, selectedIntensity, note, today, onAddEntry]);

  // Skip note and save directly
  const handleSkipNote = useCallback(() => {
    setNote('');
    handleSave();
  }, [handleSave]);

  // Go to note step
  const handleGoToNote = useCallback(() => {
    setViewState('note');
  }, []);

  // Back button handler
  const handleBack = useCallback(() => {
    if (viewState === 'note') {
      setViewState('intensity');
    } else if (viewState === 'intensity') {
      setViewState('wheel');
      setSelectedEmotion(null);
    }
  }, [viewState]);

  return (
    <div className={cn(
      "rounded-2xl p-5 animate-fade-in transition-all relative overflow-hidden",
      isPrimaryCTA
        ? "bg-gradient-to-br from-primary/15 via-card to-accent/15 ring-2 ring-primary/40 shadow-lg shadow-primary/20"
        : "bg-card zen-shadow-card"
    )}>
      {/* Primary CTA badge */}
      {isPrimaryCTA && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/25 rounded-full border border-primary/30">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">{t.startHere}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {viewState !== 'wheel' && (
            <button
              onClick={handleBack}
              aria-label={t.back || 'Back'}
              className="p-1.5 -ml-1.5 hover:bg-secondary rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}
          <Smile className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-foreground">
            {viewState === 'wheel' && translations.whatDoYouFeel}
            {viewState === 'intensity' && translations.selectIntensity}
            {viewState === 'note' && (t.addNote || 'Add note')}
          </h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {todayCount} {t.today}
        </span>
      </div>

      {/* Wheel View - CIRCULAR layout with 8 emotions */}
      {viewState === 'wheel' && (
        <div className="relative mx-auto" style={{ width: `${wheelSize}px`, height: `${wheelSize}px` }}>
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Smile className="w-7 h-7 sm:w-8 sm:h-8 text-primary/60" />
          </div>

          {/* Emotion buttons in circular layout */}
          {EMOTION_ORDER.map((emotion) => {
            const angle = EMOTION_WHEEL_POSITIONS[emotion];
            const x = Math.sin(angle * Math.PI / 180) * wheelRadius;
            const y = -Math.cos(angle * Math.PI / 180) * wheelRadius;

            return (
              <button
                key={emotion}
                onClick={() => handleSelectEmotion(emotion)}
                aria-label={translations[emotion]}
                className="absolute top-1/2 left-1/2 flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all hover:scale-110 active:scale-95 hover:z-10"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  backgroundColor: getEmotionColor(emotion, 'mild') + '25',
                }}
              >
                <AnimatedEmotionEmoji emotion={emotion} size="md" />
                <span className="text-xs font-medium text-foreground/80 whitespace-nowrap" aria-hidden="true">
                  {translations[emotion]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Intensity View */}
      {viewState === 'intensity' && selectedEmotion && (
        <div className="space-y-4">
          {/* Selected emotion preview with AnimatedEmotionEmoji */}
          <div
            className="flex items-center justify-center gap-3 p-4 rounded-xl"
            style={{ backgroundColor: getEmotionColor(selectedEmotion, selectedIntensity) + '40' }}
          >
            <AnimatedEmotionEmoji
              emotion={selectedEmotion}
              size="xl"
              intensity={selectedIntensity}
              isSelected
            />
            <span className="text-lg font-semibold text-foreground">
              {translations[selectedEmotion]}
            </span>
          </div>

          {/* Intensity buttons */}
          <div className="grid grid-cols-3 gap-2">
            {(['mild', 'moderate', 'intense'] as EmotionIntensity[]).map((intensity) => (
              <button
                key={intensity}
                onClick={() => handleSelectIntensity(intensity)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                  selectedIntensity === intensity
                    ? "ring-2 ring-primary bg-primary/20"
                    : "bg-secondary/50 hover:bg-secondary"
                )}
              >
                <span className="text-xl">{INTENSITY_EMOJIS[intensity]}</span>
                <span className="text-sm font-medium">
                  {translations[intensity]}
                </span>
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSkipNote}
              className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
            >
              {translations.save}
            </button>
            <button
              onClick={handleGoToNote}
              className="flex-1 py-3 zen-gradient text-primary-foreground rounded-xl font-medium"
            >
              + {t.addNote || 'Add note'}
            </button>
          </div>

          {/* XP hint */}
          <p className="text-xs text-center text-muted-foreground">
            +{EMOTION_XP.detailed} XP • {t.addNote ? `+${EMOTION_XP.withNote - EMOTION_XP.detailed} XP ${t.withNote || 'with note'}` : ''}
          </p>
        </div>
      )}

      {/* Note View */}
      {viewState === 'note' && selectedEmotion && (
        <div className="space-y-4">
          {/* Selected emotion preview (smaller) with AnimatedEmotionEmoji */}
          <div
            className="flex items-center gap-2 p-2 rounded-lg"
            style={{ backgroundColor: getEmotionColor(selectedEmotion, selectedIntensity) + '30' }}
          >
            <AnimatedEmotionEmoji emotion={selectedEmotion} size="sm" intensity={selectedIntensity} />
            <span className="text-sm font-medium text-foreground">
              {translations[selectedEmotion]} • {translations[selectedIntensity]}
            </span>
          </div>

          {/* Note input */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.whatsMakingYouFeel || "What's making you feel this way?"}
            className="w-full p-4 bg-secondary rounded-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            rows={3}
            autoFocus
            maxLength={500}
          />

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-semibold"
          >
            {translations.save} (+{EMOTION_XP.withNote} XP)
          </button>
        </div>
      )}

      {/* Recent moods indicator with mini AnimatedEmotionEmojis */}
      {todayCount > 0 && viewState === 'wheel' && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {todayMoods.slice(0, 5).map((mood, i) => (
            <div
              key={mood.id || i}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: mood.emotion
                  ? getEmotionColor(mood.emotion.primary, mood.emotion.intensity) + '40'
                  : 'hsl(var(--muted))'
              }}
            >
              {mood.emotion ? (
                <AnimatedEmotionEmoji emotion={mood.emotion.primary} size="sm" />
              ) : (
                <span className="text-xs">•</span>
              )}
            </div>
          ))}
          {todayCount > 5 && (
            <span className="text-xs text-muted-foreground ml-1">
              +{todayCount - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
