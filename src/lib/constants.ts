/**
 * Application Constants
 * Centralized configuration values to replace magic numbers
 * Makes the codebase more maintainable and self-documenting
 */

// ============================================
// TIMING CONSTANTS (in milliseconds)
// ============================================

export const TIMING = {
  /** Interval for checking date/time changes (1 minute) */
  INTERVAL_CHECK: 60_000,

  /** Duration for toast notifications */
  TOAST_DURATION: 2500,

  /** Duration for spin wheel animation */
  SPIN_ANIMATION_DURATION: 4000,

  /** Task momentum timeout - reset after 30 minutes of inactivity */
  MOMENTUM_TIMEOUT: 30 * 60 * 1000,

  /** Animation duration for celebrations */
  CELEBRATION_DURATION: 3000,

  /** Debounce delay for search inputs */
  DEBOUNCE_DELAY: 300,

  /** Auto-save interval */
  AUTO_SAVE_INTERVAL: 5000,
} as const;

// ============================================
// TASK DEFAULTS
// ============================================

export const TASK_DEFAULTS = {
  /** Default task duration in minutes */
  DURATION_MINUTES: 15,

  /** Default interest level (1-10 scale) */
  INTEREST_LEVEL: 5,

  /** Base XP reward for completing a task */
  BASE_XP: 15,

  /** Maximum task duration in minutes */
  MAX_DURATION: 480,

  /** Minimum task duration in minutes */
  MIN_DURATION: 1,

  /** Maximum interest level */
  MAX_INTEREST: 10,

  /** Minimum interest level */
  MIN_INTEREST: 1,
} as const;

// ============================================
// GAMIFICATION CONSTANTS
// ============================================

export const GAMIFICATION = {
  /** Base XP for habits */
  HABIT_BASE_XP: 10,

  /** XP for mood tracking */
  MOOD_XP: 5,

  /** XP for gratitude entries */
  GRATITUDE_XP: 10,

  /** XP per minute of focus session */
  FOCUS_XP_PER_MINUTE: 2,

  /** Streak milestone thresholds for special rewards */
  STREAK_MILESTONES: [3, 5, 7, 14, 21, 30, 60, 90, 100, 365] as readonly number[],

  /** Momentum streak thresholds for sounds */
  MOMENTUM_SOUND_MILESTONES: [3, 5, 10] as readonly number[],
} as const;

// ============================================
// SPIN WHEEL CONSTANTS
// ============================================

export const SPIN_WHEEL = {
  /** Minimum full rotations */
  MIN_ROTATIONS: 5,

  /** Maximum additional random rotations */
  MAX_EXTRA_ROTATIONS: 3,
} as const;

// ============================================
// TIME OF DAY BOUNDARIES (24-hour format)
// ============================================

export const TIME_BOUNDARIES = {
  /** Morning starts at midnight */
  MORNING_START: 0,

  /** Afternoon starts at noon */
  AFTERNOON_START: 12,

  /** Evening starts at 6pm */
  EVENING_START: 18,
} as const;

// ============================================
// UI CONSTANTS
// ============================================

export const UI = {
  /** Minimum touch target size in pixels (accessibility) */
  MIN_TOUCH_TARGET: 48,

  /** Default border radius for cards */
  CARD_RADIUS: 'rounded-2xl',

  /** Default border radius for buttons */
  BUTTON_RADIUS: 'rounded-xl',

  /** Default border radius for modals */
  MODAL_RADIUS: 'rounded-3xl',

  /** Default border radius for inputs */
  INPUT_RADIUS: 'rounded-lg',
} as const;

// ============================================
// ANIMATION DURATIONS (CSS values)
// ============================================

export const ANIMATION = {
  /** Fast transitions (hover effects) */
  FAST: '150ms',

  /** Normal transitions (state changes) */
  NORMAL: '200ms',

  /** Slow transitions (panel opens) */
  SLOW: '300ms',

  /** Default easing function */
  EASING: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ============================================
// STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  TASKS: 'zenflow_tasks',
  MOMENTUM: 'zenflow_task_momentum',
  MOODS: 'zenflow_moods',
  HABITS: 'zenflow_habits',
  GRATITUDE: 'zenflow_gratitude',
  FOCUS_SESSIONS: 'zenflow_focus_sessions',
  SETTINGS: 'zenflow_settings',
  INNER_WORLD: 'zenflow_inner_world',
  CHALLENGES: 'zenflow_challenges',
  THEME: 'zenflow_theme',
} as const;

// ============================================
// LIMITS
// ============================================

export const LIMITS = {
  /** Maximum habits per user */
  MAX_HABITS: 20,

  /** Maximum daily gratitude entries */
  MAX_DAILY_GRATITUDE: 10,

  /** Maximum note length */
  MAX_NOTE_LENGTH: 500,

  /** Maximum task name length */
  MAX_TASK_NAME: 200,
} as const;

// ============================================
// Z-INDEX LAYERS
// Keep consistent with CSS variables in index.css
// ============================================

export const Z_INDEX = {
  /** Dropdowns and tooltips */
  DROPDOWN: 40,

  /** Sticky headers and navigation */
  STICKY: 50,

  /** Overlays (sheets, sidebars) */
  OVERLAY: 60,

  /** Modals and dialogs */
  MODAL: 80,

  /** Toast notifications */
  TOAST: 100,

  /** Celebrations and confetti */
  CELEBRATION: 200,
} as const;

// ============================================
// MODAL SIZES
// Consistent modal widths across the app
// ============================================

export const MODAL_SIZES = {
  /** Small modals (confirmations, alerts) */
  SM: 'max-w-sm',

  /** Medium modals (forms, settings) */
  MD: 'max-w-md',

  /** Large modals (complex content) */
  LG: 'max-w-lg',

  /** Extra large modals (full features) */
  XL: 'max-w-xl',

  /** Full-width modals (stats, reports) */
  FULL: 'max-w-2xl',
} as const;
