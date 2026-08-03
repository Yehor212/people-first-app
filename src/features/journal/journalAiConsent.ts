import { logger } from "@/lib/logger";
import {
  safeJsonParse,
  safeLocalStorageSet,
  storageCanWrite,
  storageGetRaw,
  storageReadRaw,
  storageRemove,
  storageSetRaw,
} from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { supabase } from "@/lib/supabaseClient";
import { getLocalDataOwnerId } from "@/storage/db";

export const JOURNAL_AI_CONSENT_CHANGE_EVENT = "zenflow:journal-ai-consent-change";
const JOURNAL_AI_CONSENT_STORAGE_PROBE = "__zenflow_journal_ai_consent_probe__";

interface JournalAiRevocationMarker {
  version: 1;
  ownerUserId: string;
  requestedAt: number;
}

export type JournalAiConsentResult =
  | { status: "granted" }
  | { status: "completed" }
  | { status: "none" }
  | { status: "pending" }
  | { status: "owner-mismatch" }
  | { status: "owner-unavailable" }
  | { status: "storage-error" };

let runtimeRevoked = false;
let consentIntentVersion = 0;

function markerKey(ownerUserId: string): string {
  return `${SK.JOURNAL_AI_REVOCATION_PREFIX}${ownerUserId}`;
}

function emitConsentChange(granted: boolean, pending: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(JOURNAL_AI_CONSENT_CHANGE_EVENT, {
      detail: { granted, pending },
    }),
  );
}

function isMarker(value: unknown, ownerUserId: string): value is JournalAiRevocationMarker {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JournalAiRevocationMarker>;
  return (
    candidate.version === 1 &&
    candidate.ownerUserId === ownerUserId &&
    typeof candidate.requestedAt === "number" &&
    Number.isFinite(candidate.requestedAt) &&
    candidate.requestedAt > 0
  );
}

function hasMarker(ownerUserId: string): boolean {
  const stored = storageReadRaw(markerKey(ownerUserId));
  if (!stored.ok || stored.value === null) return false;
  return isMarker(safeJsonParse<unknown>(stored.value, null), ownerUserId);
}

function persistMarker(ownerUserId: string): boolean {
  const marker: JournalAiRevocationMarker = {
    version: 1,
    ownerUserId,
    requestedAt: Date.now(),
  };
  if (!safeLocalStorageSet(markerKey(ownerUserId), marker)) return false;
  return hasMarker(ownerUserId);
}

async function readOwners(): Promise<{
  sessionOwnerId: string | null;
  localOwnerId: string | null;
  sessionReadable: boolean;
}> {
  const localOwnerPromise = getLocalDataOwnerId().catch((error) => {
    logger.warn("[JournalAI] Could not read the local data owner", error);
    return null;
  });

  if (!supabase) {
    return {
      sessionOwnerId: null,
      localOwnerId: await localOwnerPromise,
      sessionReadable: false,
    };
  }

  const [{ data, error }, localOwnerId] = await Promise.all([
    supabase.auth.getSession(),
    localOwnerPromise,
  ]);
  if (error) {
    logger.warn("[JournalAI] Could not verify the active session for consent cleanup", error);
    return { sessionOwnerId: null, localOwnerId, sessionReadable: false };
  }

  const sessionOwnerId = data.session?.user?.id;
  return {
    sessionOwnerId:
      typeof sessionOwnerId === "string" && sessionOwnerId.trim() ? sessionOwnerId : null,
    localOwnerId,
    sessionReadable: true,
  };
}

export function isJournalAiConsentGranted(): boolean {
  return !runtimeRevoked && storageGetRaw(SK.JOURNAL_AI_SEARCH_CONSENT) === "true";
}

export function subscribeJournalAiConsent(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === SK.JOURNAL_AI_SEARCH_CONSENT ||
      event.key?.startsWith(SK.JOURNAL_AI_REVOCATION_PREFIX)
    ) {
      listener();
    }
  };
  window.addEventListener(JOURNAL_AI_CONSENT_CHANGE_EVENT, listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(JOURNAL_AI_CONSENT_CHANGE_EVENT, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function hasPendingJournalAiConsentRevocation(): Promise<boolean> {
  const { sessionOwnerId } = await readOwners();
  return sessionOwnerId ? hasMarker(sessionOwnerId) : false;
}

export async function flushJournalAiConsentRevocation(): Promise<JournalAiConsentResult> {
  const { sessionOwnerId, localOwnerId, sessionReadable } = await readOwners();
  if (!sessionReadable || !sessionOwnerId) return { status: "pending" };
  if (localOwnerId && localOwnerId !== sessionOwnerId) {
    return { status: "owner-mismatch" };
  }
  if (!hasMarker(sessionOwnerId)) return { status: "none" };
  if (!supabase) return { status: "pending" };

  const { error } = await supabase.rpc("revoke_journal_ai_consent");
  if (error) {
    logger.warn("[JournalAI] Consent cleanup is waiting for a connection", error);
    emitConsentChange(false, true);
    return { status: "pending" };
  }

  const key = markerKey(sessionOwnerId);
  if (!storageRemove(key)) return { status: "storage-error" };
  const verified = storageReadRaw(key);
  if (!verified.ok || verified.value !== null) return { status: "storage-error" };

  emitConsentChange(false, false);
  return { status: "completed" };
}

export async function revokeJournalAiConsent(): Promise<JournalAiConsentResult> {
  consentIntentVersion += 1;
  runtimeRevoked = true;
  storageRemove(SK.JOURNAL_AI_SEARCH_CONSENT);
  emitConsentChange(false, true);

  const { sessionOwnerId, localOwnerId } = await readOwners();
  const ownerUserId = sessionOwnerId ?? localOwnerId;
  if (!ownerUserId) {
    emitConsentChange(false, false);
    return { status: "owner-unavailable" };
  }
  if (sessionOwnerId && localOwnerId && sessionOwnerId !== localOwnerId) {
    return { status: "owner-mismatch" };
  }

  if (!persistMarker(ownerUserId)) {
    if (!sessionOwnerId || !supabase) return { status: "storage-error" };
    const { error } = await supabase.rpc("revoke_journal_ai_consent");
    if (error) {
      logger.warn("[JournalAI] Consent cleanup failed without durable retry storage", error);
      return { status: "storage-error" };
    }
    emitConsentChange(false, false);
    return { status: "completed" };
  }

  return flushJournalAiConsentRevocation();
}

export async function grantJournalAiConsent(): Promise<JournalAiConsentResult> {
  const intentVersion = ++consentIntentVersion;
  const cleanup = await flushJournalAiConsentRevocation();
  if (cleanup.status !== "none" && cleanup.status !== "completed") {
    return cleanup;
  }

  const { sessionOwnerId, localOwnerId, sessionReadable } = await readOwners();
  if (!sessionReadable || !sessionOwnerId || !supabase) return { status: "pending" };
  if (localOwnerId && localOwnerId !== sessionOwnerId) {
    return { status: "owner-mismatch" };
  }
  if (!storageCanWrite(JOURNAL_AI_CONSENT_STORAGE_PROBE)) {
    runtimeRevoked = true;
    emitConsentChange(false, false);
    return { status: "storage-error" };
  }

  const { data: consentRow, error: consentReadError } = await supabase
    .from("journal_ai_consents")
    .select("generation")
    .eq("user_id", sessionOwnerId)
    .maybeSingle();
  if (consentReadError) {
    logger.warn("[JournalAI] Server consent generation is unavailable", consentReadError);
    return { status: "pending" };
  }
  const expectedGeneration = consentRow?.generation ?? 0;
  const { data: granted, error } = await supabase.rpc("grant_journal_ai_consent", {
    p_expected_generation: expectedGeneration,
  });
  if (error || granted !== true) {
    runtimeRevoked = true;
    storageRemove(SK.JOURNAL_AI_SEARCH_CONSENT);
    logger.warn("[JournalAI] Server consent grant is waiting for a connection", error);
    emitConsentChange(false, true);
    return { status: "pending" };
  }

  if (intentVersion !== consentIntentVersion) {
    runtimeRevoked = true;
    storageRemove(SK.JOURNAL_AI_SEARCH_CONSENT);
    const markerPersisted = persistMarker(sessionOwnerId);
    const { error: rollbackError } = await supabase.rpc("revoke_journal_ai_consent");
    if (rollbackError) {
      logger.warn("[JournalAI] Cancelled consent rollback is waiting for a connection", rollbackError);
    } else if (markerPersisted) {
      storageRemove(markerKey(sessionOwnerId));
    }
    emitConsentChange(false, Boolean(rollbackError));
    return { status: "none" };
  }

  if (!storageSetRaw(SK.JOURNAL_AI_SEARCH_CONSENT, "true")) {
    runtimeRevoked = true;
    const markerPersisted = persistMarker(sessionOwnerId);
    const { error: rollbackError } = await supabase.rpc("revoke_journal_ai_consent");
    if (rollbackError) {
      logger.warn("[JournalAI] Server consent rollback is waiting for a connection", rollbackError);
    } else if (markerPersisted) {
      storageRemove(markerKey(sessionOwnerId));
    }
    emitConsentChange(false, Boolean(rollbackError));
    return { status: "storage-error" };
  }
  runtimeRevoked = false;
  emitConsentChange(true, false);
  return { status: "granted" };
}
