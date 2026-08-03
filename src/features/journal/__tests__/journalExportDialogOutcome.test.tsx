import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExportPickerDialog } from "../ExportPickerDialog";

const a11yMocks = vi.hoisted(() => ({
  announceError: vi.fn(),
  announceSuccess: vi.fn(),
  createFocusTrap: vi.fn(() => vi.fn()),
}));
const exportMocks = vi.hoisted(() => ({
  exportJSON: vi.fn(),
  exportCSV: vi.fn(),
  exportPDF: vi.fn(),
  exportMarkdown: vi.fn(),
}));

vi.mock("@/lib/a11y", () => a11yMocks);
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("../journalExport", () => exportMocks);

const ts = {
  cancel: "Cancel",
  journalExportFailed: "Export failed. Try again.",
  journalExportFormat: "Export Format",
  journalExportJSON: "JSON Backup",
  journalExportJSONDesc: "Full backup with photos & audio",
  journalExportSuccess: "Export complete",
  journalExportStarted: "Download started",
};

describe("ExportPickerDialog native outcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not announce success or close when the native share sheet is cancelled", async () => {
    exportMocks.exportJSON.mockResolvedValueOnce("cancelled");
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

    await waitFor(() => expect(exportMocks.exportJSON).toHaveBeenCalledTimes(1));
    expect(a11yMocks.announceSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    { label: /csv/i, exportCall: exportMocks.exportCSV },
    { label: /markdown/i, exportCall: exportMocks.exportMarkdown },
  ])("does not announce success when the $label native share sheet is cancelled", async ({ label, exportCall }) => {
    exportCall.mockResolvedValueOnce("cancelled");
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

    fireEvent.click(screen.getByRole("button", { name: label }));

    await waitFor(() => expect(exportCall).toHaveBeenCalledTimes(1));
    expect(a11yMocks.announceSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("passes the localized backup label to the native share flow", async () => {
    exportMocks.exportJSON.mockResolvedValueOnce("saved");

    render(
      <ExportPickerDialog
        ts={{ ...ts, journalExportJSON: "Sauvegarde JSON" }}
        language="fr"
        exporting={false}
        setExporting={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /sauvegarde json/i }));

    await waitFor(() => {
      expect(exportMocks.exportJSON).toHaveBeenCalledWith(undefined, "Sauvegarde JSON", "fr");
    });
  });

  it("announces a browser handoff as started instead of complete", async () => {
    exportMocks.exportJSON.mockResolvedValueOnce("started");
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

    await waitFor(() => expect(exportMocks.exportJSON).toHaveBeenCalledTimes(1));
    expect(a11yMocks.announceSuccess).toHaveBeenCalledWith("Download started");
    expect(a11yMocks.announceSuccess).not.toHaveBeenCalledWith("Export complete");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
