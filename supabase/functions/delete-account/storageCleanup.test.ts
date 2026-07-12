import { describe, expect, it } from "vitest";

import {
  AUDIO_BUCKET,
  LIST_PAGE_SIZE,
  PHOTO_BUCKET,
  deleteUserJournalMedia,
} from "./storageCleanup";

const USER_ID = "user-1";

type BucketName = typeof PHOTO_BUCKET | typeof AUDIO_BUCKET;

interface StoredObject {
  name: string;
  metadata: Record<string, never>;
}

interface StorageHarnessOptions {
  mutateOnRemove?: boolean;
  removeFailureBucket?: BucketName;
  stopListAfterPerBucket?: number;
}

function makeObjects(prefix: string, count: number): StoredObject[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix}-${index}.bin`,
    metadata: {},
  }));
}

function createStorageHarness(
  photoCount: number,
  audioCount: number,
  options: StorageHarnessOptions = {},
) {
  const {
    mutateOnRemove = true,
    removeFailureBucket,
    stopListAfterPerBucket = Number.POSITIVE_INFINITY,
  } = options;
  const objects: Record<BucketName, StoredObject[]> = {
    [PHOTO_BUCKET]: makeObjects("photo", photoCount),
    [AUDIO_BUCKET]: makeObjects("audio", audioCount),
  };
  const listOffsets: Record<BucketName, number[]> = {
    [PHOTO_BUCKET]: [],
    [AUDIO_BUCKET]: [],
  };

  const storage = {
    from(bucketValue: string) {
      if (bucketValue !== PHOTO_BUCKET && bucketValue !== AUDIO_BUCKET) {
        throw new Error(`Unexpected test bucket: ${bucketValue}`);
      }
      const bucket = bucketValue;

      return {
        async list(
          _path?: string,
          listOptions: { limit?: number; offset?: number } = {},
        ) {
          const limit = listOptions.limit ?? LIST_PAGE_SIZE;
          const offset = listOptions.offset ?? 0;
          listOffsets[bucket].push(offset);

          if (listOffsets[bucket].length > stopListAfterPerBucket) {
            return {
              data: null,
              error: { message: "test harness stopped a non-terminating list loop" },
            };
          }

          return {
            data: objects[bucket].slice(offset, offset + limit),
            error: null,
          };
        },
        async remove(paths: string[]) {
          if (removeFailureBucket === bucket) {
            return {
              data: null,
              error: { message: "permission denied" },
            };
          }

          if (mutateOnRemove) {
            const prefix = `${USER_ID}/`;
            const removedNames = new Set(
              paths.map((path) => (path.startsWith(prefix) ? path.slice(prefix.length) : path)),
            );
            objects[bucket] = objects[bucket].filter((item) => !removedNames.has(item.name));
          }

          return {
            data: paths.map((path) => ({ path })),
            error: null,
          };
        },
      };
    },
  };

  return {
    storage,
    remaining(bucket: BucketName) {
      return objects[bucket].length;
    },
    offsets(bucket: BucketName) {
      return listOffsets[bucket];
    },
  };
}

describe("deleteUserJournalMedia", () => {
  it.each([0, 100, 101, 250])("deletes all %i objects from both journal buckets", async (count) => {
    const harness = createStorageHarness(count, count);

    await deleteUserJournalMedia(harness.storage, USER_ID);

    expect(harness.remaining(PHOTO_BUCKET)).toBe(0);
    expect(harness.remaining(AUDIO_BUCKET)).toBe(0);
  });

  it("restarts listing at offset zero after each mutable page deletion", async () => {
    const harness = createStorageHarness(250, 250);

    await deleteUserJournalMedia(harness.storage, USER_ID);

    expect(harness.offsets(PHOTO_BUCKET)).toEqual([0, 0, 0, 0]);
    expect(harness.offsets(AUDIO_BUCKET)).toEqual([0, 0, 0, 0]);
  });

  it("propagates a storage remove failure before deleting the next bucket", async () => {
    const harness = createStorageHarness(1, 1, {
      removeFailureBucket: PHOTO_BUCKET,
    });

    await expect(deleteUserJournalMedia(harness.storage, USER_ID)).rejects.toThrow(
      "Failed to remove journal-photos objects: permission denied",
    );
    expect(harness.remaining(PHOTO_BUCKET)).toBe(1);
    expect(harness.offsets(AUDIO_BUCKET)).toEqual([]);
  });

  it.each([1, 100])("fails safely when removing %i objects makes no progress", async (count) => {
    const harness = createStorageHarness(count, 0, {
      mutateOnRemove: false,
      stopListAfterPerBucket: 4,
    });

    await expect(deleteUserJournalMedia(harness.storage, USER_ID)).rejects.toThrow(
      /no progress deleting journal-photos objects/i,
    );
    expect(harness.remaining(PHOTO_BUCKET)).toBe(count);
  });

  it("recursively removes media stored below nested date folders", async () => {
    const remainingPaths = new Set([
      `${USER_ID}/2026/07/photo.bin`,
      `${USER_ID}/2026/07/deeper/audio-preview.bin`,
    ]);
    const removeCalls: string[][] = [];

    const descendants = (path: string) =>
      [...remainingPaths].filter((candidate) => candidate.startsWith(`${path}/`));
    const listPath = (path: string): Array<{ name: string; metadata: unknown }> => {
      const immediate = new Map<string, { name: string; metadata: unknown }>();
      for (const candidate of descendants(path)) {
        const suffix = candidate.slice(path.length + 1);
        const [name, ...rest] = suffix.split("/");
        immediate.set(
          name,
          rest.length > 0 ? { name, metadata: null } : { name, metadata: {} },
        );
      }
      return [...immediate.values()];
    };

    const storage = {
      from(bucket: string) {
        return {
          async list(path = "") {
            return {
              data: bucket === PHOTO_BUCKET ? listPath(path) : [],
              error: null,
            };
          },
          async remove(paths: string[]) {
            removeCalls.push(paths);
            for (const path of paths) remainingPaths.delete(path);
            return { data: [], error: null };
          },
        };
      },
    };

    await deleteUserJournalMedia(storage, USER_ID);

    expect(remainingPaths.size).toBe(0);
    expect(removeCalls.flat()).toEqual([
      `${USER_ID}/2026/07/photo.bin`,
      `${USER_ID}/2026/07/deeper/audio-preview.bin`,
    ]);
  });
});
