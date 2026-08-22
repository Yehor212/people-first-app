import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcileAutomationRuntime: vi.fn(async () => undefined),
  addListener: vi.fn(),
  remove: vi.fn(async () => undefined),
  authUnsubscribe: vi.fn(),
}));

vi.mock("../automationRuntime", () => ({
  reconcileAutomationRuntime: mocks.reconcileAutomationRuntime,
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: mocks.authUnsubscribe } },
      })),
    },
  },
}));

import {
  JOURNAL_CONTENT_SESSION_CHANGED_EVENT,
  clearJournalContentSession,
  setJournalContentVaultKey,
} from "@/features/journal/journalContentSession";
import { useAutomation } from "../useAutomation";

describe("connected-record lifecycle owner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addListener.mockResolvedValue({ remove: mocks.remove });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("runs once on mount and on source-ready, online, visible, unlock and native resume signals", async () => {
    let nativeListener: ((event: { isActive: boolean }) => void) | undefined;
    mocks.addListener.mockImplementation(async (_name, listener) => {
      nativeListener = listener;
      return { remove: mocks.remove };
    });
    const { unmount } = renderHook(() => useAutomation({ localizedMoodJournalTitle: "Mood note" }));

    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.addListener).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.dispatchEvent(new Event("zenflow:automation-source-ready"));
    });
    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(2));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(3));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(4));
    await act(async () => {
      setJournalContentVaultKey("test-vault-key", 1);
    });
    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(5));
    await act(async () => {
      nativeListener?.({ isActive: true });
    });
    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(6));
    expect(mocks.reconcileAutomationRuntime).toHaveBeenLastCalledWith({
      localizedMoodJournalTitle: "Mood note",
    });

    unmount();
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
    expect(mocks.authUnsubscribe).toHaveBeenCalledTimes(1);
    clearJournalContentSession("manual-lock");
    act(() => {
      window.dispatchEvent(new Event("zenflow:automation-source-ready"));
    });
    expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(6);
  });

  it("coalesces concurrent wakeups and performs one trailing reconciliation", async () => {
    let release: (() => void) | undefined;
    mocks.reconcileAutomationRuntime.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          release = () => resolve(undefined);
        })
    );
    renderHook(() => useAutomation({ localizedMoodJournalTitle: "Mood note" }));
    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("zenflow:automation-source-ready"));
      window.dispatchEvent(new Event(JOURNAL_CONTENT_SESSION_CHANGED_EVENT));
    });
    expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(1);
    await act(async () => release?.());
    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(2));
  });

  it("does not lose a wakeup queued between reconciliation settlement and cleanup", async () => {
    let release: (() => void) | undefined;
    const firstRun = new Promise<undefined>((resolve) => {
      release = () => resolve(undefined);
    });
    mocks.reconcileAutomationRuntime.mockReturnValueOnce(firstRun);
    renderHook(() => useAutomation({ localizedMoodJournalTitle: "Mood note" }));
    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(1));

    // Register after the hook has awaited firstRun. Its continuation therefore
    // settles the lifecycle promise before this wakeup runs, while the outer
    // cleanup callback has not reset `running` yet.
    const boundaryWakeup = firstRun.then(() => {
      window.dispatchEvent(new Event("zenflow:automation-source-ready"));
    });
    await act(async () => {
      release?.();
      await boundaryWakeup;
    });

    await waitFor(() => expect(mocks.reconcileAutomationRuntime).toHaveBeenCalledTimes(2));
  });
});
