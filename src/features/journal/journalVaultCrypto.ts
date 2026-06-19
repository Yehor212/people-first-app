import {
  decryptJournalContent,
  encryptJournalContent,
  JournalContentCryptoError,
} from "./journalCrypto";

const JOURNAL_VAULT_KEY_BYTES = 32;
export const JOURNAL_VAULT_KEY_PREFIX = "zenflow:journal-vault-key:v1:";

export class JournalVaultCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalVaultCryptoError";
  }
}

function getWebCrypto(): Crypto {
  if (!globalThis.crypto?.getRandomValues) {
    throw new JournalVaultCryptoError("WebCrypto is unavailable for journal vault key generation");
  }
  return globalThis.crypto;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    throw new JournalVaultCryptoError("Invalid journal vault key encoding");
  }
}

function assertVaultKey(value: string): string {
  const bytes = base64ToBytes(value);
  if (bytes.byteLength !== JOURNAL_VAULT_KEY_BYTES) {
    throw new JournalVaultCryptoError("Invalid journal vault key length");
  }
  return value;
}

function toVaultError(error: unknown): JournalVaultCryptoError {
  if (error instanceof JournalVaultCryptoError) return error;
  if (error instanceof JournalContentCryptoError) {
    return new JournalVaultCryptoError("Failed to unwrap journal vault key");
  }
  return new JournalVaultCryptoError("Invalid journal vault key envelope");
}

export function generateJournalVaultKey(): string {
  const bytes = new Uint8Array(JOURNAL_VAULT_KEY_BYTES);
  getWebCrypto().getRandomValues(bytes);
  return bytesToBase64(bytes);
}

export function isWrappedJournalVaultKey(value: string): boolean {
  return value.startsWith(JOURNAL_VAULT_KEY_PREFIX);
}

export async function wrapJournalVaultKey(vaultKey: string, password: string): Promise<string> {
  const normalizedVaultKey = assertVaultKey(vaultKey);
  const encryptedVaultKey = await encryptJournalContent(normalizedVaultKey, password);
  return JOURNAL_VAULT_KEY_PREFIX + encryptedVaultKey;
}

export async function unwrapJournalVaultKey(wrappedVaultKey: string, password: string): Promise<string> {
  if (!isWrappedJournalVaultKey(wrappedVaultKey)) {
    throw new JournalVaultCryptoError("Journal vault key is not wrapped");
  }

  try {
    const encryptedVaultKey = wrappedVaultKey.slice(JOURNAL_VAULT_KEY_PREFIX.length);
    return assertVaultKey(await decryptJournalContent(encryptedVaultKey, password));
  } catch (error) {
    throw toVaultError(error);
  }
}

export async function rewrapJournalVaultKey(
  wrappedVaultKey: string,
  oldPassword: string,
  newPassword: string,
): Promise<string> {
  const vaultKey = await unwrapJournalVaultKey(wrappedVaultKey, oldPassword);
  return wrapJournalVaultKey(vaultKey, newPassword);
}
