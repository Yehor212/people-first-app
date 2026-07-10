import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { runProvisionedSmoke } = require("../smoke-sync-account.cjs") as {
  runProvisionedSmoke: (client: { from: (table: string) => unknown }, userId: string, user: unknown) => Promise<void>;
};

describe("live sync smoke account boundary", () => {
  it("exposes a testable provisioned-write boundary without executing on import", () => {
    const source = readFileSync("scripts/smoke-sync-account.cjs", "utf8");

    expect(source).toContain("async function runProvisionedSmoke");
    expect(source).toContain("if (require.main === module)");
    expect(source).toContain("module.exports = { runProvisionedSmoke }");
  });

  it("refuses durable synthetic writes unless the authenticated account is provisioned for smoke data", () => {
    const source = readFileSync("scripts/smoke-sync-account.cjs", "utf8");
    const markerCheck = source.indexOf("user_metadata?.zenflow_sync_smoke !== true");
    const firstDurableWrite = source.indexOf("const upsert = await insertEvent(client");

    expect(markerCheck).toBeGreaterThan(0);
    expect(firstDurableWrite).toBeGreaterThan(markerCheck);
    expect(source).toContain('throw new Error("authenticated account is not provisioned for sync smoke writes")');
    expect(source).not.toContain("account=${userId");
  });

  it("executes zero writes without the marker and reaches the first write with it", async () => {
    const unmarkedFrom = vi.fn(() => {
      throw new Error("WRITE_ATTEMPT");
    });
    await expect(
      runProvisionedSmoke({ from: unmarkedFrom }, "user-1", { user_metadata: {} }),
    ).rejects.toThrow("authenticated account is not provisioned for sync smoke writes");
    expect(unmarkedFrom).not.toHaveBeenCalled();

    const markedFrom = vi.fn(() => {
      throw new Error("WRITE_ATTEMPT");
    });
    await expect(
      runProvisionedSmoke({ from: markedFrom }, "user-1", { user_metadata: { zenflow_sync_smoke: true } }),
    ).rejects.toThrow("WRITE_ATTEMPT");
    expect(markedFrom).toHaveBeenCalledTimes(1);
    expect(markedFrom).toHaveBeenCalledWith("sync_events");
  });
});
