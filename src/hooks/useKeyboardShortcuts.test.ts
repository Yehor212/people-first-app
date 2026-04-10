import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts, type ShortcutMap } from "./useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  const handler = vi.fn();
  let unmountHook: () => void;
  afterEach(() => {
    handler.mockClear();
    unmountHook?.();
    vi.restoreAllMocks();
  });

  it("fires on matching shortcut", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "ctrl+k": handler }));
    unmountHook = unmount;
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it("ignores when input focused", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "ctrl+n": handler }));
    unmountHook = unmount;
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "n", ctrlKey: true, bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("treats metaKey as ctrlKey", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "ctrl+b": handler }));
    unmountHook = unmount;
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true })
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it("supports number keys", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "ctrl+1": handler }));
    unmountHook = unmount;
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "1", ctrlKey: true, bubbles: true })
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire when disabled", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "ctrl+k": handler }, false));
    unmountHook = unmount;
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
    );
    expect(handler).not.toHaveBeenCalled();
  });
});
