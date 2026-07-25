const CONFIRM_PARAM = "zenflowConfirm";
const TOKEN_HASH_PARAM = "token_hash";
const TYPE_PARAM = "type";
const CONFIRM_EVENT = "zenflow:journal-magic-link-confirmation";
const TOKEN_HASH_PATTERN = /^[A-Za-z0-9._~-]{32,2048}$/;
const LOOPBACK_PORTS = new Set(["3000", "4173", "4174", "4175", "4176", "5173", "8080"]);
const APP_ROUTES = new Set(["/", "/orb", "/habits", "/diary", "/planning", "/settings"]);

export interface JournalMagicLinkConfirmation {
  sourceUrl: string;
  tokenHash: string;
}

let stagedConfirmation: JournalMagicLinkConfirmation | null = null;

function isTrustedWebConfirmationUrl(url: URL): boolean {
  if (url.protocol === "https:" && url.hostname === "yehor212.github.io") {
    return (
      url.pathname === "/people-first-app" ||
      url.pathname.startsWith("/people-first-app/")
    );
  }

  if (url.protocol === "https:" && url.hostname === "zenflow.app") {
    const route = url.pathname.endsWith("/") && url.pathname !== "/"
      ? url.pathname.slice(0, -1)
      : url.pathname;
    return APP_ROUTES.has(route);
  }

  if (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") &&
    LOOPBACK_PORTS.has(url.port)
  ) {
    return true;
  }

  return url.protocol === "capacitor:" && url.hostname === "localhost";
}

function isTrustedNativeConfirmationUrl(url: URL): boolean {
  return (
    url.protocol === "com.zenflow.app:" &&
    url.hostname === "login-callback" &&
    (url.pathname === "" || url.pathname === "/")
  );
}

export function parseJournalMagicLinkConfirmation(
  rawUrl: string,
): JournalMagicLinkConfirmation | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!isTrustedWebConfirmationUrl(url) && !isTrustedNativeConfirmationUrl(url)) {
    return null;
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const tokenHash = (hashParams.get(TOKEN_HASH_PARAM) || "").trim();
  if (
    hashParams.get(CONFIRM_PARAM) !== "1" ||
    hashParams.get(TYPE_PARAM) !== "email" ||
    !TOKEN_HASH_PATTERN.test(tokenHash)
  ) {
    return null;
  }

  return { sourceUrl: url.toString(), tokenHash };
}

export function stripJournalMagicLinkSecretsFromUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  hashParams.delete(CONFIRM_PARAM);
  hashParams.delete(TOKEN_HASH_PARAM);
  hashParams.delete(TYPE_PARAM);
  const cleanHash = hashParams.toString();
  url.hash = cleanHash ? `#${cleanHash}` : "";
  return `${url.pathname}${url.search}${url.hash}`;
}

export function stageJournalMagicLinkConfirmation(rawUrl: string): boolean {
  const parsed = parseJournalMagicLinkConfirmation(rawUrl);
  if (!parsed) return false;

  stagedConfirmation = parsed;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONFIRM_EVENT));
  }
  return true;
}

export function consumeStagedJournalMagicLinkConfirmation(): JournalMagicLinkConfirmation | null {
  const confirmation = stagedConfirmation;
  stagedConfirmation = null;
  return confirmation;
}

export function subscribeToJournalMagicLinkConfirmations(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CONFIRM_EVENT, callback);
  return () => window.removeEventListener(CONFIRM_EVENT, callback);
}
