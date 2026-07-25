import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLocalDataOwnerId: vi.fn<() => Promise<string | null>>(),
  getSession: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
}));

import { SK } from "@/lib/storageKeys";
import {
  flushJournalAiConsentRevocation,
  grantJournalAiConsent,
  isJournalAiConsentGranted,
  revokeJournalAiConsent,
} from "../journalAiConsent";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

function setSession(userId: string | null) {
  mocks.getSession.mockResolvedValue({
    data: { session: userId ? { user: { id: userId } } : null },
    error: null,
  });
}

describe("journal AI consent revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setSession(OWNER_A);
    mocks.getLocalDataOwnerId.mockResolvedValue(OWNER_A);
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("turns AI off immediately and keeps a durable owner-bound retry when deletion fails", async () => {
    localStorage.setItem(SK.JOURNAL_AI_SEARCH_CONSENT, "true");
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("offline") });

    const resultPromise = revokeJournalAiConsent();

    expect(isJournalAiConsentGranted()).toBe(false);

    await expect(resultPromise).resolves.toEqual({ status: "pending" });
    expect(localStorage.getItem(`${SK.JOURNAL_AI_REVOCATION_PREFIX}${OWNER_A}`)).not.toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_journal_ai_consent");
  });

  it("clears the pending marker only after the owner-scoped remote deletion succeeds", async () => {
    localStorage.setItem(`${SK.JOURNAL_AI_REVOCATION_PREFIX}${OWNER_A}`, JSON.stringify({
      version: 1,
      ownerUserId: OWNER_A,
      requestedAt: Date.now(),
    }));

    await expect(flushJournalAiConsentRevocation()).resolves.toEqual({ status: "completed" });

    expect(localStorage.getItem(`${SK.JOURNAL_AI_REVOCATION_PREFIX}${OWNER_A}`)).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_journal_ai_consent");
  });

  it("never deletes another account's embeddings when the local owner and session disagree", async () => {
    localStorage.setItem(`${SK.JOURNAL_AI_REVOCATION_PREFIX}${OWNER_A}`, JSON.stringify({
      version: 1,
      ownerUserId: OWNER_A,
      requestedAt: Date.now(),
    }));
    setSession(OWNER_B);
    mocks.getLocalDataOwnerId.mockResolvedValue(OWNER_A);

    await expect(flushJournalAiConsentRevocation()).resolves.toEqual({ status: "owner-mismatch" });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(localStorage.getItem(`${SK.JOURNAL_AI_REVOCATION_PREFIX}${OWNER_A}`)).not.toBeNull();
  });

  it("does not re-enable AI until an outstanding deletion for the current owner completes", async () => {
    localStorage.setItem(`${SK.JOURNAL_AI_REVOCATION_PREFIX}${OWNER_A}`, JSON.stringify({
      version: 1,
      ownerUserId: OWNER_A,
      requestedAt: Date.now(),
    }));
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("offline") });

    await expect(grantJournalAiConsent()).resolves.toEqual({ status: "pending" });
    expect(isJournalAiConsentGranted()).toBe(false);

    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await expect(grantJournalAiConsent()).resolves.toEqual({ status: "granted" });
    expect(isJournalAiConsentGranted()).toBe(true);
    expect(mocks.rpc).toHaveBeenLastCalledWith("grant_journal_ai_consent", {
      p_expected_generation: 0,
    });
  });

  it("does not grant local AI access when the server consent write fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("offline") });

    await expect(grantJournalAiConsent()).resolves.toEqual({ status: "pending" });

    expect(localStorage.getItem(SK.JOURNAL_AI_SEARCH_CONSENT)).toBeNull();
    expect(isJournalAiConsentGranted()).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("grant_journal_ai_consent", {
      p_expected_generation: 0,
    });
  });

  it("does not call the server when local consent storage is already unavailable", async () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

    await expect(grantJournalAiConsent()).resolves.toEqual({ status: "storage-error" });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(isJournalAiConsentGranted()).toBe(false);
    setItem.mockRestore();
  });

  it("revokes the server grant when storage fails after the writeability probe", async () => {
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "__zenflow_journal_ai_consent_probe__") {
          return originalSetItem.call(this, key, value);
        }
        throw new DOMException("blocked", "SecurityError");
      });

    await expect(grantJournalAiConsent()).resolves.toEqual({ status: "storage-error" });

    expect(mocks.rpc.mock.calls).toEqual([
      ["grant_journal_ai_consent", { p_expected_generation: 0 }],
      ["revoke_journal_ai_consent"],
    ]);
    expect(isJournalAiConsentGranted()).toBe(false);
    setItem.mockRestore();
  });

  it("still revokes the authenticated server grant when the retry marker cannot be stored", async () => {
    localStorage.setItem(SK.JOURNAL_AI_SEARCH_CONSENT, "true");
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key.startsWith(SK.JOURNAL_AI_REVOCATION_PREFIX)) {
          throw new DOMException("blocked", "SecurityError");
        }
        return originalSetItem.call(this, key, value);
      });

    await expect(revokeJournalAiConsent()).resolves.toEqual({ status: "completed" });

    expect(mocks.rpc).toHaveBeenCalledWith("revoke_journal_ai_consent");
    expect(isJournalAiConsentGranted()).toBe(false);
    setItem.mockRestore();
  });

  it("does not re-enable local AI when an older grant finishes after revocation", async () => {
    let resolveGrant!: (value: { data: true; error: null }) => void;
    const grantResponse = new Promise<{ data: true; error: null }>((resolve) => {
      resolveGrant = resolve;
    });
    mocks.rpc.mockImplementation((name: string) =>
      name === "grant_journal_ai_consent"
        ? grantResponse
        : Promise.resolve({ data: true, error: null }),
    );

    const grant = grantJournalAiConsent();
    await vi.waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("grant_journal_ai_consent", {
        p_expected_generation: 0,
      }),
    );

    await expect(revokeJournalAiConsent()).resolves.toEqual({ status: "completed" });
    resolveGrant({ data: true, error: null });
    await grant;

    expect(isJournalAiConsentGranted()).toBe(false);
    expect(localStorage.getItem(SK.JOURNAL_AI_SEARCH_CONSENT)).toBeNull();
    expect(mocks.rpc.mock.calls).toEqual([
      ["grant_journal_ai_consent", { p_expected_generation: 0 }],
      ["revoke_journal_ai_consent"],
      ["revoke_journal_ai_consent"],
    ]);
  });
});
