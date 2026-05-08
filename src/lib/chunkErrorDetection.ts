/**
 * Chunk load error detection — single source of truth.
 *
 * Previously duplicated in three places:
 *   - UpdateRequiredDialog.tsx:127-131 (setupChunkErrorHandler, `error` event)
 *   - UpdateRequiredDialog.tsx:166-169 (setupChunkErrorHandler, `unhandledrejection`)
 *   - ErrorBoundary.tsx:218-226 (isChunkLoadError in ModalErrorBoundary)
 *
 * Having one function means a newly-observed failure phrase can be added in
 * one place and immediately propagates to every consumer.
 *
 * Phrases are browser-specific: Chrome, Firefox, Safari, and Capacitor each
 * emit slightly different messages for the same underlying failure mode
 * (stale chunk after deploy).
 */

/**
 * Canonical phrases that indicate a chunk-load failure:
 * - Chrome / most browsers: "Failed to fetch dynamically imported module"
 * - Vite dev: "Loading chunk N failed" / "Loading CSS chunk N failed"
 * - Webpack-style: "ChunkLoadError"
 * - Safari / Firefox: "Importing a module script failed"
 *
 * Extend this array if telemetry surfaces new wording; do not inline extra
 * matches in consumers.
 */
const CHUNK_ERROR_PHRASES = [
  "Failed to fetch dynamically imported module",
  "Loading chunk",
  "Loading CSS chunk",
  "ChunkLoadError",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "Unable to preload CSS",
] as const;

/** Returns true if the error message matches any known chunk-load phrase. */
export function isChunkLoadError(error: Error | null | undefined): boolean {
  const message = error?.message;
  if (!message) return false;
  return CHUNK_ERROR_PHRASES.some((phrase) => message.includes(phrase));
}

/** Same check against a raw string — used for window.onerror message arg. */
export function isChunkLoadMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return CHUNK_ERROR_PHRASES.some((phrase) => message.includes(phrase));
}

/**
 * Extract the chunk filename from a JS path like "/assets/chunk-abc123.js".
 * Returns "unknown" if the pattern does not match.
 */
export function chunkFromFilename(filename: string | null | undefined): string {
  if (!filename) return "unknown";
  const match = filename.match(/\/([^/]+\.js)$/);
  return match ? match[1] : "unknown";
}

/**
 * Extract a chunk filename from an error message that embeds a URL, e.g.
 * "Failed to fetch dynamically imported module: https://host/assets/x.js".
 */
export function chunkFromMessage(message: string | null | undefined): string {
  if (!message) return "unknown";
  const urlMatch = message.match(/https?:\/\/[^\s]+/);
  return urlMatch ? chunkFromFilename(urlMatch[0]) : "unknown";
}
