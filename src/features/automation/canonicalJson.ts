import type { AutomationJsonValue } from "./types";

const MAX_CANONICAL_DEPTH = 64;
const MAX_CANONICAL_NODES = 100_000;

export class AutomationCanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomationCanonicalJsonError";
  }
}

interface CanonicalizationState {
  active: WeakSet<object>;
  nodes: number;
}

function normalizeJsonValue(
  value: unknown,
  state: CanonicalizationState,
  depth: number
): AutomationJsonValue {
  state.nodes += 1;
  if (state.nodes > MAX_CANONICAL_NODES) {
    throw new AutomationCanonicalJsonError("Automation value is too complex");
  }
  if (depth > MAX_CANONICAL_DEPTH) {
    throw new AutomationCanonicalJsonError("Automation value is too deeply nested");
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new AutomationCanonicalJsonError("Automation value contains a non-finite number");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new AutomationCanonicalJsonError("Automation value contains a non-JSON value");
  }
  if (state.active.has(value)) {
    throw new AutomationCanonicalJsonError("Automation value contains a cycle");
  }

  state.active.add(value);
  try {
    if (Array.isArray(value)) {
      const normalized: AutomationJsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          throw new AutomationCanonicalJsonError("Automation value contains a sparse array");
        }
        normalized.push(normalizeJsonValue(value[index], state, depth + 1));
      }
      return normalized;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new AutomationCanonicalJsonError("Automation value contains a non-plain object");
    }

    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      throw new AutomationCanonicalJsonError("Automation value contains a symbol key");
    }

    const propertyNames = Object.getOwnPropertyNames(value);
    const enumerableKeys = Object.keys(value);
    if (propertyNames.length !== enumerableKeys.length) {
      throw new AutomationCanonicalJsonError("Automation value contains hidden properties");
    }

    const normalized: Record<string, AutomationJsonValue> = {};
    for (const key of enumerableKeys.sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set) {
        throw new AutomationCanonicalJsonError("Automation value contains an accessor");
      }
      normalized[key] = normalizeJsonValue(descriptor.value, state, depth + 1);
    }
    return normalized;
  } finally {
    state.active.delete(value);
  }
}

export function canonicalizeAutomationValue(value: unknown): string {
  const normalized = normalizeJsonValue(value, { active: new WeakSet(), nodes: 0 }, 0);
  return JSON.stringify(normalized);
}

function getWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new AutomationCanonicalJsonError("WebCrypto is unavailable for automation hashes");
  }
  return globalThis.crypto;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashAutomationValue(value: unknown): Promise<string> {
  const canonical = canonicalizeAutomationValue(value);
  const digest = await getWebCrypto().subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}
