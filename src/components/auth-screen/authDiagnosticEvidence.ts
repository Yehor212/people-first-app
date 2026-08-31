import { sanitizeDiagnosticRoute } from "@/lib/diagnosticPrivacy";

export const AUTH_DIAGNOSTIC_CODES = {
  APPLE_UNAVAILABLE: "auth_apple_unavailable",
  FAILURE: "auth_failure",
  NATIVE_FAILURE: "auth_native_failure",
  OAUTH_MISSING_URL: "auth_oauth_missing_url",
  OAUTH_READY: "auth_oauth_ready",
  OAUTH_REJECTED: "auth_oauth_rejected",
  SESSION_FAILURE: "auth_session_failure",
} as const;

export type AuthDiagnosticCode =
  (typeof AUTH_DIAGNOSTIC_CODES)[keyof typeof AUTH_DIAGNOSTIC_CODES];

const ALLOWED_CODES = new Set<string>(Object.values(AUTH_DIAGNOSTIC_CODES));

function normalizeCode(value: unknown): AuthDiagnosticCode {
  return typeof value === "string" && ALLOWED_CODES.has(value)
    ? (value as AuthDiagnosticCode)
    : AUTH_DIAGNOSTIC_CODES.FAILURE;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== "string") return "1970-01-01T00:00:00.000Z";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : "1970-01-01T00:00:00.000Z";
}

export interface AuthDiagnosticEvidence {
  schemaVersion: 1;
  generatedAt: string;
  platform: "native" | "web";
  redirectRoute: string;
  supabaseConfigured: boolean;
  hasUserVisibleError: boolean;
  diagnosticCode: AuthDiagnosticCode;
}

export function buildAuthDiagnosticEvidence(input: {
  timestamp: unknown;
  isNative: boolean;
  redirectUrl: unknown;
  supabaseConfigured: boolean;
  error: unknown;
  debugInfo: unknown;
}): AuthDiagnosticEvidence {
  return {
    schemaVersion: 1,
    generatedAt: normalizeTimestamp(input.timestamp),
    platform: input.isNative ? "native" : "web",
    redirectRoute: sanitizeDiagnosticRoute(input.redirectUrl),
    supabaseConfigured: input.supabaseConfigured === true,
    hasUserVisibleError: Boolean(input.error),
    diagnosticCode: normalizeCode(input.debugInfo),
  };
}

export function serializeAuthDiagnosticEvidence(evidence: AuthDiagnosticEvidence): string {
  return JSON.stringify(evidence, null, 2);
}
