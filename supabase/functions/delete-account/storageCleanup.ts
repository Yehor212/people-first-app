export const PHOTO_BUCKET = "journal-photos";
export const AUDIO_BUCKET = "journal-audio";
export const LIST_PAGE_SIZE = 100;

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

async function deleteBucketPrefix(
  storage: StorageClient,
  bucket: string,
  userId: string,
): Promise<void> {
  const bucketClient = storage.from(bucket);

  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await bucketClient.list(userId, {
      limit: LIST_PAGE_SIZE,
      offset,
    });

    if (error) {
      throw new Error(`Failed to list ${bucket} objects: ${error.message}`);
    }

    const items = data ?? [];
    const paths = items
      .filter(isFileEntry)
      .map((item) => `${userId}/${item.name}`);

    if (paths.length > 0) {
      const { error: removeError } = await bucketClient.remove(paths);
      if (removeError) {
        throw new Error(`Failed to remove ${bucket} objects: ${removeError.message}`);
      }
    }

    if (items.length < LIST_PAGE_SIZE) {
      return;
    }
  }
}

export async function deleteUserJournalMedia(
  storage: StorageClient,
  userId: string,
): Promise<void> {
  await deleteBucketPrefix(storage, PHOTO_BUCKET, userId);
  await deleteBucketPrefix(storage, AUDIO_BUCKET, userId);
}
