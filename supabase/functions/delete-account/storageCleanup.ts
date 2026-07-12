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

interface StorageBucketClient {
  list(
    path?: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: StorageItem[] | null; error: StorageError | null }>;
  remove(
    paths: string[],
  ): Promise<{ data: unknown[] | null; error: StorageError | null }>;
}

interface StorageClient {
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

interface TraversalState {
  listOperations: number;
}

async function deleteFolderContents(
  bucketClient: StorageBucketClient,
  bucket: string,
  path: string,
  state: TraversalState,
  depth: number,
): Promise<void> {
  if (depth > MAX_FOLDER_DEPTH) {
    throw new Error(`Exceeded folder depth safety limit for ${bucket} objects`);
  }

  let previousPageSignature: string | null = null;

  while (state.listOperations < MAX_DELETE_PAGES_PER_BUCKET) {
    state.listOperations += 1;
    const { data, error } = await bucketClient.list(path, {
      limit: LIST_PAGE_SIZE,
      offset: 0,
    });

    if (error) {
      throw new Error(`Failed to list ${bucket} objects: ${error.message}`);
    }

    const items = data ?? [];
    if (items.length === 0) return;

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
      await deleteFolderContents(
        bucketClient,
        bucket,
        `${path}/${folder.name}`,
        state,
        depth + 1,
      );
    }
  }

  throw new Error(`Exceeded deletion safety limit for ${bucket} objects`);
}

async function deleteBucketPrefix(
  storage: StorageClient,
  bucket: string,
  userId: string,
): Promise<void> {
  const bucketClient = storage.from(bucket);
  await deleteFolderContents(
    bucketClient,
    bucket,
    userId,
    { listOperations: 0 },
    0,
  );
}

export async function deleteUserJournalMedia(
  storage: StorageClient,
  userId: string,
): Promise<void> {
  await deleteBucketPrefix(storage, PHOTO_BUCKET, userId);
  await deleteBucketPrefix(storage, AUDIO_BUCKET, userId);
}
