import { useState, useMemo } from 'react';
import { safeParseInt } from '@/lib/validation';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TimerState } from './focusTimerTypes';
import { DEFAULT_FOCUS_MINUTES, DEFAULT_BREAK_MINUTES } from './focusTimerTypes';

/**
 * Sub-hook for focus timer preset and configuration state management.
 * Manages preset selection, focus/break minutes, and input validation.
 */
export function useFocusTimerConfig(savedState: TimerState | null) {
  const { t } = useLanguage();

  // Config state
  const [preset, setPreset] = useState<'25' | '50' | 'custom'>(savedState?.preset || '25');
  const [focusMinutes, setFocusMinutes] = useState(savedState?.focusMinutes || DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(savedState?.breakMinutes || DEFAULT_BREAK_MINUTES);
  const [savedCustomFocus, setSavedCustomFocus] = useState(savedState?.focusMinutes || 30);
  const [savedCustomBreak, setSavedCustomBreak] = useState(savedState?.breakMinutes || DEFAULT_BREAK_MINUTES);
  const [focusInputValue, setFocusInputValue] = useState(String(focusMinutes));
  const [breakInputValue, setBreakInputValue] = useState(String(breakMinutes));

  // Derived durations
  const focusDuration = focusMinutes * 60;
  const breakDuration = breakMinutes * 60;

  const presets = useMemo(() => ([
    { key: '25' as const, label: t.focusPreset25, focus: 25, break: 5 },
    { key: '50' as const, label: t.focusPreset50, focus: 50, break: 10 },
    { key: 'custom' as const, label: t.focusPresetCustom, focus: focusMinutes, break: breakMinutes },
  ]), [t, focusMinutes, breakMinutes]);

  const handlePresetSelect = (key: '25' | '50' | 'custom') => {
    if (preset === 'custom' && key !== 'custom') {
      setSavedCustomFocus(focusMinutes);
      setSavedCustomBreak(breakMinutes);
    }

    setPreset(key);
    if (key === '25') {
      setFocusMinutes(25);
      setBreakMinutes(5);
      setFocusInputValue('25');
      setBreakInputValue('5');
    } else if (key === '50') {
      setFocusMinutes(50);
      setBreakMinutes(10);
      setFocusInputValue('50');
      setBreakInputValue('10');
    } else if (key === 'custom') {
      setFocusMinutes(savedCustomFocus);
      setBreakMinutes(savedCustomBreak);
      setFocusInputValue(String(savedCustomFocus));
      setBreakInputValue(String(savedCustomBreak));
    }
  };

  const handleFocusInputBlur = (value: string) => {
    const validated = safeParseInt(value, 25, 5, 120);
    setFocusMinutes(validated);
    setSavedCustomFocus(validated);
    setFocusInputValue(String(validated));
  };

  const handleBreakInputBlur = (value: string) => {
    const validated = safeParseInt(value, 5, 1, 60);
    setBreakMinutes(validated);
    setSavedCustomBreak(validated);
    setBreakInputValue(String(validated));
  };

  return {
    t,
    preset, setPreset,
    focusMinutes, setFocusMinutes,
    breakMinutes, setBreakMinutes,
    focusInputValue, setFocusInputValue,
    breakInputValue, setBreakInputValue,
    focusDuration, breakDuration,
    presets,
    handlePresetSelect,
    handleFocusInputBlur,
    handleBreakInputBlur,
  };
}
