import { beforeEach, describe, expect, it, vi } from "vitest";

const bridgeMocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  setState: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({ isNative: true, isAndroid: true }));
vi.mock("../androidBackBridge", () => ({
  AndroidBackBridge: {
    addListener: bridgeMocks.addListener,
    setState: bridgeMocks.setState,
  },
}));
vi.mock("../logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("Android Back bridge state", () => {
  beforeEach(() => {
    vi.resetModules();
    bridgeMocks.addListener.mockReset();
    bridgeMocks.setState.mockReset();
    bridgeMocks.remove.mockReset();
    bridgeMocks.addListener.mockImplementation(
      async (_event: string, _callback: (event: { canGoBack: boolean }) => void) => ({
        remove: bridgeMocks.remove,
      }),
    );
    bridgeMocks.setState.mockResolvedValue(undefined);
  });

  it("delegates a root with no owned layer to the Android system", async () => {
    const { initAndroidBackHandler, publishAndroidBackNavigationState } = await import(
      "../androidBackHandler"
    );

    await initAndroidBackHandler();
    await publishAndroidBackNavigationState({ isRoot: true });

    expect(bridgeMocks.setState).toHaveBeenLastCalledWith({
      canConsume: false,
      hasVisibleLayer: false,
    });
  });

  it("re-enables native consumption while an owned layer is registered", async () => {
    const {
      initAndroidBackHandler,
      publishAndroidBackNavigationState,
      registerModalCloseCallback,
    } = await import("../androidBackHandler");

    await initAndroidBackHandler();
    await publishAndroidBackNavigationState({ isRoot: true });
    const unregister = registerModalCloseCallback(() => true);
    await vi.waitFor(() => {
      expect(bridgeMocks.setState).toHaveBeenLastCalledWith({
        canConsume: true,
        hasVisibleLayer: false,
      });
    });
    unregister();
    await vi.waitFor(() => {
      expect(bridgeMocks.setState).toHaveBeenLastCalledWith({
        canConsume: false,
        hasVisibleLayer: false,
      });
    });
  });

  it("passes committed Back context through LIFO and removes only its listener", async () => {
    let callback: ((event: { canGoBack: boolean }) => void) | null = null;
    bridgeMocks.addListener.mockImplementation(
      async (_event: string, listener: (event: { canGoBack: boolean }) => void) => {
        callback = listener;
        return { remove: bridgeMocks.remove };
      },
    );
    const {
      initAndroidBackHandler,
      registerModalCloseCallback,
      removeAndroidBackHandler,
    } = await import("../androidBackHandler");
    const first = vi.fn(() => false);
    const top = vi.fn(() => true);
    registerModalCloseCallback(first);
    registerModalCloseCallback(top);

    await initAndroidBackHandler();
    const invoke = callback as ((event: { canGoBack: boolean }) => void) | null;
    expect(invoke).toBeTypeOf("function");
    invoke?.({ canGoBack: true });

    expect(top).toHaveBeenCalledWith({ canGoBack: true });
    expect(first).not.toHaveBeenCalled();
    await removeAndroidBackHandler();
    expect(bridgeMocks.remove).toHaveBeenCalledTimes(1);
  });

  it("does not traverse history when a layer visible at native dispatch disappears before delivery", async () => {
    type NativeBackEvent = { canGoBack: boolean; hadVisibleLayer?: boolean };
    let callback: ((event: NativeBackEvent) => void) | null = null;
    bridgeMocks.addListener.mockImplementation(
      async (_event: string, listener: (event: NativeBackEvent) => void) => {
        callback = listener;
        return { remove: bridgeMocks.remove };
      },
    );

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.getBoundingClientRect = () => ({
      bottom: 250,
      height: 240,
      left: 10,
      right: 330,
      top: 10,
      width: 320,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });
    document.body.append(dialog);
    const historyBack = vi.spyOn(window.history, "back").mockImplementation(() => undefined);

    try {
      const { initAndroidBackHandler, publishAndroidBackNavigationState } = await import(
        "../androidBackHandler"
      );
      await initAndroidBackHandler();
      await publishAndroidBackNavigationState({ isRoot: false });

      // Vaul/WebView may remove the layer before the Capacitor listener runs.
      dialog.remove();
      const invoke = callback as ((event: NativeBackEvent) => void) | null;
      invoke?.({ canGoBack: true, hadVisibleLayer: true });

      expect(historyBack).not.toHaveBeenCalled();
    } finally {
      historyBack.mockRestore();
      dialog.remove();
    }
  });

  it("prevents duplicate listeners and can register again after targeted teardown", async () => {
    const { initAndroidBackHandler, removeAndroidBackHandler } = await import(
      "../androidBackHandler"
    );

    await initAndroidBackHandler();
    await initAndroidBackHandler();
    expect(bridgeMocks.addListener).toHaveBeenCalledTimes(1);

    await removeAndroidBackHandler();
    expect(bridgeMocks.remove).toHaveBeenCalledTimes(1);

    await initAndroidBackHandler();
    expect(bridgeMocks.addListener).toHaveBeenCalledTimes(2);
  });
});
