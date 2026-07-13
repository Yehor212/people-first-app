import type { JournalEntry } from "./types";

const MIN_PHOTO_LAYOUT_WIDTH = 80;
const MAX_PHOTO_LAYOUT_WIDTH = 500;

export function normalizeJournalPhotoLayout(
  value: unknown,
  photoIds: readonly string[]
): JournalEntry["photoLayout"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const linkedPhotoIds = new Set(photoIds);
  const normalized: NonNullable<JournalEntry["photoLayout"]> = {};

  for (const [photoId, rawLayout] of Object.entries(value as Record<string, unknown>)) {
    if (!linkedPhotoIds.has(photoId) || !rawLayout || typeof rawLayout !== "object") continue;
    const layout = rawLayout as Record<string, unknown>;
    if (
      typeof layout.x !== "number" ||
      typeof layout.y !== "number" ||
      typeof layout.width !== "number" ||
      !Number.isFinite(layout.x) ||
      !Number.isFinite(layout.y) ||
      !Number.isFinite(layout.width)
    ) {
      continue;
    }

    normalized[photoId] = {
      x: Math.max(0, Math.min(100, layout.x)),
      y: Math.max(0, Math.min(100, layout.y)),
      width: Math.max(MIN_PHOTO_LAYOUT_WIDTH, Math.min(MAX_PHOTO_LAYOUT_WIDTH, layout.width)),
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
