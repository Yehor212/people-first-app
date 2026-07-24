import { describe, expect, it } from "vitest";

import {
  AUDIO_BUCKET,
  LIST_PAGE_SIZE,
  PHOTO_BUCKET,
  deleteUserJournalMedia,
  deleteUserJournalMediaBatch,
} from "./storageCleanup";

const USER_ID = "user-1";

type BucketName = typeof PHOTO_BUCKET | typeof AUDIO_BUCKET;

interface StoredObject {
  name: string;
  metadata: Record<string, never>;
}

function makeFlatStorageObject(name: string) {
  return {
    id: `object-${name}`,
    key: name,
    name,
    updated_at: "2026-07-18T00:00:00.000Z",
    created_at: "2026-07-18T00:00:00.000Z",
    last_accessed_at: "2026-07-18T00:00:00.000Z",
    metadata: {},
  };
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
  const flatListPrefixes: Record<BucketName, string[]> = {
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
        async listV2(listOptions: {
          prefix?: string;
          limit?: number;
          with_delimiter?: boolean;
        } = {}) {
          const prefix = listOptions.prefix ?? "";
          const limit = listOptions.limit ?? LIST_PAGE_SIZE;
          flatListPrefixes[bucket].push(prefix);

          return {
            data: {
              folders: [],
              objects: objects[bucket]
                .slice(0, limit)
                .map((item) => makeFlatStorageObject(`${USER_ID}/${item.name}`)),
              hasNext: objects[bucket].length > limit,
            },
            error: null,
          };
        },
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
    flatPrefixes(bucket: BucketName) {
      return flatListPrefixes[bucket];
    },
  };
}

describe("deleteUserJournalMedia", () => {
  it("bounds each resumable batch and converges without an unbounded Edge request", async () => {
    const harness = createStorageHarness(250, 250);
    let complete = false;
    let attempts = 0;

    while (!complete && attempts < 10) {
      const photoListsBefore = harness.offsets(PHOTO_BUCKET).length;
      const audioListsBefore = harness.offsets(AUDIO_BUCKET).length;
      const result = await deleteUserJournalMediaBatch(
        harness.storage,
        USER_ID,
        3,
      );
      const listsThisBatch =
        harness.offsets(PHOTO_BUCKET).length - photoListsBefore +
        harness.offsets(AUDIO_BUCKET).length - audioListsBefore;

      expect(listsThisBatch).toBeLessThanOrEqual(3);
      complete = result.complete;
      attempts += 1;
    }

    expect(complete).toBe(true);
    expect(harness.remaining(PHOTO_BUCKET)).toBe(0);
    expect(harness.remaining(AUDIO_BUCKET)).toBe(0);
  });

  it("converges through the actual bounded path when media is deeper than the list-operation budget", async () => {
    const nestedPhoto = `${USER_ID}/${Array.from(
      { length: 12 },
      (_, index) => `level-${index}`,
    ).join("/")}/photo.bin`;
    const remainingPaths = new Set([nestedPhoto]);
    const flatListCalls: Array<{
      bucket: string;
      prefix?: string;
      withDelimiter?: boolean;
    }> = [];

    const immediateEntries = (path: string) => {
      const entries = new Map<string, { name: string; metadata: unknown }>();
      for (const candidate of remainingPaths) {
        if (!candidate.startsWith(`${path}/`)) continue;
        const suffix = candidate.slice(path.length + 1);
        const [name, ...rest] = suffix.split("/");
        entries.set(
          name,
          rest.length > 0 ? { name, metadata: null } : { name, metadata: {} },
        );
      }
      return [...entries.values()];
    };

    const storage = {
      from(bucket: string) {
        return {
          async list(path = "") {
            return {
              data: bucket === PHOTO_BUCKET ? immediateEntries(path) : [],
              error: null,
            };
          },
          async listV2(options: {
            prefix?: string;
            limit?: number;
            with_delimiter?: boolean;
          } = {}) {
            flatListCalls.push({
              bucket,
              prefix: options.prefix,
              withDelimiter: options.with_delimiter,
            });
            const prefix = options.prefix ?? "";
            const objects = bucket === PHOTO_BUCKET
              ? [...remainingPaths]
                .filter((path) => path.startsWith(prefix))
                .slice(0, options.limit ?? LIST_PAGE_SIZE)
                .map(makeFlatStorageObject)
              : [];
            return {
              data: { folders: [], objects, hasNext: false },
              error: null,
            };
          },
          async remove(paths: string[]) {
            for (const path of paths) remainingPaths.delete(path);
            return { data: [], error: null };
          },
        };
      },
    };

    let complete = false;
    for (let attempt = 0; attempt < 4 && !complete; attempt += 1) {
      const callsBefore = flatListCalls.length;
      const result = await deleteUserJournalMediaBatch(storage, USER_ID, 3);
      expect(flatListCalls.length - callsBefore).toBeLessThanOrEqual(3);
      complete = result.complete;
    }

    expect(complete).toBe(true);
    expect(remainingPaths.size).toBe(0);
    expect(flatListCalls).toContainEqual({
      bucket: PHOTO_BUCKET,
      prefix: `${USER_ID}/`,
      withDelimiter: false,
    });
  });

  it("fails closed if a flat Storage response escapes the authenticated owner prefix", async () => {
    const removed: string[] = [];
    const storage = {
      from() {
        return {
          async list() {
            return { data: [], error: null };
          },
          async listV2() {
            return {
              data: {
                folders: [],
                objects: [makeFlatStorageObject("other-user/private.bin")],
                hasNext: false,
              },
              error: null,
            };
          },
          async remove(paths: string[]) {
            removed.push(...paths);
            return { data: [], error: null };
          },
        };
      },
    };

    await expect(
      deleteUserJournalMediaBatch(storage, USER_ID, 3),
    ).rejects.toThrow(/owner prefix/i);
    expect(removed).toEqual([]);
  });

  it("deletes the owner-bound full key when List V2 returns a relative display name", async () => {
    const removed: string[] = [];
    let listed = false;
    const storage = {
      from() {
        return {
          async list() {
            return { data: [], error: null };
          },
          async listV2() {
            if (listed) {
              return {
                data: { folders: [], objects: [], hasNext: false },
                error: null,
              };
            }
            listed = true;
            return {
              data: {
                folders: [],
                objects: [
                  {
                    ...makeFlatStorageObject("photo.bin"),
                    key: `${USER_ID}/nested/photo.bin`,
                  },
                ],
                hasNext: false,
              },
              error: null,
            };
          },
          async remove(paths: string[]) {
            removed.push(...paths);
            return { data: [], error: null };
          },
        };
      },
    };

    await expect(
      deleteUserJournalMediaBatch(storage, USER_ID, 3),
    ).resolves.toEqual({ complete: true, listOperations: 3 });
    expect(removed).toEqual([`${USER_ID}/nested/photo.bin`]);
  });

  it("fails closed when List V2 supplies no owner-bound full key", async () => {
    const removed: string[] = [];
    const storage = {
      from() {
        return {
          async list() {
            return { data: [], error: null };
          },
          async listV2() {
            return {
              data: {
                folders: [],
                objects: [{ ...makeFlatStorageObject("photo.bin"), key: undefined }],
                hasNext: false,
              },
              error: null,
            };
          },
          async remove(paths: string[]) {
            removed.push(...paths);
            return { data: [], error: null };
          },
        };
      },
    };

    await expect(
      deleteUserJournalMediaBatch(storage, USER_ID, 3),
    ).rejects.toThrow(/owner prefix/i);
    expect(removed).toEqual([]);
  });

  it("fails closed on an empty page that claims more List V2 results", async () => {
    const storage = {
      from() {
        return {
          async list() {
            return { data: [], error: null };
          },
          async listV2() {
            return {
              data: { folders: [], objects: [], hasNext: true },
              error: null,
            };
          },
          async remove() {
            return { data: [], error: null };
          },
        };
      },
    };

    await expect(
      deleteUserJournalMediaBatch(storage, USER_ID, 3),
    ).rejects.toThrow(/invalid flat/i);
  });

  it("fails closed when recursive flat listing is unavailable", async () => {
    const storage = {
      from() {
        return {
          async list() {
            return { data: [], error: null };
          },
          async remove() {
            return { data: [], error: null };
          },
        };
      },
    };

    await expect(
      deleteUserJournalMediaBatch(storage, USER_ID, 3),
    ).rejects.toThrow(/flat listing unavailable/i);
  });

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
