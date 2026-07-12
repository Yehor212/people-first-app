import { describe, expect, it } from "vitest";
import {
  MAX_PORTABLE_BACKUP_FILE_BYTES,
  PortableBackupCapacityError,
  serializePortableBackupWithinLimit,
} from "../backupCapacity";

describe("portable backup capacity contract", () => {
  it("accepts the exact import limit and rejects the next UTF-8 byte", () => {
    const basePayload = { schemaVersion: 3, data: { settings: [{ key: "note", value: "" }] } };
    const baseJson = JSON.stringify(basePayload);
    const exactPayload = {
      schemaVersion: 3,
      data: {
        settings: [
          {
            key: "note",
            value: "a".repeat(MAX_PORTABLE_BACKUP_FILE_BYTES - baseJson.length),
          },
        ],
      },
    };

    const exact = serializePortableBackupWithinLimit(exactPayload);
    expect(exact.sizeBytes).toBe(MAX_PORTABLE_BACKUP_FILE_BYTES);

    const oversizedPayload = {
      ...exactPayload,
      data: {
        settings: [{ ...exactPayload.data.settings[0], value: `${exactPayload.data.settings[0].value}a` }],
      },
    };
    expect(() => serializePortableBackupWithinLimit(oversizedPayload)).toThrow(
      PortableBackupCapacityError,
    );
    expect(() => serializePortableBackupWithinLimit(oversizedPayload)).toThrowError(
      expect.objectContaining({ code: "BACKUP_TOO_LARGE" }),
    );
  });

  it("counts multibyte user text by UTF-8 bytes rather than JavaScript code units", () => {
    const artifact = serializePortableBackupWithinLimit({ value: "🙂" }, 20);
    expect(artifact.sizeBytes).toBe(16);
    expect(artifact.json).toBe('{"value":"🙂"}');
  });
});
