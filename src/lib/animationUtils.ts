// Animation utilities - global dopamine settings checker
// Used by non-React code (audioManager, haptics) to check user preferences
// Also provides standard Framer Motion presets for consistent animations

import { safeLocalStorageGet } from './safeJson';
import { SK } from './storageKeys';

/**
 * Standard Framer Motion animation presets
 * Use these for consistent animations across the app.
 *
 * Usage with framer-motion:
 *   <motion.div {...motionPresets.fadeIn}>...</motion.div>
 *   <motion.div {...motionPresets.slideUp}>...</motion.div>
 */
export const motionPresets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.2 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  modalEnter: {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 300 },
  },
} as const;

/**
 * ZenFlow Motion Tokens — standardized spring physics
 * Use these instead of ad-hoc { type: 'spring', stiffness: X, damping: Y }
 *
 * Usage:
 *   <motion.div transition={zenMotion.snappy}>
 *   <motion.div transition={zenMotion.gentle}>
 */
export const zenMotion = {
  /** Quick response — buttons, toggles, checkboxes (150-200ms feel) */
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },

  /** Smooth entrance — cards, modals, panels (200-300ms feel) */
  gentle: { type: 'spring' as const, stiffness: 260, damping: 25 },

  /** Celebration — achievements, completions (bouncy, 400-800ms feel) */
  bouncy: { type: 'spring' as const, stiffness: 300, damping: 15 },

  /** Exit — always fast, linear (modals closing, toasts dismissing) */
  exit: { duration: 0.15, ease: 'easeIn' as const },

  /** Ambient — breathing, floating loops (slow, infinite) */
  breathing: { duration: 3, ease: 'easeInOut' as const, repeat: Infinity, repeatType: 'reverse' as const },
} as const;

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
  haptics: true,
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

  const parsed = safeLocalStorageGet<DopamineSettings | null>(SK.DOPAMINE_SETTINGS, null);
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
