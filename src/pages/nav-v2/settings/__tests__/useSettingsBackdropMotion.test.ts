import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  appStateListener: null as null | ((state: { isActive: boolean }) => void),
  isNative: false,
  shouldAnimate: true,
}));

const removeListener = vi.hoisted(() => vi.fn<() => Promise<void>>(async () => undefined));
const addListener = vi.hoisted(() =>
  vi.fn(async (_eventName: string, listener: (state: { isActive: boolean }) => void) => {
    harness.appStateListener = listener;
    return { remove: removeListener };
  })
);
const getState = vi.hoisted(() => vi.fn(async () => ({ isActive: true })));
const warn = vi.hoisted(() => vi.fn());

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => harness.shouldAnimate,
}));

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return harness.isNative;
  },
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener, getState },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn },
}));

import { useSettingsBackdropMotion } from "../useSettingsBackdropMotion";

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useSettingsBackdropMotion", () => {
  beforeEach(() => {
    harness.appStateListener = null;
    harness.isNative = false;
    harness.shouldAnimate = true;
    addListener.mockClear();
    getState.mockClear();
    getState.mockResolvedValue({ isActive: true });
    removeListener.mockClear();
    warn.mockClear();
    setDocumentHidden(false);
  });

  afterEach(() => {
    setDocumentHidden(false);
  });

  it("runs on a visible web page only while the shared motion gate allows it", () => {
    const { result, rerender } = renderHook(() => useSettingsBackdropMotion());
    expect(result.current).toBe(true);

    harness.shouldAnimate = false;
    rerender();
    expect(result.current).toBe(false);
  });

  it("does not subscribe to document or native lifecycle state while the backdrop is disabled", async () => {
    harness.isNative = true;
    const addDocumentListener = vi.spyOn(document, "addEventListener");

    const { result } = renderHook(() => useSettingsBackdropMotion(false));

    expect(result.current).toBe(false);
    await act(async () => undefined);
    expect(addListener).not.toHaveBeenCalled();
    expect(addDocumentListener).not.toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    addDocumentListener.mockRestore();
  });

  it("does not attach a native listener when the backdrop is disabled before the import settles", async () => {
    harness.isNative = true;

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSettingsBackdropMotion(enabled),
      { initialProps: { enabled: true } }
    );
    rerender({ enabled: false });

    await act(async () => undefined);
    expect(addListener).not.toHaveBeenCalled();
  });

  it("starts and removes the visibility subscription when the backdrop is enabled then disabled", () => {
    const addDocumentListener = vi.spyOn(document, "addEventListener");
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSettingsBackdropMotion(enabled),
      { initialProps: { enabled: false } }
    );

    expect(result.current).toBe(false);
    rerender({ enabled: true });
    expect(addDocumentListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(result.current).toBe(true);

    rerender({ enabled: false });
    expect(removeDocumentListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(result.current).toBe(false);

    addDocumentListener.mockRestore();
    removeDocumentListener.mockRestore();
  });

  it("stops when the document is hidden and resumes when it becomes visible", () => {
    const { result } = renderHook(() => useSettingsBackdropMotion());
    expect(result.current).toBe(true);

    act(() => setDocumentHidden(true));
    expect(result.current).toBe(false);

    act(() => setDocumentHidden(false));
    expect(result.current).toBe(true);
  });

  it("fails closed until native app state is known, then follows appStateChange", async () => {
    harness.isNative = true;
    const state = createDeferred<{ isActive: boolean }>();
    getState.mockReturnValue(state.promise);

    const { result, unmount } = renderHook(() => useSettingsBackdropMotion());
    expect(result.current).toBe(false);

    await waitFor(() =>
      expect(addListener).toHaveBeenCalledWith("appStateChange", expect.any(Function))
    );
    act(() => state.resolve({ isActive: true }));
    await waitFor(() => expect(result.current).toBe(true));

    act(() => harness.appStateListener?.({ isActive: false }));
    expect(result.current).toBe(false);
    act(() => harness.appStateListener?.({ isActive: true }));
    expect(result.current).toBe(true);

    unmount();
    await waitFor(() => expect(removeListener).toHaveBeenCalledTimes(1));
  });

  it("does not animate from listener events before the initial native state probe succeeds", async () => {
    harness.isNative = true;
    const state = createDeferred<{ isActive: boolean }>();
    getState.mockReturnValue(state.promise);

    const { result } = renderHook(() => useSettingsBackdropMotion());
    await waitFor(() => expect(getState).toHaveBeenCalledTimes(1));

    act(() => harness.appStateListener?.({ isActive: true }));
    expect(result.current).toBe(false);

    state.reject(new Error("initial native state unavailable"));
    await waitFor(() => expect(removeListener).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);
  });

  it("uses the later current-state probe when a listener event arrives before registration resolves", async () => {
    harness.isNative = true;
    const state = createDeferred<{ isActive: boolean }>();
    getState.mockReturnValue(state.promise);
    addListener.mockImplementationOnce(
      async (_eventName: string, listener: (state: { isActive: boolean }) => void) => {
        harness.appStateListener = listener;
        listener({ isActive: true });
        return { remove: removeListener };
      }
    );

    const { result } = renderHook(() => useSettingsBackdropMotion());
    await waitFor(() => expect(getState).toHaveBeenCalledTimes(1));

    await act(async () => {
      state.resolve({ isActive: false });
      await state.promise;
    });

    expect(result.current).toBe(false);
  });

  it("applies the newest listener state when the initial native state probe succeeds", async () => {
    harness.isNative = true;
    const state = createDeferred<{ isActive: boolean }>();
    getState.mockReturnValue(state.promise);

    const { result } = renderHook(() => useSettingsBackdropMotion());
    await waitFor(() => expect(getState).toHaveBeenCalledTimes(1));

    act(() => harness.appStateListener?.({ isActive: false }));
    expect(result.current).toBe(false);

    act(() => state.resolve({ isActive: true }));
    await waitFor(() => expect(result.current).toBe(false));

    act(() => harness.appStateListener?.({ isActive: true }));
    expect(result.current).toBe(true);
  });

  it("stays static and reports a sanitized warning when native state cannot load", async () => {
    harness.isNative = true;
    addListener.mockRejectedValueOnce(new Error("native state unavailable"));

    const { result } = renderHook(() => useSettingsBackdropMotion());

    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);
  });

  it("remains fail-closed and detaches a listener when the current native state probe fails", async () => {
    harness.isNative = true;
    getState.mockRejectedValueOnce(new Error("private current-state failure"));

    const { result, unmount } = renderHook(() => useSettingsBackdropMotion());

    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);
    expect(harness.appStateListener).not.toBeNull();

    act(() => harness.appStateListener?.({ isActive: true }));
    expect(result.current).toBe(false);
    await waitFor(() => expect(removeListener).toHaveBeenCalledTimes(1));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("private current-state failure"));

    unmount();
    await act(async () => undefined);
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it("keeps cleanup warnings sanitized when state-probe detachment also fails", async () => {
    harness.isNative = true;
    getState.mockRejectedValueOnce(new Error("private state detail"));
    removeListener.mockRejectedValueOnce(new Error("private remove detail"));

    const { result } = renderHook(() => useSettingsBackdropMotion());

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        "Settings backdrop app-state listener cleanup did not complete."
      )
    );
    expect(warn).toHaveBeenCalledWith(
      "Settings backdrop motion stayed off because app state was unavailable."
    );
    expect(result.current).toBe(false);
    act(() => harness.appStateListener?.({ isActive: true }));
    expect(result.current).toBe(false);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("private state detail"));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("private remove detail"));
  });

  it("stays static, removes exactly once, and ignores a never-settled probe after unmount", async () => {
    harness.isNative = true;
    const state = createDeferred<{ isActive: boolean }>();
    getState.mockReturnValueOnce(state.promise);

    const { result, unmount } = renderHook(() => useSettingsBackdropMotion());
    await waitFor(() => expect(getState).toHaveBeenCalledTimes(1));
    act(() => harness.appStateListener?.({ isActive: true }));
    expect(result.current).toBe(false);

    unmount();
    await waitFor(() => expect(removeListener).toHaveBeenCalledTimes(1));

    act(() => harness.appStateListener?.({ isActive: true }));
    state.reject(new Error("late private state detail"));
    await act(async () => undefined);

    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("reports a sanitized warning if a late native listener cannot be removed after unmount", async () => {
    harness.isNative = true;
    const listener = createDeferred<Awaited<ReturnType<typeof addListener>>>();
    const lateRemove = vi.fn<() => Promise<void>>(async () => {
      throw new Error("private native cleanup detail");
    });
    addListener.mockReturnValueOnce(listener.promise);

    const { unmount } = renderHook(() => useSettingsBackdropMotion());
    await waitFor(() => expect(addListener).toHaveBeenCalledTimes(1));
    unmount();
    act(() => listener.resolve({ remove: lateRemove }));

    await waitFor(() => expect(lateRemove).toHaveBeenCalledTimes(1));
    expect(warn).toHaveBeenCalledWith(
      "Settings backdrop app-state listener cleanup did not complete."
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("private native cleanup detail"));
  });
});
