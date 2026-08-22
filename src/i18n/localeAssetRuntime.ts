import type { Language, Translations } from "./types";

const LANGUAGE_ASSET_CODES = "(?:uk|es|de|fr|ja|ar|he)";
const LANGUAGE_SCRIPT_PATTERN = new RegExp(
  `/(?:${LANGUAGE_ASSET_CODES})-[A-Za-z0-9_-]+\\.js$`,
);
const LANGUAGE_JSON_PATTERN = new RegExp(
  `/locale-(?:${LANGUAGE_ASSET_CODES})-[A-Za-z0-9_-]+\\.json$`,
);

// Seven loader scripts plus seven dictionaries for both the active and prior
// deployment. Expiration removes older hashed pairs after successful requests.
export const LANGUAGE_RUNTIME_CACHE_MAX_ENTRIES = 28;

export function isLanguageRuntimeAssetRequest(
  pathname: string,
  destination: RequestDestination,
): boolean {
  if (!pathname.startsWith("/") || pathname.includes("://") || !pathname.includes("/assets/")) {
    return false;
  }
  if (destination === "script") return LANGUAGE_SCRIPT_PATTERN.test(pathname);
  if (destination === "") return LANGUAGE_JSON_PATTERN.test(pathname);
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasTranslationShape(candidate: unknown, reference: unknown): boolean {
  if (typeof reference === "string") return typeof candidate === "string";
  if (!isRecord(reference) || !isRecord(candidate)) return false;

  const referenceKeys = Object.keys(reference);
  const candidateKeys = Object.keys(candidate);
  if (referenceKeys.length !== candidateKeys.length) return false;
  return referenceKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(candidate, key) &&
      hasTranslationShape(candidate[key], reference[key]),
  );
}

export async function resolveTranslationPayload(
  payload: unknown,
  english: Translations,
  language: Language,
): Promise<Translations> {
  const resolved = await payload;
  if (!resolved) throw new Error(`Language dictionary is empty: ${language}`);
  if (!hasTranslationShape(resolved, english)) {
    throw new Error(`Language dictionary has invalid shape: ${language}`);
  }
  return resolved as Translations;
}
