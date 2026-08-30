import {
  isAllowedAuthRedirectUrl,
  NATIVE_AUTH_REDIRECT_URL,
} from "@/lib/authRedirectPolicy";

export const PKCE_ATTEMPT_PARAM = "zenflowAuthAttempt";

const PKCE_ATTEMPT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATTEMPT_MANIFEST_VERSION = 2;
const MIN_PKCE_CODE_VERIFIER_LENGTH = 43;
const MAX_PKCE_CODE_VERIFIER_LENGTH = 128;
const MAX_SERIALIZED_VERIFIER_LENGTH = MAX_PKCE_CODE_VERIFIER_LENGTH + "/recovery".length + 2;
const MAX_ATTEMPT_MANIFEST_LENGTH = 16_384;
const FUTURE_CLOCK_SKEW_MS = 5_000;

export const MAX_PKCE_ATTEMPTS = 8;
export const MAX_PKCE_AUTH_URL_LENGTH = 8_192;
export const LEGACY_PKCE_CUTOVER_GRACE_MS = 10 * 60_000;

/**
 * Retention is purpose-bound because ZenFlow currently has two different PKCE
 * producers. The email flow is exclusively the Journal reset handoff, whose
 * local proof already expires after 10 minutes. OAuth gets the same bounded
 * window: longer retention has no current product requirement or local proof.
 * A callback is rejected when its age is greater than or equal to this value.
 */
export const PKCE_ATTEMPT_RETENTION_MS: Readonly<Record<PkceAttemptPurpose, number>> = {
  oauth: 10 * 60_000,
  "email-otp": 10 * 60_000,
};

export const PKCE_ATTEMPT_MAX_AGE_MS = Math.max(
  ...Object.values(PKCE_ATTEMPT_RETENTION_MS),
);

export type PkceAttemptPurpose = "oauth" | "email-otp";

export interface AuthStorageLike {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface PkceAttemptRecord {
  attemptId: string;
  purpose: PkceAttemptPurpose;
  createdAt: number;
  redirectBinding: string;
}

type ActiveAttempt = PkceAttemptRecord & {
  phase: "initiation" | "callback";
};

type StoredPkceAttemptRecord = PkceAttemptRecord & {
  verifier: string;
};

interface AttemptManifest {
  version: 2;
  attempts: StoredPkceAttemptRecord[];
}

interface LegacyPkceBoundaryMarker {
  version: 1;
  recordedAt: number;
  redirectBindings: string[];
}

export interface AttemptScopedAuthStorage {
  storage: AuthStorageLike;
  runInitiation<T>(
    attemptId: string,
    purpose: PkceAttemptPurpose,
    redirectUrl: string,
    operation: () => Promise<T>,
  ): Promise<T>;
  runCallback<T>(
    attemptId: string,
    callbackUrl: string,
    operation: () => Promise<T>,
  ): Promise<T>;
  runLegacyCallback<T>(callbackUrl: string, operation: () => Promise<T>): Promise<T>;
  runInitialAuthLockOperation<T>(operation: () => Promise<T>): Promise<T>;
  cancelFromUrl(attemptId: string, callbackUrl: string): Promise<boolean>;
  cancel(attemptId: string): Promise<void>;
  list(): Promise<PkceAttemptRecord[]>;
}

const scopedStorageControls = new WeakMap<object, AttemptScopedAuthStorage>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isPurpose(value: unknown): value is PkceAttemptPurpose {
  return value === "oauth" || value === "email-otp";
}

function isStoredVerifier(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_SERIALIZED_VERIFIER_LENGTH) {
    return false;
  }
  try {
    const storedVerifier = JSON.parse(value) as unknown;
    if (typeof storedVerifier !== "string") return false;
    const [codeVerifier, redirectType, ...unexpected] = storedVerifier.split("/");
    return (
      unexpected.length === 0 &&
      codeVerifier.length >= MIN_PKCE_CODE_VERIFIER_LENGTH &&
      codeVerifier.length <= MAX_PKCE_CODE_VERIFIER_LENGTH &&
      /^[A-Za-z0-9._~-]+$/.test(codeVerifier) &&
      (redirectType === undefined || redirectType === "recovery")
    );
  } catch {
    return false;
  }
}

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function requireAttemptId(attemptId: string): string {
  if (!PKCE_ATTEMPT_PATTERN.test(attemptId)) {
    throw new Error("A valid PKCE attempt owner is required");
  }
  return attemptId;
}

type PkceAttemptSelectorResult =
  | { status: "absent" }
  | { status: "valid"; attemptId: string }
  | { status: "invalid" };

function parsePkceAttemptSelector(rawUrl: string): PkceAttemptSelectorResult {
  if (!rawUrl || rawUrl.length > MAX_PKCE_AUTH_URL_LENGTH) {
    return { status: "invalid" };
  }
  try {
    const url = new URL(rawUrl);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const selectors = [
      ...url.searchParams.getAll(PKCE_ATTEMPT_PARAM),
      ...hash.getAll(PKCE_ATTEMPT_PARAM),
    ];
    if (selectors.length === 0) return { status: "absent" };
    // Even repeated identical values are ambiguous input. Accept exactly one
    // canonical selector across query and hash so no consumer can choose a
    // different owner through query-first/hash-first parsing.
    if (selectors.length !== 1 || !PKCE_ATTEMPT_PATTERN.test(selectors[0])) {
      return { status: "invalid" };
    }
    return { status: "valid", attemptId: selectors[0] };
  } catch {
    return { status: "invalid" };
  }
}

function hasPkceAuthorizationCode(rawUrl: string): boolean {
  if (rawUrl.length > MAX_PKCE_AUTH_URL_LENGTH) {
    // Only arm fail-closed initial processing; the bounded selector parser will
    // reject this URL before any verifier can be selected.
    return /(?:[?&#])code=/.test(rawUrl);
  }
  try {
    const url = new URL(rawUrl);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    return Boolean(url.searchParams.get("code")?.trim() || hash.get("code")?.trim());
  } catch {
    return false;
  }
}

export function hasPkceAttemptSelectorFromUrl(rawUrl: string): boolean {
  // Invalid or overlong input is deliberately treated as selector-bearing so
  // callers reject it instead of downgrading it to the bounded legacy path.
  return parsePkceAttemptSelector(rawUrl).status !== "absent";
}

const AUTH_SEARCH_RESPONSE_PARAMS = new Set([
  PKCE_ATTEMPT_PARAM,
  "code",
  "error",
  "error_code",
  "error_description",
  "state",
  "access_token",
  "refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
  "provider_token",
  "provider_refresh_token",
]);
const AUTH_HASH_RESPONSE_PARAMS = new Set([
  ...AUTH_SEARCH_RESPONSE_PARAMS,
  "zenflowConfirm",
  "token_hash",
  "type",
]);
const LEGACY_AUTH_SEARCH_RESPONSE_PARAMS = new Set([
  ...AUTH_SEARCH_RESPONSE_PARAMS,
  // The pre-isolation Journal producer added this nonce to redirectTo while
  // the page waiting for the email did not have it in the address bar.
  "journalReset",
]);
const LEGACY_AUTH_HASH_RESPONSE_PARAMS = new Set([
  ...AUTH_HASH_RESPONSE_PARAMS,
  "journalReset",
]);

function canonicalParams(
  params: URLSearchParams,
  excluded: ReadonlySet<string>,
): Array<[string, string]> {
  return Array.from(params.entries())
    .filter(([key]) => !excluded.has(key))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey < rightKey) return -1;
      if (leftKey > rightKey) return 1;
      if (leftValue < rightValue) return -1;
      if (leftValue > rightValue) return 1;
      return 0;
    });
}

function canonicalAuthPathname(pathname: string): string {
  const normalized = pathname || "/";
  return normalized.length > 1 && normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
}

async function createRedirectBinding(
  rawUrl: string,
  mode: "attempt" | "legacy" = "attempt",
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Secure PKCE callback binding is unavailable");
  if (!rawUrl || rawUrl.length > MAX_PKCE_AUTH_URL_LENGTH) {
    throw new Error("The PKCE callback URL is not valid");
  }

  const url = new URL(rawUrl);
  if (url.username || url.password) {
    throw new Error("PKCE callback credentials are not allowed in the redirect URL");
  }
  const canonical = JSON.stringify({
    protocol: url.protocol.toLowerCase(),
    hostname: url.hostname.toLowerCase(),
    port: url.port,
    pathname: canonicalAuthPathname(url.pathname),
    search: canonicalParams(
      url.searchParams,
      mode === "legacy" ? LEGACY_AUTH_SEARCH_RESPONSE_PARAMS : AUTH_SEARCH_RESPONSE_PARAMS,
    ),
    hash: canonicalParams(
      new URLSearchParams(url.hash.replace(/^#/, "")),
      mode === "legacy" ? LEGACY_AUTH_HASH_RESPONSE_PARAMS : AUTH_HASH_RESPONSE_PARAMS,
    ),
  });
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getPkceAttemptIdFromUrl(rawUrl: string): string | null {
  const selector = parsePkceAttemptSelector(rawUrl);
  return selector.status === "valid" ? selector.attemptId : null;
}

export function createPkceAttemptRedirectUrl(
  baseRedirectUrl: string,
  purpose: PkceAttemptPurpose,
): { attemptId: string; redirectUrl: string; purpose: PkceAttemptPurpose } {
  if (!isPurpose(purpose)) throw new Error("A valid PKCE attempt purpose is required");
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("Secure PKCE attempt ownership is unavailable");
  }
  if (!baseRedirectUrl || baseRedirectUrl.length > MAX_PKCE_AUTH_URL_LENGTH) {
    throw new Error("The PKCE redirect URL is not allowed");
  }

  const url = new URL(baseRedirectUrl);
  if (!isAllowedAuthRedirectUrl(url.toString())) {
    throw new Error("The PKCE redirect URL is not allowed");
  }
  const attemptId = globalThis.crypto.randomUUID();
  url.searchParams.set(PKCE_ATTEMPT_PARAM, attemptId);
  if (url.toString().length > MAX_PKCE_AUTH_URL_LENGTH) {
    throw new Error("The PKCE redirect URL is not allowed");
  }
  return { attemptId, redirectUrl: url.toString(), purpose };
}

export function stripPkceAttemptFromUrl(rawUrl: string): string {
  if (!rawUrl || rawUrl.length > MAX_PKCE_AUTH_URL_LENGTH) {
    throw new Error("The PKCE callback URL is not valid");
  }
  const baseOrigin = typeof window !== "undefined" ? window.location.origin : "https://zenflow.invalid";
  const url = new URL(rawUrl, baseOrigin);
  url.searchParams.delete(PKCE_ATTEMPT_PARAM);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  hash.delete(PKCE_ATTEMPT_PARAM);
  url.hash = hash.size > 0 ? `#${hash.toString()}` : "";
  return `${url.pathname}${url.search}${url.hash}`;
}

function parseManifest(raw: string | null): AttemptManifest {
  if (raw === null) return { version: ATTEMPT_MANIFEST_VERSION, attempts: [] };
  if (raw.length > MAX_ATTEMPT_MANIFEST_LENGTH) {
    throw new Error("The PKCE attempt manifest is malformed");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const malformed = new Error("The PKCE attempt manifest is malformed");
    (malformed as Error & { cause?: unknown }).cause = error;
    throw malformed;
  }
  if (
    !isRecord(parsed) ||
    !hasOnlyKeys(parsed, ["version", "attempts"]) ||
    parsed.version !== ATTEMPT_MANIFEST_VERSION
  ) {
    throw new Error("The PKCE attempt manifest is malformed");
  }
  if (!Array.isArray(parsed.attempts) || parsed.attempts.length > MAX_PKCE_ATTEMPTS) {
    throw new Error("The PKCE attempt manifest is malformed");
  }

  const attempts = parsed.attempts.map((attempt): StoredPkceAttemptRecord => {
    if (
      !isRecord(attempt) ||
      !hasOnlyKeys(attempt, [
        "attemptId",
        "purpose",
        "createdAt",
        "redirectBinding",
        "verifier",
      ]) ||
      typeof attempt.attemptId !== "string" ||
      !PKCE_ATTEMPT_PATTERN.test(attempt.attemptId) ||
      !isPurpose(attempt.purpose) ||
      typeof attempt.createdAt !== "number" ||
      !Number.isSafeInteger(attempt.createdAt) ||
      attempt.createdAt < 0 ||
      typeof attempt.redirectBinding !== "string" ||
      !/^[0-9a-f]{64}$/.test(attempt.redirectBinding) ||
      !isStoredVerifier(attempt.verifier)
    ) {
      throw new Error("The PKCE attempt manifest is malformed");
    }
    return {
      attemptId: attempt.attemptId,
      purpose: attempt.purpose,
      createdAt: attempt.createdAt,
      redirectBinding: attempt.redirectBinding,
      verifier: attempt.verifier,
    };
  });

  if (new Set(attempts.map((attempt) => attempt.attemptId)).size !== attempts.length) {
    throw new Error("The PKCE attempt manifest is malformed");
  }
  return { version: ATTEMPT_MANIFEST_VERSION, attempts };
}

function parseLegacyBoundaryMarker(raw: string): LegacyPkceBoundaryMarker {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const malformed = new Error("The legacy PKCE boundary marker is malformed");
    (malformed as Error & { cause?: unknown }).cause = error;
    throw malformed;
  }

  if (
    !isRecord(parsed) ||
    !hasOnlyKeys(parsed, ["version", "recordedAt", "redirectBindings"]) ||
    parsed.version !== 1 ||
    !Number.isSafeInteger(parsed.recordedAt) ||
    (parsed.recordedAt as number) < 0 ||
    !Array.isArray(parsed.redirectBindings) ||
    parsed.redirectBindings.length === 0 ||
    parsed.redirectBindings.length > 2 ||
    parsed.redirectBindings.some(
      (binding) => typeof binding !== "string" || !/^[0-9a-f]{64}$/.test(binding),
    ) ||
    new Set(parsed.redirectBindings).size !== parsed.redirectBindings.length
  ) {
    throw new Error("The legacy PKCE boundary marker is malformed");
  }

  return {
    version: 1,
    recordedAt: parsed.recordedAt as number,
    redirectBindings: parsed.redirectBindings as string[],
  };
}

export function getAttemptScopedAuthStorageControl(
  storage: AuthStorageLike,
): AttemptScopedAuthStorage | null {
  return scopedStorageControls.get(storage) ?? null;
}

export function createAttemptScopedAuthStorage(
  backingStorage: AuthStorageLike,
  storageKey: string,
  options: { initialCallbackUrl?: string } = {},
): AttemptScopedAuthStorage {
  if (!storageKey.trim()) throw new Error("The Supabase auth storage key is required");

  const sharedVerifierKey = `${storageKey}-code-verifier`;
  const manifestKey = `${storageKey}-zenflow-pkce-attempts`;
  const legacyBoundaryKey = `${storageKey}-zenflow-legacy-pkce-boundary`;
  const initialCallbackUrl = options.initialCallbackUrl ?? null;
  let initialCallbackPending = Boolean(
    options.initialCallbackUrl && hasPkceAuthorizationCode(options.initialCallbackUrl),
  );
  let initialCallbackAttemptId =
    initialCallbackPending && options.initialCallbackUrl
    ? getPkceAttemptIdFromUrl(options.initialCallbackUrl)
    : null;
  let activeAttempt: ActiveAttempt | null = null;
  let legacyCallbackActive = false;

  const readManifest = async () => parseManifest(await backingStorage.getItem(manifestKey));
  const writeManifest = async (attempts: StoredPkceAttemptRecord[]) => {
    if (attempts.length === 0) {
      await backingStorage.removeItem(manifestKey);
      return;
    }
    await backingStorage.setItem(
      manifestKey,
      JSON.stringify({ version: ATTEMPT_MANIFEST_VERSION, attempts } satisfies AttemptManifest),
    );
  };

  const rememberAttempt = async (attempt: StoredPkceAttemptRecord) => {
    const manifest = await readManifest();
    const retained = manifest.attempts.filter(
      (candidate) => candidate.attemptId !== attempt.attemptId,
    );
    await writeManifest([...retained, attempt]);
  };

  const removeAttempt = async (attemptId: string) => {
    const normalized = requireAttemptId(attemptId);
    const manifest = await readManifest();
    await writeManifest(
      manifest.attempts.filter((candidate) => candidate.attemptId !== normalized),
    );
    if (activeAttempt?.attemptId === normalized) activeAttempt = null;
  };

  const pruneAbandonedAttempts = async (): Promise<AttemptManifest> => {
    const manifest = await readManifest();
    const now = Date.now();
    const retained = manifest.attempts.filter((attempt) => {
      if (activeAttempt?.phase === "callback" && activeAttempt.attemptId === attempt.attemptId) {
        return true;
      }
      if (attempt.createdAt > now + FUTURE_CLOCK_SKEW_MS) return false;
      return now - attempt.createdAt < PKCE_ATTEMPT_RETENTION_MS[attempt.purpose];
    });

    if (retained.length !== manifest.attempts.length) {
      await writeManifest(retained);
    }
    return { version: ATTEMPT_MANIFEST_VERSION, attempts: retained };
  };

  const cancel = async (attemptId: string) => {
    await pruneAbandonedAttempts();
    await removeAttempt(attemptId);
  };

  const clearLegacyBoundary = async () => {
    await backingStorage.removeItem(sharedVerifierKey);
    await backingStorage.removeItem(legacyBoundaryKey);
  };

  const createLegacyBoundaryMarker = async (): Promise<LegacyPkceBoundaryMarker | null> => {
    const bindings = new Set<string>();
    if (initialCallbackUrl && isAllowedAuthRedirectUrl(initialCallbackUrl)) {
      bindings.add(await createRedirectBinding(initialCallbackUrl, "legacy"));
    }
    bindings.add(await createRedirectBinding(NATIVE_AUTH_REDIRECT_URL, "legacy"));
    if (bindings.size === 0) return null;

    const marker: LegacyPkceBoundaryMarker = {
      version: 1,
      recordedAt: Date.now(),
      redirectBindings: Array.from(bindings),
    };
    await backingStorage.setItem(legacyBoundaryKey, JSON.stringify(marker));
    return marker;
  };

  const inspectLegacyBoundary = async (): Promise<
    | { status: "none" }
    | { status: "expired" }
    | { status: "pending"; marker: LegacyPkceBoundaryMarker }
  > => {
    const verifier = await backingStorage.getItem(sharedVerifierKey);
    if (verifier === null) {
      await backingStorage.removeItem(legacyBoundaryKey);
      return { status: "none" };
    }
    if (!isStoredVerifier(verifier)) {
      await clearLegacyBoundary();
      return { status: "expired" };
    }

    const rawMarker = await backingStorage.getItem(legacyBoundaryKey);
    let marker: LegacyPkceBoundaryMarker | null = null;
    if (rawMarker === null) {
      marker = await createLegacyBoundaryMarker();
    } else {
      try {
        marker = parseLegacyBoundaryMarker(rawMarker);
      } catch {
        await clearLegacyBoundary();
        return { status: "expired" };
      }
    }
    if (!marker) {
      await clearLegacyBoundary();
      return { status: "expired" };
    }

    const now = Date.now();
    if (
      marker.recordedAt > now + FUTURE_CLOCK_SKEW_MS ||
      now - marker.recordedAt >= LEGACY_PKCE_CUTOVER_GRACE_MS
    ) {
      await clearLegacyBoundary();
      return { status: "expired" };
    }
    return { status: "pending", marker };
  };

  const runLegacyCallback = async <T>(
    callbackUrl: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    if (
      !hasPkceAuthorizationCode(callbackUrl) ||
      hasPkceAttemptSelectorFromUrl(callbackUrl) ||
      !isAllowedAuthRedirectUrl(callbackUrl)
    ) {
      throw new Error("This legacy sign-in callback is not valid; restart authentication");
    }

    const boundary = await inspectLegacyBoundary();
    if (boundary.status !== "pending") {
      throw new Error("This legacy sign-in attempt expired; restart authentication");
    }
    const callbackBinding = await createRedirectBinding(callbackUrl, "legacy");
    if (!boundary.marker.redirectBindings.includes(callbackBinding)) {
      throw new Error("This legacy callback does not match; restart authentication");
    }

    legacyCallbackActive = true;
    try {
      return await operation();
    } finally {
      legacyCallbackActive = false;
      await clearLegacyBoundary();
    }
  };

  const storage: AuthStorageLike = {
    getItem: async (key) => {
      if (key !== sharedVerifierKey) return backingStorage.getItem(key);
      if (activeAttempt) {
        const manifest = await readManifest();
        return (
          manifest.attempts.find(
            (candidate) => candidate.attemptId === activeAttempt?.attemptId,
          )?.verifier ?? null
        );
      }
      // A pre-isolation verifier is readable only while a URL-bound legacy
      // callback holds the origin auth lock during the bounded cutover grace.
      if (!legacyCallbackActive) return null;
      return backingStorage.getItem(sharedVerifierKey);
    },
    setItem: async (key, value) => {
      if (key === sharedVerifierKey) {
        if (!activeAttempt || activeAttempt.phase !== "initiation") {
          throw new Error("PKCE attempt ownership is required before storing a verifier");
        }
        if (!isStoredVerifier(value)) {
          throw new Error("The PKCE verifier does not match the pinned storage contract");
        }
        // One manifest write owns the verifier and all selection metadata. A
        // crash can therefore leave either the old manifest or the complete
        // new attempt, never an untracked per-attempt verifier key.
        await rememberAttempt({
          attemptId: activeAttempt.attemptId,
          purpose: activeAttempt.purpose,
          createdAt: activeAttempt.createdAt,
          redirectBinding: activeAttempt.redirectBinding,
          verifier: value,
        });
        return;
      }

      await backingStorage.setItem(key, value);
      if (key === storageKey && activeAttempt?.phase === "callback") {
        await removeAttempt(activeAttempt.attemptId);
      } else if (key === storageKey && legacyCallbackActive) {
        await clearLegacyBoundary();
      }
    },
    removeItem: async (key) => {
      if (key !== sharedVerifierKey) {
        await backingStorage.removeItem(key);
        return;
      }
      if (activeAttempt?.phase === "initiation") {
        await removeAttempt(activeAttempt.attemptId);
        return;
      }
      if (activeAttempt?.phase === "callback") {
        // auth-js removes the verifier on both successful and failed code
        // exchange. Preserve it until a session write proves success, or until
        // the user explicitly cancels this exact attempt.
        return;
      }
      if (legacyCallbackActive) {
        await clearLegacyBoundary();
      }
    },
  };

  const withActiveAttempt = async <T>(
    attempt: ActiveAttempt,
    operation: () => Promise<T>,
  ): Promise<T> => {
    if (activeAttempt && activeAttempt.attemptId !== attempt.attemptId) {
      throw new Error("Another PKCE operation is already active in this app instance");
    }
    const previous = activeAttempt;
    activeAttempt = attempt;
    try {
      return await operation();
    } finally {
      if (activeAttempt?.attemptId === attempt.attemptId) activeAttempt = previous;
    }
  };

  const control: AttemptScopedAuthStorage = {
    storage,
    runInitiation: async <T>(
      attemptId: string,
      purpose: PkceAttemptPurpose,
      redirectUrl: string,
      operation: () => Promise<T>,
    ) => {
      const normalized = requireAttemptId(attemptId);
      if (getPkceAttemptIdFromUrl(redirectUrl) !== normalized) {
        throw new Error("The PKCE redirect does not match its attempt owner");
      }
      const manifest = await pruneAbandonedAttempts();
      if (manifest.attempts.some((candidate) => candidate.attemptId === normalized)) {
        throw new Error("This PKCE attempt owner is already in use");
      }
      if (manifest.attempts.length >= MAX_PKCE_ATTEMPTS) {
        throw new Error("Too many authentication attempts are still pending");
      }
      const attempt: ActiveAttempt = {
        attemptId: normalized,
        purpose,
        createdAt: Date.now(),
        redirectBinding: await createRedirectBinding(redirectUrl),
        phase: "initiation",
      };
      try {
        const result = await withActiveAttempt(attempt, operation);
        if (isRecord(result) && result.error) await removeAttempt(normalized);
        return result;
      } catch (error) {
        await removeAttempt(normalized);
        throw error;
      }
    },
    runCallback: async <T>(
      attemptId: string,
      callbackUrl: string,
      operation: () => Promise<T>,
    ) => {
      const normalized = requireAttemptId(attemptId);
      const manifest = await pruneAbandonedAttempts();
      const record = manifest.attempts.find((candidate) => candidate.attemptId === normalized);
      if (!record) {
        throw new Error("This sign-in attempt is not available on this device");
      }
      if (record.redirectBinding !== (await createRedirectBinding(callbackUrl))) {
        throw new Error("This callback does not match the sign-in attempt");
      }
      const { verifier: _verifier, ...publicRecord } = record;
      return withActiveAttempt({ ...publicRecord, phase: "callback" }, operation);
    },
    runLegacyCallback,
    runInitialAuthLockOperation: async <T>(operation: () => Promise<T>) => {
      await pruneAbandonedAttempts();
      await inspectLegacyBoundary();
      if (!initialCallbackPending) return operation();
      initialCallbackPending = false;
      const attemptId = initialCallbackAttemptId;
      initialCallbackAttemptId = null;
      if (attemptId && initialCallbackUrl) {
        return control.runCallback(attemptId, initialCallbackUrl, operation);
      }
      if (initialCallbackUrl && hasPkceAuthorizationCode(initialCallbackUrl)) {
        return runLegacyCallback(initialCallbackUrl, operation);
      }
      return operation();
    },
    cancelFromUrl: async (attemptId: string, callbackUrl: string) => {
      const normalized = requireAttemptId(attemptId);
      const manifest = await pruneAbandonedAttempts();
      const record = manifest.attempts.find((candidate) => candidate.attemptId === normalized);
      if (!record) return false;
      if (record.redirectBinding !== (await createRedirectBinding(callbackUrl))) {
        throw new Error("This callback does not match the sign-in attempt");
      }
      await removeAttempt(normalized);
      return true;
    },
    cancel,
    list: async () =>
      (await pruneAbandonedAttempts()).attempts.map(
        ({ verifier: _verifier, ...publicRecord }) => publicRecord,
      ),
  };

  scopedStorageControls.set(storage, control);
  return control;
}
