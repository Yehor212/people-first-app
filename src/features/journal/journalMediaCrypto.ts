const JOURNAL_MEDIA_ENCRYPTION_VERSION = 1;
const JOURNAL_MEDIA_ENCRYPTION_ALG = "AES-GCM";
const IV_BYTES = 12;
const VAULT_KEY_BYTES = 32;
const STORAGE_MAGIC = "ZFJM1";

export const JOURNAL_MEDIA_ENCRYPTION_PREFIX = "zenflow:journal-media:v1:";

interface JournalMediaEnvelope {
  alg: typeof JOURNAL_MEDIA_ENCRYPTION_ALG;
  ciphertext: string;
  iv: string;
  mime: string;
  v: typeof JOURNAL_MEDIA_ENCRYPTION_VERSION;
}

interface JournalMediaStorageHeader {
  alg: typeof JOURNAL_MEDIA_ENCRYPTION_ALG;
  iv: string;
  mime: string;
  v: typeof JOURNAL_MEDIA_ENCRYPTION_VERSION;
}

export class JournalMediaCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalMediaCryptoError";
  }
}

function getWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new JournalMediaCryptoError("WebCrypto is unavailable for journal media encryption");
  }
  return globalThis.crypto;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
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
    throw new JournalMediaCryptoError("Invalid journal media base64 payload");
  }
}

function encodeEnvelope(envelope: JournalMediaEnvelope): string {
  return JOURNAL_MEDIA_ENCRYPTION_PREFIX + bytesToBase64(new TextEncoder().encode(JSON.stringify(envelope)));
}

function parseEnvelope(value: string): JournalMediaEnvelope {
  if (!isEncryptedJournalMediaData(value)) {
    throw new JournalMediaCryptoError("Journal media is not encrypted");
  }

  try {
    const payload = value.slice(JOURNAL_MEDIA_ENCRYPTION_PREFIX.length);
    const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(payload))) as Partial<JournalMediaEnvelope>;
    if (
      parsed.v !== JOURNAL_MEDIA_ENCRYPTION_VERSION ||
      parsed.alg !== JOURNAL_MEDIA_ENCRYPTION_ALG ||
      typeof parsed.iv !== "string" ||
      typeof parsed.mime !== "string" ||
      typeof parsed.ciphertext !== "string" ||
      base64ToBytes(parsed.iv).byteLength !== IV_BYTES ||
      base64ToBytes(parsed.ciphertext).byteLength < 16
    ) {
      throw new Error("Unsupported journal media envelope");
    }
    return parsed as JournalMediaEnvelope;
  } catch (error) {
    if (error instanceof JournalMediaCryptoError) throw error;
    throw new JournalMediaCryptoError("Invalid journal media encryption envelope");
  }
}

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) {
    throw new JournalMediaCryptoError("Journal media must be a base64 data URL");
  }
  return { mime: match[1], bytes: base64ToBytes(match[2]) };
}

function assertVaultKey(vaultKey: string): Uint8Array {
  const keyBytes = base64ToBytes(vaultKey);
  if (keyBytes.byteLength !== VAULT_KEY_BYTES) {
    throw new JournalMediaCryptoError("Invalid journal media vault key length");
  }
  return keyBytes;
}

async function importVaultKey(vaultKey: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return getWebCrypto().subtle.importKey(
    "raw",
    toArrayBuffer(assertVaultKey(vaultKey)),
    { name: JOURNAL_MEDIA_ENCRYPTION_ALG, length: 256 },
    false,
    usages,
  );
}

function randomIv(): Uint8Array {
  const iv = new Uint8Array(IV_BYTES);
  getWebCrypto().getRandomValues(iv);
  return iv;
}

export function isEncryptedJournalMediaData(value: string): boolean {
  return value.startsWith(JOURNAL_MEDIA_ENCRYPTION_PREFIX);
}

export async function encryptJournalMediaDataUrl(dataUrl: string, vaultKey: string): Promise<string> {
  if (!dataUrl || isEncryptedJournalMediaData(dataUrl)) return dataUrl;

  const { mime, bytes } = parseDataUrl(dataUrl);
  const iv = randomIv();
  const key = await importVaultKey(vaultKey, ["encrypt"]);
  const ciphertext = await getWebCrypto().subtle.encrypt(
    { name: JOURNAL_MEDIA_ENCRYPTION_ALG, iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(bytes),
  );

  return encodeEnvelope({
    v: JOURNAL_MEDIA_ENCRYPTION_VERSION,
    alg: JOURNAL_MEDIA_ENCRYPTION_ALG,
    mime,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  });
}

export async function decryptJournalMediaDataUrl(encrypted: string, vaultKey: string): Promise<string> {
  const envelope = parseEnvelope(encrypted);
  const key = await importVaultKey(vaultKey, ["decrypt"]);

  try {
    const plaintext = await getWebCrypto().subtle.decrypt(
      { name: JOURNAL_MEDIA_ENCRYPTION_ALG, iv: toArrayBuffer(base64ToBytes(envelope.iv)) },
      key,
      toArrayBuffer(base64ToBytes(envelope.ciphertext)),
    );
    return "data:" + envelope.mime + ";base64," + bytesToBase64(new Uint8Array(plaintext));
  } catch {
    throw new JournalMediaCryptoError("Failed to decrypt journal media");
  }
}

export async function decryptJournalMediaDataUrlIfNeeded(value: string, vaultKey: string | null): Promise<string> {
  const normalized = encryptedJournalMediaFromStorageDataUrl(value);
  if (!isEncryptedJournalMediaData(normalized)) return normalized;
  if (!vaultKey) return "";
  return decryptJournalMediaDataUrl(normalized, vaultKey);
}

function writeUint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

export function encryptedJournalMediaToStorageBlob(encrypted: string): Blob {
  const envelope = parseEnvelope(encrypted);
  const header: JournalMediaStorageHeader = {
    v: envelope.v,
    alg: envelope.alg,
    mime: envelope.mime,
    iv: envelope.iv,
  };
  const magicBytes = new TextEncoder().encode(STORAGE_MAGIC);
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const ciphertextBytes = base64ToBytes(envelope.ciphertext);
  const sizeBytes = writeUint32(headerBytes.byteLength);
  const packageBytes = new Uint8Array(
    magicBytes.byteLength + sizeBytes.byteLength + headerBytes.byteLength + ciphertextBytes.byteLength,
  );
  let offset = 0;
  packageBytes.set(magicBytes, offset);
  offset += magicBytes.byteLength;
  packageBytes.set(sizeBytes, offset);
  offset += sizeBytes.byteLength;
  packageBytes.set(headerBytes, offset);
  offset += headerBytes.byteLength;
  packageBytes.set(ciphertextBytes, offset);

  return new Blob([packageBytes], { type: "application/octet-stream" });
}

export function encryptedJournalMediaFromStorageDataUrl(value: string): string {
  if (!value || isEncryptedJournalMediaData(value)) return value;
  const match = /^data:application\/octet-stream;base64,(.*)$/s.exec(value);
  if (!match) return value;

  try {
    const packageBytes = base64ToBytes(match[1]);
    const magicBytes = new TextEncoder().encode(STORAGE_MAGIC);
    if (packageBytes.byteLength < magicBytes.byteLength + 4) return value;
    for (let i = 0; i < magicBytes.byteLength; i += 1) {
      if (packageBytes[i] !== magicBytes[i]) return value;
    }

    const headerLength = readUint32(packageBytes, magicBytes.byteLength);
    const headerStart = magicBytes.byteLength + 4;
    const headerEnd = headerStart + headerLength;
    if (headerLength <= 0 || headerEnd >= packageBytes.byteLength) {
      throw new Error("Invalid journal media storage header length");
    }

    const header = JSON.parse(new TextDecoder().decode(packageBytes.slice(headerStart, headerEnd))) as Partial<JournalMediaStorageHeader>;
    if (
      header.v !== JOURNAL_MEDIA_ENCRYPTION_VERSION ||
      header.alg !== JOURNAL_MEDIA_ENCRYPTION_ALG ||
      typeof header.iv !== "string" ||
      typeof header.mime !== "string"
    ) {
      throw new Error("Invalid journal media storage header");
    }

    return encodeEnvelope({
      v: JOURNAL_MEDIA_ENCRYPTION_VERSION,
      alg: JOURNAL_MEDIA_ENCRYPTION_ALG,
      mime: header.mime,
      iv: header.iv,
      ciphertext: bytesToBase64(packageBytes.slice(headerEnd)),
    });
  } catch (error) {
    if (error instanceof JournalMediaCryptoError) throw error;
    throw new JournalMediaCryptoError("Invalid encrypted journal media storage payload");
  }
}
