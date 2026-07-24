const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECOVERY_SECRET_PATTERN =
  /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

export interface AccountDeletionCapability {
  operationId: string;
  recoverySecret: string;
}

export interface SecureRandomSource {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
}

export function isAccountDeletionOperationId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_PATTERN.test(value);
}

export function isAccountDeletionRecoverySecret(value: unknown): value is string {
  return typeof value === "string" && RECOVERY_SECRET_PATTERN.test(value);
}

export function isAccountDeletionCapability(
  value: unknown,
): value is AccountDeletionCapability {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AccountDeletionCapability>;
  return (
    isAccountDeletionOperationId(candidate.operationId) &&
    isAccountDeletionRecoverySecret(candidate.recoverySecret)
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    encoded += BASE64URL_ALPHABET[first >> 2];
    encoded += BASE64URL_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    if (index + 1 < bytes.length) {
      encoded +=
        BASE64URL_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    }
    if (index + 2 < bytes.length) {
      encoded += BASE64URL_ALPHABET[third & 0x3f];
    }
  }
  return encoded;
}

export function createAccountDeletionCapability(
  cryptoSource: SecureRandomSource | null = globalThis.crypto,
): AccountDeletionCapability {
  if (!cryptoSource || typeof cryptoSource.getRandomValues !== "function") {
    throw new Error("Secure account deletion recovery is unavailable");
  }

  const uuidBytes = cryptoSource.getRandomValues(new Uint8Array(16));
  const secretBytes = cryptoSource.getRandomValues(new Uint8Array(32));
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x40;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  const hex = Array.from(uuidBytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return {
    operationId: [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-"),
    recoverySecret: bytesToBase64Url(secretBytes),
  };
}
