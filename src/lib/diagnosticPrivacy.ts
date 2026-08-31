/**
 * Privacy boundary for diagnostics and evidence.
 *
 * Caller-provided strings are private by default. Sinks receive a fixed code,
 * a bounded metadata allowlist, and only the finite presence of a stack.
 */

export const DIAGNOSTIC_REDACTED = "[REDACTED]";

const MAX_DEPTH = 3;
const MAX_KEYS = 20;
const MAX_ARRAY_ITEMS = 10;
const MAX_IDENTIFIER_LENGTH = 80;

const SAFE_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "AggregateError",
  "AbortError",
  "DOMException",
]);

// Exact source labels present at production logger call sites. Unknown labels
// intentionally collapse to the caller's fixed fallback so private bracketed
// text cannot become part of a diagnostic code.
const SAFE_DIAGNOSTIC_SUBSYSTEMS = new Set([
  "A11y",
  "AICoach",
  "API",
  "Account",
  "AccountCleanup",
  "AccountSection",
  "AccountService",
  "Ads",
  "AmbientSounds",
  "Analytics",
  "AnalyticsBoundary",
  "AndroidBackHandler",
  "android-day-effects",
  "AppBackgroundMusic",
  "AppInit",
  "AppUpdate",
  "AppVersion",
  "Audio",
  "AudioLifecycle",
  "AudioManager",
  "AudioMediaSession",
  "AudioPlaybackCoordinator",
  "Automation",
  "AutomationHistory",
  "AutomationRuntime",
  "Auth",
  "AuthGate",
  "AuthGuard",
  "AuthStateManager",
  "AuthTransition",
  "AuthScreen",
  "BadgesSync",
  "Broadcast",
  "Calendar",
  "Challenge",
  "ChallengeService",
  "ChallengesSync",
  "ChunkError",
  "ClaudeAgent",
  "CloudSync",
  "Crash",
  "CrashCustomKey",
  "CrashIdentity",
  "CrashReporting",
  "CrashRetention",
  "DB",
  "DND",
  "DatabaseRecovery",
  "DeepLink",
  "DeepLinks",
  "DeletionTracker",
  "DeltaSync",
  "ErrorBoundary",
  "ErrorBoundaryRetention",
  "ErrorBuffer",
  "ErrorBufferSink",
  "EventSync",
  "Export",
  "Feedback",
  "FeedbackService",
  "FloatingMediaLayer",
  "Focus",
  "FocusTimer",
  "FeatureFlags",
  "FriendChallenge",
  "FriendsSync",
  "Gamification",
  "GapDetector",
  "Global",
  "Gratitude",
  "Habits",
  "HabitCelebration",
  "Haptics",
  "HyperfocusMode",
  "Index",
  "Init",
  "InnerWorld",
  "Import",
  "Journal",
  "JournalAI",
  "JournalHub",
  "JournalImport",
  "JournalPhotoPicker",
  "JournalSaveCeremony",
  "JournalSearch",
  "JournalSettings",
  "JournalSync",
  "Language",
  "LazyLoad",
  "Leaderboard",
  "Main",
  "Migration",
  "ModalErrorBoundary",
  "Mood",
  "MoodTracker",
  "NativeAuth",
  "NavV2",
  "Network",
  "NotificationSounds",
  "Notifications",
  "OfflineQueue",
  "Onboarding",
  "OnboardingFlow",
  "OrbPage",
  "Planning",
  "PreferenceSync",
  "Presence",
  "PremiumIcon",
  "PWA",
  "Pull",
  "PullToRefresh",
  "Push",
  "QuestsSync",
  "RateLimiter",
  "ReEngagement",
  "Realtime",
  "ReminderSync",
  "Review",
  "SW",
  "SafeJSON",
  "Schedule",
  "ScheduleTimeline",
  "Schema",
  "SeasonalEvents",
  "Sentry",
  "SessionTimeout",
  "Settings",
  "ShareActions",
  "ShareCardRenderer",
  "Splash",
  "Spotify",
  "Storage",
  "StorageErrorBanner",
  "Supabase",
  "Sync",
  "SyncCursor",
  "SyncGap",
  "SyncIntegrity",
  "SyncLeader",
  "SyncOrchestrator",
  "SyncPoke",
  "TasksSync",
  "Theme",
  "UpdatePrompt",
  "UpdateRequired",
  "V2 Habits",
  "V2Settings",
  "VersionCheck",
  "Vite",
  "WelcomeBack",
  "WhatsNew",
  "Widget",
  "designFlagStore",
  "habitMigration",
  "habitCompletionCommit",
  "reminderPersistence",
  "rewardUser",
  "settingsPreferencePersistence",
  "useAudioRecorder",
  "useDnd",
  "useHydrateUserData",
  "useIndexedDB",
  "useInsights",
  "useJournalVoice",
  "useShareFlow",
]);

const SAFE_FIXED_DIAGNOSTIC_CODES = new Set([
  ...[...SAFE_DIAGNOSTIC_SUBSYSTEMS].map(
    (subsystem) => `ZF_${subsystem.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_DIAGNOSTIC`
  ),
  "ZF_AUTH_DIAGNOSTIC",
  "ZF_CRASH_RECORDED",
  "ZF_CWV_LOAD_FAILED",
  "ZF_FRAMEWORK_CONSOLE_ERROR",
  "ZF_FRAMEWORK_CONSOLE_WARNING",
  "ZF_LOAF_OBSERVER_FAILED",
  "ZF_RUNTIME_DIAGNOSTIC",
  "ZF_RUNTIME_ERROR",
  "ZF_SENTRY_BREADCRUMB",
  "ZF_SENTRY_EVENT",
  "ZF_SENTRY_EXCEPTION",
  "ZF_SYNC_DIAGNOSTIC",
]);

const SAFE_ROUTE_LABELS = new Set([
  "auth",
  "desktop",
  "diary",
  "focus",
  "habits",
  "home",
  "orb",
  "planning",
  "settings",
  "stats",
]);

const STRING_METADATA_KEYS = new Set([
  "action",
  "area",
  "category",
  "code",
  "component",
  "contenttype",
  "context",
  "entitytype",
  "errorcode",
  "errorname",
  "errortype",
  "event",
  "feature",
  "kind",
  "language",
  "level",
  "isnative",
  "operation",
  "parentspanid",
  "phase",
  "platform",
  "reason",
  "route",
  "source",
  "stackfingerprint",
  "state",
  "status",
  "spanid",
  "traceid",
  "type",
  "version",
]);

const GROUP_METADATA_KEYS = new Set([
  "auth",
  "coach",
  "diagnostic",
  "metadata",
  "network",
  "runtime",
  "storage",
  "sync",
  "trace",
]);

const REDACTED_METADATA_KEYS = new Set([
  "accesstoken",
  "audiotranscript",
  "authorization",
  "callback",
  "cause",
  "componentstack",
  "content",
  "cookie",
  "credential",
  "detail",
  "diary",
  "email",
  "entry",
  "habits",
  "identity",
  "idtoken",
  "journalentry",
  "label",
  "location",
  "message",
  "moodnote",
  "name",
  "nested",
  "note",
  "notes",
  "original",
  "password",
  "phone",
  "prompt",
  "query",
  "recoverysecret",
  "reflectiontext",
  "refreshtoken",
  "response",
  "secret",
  "sessiontoken",
  "stack",
  "text",
  "title",
  "token",
  "transcript",
  "url",
  "user",
  "userid",
]);

const NUMERIC_OR_BOOLEAN_METADATA_KEYS = new Set([
  "attempt",
  "attempts",
  "available",
  "buffered",
  "bytes",
  "count",
  "duration",
  "durationminutes",
  "elapsed",
  "enabled",
  "everfirst",
  "first",
  "isnative",
  "item",
  "items",
  "length",
  "max",
  "minutes",
  "ms",
  "native",
  "pending",
  "ready",
  "recordcount",
  "responsebodybytes",
  "responsestatus",
  "retries",
  "retrycount",
  "safecount",
  "seq",
  "sessionfirst",
  "size",
  "success",
  "total",
  "totalhabits",
]);

const SAFE_METADATA_KEYS = new Set([
  ...STRING_METADATA_KEYS,
  ...GROUP_METADATA_KEYS,
  ...REDACTED_METADATA_KEYS,
  ...NUMERIC_OR_BOOLEAN_METADATA_KEYS,
]);

const SAFE_STRING_VALUES: Readonly<Record<string, ReadonlySet<string>>> = {
  area: new Set(["auth", "cache", "network", "storage", "sync"]),
  category: new Set([
    "audio",
    "cache",
    "general",
    "network",
    "storage",
    "sync",
    "version-mismatch",
  ]),
  contenttype: new Set([
    "application/json",
    "audio/aac",
    "audio/m4a",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  component: new Set(["ErrorBoundary", "ModalErrorBoundary", "SettingsPage", "ValenceOrb"]),
  context: new Set(["modal", "ModalErrorBoundary"]),
  errorcode: new Set(["coach-timeout"]),
  errorname: new Set([...SAFE_ERROR_NAMES, "UnknownError"]),
  errortype: new Set(["abort", "chunk_load", "database_deleted"]),
  isnative: new Set(["no", "yes"]),
  language: new Set(["ar", "de", "en", "es", "fr", "he", "ja", "uk"]),
  level: new Set(["debug", "error", "fatal", "info", "log", "warning"]),
  operation: new Set(["journal-save"]),
  platform: new Set(["android", "desktop", "ios", "pwa", "tauri", "web"]),
  reason: new Set(["abort", "site_data_unavailable", "version_mismatch"]),
  route: SAFE_ROUTE_LABELS,
  source: new Set([
    "boot",
    "capacitor",
    "cloud",
    "local",
    "native",
    "react",
    "storage",
    "sync",
    "tauri",
    "test",
    "web",
  ]),
  state: new Set(["active", "cleared", "disabled", "enabled", "inactive", "set"]),
  status: new Set([
    "aborted",
    "active",
    "failed",
    "ok",
    "pending",
    "success",
    "timeout",
    "unavailable",
  ]),
  type: new Set(["recoverable", "runtime", "uncaught", "unhandledrejection"]),
};

const NUMERIC_OR_BOOLEAN_KEY_PATTERN =
  /(?:attempts?|available|buffered|bytes|count|duration|elapsed|enabled|everfirst|first|items?|length|max|minutes?|ms|native|pending|ready|recordcount|responsebodybytes|responsestatus|retries|retrycount|safecount|seq|sessionfirst|size|success|total|totalhabits)$/;

const SENSITIVE_KEY_PATTERN =
  /(?:auth|body|componentstack|content|cookie|credential|diary|email|entry|habit|hash|identity|journal|location|message|mood|name|note|password|phone|prompt|query|response|secret|session|stack|text|title|token|transcript|url|user)/;

const CONTENT_DERIVED_NUMERIC_KEY_PATTERN =
  /(?:diary|habit|identity|journal|mood|responsebody|user)/;

function normalizedKey(key: string): string {
  return typeof key === "string" ? key.replace(/[^a-z0-9]/gi, "").toLowerCase() : "";
}

function safeStringMetadataValue(key: string, value: string): string {
  const normalized = normalizedKey(key);
  if (normalized === "action" && /^(?:canonical|orb|webgl|webgpu)-[a-z0-9-]{1,64}$/.test(value)) {
    return value;
  }
  if (normalized === "stackfingerprint" && /^stack-[a-z0-9]{1,16}$/.test(value)) {
    return value;
  }
  if (normalized === "traceid" && /^[a-f0-9]{32}$/.test(value)) return value;
  if ((normalized === "spanid" || normalized === "parentspanid") && /^[a-f0-9]{16}$/.test(value)) {
    return value;
  }
  if (
    normalized === "version" &&
    /^\d{1,4}(?:\.\d{1,4}){0,3}(?:-[A-Za-z0-9.-]{1,24})?$/.test(value)
  ) {
    return value;
  }
  return SAFE_STRING_VALUES[normalized]?.has(value) ? value : DIAGNOSTIC_REDACTED;
}

export function sanitizeDiagnosticMetadataKey(key: string, index = 0): string {
  try {
    const normalized = normalizedKey(key);
    if (
      SAFE_METADATA_KEYS.has(normalized) &&
      key.length > 0 &&
      key.length <= MAX_IDENTIFIER_LENGTH &&
      /^[A-Za-z][A-Za-z0-9_]*$/.test(key)
    ) {
      return key;
    }
  } catch {
    // Fall through to a position-only key that cannot contain caller data.
  }
  return `redacted_field_${index}`;
}

export function diagnosticErrorName(error: unknown): string {
  try {
    if (!(error instanceof Error)) return "UnknownError";
    return sanitizeDiagnosticErrorName(error.name);
  } catch {
    return "UnknownError";
  }
}

export function sanitizeDiagnosticErrorName(value: unknown): string {
  return typeof value === "string" && SAFE_ERROR_NAMES.has(value) ? value : "UnknownError";
}

export function sanitizeDiagnosticStackFingerprint(value: unknown): string {
  return value === "stack-present" || value === "stack-none" ? value : "stack-none";
}

export function diagnosticStackFingerprint(error: unknown): string {
  try {
    if (!(error instanceof Error) || typeof error.stack !== "string" || !error.stack) {
      return "stack-none";
    }
    // Stack text can contain routes, query strings, filenames, user paths, or
    // attacker-controlled Error.stack values. Retain presence only; subsystem
    // code + finite error name preserve actionable classification without a
    // content-derived fingerprint.
    return "stack-present";
  } catch {
    return "stack-none";
  }
}

export function toDiagnosticError(error: unknown, code = "ZF_RUNTIME_ERROR"): Error {
  const safeCode = diagnosticCodeFrom(code, "ZF_RUNTIME_ERROR");
  const safe = new Error(safeCode);
  safe.name = diagnosticErrorName(error);
  safe.stack = `${safe.name}: ${safeCode}`;
  return safe;
}

function sanitizeMetadataValue(key: string, value: unknown, depth: number): unknown {
  try {
    const normalized = normalizedKey(key);
    if (typeof value === "string" && STRING_METADATA_KEYS.has(normalized)) {
      return safeStringMetadataValue(key, value);
    }
    if (CONTENT_DERIVED_NUMERIC_KEY_PATTERN.test(normalized)) {
      return DIAGNOSTIC_REDACTED;
    }
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1_000_000_000 &&
      NUMERIC_OR_BOOLEAN_KEY_PATTERN.test(normalized)
    ) {
      return value;
    }
    if (typeof value === "boolean" && NUMERIC_OR_BOOLEAN_KEY_PATTERN.test(normalized)) {
      return value;
    }
    if (SENSITIVE_KEY_PATTERN.test(normalized)) return DIAGNOSTIC_REDACTED;
    if (depth >= MAX_DEPTH) return DIAGNOSTIC_REDACTED;
    if (typeof value === "string") return DIAGNOSTIC_REDACTED;
    if (typeof value === "number" || typeof value === "boolean") return DIAGNOSTIC_REDACTED;
    if (value === null || value === undefined) return value;
    if (value instanceof Error) {
      return {
        error_name: diagnosticErrorName(value),
        stack_fingerprint: diagnosticStackFingerprint(value),
      };
    }
    if (Array.isArray(value)) {
      if (!GROUP_METADATA_KEYS.has(normalized)) return DIAGNOSTIC_REDACTED;
      return value
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => sanitizeMetadataValue("metadata", item, depth + 1));
    }
    if (typeof value === "object") {
      if (!GROUP_METADATA_KEYS.has(normalized)) return DIAGNOSTIC_REDACTED;
      return sanitizeDiagnosticMetadata(value as Record<string, unknown>, depth + 1);
    }
    return DIAGNOSTIC_REDACTED;
  } catch {
    return DIAGNOSTIC_REDACTED;
  }
}

export function sanitizeDiagnosticMetadata(
  metadata: Record<string, unknown> | undefined,
  depth = 0
): Record<string, unknown> {
  try {
    if (!metadata || depth >= MAX_DEPTH) return {};
    const sanitized: Record<string, unknown> = {};
    const entries = Object.entries(metadata).slice(0, MAX_KEYS);
    for (let index = 0; index < entries.length; index += 1) {
      const [key, value] = entries[index];
      let safeKey = sanitizeDiagnosticMetadataKey(key, index);
      const knownKey = safeKey === key;
      if (Object.prototype.hasOwnProperty.call(sanitized, safeKey)) {
        safeKey = `redacted_field_${index}`;
      }
      sanitized[safeKey] = knownKey
        ? sanitizeMetadataValue(key, value, depth)
        : DIAGNOSTIC_REDACTED;
    }
    return sanitized;
  } catch {
    return {};
  }
}

function sanitizeDiagnosticArgument(value: unknown): unknown {
  try {
    if (value instanceof Error) {
      return {
        error_name: diagnosticErrorName(value),
        stack_fingerprint: diagnosticStackFingerprint(value),
      };
    }
    if (value == null) return value;
    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      return sanitizeDiagnosticMetadata(value as Record<string, unknown>);
    }
  } catch {
    return DIAGNOSTIC_REDACTED;
  }
  return DIAGNOSTIC_REDACTED;
}

export function diagnosticCodeFrom(value: unknown, fallback = "ZF_RUNTIME_DIAGNOSTIC"): string {
  const safeFallback = SAFE_FIXED_DIAGNOSTIC_CODES.has(fallback)
    ? fallback
    : "ZF_RUNTIME_DIAGNOSTIC";
  try {
    if (typeof value !== "string") return safeFallback;
    if (SAFE_FIXED_DIAGNOSTIC_CODES.has(value)) return value;
    const match = value.match(/^\[([A-Za-z0-9][A-Za-z0-9 _-]{0,31})\]/);
    if (!match || !SAFE_DIAGNOSTIC_SUBSYSTEMS.has(match[1])) return safeFallback;
    return `ZF_${match[1].replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_DIAGNOSTIC`;
  } catch {
    return safeFallback;
  }
}

export function sanitizeDiagnosticLogArgs(
  args: unknown[],
  fallback = "ZF_RUNTIME_DIAGNOSTIC"
): unknown[] {
  try {
    if (!Array.isArray(args)) return [fallback];
    const code = diagnosticCodeFrom(args[0], fallback);
    const metadataStart = typeof args[0] === "string" ? 1 : 0;
    return [code, ...args.slice(metadataStart).map(sanitizeDiagnosticArgument)];
  } catch {
    return [fallback];
  }
}

export function sanitizeDiagnosticUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol.toLowerCase();
    if (!["capacitor:", "file:", "http:", "https:", "tauri:", "zenflow:"].includes(protocol)) {
      return DIAGNOSTIC_REDACTED;
    }
    return `${protocol}//[host]/[route]`;
  } catch {
    return DIAGNOSTIC_REDACTED;
  }
}

/** Convert an arbitrary route/URL to a finite label; queries, hashes, and ids are dropped. */
export function sanitizeDiagnosticRoute(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  try {
    const parsed = new URL(value, "https://diagnostic.invalid");
    const segments = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.toLowerCase());
    if (segments.length === 0) return "home";
    const appSegments = segments[0] === "people-first-app" ? segments.slice(1) : segments;
    if (appSegments.length === 0) return "home";
    if (appSegments.length !== 1) return "unknown";
    return SAFE_ROUTE_LABELS.has(appSegments[0]) ? appSegments[0] : "unknown";
  } catch {
    return "unknown";
  }
}
