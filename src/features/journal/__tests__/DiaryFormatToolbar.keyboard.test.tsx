import { act, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiaryFormatToolbar } from "../DiaryFormatToolbar";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    isRTL: false,
    t: {
      journalFormatBold: "Bold",
      journalFormatItalic: "Italic",
      journalFormatToolbar: "Formatting tools",
    },
  }),
}));

vi.mock("@/lib/animationUtils", () => ({ shouldAnimate: () => false }));
vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    button: forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
      function MotionButton({ children, ...props }, ref) {
        return <button ref={ref} {...props}>{children}</button>;
      },
    ),
    div: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      function MotionDiv({ children, ...props }, ref) {
        return <div ref={ref} {...props}>{children}</div>;
      },
    ),
  },
}));

describe("DiaryFormatToolbar keyboard navigation", () => {
  afterEach(() => {
    vi.useRealTimers();
    window.getSelection()?.removeAllRanges();
    document.querySelectorAll("[data-format-test-editor]").forEach((node) => node.remove());
  });

  it("uses one tab stop and moves focus with toolbar navigation keys", async () => {
    vi.useFakeTimers();
    const editor = document.createElement("div");
    editor.dataset.formatTestEditor = "true";
    editor.textContent = "A private selected thought";
    document.body.appendChild(editor);
    const textNode = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 9);
    Object.defineProperty(range, "getBoundingClientRect", {
      value: () => ({
        bottom: 220,
        height: 20,
        left: 120,
        right: 240,
        top: 200,
        width: 120,
        x: 120,
        y: 200,
        toJSON: () => ({}),
      }),
    });
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    render(<DiaryFormatToolbar editorRef={{ current: editor }} />);
    document.dispatchEvent(new Event("selectionchange"));
    await act(async () => vi.advanceTimersByTimeAsync(120));

    const toolbar = screen.getByRole("toolbar", { name: "Formatting tools" });
    const buttons = Array.from(toolbar.querySelectorAll("button"));
    expect(buttons).toHaveLength(7);
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1]);

    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(buttons[1]).toHaveFocus();
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, 0, -1, -1, -1, -1, -1]);

    fireEvent.keyDown(buttons[1], { key: "End" });
    expect(buttons[6]).toHaveFocus();
    fireEvent.keyDown(buttons[6], { key: "ArrowRight" });
    expect(buttons[0]).toHaveFocus();
  });
});
