import { describe, expect, it, vi } from "vitest";

import {
  configureAuthTransitionClient,
  type AuthStorageLike,
} from "@/lib/authTransitionCoordinator";
import { signOutExpectedOwnerWithAuthClient } from "@/lib/ownerBoundAuthSession";

describe("owner-bound Supabase session removal", () => {
  const storageKey = "sb-project-auth-token";
  const accountA = "11111111-1111-4111-8111-111111111111";
  const accountB = "22222222-2222-4222-8222-222222222222";

  function storedSession(ownerUserId: string): string {
    return JSON.stringify({ user: { id: ownerUserId } });
  }

  function configuredAuth(initial: Record<string, string>) {
    const values = new Map(Object.entries(initial));
    const storage: AuthStorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    };
    const auth = {
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithIdToken: vi.fn(),
      _notifyAllSubscribers: vi.fn(async () => undefined),
    };
    configureAuthTransitionClient(auth, { storage, storageKey });
    return { auth, values };
  }

  it("removes the expected owner without touching its PKCE verifier", async () => {
    const { auth, values } = configuredAuth({
      [storageKey]: storedSession(accountA),
      [`${storageKey}-code-verifier`]: JSON.stringify("in-flight-verifier"),
    });

    await expect(
      signOutExpectedOwnerWithAuthClient(auth, accountA),
    ).resolves.toEqual({ status: "signed-out" });

    expect(values.has(storageKey)).toBe(false);
    expect(values.get(`${storageKey}-code-verifier`)).toBe(
      JSON.stringify("in-flight-verifier"),
    );
    expect(auth._notifyAllSubscribers).toHaveBeenCalledWith("SIGNED_OUT", null, false);
  });

  it("preserves a different owner already holding the auth realm", async () => {
    const { auth, values } = configuredAuth({
      [storageKey]: storedSession(accountB),
    });

    await expect(
      signOutExpectedOwnerWithAuthClient(auth, accountA),
    ).resolves.toEqual({ status: "owner-changed", userId: accountB });
    expect(JSON.parse(values.get(storageKey) ?? "null").user.id).toBe(accountB);
    expect(auth._notifyAllSubscribers).not.toHaveBeenCalled();
  });

  it("fails closed when the pinned auth client internals are unavailable", async () => {
    await expect(
      signOutExpectedOwnerWithAuthClient({}, accountA),
    ).resolves.toEqual({ status: "unsupported" });
  });

  it("fails closed before mutation when the persisted owner is malformed", async () => {
    const { auth, values } = configuredAuth({ [storageKey]: "not-json" });
    await expect(signOutExpectedOwnerWithAuthClient(auth, accountA)).rejects.toThrow(
      "Unable to verify the current auth session owner",
    );
    expect(values.get(storageKey)).toBe("not-json");
  });
});
