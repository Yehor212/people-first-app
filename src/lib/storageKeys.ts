/**
 * Central registry for all localStorage and sessionStorage keys.
 *
 * Import `SK` for localStorage keys, `SSK` for sessionStorage keys.
 * Never use raw string keys — always reference this registry.
 *
 * @example
 * import { SK } from '@/lib/storageKeys';
 * storageGetRaw(SK.THEME, 'system');
 * safeLocalStorageSet(SK.TASKS, tasks);
 */

// ─────────────────────────────────────────────
// localStorage keys
// ─────────────────────────────────────────────

export const SK = {
  // ─── Core Data ───
  TASKS: "zenflow_tasks",
  TASK_MOMENTUM: "zenflow_task_momentum",
  INNER_WORLD: "zenflow-inner-world",
  CHALLENGES: "zenflow_challenges",
  LAST_STATE: "zenflow_last_state",
  USER_BIRTH_DATE: "zenflow-user-birth-date",
  SIDEBAR_COLLAPSED: "zenflow_sidebar_collapsed",
  QUESTS: "zenflow_quests",
  OFFLINE_QUEUE: "zenflow_offline_queue",

  // ─── Theme & UI ───
  THEME: "zenflow-theme",
  OLED_MODE: "zenflow_oled_mode",
  FONT_SCALE: "zenflow_font_scale",
  REDUCE_MOTION: "zenflow_reduce_motion",
  LANGUAGE: "zenflow-language",
  LANGUAGE_SELECTED: "zenflow-language-selected",
  PRIVACY: "zenflow-privacy",
  INSIGHTS_COLLAPSED: "zenflow-insights-collapsed",
  FEATURE_FLAGS: "zenflow-feature-flags",
  ANON_ID: "zen-anon-id",
  NAV_V2_LAST_PAGE: "zen-nav-v2-last-page",
  ORB_FIRST_RUN_DISMISSED: "zenflow-orb-first-run-dismissed",
  MOOD_SLIDER_V2_LAST_COMMIT: "zen.moodSliderV2.lastCommit",

  // ─── ADHD Gamification ───
  COMBO_STATE: "zenflow_combo_state",
  DAILY_LOGIN: "zenflow_daily_login",
  LOGIN_STREAK: "zenflow_login_streak",
  LAST_LOGIN: "zenflow_last_login",
  SPIN_TOKENS: "zenflow_spin_tokens",
  MYSTERY_BOXES: "zenflow_mystery_boxes",
  TIME_CHALLENGES: "zenflow_time_challenges",
  ACTIVE_POWERUPS: "zenflow_active_powerups",
  HOME_LAYOUT: "zenflow_home_layout",
  BADGES: "zenflow_badges",
  SPECIAL_BADGES: "zenflow-special-badges",
  DAILY_SURPRISE_SEEN: "zenflow-daily-surprise-seen",
  LAST_SHOWN_STREAK: "zenflow-last-shown-streak",

  // ─── Ads ───
  AD_DAILY_REWARDED: "zenflow-ad-rewarded-count",
  AD_COUNT_DATE: "zenflow-ad-count-date",
  AD_SESSION_COUNT: "zenflow-ad-session-count",
  AD_LAST_SHOWN: "zenflow-ad-last-shown",
  AD_LAST_DISMISS: "zenflow-ad-last-dismiss",
  AD_CONSENT_SHOWN: "zenflow-ad-consent-shown",

  // ─── Timer ───
  TIMER_STATE: "zenflow-timer-state",

  // ─── Journal ───
  JOURNAL_PASSWORD: "journal_password",
  JOURNAL_VAULT_KEY: "journal_vault_key",
  JOURNAL_PASSWORD_COOLDOWN: "journal_password_cooldown",
  JOURNAL_BIOMETRIC: "journal_biometric",
  JOURNAL_REMINDER: "journal_reminder",
  JOURNAL_SCREENSHOT_BLOCK: "journal_screenshot_block",
  JOURNAL_PRIVATE_MODE: "journal_private_mode",
  JOURNAL_AI_SEARCH_CONSENT: "journal_ai_search_consent",
  JOURNAL_LOCK_TIMEOUT: "zenflow-journal-lock-timeout",
  JOURNAL_PASSWORD_RESET: "journal_password_reset_pending",
  JOURNAL_PASSWORD_RESET_PROOF: "journal_password_reset_proof",
  JOURNAL_SECURITY_MIGRATION: "journal_security_migration_v1",
  JOURNAL_SECURITY_REMOVAL: "journal_security_removal_v1",
  JOURNAL_VAULT_REVISION: "journal_vault_revision_v1",
  JOURNAL_CALENDAR_MODE: "journal-calendar-mode",
  JOURNAL_LEGEND_SEEN: "journal-legend-seen",
  JOURNAL_RECENT_STICKERS: "journal-recent-stickers",
  JOURNAL_STICKER_PACKS: "journal-sticker-packs",
  JOURNAL_SIDEBAR_COLLAPSED: "journal-sidebar-collapsed",
  JOURNAL_SIDEBAR_STATE: "journal_sidebar_state",
  JOURNAL_STREAK_FREEZES: "journal-streak-freezes",
  JOURNAL_OTD_DISMISSED: "journal-otd-dismissed",

  // ─── Habit presentation (account-bound because it contains habit IDs) ───
  HABIT_ORDER: "habit-order",

  // ─── Audio ───
  AUDIO_MUTED: "zenflow-audio-muted",
  AUDIO_VOLUME: "zenflow-audio-volume",
  AUDIO_COMFORT: "zenflow-audio-comfort",
  AUDIO_COMFORT_FEEDBACK: "zenflow-audio-comfort-feedback",
  NOTIFICATION_SOUND: "zenflow_notification_sound",
  NOTIFICATION_PRIVATE_CHANNEL_MIGRATION:
    "zenflow_notification_private_channel_migration_v3",
  HAPTICS_ENABLED: "zenflow_haptics_enabled",

  // ─── Feedback & Errors ───
  PENDING_FEEDBACK: "zenflow_pending_feedback",
  FEEDBACK: "zenflow_feedback",
  ERROR_LOG: "zenflow-error-log",
  CRASH_LOG: "zenflow-crash-log",
  RUNTIME_PERF_RECORDER: "zenflow-runtime-perf-recorder",
  SYNC_HEALTH_RECORDER: "zenflow-sync-health-recorder",

  // ─── Insights ───
  INSIGHTS_LAST_GENERATED: "zenflow-insights-last-generated",
  INSIGHTS_DISMISSED: "zenflow-insights-dismissed",

  // ─── Onboarding & Hints ───
  ONBOARDING_STATE: "zenflow_onboarding_state",
  HABIT_SWIPE_HINT_SEEN: "habit-swipe-hint-seen",
  DIARY_FORMAT_HINT_SEEN: "diary-format-hint-seen",
  NOTIFICATION_PERMISSION_ASKED: "notification-permission-asked",
  HABITS_EVER_CREATED: "zenflow-habits-ever-created",

  // ─── Version & Updates ───
  APP_METADATA: "zenflow-app-metadata",
  LAST_SEEN_VERSION: "zenflow_last_seen_version",
  LAST_VERSION_CHECK: "zenflow_last_version_check",
  LEGACY_FEEDBACK_SETTINGS: "zenflow_dopamine_settings",
  LEGACY_FEEDBACK_MIGRATION: "zenflow_legacy_feedback_migration_v1",

  // ─── Social & Friends ───
  FRIENDS: "zenflow_friends",
  MY_FRIEND_PROFILE: "zenflow_my_friend_profile",
  FRIEND_ACTIVITIES: "zenflow_friend_activities",

  // ─── Cloud Sync ───
  CLOUD_SYNC_ENABLED: "zenflow_cloud_sync_enabled",
  DEVICE_ID: "zenflow_device_id",
  DATA_OWNER_ID: "zenflow_data_owner_id",
  ACCOUNT_BOUNDARY_GENERATION: "zenflow_account_boundary_generation",
  // Durable account-boundary intent. This key must stay outside every user-data
  // purge list so an interrupted sign-out can finish after reload.
  PENDING_ACCOUNT_SIGN_OUT_CLEANUP: "zenflow_pending_account_sign_out_cleanup",
  PUSH_INSTALL_ID: "zenflow_push_install_id",
  PUSH_TOKEN: "zenflow_push_token",
  LAST_SYNC_SEQ: "zenflow_last_sync_seq",
  DELTA_SYNC_ENABLED: "zenflow_delta_sync_enabled",
  SYNC_LEADER_LOCK: "zenflow_sync_leader_lock",

  // ─── Coach ───
  COACH_HISTORY: "zenflow_coach_history",
  COACH_ONBOARDING: "zenflow_coach_onboarding",

  // ─── Re-engagement ───
  LAST_ACTIVE_DATE: "zenflow_last_active_date",
  WELCOME_BACK_SHOWN: "zenflow_welcome_back_shown",
  COMEBACK_CHALLENGE: "zenflow_comeback_challenge",
  REVIEW_PROMPT: "zenflow_review_prompt",
  WEEKLY_REPORT: "zenflow-last-weekly-report",

  // ─── Seasonal ───
  SEASONAL_PROGRESS: "zenflow_seasonal_progress",

  // ─── Calendar ───
  CALENDAR_CACHE: "zenflow_calendar_cache",

  // ─── Misc ───
  QUICK_ACTIONS_ENABLED: "zenflow_quick_actions_enabled",
  LEGACY_QUICK_ACTIONS_RETIREMENT: "zenflow_legacy_quick_actions_retirement_v1",
  WIDGET_DATA: "zenflow-widget-data",
  DISMISSED_URGENCY: "zenflow-dismissed-urgency",
  RUNTIME_PERF_DEVICE_GUARD: "zenflow-runtime-perf-device-guard",

  // ─── Dynamic key builders ───
  journalDraft: (id: string) => `journal_draft_${id}`,
  whatsNewDismissed: (version: string) => `zenflow_whats_new_v${version}_dismissed`,
} as const;

// ─────────────────────────────────────────────
// sessionStorage keys
// ─────────────────────────────────────────────

export const SSK = {
  HARD_RELOAD_TS: "zenflow_hard_reload_ts",
  VERSION_CHECK_FLAG: "zenflow_check_version",
  UPDATE_DISMISSED: "zenflow-update-dismissed",
  ORB_RENDERER_SESSION: "zenflow-orb-renderer-session",
  ORB_WEBGL_SLOW_MS: "zenflow-orb-webgl-slow-ms",
  ORB_WEBGL_PREWARMED: "zenflow-orb-webgl-prewarmed",
  RUNTIME_PERF_GUARD: "zenflow-runtime-perf-guard",
  MOOD_ENTRY_DRAFT: "zenflow-mood-entry-draft",
  SPOTIFY_TOKENS: "zenflow_spotify_tokens",
  SPOTIFY_PKCE_VERIFIER: "spotify_pkce_verifier",
  DISMISSED_EVENTS: "zenflow_dismissed_events",
  HABITS_SESSION_CREATED: "zenflow-habits-session-created",

  // Dynamic
  chunkReload: (moduleName: string) => `chunk_reload_${moduleName}`,
} as const;
