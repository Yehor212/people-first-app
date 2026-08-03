import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_TRANSITION_LOCK_NAME,
  configureAuthTransitionClient,
  createOriginWideAuthLock,
  publishOwnerRemovalReconciliation,
  reconcileOwnerRemovalEvent,
  runSerializedAuthTransition,
  type AuthStorageLike,
  type OwnerRemovalReconciliationEvent,
} from "@/lib/authTransitionCoordinator";
import { signOutExpectedOwnerWithAuthClient } from "@/lib/ownerBoundAuthSession";
import {
  createAttemptScopedAuthStorage,
  createPkceAttemptRedirectUrl,
} from "@/lib/pkceAttemptStorage";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const STORAGE_KEY = "sb-project-auth-token";

function session(ownerUserId: string, suffix: string) {
  return {
    access_token: `access-${suffix}`,
    refresh_token: `refresh-${suffix}`,
    expires_in: 3_600,
    expires_at: Math.floor(Date.now() / 1_000) + 3_600,
    token_type: "bearer",
    user: {
      id: ownerUserId,
      aud: "authenticated",
      role: "authenticated",
      email: `${suffix}@example.test`,
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-07-18T00:00:00.000Z",
    },
  };
}

function createMemoryStorage(initial: Record<string, string> = {}): AuthStorageLike & {
  snapshot(): Record<string, string>;
} {
  const values = new Map(Object.entries(initial));
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

function json(value: unknown): string {
  return JSON.stringify(value);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
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

function authResponse(ownerUserId: string, suffix: string) {
  const nextSession = session(ownerUserId, suffix);
  return { ...nextSession, user: nextSession.user };
}

function sourceFilesUnder(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      result.push(...sourceFilesUnder(path));
    } else if (/\.(?:ts|tsx)$/.test(entry) && !path.includes("/__tests__/")) {
      result.push(path);
    }
  }
  return result;
}

beforeEach(() => {
  const originalWarn = console.warn.bind(console);
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes("Multiple GoTrueClient instances detected")) return;
    originalWarn(...args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("origin-wide Supabase auth transition coordination", () => {
  it("pins every unlocked auth-js method whose network and storage transition is wrapped", () => {
    const packageJson = JSON.parse(
      readFileSync("node_modules/@supabase/auth-js/package.json", "utf8"),
    ) as { version?: unknown };
    const source = readFileSync(
      "node_modules/@supabase/auth-js/src/GoTrueClient.ts",
      "utf8",
    );
    const helpersSource = readFileSync(
      "node_modules/@supabase/auth-js/src/lib/helpers.ts",
      "utf8",
    );

    expect(packageJson.version).toBe("2.105.4");
    for (const method of [
      "signInWithOAuth",
      "signInWithOtp",
      "verifyOtp",
      "signInWithIdToken",
    ]) {
      const start = source.indexOf(`async ${method}(`);
      const nextMethod = source.indexOf("\n  async ", start + 1);
      const body = source.slice(start, nextMethod === -1 ? source.length : nextMethod);
      expect(start, `${method} must remain present in pinned auth-js`).toBeGreaterThan(-1);
      expect(body, `${method} unexpectedly acquired the SDK lock`).not.toContain("_acquireLock(");
    }
    expect(source).toContain("await this._saveSession(data.session)");
    expect(source).toContain("await this._saveSession(session as Session)");
    expect(source).toContain("private async _exchangeCodeForSession(authCode: string)");
    expect(source).toContain(
      "const storageItem = await getItemAsync(this.storage, `${this.storageKey}-code-verifier`)",
    );
    expect(source).toContain("private async _notifyAllSubscribers(");
    expect(source).toContain("broadcast = true");
    expect(source).toContain("if (this.broadcastChannel && broadcast)");
    expect(helpersSource).toContain("const verifierLength = 56");
    expect(helpersSource).toContain("storedCodeVerifier += '/recovery'");
    expect(helpersSource).toContain(
      "await setItemAsync(storage, `${storageKey}-code-verifier`, storedCodeVerifier)",
    );
  });

  it("keeps every current app PKCE producer on an attempt-owned redirect path", () => {
    const violations: string[] = [];
    const producerSites: string[] = [];

    for (const file of sourceFilesUnder("src")) {
      const source = readFileSync(file, "utf8");
      if (!source.includes(".auth.")) continue;
      const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isPropertyAccessExpression(node.expression.expression) &&
          node.expression.expression.name.text === "auth"
        ) {
          const method = node.expression.name.text;
          const firstArgument = node.arguments[0];
          const objectProperties =
            firstArgument && ts.isObjectLiteralExpression(firstArgument)
              ? new Set(
                  firstArgument.properties.flatMap((property) => {
                    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
                      return [];
                    }
                    return [property.name.getText(sourceFile).replace(/["']/g, "")];
                  }),
                )
              : null;
          const isEmailOtp = method === "signInWithOtp" && objectProperties?.has("email");
          const isEmailUpdate = method === "updateUser" && objectProperties?.has("email");
          const isPkceProducer =
            method === "signInWithOAuth" ||
            method === "signUp" ||
            method === "signInWithSSO" ||
            method === "resetPasswordForEmail" ||
            isEmailOtp ||
            isEmailUpdate;

          if (isPkceProducer) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            producerSites.push(`${file}:${line}:${method}`);
            if (!source.includes("createPkceAttemptRedirectUrl")) {
              violations.push(`${file}:${line}:${method}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    expect(producerSites).toEqual([
      expect.stringMatching(/src\/components\/auth-screen\/useAuthHandlers\.ts:\d+:signInWithOAuth/),
      expect.stringMatching(/src\/components\/settings\/account-section\/useAccountAuth\.ts:\d+:signInWithOAuth/),
      expect.stringMatching(/src\/features\/journal\/JournalModule\.tsx:\d+:signInWithOtp/),
    ]);
    expect(violations).toEqual([]);
  });

  it("keeps auth state callbacks free of awaited Supabase auth calls that would deadlock the transition lock", () => {
    const violations: string[] = [];

    for (const file of sourceFilesUnder("src")) {
      const source = readFileSync(file, "utf8");
      if (!source.includes(".onAuthStateChange")) continue;
      const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "onAuthStateChange"
        ) {
          const callback = node.arguments[0];
          if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
            const inspectCallback = (candidate: ts.Node): void => {
              if (
                ts.isAwaitExpression(candidate) &&
                /\.(?:auth)\./.test(candidate.expression.getText(sourceFile))
              ) {
                const position = sourceFile.getLineAndCharacterOfPosition(candidate.getStart(sourceFile));
                violations.push(`${file}:${position.line + 1}`);
              }
              ts.forEachChild(candidate, inspectCallback);
            };
            inspectCallback(callback.body);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  });

  it("uses one non-stealing origin-wide lock even when navigator.locks is absent", async () => {
    const calls: string[] = [];
    const lock = createOriginWideAuthLock(async (name, operation) => {
      calls.push(name);
      return operation();
    });

    await expect(lock("lock:ignored-sdk-key", 1, async () => "done")).resolves.toBe("done");
    expect(calls).toEqual([AUTH_TRANSITION_LOCK_NAME]);
  });

  it("serializes a writer that starts after owner A was read and preserves its verifier", async () => {
    let releaseRead!: () => void;
    let ownerAWasRead!: () => void;
    const readReached = new Promise<void>((resolve) => {
      ownerAWasRead = resolve;
    });
    const continueRemoval = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const values = new Map<string, string>([
      [STORAGE_KEY, json(session(ACCOUNT_A, "a"))],
      [`${STORAGE_KEY}-code-verifier`, json("b-in-flight-verifier")],
    ]);
    const storage: AuthStorageLike = {
      getItem: async (key) => {
        const value = values.get(key) ?? null;
        if (key === STORAGE_KEY && value?.includes(ACCOUNT_A)) {
          ownerAWasRead();
          await continueRemoval;
        }
        return value;
      },
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    };
    const auth = {
      signInWithOAuth: vi.fn(async () => ({ data: { url: "https://example.test" }, error: null })),
      signInWithOtp: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
      verifyOtp: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
      signInWithIdToken: vi.fn(async (_credentials: unknown) => {
        values.set(STORAGE_KEY, json(session(ACCOUNT_B, "b")));
        return { data: { user: session(ACCOUNT_B, "b").user }, error: null };
      }),
      _notifyAllSubscribers: vi.fn(async () => undefined),
    };
    configureAuthTransitionClient(auth, { storage, storageKey: STORAGE_KEY });

    const removal = signOutExpectedOwnerWithAuthClient(auth, ACCOUNT_A);
    await readReached;
    const writer = auth.signInWithIdToken({ provider: "google", token: "test-id-token" });
    releaseRead();

    await expect(removal).resolves.toEqual({ status: "signed-out" });
    await writer;
    expect(JSON.parse(values.get(STORAGE_KEY) ?? "null").user.id).toBe(ACCOUNT_B);
    expect(JSON.parse(values.get(`${STORAGE_KEY}-code-verifier`) ?? "null")).toBe(
      "b-in-flight-verifier",
    );
  });

  it.each([
    ["signInWithIdToken", "/token?grant_type=id_token"],
    ["verifyOtp", "/verify"],
  ] as const)("preserves a session written by the real GoTrueClient %s path", async (method, endpoint) => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: json(session(ACCOUNT_A, "a")),
    });
    let releaseFetch!: () => void;
    let fetchStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      fetchStarted = resolve;
    });
    const held = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes(endpoint)) {
        fetchStarted();
        await held;
        return jsonResponse(authResponse(ACCOUNT_B, method));
      }
      throw new Error(`Unexpected auth request: ${url}`);
    });
    const client = createClient("https://project.supabase.co", "anon-key", {
      auth: {
        storage,
        storageKey: STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        lock: createOriginWideAuthLock(),
      },
      global: { fetch: fetchStub },
    });
    configureAuthTransitionClient(client.auth, { storage, storageKey: STORAGE_KEY });
    await client.auth.initialize();

    const writer = method === "signInWithIdToken"
      ? client.auth.signInWithIdToken({ provider: "google", token: "test-id-token" })
      : client.auth.verifyOtp({ email: "b@example.test", token: "123456", type: "email" });
    await started;
    const removal = signOutExpectedOwnerWithAuthClient(client.auth, ACCOUNT_A);
    releaseFetch();

    await expect(writer).resolves.toMatchObject({ error: null });
    await expect(removal).resolves.toEqual({ status: "owner-changed", userId: ACCOUNT_B });
    expect(JSON.parse(storage.snapshot()[STORAGE_KEY]).user.id).toBe(ACCOUNT_B);
  });

  it("lets a real ID-token writer establish B after an owner-A removal has already read A", async () => {
    const interleavingStorageKey = `${STORAGE_KEY}-after-read`;
    const values = new Map<string, string>([
      [interleavingStorageKey, json(session(ACCOUNT_A, "a"))],
    ]);
    let pauseOwnerRead = false;
    let ownerReadReached!: () => void;
    let releaseOwnerRead!: () => void;
    const ownerRead = new Promise<void>((resolve) => {
      ownerReadReached = resolve;
    });
    const ownerReadHeld = new Promise<void>((resolve) => {
      releaseOwnerRead = resolve;
    });
    const storage: AuthStorageLike = {
      getItem: async (key) => {
        const captured = values.get(key) ?? null;
        if (pauseOwnerRead && key === interleavingStorageKey) {
          pauseOwnerRead = false;
          ownerReadReached();
          await ownerReadHeld;
        }
        return captured;
      },
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    };
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("/token?grant_type=id_token")) {
        return jsonResponse(authResponse(ACCOUNT_B, "b-after-read"));
      }
      throw new Error(`Unexpected auth request: ${url}`);
    });
    const client = createClient("https://project.supabase.co", "anon-key", {
      auth: {
        storage,
        storageKey: interleavingStorageKey,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        lock: createOriginWideAuthLock(),
      },
      global: { fetch: fetchStub },
    });
    configureAuthTransitionClient(client.auth, {
      storage,
      storageKey: interleavingStorageKey,
    });
    await client.auth.initialize();

    pauseOwnerRead = true;
    const removal = signOutExpectedOwnerWithAuthClient(client.auth, ACCOUNT_A);
    await ownerRead;
    const writer = client.auth.signInWithIdToken({
      provider: "google",
      token: "test-id-token",
    });
    expect(fetchStub).not.toHaveBeenCalled();
    releaseOwnerRead();

    await expect(removal).resolves.toEqual({ status: "signed-out" });
    await expect(writer).resolves.toMatchObject({ error: null });
    expect(JSON.parse(values.get(interleavingStorageKey) ?? "null").user.id).toBe(ACCOUNT_B);
  });

  it("prevents a real in-flight owner-A refresh from resurrecting A after removal", async () => {
    const refreshStorageKey = `${STORAGE_KEY}-refresh`;
    const storage = createMemoryStorage({
      [refreshStorageKey]: json(session(ACCOUNT_A, "a")),
    });
    let releaseFetch!: () => void;
    let fetchStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      fetchStarted = resolve;
    });
    const held = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("/token?grant_type=refresh_token")) {
        fetchStarted();
        await held;
        return jsonResponse(authResponse(ACCOUNT_A, "a-refreshed"));
      }
      throw new Error(`Unexpected auth request: ${url}`);
    });
    const client = createClient("https://project.supabase.co", "anon-key", {
      auth: {
        storage,
        storageKey: refreshStorageKey,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        lock: createOriginWideAuthLock(),
      },
      global: { fetch: fetchStub },
    });
    configureAuthTransitionClient(client.auth, { storage, storageKey: refreshStorageKey });
    await client.auth.initialize();

    const refresh = client.auth.refreshSession();
    await started;
    const removal = signOutExpectedOwnerWithAuthClient(client.auth, ACCOUNT_A);
    releaseFetch();

    await expect(refresh).resolves.toMatchObject({ error: null });
    await expect(removal).resolves.toEqual({ status: "signed-out" });
    expect(storage.snapshot()[refreshStorageKey]).toBeUndefined();
  });

  it("preserves a real email OTP verifier while removing only owner A", async () => {
    const backingStorage = createMemoryStorage({
      [STORAGE_KEY]: json(session(ACCOUNT_A, "a")),
    });
    const scopedStorage = createAttemptScopedAuthStorage(backingStorage, STORAGE_KEY);
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes("/otp")) return jsonResponse({});
      throw new Error(`Unexpected auth request: ${url}`);
    });
    const client = createClient("https://project.supabase.co", "anon-key", {
      auth: {
        storage: scopedStorage.storage,
        storageKey: STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
        lock: createOriginWideAuthLock({ pkceControl: scopedStorage }),
      },
      global: { fetch: fetchStub },
    });
    configureAuthTransitionClient(client.auth, {
      storage: scopedStorage.storage,
      storageKey: STORAGE_KEY,
    });
    await client.auth.initialize();
    const attempt = createPkceAttemptRedirectUrl("http://localhost:3000/", "email-otp");

    await expect(
      client.auth.signInWithOtp({
        email: "b@example.test",
        options: {
          shouldCreateUser: false,
          emailRedirectTo: attempt.redirectUrl,
        },
      }),
    ).resolves.toMatchObject({ error: null });
    const manifestKey = `${STORAGE_KEY}-zenflow-pkce-attempts`;
    const manifestFingerprintBeforeRemoval = await sha256(
      await backingStorage.getItem(manifestKey),
    );
    await expect(scopedStorage.list()).resolves.toEqual([
      expect.objectContaining({ attemptId: attempt.attemptId }),
    ]);

    await expect(signOutExpectedOwnerWithAuthClient(client.auth, ACCOUNT_A)).resolves.toEqual({
      status: "signed-out",
    });
    expect(await sha256(await backingStorage.getItem(manifestKey))).toBe(
      manifestFingerprintBeforeRemoval,
    );
  });

  it("ignores a delayed owner-A reconciliation event when owner B is current", async () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: json(session(ACCOUNT_B, "b")),
    });
    const auth = {
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithIdToken: vi.fn(),
      _notifyAllSubscribers: vi.fn(async () => undefined),
    };
    configureAuthTransitionClient(auth, { storage, storageKey: STORAGE_KEY });
    const event: OwnerRemovalReconciliationEvent = {
      version: 1,
      generation: "generation-a",
      removedOwnerFingerprint: "a".repeat(64),
    };

    await expect(reconcileOwnerRemovalEvent(auth, event)).resolves.toEqual({
      status: "owner-present",
      userId: ACCOUNT_B,
    });
    expect(auth._notifyAllSubscribers).not.toHaveBeenCalled();
  });

  it("accepts reconciliation broadcasts only from the current origin", async () => {
    const channels: TestBroadcastChannel[] = [];

    class TestBroadcastChannel {
      readonly listeners: Array<(event: MessageEvent) => void> = [];

      constructor(readonly name: string) {
        channels.push(this);
      }

      addEventListener(type: string, listener: (event: MessageEvent) => void): void {
        if (type === "message") this.listeners.push(listener);
      }

      postMessage(): void {}

      close(): void {}

      emit(data: unknown, origin: string): void {
        const event = new MessageEvent("message", { data, origin });
        for (const listener of this.listeners) listener(event);
      }
    }

    vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
    const storage = createMemoryStorage();
    const auth = {
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithIdToken: vi.fn(),
      _notifyAllSubscribers: vi.fn(async () => undefined),
    };
    configureAuthTransitionClient(auth, { storage, storageKey: STORAGE_KEY });
    const channel = channels.at(-1);
    expect(channel?.name).toBe(`${STORAGE_KEY}-zenflow-owner-removal`);

    channel?.emit(
      {
        version: 1,
        generation: "cross-origin-generation",
        removedOwnerFingerprint: "a".repeat(64),
      },
      "https://attacker.example",
    );
    await runSerializedAuthTransition(async () => undefined);
    expect(auth._notifyAllSubscribers).not.toHaveBeenCalled();

    channel?.emit(
      {
        version: 1,
        generation: "same-origin-generation",
        removedOwnerFingerprint: "b".repeat(64),
      },
      window.location.origin,
    );
    await runSerializedAuthTransition(async () => undefined);
    expect(auth._notifyAllSubscribers).toHaveBeenCalledWith("SIGNED_OUT", null, false);
  });

  it("reconciles only an empty session and never rebroadcasts an unqualified SIGNED_OUT", async () => {
    const storage = createMemoryStorage();
    const auth = {
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithIdToken: vi.fn(),
      _notifyAllSubscribers: vi.fn(async () => undefined),
    };
    configureAuthTransitionClient(auth, { storage, storageKey: STORAGE_KEY });
    const event = await publishOwnerRemovalReconciliation(auth, ACCOUNT_A);

    await expect(reconcileOwnerRemovalEvent(auth, event)).resolves.toEqual({ status: "signed-out" });
    expect(event.removedOwnerFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(event)).not.toContain(ACCOUNT_A);
    expect(storage.snapshot()).toEqual({});
    expect(auth._notifyAllSubscribers).toHaveBeenCalledWith("SIGNED_OUT", null, false);
  });

  it("serializes arbitrary auth work through the same transition lock", async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = runSerializedAuthTransition(async () => {
      order.push("first:start");
      await held;
      order.push("first:end");
    });
    const second = runSerializedAuthTransition(async () => {
      order.push("second");
    });

    await vi.waitFor(() => expect(order).toEqual(["first:start"]));
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second"]);
  });
});
