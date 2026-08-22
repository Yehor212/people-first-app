function compareCanonicalKeys(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const sharedLength = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index];
  }
  return leftBytes.length - rightBytes.length;
}

export function canonicalJournalInventoryJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Diary removal inventory contains a non-finite number");
    }
    const serialized = JSON.stringify(value);
    const exponent = serialized.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
    if (!exponent) return serialized;
    const [, sign, integer, fraction = "", rawExponent] = exponent;
    const digits = `${integer}${fraction}`;
    const decimalIndex = integer.length + Number(rawExponent);
    if (decimalIndex <= 0) return `${sign}0.${"0".repeat(-decimalIndex)}${digits}`;
    if (decimalIndex >= digits.length) {
      return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
    }
    return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJournalInventoryJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareCanonicalKeys(left, right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJournalInventoryJson(item)}`)
      .join(",")}}`;
  }
  throw new Error("Diary removal inventory contains an unsupported value");
}

export async function journalInventorySha256(value: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Diary removal inventory hashing is unavailable");
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJournalInventoryJson(value))
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type JournalInventorySecurityProjectionKind =
  | "entry-row"
  | "photo-row"
  | "audio-row"
  | "entry-backup"
  | "photo-backup"
  | "audio-backup"
  | "space-backup"
  | "capture-backup";

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Diary removal inventory ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Diary removal inventory ${label} must be a string`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  return value === undefined || value === null ? null : stringValue(value, label);
}

function vaultRevision(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Diary removal inventory ${label} is invalid`);
  }
  return value.toString(10);
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Diary removal inventory ${label} must be a finite number`);
  }
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Diary removal inventory ${label} must be a string array`);
  }
  return value;
}

const nullableValue = (value: unknown): unknown => (value === undefined ? null : value);

/** Canonical projection shared by the local receipt, RPC payload, and SQL verifier. */
export function journalInventorySecurityProjection(
  kind: JournalInventorySecurityProjectionKind,
  value: unknown
): Record<string, unknown> {
  const item = record(value, kind);
  const id = stringValue(item.id, `${kind}.id`);
  switch (kind) {
    case "entry-row":
      return {
        id,
        date: stringValue(item.date, `${kind}.date`),
        title: stringValue(item.title, `${kind}.title`),
        content: stringValue(item.content, `${kind}.content`),
        stickers: stringArray(item.stickers, `${kind}.stickers`),
        mood: nullableString(item.mood, `${kind}.mood`),
        tags: stringArray(item.tags, `${kind}.tags`),
        template_id: nullableString(item.templateId, `${kind}.templateId`),
        habit_snapshot: nullableValue(item.habitSnapshot),
        photo_ids: stringArray(item.photoIds, `${kind}.photoIds`),
        audio_ids: stringArray(item.audioIds ?? [], `${kind}.audioIds`),
        photo_layout: nullableValue(item.photoLayout),
        bg_pattern: nullableString(item.bgPattern, `${kind}.bgPattern`),
        bg_intensity: nullableString(item.bgIntensity, `${kind}.bgIntensity`),
        paper_color: nullableString(item.paperColor, `${kind}.paperColor`),
        paper_texture: nullableString(item.paperTexture, `${kind}.paperTexture`),
        font: nullableString(item.font, `${kind}.font`),
        font_size: nullableString(item.fontSize, `${kind}.fontSize`),
        ink_color: nullableString(item.inkColor, `${kind}.inkColor`),
        theme: nullableString(item.theme, `${kind}.theme`),
        particle_speed: nullableString(item.particleSpeed, `${kind}.particleSpeed`),
        created_at: numberValue(item.createdAt, `${kind}.createdAt`),
        updated_at: numberValue(item.updatedAt, `${kind}.updatedAt`),
        vault_revision: vaultRevision(item.vaultRevision, `${kind}.vaultRevision`),
      };
    case "photo-row":
      return {
        id,
        entry_id: stringValue(item.entryId, `${kind}.entryId`),
        width: numberValue(item.width, `${kind}.width`),
        height: numberValue(item.height, `${kind}.height`),
        storage_path: nullableString(item.storagePath, `${kind}.storagePath`),
        storage_url: nullableString(item.storageUrl, `${kind}.storageUrl`),
        created_at: numberValue(item.createdAt, `${kind}.createdAt`),
        vault_revision: vaultRevision(item.vaultRevision, `${kind}.vaultRevision`),
      };
    case "audio-row":
      return {
        id,
        entry_id: stringValue(item.entryId, `${kind}.entryId`),
        duration: numberValue(item.duration, `${kind}.duration`),
        mime_type: stringValue(item.mimeType, `${kind}.mimeType`),
        storage_path: nullableString(item.storagePath, `${kind}.storagePath`),
        storage_url: nullableString(item.storageUrl, `${kind}.storageUrl`),
        created_at: numberValue(item.createdAt, `${kind}.createdAt`),
        vault_revision: vaultRevision(item.vaultRevision, `${kind}.vaultRevision`),
      };
    default:
      return item;
  }
}
