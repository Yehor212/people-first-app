import { logger } from "@/lib/logger";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import {
  getAttemptScopedAuthStorageControl,
  hasPkceAttemptSelectorFromUrl,
  getPkceAttemptIdFromUrl,
  type AttemptScopedAuthStorage,
  type AuthStorageLike,
  type PkceAttemptPurpose,
  type PkceAttemptRecord,
} from "@/lib/pkceAttemptStorage";

export type { AuthStorageLike } from "@/lib/pkceAttemptStorage";

export const AUTH_TRANSITION_LOCK_NAME = "zenflow:supabase-auth-transition";

const RECONCILIATION_KEY_SUFFIX = "-zenflow-owner-removal";
const SUPABASE_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERIALIZED_AUTH_METHODS = [
  "signInWithOAuth",
  "signInWithOtp",
  "verifyOtp",
  "signInWithIdToken",
] as const;

type SerializedAuthMethodName = (typeof SERIALIZED_AUTH_METHODS)[number];

type AuthMethod = (...args: unknown[]) => unknown;

type OriginLockRunner = <T>(
  name: string,
  operation: () => Promise<T>,
) => Promise<T>;

export type SupabaseAuthLock = <T>(
  name: string,
  acquireTimeout: number,
  operation: () => Promise<T>,
) => Promise<T>;

type AuthTransitionClient = Record<SerializedAuthMethodName, AuthMethod> & {
  exchangeCodeForSession?: AuthMethod;
  _exchangeCodeForSession?: AuthMethod;
  _notifyAllSubscribers: (
    event: "SIGNED_OUT",
    session: null,
    broadcast: false,
  ) => Promise<void>;
};

interface AuthTransitionContext {
  auth: AuthTransitionClient;
  storage: AuthStorageLike;
  storageKey: string;
  reconciliationKey: string;
  broadcastChannel: BroadcastChannel | null;
  pkceControl: AttemptScopedAuthStorage | null;
  pendingPkceCallbackAttemptId: string | null;
  pendingPkceCallbackUrl: string | null;
  pendingPkceCallbackArmed: boolean;
  callbackQueueTail: Promise<void>;
}

export interface OwnerRemovalReconciliationEvent {
  version: 1;
  generation: string;
  removedOwnerFingerprint: string;
}

export type OwnerRemovalReconciliationResult =
  | { status: "signed-out" }
  | { status: "owner-present"; userId: string };

export type ConditionalOwnerRemovalResult =
  | { status: "signed-out" }
  | { status: "no-session" }
  | { status: "owner-changed"; userId: string }
  | { status: "unsupported" };

const authContexts = new WeakMap<object, AuthTransitionContext>();
const configuredAuthClients = new WeakSet<object>();
const seenReconciliationGenerations = new Set<string>();
let fallbackGeneration = 0;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isAuthTransitionClient(value: unknown): value is AuthTransitionClient {
  if (!isObject(value)) return false;
  return (
    SERIALIZED_AUTH_METHODS.every((method) => typeof value[method] === "function") &&
    typeof value._notifyAllSubscribers === "function"
  );
}

function getContext(auth: unknown): AuthTransitionContext | null {
  return isObject(auth) ? authContexts.get(auth) ?? null : null;
}

function createGeneration(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackGeneration += 1;
  return `${Date.now().toString(36)}-${fallbackGeneration.toString(36)}`;
}

async function createOwnerGenerationFingerprint(
  ownerUserId: string,
  generation: string,
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Secure auth reconciliation fingerprinting is unavailable");
  }
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${generation}:${ownerUserId}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseStoredOwner(raw: string | null, label: string): string | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const malformed = new Error(`Unable to verify ${label}`);
    (malformed as Error & { cause?: unknown }).cause = error;
    throw malformed;
  }

  if (!isObject(parsed) || !isObject(parsed.user)) {
    throw new Error(`Unable to verify ${label}`);
  }
  const ownerUserId = parsed.user.id;
  if (typeof ownerUserId !== "string" || !SUPABASE_USER_ID_PATTERN.test(ownerUserId)) {
    throw new Error(`Unable to verify ${label}`);
  }
  return ownerUserId;
}

async function readStoredOwner(
  storage: AuthStorageLike,
  key: string,
  label: string,
): Promise<string | null> {
  return parseStoredOwner(await storage.getItem(key), label);
}

function parseReconciliationEvent(value: unknown): OwnerRemovalReconciliationEvent | null {
  if (!isObject(value)) return null;
  if (
    value.version !== 1 ||
    typeof value.generation !== "string" ||
    !value.generation.trim() ||
    typeof value.removedOwnerFingerprint !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.removedOwnerFingerprint)
  ) {
    return null;
  }
  return {
    version: 1,
    generation: value.generation,
    removedOwnerFingerprint: value.removedOwnerFingerprint,
  };
}

function parseSerializedReconciliationEvent(raw: string | null): OwnerRemovalReconciliationEvent | null {
  if (!raw) return null;
  try {
    return parseReconciliationEvent(JSON.parse(raw));
  } catch {
    return null;
  }
}

function rememberGeneration(generation: string): boolean {
  if (seenReconciliationGenerations.has(generation)) return false;
  seenReconciliationGenerations.add(generation);
  if (seenReconciliationGenerations.size > 128) {
    const oldest = seenReconciliationGenerations.values().next().value;
    if (typeof oldest === "string") seenReconciliationGenerations.delete(oldest);
  }
  return true;
}

/**
 * Supabase's built-in navigator lock may recover a timed-out lock by stealing
 * it while the previous callback is still running. Auth realm transitions must
 * never overlap, so this adapter deliberately ignores the SDK timeout and uses
 * ZenFlow's non-stealing Web Locks/IndexedDB origin lock instead.
 */
type OriginWideAuthLockOptions = {
  runner?: OriginLockRunner;
  pkceControl?: AttemptScopedAuthStorage | null;
};

export function createOriginWideAuthLock(
  options: OriginLockRunner | OriginWideAuthLockOptions = {},
): SupabaseAuthLock {
  const runner = typeof options === "function"
    ? options
    : options.runner ?? runWithOriginExclusiveLock;
  const pkceControl = typeof options === "function" ? null : options.pkceControl ?? null;

  return async <T>(
    _sdkLockName: string,
    _acquireTimeout: number,
    operation: () => Promise<T>,
  ): Promise<T> =>
    runner(AUTH_TRANSITION_LOCK_NAME, () =>
      pkceControl ? pkceControl.runInitialAuthLockOperation(operation) : operation(),
    );
}

export function runSerializedAuthTransition<T>(operation: () => Promise<T>): Promise<T> {
  return runWithOriginExclusiveLock(AUTH_TRANSITION_LOCK_NAME, operation);
}

function getNestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!isObject(value)) return null;
  const candidate = value[key];
  return isObject(candidate) ? candidate : null;
}

function requireOwnedRedirectAttempt(
  rawRedirectUrl: unknown,
  purpose: PkceAttemptPurpose,
): { attemptId: string; purpose: PkceAttemptPurpose; redirectUrl: string } {
  const attemptId =
    typeof rawRedirectUrl === "string" ? getPkceAttemptIdFromUrl(rawRedirectUrl) : null;
  if (!attemptId) {
    throw new Error("PKCE attempt ownership is required before starting authentication");
  }
  return { attemptId, purpose, redirectUrl: rawRedirectUrl as string };
}

function getInitiationAttempt(
  method: SerializedAuthMethodName,
  args: unknown[],
): { attemptId: string; purpose: PkceAttemptPurpose; redirectUrl: string } | null {
  const credentials = isObject(args[0]) ? args[0] : null;
  if (!credentials) return null;

  if (method === "signInWithOAuth") {
    const options = getNestedRecord(credentials, "options");
    return requireOwnedRedirectAttempt(options?.redirectTo, "oauth");
  }

  if (method === "signInWithOtp" && typeof credentials.email === "string") {
    const options = getNestedRecord(credentials, "options");
    return requireOwnedRedirectAttempt(options?.emailRedirectTo, "email-otp");
  }

  return null;
}

function invokeAuthMethod(
  original: AuthMethod,
  receiver: unknown,
  args: unknown[],
): Promise<unknown> {
  return Promise.resolve(original.apply(receiver, args));
}

function enqueuePkceCallback<T>(
  context: AuthTransitionContext,
  operation: () => Promise<T>,
): Promise<T> {
  const queued = context.callbackQueueTail.then(operation, operation);
  context.callbackQueueTail = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

function consumePendingPkceCallback(
  context: AuthTransitionContext,
): { attemptId: string | null; callbackUrl: string } | null {
  if (!context.pendingPkceCallbackArmed) return null;
  const attemptId = context.pendingPkceCallbackAttemptId;
  const callbackUrl = context.pendingPkceCallbackUrl;
  context.pendingPkceCallbackArmed = false;
  context.pendingPkceCallbackAttemptId = null;
  context.pendingPkceCallbackUrl = null;
  return callbackUrl ? { attemptId, callbackUrl } : null;
}

function wrapSerializedAuthMethods(context: AuthTransitionContext): void {
  const { auth, pkceControl } = context;
  for (const method of SERIALIZED_AUTH_METHODS) {
    const original = auth[method];
    Object.defineProperty(auth, method, {
      configurable: true,
      enumerable: false,
      writable: false,
      value: async function serializedAuthTransition(this: unknown, ...args: unknown[]) {
        if (method === "verifyOtp" && pkceControl) {
          const callback = consumePendingPkceCallback(context);
          if (callback) {
            return Promise.reject(
              new Error("verifyOtp token hashes are not PKCE code-verifier consumers"),
            );
          }
        }

        const initiation = pkceControl ? getInitiationAttempt(method, args) : null;
        return runSerializedAuthTransition(() => {
          if (!initiation || !pkceControl) {
            return invokeAuthMethod(original, this, args);
          }
          return pkceControl.runInitiation(
            initiation.attemptId,
            initiation.purpose,
            initiation.redirectUrl,
            () => invokeAuthMethod(original, this, args),
          );
        });
      },
    });
  }

  if (!pkceControl) return;
  const publicExchange = auth.exchangeCodeForSession;
  const privateExchange = auth._exchangeCodeForSession;
  if (typeof publicExchange !== "function" || typeof privateExchange !== "function") {
    throw new Error("The pinned Supabase PKCE exchange contract is unsupported");
  }

  Object.defineProperty(auth, "exchangeCodeForSession", {
    configurable: true,
    enumerable: false,
    writable: false,
    value: async function attemptBoundCodeExchange(this: unknown, ...args: unknown[]) {
      const callback = consumePendingPkceCallback(context);
      if (!callback) return invokeAuthMethod(publicExchange, this, args);

      // auth-js 2.105.4's public method enters the same SDK lock after awaiting
      // initialization. The coordinator already owns that origin lock here, so
      // call the pinned private exchange primitive to avoid a non-reentrant
      // nested lock while retaining the SDK's exact request/session behavior.
      return runSerializedAuthTransition(() =>
        callback.attemptId
          ? pkceControl.runCallback(callback.attemptId, callback.callbackUrl, () =>
              invokeAuthMethod(privateExchange, this, args),
            )
          : pkceControl.runLegacyCallback(callback.callbackUrl, () =>
              invokeAuthMethod(privateExchange, this, args),
            ),
      );
    },
  });
}

async function handleIncomingReconciliation(
  auth: AuthTransitionClient,
  event: OwnerRemovalReconciliationEvent,
): Promise<void> {
  if (!rememberGeneration(event.generation)) return;
  try {
    await reconcileOwnerRemovalEvent(auth, event);
  } catch (error) {
    logger.error("[AuthTransition] Owner-removal reconciliation failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

function installReconciliationListeners(context: AuthTransitionContext): void {
  if (typeof globalThis.BroadcastChannel === "function") {
    try {
      context.broadcastChannel = new globalThis.BroadcastChannel(context.reconciliationKey);
      context.broadcastChannel.addEventListener("message", (message) => {
        if (typeof window === "undefined" || message.origin !== window.location.origin) return;
        const event = parseReconciliationEvent(message.data);
        if (event) void handleIncomingReconciliation(context.auth, event);
      });
    } catch (error) {
      context.broadcastChannel = null;
      logger.warn("[AuthTransition] BroadcastChannel is unavailable", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (storageEvent) => {
      if (storageEvent.key !== context.reconciliationKey) return;
      const event = parseSerializedReconciliationEvent(storageEvent.newValue);
      if (event) void handleIncomingReconciliation(context.auth, event);
    });
  }
}

/**
 * Registers the exact storage realm used by the Supabase client and serializes
 * the four pinned auth-js 2.105.4 methods which save PKCE/session state without
 * first entering the SDK lock. Reconfiguration is intentionally idempotent.
 */
export function configureAuthTransitionClient(
  auth: unknown,
  options: { storage: AuthStorageLike; storageKey: string },
): void {
  if (!isAuthTransitionClient(auth)) {
    throw new Error("The Supabase auth transition contract is unsupported");
  }
  if (!options.storageKey.trim()) {
    throw new Error("The Supabase auth storage key is required");
  }
  if (configuredAuthClients.has(auth)) return;

  const context: AuthTransitionContext = {
    auth,
    storage: options.storage,
    storageKey: options.storageKey,
    reconciliationKey: `${options.storageKey}${RECONCILIATION_KEY_SUFFIX}`,
    broadcastChannel: null,
    pkceControl: getAttemptScopedAuthStorageControl(options.storage),
    pendingPkceCallbackAttemptId: null,
    pendingPkceCallbackUrl: null,
    pendingPkceCallbackArmed: false,
    callbackQueueTail: Promise.resolve(),
  };
  authContexts.set(auth, context);
  wrapSerializedAuthMethods(context);
  installReconciliationListeners(context);
  configuredAuthClients.add(auth);
}

export function runWithPkceCallbackUrl<T>(
  auth: unknown,
  callbackUrl: string,
  operation: () => Promise<T>,
): Promise<T> {
  const context = getContext(auth);
  if (!context?.pkceControl) {
    return Promise.reject(new Error("The PKCE attempt-isolation contract is unsupported"));
  }
  const attemptId = getPkceAttemptIdFromUrl(callbackUrl);
  if (!attemptId && hasPkceAttemptSelectorFromUrl(callbackUrl)) {
    return Promise.reject(new Error("A valid PKCE callback owner is required"));
  }

  return enqueuePkceCallback(context, async () => {
    if (context.pendingPkceCallbackArmed) {
      throw new Error("Another PKCE callback is already pending in this app instance");
    }
    context.pendingPkceCallbackArmed = true;
    context.pendingPkceCallbackAttemptId = attemptId;
    context.pendingPkceCallbackUrl = callbackUrl;

    let result: Promise<T>;
    try {
      result = operation();
    } catch (error) {
      context.pendingPkceCallbackArmed = false;
      context.pendingPkceCallbackAttemptId = null;
      context.pendingPkceCallbackUrl = null;
      throw error;
    }

    if (context.pendingPkceCallbackArmed) {
      context.pendingPkceCallbackArmed = false;
      context.pendingPkceCallbackAttemptId = null;
      context.pendingPkceCallbackUrl = null;
      throw new Error(
        "The PKCE callback operation must immediately call exchangeCodeForSession",
      );
    }
    return result;
  });
}

export async function cancelPkceAttemptFromUrl(
  auth: unknown,
  attemptUrl: string,
): Promise<boolean> {
  const attemptId = getPkceAttemptIdFromUrl(attemptUrl);
  if (!attemptId) {
    if (hasPkceAttemptSelectorFromUrl(attemptUrl)) {
      throw new Error("A valid PKCE callback owner is required");
    }
    return false;
  }
  const context = getContext(auth);
  if (!context?.pkceControl) {
    throw new Error("The PKCE attempt-isolation contract is unsupported");
  }
  const control = context.pkceControl;
  return runSerializedAuthTransition(() => control.cancelFromUrl(attemptId, attemptUrl));
}

export async function getPkceAttempts(auth: unknown): Promise<PkceAttemptRecord[]> {
  const context = getContext(auth);
  if (!context?.pkceControl) {
    throw new Error("The PKCE attempt-isolation contract is unsupported");
  }
  const control = context.pkceControl;
  return runSerializedAuthTransition(() => control.list());
}

export async function publishOwnerRemovalReconciliation(
  auth: unknown,
  removedOwnerUserId: string,
): Promise<OwnerRemovalReconciliationEvent> {
  const context = getContext(auth);
  if (!context) throw new Error("The Supabase auth transition contract is unsupported");
  if (!SUPABASE_USER_ID_PATTERN.test(removedOwnerUserId)) {
    throw new Error("Expected account owner is required");
  }

  const event: OwnerRemovalReconciliationEvent = {
    version: 1,
    generation: createGeneration(),
    removedOwnerFingerprint: "",
  };
  event.removedOwnerFingerprint = await createOwnerGenerationFingerprint(
    removedOwnerUserId,
    event.generation,
  );
  await context.storage.setItem(context.reconciliationKey, JSON.stringify(event));
  context.broadcastChannel?.postMessage(event);
  await context.storage.removeItem(context.reconciliationKey);
  return event;
}

export async function reconcileOwnerRemovalEvent(
  auth: unknown,
  _event: OwnerRemovalReconciliationEvent,
): Promise<OwnerRemovalReconciliationResult> {
  const context = getContext(auth);
  if (!context) throw new Error("The Supabase auth transition contract is unsupported");

  return runSerializedAuthTransition(async () => {
    const currentOwnerUserId = await readStoredOwner(
      context.storage,
      context.storageKey,
      "the current auth session owner",
    );
    if (currentOwnerUserId) {
      return { status: "owner-present", userId: currentOwnerUserId };
    }

    // `broadcast=false` is essential: only the owner/generation-bound ZenFlow
    // event crosses tabs. Each receiver re-reads storage under the transition
    // lock before emitting its own local SDK notification.
    await context.auth._notifyAllSubscribers("SIGNED_OUT", null, false);
    return { status: "signed-out" };
  });
}

export async function removeExpectedOwnerAuthSession(
  auth: unknown,
  expectedOwnerUserId: string,
): Promise<ConditionalOwnerRemovalResult> {
  if (!SUPABASE_USER_ID_PATTERN.test(expectedOwnerUserId)) {
    throw new Error("Expected account owner is required");
  }
  const context = getContext(auth);
  if (!context) return { status: "unsupported" };

  return runSerializedAuthTransition(async () => {
    const currentOwnerUserId = await readStoredOwner(
      context.storage,
      context.storageKey,
      "the current auth session owner",
    );
    if (!currentOwnerUserId) return { status: "no-session" };
    if (currentOwnerUserId !== expectedOwnerUserId) {
      return { status: "owner-changed", userId: currentOwnerUserId };
    }

    const separateUserKey = `${context.storageKey}-user`;
    const separateUserOwnerUserId = await readStoredOwner(
      context.storage,
      separateUserKey,
      "the separately persisted auth user owner",
    );
    if (separateUserOwnerUserId === expectedOwnerUserId) {
      await context.storage.removeItem(separateUserKey);
    }

    // Persist/broadcast the qualified reconciliation marker before mutation.
    // Receivers wait for this same lock, so a failed removal leaves owner A
    // visible and the event is ignored rather than causing a false sign-out.
    await publishOwnerRemovalReconciliation(auth, expectedOwnerUserId);
    await context.storage.removeItem(context.storageKey);

    // Do not remove `${storageKey}-code-verifier`: it may belong to a new PKCE
    // flow started in another tab and is not owner-identifiable.
    await context.auth._notifyAllSubscribers("SIGNED_OUT", null, false);
    return { status: "signed-out" };
  });
}
