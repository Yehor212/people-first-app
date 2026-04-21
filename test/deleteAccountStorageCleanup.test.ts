import { describe, expect, it } from "vitest";
import {
  AUDIO_BUCKET,
  deleteUserJournalMedia,
  LIST_PAGE_SIZE,
  PHOTO_BUCKET,
} from "../supabase/functions/delete-account/storageCleanup";

interface MockFileEntry {
  name: string;
  metadata: Record<string, unknown>;
}

interface MockFolderEntry {
  name: string;
  metadata: null;
}

type MockStorageEntry = MockFileEntry | MockFolderEntry;

class MockBucket {
  public readonly listCalls: Array<{ path?: string; limit?: number; offset?: number }> = [];
  public readonly removeCalls: string[][] = [];

  public constructor(
    private readonly entries: MockStorageEntry[],
    private readonly options: {
      listErrorAtOffset?: number;
      removeErrorAtCall?: number;
    } = {},
  ) {}

  public async list(
    path?: string,
    params?: { limit?: number; offset?: number },
  ): Promise<{ data: MockStorageEntry[]; error: { message: string } | null }> {
    this.listCalls.push({
      path,
      limit: params?.limit,
      offset: params?.offset,
    });

    if (params?.offset === this.options.listErrorAtOffset) {
      return { data: [], error: { message: "list failed" } };
    }

    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? this.entries.length;
    return {
      data: this.entries.slice(offset, offset + limit),
      error: null,
    };
  }

  public async remove(
    paths: string[],
  ): Promise<{ data: unknown[]; error: { message: string } | null }> {
    this.removeCalls.push(paths);

    if (this.removeCalls.length === this.options.removeErrorAtCall) {
      return { data: [], error: { message: "remove failed" } };
    }

    return { data: [], error: null };
  }
}

class MockStorage {
  public readonly buckets: Record<string, MockBucket>;

  public constructor(buckets: Record<string, MockBucket>) {
    this.buckets = buckets;
  }

  public from(bucket: string): MockBucket {
    const bucketClient = this.buckets[bucket];
    if (!bucketClient) {
      throw new Error(`Unexpected bucket ${bucket}`);
    }
    return bucketClient;
  }
}

function makeFileEntries(count: number, prefix: string): MockFileEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix}-${index}.bin`,
    metadata: { size: 123 },
  }));
}

describe("deleteUserJournalMedia", () => {
  it("removes user media from both journal buckets", async () => {
    const photoBucket = new MockBucket([{ name: "photo-1.jpg", metadata: { size: 1 } }]);
    const audioBucket = new MockBucket([{ name: "audio-1.webm", metadata: { size: 1 } }]);
    const storage = new MockStorage({
      [PHOTO_BUCKET]: photoBucket,
      [AUDIO_BUCKET]: audioBucket,
    });

    await deleteUserJournalMedia(storage, "user-123");

    expect(photoBucket.listCalls).toEqual([
      { path: "user-123", limit: LIST_PAGE_SIZE, offset: 0 },
    ]);
    expect(audioBucket.listCalls).toEqual([
      { path: "user-123", limit: LIST_PAGE_SIZE, offset: 0 },
    ]);
    expect(photoBucket.removeCalls).toEqual([["user-123/photo-1.jpg"]]);
    expect(audioBucket.removeCalls).toEqual([["user-123/audio-1.webm"]]);
  });

  it("paginates through large buckets", async () => {
    const photoBucket = new MockBucket(makeFileEntries(LIST_PAGE_SIZE + 2, "photo"));
    const audioBucket = new MockBucket([]);
    const storage = new MockStorage({
      [PHOTO_BUCKET]: photoBucket,
      [AUDIO_BUCKET]: audioBucket,
    });

    await deleteUserJournalMedia(storage, "user-123");

    expect(photoBucket.listCalls).toEqual([
      { path: "user-123", limit: LIST_PAGE_SIZE, offset: 0 },
      { path: "user-123", limit: LIST_PAGE_SIZE, offset: LIST_PAGE_SIZE },
    ]);
    expect(photoBucket.removeCalls).toHaveLength(2);
    expect(photoBucket.removeCalls[0]).toHaveLength(LIST_PAGE_SIZE);
    expect(photoBucket.removeCalls[1]).toEqual([
      "user-123/photo-100.bin",
      "user-123/photo-101.bin",
    ]);
  });

  it("ignores folder entries returned by list", async () => {
    const photoBucket = new MockBucket([
      { name: "nested-folder", metadata: null },
      { name: "photo-1.jpg", metadata: { size: 1 } },
    ]);
    const audioBucket = new MockBucket([]);
    const storage = new MockStorage({
      [PHOTO_BUCKET]: photoBucket,
      [AUDIO_BUCKET]: audioBucket,
    });

    await deleteUserJournalMedia(storage, "user-123");

    expect(photoBucket.removeCalls).toEqual([["user-123/photo-1.jpg"]]);
  });

  it("fails closed when listing storage objects fails", async () => {
    const storage = new MockStorage({
      [PHOTO_BUCKET]: new MockBucket([], { listErrorAtOffset: 0 }),
      [AUDIO_BUCKET]: new MockBucket([]),
    });

    await expect(deleteUserJournalMedia(storage, "user-123")).rejects.toThrow(
      "Failed to list journal-photos objects: list failed",
    );
  });

  it("fails closed when deleting storage objects fails", async () => {
    const storage = new MockStorage({
      [PHOTO_BUCKET]: new MockBucket(
        [{ name: "photo-1.jpg", metadata: { size: 1 } }],
        { removeErrorAtCall: 1 },
      ),
      [AUDIO_BUCKET]: new MockBucket([]),
    });

    await expect(deleteUserJournalMedia(storage, "user-123")).rejects.toThrow(
      "Failed to remove journal-photos objects: remove failed",
    );
  });
});
