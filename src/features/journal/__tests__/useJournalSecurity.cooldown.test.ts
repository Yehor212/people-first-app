import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settingsStore = new Map<string, { key: string; value: unknown }>();

vi.mock("@/lib/platform", () => ({
  isNative: false,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/storage/db", () => ({
  db: {
    settings: {
      get: vi.fn((key: string) => Promise.resolve(settingsStore.get(key))),
      put: vi.fn((entry: { key: string; value: unknown }) => {
        settingsStore.set(entry.key, entry);
        return Promise.resolve(entry.key);
      }),
      delete: vi.fn((key: string) => {
        settingsStore.delete(key);
        return Promise.resolve();
      }),
    },
  },
}));

import { db } from "@/storage/db";
import { useJournalSecurity } from "../useJournalSecurity";

function bytesToString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

describe("useJournalSecurity cooldown persistence", () => {
  beforeEach(() => {
    settingsStore.clear();
    vi.spyOn(Date, "now").mockReturnValue(1_781_580_000_000);

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: vi.fn((buffer: Uint8Array) => {
          buffer.fill(7);
          return buffer;
        }),
        subtle: {
          importKey: vi.fn((_format, keyData: ArrayBuffer) =>
            Promise.resolve({ password: bytesToString(new Uint8Array(keyData)) }),
          ),
          deriveBits: vi.fn(
            (algorithm: { salt: ArrayBuffer; iterations: number }, key: { password: string }) => {
              const salt = bytesToString(new Uint8Array(algorithm.salt));
              const encoded = new TextEncoder().encode(
                `${key.password}:${salt}:${algorithm.iterations}`,
              );
              return Promise.resolve(encoded.buffer);
            },
          ),
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists wrong-password cooldown across a fresh hook mount", async () => {
    const first = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      await first.result.current.setPassword("correct horse battery staple");
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        await expect(first.result.current.unlock("wrong password")).resolves.toBe(false);
      });
    }

    expect(settingsStore.get("journal_password_cooldown")?.value).toEqual({
      failedAttempts: 3,
      cooldownUntil: 1_781_580_030_000,
    });
    expect(first.result.current.cooldownRemaining).toBe(30);

    first.unmount();
    const second = renderHook(() => useJournalSecurity());

    await waitFor(() => {
      expect(second.result.current.failedAttempts).toBe(3);
      expect(second.result.current.cooldownRemaining).toBe(30);
    });
  });

  it("keeps unlock blocked until persisted cooldown finishes loading", async () => {
    const saltBytes = new Uint8Array([1, 2, 3, 4]);
    const saltText = bytesToString(saltBytes);
    const salt = btoa(saltText);
    const encodedHash = new TextEncoder().encode(
      `${"correct horse battery staple"}:${saltText}:600000`,
    );
    settingsStore.set("journal_password", {
      key: "journal_password",
      value: {
        hash: btoa(bytesToString(encodedHash)),
        salt,
        iterations: 600_000,
        createdAt: Date.now(),
      },
    });

    let resolveCooldown!: (entry: { key: string; value: unknown }) => void;
    const cooldownPromise = new Promise<{ key: string; value: unknown }>((resolve) => {
      resolveCooldown = resolve;
    });

    vi.mocked(db.settings.get).mockImplementation(((key: string) => {
      if (key === "journal_password_cooldown") return cooldownPromise;
      return Promise.resolve(settingsStore.get(key));
    }) as never);

    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.hasPassword).toBe(true));
    expect(hook.result.current.loading).toBe(true);

    await act(async () => {
      await expect(hook.result.current.unlock("correct horse battery staple")).resolves.toBe(false);
    });
    expect(hook.result.current.isUnlocked).toBe(false);

    await act(async () => {
      resolveCooldown({
        key: "journal_password_cooldown",
        value: {
          failedAttempts: 3,
          cooldownUntil: 1_781_580_030_000,
        },
      });
      await cooldownPromise;
    });

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.cooldownRemaining).toBe(30);

    await act(async () => {
      await expect(hook.result.current.unlock("correct horse battery staple")).resolves.toBe(false);
    });
    expect(hook.result.current.isUnlocked).toBe(false);
  });
});
