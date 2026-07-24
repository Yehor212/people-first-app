import type { JournalEntry } from "./types";

const MIN_PHOTO_LAYOUT_WIDTH = 80;
const MAX_PHOTO_LAYOUT_WIDTH = 500;
export const MAX_JOURNAL_PHOTO_DESCRIPTION_LENGTH = 500;
type JournalPhotoLayout = NonNullable<JournalEntry["photoLayout"]>;
type JournalPhotoLayoutItem = JournalPhotoLayout[string];

export function isJournalPhotoPlaced(layout: JournalPhotoLayoutItem | undefined): boolean {
  return Boolean(layout && !layout.inGallery);
}

export function returnJournalPhotoToGallery(
  layout: JournalPhotoLayout,
  photoId: string,
): JournalPhotoLayout {
  const current = layout[photoId];
  if (!current) return layout;
  return { ...layout, [photoId]: { ...current, inGallery: true } };
}

export function placeJournalPhotoOnPage(
  layout: JournalPhotoLayout,
  photoId: string,
): JournalPhotoLayout {
  const current = layout[photoId];
  if (!current) {
    return { ...layout, [photoId]: { x: 50, y: 50, width: 200 } };
  }
  const { inGallery: _inGallery, ...placed } = current;
  return { ...layout, [photoId]: placed };
}

export function normalizeJournalPhotoDescription(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return Array.from(normalized).slice(0, MAX_JOURNAL_PHOTO_DESCRIPTION_LENGTH).join("");
}

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

    const description = normalizeJournalPhotoDescription(layout.description);
    normalized[photoId] = {
      x: Math.max(0, Math.min(100, layout.x)),
      y: Math.max(0, Math.min(100, layout.y)),
      width: Math.max(MIN_PHOTO_LAYOUT_WIDTH, Math.min(MAX_PHOTO_LAYOUT_WIDTH, layout.width)),
      ...(description ? { description } : {}),
      ...(layout.inGallery === true ? { inGallery: true } : {}),
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
