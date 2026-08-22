import { beforeEach, describe, expect, it, vi } from "vitest";

const nativeMocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  exitApp: vi.fn(),
  remove: vi.fn(),
  setState: vi.fn(),
}));

let committedBack: ((event: { canGoBack: boolean; hadVisibleLayer?: boolean }) => void) | null =
  null;

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: nativeMocks.addListener,
    exitApp: nativeMocks.exitApp,
  },
}));

vi.mock("@capacitor/core", () => ({
  registerPlugin: vi.fn(() => ({
    addListener: nativeMocks.addListener,
    setState: nativeMocks.setState,
  })),
}));

vi.mock("@/lib/platform", () => ({ isNative: true, isAndroid: true }));
vi.mock("../logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/safeJson", () => ({ storageGetRaw: vi.fn(() => "en") }));
vi.mock("@/lib/storageKeys", () => ({ SK: { LANGUAGE: "zenflow-language" } }));

type BackEvent = { canGoBack: boolean; hadVisibleLayer?: boolean };
type RegisterOptions = { layer?: "overlay" | "navigation" };

describe("T182 deterministic Android Back ownership", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.replaceChildren();
    committedBack = null;
    nativeMocks.addListener.mockImplementation(
      async (_event: string, listener: (event: BackEvent) => void) => {
        committedBack = listener;
        return { remove: nativeMocks.remove };
      },
    );
    nativeMocks.setState.mockResolvedValue({
      canConsume: false,
      hasVisibleLayer: false,
    });
  });

  it("delegates an unobstructed Orb root to Android instead of exit or history side effects", async () => {
    const handler = await import("../androidBackHandler");
    const publish = Reflect.get(handler, "publishAndroidBackNavigationState") as
      | ((state: { isRoot: boolean }) => Promise<void>)
      | undefined;

    await handler.initAndroidBackHandler();
    expect(publish).toBeTypeOf("function");
    await publish?.({ isRoot: true });

    expect(nativeMocks.setState).toHaveBeenLastCalledWith({
      canConsume: false,
      hasVisibleLayer: false,
    });
    expect(nativeMocks.exitApp).not.toHaveBeenCalled();
  });

  it("closes the top overlay before a later-registered navigation owner", async () => {
    const handler = await import("../androidBackHandler");
    const register = handler.registerModalCloseCallback as unknown as (
      callback: (event: BackEvent) => boolean,
      options?: RegisterOptions,
    ) => () => void;
    const overlay = vi.fn(() => true);
    const navigation = vi.fn(() => true);

    await handler.initAndroidBackHandler();
    register(overlay, { layer: "overlay" });
    await vi.waitFor(() => {
      expect(nativeMocks.setState).toHaveBeenLastCalledWith({
        canConsume: true,
        hasVisibleLayer: true,
      });
    });
    register(navigation, { layer: "navigation" });
    committedBack?.({ canGoBack: true });

    expect(overlay).toHaveBeenCalledTimes(1);
    expect(navigation).not.toHaveBeenCalled();
  });

  it("honors a registered non-DOM overlay when the native snapshot reports a visible layer", async () => {
    const handler = await import("../androidBackHandler");
    const close = vi.fn(() => true);

    await handler.initAndroidBackHandler();
    handler.registerModalCloseCallback(close);
    await vi.waitFor(() => {
      expect(nativeMocks.setState).toHaveBeenLastCalledWith({
        canConsume: true,
        hasVisibleLayer: true,
      });
    });
    committedBack?.({ canGoBack: false, hadVisibleLayer: true });

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes an unregistered visual layer before a registered navigation owner", async () => {
    const handler = await import("../androidBackHandler");
    const register = handler.registerModalCloseCallback as unknown as (
      callback: (event: BackEvent) => boolean,
      options?: RegisterOptions,
    ) => () => void;
    const navigation = vi.fn(() => true);
    const onEscape = vi.fn((event: KeyboardEvent) => {
      if (event.key === "Escape") dialog.remove();
    });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      bottom: 500,
      height: 400,
      left: 100,
      right: 500,
      top: 100,
      width: 400,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    document.body.append(dialog);
    document.addEventListener("keydown", onEscape);

    await handler.initAndroidBackHandler();
    register(navigation, { layer: "navigation" });
    committedBack?.({ canGoBack: true, hadVisibleLayer: true });

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(navigation).not.toHaveBeenCalled();
    document.removeEventListener("keydown", onEscape);
  });

  it("closes a top unregistered modal before a lower registered overlay owner", async () => {
    const handler = await import("../androidBackHandler");
    const lowerClose = vi.fn(() => true);
    const onTopEscape = vi.fn((event: KeyboardEvent) => {
      if (event.key === "Escape") topDialog.remove();
    });
    const lowerDialog = document.createElement("div");
    const topDialog = document.createElement("div");
    const topButton = document.createElement("button");

    for (const dialog of [lowerDialog, topDialog]) {
      dialog.setAttribute("role", "dialog");
      vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
        bottom: 500,
        height: 400,
        left: 100,
        right: 500,
        top: 100,
        width: 400,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });
    }

    await handler.initAndroidBackHandler();
    document.body.append(lowerDialog);
    handler.registerModalCloseCallback(lowerClose, { layer: "overlay" });
    topDialog.append(topButton);
    topDialog.addEventListener("keydown", onTopEscape);
    document.body.append(topDialog);
    topButton.focus();

    committedBack?.({ canGoBack: false, hadVisibleLayer: true });

    expect(onTopEscape).toHaveBeenCalledTimes(1);
    expect(topDialog.isConnected).toBe(false);
    expect(lowerClose).not.toHaveBeenCalled();
  });

  it("closes a registered transient listbox above a registered editor before exiting the editor", async () => {
    const handler = await import("../androidBackHandler");
    const editorExit = vi.fn(() => true);
    const listbox = document.createElement("div");
    const editor = document.createElement("div");
    const closeSlashMenu = vi.fn(() => {
      listbox.remove();
      return true;
    });
    listbox.setAttribute("role", "listbox");
    vi.spyOn(listbox, "getBoundingClientRect").mockReturnValue({
      bottom: 520,
      height: 240,
      left: 80,
      right: 440,
      top: 280,
      width: 360,
      x: 80,
      y: 280,
      toJSON: () => ({}),
    });
    document.body.append(editor, listbox);
    editor.focus();

    await handler.initAndroidBackHandler();
    handler.registerModalCloseCallback(editorExit, { layer: "overlay" });
    handler.registerModalCloseCallback(closeSlashMenu, { layer: "overlay" });
    committedBack?.({ canGoBack: false, hadVisibleLayer: true });

    expect(closeSlashMenu).toHaveBeenCalledTimes(1);
    expect(listbox.isConnected).toBe(false);
    expect(editorExit).not.toHaveBeenCalled();
  });

  it("does not treat a persistent listbox as a transient Back owner", async () => {
    const handler = await import("../androidBackHandler");
    const navigation = vi.fn(() => true);
    const onEscape = vi.fn();
    const listbox = document.createElement("div");

    listbox.setAttribute("role", "listbox");
    vi.spyOn(listbox, "getBoundingClientRect").mockReturnValue({
      bottom: 520,
      height: 420,
      left: 16,
      right: 80,
      top: 100,
      width: 64,
      x: 16,
      y: 100,
      toJSON: () => ({}),
    });
    listbox.addEventListener("keydown", onEscape);
    document.body.append(listbox);

    await handler.initAndroidBackHandler();
    handler.registerModalCloseCallback(navigation, { layer: "navigation" });
    committedBack?.({ canGoBack: true, hadVisibleLayer: false });

    expect(onEscape).not.toHaveBeenCalled();
    expect(navigation).toHaveBeenCalledTimes(1);
  });

  it("closes only the top registered overlay when a visible dialog stack is present", async () => {
    const handler = await import("../androidBackHandler");
    const lowerClose = vi.fn(() => true);
    const topClose = vi.fn(() => true);
    const onGlobalEscape = vi.fn();
    const lowerDialog = document.createElement("div");
    const topDialog = document.createElement("div");
    const topButton = document.createElement("button");

    for (const dialog of [lowerDialog, topDialog]) {
      dialog.setAttribute("role", "alertdialog");
      vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
        bottom: 500,
        height: 400,
        left: 100,
        right: 500,
        top: 100,
        width: 400,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });
    }
    topDialog.append(topButton);
    document.body.append(lowerDialog, topDialog);
    document.addEventListener("keydown", onGlobalEscape);
    topButton.focus();

    await handler.initAndroidBackHandler();
    handler.registerModalCloseCallback(lowerClose, { layer: "overlay" });
    handler.registerModalCloseCallback(topClose, { layer: "overlay" });
    committedBack?.({ canGoBack: false, hadVisibleLayer: true });

    expect(topClose).toHaveBeenCalledTimes(1);
    expect(lowerClose).not.toHaveBeenCalled();
    expect(onGlobalEscape).not.toHaveBeenCalled();
    document.removeEventListener("keydown", onGlobalEscape);
  });

  it("treats a reachable Radix context menu as the current visual Back layer", async () => {
    const handler = await import("../androidBackHandler");
    const register = handler.registerModalCloseCallback as unknown as (
      callback: (event: BackEvent) => boolean,
      options?: RegisterOptions,
    ) => () => void;
    const navigation = vi.fn(() => true);
    const menu = document.createElement("div");
    const item = document.createElement("button");
    const onMenuKeyDown = vi.fn((event: KeyboardEvent) => {
      if (event.key === "Escape") menu.remove();
    });
    menu.setAttribute("role", "menu");
    vi.spyOn(menu, "getBoundingClientRect").mockReturnValue({
      bottom: 420,
      height: 220,
      left: 80,
      right: 360,
      top: 200,
      width: 280,
      x: 80,
      y: 200,
      toJSON: () => ({}),
    });
    menu.addEventListener("keydown", onMenuKeyDown);
    menu.append(item);
    document.body.append(menu);
    item.focus();

    await handler.initAndroidBackHandler();
    register(navigation, { layer: "navigation" });
    committedBack?.({ canGoBack: true, hadVisibleLayer: true });

    expect(onMenuKeyDown).toHaveBeenCalledTimes(1);
    expect(menu.isConnected).toBe(false);
    expect(navigation).not.toHaveBeenCalled();
  });

  it("dispatches visual fallback Escape from the focused layer for component handlers", async () => {
    const handler = await import("../androidBackHandler");
    const onDialogKeyDown = vi.fn((event: KeyboardEvent) => {
      if (event.key === "Escape") dialog.remove();
    });
    const dialog = document.createElement("div");
    const focusedButton = document.createElement("button");
    dialog.setAttribute("role", "alertdialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      bottom: 500,
      height: 400,
      left: 100,
      right: 500,
      top: 100,
      width: 400,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    dialog.addEventListener("keydown", onDialogKeyDown);
    dialog.append(focusedButton);
    document.body.append(dialog);
    focusedButton.focus();

    await handler.initAndroidBackHandler();
    committedBack?.({ canGoBack: false, hadVisibleLayer: true });

    expect(onDialogKeyDown).toHaveBeenCalledTimes(1);
    expect(dialog.isConnected).toBe(false);
  });

  it("consumes a rapid duplicate commit until the first UI close has painted", async () => {
    const handler = await import("../androidBackHandler");
    const close = vi.fn(() => true);

    await handler.initAndroidBackHandler();
    handler.registerModalCloseCallback(close);
    committedBack?.({ canGoBack: false });
    committedBack?.({ canGoBack: false });

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("bounds a rejected native ownership publication and leaves a later state change retryable", async () => {
    const bridgeError = new Error("Android Back bridge unavailable");
    nativeMocks.setState
      .mockRejectedValueOnce(bridgeError)
      .mockResolvedValueOnce({ canConsume: false, hasVisibleLayer: false });
    const { logger } = await import("../logger");
    const handler = await import("../androidBackHandler");

    await expect(handler.initAndroidBackHandler()).resolves.toBeUndefined();

    expect(nativeMocks.setState).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "[AndroidBackHandler] Failed to publish ownership state",
      bridgeError,
    );

    await handler.publishAndroidBackNavigationState({ isRoot: true });
    expect(nativeMocks.setState).toHaveBeenCalledTimes(2);
  });

  it("unregisters only the T182 listener and republishes root ownership after cleanup", async () => {
    const handler = await import("../androidBackHandler");

    await handler.initAndroidBackHandler();
    handler.registerModalCloseCallback(() => true);
    await vi.waitFor(() => {
      expect(nativeMocks.setState).toHaveBeenLastCalledWith({
        canConsume: true,
        hasVisibleLayer: true,
      });
    });
    await handler.removeAndroidBackHandler();

    expect(nativeMocks.remove).toHaveBeenCalledTimes(1);
    expect(nativeMocks.setState).toHaveBeenLastCalledWith({
      canConsume: false,
      hasVisibleLayer: false,
    });
  });
});
