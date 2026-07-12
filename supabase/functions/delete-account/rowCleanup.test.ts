import { describe, expect, it, vi } from "vitest";

import { deleteAccountOwnedRows } from "./rowCleanup";

describe("deleteAccountOwnedRows", () => {
  it("explicitly deletes every non-cascade-sensitive account row including analytics", async () => {
    const calls: Array<{
      table: string;
      method: "delete" | "update";
      column: string;
      userId: string;
      values?: Record<string, unknown>;
    }> = [];
    const client = {
      from(table: string) {
        const eq = async (
          method: "delete" | "update",
          column: string,
          userId: string,
          values?: Record<string, unknown>,
        ) => {
          calls.push({
            table,
            method,
            column,
            userId,
            ...(values === undefined ? {} : { values }),
          });
          return { error: null };
        };
        return {
          delete() {
            return {
              eq: (column: string, userId: string) =>
                eq("delete", column, userId),
            };
          },
          update(values: Record<string, unknown>) {
            return {
              eq: (column: string, userId: string) =>
                eq("update", column, userId, values),
            };
          },
        };
      },
    };

    await deleteAccountOwnedRows(client, "user-123");

    expect(calls).toEqual([
      { table: "analytics_events", method: "delete", column: "user_id", userId: "user-123" },
      { table: "profiles", method: "delete", column: "id", userId: "user-123" },
      { table: "user_backups", method: "delete", column: "user_id", userId: "user-123" },
      { table: "push_subscriptions", method: "delete", column: "user_id", userId: "user-123" },
      { table: "push_device_tokens", method: "delete", column: "user_id", userId: "user-123" },
      {
        table: "design_flags",
        method: "update",
        column: "updated_by",
        userId: "user-123",
        values: { updated_by: null },
      },
    ]);
  });

  it("fails closed before auth deletion when any explicit row cleanup fails", async () => {
    const client = {
      from(table: string) {
        return {
          delete() {
            return {
              async eq() {
                return {
                  error: table === "analytics_events"
                    ? { message: "permission denied" }
                    : null,
                };
              },
            };
          },
          update() {
            return {
              async eq() {
                return { error: null };
              },
            };
          },
        };
      },
    };

    await expect(deleteAccountOwnedRows(client, "user-123")).rejects.toThrow(
      "Failed to delete account-owned rows: analytics_events",
    );
  });

  it("does not log or swallow deletion failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = {
      from() {
        return {
          delete() {
            return {
              async eq() {
                return { error: { message: "database unavailable" } };
              },
            };
          },
          update() {
            return {
              async eq() {
                return { error: { message: "database unavailable" } };
              },
            };
          },
        };
      },
    };

    await expect(deleteAccountOwnedRows(client, "user-123")).rejects.toThrow();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
