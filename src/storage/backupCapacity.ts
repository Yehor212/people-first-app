export const MAX_PORTABLE_BACKUP_FILE_BYTES = 32 * 1024 * 1024;

export class PortableBackupCapacityError extends Error {
  readonly code = "BACKUP_TOO_LARGE";
  readonly maxBytes: number;
  readonly actualBytes: number;

  constructor(maxBytes: number, actualBytes: number) {
    super("Portable backup exceeds ZenFlow's restore limit");
    this.name = "PortableBackupCapacityError";
    this.maxBytes = maxBytes;
    this.actualBytes = actualBytes;
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (
      codeUnit >= 0xd800 &&
      codeUnit <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export interface SerializedPortableBackup {
  json: string;
  sizeBytes: number;
}

/**
 * Serializes once and applies the exact byte limit also used by file import.
 * A successful user export is therefore always eligible for ZenFlow's parser.
 */
export function serializePortableBackupWithinLimit(
  payload: unknown,
  maxBytes = MAX_PORTABLE_BACKUP_FILE_BYTES,
): SerializedPortableBackup {
  const json = JSON.stringify(payload);
  const sizeBytes = utf8ByteLength(json);
  if (sizeBytes > maxBytes) {
    throw new PortableBackupCapacityError(maxBytes, sizeBytes);
  }
  return { json, sizeBytes };
}
