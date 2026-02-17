import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── In-memory storage mock ────────────────────────────────────
let mockStorage: Record<string, unknown> = {};

vi.mock('../safeJson', () => ({
  safeLocalStorageGet: vi.fn(<T>(key: string, defaultValue: T): T => {
    return key in mockStorage ? (mockStorage[key] as T) : defaultValue;
  }),
}));

vi.mock('../storageKeys', () => ({
  SK: { DOPAMINE_SETTINGS: 'zenflow_dopamine_settings' },
}));

// ─── matchMedia mock ───────────────────────────────────────────
const mockMatchMedia = vi.fn().mockReturnValue({ matches: false });
Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, writable: true });

import {
  motionPresets,
  getDopamineSettings,
  shouldAnimate,
  shouldPlaySounds,
  shouldTriggerHaptics,
  shouldShowConfetti,
  shouldShowStreakFire,
  shouldShowMoodEffects,
  applyReduceMotionClass,
  applyMoodDisabledClass,
} from '../animationUtils';

// ─── Setup ─────────────────────────────────────────────────────

beforeEach(() => {
  mockStorage = {};
  mockMatchMedia.mockReturnValue({ matches: false });
  document.body.classList.remove('reduce-motion', 'mood-disabled');
  vi.clearAllMocks();
});

// ============================================================
// motionPresets
// ============================================================
describe('motionPresets', () => {
  it('has fadeIn preset with initial/animate/transition', () => {
    expect(motionPresets.fadeIn).toHaveProperty('initial');
    expect(motionPresets.fadeIn).toHaveProperty('animate');
    expect(motionPresets.fadeIn).toHaveProperty('transition');
  });

  it('has slideUp preset with y offset', () => {
    expect(motionPresets.slideUp.initial).toHaveProperty('y', 20);
    expect(motionPresets.slideUp.animate).toHaveProperty('y', 0);
  });

  it('has scaleIn preset with scale', () => {
    expect(motionPresets.scaleIn.initial).toHaveProperty('scale', 0.95);
    expect(motionPresets.scaleIn.animate).toHaveProperty('scale', 1);
  });

  it('has modalEnter preset with spring transition', () => {
    expect(motionPresets.modalEnter.transition).toHaveProperty('type', 'spring');
    expect(motionPresets.modalEnter.transition).toHaveProperty('damping', 25);
    expect(motionPresets.modalEnter.transition).toHaveProperty('stiffness', 300);
  });
});

// ============================================================
// getDopamineSettings
// ============================================================
describe('getDopamineSettings', () => {
  it('returns defaults when nothing stored', () => {
    const settings = getDopamineSettings();
    expect(settings.intensity).toBe('normal');
    expect(settings.animations).toBe(true);
    expect(settings.sounds).toBe(true);
    expect(settings.haptics).toBe(true);
    expect(settings.confetti).toBe(true);
    expect(settings.streakFire).toBe(true);
    expect(settings.moodDrivenUI).toBe(true);
  });

  it('merges stored settings with defaults', () => {
    mockStorage['zenflow_dopamine_settings'] = { animations: false, intensity: 'adhd' };
    const settings = getDopamineSettings();
    expect(settings.animations).toBe(false);
    expect(settings.intensity).toBe('adhd');
    // Unset fields keep defaults
    expect(settings.sounds).toBe(true);
    expect(settings.haptics).toBe(true);
  });

  it('returns full defaults when stored value is null', () => {
    mockStorage['zenflow_dopamine_settings'] = null;
    const settings = getDopamineSettings();
    expect(settings.animations).toBe(true);
  });
});

// ============================================================
// shouldAnimate
// ============================================================
describe('shouldAnimate', () => {
  it('returns true when animations enabled and no reduced motion', () => {
    expect(shouldAnimate()).toBe(true);
  });

  it('returns false when animations disabled in settings', () => {
    mockStorage['zenflow_dopamine_settings'] = { animations: false };
    expect(shouldAnimate()).toBe(false);
  });

  it('returns false when prefers-reduced-motion is set', () => {
    mockMatchMedia.mockReturnValue({ matches: true });
    expect(shouldAnimate()).toBe(false);
  });

  it('checks matchMedia with correct media query', () => {
    shouldAnimate();
    expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});

// ============================================================
// shouldPlaySounds
// ============================================================
describe('shouldPlaySounds', () => {
  it('returns true by default', () => {
    expect(shouldPlaySounds()).toBe(true);
  });

  it('returns false when sounds disabled', () => {
    mockStorage['zenflow_dopamine_settings'] = { sounds: false };
    expect(shouldPlaySounds()).toBe(false);
  });
});

// ============================================================
// shouldTriggerHaptics
// ============================================================
describe('shouldTriggerHaptics', () => {
  it('returns true by default', () => {
    expect(shouldTriggerHaptics()).toBe(true);
  });

  it('returns false when haptics disabled', () => {
    mockStorage['zenflow_dopamine_settings'] = { haptics: false };
    expect(shouldTriggerHaptics()).toBe(false);
  });
});

// ============================================================
// shouldShowConfetti
// ============================================================
describe('shouldShowConfetti', () => {
  it('returns true by default', () => {
    expect(shouldShowConfetti()).toBe(true);
  });

  it('returns false when confetti disabled', () => {
    mockStorage['zenflow_dopamine_settings'] = { confetti: false };
    expect(shouldShowConfetti()).toBe(false);
  });
});

// ============================================================
// shouldShowStreakFire
// ============================================================
describe('shouldShowStreakFire', () => {
  it('returns true by default', () => {
    expect(shouldShowStreakFire()).toBe(true);
  });

  it('returns false when streakFire disabled', () => {
    mockStorage['zenflow_dopamine_settings'] = { streakFire: false };
    expect(shouldShowStreakFire()).toBe(false);
  });
});

// ============================================================
// shouldShowMoodEffects
// ============================================================
describe('shouldShowMoodEffects', () => {
  it('returns true by default', () => {
    expect(shouldShowMoodEffects()).toBe(true);
  });

  it('returns false when moodDrivenUI disabled', () => {
    mockStorage['zenflow_dopamine_settings'] = { moodDrivenUI: false };
    expect(shouldShowMoodEffects()).toBe(false);
  });
});

// ============================================================
// applyReduceMotionClass
// ============================================================
describe('applyReduceMotionClass', () => {
  it('removes reduce-motion class when animations are on', () => {
    document.body.classList.add('reduce-motion');
    applyReduceMotionClass();
    expect(document.body.classList.contains('reduce-motion')).toBe(false);
  });

  it('adds reduce-motion class when animations are off', () => {
    mockStorage['zenflow_dopamine_settings'] = { animations: false };
    applyReduceMotionClass();
    expect(document.body.classList.contains('reduce-motion')).toBe(true);
  });

  it('adds reduce-motion class when prefers-reduced-motion matches', () => {
    mockMatchMedia.mockReturnValue({ matches: true });
    applyReduceMotionClass();
    expect(document.body.classList.contains('reduce-motion')).toBe(true);
  });
});

// ============================================================
// applyMoodDisabledClass
// ============================================================
describe('applyMoodDisabledClass', () => {
  it('removes mood-disabled class when mood effects are on', () => {
    document.body.classList.add('mood-disabled');
    applyMoodDisabledClass();
    expect(document.body.classList.contains('mood-disabled')).toBe(false);
  });

  it('adds mood-disabled class when moodDrivenUI is off', () => {
    mockStorage['zenflow_dopamine_settings'] = { moodDrivenUI: false };
    applyMoodDisabledClass();
    expect(document.body.classList.contains('mood-disabled')).toBe(true);
  });
});
