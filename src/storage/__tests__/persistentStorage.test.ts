import { beforeEach, describe, expect, it, vi } from "vitest";

describe("persistent storage request", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("requests persistence once after confirming the origin is still best effort", async () => {
    const persisted = vi.fn().mockResolvedValue(false);
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted, persist },
    });

    const { requestPersistentStorageForCriticalData } = await import("../persistentStorage");
    await Promise.all([
      requestPersistentStorageForCriticalData(),
      requestPersistentStorageForCriticalData(),
    ]);

    expect(persisted).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("does not request again when persistence is already granted", async () => {
    const persisted = vi.fn().mockResolvedValue(true);
    const persist = vi.fn();
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted, persist },
    });

    const { requestPersistentStorageForCriticalData } = await import("../persistentStorage");
    await requestPersistentStorageForCriticalData();

    expect(persist).not.toHaveBeenCalled();
  });

  it("keeps unsupported or denied persistence non-fatal", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: undefined,
    });
    const { requestPersistentStorageForCriticalData } = await import("../persistentStorage");

    await expect(requestPersistentStorageForCriticalData()).resolves.toBe(false);
  });

  it("wires the request after a successful diary entry commit", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile("src/features/journal/journalStorage.ts", "utf8"),
    );

    expect(source).toContain('from "@/storage/persistentStorage"');
    expect(source.indexOf("requestPersistentStorageForCriticalData()")).toBeGreaterThan(
      source.indexOf("const { full } = localCommit"),
    );
  });
});
