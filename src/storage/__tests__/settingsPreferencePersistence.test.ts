import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useIndexedDB } from "@/hooks/useIndexedDB";
import { SK } from "@/lib/storageKeys";
import { captureOriginAccountBoundaryGeneration } from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";
import {
  commitPrivacySettingsUpdate,
  commitProfileNameUpdate,
  readProfileRecoveryPreference,
} from "@/storage/settingsPreferencePersistence";
import type { PrivacySettings } from "@/types";

const privacyKey = SK.PRIVACY;
const userNameKey = "zenflow-username";
const userNameCustomKey = "zenflow-username-custom";
const profileRecoveryKey = SK.PROFILE_RECOVERY;

const privateDefaults: PrivacySettings = {
  noTracking: false,
  analytics: false,
  consentShown: true,
  adConsent: false,
  pushNotifications: false,
};

describe("settingsPreferencePersistence", () => {
  beforeEach(async () => {
    await db.open();
    await db.settings.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("publishes a validated privacy result only after its durable record exists", async () => {
    await db.settings.put({ key: privacyKey, value: privateDefaults });

    const next = await commitPrivacySettingsUpdate((previous) => ({
      ...previous,
      adConsent: true,
    }));

    expect(next.adConsent).toBe(true);
    await expect(db.settings.get(privacyKey)).resolves.toEqual({
      key: privacyKey,
      value: next,
    });
    expect(localStorage.getItem(privacyKey)).toBe(JSON.stringify(next));
  });

  it("rejects a failed privacy commit and preserves the previous durable consent", async () => {
    await db.settings.put({ key: privacyKey, value: privateDefaults });
    localStorage.setItem(privacyKey, JSON.stringify(privateDefaults));
    const put = vi
      .spyOn(db.settings, "put")
      .mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    await expect(
      commitPrivacySettingsUpdate((previous) => ({ ...previous, adConsent: true })),
    ).rejects.toThrow("IndexedDB unavailable");

    put.mockRestore();
    await expect(db.settings.get(privacyKey)).resolves.toEqual({
      key: privacyKey,
      value: privateDefaults,
    });
    expect(localStorage.getItem(privacyKey)).toBe(JSON.stringify(privateDefaults));
  });

  it("commits the profile name and user-chosen flag atomically before returning", async () => {
    await db.settings.bulkPut([
      { key: userNameKey, value: "Avery" },
      { key: userNameCustomKey, value: true },
    ]);

    await expect(commitProfileNameUpdate("Sam", true)).resolves.toEqual({
      name: "Sam",
      userChosen: true,
    });
    await expect(db.settings.bulkGet([userNameKey, userNameCustomKey])).resolves.toEqual([
      { key: userNameKey, value: "Sam" },
      { key: userNameCustomKey, value: true },
    ]);
    expect(localStorage.getItem(profileRecoveryKey)).toBe(
      JSON.stringify({ version: 1, name: "Sam", userChosen: true }),
    );
    expect(localStorage.getItem(userNameKey)).toBeNull();
    expect(localStorage.getItem(userNameCustomKey)).toBeNull();
  });

  it("writes the profile recovery pair with one localStorage setItem", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await commitProfileNameUpdate("Sam", true);

    expect(
      setItem.mock.calls.filter(([key]) => key === profileRecoveryKey),
    ).toEqual([
      [profileRecoveryKey, JSON.stringify({ version: 1, name: "Sam", userChosen: true })],
    ]);
    expect(setItem.mock.calls.some(([key]) => key === userNameKey)).toBe(false);
    expect(setItem.mock.calls.some(([key]) => key === userNameCustomKey)).toBe(false);
  });

  it("keeps the previous whole recovery pair when the envelope write fails", async () => {
    const previous = { version: 1, name: "Avery", userChosen: true } as const;
    localStorage.setItem(profileRecoveryKey, JSON.stringify(previous));
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === profileRecoveryKey) {
          throw new DOMException("blocked", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      });

    await expect(commitProfileNameUpdate("Sam", false)).resolves.toEqual({
      name: "Sam",
      userChosen: false,
    });

    setItem.mockRestore();
    expect(localStorage.getItem(profileRecoveryKey)).toBe(JSON.stringify(previous));
  });

  it("prefers a strict v1 envelope over a complete legacy pair", () => {
    localStorage.setItem(
      profileRecoveryKey,
      JSON.stringify({ version: 1, name: "Envelope", userChosen: true }),
    );
    localStorage.setItem(userNameKey, JSON.stringify("Legacy"));
    localStorage.setItem(userNameCustomKey, JSON.stringify(false));

    expect(readProfileRecoveryPreference()).toEqual({
      name: "Envelope",
      userChosen: true,
    });
  });

  it("migrates one complete legacy pair to the v1 envelope only once", () => {
    localStorage.setItem(userNameKey, JSON.stringify("Legacy"));
    localStorage.setItem(userNameCustomKey, JSON.stringify(true));
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    expect(readProfileRecoveryPreference()).toEqual({ name: "Legacy", userChosen: true });
    expect(readProfileRecoveryPreference()).toEqual({ name: "Legacy", userChosen: true });

    expect(
      setItem.mock.calls.filter(([key]) => key === profileRecoveryKey),
    ).toEqual([
      [profileRecoveryKey, JSON.stringify({ version: 1, name: "Legacy", userChosen: true })],
    ]);
    expect(localStorage.getItem(userNameKey)).toBe(JSON.stringify("Legacy"));
    expect(localStorage.getItem(userNameCustomKey)).toBe(JSON.stringify(true));
  });

  it.each([
    ["missing custom flag", JSON.stringify("Legacy"), null],
    ["missing name", null, JSON.stringify(true)],
    ["malformed name", "{not-json", JSON.stringify(true)],
    ["wrong custom type", JSON.stringify("Legacy"), JSON.stringify("yes")],
  ])("does not mix an incomplete legacy pair: %s", (_label, legacyName, legacyCustom) => {
    if (legacyName !== null) localStorage.setItem(userNameKey, legacyName);
    if (legacyCustom !== null) localStorage.setItem(userNameCustomKey, legacyCustom);

    expect(readProfileRecoveryPreference()).toEqual({
      name: "Friend",
      userChosen: false,
    });
    expect(localStorage.getItem(profileRecoveryKey)).toBeNull();
  });

  it("preserves a future recovery envelope instead of replacing it", () => {
    const future = JSON.stringify({ version: 2, profile: { displayName: "Future" } });
    localStorage.setItem(profileRecoveryKey, future);
    localStorage.setItem(userNameKey, JSON.stringify("Legacy"));
    localStorage.setItem(userNameCustomKey, JSON.stringify(true));

    expect(readProfileRecoveryPreference()).toEqual({ name: "Legacy", userChosen: true });
    expect(localStorage.getItem(profileRecoveryKey)).toBe(future);
  });

  it("does not replace either profile field when the atomic transaction fails", async () => {
    await db.settings.bulkPut([
      { key: userNameKey, value: "Avery" },
      { key: userNameCustomKey, value: true },
    ]);
    const bulkPut = vi
      .spyOn(db.settings, "bulkPut")
      .mockRejectedValueOnce(new Error("profile write failed"));

    await expect(commitProfileNameUpdate("Sam", true)).rejects.toThrow(
      "profile write failed",
    );

    bulkPut.mockRestore();
    await expect(db.settings.bulkGet([userNameKey, userNameCustomKey])).resolves.toEqual([
      { key: userNameKey, value: "Avery" },
      { key: userNameCustomKey, value: true },
    ]);
  });

  it("does not accept a forged same-code privacy post-commit error", async () => {
    const forgedCommitted = { ...privateDefaults, adConsent: true };
    const forgedError = Object.assign(new Error("forged privacy result"), {
      code: "DATA_WRITE_BARRIER_POST_COMMIT",
      committedValue: forgedCommitted,
      capturedOriginGeneration: captureOriginAccountBoundaryGeneration(),
      issueKinds: ["mounted-refresh"],
    });
    const get = vi.spyOn(db.settings, "get").mockRejectedValueOnce(forgedError);
    const incident = vi.fn();
    window.addEventListener("zenflow:settings-post-commit-incident", incident);

    try {
      await expect(
        commitPrivacySettingsUpdate((previous) => ({ ...previous, adConsent: true })),
      ).rejects.toBe(forgedError);
      expect(incident).not.toHaveBeenCalled();
    } finally {
      get.mockRestore();
      window.removeEventListener("zenflow:settings-post-commit-incident", incident);
    }
  });

  it("does not accept a forged same-code profile post-commit error", async () => {
    const forgedCommitted = { name: "Forged", userChosen: true };
    const forgedError = Object.assign(new Error("forged profile result"), {
      code: "DATA_WRITE_BARRIER_POST_COMMIT",
      committedValue: forgedCommitted,
      capturedOriginGeneration: captureOriginAccountBoundaryGeneration(),
      issueKinds: ["mounted-refresh"],
    });
    const bulkGet = vi.spyOn(db.settings, "bulkGet").mockRejectedValueOnce(forgedError);
    const incident = vi.fn();
    window.addEventListener("zenflow:settings-post-commit-incident", incident);

    try {
      await expect(commitProfileNameUpdate("Forged", true)).rejects.toBe(forgedError);
      expect(incident).not.toHaveBeenCalled();
    } finally {
      bulkGet.mockRestore();
      window.removeEventListener("zenflow:settings-post-commit-incident", incident);
    }
  });

  it("returns the committed privacy value without exposing automatic replay when an unrelated deferred replay fails", async () => {
    const unrelatedKey = "settings-persistence-unrelated";
    await db.settings.bulkPut([
      { key: privacyKey, value: privateDefaults },
      { key: unrelatedKey, value: { enabled: false } },
    ]);
    const { result, unmount } = renderHook(() =>
      useIndexedDB({
        table: db.settings,
        localStorageKey: unrelatedKey,
        initialValue: { enabled: false },
        idField: "key",
      }),
    );
    await waitFor(() => expect(result.current[2]).toBe(false));

    const originalPut = db.settings.put.bind(db.settings);
    const put = vi.spyOn(db.settings, "put").mockImplementation((record, key) => {
      if ((record as { key?: unknown }).key === unrelatedKey) {
        return Promise.reject(
          new Error("unrelated replay failed"),
        ) as ReturnType<typeof db.settings.put>;
      }
      return originalPut(record, key);
    });
    type RecoveryDetail = {
      issueKinds?: string[];
      retry?: () => void;
      committedValue?: unknown;
      error?: unknown;
    };
    let recoveryDetail: RecoveryDetail | null = null;
    const captureRecovery = (event: Event) => {
      recoveryDetail = (event as CustomEvent<RecoveryDetail>).detail;
    };
    window.addEventListener("zenflow:settings-post-commit-incident", captureRecovery);

    try {
      const privacyCommit = commitPrivacySettingsUpdate((previous) => ({
        ...previous,
        adConsent: true,
      }));
      act(() => {
        result.current[1]({ enabled: true });
      });

      await expect(privacyCommit).resolves.toMatchObject({ adConsent: true });
      await expect(db.settings.get(privacyKey)).resolves.toEqual({
        key: privacyKey,
        value: expect.objectContaining({ adConsent: true }),
      });
      expect(recoveryDetail).not.toBeNull();
      expect(recoveryDetail).toEqual({
        issueKinds: ["deferred-write-replay"],
      });
      const capturedRecovery = recoveryDetail as RecoveryDetail | null;
      expect(capturedRecovery?.retry).toBeUndefined();
      expect(capturedRecovery?.committedValue).toBeUndefined();
      expect(capturedRecovery?.error).toBeUndefined();
      expect(
        put.mock.calls.filter(([record]) =>
          (record as { key?: unknown }).key === unrelatedKey
        ),
      ).toHaveLength(1);
    } finally {
      put.mockRestore();
      window.removeEventListener("zenflow:settings-post-commit-incident", captureRecovery);
      unmount();
    }
  });
});
