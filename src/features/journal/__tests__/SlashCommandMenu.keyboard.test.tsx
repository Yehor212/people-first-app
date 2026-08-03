import { act, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlashCommandMenu } from "../SlashCommandMenu";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      journalSlashCommands: "Diary commands",
      journalSlashNoResults: "No diary commands found",
    },
  }),
}));
vi.mock("@/lib/animationUtils", () => ({ shouldAnimate: () => false }));
vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      function MotionDiv({ children, ...props }, ref) {
        return <div ref={ref} {...props}>{children}</div>;
      },
    ),
  },
}));

describe("SlashCommandMenu keyboard navigation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.getSelection()?.removeAllRanges();
    document.querySelectorAll("[data-slash-test-editor]").forEach((node) => node.remove());
  });

  it("keeps the active keyboard option visible inside the scrollable menu", async () => {
    const scrollIntoView = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    const editor = document.createElement("div");
    editor.dataset.slashTestEditor = "true";
    editor.contentEditable = "true";
    editor.textContent = "/";
    document.body.appendChild(editor);
    const textNode = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);
    Object.defineProperty(range, "getBoundingClientRect", {
      value: () => ({
        bottom: 120,
        height: 16,
        left: 80,
        right: 80,
        top: 104,
        width: 0,
        x: 80,
        y: 104,
        toJSON: () => ({}),
      }),
    });
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    render(
      <SlashCommandMenu
        editorRef={{ current: editor }}
        onCommand={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    void act(() => fireEvent.input(editor, { inputType: "insertText", data: "/" }));
    const listbox = await screen.findByRole("listbox", { name: "Diary commands" });
    scrollIntoView.mockClear();

    act(() => {
      for (let index = 0; index < 7; index += 1) {
        fireEvent.keyDown(document, { key: "ArrowDown" });
      }
    });

    const activeId = listbox.getAttribute("aria-activedescendant");
    expect(activeId).toBe("slash-cmd-focus");
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
  });

  it("does not execute Audio on pointer-down and executes only after click", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    const editor = document.createElement("div");
    editor.dataset.slashTestEditor = "true";
    editor.contentEditable = "true";
    editor.textContent = "/audio";
    document.body.appendChild(editor);
    const textNode = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, editor.textContent.length);
    range.collapse(true);
    Object.defineProperty(range, "getBoundingClientRect", {
      value: () => ({
        bottom: 120,
        height: 16,
        left: 80,
        right: 80,
        top: 104,
        width: 0,
        x: 80,
        y: 104,
        toJSON: () => ({}),
      }),
    });
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const onCommand = vi.fn();

    render(
      <SlashCommandMenu
        editorRef={{ current: editor }}
        onCommand={onCommand}
        onClose={vi.fn()}
      />,
    );

    void act(() => fireEvent.input(editor, { inputType: "insertText", data: "o" }));
    const option = await screen.findByRole("option", { name: /Audio/i });

    fireEvent.pointerDown(option);
    expect(onCommand).not.toHaveBeenCalled();

    fireEvent.click(option);
    expect(onCommand).toHaveBeenCalledOnce();
    expect(onCommand).toHaveBeenCalledWith("audio");
  });
});
