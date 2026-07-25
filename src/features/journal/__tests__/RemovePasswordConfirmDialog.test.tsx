import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RemovePasswordConfirmDialog } from "../RemovePasswordConfirmDialog";
import {
  JournalRemovePasswordLockedError,
  JournalRemovePasswordPartialError,
} from "../journalSecurityErrors";

const ts = {
  cancel: "Cancel",
  journalPasswordRemove: "Remove Password Lock",
  journalPasswordRemoveConfirm: "Are you sure? Your diary will be accessible without a password.",
  journalLockRemoveFailed: "Unlock your diary first, then try removing the lock again.",
  journalLockRemoveUnexpected: "The lock could not be removed. Nothing changed. Try again.",
  journalLockRemovePartial:
    "The diary lock is still on, but biometric unlock was turned off. Unlock the diary with your password and try again.",
  journalPasswordRemovePending: "Removing lock...",
};

describe("RemovePasswordConfirmDialog", () => {
  it("serializes remove submits while password removal is pending", () => {
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveConfirm = resolve;
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

  it("keeps the dialog open and shows recovery copy when password removal fails", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new JournalRemovePasswordLockedError());

    render(
      <RemovePasswordConfirmDialog
        ts={ts}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Password Lock" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unlock your diary first, then try removing the lock again.",
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

  it("does not claim nothing changed after native biometric cleanup already succeeded", async () => {
    render(
      <RemovePasswordConfirmDialog
        ts={ts}
        onClose={vi.fn()}
        onConfirm={vi.fn().mockRejectedValue(new JournalRemovePasswordPartialError())}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Password Lock" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The diary lock is still on, but biometric unlock was turned off.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("Nothing changed");
  });
});
