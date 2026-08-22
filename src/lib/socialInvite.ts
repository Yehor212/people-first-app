export const SOCIAL_INVITE_ORIGIN = "https://yehor212.github.io";
export const SOCIAL_INVITE_PATH = "/people-first-app/";
export const SOCIAL_INVITE_MAX_URL_LENGTH = 512;

export type SocialInviteType = "friend" | "challenge";

export interface SocialInviteEnvelope {
  version: 1;
  type: SocialInviteType;
  code: string;
}

export type SocialInviteParseFailure =
  | "invalid_input"
  | "input_too_large"
  | "malformed_url"
  | "untrusted_origin"
  | "untrusted_path"
  | "unexpected_fragment"
  | "unexpected_parameter"
  | "duplicate_parameter"
  | "unsupported_invite"
  | "type_mismatch"
  | "invalid_code";

export type SocialInviteParseResult =
  | { ok: true; envelope: SocialInviteEnvelope }
  | { ok: false; reason: SocialInviteParseFailure };

const ALLOWED_QUERY_KEYS = new Set(["invite", "code"]);
const OPAQUE_CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9-]{5,62}[A-Z0-9])$/;

function normalizeOpaqueCode(code: string): string | null {
  if (typeof code !== "string" || code !== code.trim()) return null;
  if (!OPAQUE_CODE_PATTERN.test(code)) return null;
  return code;
}

export function buildSocialInviteUrl(type: SocialInviteType, code: string): string {
  const normalizedCode = normalizeOpaqueCode(code.trim().toUpperCase());
  if (!normalizedCode) {
    throw new Error("SOCIAL_INVITE_INVALID_CODE");
  }

  const url = new URL(SOCIAL_INVITE_PATH, SOCIAL_INVITE_ORIGIN);
  url.searchParams.set("invite", `${type}.v1`);
  url.searchParams.set("code", normalizedCode);
  return url.toString();
}

export function parseSocialInviteUrl(
  input: string,
  expectedType?: SocialInviteType,
): SocialInviteParseResult {
  if (typeof input !== "string" || input.length === 0) {
    return { ok: false, reason: "invalid_input" };
  }
  if (input.length > SOCIAL_INVITE_MAX_URL_LENGTH) {
    return { ok: false, reason: "input_too_large" };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "malformed_url" };
  }

  if (url.origin !== SOCIAL_INVITE_ORIGIN) {
    return { ok: false, reason: "untrusted_origin" };
  }
  if (url.pathname !== SOCIAL_INVITE_PATH) {
    return { ok: false, reason: "untrusted_path" };
  }
  if (url.hash !== "") {
    return { ok: false, reason: "unexpected_fragment" };
  }

  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      return { ok: false, reason: "unexpected_parameter" };
    }
    if (url.searchParams.getAll(key).length !== 1) {
      return { ok: false, reason: "duplicate_parameter" };
    }
  }
  if ([...ALLOWED_QUERY_KEYS].some((key) => !url.searchParams.has(key))) {
    return { ok: false, reason: "unexpected_parameter" };
  }

  const invite = url.searchParams.get("invite");
  const match = /^(friend|challenge)\.v1$/.exec(invite ?? "");
  if (!match) {
    return { ok: false, reason: "unsupported_invite" };
  }

  const type = match[1] as SocialInviteType;
  if (expectedType && type !== expectedType) {
    return { ok: false, reason: "type_mismatch" };
  }

  const code = normalizeOpaqueCode(url.searchParams.get("code") ?? "");
  if (!code) {
    return { ok: false, reason: "invalid_code" };
  }

  return { ok: true, envelope: { code, type, version: 1 } };
}

/**
 * Compatibility-only decoder for links emitted by older ZenFlow builds.
 * Every embedded field except the bounded challenge code is discarded.
 */
export function parseLegacyChallengeInviteUrl(input: string): SocialInviteParseResult {
  if (typeof input !== "string" || input.length === 0) {
    return { ok: false, reason: "invalid_input" };
  }
  if (input.length > 10_240) {
    return { ok: false, reason: "input_too_large" };
  }

  try {
    const url = new URL(input);
    if (
      url.protocol !== "zenflow:" ||
      url.hostname !== "challenge" ||
      (url.pathname !== "" && url.pathname !== "/") ||
      url.hash !== "" ||
      [...url.searchParams.keys()].some((key) => key !== "data") ||
      url.searchParams.getAll("data").length !== 1
    ) {
      return { ok: false, reason: "malformed_url" };
    }

    const encoded = url.searchParams.get("data");
    if (!encoded || encoded.length > 10_000) {
      return { ok: false, reason: "invalid_input" };
    }

    let json: string;
    try {
      json = decodeURIComponent(atob(encoded));
    } catch {
      json = atob(encoded);
    }

    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, reason: "invalid_code" };
    }
    const code = normalizeOpaqueCode((raw as Record<string, unknown>).cd as string);
    if (!code) {
      return { ok: false, reason: "invalid_code" };
    }

    return {
      ok: true,
      envelope: { code, type: "challenge", version: 1 },
    };
  } catch {
    return { ok: false, reason: "malformed_url" };
  }
}
