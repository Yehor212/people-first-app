import { describe, expect, it, vi } from "vitest";

import { runAccountDeletionBarrier } from "./deletionBarrier";

describe("runAccountDeletionBarrier", () => {
  it("blocks stale JWT writes and confirms two emptying passes before deleting auth", async () => {
    const events: string[] = [];
    const purgeMedia = vi.fn(async () => {
      events.push("purge-media");
    });

    await runAccountDeletionBarrier({
      blockStorageWrites: async () => events.push("block"),
      purgeMedia,
      purgeRows: async () => events.push("purge-rows"),
      deleteAuthUser: async () => events.push("delete-auth"),
      releaseStorageBlock: async () => events.push("release"),
    });

    expect(events).toEqual([
      "block",
      "purge-media",
      "purge-rows",
      "purge-media",
      "delete-auth",
    ]);
    expect(purgeMedia).toHaveBeenCalledTimes(2);
  });

  it("releases the storage block when deletion fails before auth is removed", async () => {
    const events: string[] = [];

    await expect(
      runAccountDeletionBarrier({
        blockStorageWrites: async () => events.push("block"),
        purgeMedia: async () => {
          events.push("purge-media");
          throw new Error("storage unavailable");
        },
        purgeRows: async () => events.push("purge-rows"),
        deleteAuthUser: async () => events.push("delete-auth"),
        releaseStorageBlock: async () => events.push("release"),
      }),
    ).rejects.toThrow("storage unavailable");

    expect(events).toEqual(["block", "purge-media", "release"]);
  });
});
