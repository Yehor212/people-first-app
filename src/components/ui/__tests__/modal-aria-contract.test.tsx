import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: { close: "Close" } }),
}));

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

describe("ZenFlow modal ARIA ownership", () => {
  it("marks the shared AlertDialog content as modal", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm recovery</AlertDialogTitle>
          <AlertDialogDescription>Review this change.</AlertDialogDescription>
          <AlertDialogCancel>Cancel recovery</AlertDialogCancel>
          <AlertDialogAction>Continue recovery</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveClass(
      "zf-safe-area-dialog",
      "min-w-0",
      "overflow-y-auto",
      "p-2",
      "sm:p-6",
    );
    expect(screen.getByRole("heading", { name: "Confirm recovery" })).toHaveClass(
      "min-w-0",
      "break-words",
      "[hyphens:manual]",
      "[overflow-wrap:break-word]",
    );
    expect(screen.getByText("Review this change.")).toHaveClass(
      "min-w-0",
      "break-words",
      "[hyphens:manual]",
      "[overflow-wrap:break-word]",
    );
    expect(screen.getByRole("button", { name: "Cancel recovery" })).toHaveClass(
      "px-1",
      "sm:px-5",
      "whitespace-normal",
      "[overflow-wrap:break-word]",
    );
    expect(screen.getByRole("button", { name: "Continue recovery" })).toHaveClass(
      "px-1",
      "sm:px-5",
      "whitespace-normal",
      "[overflow-wrap:break-word]",
    );
  });

  it("marks the shared Dialog content as modal", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Challenge details</DialogTitle>
          <DialogDescription>Review this challenge.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveClass(
      "zf-safe-area-dialog",
      "min-w-0",
      "overflow-y-auto",
      "p-3",
    );
    expect(screen.getByRole("heading", { name: "Challenge details" })).toHaveClass(
      "min-w-0",
      "break-words",
      "[overflow-wrap:anywhere]",
    );
    expect(screen.getByText("Review this challenge.")).toHaveClass(
      "min-w-0",
      "break-words",
      "[overflow-wrap:anywhere]",
    );
  });
});
