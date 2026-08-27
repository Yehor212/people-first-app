import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelPkceAttemptFromUrl,
  configureAuthTransitionClient,
  createOriginWideAuthLock,
  getPkceAttempts,
  runWithPkceCallbackUrl,
} from "@/lib/authTransitionCoordinator";
import {
  createAttemptScopedAuthStorage,
  createPkceAttemptRedirectUrl,
  LEGACY_PKCE_CUTOVER_GRACE_MS,
  MAX_PKCE_ATTEMPTS,
  PKCE_ATTEMPT_MAX_AGE_MS,
  PKCE_ATTEMPT_PARAM,
  PKCE_ATTEMPT_RETENTION_MS,
  type AuthStorageLike,
} from "@/lib/pkceAttemptStorage";

const STORAGE_KEY_PREFIX = "sb-pkce-isolation-auth-token";
let storageKey = STORAGE_KEY_PREFIX;
let storageKeySequence = 0;
const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";

function createMemoryStorage(
  initial: Record<string, string> = {},
): AuthStorageLike & { snapshot(): Record<string, string> } {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    snapshot: () => Object.fromEntries(values),
  };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authResponse() {
  return {
    access_token: "access-a",
    refresh_token: "refresh-a",
    expires_in: 3_600,
    token_type: "bearer",
    user: {
      id: ACCOUNT_A,
      aud: "authenticated",
      role: "authenticated",
      email: "a@example.test",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-07-18T00:00:00.000Z",
    },
  };
}

async function sha256(value: string | null): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value ?? "<missing>"),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function createAuthClient(
  backingStorage: AuthStorageLike,
  fetchStub: typeof fetch,
  initialCallbackUrl?: string,
  detectSessionInUrl = false,
  skipAutoInitialize = false,
): SupabaseClient {
  const scoped = createAttemptScopedAuthStorage(backingStorage, storageKey, {
    initialCallbackUrl,
  });
  const client = createClient("https://project.supabase.co", "anon-key", {
    auth: {
      storage: scoped.storage,
      storageKey,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl,
      skipAutoInitialize,
      flowType: "pkce",
      lock: createOriginWideAuthLock({ pkceControl: scoped }),
    },
    global: { fetch: fetchStub },
  });
  configureAuthTransitionClient(client.auth, {
    storage: scoped.storage,
    storageKey,
  });
  return client;
}

beforeEach(() => {
  storageKeySequence += 1;
  storageKey = `${STORAGE_KEY_PREFIX}-${storageKeySequence}`;
  const originalWarn = console.warn.bind(console);
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes("Multiple GoTrueClient instances detected")) return;
    originalWarn(...args);
  });
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("attempt-scoped PKCE verifier isolation", () => {
  it("uses the current 10-minute bounded retention for both known producer purposes", () => {
    expect(PKCE_ATTEMPT_RETENTION_MS).toEqual({
      oauth: 600_000,
      "email-otp": 600_000,
    });
  });

  it("keeps competing OAuth and email attempts from two tabs independently consumable", async () => {
    const backing = createMemoryStorage();
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/otp")) return jsonResponse({});
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    }) as typeof fetch;
    const oauthTab = createAuthClient(backing, fetchStub);
    const emailTab = createAuthClient(backing, fetchStub);
    await Promise.all([oauthTab.auth.initialize(), emailTab.auth.initialize()]);
    const first = createPkceAttemptRedirectUrl("http://localhost:3000/", "oauth");
    const second = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");

    await Promise.all([
      expect(
        oauthTab.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: first.redirectUrl, skipBrowserRedirect: true },
        }),
      ).resolves.toMatchObject({ error: null }),
      expect(
        emailTab.auth.signInWithOtp({
          email: "second@example.test",
          options: { shouldCreateUser: false, emailRedirectTo: second.redirectUrl },
        }),
      ).resolves.toMatchObject({ error: null }),
    ]);

    await expect(getPkceAttempts(emailTab.auth)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attemptId: first.attemptId, purpose: "oauth" }),
        expect.objectContaining({ attemptId: second.attemptId, purpose: "email-otp" }),
      ]),
    );
    expect(backing.snapshot()[`${storageKey}-code-verifier`]).toBeUndefined();
  });

  it("rejects a duplicate attempt owner without overwriting its verifier", async () => {
    const backing = createMemoryStorage();
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/otp")) return jsonResponse({});
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    }) as typeof fetch;
    const client = createAuthClient(backing, fetchStub);
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { shouldCreateUser: false, emailRedirectTo: attempt.redirectUrl },
    });
    const manifestKey = `${storageKey}-zenflow-pkce-attempts`;
    const manifestFingerprintBefore = await sha256(await backing.getItem(manifestKey));

    await expect(
      client.auth.signInWithOtp({
        email: "second@example.test",
        options: { shouldCreateUser: false, emailRedirectTo: attempt.redirectUrl },
      }),
    ).rejects.toThrow("already in use");
    expect(await sha256(await backing.getItem(manifestKey))).toBe(manifestFingerprintBefore);
  });

  it("persists each verifier atomically inside the private manifest record", async () => {
    const backing = createMemoryStorage();
    const client = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");

    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: attempt.redirectUrl },
    });

    const authKeys = Object.keys(backing.snapshot()).filter((key) => key.startsWith(storageKey));
    expect(authKeys).toEqual([`${storageKey}-zenflow-pkce-attempts`]);
    const rawManifest = backing.snapshot()[`${storageKey}-zenflow-pkce-attempts`];
    const privateVerifier = (
      JSON.parse(rawManifest) as { attempts: Array<{ verifier: string }> }
    ).attempts[0].verifier;
    const [publicRecord] = await getPkceAttempts(client.auth);
    expect(publicRecord).not.toHaveProperty("verifier");
    expect(publicRecord).not.toHaveProperty("redirectUrl");
    expect(JSON.stringify(publicRecord)).not.toContain(privateVerifier);
  });

  it("prunes expired and future-dated attempts without deleting the legacy boundary key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00.000Z"));
    const backing = createMemoryStorage();
    const client = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await client.auth.initialize();
    const expired = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await client.auth.signInWithOtp({
      email: "expired@example.test",
      options: { emailRedirectTo: expired.redirectUrl },
    });
    await backing.setItem(`${storageKey}-code-verifier`, JSON.stringify("l".repeat(112)));

    vi.advanceTimersByTime(PKCE_ATTEMPT_MAX_AGE_MS);
    await expect(client.auth.getSession()).resolves.toMatchObject({ error: null });
    await expect(getPkceAttempts(client.auth)).resolves.toEqual([]);
    expect(await backing.getItem(`${storageKey}-code-verifier`)).not.toBeNull();

    const future = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await client.auth.signInWithOtp({
      email: "future@example.test",
      options: { emailRedirectTo: future.redirectUrl },
    });
    const manifestKey = `${storageKey}-zenflow-pkce-attempts`;
    const rawManifest = await backing.getItem(manifestKey);
    const parsedManifest = JSON.parse(rawManifest || "null") as {
      attempts: Array<{ createdAt: number }>;
    };
    parsedManifest.attempts[0].createdAt = Date.now() + 60_000;
    await backing.setItem(manifestKey, JSON.stringify(parsedManifest));

    await expect(getPkceAttempts(client.auth)).resolves.toEqual([]);
    expect(await backing.getItem(`${storageKey}-code-verifier`)).not.toBeNull();
  });

  it("keeps a callback live immediately before the bounded expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00.000Z"));
    const backing = createMemoryStorage();
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/otp")) return jsonResponse({});
      if (requestUrl(input).includes("/token?grant_type=pkce")) {
        vi.advanceTimersByTime(2);
        return jsonResponse(authResponse());
      }
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    }) as typeof fetch;
    const client = createAuthClient(backing, fetchStub);
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await client.auth.signInWithOtp({
      email: "live@example.test",
      options: { emailRedirectTo: attempt.redirectUrl },
    });
    vi.advanceTimersByTime(PKCE_ATTEMPT_MAX_AGE_MS - 1);
    const callbackUrl = `http://localhost:3000/?code=live&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`;

    await expect(
      runWithPkceCallbackUrl(client.auth, callbackUrl, () =>
        client.auth.exchangeCodeForSession("live"),
      ),
    ).resolves.toMatchObject({ error: null });
  });

  it("accepts GitHub Pages trailing-slash canonicalization for a V2 OAuth callback", async () => {
    const backing = createMemoryStorage();
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/token?grant_type=pkce")) {
        return jsonResponse(authResponse());
      }
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    });
    const client = createAuthClient(backing, fetchStub as typeof fetch);
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl(
      "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
      "oauth",
    );

    await expect(
      client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: attempt.redirectUrl, skipBrowserRedirect: true },
      }),
    ).resolves.toMatchObject({ error: null });

    const callbackUrl =
      `https://yehor212.github.io/people-first-app/orb/` +
      `?nav=v2&navLayout=phone&code=github-pages&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`;

    await expect(
      runWithPkceCallbackUrl(client.auth, callbackUrl, () =>
        client.auth.exchangeCodeForSession("github-pages"),
      ),
    ).resolves.toMatchObject({ error: null });
  });

  it("still rejects a different callback pathname after trailing-slash canonicalization", async () => {
    const backing = createMemoryStorage();
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/token?grant_type=pkce")) {
        return jsonResponse(authResponse());
      }
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    });
    const client = createAuthClient(backing, fetchStub as typeof fetch);
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl(
      "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
      "oauth",
    );
    await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: attempt.redirectUrl, skipBrowserRedirect: true },
    });
    fetchStub.mockClear();
    const callbackUrl =
      `https://yehor212.github.io/people-first-app/settings/` +
      `?nav=v2&navLayout=phone&code=wrong-path&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`;

    await expect(
      runWithPkceCallbackUrl(client.auth, callbackUrl, () =>
        client.auth.exchangeCodeForSession("wrong-path"),
      ),
    ).rejects.toThrow("This callback does not match the sign-in attempt");
    expect(fetchStub).not.toHaveBeenCalled();
    await expect(getPkceAttempts(client.auth)).resolves.toContainEqual(
      expect.objectContaining({ attemptId: attempt.attemptId }),
    );
  });

  it("fails closed at the live-attempt cap instead of evicting a usable verifier", async () => {
    const backing = createMemoryStorage();
    const client = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await client.auth.initialize();

    for (let index = 0; index < MAX_PKCE_ATTEMPTS; index += 1) {
      const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
      await client.auth.signInWithOtp({
        email: `pending-${index}@example.test`,
        options: { emailRedirectTo: attempt.redirectUrl },
      });
    }
    const overflow = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");

    await expect(
      client.auth.signInWithOtp({
        email: "overflow@example.test",
        options: { emailRedirectTo: overflow.redirectUrl },
      }),
    ).rejects.toThrow("Too many authentication attempts are still pending");
    await expect(getPkceAttempts(client.auth)).resolves.toHaveLength(MAX_PKCE_ATTEMPTS);
  });

  it("fails closed on a malformed private manifest", async () => {
    const backing = createMemoryStorage();
    const scoped = createAttemptScopedAuthStorage(backing, storageKey);
    await backing.setItem(`${storageKey}-zenflow-pkce-attempts`, "{malformed");

    await expect(scoped.list()).rejects.toThrow("manifest is malformed");
  });

  it("rejects unknown private fields and over-cap manifests instead of exposing them", async () => {
    const backing = createMemoryStorage();
    const scoped = createAttemptScopedAuthStorage(backing, storageKey);
    const manifestKey = `${storageKey}-zenflow-pkce-attempts`;
    const record = {
      attemptId: "11111111-1111-4111-8111-111111111111",
      purpose: "oauth",
      createdAt: Date.now(),
      redirectBinding: "a".repeat(64),
      verifier: JSON.stringify("v".repeat(43)),
    };

    await backing.setItem(
      manifestKey,
      JSON.stringify({ version: 2, attempts: [{ ...record, redirectUrl: "https://evil.example" }] }),
    );
    await expect(scoped.list()).rejects.toThrow("manifest is malformed");

    await backing.setItem(
      manifestKey,
      JSON.stringify({ version: 2, attempts: [record, record] }),
    );
    await expect(scoped.list()).rejects.toThrow("manifest is malformed");

    await backing.setItem(
      manifestKey,
      JSON.stringify({
        version: 2,
        attempts: [{ ...record, verifier: JSON.stringify("v".repeat(513)) }],
      }),
    );
    await expect(scoped.list()).rejects.toThrow("manifest is malformed");

    await backing.setItem(
      manifestKey,
      JSON.stringify({
        version: 2,
        attempts: Array.from({ length: MAX_PKCE_ATTEMPTS + 1 }, (_, index) => ({
          ...record,
          attemptId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        })),
      }),
    );
    await expect(scoped.list()).rejects.toThrow("manifest is malformed");
  });

  it("consumes one matching pre-isolation callback during the bounded cutover grace", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00.000Z"));
    const legacyVerifierKey = `${storageKey}-code-verifier`;
    const legacyBoundaryKey = `${storageKey}-zenflow-legacy-pkce-boundary`;
    const backing = createMemoryStorage({
      [legacyVerifierKey]: JSON.stringify("a".repeat(112)),
    });
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/otp")) return jsonResponse({});
      if (requestUrl(input).includes("/token?grant_type=pkce")) {
        return jsonResponse(authResponse());
      }
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    }) as typeof fetch;
    const client = createAuthClient(backing, fetchStub, "http://localhost:3000/");
    await client.auth.initialize();
    const boundaryMarker = JSON.parse(
      (await backing.getItem(legacyBoundaryKey)) || "null",
    ) as Record<string, unknown>;
    expect(Object.keys(boundaryMarker).sort()).toEqual([
      "recordedAt",
      "redirectBindings",
      "version",
    ]);
    expect(boundaryMarker).not.toHaveProperty("verifier");
    expect(boundaryMarker.recordedAt).toBe(Date.now());

    const currentAttempt = createPkceAttemptRedirectUrl(
      "http://localhost:3000/",
      "email-otp",
    );
    await client.auth.signInWithOtp({
      email: "current@example.test",
      options: { emailRedirectTo: currentAttempt.redirectUrl },
    });
    vi.advanceTimersByTime(LEGACY_PKCE_CUTOVER_GRACE_MS - 1);
    expect(await backing.getItem(legacyVerifierKey)).not.toBeNull();

    await expect(
      runWithPkceCallbackUrl(
        client.auth,
        "http://localhost:3000/?code=legacy&journalReset=pre-upgrade-nonce",
        () => client.auth.exchangeCodeForSession("legacy"),
      ),
    ).resolves.toMatchObject({ error: null });
    expect(await backing.getItem(legacyVerifierKey)).toBeNull();
    expect(await backing.getItem(legacyBoundaryKey)).toBeNull();
    await expect(getPkceAttempts(client.auth)).resolves.toEqual([
      expect.objectContaining({ attemptId: currentAttempt.attemptId }),
    ]);
  });

  it("lets Supabase auto-detect consume one matching legacy callback under the same lock", async () => {
    const legacyVerifierKey = `${storageKey}-code-verifier`;
    const legacyBoundaryKey = `${storageKey}-zenflow-legacy-pkce-boundary`;
    const backing = createMemoryStorage({
      [legacyVerifierKey]: JSON.stringify("d".repeat(112)),
    });
    const callbackUrl = "http://localhost:3000/?code=legacy-auto";
    window.history.replaceState({}, "", callbackUrl);
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/token?grant_type=pkce")) {
        return jsonResponse(authResponse());
      }
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    }) as typeof fetch;
    const reloaded = createAuthClient(backing, fetchStub, callbackUrl, true);

    await expect(reloaded.auth.initialize()).resolves.toMatchObject({ error: null });
    await expect(reloaded.auth.getSession()).resolves.toMatchObject({
      data: { session: { user: { id: ACCOUNT_A } } },
    });
    expect(await backing.getItem(legacyVerifierKey)).toBeNull();
    expect(await backing.getItem(legacyBoundaryKey)).toBeNull();
    await expect(getPkceAttempts(reloaded.auth)).resolves.toEqual([]);
  });

  it("expires the legacy boundary exactly at grace without touching current attempts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00.000Z"));
    const legacyVerifierKey = `${storageKey}-code-verifier`;
    const legacyBoundaryKey = `${storageKey}-zenflow-legacy-pkce-boundary`;
    const backing = createMemoryStorage({
      [legacyVerifierKey]: JSON.stringify("b".repeat(112)),
    });
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/otp")) return jsonResponse({});
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    });
    const client = createAuthClient(
      backing,
      fetchStub,
      "http://localhost:3000/diary",
    );
    await client.auth.initialize();
    vi.advanceTimersByTime(LEGACY_PKCE_CUTOVER_GRACE_MS / 2);
    const currentAttempt = createPkceAttemptRedirectUrl(
      "http://localhost:3000/diary",
      "email-otp",
    );
    await client.auth.signInWithOtp({
      email: "current@example.test",
      options: { emailRedirectTo: currentAttempt.redirectUrl },
    });
    fetchStub.mockClear();
    vi.advanceTimersByTime(LEGACY_PKCE_CUTOVER_GRACE_MS / 2);

    await expect(
      runWithPkceCallbackUrl(client.auth, "http://localhost:3000/diary?code=old", () =>
        client.auth.exchangeCodeForSession("old"),
      ),
    ).rejects.toThrow("expired; restart authentication");
    expect(fetchStub).not.toHaveBeenCalled();
    expect(await backing.getItem(legacyVerifierKey)).toBeNull();
    expect(await backing.getItem(legacyBoundaryKey)).toBeNull();
    await expect(getPkceAttempts(client.auth)).resolves.toEqual([
      expect.objectContaining({ attemptId: currentAttempt.attemptId }),
    ]);
  });

  it("rejects a mismatched legacy callback and preserves its bounded grace state", async () => {
    const legacyVerifierKey = `${storageKey}-code-verifier`;
    const legacyBoundaryKey = `${storageKey}-zenflow-legacy-pkce-boundary`;
    const backing = createMemoryStorage({
      [legacyVerifierKey]: JSON.stringify("c".repeat(112)),
    });
    const fetchStub = vi.fn(async () => jsonResponse(authResponse()));
    const client = createAuthClient(
      backing,
      fetchStub,
      "http://localhost:3000/diary",
    );
    await client.auth.initialize();
    fetchStub.mockClear();

    await expect(
      runWithPkceCallbackUrl(client.auth, "http://localhost:3000/settings?code=forged", () =>
        client.auth.exchangeCodeForSession("forged"),
      ),
    ).rejects.toThrow("does not match; restart authentication");
    expect(fetchStub).not.toHaveBeenCalled();
    expect(await backing.getItem(legacyVerifierKey)).not.toBeNull();
    expect(await backing.getItem(legacyBoundaryKey)).not.toBeNull();
    await expect(getPkceAttempts(client.auth)).resolves.toEqual([]);
  });

  it("rejects a cross-origin callback before it can select or delete a verifier", async () => {
    const backing = createMemoryStorage();
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/otp")) return jsonResponse({});
      if (requestUrl(input).includes("/token?grant_type=pkce")) {
        return jsonResponse(authResponse());
      }
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    });
    const client = createAuthClient(backing, fetchStub);
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { shouldCreateUser: false, emailRedirectTo: attempt.redirectUrl },
    });
    fetchStub.mockClear();
    const forgedUrl = `https://evil.example/?code=forged&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`;

    await expect(
      runWithPkceCallbackUrl(client.auth, forgedUrl, () =>
        client.auth.exchangeCodeForSession("forged"),
      ),
    ).rejects.toThrow("does not match the sign-in attempt");
    expect(fetchStub).not.toHaveBeenCalled();
    await expect(getPkceAttempts(client.auth)).resolves.toEqual([
      expect.objectContaining({ attemptId: attempt.attemptId }),
    ]);
  });

  it("rejects duplicate, conflicting, and oversized callback selectors without exposing or consuming a verifier", async () => {
    const backing = createMemoryStorage();
    const client = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: attempt.redirectUrl },
    });
    const manifestKey = `${storageKey}-zenflow-pkce-attempts`;
    const rawManifest = await backing.getItem(manifestKey);
    const manifestFingerprint = await sha256(rawManifest);
    const privateVerifier = (
      JSON.parse(rawManifest || "null") as { attempts: Array<{ verifier: string }> }
    ).attempts[0].verifier;
    const otherAttemptId = "22222222-2222-4222-8222-222222222222";
    const candidates = [
      `http://localhost:3000/?code=duplicate&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`,
      `http://localhost:3000/?code=conflict&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}&${PKCE_ATTEMPT_PARAM}=${otherAttemptId}`,
      `http://localhost:3000/?code=query-hash-same&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}#${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`,
      `http://localhost:3000/?code=query-hash-conflict&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}#${PKCE_ATTEMPT_PARAM}=${otherAttemptId}`,
      `http://localhost:3000/?code=oversized-selector&${PKCE_ATTEMPT_PARAM}=${"a".repeat(1_024)}`,
      `http://localhost:3000/?code=oversized-url&padding=${"x".repeat(9_000)}&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`,
    ];

    for (const callbackUrl of candidates) {
      const operation = vi.fn(async () => {
        throw new Error("callback operation must not run");
      });
      let rejection: unknown;
      try {
        await runWithPkceCallbackUrl(client.auth, callbackUrl, operation);
      } catch (error) {
        rejection = error;
      }

      expect(rejection).toMatchObject({
        message: "A valid PKCE callback owner is required",
      });
      expect(String(rejection)).not.toContain(privateVerifier);
      expect(operation).not.toHaveBeenCalled();
      expect(await sha256(await backing.getItem(manifestKey))).toBe(manifestFingerprint);
    }
  });

  it("rejects duplicate cancellation selectors without deleting the selected verifier", async () => {
    const backing = createMemoryStorage();
    const client = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/diary", "email-otp");
    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: attempt.redirectUrl },
    });
    const manifestKey = `${storageKey}-zenflow-pkce-attempts`;
    const manifestFingerprint = await sha256(await backing.getItem(manifestKey));
    const duplicateSelectorUrl = `${attempt.redirectUrl}&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`;

    await expect(
      cancelPkceAttemptFromUrl(client.auth, duplicateSelectorUrl),
    ).rejects.toThrow("A valid PKCE callback owner is required");
    expect(await sha256(await backing.getItem(manifestKey))).toBe(manifestFingerprint);
  });

  it("binds callbacks to the exact allowed origin and path without exposing the verifier in errors", async () => {
    const backing = createMemoryStorage();
    const client = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl(
      "http://localhost:3000/diary?surface=journal",
      "email-otp",
    );
    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: attempt.redirectUrl },
    });
    const manifestKey = `${storageKey}-zenflow-pkce-attempts`;
    const rawManifest = await backing.getItem(manifestKey);
    const manifestFingerprint = await sha256(rawManifest);
    const privateVerifier = (
      JSON.parse(rawManifest || "null") as { attempts: Array<{ verifier: string }> }
    ).attempts[0].verifier;
    const wrongPath = `http://localhost:3000/settings?surface=journal&code=wrong-path&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`;

    let rejection: unknown;
    try {
      await runWithPkceCallbackUrl(client.auth, wrongPath, () =>
        client.auth.exchangeCodeForSession("wrong-path"),
      );
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toMatchObject({
      message: "This callback does not match the sign-in attempt",
    });
    expect(String(rejection)).not.toContain(privateVerifier);
    expect(await sha256(await backing.getItem(manifestKey))).toBe(manifestFingerprint);
  });

  it("rejects a callback with no attempt selector without touching pending attempts", async () => {
    const backing = createMemoryStorage();
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/otp")) return jsonResponse({});
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    });
    const client = createAuthClient(backing, fetchStub);
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: attempt.redirectUrl },
    });
    fetchStub.mockClear();

    await expect(
      runWithPkceCallbackUrl(client.auth, "http://localhost:3000/?code=missing-owner", () =>
        client.auth.exchangeCodeForSession("missing-owner"),
      ),
    ).rejects.toThrow("legacy sign-in attempt expired; restart authentication");
    expect(fetchStub).not.toHaveBeenCalled();
    await expect(getPkceAttempts(client.auth)).resolves.toEqual([
      expect.objectContaining({ attemptId: attempt.attemptId }),
    ]);
  });

  it("rejects a forged cancellation URL without deleting the selected verifier", async () => {
    const backing = createMemoryStorage();
    const client = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/diary", "email-otp");
    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: attempt.redirectUrl },
    });

    await expect(
      cancelPkceAttemptFromUrl(
        client.auth,
        `https://evil.example/diary?${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`,
      ),
    ).rejects.toThrow("does not match the sign-in attempt");
    await expect(getPkceAttempts(client.auth)).resolves.toEqual([
      expect.objectContaining({ attemptId: attempt.attemptId }),
    ]);
  });

  it("lets auto-detect consume only the selected attempt after reload", async () => {
    const backing = createMemoryStorage();
    const initiator = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await initiator.auth.initialize();
    const first = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    const second = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await initiator.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: first.redirectUrl },
    });
    await initiator.auth.signInWithOtp({
      email: "second@example.test",
      options: { emailRedirectTo: second.redirectUrl },
    });

    const callbackUrl = `http://localhost:3000/?code=callback-a&${PKCE_ATTEMPT_PARAM}=${first.attemptId}`;
    window.history.replaceState({}, "", callbackUrl);
    const reloaded = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse(authResponse())),
      callbackUrl,
      true,
    );

    await expect(reloaded.auth.initialize()).resolves.toMatchObject({ error: null });
    const attempts = await getPkceAttempts(reloaded.auth);
    expect(attempts.map((attempt) => attempt.attemptId)).toEqual([second.attemptId]);
  });

  it("fails closed on an ambiguous auto-detect selector after reload without consuming its verifier", async () => {
    const backing = createMemoryStorage();
    const initiator = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await initiator.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await initiator.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: attempt.redirectUrl },
    });
    const manifestKey = `${storageKey}-zenflow-pkce-attempts`;
    const manifestFingerprint = await sha256(await backing.getItem(manifestKey));
    const callbackUrl = `http://localhost:3000/?code=ambiguous&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}#${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`;
    window.history.replaceState({}, "", callbackUrl);
    const callbackFetch = vi.fn(async () => jsonResponse(authResponse())) as typeof fetch;
    const reloaded = createAuthClient(backing, callbackFetch, callbackUrl, true, true);

    await expect(reloaded.auth.initialize()).rejects.toThrow(
      "This legacy sign-in callback is not valid; restart authentication",
    );
    expect(callbackFetch).not.toHaveBeenCalled();
    expect(await sha256(await backing.getItem(manifestKey))).toBe(manifestFingerprint);
  });

  it("does not consume a PKCE verifier when token_hash verifyOtp succeeds", async () => {
    const backing = createMemoryStorage();
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/otp")) return jsonResponse({});
      if (requestUrl(input).includes("/verify")) return jsonResponse(authResponse());
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    }) as typeof fetch;
    const client = createAuthClient(backing, fetchStub);
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: attempt.redirectUrl },
    });

    await expect(
      client.auth.verifyOtp({ token_hash: "a".repeat(32), type: "email" }),
    ).resolves.toMatchObject({ error: null });
    await expect(getPkceAttempts(client.auth)).resolves.toEqual([
      expect.objectContaining({ attemptId: attempt.attemptId }),
    ]);
  });

  it("survives a crash/reload and consumes only the callback's verifier", async () => {
    const backing = createMemoryStorage();
    const initiationFetch = vi.fn(async () => jsonResponse({})) as typeof fetch;
    const initiator = createAuthClient(backing, initiationFetch);
    await initiator.auth.initialize();
    const first = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    const second = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await initiator.auth.signInWithOtp({
      email: "first@example.test",
      options: { shouldCreateUser: false, emailRedirectTo: first.redirectUrl },
    });
    await initiator.auth.signInWithOtp({
      email: "second@example.test",
      options: { shouldCreateUser: false, emailRedirectTo: second.redirectUrl },
    });

    const callbackUrl = `http://localhost:3000/?code=callback-a&${PKCE_ATTEMPT_PARAM}=${first.attemptId}`;
    const callbackFetch = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).includes("/token?grant_type=pkce")) {
        return jsonResponse(authResponse());
      }
      throw new Error(`Unexpected request: ${requestUrl(input)}`);
    }) as typeof fetch;
    const reloaded = createAuthClient(backing, callbackFetch, callbackUrl);
    await reloaded.auth.initialize();
    await runWithPkceCallbackUrl(reloaded.auth, callbackUrl, () =>
      reloaded.auth.exchangeCodeForSession("callback-a"),
    );

    const attempts = await getPkceAttempts(reloaded.auth);
    expect(attempts.map((attempt) => attempt.attemptId)).not.toContain(first.attemptId);
    expect(attempts.map((attempt) => attempt.attemptId)).toContain(second.attemptId);
    await expect(reloaded.auth.getSession()).resolves.toMatchObject({
      data: { session: { user: { id: ACCOUNT_A } } },
    });

    await expect(
      runWithPkceCallbackUrl(reloaded.auth, callbackUrl, () =>
        reloaded.auth.exchangeCodeForSession("callback-a"),
      ),
    ).rejects.toThrow("not available on this device");
    expect((await getPkceAttempts(reloaded.auth)).map((attempt) => attempt.attemptId)).toEqual([
      second.attemptId,
    ]);
  });

  it("preserves the verifier after a forged or failed callback", async () => {
    const backing = createMemoryStorage();
    const initiator = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await initiator.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "oauth");
    await initiator.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: attempt.redirectUrl, skipBrowserRedirect: true },
    });
    const failedClient = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({ error: "invalid_grant" }, 400)),
    );
    await failedClient.auth.initialize();
    const callbackUrl = `http://localhost:3000/?code=forged&${PKCE_ATTEMPT_PARAM}=${attempt.attemptId}`;

    await runWithPkceCallbackUrl(failedClient.auth, callbackUrl, () =>
      failedClient.auth.exchangeCodeForSession("forged"),
    );

    await expect(getPkceAttempts(failedClient.auth)).resolves.toEqual([
      expect.objectContaining({ attemptId: attempt.attemptId }),
    ]);
  });

  it("supports explicit user cancellation without touching another attempt", async () => {
    const backing = createMemoryStorage();
    const client = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await client.auth.initialize();
    const first = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    const second = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");
    await client.auth.signInWithOtp({
      email: "first@example.test",
      options: { emailRedirectTo: first.redirectUrl },
    });
    await client.auth.signInWithOtp({
      email: "second@example.test",
      options: { emailRedirectTo: second.redirectUrl },
    });

    await cancelPkceAttemptFromUrl(client.auth, first.redirectUrl);

    const attempts = await getPkceAttempts(client.auth);
    expect(attempts.map((attempt) => attempt.attemptId)).toEqual([second.attemptId]);
  });

  it("fails closed when a PKCE producer has no attempt-owned redirect", async () => {
    const backing = createMemoryStorage();
    const client = createAuthClient(
      backing,
      vi.fn(async () => jsonResponse({})),
    );
    await client.auth.initialize();

    await expect(
      client.auth.signInWithOtp({
        email: "missing-owner@example.test",
        options: { emailRedirectTo: "http://localhost:3000/" },
      }),
    ).rejects.toThrow("PKCE attempt ownership is required");
    expect(backing.snapshot()[`${storageKey}-code-verifier`]).toBeUndefined();
  });
});
