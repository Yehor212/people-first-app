import { afterEach, describe, expect, it, vi } from "vitest";

import { runWithJournalSecurityWriteLock } from "../journalSecurityWriteLock";

describe("journalSecurityWriteLock", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
  });

  it("uses an origin-wide exclusive Web Lock when the browser provides it", async () => {
    const request = vi.fn(
      async <T>(
        _name: string,
        _options: { mode?: "exclusive" | "shared" },
        callback: (lock: { name: string; mode: "exclusive" } | null) => T | Promise<T>
      ): Promise<T> => callback({ name: "zenflow:journal-security-write", mode: "exclusive" })
    );
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request },
    });

    await expect(runWithJournalSecurityWriteLock(async () => "done")).resolves.toBe("done");

    expect(request).toHaveBeenCalledWith(
      "zenflow:journal-security-write",
      { mode: "exclusive" },
      expect.any(Function)
    );
  });
});
