import { useState, useCallback } from 'react';
import { useBackHandler } from '@/hooks/useBackHandler';
import { getToday, generateUuid } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { valenceToMoodType } from './colorUtils';
import type { MoodEntry, MoodLogType } from '@/types';

export type SomStep = 'typeSelect' | 'valence' | 'emotionTags' | 'contextsAndNote' | 'saving';

const STEP_ORDER: SomStep[] = ['typeSelect', 'valence', 'emotionTags', 'contextsAndNote'];

interface UseStateOfMindOptions {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: MoodEntry) => void;
}

/**
 * State machine hook for State of Mind modal flow.
 * Manages: step navigation, valence, emotion tags, contexts, note.
 *
 * Law 14 (State Integrity): State machine prevents impossible states.
 * Android Law: useBackHandler for hardware back button.
 */
export function useStateOfMind({ isOpen, onClose, onSave }: UseStateOfMindOptions) {
  const [step, setStep] = useState<SomStep>('typeSelect');
  const [valence, setValence] = useState(0);
  const [logType, setLogType] = useState<MoodLogType>('momentary');
  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const [contexts, setContexts] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // Android back button
  useBackHandler(isOpen, () => {
    if (step === 'typeSelect') {
      handleClose();
    } else {
      handleBack();
    }
  });

  const handleClose = useCallback(() => {
    // Reset state for next open
    setStep('typeSelect');
    setValence(0);
    setLogType('momentary');
    setEmotionTags([]);
    setContexts([]);
    setNote('');
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[currentIndex + 1]);
    }
  }, [step]);

  const handleBack = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex > 0) {
      setStep(STEP_ORDER[currentIndex - 1]);
    } else {
      handleClose();
    }
  }, [step, handleClose]);

  /** Select log type from type selection screen and advance to valence */
  const handleSelectType = useCallback((type: MoodLogType) => {
    setLogType(type);
    setStep('valence');
  }, []);

  const handleToggleEmotionTag = useCallback((tag: string) => {
    setEmotionTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleToggleContext = useCallback((ctx: string) => {
    setContexts(prev =>
      prev.includes(ctx) ? prev.filter(c => c !== ctx) : [...prev, ctx]
    );
  }, []);

  const handleSave = useCallback(() => {
    // Law 14: Prevent double-click race condition
    if (step === 'saving') return;
    setStep('saving');

    // Sanitize note: trim, remove control chars
    // eslint-disable-next-line no-control-regex
    const sanitizedNote = note.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    const entry: MoodEntry = {
      id: generateUuid(),
      mood: valenceToMoodType(valence), // Backward compat: auto-map valence → MoodType
      date: getToday(),
      timestamp: Date.now(),
      note: sanitizedNote || undefined,
      valence,
      logType,
      emotionTags: emotionTags.length > 0 ? emotionTags : undefined,
      contexts: contexts.length > 0 ? contexts : undefined,
    };

    onSave(entry);
    // Haptic confirmation then immediately close (no animation delay)
    void haptics.moodSaved();
    handleClose();
  }, [step, valence, logType, emotionTags, contexts, note, onSave, handleClose]);

  return {
    step,
    valence,
    setValence,
    logType,
    setLogType,
    emotionTags,
    contexts,
    note,
    setNote,
    handleNext,
    handleBack,
    handleSelectType,
    handleToggleEmotionTag,
    handleToggleContext,
    handleSave,
    handleClose,
  };
}
