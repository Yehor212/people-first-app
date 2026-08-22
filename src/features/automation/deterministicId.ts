import { canonicalizeAutomationValue } from "./canonicalJson";

const MAX_ID_PARTS = 16;
const MAX_ID_PART_LENGTH = 1_024;

export type AutomationDeterministicIdScope = "target" | "transaction" | "revision";

function getWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("AUTOMATION_ID_CRYPTO_UNAVAILABLE");
  }
  return globalThis.crypto;
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) return true;
  }
  return false;
}

/**
 * Produces an RFC 9562 UUIDv8 from an unambiguous, versioned SHA-256 input.
 * UUIDv8 is used because this is a custom SHA-256 name-based layout rather
 * than the SHA-1 layout defined for UUIDv5.
 */
export async function deriveAutomationUuid(
  scope: AutomationDeterministicIdScope,
  parts: readonly string[],
): Promise<string> {
  if (
    parts.length === 0 ||
    parts.length > MAX_ID_PARTS ||
    parts.some(
      (part) =>
        typeof part !== "string" ||
        part.length === 0 ||
        part.length > MAX_ID_PART_LENGTH ||
        containsControlCharacter(part),
    )
  ) {
    throw new Error("AUTOMATION_ID_INPUT_INVALID");
  }

  const seed = canonicalizeAutomationValue({
    namespace: "zenflow-automation-id",
    parts: [...parts],
    scope,
    version: 1,
  });
  const digest = new Uint8Array(
    await getWebCrypto().subtle.digest("SHA-256", new TextEncoder().encode(seed)),
  );
  const uuidBytes = digest.slice(0, 16);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x80;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  return formatUuid(uuidBytes);
}
