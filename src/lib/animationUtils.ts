// Animation utilities - global dopamine settings checker
// Used by non-React code (audioManager, haptics) to check user preferences

import { safeJsonParse } from './safeJson';

const DOPAMINE_STORAGE_KEY = 'zenflow_dopamine_settings';

interface DopamineSettings {
  intensity: 'minimal' | 'normal' | 'adhd';
  animations: boolean;
  sounds: boolean;
  haptics: boolean;
  confetti: boolean;
  streakFire: boolean;
  moodDrivenUI: boolean;
}

const DEFAULT_DOPAMINE_SETTINGS: DopamineSettings = {
  intensity: 'normal',
  animations: true,
  sounds: true,
  haptics: false,
  confetti: true,
  streakFire: true,
  moodDrivenUI: true,
};

/**
 * Get current dopamine settings from localStorage
 * Works in non-React contexts (audioManager, haptics, etc.)
 */
export function getDopamineSettings(): DopamineSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_DOPAMINE_SETTINGS;
  }

  const stored = localStorage.getItem(DOPAMINE_STORAGE_KEY);
  if (!stored) {
    return DEFAULT_DOPAMINE_SETTINGS;
  }

  const parsed = safeJsonParse<DopamineSettings | null>(stored, null);
  return parsed ? { ...DEFAULT_DOPAMINE_SETTINGS, ...parsed } : DEFAULT_DOPAMINE_SETTINGS;
}

/**
 * Check if animations should be shown
 * Respects both user preference and system prefers-reduced-motion
 */
export function shouldAnimate(): boolean {
  const settings = getDopamineSettings();

  // Check user preference first
  if (!settings.animations) {
    return false;
  }

  // Check system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return false;
    }
  }

  return true;
}

/**
 * Check if sounds should play
 */
export function shouldPlaySounds(): boolean {
  return getDopamineSettings().sounds;
}

/**
 * Check if haptic feedback should trigger
 */
export function shouldTriggerHaptics(): boolean {
  return getDopamineSettings().haptics;
}

/**
 * Check if confetti should show
 */
export function shouldShowConfetti(): boolean {
  return getDopamineSettings().confetti;
}

/**
 * Check if streak fire animation should show
 */
export function shouldShowStreakFire(): boolean {
  return getDopamineSettings().streakFire;
}

/**
 * Check if mood-driven UI effects should show
 * This controls dynamic theming based on user's mood
 */
export function shouldShowMoodEffects(): boolean {
  return getDopamineSettings().moodDrivenUI;
}

/**
 * Apply or remove reduce-motion class on document body
 * Call this when dopamine settings change
 */
export function applyReduceMotionClass(): void {
  if (typeof document === 'undefined') return;

  const animate = shouldAnimate();

  if (animate) {
    document.body.classList.remove('reduce-motion');
  } else {
    document.body.classList.add('reduce-motion');
  }
}

/**
 * Apply or remove mood-disabled class on document body
 * Call this when dopamine settings change
 */
export function applyMoodDisabledClass(): void {
  if (typeof document === 'undefined') return;

  const showMood = shouldShowMoodEffects();

  if (showMood) {
    document.body.classList.remove('mood-disabled');
  } else {
    document.body.classList.add('mood-disabled');
  }
}
