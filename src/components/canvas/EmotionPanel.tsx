/**
 * EmotionPanel — Glassmorphic mood selector + optional text input.
 *
 * Anchored above the GrowingEdge endpoint.
 * State 1: 5 mood buttons (lucide-react icons only — no system emojis).
 * State 2: Selected mood highlighted, text input revealed, Save/Cancel buttons.
 *
 * On Save: calls onSave(mood, text?) → parent wires to handleAddMood + journal.
 * On Cancel: calls onCancel → parent sets canvasMode to 'idle'.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, SmilePlus, Meh, Frown, Angry, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { zenMotion } from '@/lib/animationUtils';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MoodType } from '@/types';

interface EmotionPanelProps {
  isVisible: boolean;
  /** Absolute position (center X) in canvas coordinates */
  anchorX: number;
  /** Absolute position (top Y) in canvas coordinates */
  anchorY: number;
  onSave: (mood: MoodType, text?: string) => void;
  onCancel: () => void;
}

const MOODS: { mood: MoodType; Icon: typeof Smile; label: string; color: string }[] = [
  { mood: 'great', Icon: SmilePlus, label: 'Great', color: 'text-emerald-400 hover:bg-emerald-400/20' },
  { mood: 'good', Icon: Smile, label: 'Good', color: 'text-teal-400 hover:bg-teal-400/20' },
  { mood: 'okay', Icon: Meh, label: 'Okay', color: 'text-amber-400 hover:bg-amber-400/20' },
  { mood: 'bad', Icon: Frown, label: 'Bad', color: 'text-orange-400 hover:bg-orange-400/20' },
  { mood: 'terrible', Icon: Angry, label: 'Terrible', color: 'text-red-400 hover:bg-red-400/20' },
];

const SELECTED_BG: Record<MoodType, string> = {
  great: 'bg-emerald-400/20 ring-2 ring-emerald-400/50',
  good: 'bg-teal-400/20 ring-2 ring-teal-400/50',
  okay: 'bg-amber-400/20 ring-2 ring-amber-400/50',
  bad: 'bg-orange-400/20 ring-2 ring-orange-400/50',
  terrible: 'bg-red-400/20 ring-2 ring-red-400/50',
};

const PANEL_WIDTH = 280;

export function EmotionPanel({ isVisible, anchorX, anchorY, onSave, onCancel }: EmotionPanelProps) {
  const { t } = useLanguage();
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [text, setText] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      setSelectedMood(null);
      setText('');
    }
  }, [isVisible]);

  // a11y: Escape key + Android back button
  const { modalProps } = useModalA11y(isVisible, onCancel);

  const handleMoodSelect = useCallback((mood: MoodType) => {
    void haptics.light();
    setSelectedMood(mood);
    // Auto-focus text input after mood selection
    setTimeout(() => textRef.current?.focus(), 100);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedMood) return;
    void haptics.buttonPress();
    onSave(selectedMood, text.trim() || undefined);
  }, [selectedMood, text, onSave]);

  const handleCancel = useCallback(() => {
    void haptics.light();
    onCancel();
  }, [onCancel]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 10 }}
          transition={zenMotion.gentle}
          className="absolute z-30"
          style={{
            left: anchorX - PANEL_WIDTH / 2,
            top: anchorY - 20,
            width: PANEL_WIDTH,
          }}
          {...modalProps}
        >
          <div
            className={cn(
              'rounded-2xl p-4',
              'border border-white/10',
              'shadow-zen-lg',
              'bg-[var(--surface-glass)] backdrop-blur-[var(--surface-glass-blur,20px)] [-webkit-backdrop-filter:blur(var(--surface-glass-blur,20px))]',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleCancel}
              className="absolute top-2 end-2 p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t.close || 'Close'}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Mood buttons row */}
            <div className="flex items-center justify-center gap-2 mb-3">
              {MOODS.map(({ mood, Icon, label, color }) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => handleMoodSelect(mood)}
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200',
                    color,
                    selectedMood === mood && SELECTED_BG[mood],
                    !selectedMood && 'hover:scale-110',
                  )}
                  aria-label={t[mood] || label}
                  aria-pressed={selectedMood === mood}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>

            {/* Text input + actions (revealed after mood selection) */}
            <AnimatePresence>
              {selectedMood && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <textarea
                    ref={textRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t.moodNotes || "What's on your mind?"}
                    rows={2}
                    className={cn(
                      'w-full rounded-xl px-3 py-2 mb-3',
                      'bg-white/5 border border-white/10',
                      'text-white text-sm placeholder:text-white/30',
                      'resize-none',
                      'focus:outline-none focus:ring-1 focus:ring-white/20',
                    )}
                    maxLength={500}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-sm font-medium',
                        'bg-emerald-500/80 text-white',
                        'hover:bg-emerald-500 transition-colors',
                      )}
                    >
                      {t.save || 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm',
                        'text-white/50 hover:text-white/70',
                        'hover:bg-white/5 transition-colors',
                      )}
                    >
                      {t.cancel || 'Cancel'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { type EmotionPanelProps };
