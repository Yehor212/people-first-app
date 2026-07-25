import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExportPickerDialog } from "../ExportPickerDialog";

const a11yMocks = vi.hoisted(() => {
  const cleanupFocusTrap = vi.fn();
  return {
    announceSuccess: vi.fn(),
    announceError: vi.fn(),
    cleanupFocusTrap,
    createFocusTrap: vi.fn(() => cleanupFocusTrap),
  };
});

const exportMocks = vi.hoisted(() => ({
  exportJSON: vi.fn(),
  exportCSV: vi.fn(),
  exportPDF: vi.fn(),
  exportMarkdown: vi.fn(),
}));

vi.mock("@/lib/a11y", () => ({
  announceError: a11yMocks.announceError,
  announceSuccess: a11yMocks.announceSuccess,
  createFocusTrap: a11yMocks.createFocusTrap,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("../journalExport", () => exportMocks);

const ts = {
  cancel: "Cancel",
  journalExportCSV: "CSV",
  journalExportCSVDesc: "Spreadsheet format",
  journalExportFailed: "Export failed. Try again.",
  journalExportFormat: "Export Format",
  journalExportJSON: "JSON Backup",
  journalExportJSONDesc: "Full backup with photos & audio",
  journalExportPDF: "PDF",
  journalExportPDFDesc: "Printable document",
  journalExportPrivacyWarning:
    "Exports are private files and are not encrypted by ZenFlow. Keep them somewhere you trust.",
  journalExportSuccess: "Export complete",
  journalExportText: "Markdown",
  journalExportTextDesc: "Plain text format",
};

describe("ExportPickerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("labels the dialog, describes the privacy warning, and traps focus", () => {
    render(
      <ExportPickerDialog
        ts={ts}
        language="en"
        exporting={false}
        setExporting={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Export Format" });
    expect(dialog).toHaveAccessibleDescription(
      "Exports are private files and are not encrypted by ZenFlow. Keep them somewhere you trust.",
    );
    expect(a11yMocks.createFocusTrap).toHaveBeenCalledWith(
      dialog,
      expect.objectContaining({ initialFocus: expect.any(HTMLHeadingElement) }),
    );
    expect(screen.getByRole("heading", { name: "Export Format" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("cleans up the focus trap when the dialog unmounts", () => {
    const { unmount } = render(
      <ExportPickerDialog
        ts={ts}
        language="en"
        exporting={false}
        setExporting={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    unmount();

    expect(a11yMocks.cleanupFocusTrap).toHaveBeenCalledTimes(1);
  });

  it("does not close while exporting", () => {
    const onClose = vi.fn();

    render(
      <ExportPickerDialog
        ts={ts}
        language="en"
        exporting
        setExporting={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
  });

  it("does not offer PDF until journal Unicode and RTL embedding is supported", () => {
    render(
      <ExportPickerDialog
        ts={ts}
        language="ja"
        exporting={false}
        setExporting={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /pdf/i })).not.toBeInTheDocument();
  });

  it("shows and announces export failures", async () => {
    exportMocks.exportJSON.mockRejectedValueOnce(new Error("download failed"));
    const setExporting = vi.fn();

    render(
      <ExportPickerDialog
        ts={ts}
        language="en"
        exporting={false}
        setExporting={setExporting}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /json backup/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Export failed. Try again.");
    expect(a11yMocks.announceError).toHaveBeenCalledWith("Export failed. Try again.");
    await waitFor(() => expect(setExporting).toHaveBeenLastCalledWith(false));
  });

  it("announces successful exports before closing", async () => {
    const onClose = vi.fn();

    render(
      <ExportPickerDialog
        ts={ts}
        language="en"
        exporting={false}
        setExporting={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /json backup/i }));

    await waitFor(() => {
      expect(a11yMocks.announceSuccess).toHaveBeenCalledWith("Export complete");
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    { button: /csv/i, fn: exportMocks.exportCSV, args: ["en", "CSV"] },
    { button: /markdown/i, fn: exportMocks.exportMarkdown, args: ["en", "Markdown"] },
  ])("exports $button format with the active language", async ({ button, fn, args }) => {
    const onClose = vi.fn();

    render(
      <ExportPickerDialog
        ts={ts}
        language="en"
        exporting={false}
        setExporting={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: button }));

    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith(...args);
    });
    expect(a11yMocks.announceSuccess).toHaveBeenCalledWith("Export complete");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
