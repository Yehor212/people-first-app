import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import { RemovePasswordConfirmDialog } from "../RemovePasswordConfirmDialog";

const backHandlerMock = vi.hoisted(() => ({
  handler: null as null | (() => void),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: (_isOpen: boolean, handler: () => void) => {
    backHandlerMock.handler = handler;
  },
}));

const ts = {
  cancel: "Cancel",
  journalPasswordRemove: "Remove Password Lock",
  journalPasswordRemoveConfirm: "Are you sure? Your diary will be accessible without a password.",
  journalLockRemoveFailed: "Unlock your diary first, then try removing the lock again.",
  journalLockRemoveUnexpected: "The lock could not be removed. Nothing changed. Try again.",
  journalLockRemoveRevisionMismatch:
    "Your diary changed while it was being checked. Reload it, unlock it, and try again. Nothing was changed.",
  journalLockRemovePartialBoth:
    "Diary protection is off on this device. Cleanup for biometric unlock and your other signed-in devices is still pending. Keep the app open, stay signed in, and try again when online.",
  journalPasswordRemovePending: "Removing lock...",
  done: "Done",
};

function StackAwareTopDialog({ onClose }: { onClose: () => void }) {
  useModalKeyboard({
    isOpen: true,
    onClose,
    trapFocus: false,
    restoreFocus: false,
  });

  return <div role="dialog" aria-label="Top dialog" />;
}

function PartialCleanupFocusHarness() {
  const [open, setOpen] = useState(false);
  const [showOriginalAction, setShowOriginalAction] = useState(true);
  const retryRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      {showOriginalAction ? (
        <button type="button" onClick={() => setOpen(true)}>
          Open removal
        </button>
      ) : null}
      <button ref={retryRef} type="button">
        Retry online cleanup
      </button>
      {open ? (
        <RemovePasswordConfirmDialog
          ts={ts}
          onClose={() => setOpen(false)}
          onResult={(result) => {
            if (result.status === "removed-cleanup-pending") {
              setShowOriginalAction(false);
            }
          }}
          getReturnFocusFallback={() => retryRef.current}
          onConfirm={vi.fn().mockResolvedValue({
            status: "removed-cleanup-pending",
            pending: ["cloud"],
          })}
        />
      ) : null}
    </>
  );
}

describe("RemovePasswordConfirmDialog", () => {
  it("focuses Cancel, traps Tab, and closes from Escape or Android Back while idle", () => {
    const onClose = vi.fn();
    render(
      <RemovePasswordConfirmDialog
        ts={ts}
        onClose={onClose}
        onConfirm={vi.fn().mockResolvedValue({ status: "removed" })}
      />,
    );

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const remove = screen.getByRole("button", { name: "Remove Password Lock" });
    expect(cancel).toHaveFocus();
    remove.focus();
    fireEvent.keyDown(remove, { key: "Tab" });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    backHandlerMock.handler?.();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveClass("min-h-[48px]");
    expect(remove).toHaveClass("min-h-[48px]");
  });

  it("keeps the removal dialog open when Escape belongs to a newer modal layer", () => {
    const onRemovalClose = vi.fn();
    const onTopClose = vi.fn();

    render(
      <>
        <RemovePasswordConfirmDialog
          ts={ts}
          onClose={onRemovalClose}
          onConfirm={vi.fn().mockResolvedValue({ status: "removed" })}
        />
        <StackAwareTopDialog onClose={onTopClose} />
      </>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onTopClose).toHaveBeenCalledTimes(1);
    expect(onRemovalClose).not.toHaveBeenCalled();
  });

  it("serializes remove submits while password removal is pending", () => {
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn(
      () => new Promise<{ status: "removed" }>((resolve) => {
        resolveConfirm = () => resolve({ status: "removed" });
      }),
    );

    render(
      <RemovePasswordConfirmDialog
        ts={ts}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const removeButton = screen.getByRole("button", { name: "Remove Password Lock" });

    fireEvent.click(removeButton);
    fireEvent.click(removeButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(removeButton).toBeDisabled();
    expect(removeButton).toHaveTextContent("Removing lock...");

    resolveConfirm();
  });

  it("keeps the dialog open and shows a specific recovery action when preflight blocks removal", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue({
      status: "blocked",
      blocker: "vault-revision-mismatch",
      recoveryAction: "reload",
    });

    render(
      <RemovePasswordConfirmDialog
        ts={ts}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Password Lock" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your diary changed while it was being checked. Reload it, unlock it, and try again. Nothing was changed.",
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses truthful generic recovery copy for non-lock failures", async () => {
    render(
      <RemovePasswordConfirmDialog
        ts={ts}
        onClose={vi.fn()}
        onConfirm={vi.fn().mockRejectedValue(new Error("indexeddb unavailable"))}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Password Lock" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The lock could not be removed. Nothing changed. Try again.",
    );
  });

  it("reports local success without offering a second destructive submit when cleanup is pending", async () => {
    const onClose = vi.fn();
    const onResult = vi.fn();

    render(
      <RemovePasswordConfirmDialog
        ts={ts}
        onClose={onClose}
        onResult={onResult}
        onConfirm={vi.fn().mockResolvedValue({
          status: "removed-cleanup-pending",
          pending: ["biometric", "cloud"],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Password Lock" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Diary protection is off on this device. Cleanup for biometric unlock and your other signed-in devices is still pending.",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("Nothing changed");
    expect(screen.queryByRole("button", { name: "Remove Password Lock" })).not.toBeInTheDocument();
    const doneButton = screen.getByRole("button", { name: "Done" });
    expect(doneButton).toHaveClass("min-h-[48px]");
    await waitFor(() => expect(doneButton).toHaveFocus());
    expect(onResult).toHaveBeenCalledWith({
      status: "removed-cleanup-pending",
      pending: ["biometric", "cloud"],
    });

    fireEvent.click(doneButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to cleanup retry when the original removal action disappeared", async () => {
    render(<PartialCleanupFocusHarness />);

    const opener = screen.getByRole("button", { name: "Open removal" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove Password Lock" }),
    );

    const done = await screen.findByRole("button", { name: "Done" });
    await waitFor(() => expect(done).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Open removal" })).not.toBeInTheDocument();

    fireEvent.click(done);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry online cleanup" })).toHaveFocus(),
    );
  });

  it("closes after a complete removal and reports the typed result", async () => {
    const onClose = vi.fn();
    const onResult = vi.fn();

    render(
      <RemovePasswordConfirmDialog
        ts={ts}
        onClose={onClose}
        onResult={onResult}
        onConfirm={vi.fn().mockResolvedValue({ status: "removed" })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Password Lock" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onResult).toHaveBeenCalledWith({ status: "removed" });
  });
});
