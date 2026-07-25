import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JournalImportConfirmDialog } from "../JournalImportConfirmDialog";

const modalMocks = vi.hoisted(() => ({
  useModalA11y: vi.fn(() => ({
    modalProps: { role: "dialog" as const, "aria-modal": true as const },
    handleKeyDown: vi.fn(),
    modalRef: { current: null },
  })),
}));

vi.mock("@/hooks/useModalA11y", () => modalMocks);

const ts = {
  cancel: "Cancel",
  journalEntries: "Entries",
  journalExportAudio: "Audio",
  journalExportPhotos: "Photos",
  journalImport: "Import backup",
  journalImportErrors: "Issues",
  journalImportHint: "Review this backup before adding it to your diary.",
  journalImporting: "Importing backup...",
};

describe("JournalImportConfirmDialog", () => {
  it("shows only counts and the selected filename before confirmation", () => {
    render(
      <JournalImportConfirmDialog
        ts={ts}
        filename="journal-backup.json"
        inspection={{
          canImport: true,
          entries: 12,
          photos: 3,
          audio: 1,
          deletions: 0,
          deletionHistoryIncluded: true,
          issues: 2,
          errors: [],
        }}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Import backup" });
    expect(dialog).toHaveTextContent("journal-backup.json");
    expect(dialog).toHaveTextContent("Entries");
    expect(dialog).toHaveTextContent("12");
    expect(dialog).not.toHaveTextContent("Private content");
    expect(modalMocks.useModalA11y).toHaveBeenCalledWith(true, expect.any(Function));
  });

  it("keeps cancel as the first safe action and blocks both actions while importing", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <JournalImportConfirmDialog
        ts={ts}
        filename="journal-backup.json"
        inspection={{
          canImport: true,
          entries: 1,
          photos: 0,
          audio: 0,
          deletions: 0,
          deletionHistoryIncluded: true,
          issues: 0,
          errors: [],
        }}
        busy
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Import backup" });
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Cancel");
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toHaveTextContent("Importing backup...");
    expect(buttons[1]).toBeDisabled();

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("warns before applying deletion history or importing a legacy backup", () => {
    const { rerender } = render(
      <JournalImportConfirmDialog
        ts={{
          ...ts,
          journalImportDeletedHistory: "Deletion history",
          journalImportDeletionWarning:
            "This backup records {count} deleted entries. Matching entries on this device will be permanently removed.",
          journalImportLegacyWarning:
            "This older backup has no deletion history, so previously deleted entries may be restored.",
        }}
        filename="journal-backup-v3.json"
        inspection={{
          canImport: true,
          entries: 2,
          photos: 0,
          audio: 0,
          deletions: 3,
          deletionHistoryIncluded: true,
          issues: 0,
          errors: [],
        }}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("Deletion history");
    expect(screen.getByRole("dialog")).toHaveTextContent("3 deleted entries");
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      expect.stringContaining("3 deleted entries"),
    );

    rerender(
      <JournalImportConfirmDialog
        ts={{
          ...ts,
          journalImportDeletedHistory: "Deletion history",
          journalImportDeletionWarning: "Deletion warning {count}",
          journalImportLegacyWarning:
            "This older backup has no deletion history, so previously deleted entries may be restored.",
        }}
        filename="journal-backup-v2.json"
        inspection={{
          canImport: true,
          entries: 2,
          photos: 0,
          audio: 0,
          deletions: 0,
          deletionHistoryIncluded: false,
          issues: 0,
          errors: [],
        }}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("older backup has no deletion history");
  });
});
