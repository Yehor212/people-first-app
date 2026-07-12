interface RowCleanupError {
  message: string;
}

interface RowCleanupResult {
  error: RowCleanupError | null;
}

interface RowCleanupClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: string): PromiseLike<RowCleanupResult>;
    };
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<RowCleanupResult>;
    };
  };
}

const ACCOUNT_ROW_TARGETS = [
  { table: "analytics_events", column: "user_id" },
  { table: "profiles", column: "id" },
  { table: "user_backups", column: "user_id" },
  { table: "push_subscriptions", column: "user_id" },
  { table: "push_device_tokens", column: "user_id" },
] as const;

/**
 * Explicitly purge account-owned rows whose cascade coverage is not assumed by
 * the Edge Function. Any failure blocks auth deletion so the caller can retry
 * rather than reporting success while user-linked records remain.
 */
export async function deleteAccountOwnedRows(
  client: RowCleanupClient,
  userId: string,
): Promise<void> {
  const results = await Promise.all(
    [
      ...ACCOUNT_ROW_TARGETS.map(async ({ table, column }) => ({
        table,
        result: await client.from(table).delete().eq(column, userId),
      })),
      (async () => ({
        table: "design_flags",
        result: await client
          .from("design_flags")
          .update({ updated_by: null })
          .eq("updated_by", userId),
      }))(),
    ],
  );

  const failedTables = results
    .filter(({ result }) => result.error != null)
    .map(({ table }) => table);

  if (failedTables.length > 0) {
    throw new Error(
      `Failed to delete account-owned rows: ${failedTables.join(", ")}`,
    );
  }
}
