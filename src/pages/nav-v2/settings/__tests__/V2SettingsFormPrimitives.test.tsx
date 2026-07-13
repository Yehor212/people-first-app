import { act, fireEvent, render, screen } from "@testing-library/react";
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

import { SettingsDialog, SettingsTextInput } from "../components/V2SettingsFormPrimitives";

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
});
