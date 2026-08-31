const JOURNAL_CONTENT_ENCRYPTION_VERSION = 1;
const JOURNAL_CONTENT_ENCRYPTION_ALG = "AES-GCM";
const JOURNAL_CONTENT_KDF = "PBKDF2-SHA256";
const DEFAULT_PBKDF2_ITERATIONS = 600_000;
const MAX_PBKDF2_ITERATIONS = DEFAULT_PBKDF2_ITERATIONS;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MIN_CIPHERTEXT_BYTES = 16;
const MAX_ADDITIONAL_DATA_BYTES = 2_048;

export const JOURNAL_CONTENT_ENCRYPTION_PREFIX = "zenflow:journal-content:v1:";

type JournalContentEncryptionOptions = {
  iterations?: number;
  additionalData?: string;
  unsafeTestOnlyIvBytes?: Uint8Array;
  unsafeTestOnlySaltBytes?: Uint8Array;
};

type JournalContentDecryptionOptions = {
  additionalData?: string;
};

type JournalContentEnvelope = {
  alg: typeof JOURNAL_CONTENT_ENCRYPTION_ALG;
  ciphertext: string;
  iv: string;
  kdf: typeof JOURNAL_CONTENT_KDF;
  iterations: number;
  salt: string;
  v: typeof JOURNAL_CONTENT_ENCRYPTION_VERSION;
};

export class JournalContentCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalContentCryptoError";
  }
}

function getWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new JournalContentCryptoError("WebCrypto is unavailable for journal content encryption");
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
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getWebCrypto().getRandomValues(bytes);
  return bytes;
}

function normalizeIterations(iterations: number | undefined): number {
  const value = iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_PBKDF2_ITERATIONS) {
    throw new JournalContentCryptoError("Invalid journal content encryption iteration count");
  }
  return value;
}

function normalizeAdditionalData(value: string | undefined): ArrayBuffer | undefined {
  if (value === undefined) return undefined;
  if (value.length === 0) {
    throw new JournalContentCryptoError("Journal content associated data cannot be empty");
  }
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength > MAX_ADDITIONAL_DATA_BYTES) {
    throw new JournalContentCryptoError("Journal content associated data is too large");
  }
  return toArrayBuffer(bytes);
}

function requireEnvelopeBytes(value: string, field: "salt" | "iv" | "ciphertext"): Uint8Array {
  const bytes = base64ToBytes(value);
  if (field === "salt" && bytes.byteLength !== SALT_BYTES) {
    throw new JournalContentCryptoError("Invalid journal content encryption salt length");
  }
  if (field === "iv" && bytes.byteLength !== IV_BYTES) {
    throw new JournalContentCryptoError("Invalid journal content encryption iv length");
  }
  if (field === "ciphertext" && bytes.byteLength < MIN_CIPHERTEXT_BYTES) {
    throw new JournalContentCryptoError("Invalid journal content encryption ciphertext length");
  }
  return bytes;
}

async function deriveContentKey(password: string, saltBytes: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = getWebCrypto().subtle;
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(saltBytes),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: JOURNAL_CONTENT_ENCRYPTION_ALG, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function encodeEnvelope(envelope: JournalContentEnvelope): string {
  const json = JSON.stringify(envelope);
  return JOURNAL_CONTENT_ENCRYPTION_PREFIX + bytesToBase64(new TextEncoder().encode(json));
}

function parseEnvelope(value: string): JournalContentEnvelope {
  if (!isEncryptedJournalContent(value)) {
    throw new JournalContentCryptoError("Journal content is not encrypted");
  }

  try {
    const raw = value.slice(JOURNAL_CONTENT_ENCRYPTION_PREFIX.length);
    const json = new TextDecoder().decode(base64ToBytes(raw));
    const envelope = JSON.parse(json) as Partial<JournalContentEnvelope>;
    if (
      envelope.v !== JOURNAL_CONTENT_ENCRYPTION_VERSION ||
      envelope.alg !== JOURNAL_CONTENT_ENCRYPTION_ALG ||
      envelope.kdf !== JOURNAL_CONTENT_KDF ||
      typeof envelope.iterations !== "number" ||
      typeof envelope.salt !== "string" ||
      typeof envelope.iv !== "string" ||
      typeof envelope.ciphertext !== "string"
    ) {
      throw new Error("Unsupported journal content envelope");
    }

    normalizeIterations(envelope.iterations);
    requireEnvelopeBytes(envelope.salt, "salt");
    requireEnvelopeBytes(envelope.iv, "iv");
    requireEnvelopeBytes(envelope.ciphertext, "ciphertext");

    return envelope as JournalContentEnvelope;
  } catch (error) {
    if (error instanceof JournalContentCryptoError) throw error;
    throw new JournalContentCryptoError("Invalid journal content encryption envelope");
  }
}

export function isEncryptedJournalContent(value: string): boolean {
  return value.startsWith(JOURNAL_CONTENT_ENCRYPTION_PREFIX);
}

export async function encryptJournalContent(
  plaintext: string,
  password: string,
  options: JournalContentEncryptionOptions = {},
): Promise<string> {
  const iterations = normalizeIterations(options.iterations);
  const saltBytes = options.unsafeTestOnlySaltBytes ?? randomBytes(SALT_BYTES);
  const ivBytes = options.unsafeTestOnlyIvBytes ?? randomBytes(IV_BYTES);
  if (saltBytes.byteLength !== SALT_BYTES) {
    throw new JournalContentCryptoError("Invalid journal content encryption salt length");
  }
  if (ivBytes.byteLength !== IV_BYTES) {
    throw new JournalContentCryptoError("Invalid journal content encryption iv length");
  }

  const key = await deriveContentKey(password, saltBytes, iterations);
  const additionalData = normalizeAdditionalData(options.additionalData);
  const ciphertext = await getWebCrypto().subtle.encrypt(
    {
      name: JOURNAL_CONTENT_ENCRYPTION_ALG,
      iv: toArrayBuffer(ivBytes),
      ...(additionalData ? { additionalData } : {}),
    },
    key,
    new TextEncoder().encode(plaintext),
  );

  return encodeEnvelope({
    v: JOURNAL_CONTENT_ENCRYPTION_VERSION,
    alg: JOURNAL_CONTENT_ENCRYPTION_ALG,
    kdf: JOURNAL_CONTENT_KDF,
    iterations,
    salt: bytesToBase64(saltBytes),
    iv: bytesToBase64(ivBytes),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  });
}

export async function decryptJournalContent(
  encryptedContent: string,
  password: string,
  options: JournalContentDecryptionOptions = {},
): Promise<string> {
  const envelope = parseEnvelope(encryptedContent);
  const saltBytes = requireEnvelopeBytes(envelope.salt, "salt");
  const ivBytes = requireEnvelopeBytes(envelope.iv, "iv");
  const ciphertextBytes = requireEnvelopeBytes(envelope.ciphertext, "ciphertext");
  const key = await deriveContentKey(password, saltBytes, envelope.iterations);
  const additionalData = normalizeAdditionalData(options.additionalData);

  try {
    const plaintext = await getWebCrypto().subtle.decrypt(
      {
        name: JOURNAL_CONTENT_ENCRYPTION_ALG,
        iv: toArrayBuffer(ivBytes),
        ...(additionalData ? { additionalData } : {}),
      },
      key,
      toArrayBuffer(ciphertextBytes),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new JournalContentCryptoError("Failed to decrypt journal content");
  }
}

export async function decryptJournalContentIfNeeded(value: string, password: string): Promise<string> {
  if (!isEncryptedJournalContent(value)) return value;
  return decryptJournalContent(value, password);
}
