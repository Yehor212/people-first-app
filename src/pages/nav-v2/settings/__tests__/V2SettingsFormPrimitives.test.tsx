import { act, fireEvent, render, screen } from "@testing-library/react";
import { Check } from "lucide-react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const backHandler = vi.hoisted(() => ({
  callback: null as null | (() => boolean),
  unregister: vi.fn(),
}));

vi.mock("@/lib/androidBackHandler", () => ({
  registerModalCloseCallback: vi.fn((callback: () => boolean) => {
    backHandler.callback = callback;
    return backHandler.unregister;
  }),
}));

import {
  SettingsDialog,
  SettingsExternalLink,
  SettingsInlineButton,
  SettingsStatus,
  SettingsTextInput,
} from "../components/V2SettingsFormPrimitives";
import { ActionButton } from "../components/V2SettingsControlPrimitives";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button" disabled={importing} onClick={() => setOpen(true)}>
        Import backup
      </button>
      <div ref={progressRef} tabIndex={-1} data-testid="import-progress">
        {importing ? "Importing" : "Ready"}
      </div>
      {open ? (
        <SettingsDialog
          titleId="import-title"
          title="Import backup"
          description="Review this backup before importing it."
          cancelLabel="Cancel"
          confirmLabel="Import"
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setImporting(true);
            setOpen(false);
          }}
          confirmFocusRef={progressRef}
          returnFocusRef={triggerRef}
        />
      ) : null}
    </>
  );
}

describe("SettingsDialog focus return", () => {
  beforeEach(() => {
    backHandler.callback = null;
    backHandler.unregister.mockClear();
  });

  it("keeps the visual backdrop out of the accessibility and keyboard order", () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Import backup" }));

    const dialog = screen.getByRole("dialog");
    const panel = dialog.querySelector<HTMLElement>("[data-dialog-panel]")!;
    const backdrop = dialog.querySelector<HTMLButtonElement>(":scope > button")!;
    const visibleCancel = panel.querySelector<HTMLButtonElement>("button")!;

    expect(panel).toHaveFocus();
    expect(backdrop).toHaveAttribute("tabindex", "-1");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(visibleCancel).toHaveFocus();
  });

  it("returns focus to an explicit trigger when a file picker opened the dialog", () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Import backup" });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByText("Cancel").closest("button")!);

    expect(trigger).toHaveFocus();
  });

  it("moves focus to an enabled progress target after confirmation", () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Import backup" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(trigger).toBeDisabled();
    expect(screen.getByTestId("import-progress")).toHaveFocus();
  });

  it("dismisses on Escape and restores focus to the trigger", () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Import backup" });

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("registers an Android Back close callback", () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Import backup" }));

    expect(backHandler.callback).toEqual(expect.any(Function));
    act(() => {
      backHandler.callback?.();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SettingsTextInput", () => {
  it("lets the browser isolate direction for user-entered text", () => {
    render(<SettingsTextInput value="" onChange={() => undefined} />);

    expect(screen.getByRole("textbox")).toHaveAttribute("dir", "auto");
  });

  it("aligns an empty placeholder with the surrounding writing direction", () => {
    render(<SettingsTextInput value="" onChange={() => undefined} placeholder="أدخل اسمك" />);

    expect(screen.getByRole("textbox")).toHaveClass(
      "ltr:placeholder:text-left",
      "rtl:placeholder:text-right"
    );
  });
});

describe("Settings form text reflow", () => {
  it("uses the foreground token for primary action text on dark settings surfaces", () => {
    render(
      <>
        <SettingsInlineButton onClick={() => undefined} variant="primary">
          Save inline
        </SettingsInlineButton>
        <ActionButton icon={Check} onClick={() => undefined} variant="primary">
          Save action
        </ActionButton>
      </>
    );

    for (const button of [
      screen.getByRole("button", { name: "Save inline" }),
      screen.getByRole("button", { name: "Save action" }),
    ]) {
      expect(button).toHaveClass("text-foreground");
      expect(button.className).not.toContain("text-[hsl(var(--settings-v2-accent))]");
    }
  });

  it("keeps a long mixed-direction import filename fully available", () => {
    render(
      <SettingsDialog
        titleId="import-title"
        title="Import backup"
        description="Review this backup before importing it."
        detail="نسخة-ZenFlow-дуже-довге-ім’я-2026-07-15.json"
        cancelLabel="Cancel"
        confirmLabel="Import"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    );

    const detail = screen.getByText("نسخة-ZenFlow-дуже-довге-ім’я-2026-07-15.json");
    expect(detail).toHaveAttribute("dir", "auto");
    expect(detail).not.toHaveClass("truncate");
    expect(detail.className).toContain("[overflow-wrap:anywhere]");
  });

  it("allows long action labels to wrap", () => {
    render(
      <SettingsInlineButton onClick={() => undefined}>
        Benachrichtigungsberechtigung
      </SettingsInlineButton>
    );

    const button = screen.getByRole("button", {
      name: "Benachrichtigungsberechtigung",
    });
    const label = screen.getByText("Benachrichtigungsberechtigung");

    expect(button).toHaveClass(
      "min-h-[48px]",
      "w-full",
      "max-w-full",
      "min-w-0",
      "whitespace-normal"
    );
    expect(button).not.toHaveClass("min-h-[44px]");
    expect(label).toHaveClass("min-w-0", "break-words");
    expect(label.className).toContain("[overflow-wrap:break-word]");
    expect(label.className).toContain("[hyphens:manual]");
    expect(label.className).not.toContain("[overflow-wrap:anywhere]");
  });

  it("keeps ordinary status and link copy intact while retaining emergency wrapping", () => {
    render(
      <>
        <SettingsStatus>Benachrichtigungsberechtigung</SettingsStatus>
        <SettingsExternalLink href="https://example.com">
          Benachrichtigungseinstellungen
        </SettingsExternalLink>
      </>
    );

    for (const text of [
      screen.getByText("Benachrichtigungsberechtigung"),
      screen.getByRole("link", { name: "Benachrichtigungseinstellungen" }),
    ]) {
      expect(text).toHaveClass("min-w-0", "break-words");
      expect(text.className).toContain("[hyphens:manual]");
      expect(text.className).toContain("[overflow-wrap:break-word]");
      expect(text.className).not.toContain("[overflow-wrap:anywhere]");
    }

    expect(screen.getByRole("link", { name: "Benachrichtigungseinstellungen" })).toHaveClass(
      "min-h-[48px]"
    );
  });
});
