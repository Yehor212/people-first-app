import { storageGetRaw, storageRemove, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

export const JOURNAL_PASSWORD_RESET_PARAM = "journalReset";

type JournalPasswordResetProof = {
  nonce: string;
  userId: string;
  receivedAt: number;
};

function normalizeJournalResetNonce(nonce: string | null | undefined): string {
  return typeof nonce === "string" ? nonce.trim() : "";
}

export function getJournalPasswordResetNonceFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const searchNonce = normalizeJournalResetNonce(parsed.searchParams.get(JOURNAL_PASSWORD_RESET_PARAM));
    if (searchNonce) return searchNonce;

    return normalizeJournalResetNonce(
      new URLSearchParams(parsed.hash.replace(/^#/, "")).get(JOURNAL_PASSWORD_RESET_PARAM),
    );
  } catch {
    return "";
  }
}

function parseStoredJournalPasswordResetProof(): JournalPasswordResetProof | null {
  const raw = storageGetRaw(SK.JOURNAL_PASSWORD_RESET_PROOF, "");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<JournalPasswordResetProof>;
    const nonce = normalizeJournalResetNonce(parsed.nonce);
    const userId = typeof parsed.userId === "string" ? parsed.userId.trim() : "";
    const receivedAt = Number(parsed.receivedAt);
    if (!nonce || !userId || !Number.isFinite(receivedAt)) return null;
    return { nonce, userId, receivedAt };
  } catch {
    return null;
  }
}

export function persistJournalPasswordResetProofFromUrl(url: string, userId: string): void {
  const nonce = getJournalPasswordResetNonceFromUrl(url);
  const normalizedUserId = userId.trim();
  if (!nonce || !normalizedUserId) return;

  storageSetRaw(
    SK.JOURNAL_PASSWORD_RESET_PROOF,
    JSON.stringify({ nonce, userId: normalizedUserId, receivedAt: Date.now() } satisfies JournalPasswordResetProof),
  );
}

export function hasStoredJournalPasswordResetProof(
  expectedNonce: string,
  expectedUserId: string,
  maxAgeMs: number,
): boolean {
  const stored = parseStoredJournalPasswordResetProof();
  if (!stored) return false;

  if (Date.now() - stored.receivedAt >= maxAgeMs) {
    storageRemove(SK.JOURNAL_PASSWORD_RESET_PROOF);
    return false;
  }

  if (stored.nonce !== expectedNonce || stored.userId !== expectedUserId) {
    storageRemove(SK.JOURNAL_PASSWORD_RESET_PROOF);
    return false;
  }

  return true;
}

export function consumeJournalPasswordResetProof(
  expectedNonce: string,
  expectedUserId: string,
  maxAgeMs: number,
): boolean {
  if (!hasStoredJournalPasswordResetProof(expectedNonce, expectedUserId, maxAgeMs)) return false;
  storageRemove(SK.JOURNAL_PASSWORD_RESET_PROOF);
  return true;
}

export function clearJournalPasswordResetParamFromCurrentUrl(): void {
  if (typeof window === "undefined") return;

  try {
    const url = new URL(window.location.href);
    let changed = false;

    if (url.searchParams.has(JOURNAL_PASSWORD_RESET_PARAM)) {
      url.searchParams.delete(JOURNAL_PASSWORD_RESET_PARAM);
      changed = true;
    }

    const rawHash = url.hash.replace(/^#/, "");
    if (rawHash) {
      const hashParams = new URLSearchParams(rawHash);
      if (hashParams.has(JOURNAL_PASSWORD_RESET_PARAM)) {
        hashParams.delete(JOURNAL_PASSWORD_RESET_PARAM);
        const cleanHash = hashParams.toString();
        url.hash = cleanHash ? `#${cleanHash}` : "";
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {
    // URL cleanup is privacy-hardening only; reset verification must not depend on it.
  }
}

export function clearJournalPasswordResetProof(): void {
  storageRemove(SK.JOURNAL_PASSWORD_RESET_PROOF);
}
