import { generateSecureRandom } from "./validation";

export const JOURNAL_REPLACE_AUTHORIZATION_TTL_MS = 5 * 60 * 1000;

export type JournalReplaceAuthorizationInvalidationReason =
  | "manual-lock"
  | "background"
  | "sign-out";

export interface JournalReplaceAuthorization {
  readonly id: string;
  readonly expiresAt: number;
  readonly vaultRevision: number;
  readonly sessionGeneration: number;
}

let journalContentVaultKey: string | null = null;
let journalContentVaultRevision: number | null = null;
let journalContentSessionGeneration = 0;
let activeJournalReplaceAuthorization: JournalReplaceAuthorization | null = null;

const JOURNAL_CONTENT_SESSION_CHANNEL = "zenflow-journal-content-session";
const JOURNAL_PROTECTION_REMOVED_MESSAGE = "JOURNAL_PROTECTION_REMOVED";
let journalContentSessionChannel: BroadcastChannel | null = null;

function clearJournalContentSessionState(): void {
  journalContentVaultKey = null;
  journalContentVaultRevision = null;
  activeJournalReplaceAuthorization = null;
  journalContentSessionGeneration += 1;
}

function initializeJournalContentSessionChannel(): void {
  if (
    journalContentSessionChannel ||
    typeof window === "undefined" ||
    typeof window.BroadcastChannel !== "function"
  ) {
    return;
  }

  try {
    journalContentSessionChannel = new window.BroadcastChannel(JOURNAL_CONTENT_SESSION_CHANNEL);
    journalContentSessionChannel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (
        message &&
        typeof message === "object" &&
        (message as { type?: unknown }).type === JOURNAL_PROTECTION_REMOVED_MESSAGE
      ) {
        clearJournalContentSessionState();
      }
    };
  } catch {
    // Persistent settings validation remains authoritative when a browser does
    // not provide a working BroadcastChannel implementation.
    journalContentSessionChannel = null;
  }
}

initializeJournalContentSessionChannel();

export function setJournalContentVaultKey(
  vaultKey: string | null,
  vaultRevision: number | null = null
): void {
  journalContentVaultKey = vaultKey;
  journalContentVaultRevision =
    vaultKey && Number.isFinite(vaultRevision) ? vaultRevision : null;
  journalContentSessionGeneration += 1;
  activeJournalReplaceAuthorization = null;
}

export function getJournalContentVaultKey(): string | null {
  return journalContentVaultKey;
}

export function getJournalContentVaultRevision(): number | null {
  return journalContentVaultRevision;
}

export function issueJournalReplaceAuthorization(
  vaultRevision: number,
  now = Date.now()
): JournalReplaceAuthorization {
  if (!journalContentVaultKey) {
    throw new Error("Unlock the diary before authorizing data replacement");
  }
  if (!Number.isFinite(vaultRevision) || !Number.isFinite(now)) {
    throw new Error("Invalid diary authorization context");
  }
  if (journalContentVaultRevision !== vaultRevision) {
    throw new Error("Diary authorization does not match the active vault revision");
  }

  const authorization: JournalReplaceAuthorization = Object.freeze({
    id: generateSecureRandom(),
    expiresAt: now + JOURNAL_REPLACE_AUTHORIZATION_TTL_MS,
    vaultRevision,
    sessionGeneration: journalContentSessionGeneration,
  });
  activeJournalReplaceAuthorization = authorization;
  return { ...authorization };
}

export function getJournalReplaceAuthorization(): JournalReplaceAuthorization | null {
  return activeJournalReplaceAuthorization ? { ...activeJournalReplaceAuthorization } : null;
}

export function consumeJournalReplaceAuthorization(
  candidate: JournalReplaceAuthorization | null | undefined,
  vaultRevision: number,
  now = Date.now()
): boolean {
  const active = activeJournalReplaceAuthorization;
  const valid = Boolean(
    journalContentVaultKey &&
      active &&
      candidate &&
      candidate.id === active.id &&
      candidate.expiresAt === active.expiresAt &&
      candidate.vaultRevision === active.vaultRevision &&
      candidate.sessionGeneration === active.sessionGeneration &&
      active.vaultRevision === vaultRevision &&
      active.sessionGeneration === journalContentSessionGeneration &&
      Number.isFinite(now) &&
      now <= active.expiresAt
  );

  // Every attempt consumes or invalidates the ambient authorization. A failed
  // attempt must never leave a token available for a later destructive retry.
  activeJournalReplaceAuthorization = null;
  return valid;
}

export function invalidateJournalReplaceAuthorization(
  _reason: JournalReplaceAuthorizationInvalidationReason
): void {
  activeJournalReplaceAuthorization = null;
  journalContentSessionGeneration += 1;
}

export function clearJournalContentSession(
  _reason: JournalReplaceAuthorizationInvalidationReason
): void {
  clearJournalContentSessionState();
}

/**
 * Clears the local key and tells other live tabs to discard theirs. No key,
 * account identifier, or journal metadata is included in the message.
 */
export function notifyJournalProtectionRemoved(): void {
  clearJournalContentSessionState();
  initializeJournalContentSessionChannel();
  try {
    journalContentSessionChannel?.postMessage({
      type: JOURNAL_PROTECTION_REMOVED_MESSAGE,
    });
  } catch {
    // Writers still validate persistent protection under the origin-wide lock.
  }
}
