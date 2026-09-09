import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJournalKeyboardViewport } from "../useJournalKeyboardViewport";

const native = vi.hoisted(() => ({
  android: true,
  acquireKeyboardViewport: vi.fn(),
  releaseKeyboardViewport: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({ get isAndroid() { return native.android; } }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => native }));
vi.mock("@/lib/logger", () => ({ logger: { warn: native.warn } }));

function pendingLease() {
  let resolve!: (value: { owner: string }) => void;
  const promise = new Promise<{ owner: string }>(complete => { resolve = complete; });
  return { promise, resolve };
}

describe("journal Android keyboard viewport lease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.android = true;
    native.acquireKeyboardViewport.mockReset().mockResolvedValue({ owner: "1" });
    native.releaseKeyboardViewport.mockReset().mockResolvedValue({ released: true });
  });

  it("acquires once on mount and releases the native owner on unmount", async () => {
    const view = renderHook(() => useJournalKeyboardViewport(true));
    await waitFor(() => expect(native.acquireKeyboardViewport).toHaveBeenCalledTimes(1));
    view.rerender();
    expect(native.acquireKeyboardViewport).toHaveBeenCalledTimes(1);
    view.unmount();
    await waitFor(() => expect(native.releaseKeyboardViewport).toHaveBeenCalledWith({ owner: "1" }));
  });

  it.each(["non-Android", "desktop"])("does not alter %s behavior", mode => {
    native.android = mode !== "non-Android";
    renderHook(() => useJournalKeyboardViewport(mode !== "desktop"));
    expect(native.acquireKeyboardViewport).not.toHaveBeenCalled();
    expect(native.releaseKeyboardViewport).not.toHaveBeenCalled();
  });

  it("releases an acquisition that resolves after unmount", async () => {
    const pending = pendingLease();
    native.acquireKeyboardViewport.mockReturnValue(pending.promise);
    const view = renderHook(() => useJournalKeyboardViewport(true));
    view.unmount();
    await act(async () => pending.resolve({ owner: "41" }));
    expect(native.releaseKeyboardViewport).toHaveBeenCalledExactlyOnceWith({ owner: "41" });
  });

  it("keeps StrictMode replacement identity separate from late cleanup", async () => {
    const first = pendingLease();
    const second = pendingLease();
    native.acquireKeyboardViewport.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = renderHook(() => useJournalKeyboardViewport(true), { wrapper: StrictMode });
    await act(async () => second.resolve({ owner: "52" }));
    await act(async () => first.resolve({ owner: "51" }));
    expect(native.releaseKeyboardViewport).toHaveBeenCalledExactlyOnceWith({ owner: "51" });
    view.unmount();
    await waitFor(() => expect(native.releaseKeyboardViewport).toHaveBeenLastCalledWith({ owner: "52" }));
  });

  it("releases when the editor switches to desktop layout", async () => {
    const view = renderHook(({ phone }) => useJournalKeyboardViewport(phone), { initialProps: { phone: true } });
    await act(async () => {});
    view.rerender({ phone: false });
    await waitFor(() => expect(native.releaseKeyboardViewport).toHaveBeenCalledExactlyOnceWith({ owner: "1" }));
    expect(native.acquireKeyboardViewport).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable native acquisition without changing CSS or inventing an inset", async () => {
    native.acquireKeyboardViewport.mockRejectedValue(new Error("native method unavailable"));
    const before = document.documentElement.getAttribute("style");
    const view = renderHook(() => useJournalKeyboardViewport(true));
    await waitFor(() => expect(native.warn).toHaveBeenCalled());
    expect(document.documentElement.getAttribute("style")).toBe(before);
    view.unmount();
    expect(native.releaseKeyboardViewport).not.toHaveBeenCalled();
  });

  it("handles a rejected release without an unhandled promise", async () => {
    native.releaseKeyboardViewport.mockRejectedValue(new Error("activity gone"));
    const view = renderHook(() => useJournalKeyboardViewport(true));
    await act(async () => {});
    view.unmount();
    await waitFor(() => expect(native.warn).toHaveBeenCalled());
  });
});

describe("journal caret visibility within the native keyboard viewport", () => {
  let shell: HTMLDivElement;
  let scrollArea: HTMLDivElement;
  let editor: HTMLDivElement;
  let resize: ResizeObserverCallback;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let rangeRectsDescriptor: PropertyDescriptor | undefined;

  const flushFrames = () => act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(0));
  });

  beforeEach(() => {
    native.android = true;
    native.acquireKeyboardViewport.mockReset().mockResolvedValue({ owner: "1" });
    native.releaseKeyboardViewport.mockReset().mockResolvedValue({ released: true });
    document.documentElement.dataset.journalKeyboardViewport = "1";
    shell = document.createElement("div");
    shell.dataset.testid = "journal-entry-editor";
    shell.setAttribute("role", "dialog");
    shell.style.paddingBottom = "64px";
    Object.defineProperties(shell, {
      clientHeight: { configurable: true, value: 360 },
      clientWidth: { configurable: true, value: 863 },
    });
    scrollArea = document.createElement("div");
    editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.tabIndex = 0;
    editor.style.lineHeight = "36px";
    scrollArea.append(editor);
    shell.append(scrollArea);
    document.body.append(shell);
    Object.defineProperties(scrollArea, {
      clientHeight: { configurable: true, value: 141 },
      scrollHeight: { configurable: true, value: 570 },
    });
    scrollArea.getBoundingClientRect = () => new DOMRect(0, 91, 863, 141);
    editor.getBoundingClientRect = () => new DOMRect(44, 313 - scrollArea.scrollTop, 774, 260);
    editor.focus();
    // jsdom has no layout engine; only the external geometry boundary is supplied.
    rangeRectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects");
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      writable: true,
      value: () => [],
    });
    frames = new Map();
    nextFrame = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { frames.delete(id); });
    resize = () => {};
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    shell.remove();
    document.getSelection()?.removeAllRanges();
    delete document.documentElement.dataset.journalKeyboardViewport;
    vi.restoreAllMocks();
    if (rangeRectsDescriptor) {
      Object.defineProperty(Range.prototype, "getClientRects", rangeRectsDescriptor);
    } else {
      Reflect.deleteProperty(Range.prototype, "getClientRects");
    }
    vi.unstubAllGlobals();
  });

  async function mount(enabled = true) {
    const ref = { current: scrollArea };
    const view = renderHook(() => useJournalKeyboardViewport(enabled, ref));
    await act(async () => {});
    flushFrames();
    return view;
  }

  it("brings the focused empty line above Tools after the landscape viewport shrinks", async () => {
    await mount();
    expect(scrollArea.scrollTop).toBe(125);
    expect(editor.getBoundingClientRect().top).toBe(188);
  });

  it("reflows the controls when docked landscape IME leaves no room for two toolbars", async () => {
    shell.style.paddingBottom = "237.333px";
    await mount();
    expect(shell.dataset.journalKeyboardCompact).toBe("1");
  });

  it("restores normal controls when the keyboard no longer occupies the short viewport", async () => {
    shell.style.paddingBottom = "237.333px";
    await mount();
    expect(shell.dataset.journalKeyboardCompact).toBe("1");
    shell.style.paddingBottom = "0px";
    act(() => resize([], {} as ResizeObserver));
    flushFrames();
    expect(shell.hasAttribute("data-journal-keyboard-compact")).toBe(false);
  });

  it("restores portrait controls without releasing the active editor", async () => {
    shell.style.paddingBottom = "237.333px";
    await mount();
    expect(shell.dataset.journalKeyboardCompact).toBe("1");
    Object.defineProperties(shell, {
      clientHeight: { configurable: true, value: 839 },
      clientWidth: { configurable: true, value: 412 },
    });
    shell.style.paddingBottom = "312px";
    act(() => resize([], {} as ResizeObserver));
    flushFrames();
    expect(shell.hasAttribute("data-journal-keyboard-compact")).toBe(false);
    expect(document.activeElement).toBe(editor);
  });

  it("leaves floating keyboard and normal-height layout unchanged", async () => {
    await mount();
    expect(shell.hasAttribute("data-journal-keyboard-compact")).toBe(false);
    shell.style.paddingBottom = "0px";
    act(() => resize([], {} as ResizeObserver));
    flushFrames();
    expect(shell.hasAttribute("data-journal-keyboard-compact")).toBe(false);
  });

  it("removes its compact layout when released without clearing a replacement owner", async () => {
    shell.style.paddingBottom = "237.333px";
    const view = await mount();
    expect(shell.dataset.journalKeyboardCompact).toBe("1");
    view.unmount();
    expect(shell.hasAttribute("data-journal-keyboard-compact")).toBe(false);

    const replacement = await mount();
    shell.dataset.journalKeyboardCompact = "2";
    document.documentElement.dataset.journalKeyboardViewport = "2";
    replacement.unmount();
    expect(shell.dataset.journalKeyboardCompact).toBe("2");
  });

  it("follows the selected line of a long entry rather than centering the whole editor", async () => {
    const text = document.createTextNode("isolated selection fixture");
    editor.append(text);
    document.getSelection()?.setBaseAndExtent(text, 3, text, 8);
    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function (this: Range) {
      expect(this.startContainer).toBe(text);
      expect(this.startOffset).toBe(8);
      expect(this.collapsed).toBe(true);
      return [new DOMRect(600, 400 - scrollArea.scrollTop, 1, 36)] as unknown as DOMRectList;
    });
    await mount();
    expect(scrollArea.scrollTop).toBe(212);
    expect(document.getSelection()?.anchorOffset).toBe(3);
    expect(document.getSelection()?.focusOffset).toBe(8);
    expect(editor.textContent).toBe("isolated selection fixture");
  });

  it("updates on viewport resize without waiting for a second focus event", async () => {
    await mount();
    scrollArea.scrollTop = 0;
    act(() => resize([], {} as ResizeObserver));
    flushFrames();
    expect(scrollArea.scrollTop).toBe(125);
  });

  it("reveals the new empty paragraph after Enter instead of the start of a long entry", async () => {
    editor.append(document.createTextNode("isolated earlier lines"));
    const paragraph = document.createElement("div");
    paragraph.append(document.createElement("br"));
    paragraph.getBoundingClientRect = () => new DOMRect(44, 400 - scrollArea.scrollTop, 774, 36);
    editor.append(paragraph);
    document.getSelection()?.setPosition(paragraph, 0);
    const before = editor.innerHTML;
    await mount();
    expect(scrollArea.scrollTop).toBe(212);
    expect(document.getSelection()?.focusNode).toBe(paragraph);
    expect(document.getSelection()?.focusOffset).toBe(0);
    expect(editor.innerHTML).toBe(before);
  });

  it.each(["input", "selectionchange", "resize"])("keeps the active line visible after %s", async eventName => {
    await mount();
    scrollArea.scrollTop = 0;
    const target = eventName === "input" ? editor : eventName === "resize" ? window : document;
    target.dispatchEvent(new Event(eventName, { bubbles: true }));
    flushFrames();
    expect(scrollArea.scrollTop).toBe(125);
  });

  it("reveals a title above the viewport without moving focus", async () => {
    const title = document.createElement("input");
    title.type = "text";
    title.getBoundingClientRect = () => new DOMRect(0, 200 - scrollArea.scrollTop, 700, 51);
    scrollArea.prepend(title);
    scrollArea.scrollTop = 150;
    title.focus();
    await mount();
    expect(scrollArea.scrollTop).toBe(101);
    expect(document.activeElement).toBe(title);
  });

  it("ignores an older owner after the native viewport was replaced", async () => {
    await mount();
    scrollArea.scrollTop = 0;
    document.documentElement.dataset.journalKeyboardViewport = "2";
    act(() => resize([], {} as ResizeObserver));
    flushFrames();
    expect(scrollArea.scrollTop).toBe(0);
  });

  it("does not snap back while the user manually scrolls to read", async () => {
    await mount();
    scrollArea.scrollTop = 20;
    scrollArea.dispatchEvent(new Event("scroll"));
    flushFrames();
    expect(scrollArea.scrollTop).toBe(20);
  });

  it("keeps an already visible line in place", async () => {
    scrollArea.scrollTop = 150;
    await mount();
    expect(scrollArea.scrollTop).toBe(150);
  });

  it.each(["non-Android", "disabled", "released"])("does not scroll when %s", async mode => {
    native.android = mode !== "non-Android";
    if (mode === "released") delete document.documentElement.dataset.journalKeyboardViewport;
    await mount(mode !== "disabled");
    expect(scrollArea.scrollTop).toBe(0);
  });

  it("does not move the editor when focus belongs to a nested surface", async () => {
    editor.blur();
    await mount();
    expect(scrollArea.scrollTop).toBe(0);
  });

  it("cancels queued visibility work when the owner unmounts", async () => {
    const view = await mount();
    scrollArea.scrollTop = 0;
    act(() => resize([], {} as ResizeObserver));
    view.unmount();
    flushFrames();
    expect(scrollArea.scrollTop).toBe(0);
  });
});
