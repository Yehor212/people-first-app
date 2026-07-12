import { beforeEach, describe, expect, it, vi } from "vitest";

const filesystemMock = vi.hoisted(() => ({
  deleteFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({ isNative: true }));
vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: vi.fn() } }));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    writeFile: vi.fn(),
    deleteFile: filesystemMock.deleteFile,
    readdir: filesystemMock.readdir,
  },
  Directory: { Cache: "CACHE" },
}));

import { cleanupAllAccountCacheFiles } from "../shareActions";

describe("cleanupAllAccountCacheFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filesystemMock.deleteFile.mockResolvedValue(undefined);
  });

  it("deletes every ZenFlow share and backup cache artifact but preserves unrelated files", async () => {
    filesystemMock.readdir.mockResolvedValue({
      files: [
        { name: "zenflow-share-1710000000000.png" },
        { name: "ZenFlow_Backup_2026-07-10_1710000000000.json" },
        { name: "unrelated-cache.bin" },
      ],
    });

    await cleanupAllAccountCacheFiles();

    expect(filesystemMock.deleteFile.mock.calls).toEqual([
      [{ path: "zenflow-share-1710000000000.png", directory: "CACHE" }],
      [{
        path: "ZenFlow_Backup_2026-07-10_1710000000000.json",
        directory: "CACHE",
      }],
    ]);
  });

  it("rejects the account boundary when an owned cache artifact cannot be deleted", async () => {
    vi.useFakeTimers();
    filesystemMock.readdir.mockResolvedValue({
      files: [{ name: "zenflow-share-1710000000000.png" }],
    });
    filesystemMock.deleteFile.mockRejectedValue(new Error("filesystem locked"));

    const cleanup = cleanupAllAccountCacheFiles();
    const rejection = expect(cleanup).rejects.toThrow("filesystem locked");
    await vi.runAllTimersAsync();

    await rejection;
    expect(filesystemMock.deleteFile).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});
