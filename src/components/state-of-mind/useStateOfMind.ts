import { useState, useCallback } from 'react';
import { useBackHandler } from '@/hooks/useBackHandler';
import { getToday, generateId } from '@/lib/utils';
import { valenceToMoodType } from './colorUtils';
import type { MoodEntry, MoodLogType } from '@/types';

export type SomStep = 'slider' | 'emotionTags' | 'contexts' | 'note' | 'saving' | 'saved';

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
  const [step, setStep] = useState<SomStep>('slider');
  const [valence, setValence] = useState(0);
  const [logType, setLogType] = useState<MoodLogType>('momentary');
  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const [contexts, setContexts] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // Android back button
  useBackHandler(isOpen, () => {
    if (step === 'slider') {
      handleClose();
    } else {
      handleBack();
    }
  });

  const handleClose = useCallback(() => {
    // Reset state for next open
    setStep('slider');
    setValence(0);
    setLogType('momentary');
    setEmotionTags([]);
    setContexts([]);
    setNote('');
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    const stepOrder: SomStep[] = ['slider', 'emotionTags', 'contexts', 'note'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentIndex + 1]);
    }
  }, [step]);

  const handleBack = useCallback(() => {
    const stepOrder: SomStep[] = ['slider', 'emotionTags', 'contexts', 'note'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    } else {
      handleClose();
    }
  }, [step, handleClose]);

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
    if (step === 'saving' || step === 'saved') return;
    setStep('saving');

    // Sanitize note: trim, remove control chars
    // eslint-disable-next-line no-control-regex
    const sanitizedNote = note.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    const entry: MoodEntry = {
      id: generateId(),
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
    setStep('saved');
  }, [step, valence, logType, emotionTags, contexts, note, onSave]);

  const handleSavedComplete = useCallback(() => {
    handleClose();
  }, [handleClose]);

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
    handleToggleEmotionTag,
    handleToggleContext,
    handleSave,
    handleSavedComplete,
    handleClose,
  };
}
