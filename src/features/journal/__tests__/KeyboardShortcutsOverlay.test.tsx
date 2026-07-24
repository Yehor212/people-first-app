import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { KeyboardShortcutsOverlay } from "../KeyboardShortcutsOverlay";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      keyboardShortcuts: "Keyboard shortcuts",
      journalShortcutNavigation: "Navigation",
      journalShortcutEditor: "Editor",
      journalShortcutView: "View",
      journalShortcutToggleSidebar: "Toggle sidebar",
      journalShortcutToggleCompact: "Compact or hidden sidebar",
      journalShortcutCloseOrBack: "Close or go back",
      journalFormatBold: "Bold",
      journalFormatItalic: "Italic",
      journalFormatUnderline: "Underline",
      journalSlashCommands: "Slash commands",
      journalShortcutSaveEntry: "Save entry",
      journalShortcutShowHelp: "Show shortcuts",
    },
  }),
}));
vi.mock("@/hooks/useBackHandler", () => ({ useBackHandler: vi.fn() }));

describe("KeyboardShortcutsOverlay", () => {
  it("honors the app motion preference in addition to the operating system", () => {
    const source = readFileSync("src/features/journal/KeyboardShortcutsOverlay.tsx", "utf8");
    expect(source).toContain("useShouldAnimate");
  });

  it("uses localized labels, traps focus, and keeps a 44px close target", async () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsOverlay open onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(screen.getByText("Compact or hidden sidebar")).toBeInTheDocument();
    expect(closeButton.className).toContain("min-h-[44px]");
    expect(closeButton.className).toContain("min-w-[44px]");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(closeButton).toHaveFocus();
  });
});
