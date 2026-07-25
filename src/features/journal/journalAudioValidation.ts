import { MAX_AUDIO_DURATION_SEC } from "./types";

export const JOURNAL_AUDIO_MAX_BYTES = 20 * 1024 * 1024;

export const JOURNAL_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
] as const;

const JOURNAL_AUDIO_MIME_SET = new Set<string>(JOURNAL_AUDIO_MIME_TYPES);
const AUDIO_DATA_URL_PATTERN = /^data:([^,]+);base64,([A-Za-z0-9+/]*={0,2})$/i;
const AUDIO_CODEC_PARAMETER_PATTERN = /^codecs=(?:"[a-z0-9._+-]+"|[a-z0-9._+-]+)$/i;

export interface JournalAudioDataUrlInspection {
  byteLength: number;
  mimeType: string;
}

export function normalizeJournalAudioMimeType(value: string): string | null {
  const mimeType = value.split(";", 1)[0]?.trim().toLowerCase();
  return mimeType && JOURNAL_AUDIO_MIME_SET.has(mimeType) ? mimeType : null;
}

export function inspectJournalAudioDataUrl(
  dataUrl: string,
  expectedMimeType: string,
): JournalAudioDataUrlInspection | null {
  const expected = normalizeJournalAudioMimeType(expectedMimeType);
  const match = AUDIO_DATA_URL_PATTERN.exec(dataUrl);
  if (!expected || !match) return null;

  const [declaredValue, ...parameters] = match[1].split(";").map((part) => part.trim());
  const declared = normalizeJournalAudioMimeType(declaredValue);
  const payload = match[2];
  if (
    !declared ||
    declared !== expected ||
    payload.length === 0 ||
    parameters.some((parameter) => !AUDIO_CODEC_PARAMETER_PATTERN.test(parameter))
  ) {
    return null;
  }

  const paddingIndex = payload.indexOf("=");
  const padding = paddingIndex === -1 ? 0 : payload.length - paddingIndex;
  if ((padding > 0 && payload.length % 4 !== 0) || (padding === 0 && payload.length % 4 === 1)) {
    return null;
  }

  const unpaddedLength = payload.length - padding;
  const byteLength = Math.floor((unpaddedLength * 6) / 8);
  return byteLength > 0 ? { byteLength, mimeType: expected } : null;
}

export function assertValidJournalAudio(
  dataUrl: string,
  duration: number,
  mimeType: string,
): JournalAudioDataUrlInspection {
  if (
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > MAX_AUDIO_DURATION_SEC
  ) {
    throw new Error(`Invalid audio duration. Maximum duration is ${MAX_AUDIO_DURATION_SEC} seconds.`);
  }

  const inspection = inspectJournalAudioDataUrl(dataUrl, mimeType);
  if (!inspection) {
    throw new Error("Invalid or unsupported audio recording data.");
  }
  if (inspection.byteLength > JOURNAL_AUDIO_MAX_BYTES) {
    throw new Error("Audio recording too large. Maximum size is 20 MB.");
  }
  return inspection;
}
