import { afterEach, describe, expect, it, vi } from "vitest";

describe("journal content session cross-tab invalidation", () => {
  it("publishes a content-free local session-change signal on unlock", async () => {
    const session = await import("@/lib/journalContentSession");
    const listener = vi.fn();
    window.addEventListener("zenflow:journal-content-session-changed", listener);
    session.setJournalContentVaultKey("vault-key", 7);
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toBeUndefined();
    window.removeEventListener("zenflow:journal-content-session-changed", listener);
  });

  afterEach(() => {
    vi.resetModules();
    Reflect.deleteProperty(window, "BroadcastChannel");
  });

  it("broadcasts protection removal without sharing key material and clears remote tab sessions", async () => {
    const instances: Array<{
      onmessage: ((event: MessageEvent<unknown>) => void) | null;
      postMessage: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeBroadcastChannel {
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      postMessage = vi.fn();

      constructor(readonly name: string) {
        instances.push(this);
      }

      close(): void {}
    }

    Object.defineProperty(window, "BroadcastChannel", {
      configurable: true,
      value: FakeBroadcastChannel,
    });

    const session = await import("@/lib/journalContentSession");
    session.setJournalContentVaultKey("originating-tab-key");

    session.notifyJournalProtectionRemoved();

    expect(session.getJournalContentVaultKey()).toBeNull();
    expect(instances).toHaveLength(1);
    expect(instances[0]?.postMessage).toHaveBeenCalledWith({
      type: "JOURNAL_PROTECTION_REMOVED",
    });
    expect(instances[0]?.postMessage.mock.calls.flat(Infinity)).not.toContain(
      "originating-tab-key"
    );

    session.setJournalContentVaultKey("remote-tab-stale-key");
    instances[0]?.onmessage?.(
      new MessageEvent("message", { data: { type: "JOURNAL_PROTECTION_REMOVED" } })
    );

    expect(session.getJournalContentVaultKey()).toBeNull();
  });
});
