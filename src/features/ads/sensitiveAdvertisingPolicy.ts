/**
 * T177 fail-closed advertising boundary.
 *
 * Every current authenticated ZenFlow surface contains private, emotional,
 * recovery, account, habit, focus, or journal state. ADR-MON-001 is still
 * undecided, so this module intentionally exposes no allow path and imports no
 * advertising, analytics, telemetry, or receipt implementation.
 */

export type SensitiveAdvertisingSurface =
  | "auth"
  | "orb"
  | "habits"
  | "diary"
  | "planning"
  | "settings"
  | "error"
  | "navigation"
  | "overlay"
  | "unknown";

export type SensitiveAdvertisingLifecycle =
  | "direct"
  | "navigation"
  | "back"
  | "reload"
  | "overlay";

export type SensitiveAdvertisingDenialReason =
  | "auth_or_account_boundary"
  | "emotional_or_mood_state"
  | "private_habit_state"
  | "private_journal_state"
  | "focus_or_schedule_state"
  | "private_settings_state"
  | "error_or_recovery_state"
  | "navigation_transition"
  | "private_overlay"
  | "unknown_fail_closed";

export const SENSITIVE_ADVERTISING_DENY_MAP: Readonly<
  Record<SensitiveAdvertisingSurface, SensitiveAdvertisingDenialReason>
> = Object.freeze({
  auth: "auth_or_account_boundary",
  orb: "emotional_or_mood_state",
  habits: "private_habit_state",
  diary: "private_journal_state",
  planning: "focus_or_schedule_state",
  settings: "private_settings_state",
  error: "error_or_recovery_state",
  navigation: "navigation_transition",
  overlay: "private_overlay",
  unknown: "unknown_fail_closed",
});

export type SensitiveAdvertisingCapability =
  | "prompt"
  | "copy"
  | "import"
  | "controller"
  | "initialize"
  | "request"
  | "show";

const DENIED_CAPABILITIES: Readonly<Record<SensitiveAdvertisingCapability, boolean>> = Object.freeze({
  prompt: false,
  copy: false,
  import: false,
  controller: false,
  initialize: false,
  request: false,
  show: false,
});

const DENIED_PRIVATE_DATA_SINKS = Object.freeze({
  adPayload: false,
  telemetry: false,
  receipt: false,
});

export interface SensitiveAdvertisingPolicyInput {
  surface: SensitiveAdvertisingSurface | string;
  lifecycle: SensitiveAdvertisingLifecycle | string;
  /** Fixed inventory identifier only. Never pass user content here. */
  stateId: string;
  privateOverlayOpen?: boolean;
}

export interface SensitiveAdvertisingDecision {
  decision: "deny";
  allowed: false;
  reason: SensitiveAdvertisingDenialReason;
  surface: SensitiveAdvertisingSurface;
  lifecycle: SensitiveAdvertisingLifecycle;
  capabilities: typeof DENIED_CAPABILITIES;
  privateDataSinks: typeof DENIED_PRIVATE_DATA_SINKS;
}

export interface SensitiveAdvertisingAttemptDecision {
  decision: SensitiveAdvertisingDecision;
  requestedCapability: SensitiveAdvertisingCapability;
  blocked: boolean;
  violationDetected: boolean;
}

function isSensitiveAdvertisingSurface(value: string): value is SensitiveAdvertisingSurface {
  return Object.prototype.hasOwnProperty.call(SENSITIVE_ADVERTISING_DENY_MAP, value);
}

function isSensitiveAdvertisingLifecycle(value: string): value is SensitiveAdvertisingLifecycle {
  return ["direct", "navigation", "back", "reload", "overlay"].includes(value);
}

/**
 * Returns an immutable denial. The function accepts only fixed route/state
 * metadata, which keeps journal, mood, habit, auth, and account payloads out of
 * advertising, telemetry, and receipt boundaries by construction.
 */
export function evaluateSensitiveAdvertisingPolicy(
  input: SensitiveAdvertisingPolicyInput,
): SensitiveAdvertisingDecision {
  const surface = isSensitiveAdvertisingSurface(input.surface) ? input.surface : "unknown";
  const lifecycle = isSensitiveAdvertisingLifecycle(input.lifecycle) ? input.lifecycle : "direct";
  const effectiveSurface = input.privateOverlayOpen ? "overlay" : surface;

  return Object.freeze({
    decision: "deny",
    allowed: false,
    reason: SENSITIVE_ADVERTISING_DENY_MAP[effectiveSurface],
    surface: effectiveSurface,
    lifecycle: input.privateOverlayOpen ? "overlay" : lifecycle,
    capabilities: DENIED_CAPABILITIES,
    privateDataSinks: DENIED_PRIVATE_DATA_SINKS,
  });
}

/**
 * Evaluates a hypothetical fixed advertising-capability request without
 * accepting or returning user payload. T177's tests invoke this
 * production-source pure function as a negative control; it is not an
 * app-runtime interceptor. Runtime safety instead comes from the disconnected
 * production/native advertising graphs plus the fail-closed route policy.
 */
export function evaluateSensitiveAdvertisingAttempt(
  input: SensitiveAdvertisingPolicyInput,
  requestedCapability: SensitiveAdvertisingCapability,
): SensitiveAdvertisingAttemptDecision {
  const decision = evaluateSensitiveAdvertisingPolicy(input);
  const blocked = decision.capabilities[requestedCapability] !== true;

  return Object.freeze({
    decision,
    requestedCapability,
    blocked,
    violationDetected: blocked,
  });
}
