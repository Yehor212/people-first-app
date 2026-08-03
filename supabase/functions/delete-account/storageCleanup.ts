export const PHOTO_BUCKET = "journal-photos";
export const AUDIO_BUCKET = "journal-audio";
export const LIST_PAGE_SIZE = 100;
const MAX_DELETE_PAGES_PER_BUCKET = 10_000;
const MAX_FOLDER_DEPTH = 64;

interface StorageItem {
  name?: string | null;
  metadata?: unknown;
}

interface StorageError {
  message: string;
}

interface StorageFlatListResult {
  folders: unknown[];
  objects: unknown[];
  hasNext: boolean;
  nextCursor?: string;
}

interface StorageBucketClient {
  listV2?(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    with_delimiter?: boolean;
    sortBy?: { column: "name"; order: "asc" };
  }): Promise<{ data: StorageFlatListResult | null; error: StorageError | null }>;
  list(
    path?: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: StorageItem[] | null; error: StorageError | null }>;
  remove(
    paths: string[],
  ): Promise<{ data: unknown[] | null; error: StorageError | null }>;
}

export interface StorageClient {
  from(bucket: string): StorageBucketClient;
}

function isFileEntry(item: StorageItem): item is Required<Pick<StorageItem, "name">> & StorageItem {
  return typeof item.name === "string" && item.name.length > 0 && item.metadata != null;
}

function isSafeEntryName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readOwnedFlatObjectPaths(
  value: unknown,
  bucket: string,
  ownerPrefix: string,
): string[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.folders) ||
    value.folders.length !== 0 ||
    !Array.isArray(value.objects) ||
    value.objects.length > LIST_PAGE_SIZE ||
    (value.objects.length === 0 && value.hasNext === true) ||
    typeof value.hasNext !== "boolean"
  ) {
    throw new Error(`Invalid flat ${bucket} listing response`);
  }

  const paths: string[] = [];
  for (const object of value.objects) {
    if (
      !isRecord(object) ||
      typeof object.name !== "string" ||
      object.name.length === 0 ||
      object.name.includes("\0")
    ) {
      throw new Error(`Flat ${bucket} listing escaped the owner prefix`);
    }

    // List V2 exposes a display `name` and may expose the full object `key`.
    // Prefer the full key whenever it is present. Older compatible responses
    // may put the full key in `name`; a relative name without a full key is not
    // sufficient authority for deletion and therefore fails closed.
    const path =
      typeof object.key === "string" && object.key.length > 0
        ? object.key
        : object.name;
    if (
      path.length <= ownerPrefix.length ||
      !path.startsWith(ownerPrefix) ||
      path.includes("\0")
    ) {
      throw new Error(`Flat ${bucket} listing escaped the owner prefix`);
    }
    paths.push(path);
  }
  return paths;
}

interface TraversalState {
  listOperations: number;
  maxListOperations: number;
}

async function deleteFolderContents(
  bucketClient: StorageBucketClient,
  bucket: string,
  path: string,
  state: TraversalState,
  depth: number,
): Promise<boolean> {
  if (depth > MAX_FOLDER_DEPTH) {
    throw new Error(`Exceeded folder depth safety limit for ${bucket} objects`);
  }

  let previousPageSignature: string | null = null;

  while (state.listOperations < state.maxListOperations) {
    state.listOperations += 1;
    const { data, error } = await bucketClient.list(path, {
      limit: LIST_PAGE_SIZE,
      offset: 0,
    });

    if (error) {
      throw new Error(`Failed to list ${bucket} objects: ${error.message}`);
    }

    const items = data ?? [];
    if (items.length === 0) return true;

    if (items.some((item) => !isSafeEntryName(item.name))) {
      throw new Error(`Unsafe ${bucket} object name encountered during deletion`);
    }

    const pageSignature = items
      .map((item) => `${item.metadata == null ? "folder" : "file"}:${item.name}`)
      .sort()
      .join("\n");
    if (pageSignature === previousPageSignature) {
      throw new Error(`No progress deleting ${bucket} objects`);
    }
    previousPageSignature = pageSignature;

    const filePaths = items
      .filter(isFileEntry)
      .map((item) => `${path}/${item.name}`);
    if (filePaths.length > 0) {
      const { error: removeError } = await bucketClient.remove(filePaths);
      if (removeError) {
        throw new Error(`Failed to remove ${bucket} objects: ${removeError.message}`);
      }
    }

    const folders = items.filter(
      (item): item is Required<Pick<StorageItem, "name">> & StorageItem =>
        isSafeEntryName(item.name) && item.metadata == null,
    );
    for (const folder of folders) {
      const folderComplete = await deleteFolderContents(
        bucketClient,
        bucket,
        `${path}/${folder.name}`,
        state,
        depth + 1,
      );
      if (!folderComplete) return false;
    }
  }

  return false;
}

async function deleteBucketPrefix(
  storage: StorageClient,
  bucket: string,
  userId: string,
  state: TraversalState,
): Promise<boolean> {
  const bucketClient = storage.from(bucket);
  return deleteFolderContents(
    bucketClient,
    bucket,
    userId,
    state,
    0,
  );
}

async function deleteFlatBucketPrefix(
  storage: StorageClient,
  bucket: string,
  ownerPrefix: string,
  state: TraversalState,
): Promise<boolean> {
  const bucketClient = storage.from(bucket);
  if (typeof bucketClient.listV2 !== "function") {
    throw new Error(`Recursive flat listing unavailable for ${bucket}`);
  }

  let previousPageSignature: string | null = null;
  while (state.listOperations < state.maxListOperations) {
    state.listOperations += 1;
    const { data, error } = await bucketClient.listV2({
      prefix: ownerPrefix,
      limit: LIST_PAGE_SIZE,
      with_delimiter: false,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new Error(`Failed to list ${bucket} objects: ${error.message}`);
    }

    const paths = readOwnedFlatObjectPaths(data, bucket, ownerPrefix);
    if (paths.length === 0) return true;

    const pageSignature = [...paths].sort().join("\n");
    if (pageSignature === previousPageSignature) {
      throw new Error(`No progress deleting ${bucket} objects`);
    }
    previousPageSignature = pageSignature;

    const { error: removeError } = await bucketClient.remove(paths);
    if (removeError) {
      throw new Error(`Failed to remove ${bucket} objects: ${removeError.message}`);
    }
  }

  return false;
}

export interface DeleteUserJournalMediaBatchResult {
  complete: boolean;
  listOperations: number;
}

/**
 * Deletes a bounded, restart-safe slice. The V2 listing is deliberately flat,
 * so deeply nested object keys are returned without spending one request per
 * virtual folder. Every list restarts at the exact owner prefix after removal;
 * this avoids stale cursors skipping keys when the result set compacts.
 */
export async function deleteUserJournalMediaBatch(
  storage: StorageClient,
  userId: string,
  maxListOperations: number,
): Promise<DeleteUserJournalMediaBatchResult> {
  if (
    !Number.isInteger(maxListOperations) ||
    maxListOperations < 2 ||
    maxListOperations > MAX_DELETE_PAGES_PER_BUCKET
  ) {
    throw new Error("Invalid journal media deletion batch limit");
  }
  if (!isSafeEntryName(userId)) {
    throw new Error("Invalid journal media owner prefix");
  }

  const state: TraversalState = {
    listOperations: 0,
    maxListOperations,
  };
  const ownerPrefix = `${userId}/`;
  const photosComplete = await deleteFlatBucketPrefix(
    storage,
    PHOTO_BUCKET,
    ownerPrefix,
    state,
  );
  if (!photosComplete) {
    return { complete: false, listOperations: state.listOperations };
  }

  const audioComplete = await deleteFlatBucketPrefix(
    storage,
    AUDIO_BUCKET,
    ownerPrefix,
    state,
  );
  return {
    complete: audioComplete,
    listOperations: state.listOperations,
  };
}

export async function deleteUserJournalMedia(
  storage: StorageClient,
  userId: string,
): Promise<void> {
  for (const bucket of [PHOTO_BUCKET, AUDIO_BUCKET]) {
    const state: TraversalState = {
      listOperations: 0,
      maxListOperations: MAX_DELETE_PAGES_PER_BUCKET,
    };
    const complete = await deleteBucketPrefix(storage, bucket, userId, state);
    if (!complete) {
      throw new Error(`Exceeded deletion safety limit for ${bucket} objects`);
    }
  }
}
