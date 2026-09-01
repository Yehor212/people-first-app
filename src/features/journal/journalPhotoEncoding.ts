export interface EncodedJournalPhoto {
  dataUrl: string;
  width: number;
  height: number;
  quality: number;
}

type PhotoEncoder = (
  maxDimension: number,
  quality: number,
) => Promise<Omit<EncodedJournalPhoto, "quality"> | EncodedJournalPhoto>;

const DEFAULT_DIMENSIONS = [2560, 2048, 1600, 1280, 960] as const;
const FULL_RESOLUTION_QUALITIES = [0.9, 0.86, 0.82, 0.78, 0.74] as const;
const REDUCED_RESOLUTION_QUALITIES = [0.9, 0.82, 0.74] as const;

export const JOURNAL_PHOTO_TOO_DETAILED_ERROR = "JOURNAL_PHOTO_TOO_DETAILED";

export function getDataUrlDecodedByteLength(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0 || !/;base64(?:;|,)/i.test(dataUrl.slice(0, commaIndex + 1))) {
    throw new Error("Photo encoder returned an invalid data URL");
  }

  const payload = dataUrl.slice(commaIndex + 1).replace(/\s/g, "");
  if (!payload) return 0;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

export async function encodeJournalPhotoWithinLimit(
  encode: PhotoEncoder,
  maxBytes: number,
): Promise<EncodedJournalPhoto> {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error("Photo storage limit is invalid");
  }

  for (const [dimensionIndex, maxDimension] of DEFAULT_DIMENSIONS.entries()) {
    const qualities =
      dimensionIndex === 0 ? FULL_RESOLUTION_QUALITIES : REDUCED_RESOLUTION_QUALITIES;

    for (const quality of qualities) {
      const encoded = await encode(maxDimension, quality);
      if (getDataUrlDecodedByteLength(encoded.dataUrl) <= maxBytes) {
        return { ...encoded, quality };
      }
    }
  }

  throw new Error(JOURNAL_PHOTO_TOO_DETAILED_ERROR);
}
