import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSupportedJournalPhotoFile } from "../JournalPhotoPicker";

const pickerSource = readFileSync("src/features/journal/JournalPhotoPicker.tsx", "utf8");
const editorStateSource = readFileSync("src/features/journal/useJournalEditorState.ts", "utf8");

describe("JournalPhotoPicker iOS photo file support", () => {
  it("rejects HEIC and HEIF until the runtime has a guaranteed decoder", () => {
    expect(isSupportedJournalPhotoFile({ name: "IMG_1001.HEIC", type: "image/heic" })).toBe(false);
    expect(isSupportedJournalPhotoFile({ name: "IMG_1002.heif", type: "image/heif" })).toBe(false);
  });

  it("falls back only to formats the journal image pipeline can decode", () => {
    expect(isSupportedJournalPhotoFile({ name: "IMG_1003.HEIC", type: "" })).toBe(false);
    expect(isSupportedJournalPhotoFile({ name: "IMG_1004.jpeg", type: "" })).toBe(true);
    expect(isSupportedJournalPhotoFile({ name: "IMG_1005.webp", type: "" })).toBe(true);
    expect(isSupportedJournalPhotoFile({ name: "notes.txt", type: "" })).toBe(false);
  });

  it("does not tell users that unsupported HEIC files can be dropped into the editor", () => {
    expect(editorStateSource).not.toContain("JPEG, PNG, WebP, or HEIC");
    expect(editorStateSource).toContain("JPEG, PNG, or WebP");
  });

  it("keeps the iOS bottom sheet opaque enough not to ghost the editor tools underneath", () => {
    expect(pickerSource).toContain('"bg-card backdrop-blur-xl border-t border-border/40"');
    expect(pickerSource).not.toContain('"bg-card/95 backdrop-blur-xl border-t border-border/40"');
  });

  it("keeps action buttons inside the iOS viewport during the bottom-sheet entrance", () => {
    expect(pickerSource).toContain(
      "max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)]"
    );
    expect(pickerSource).toContain("pb-[calc(max(1rem,var(--safe-bottom))+0.75rem)]");
    expect(pickerSource).toContain("ps-[max(1rem,var(--safe-inline-start))]");
    expect(pickerSource).toContain("pe-[max(1rem,var(--safe-inline-end))]");
    expect(pickerSource).not.toContain("env(safe-area-inset");
  });

  it("keeps the picker open and shows an error when iOS photo processing fails", () => {
    const failureBranch = /catch \(err\)[\s\S]*?finally/.exec(pickerSource)?.[0] ?? "";
    const reportedFailureBranch = failureBranch.slice(failureBranch.indexOf("logger.error"));

    expect(failureBranch).toContain('logger.error("[JournalPhotoPicker] Photo upload failed", {');
    expect(failureBranch).toContain('name: err instanceof Error ? err.name : "UnknownError"');
    expect(failureBranch).not.toContain(
      'logger.error("[JournalPhotoPicker] Photo upload failed:", err)'
    );
    expect(failureBranch).toContain("isJournalPhotoStorageQuotaError(err)");
    expect(failureBranch).toContain(
      'ts.journalPhotoStorageFull ||\n              "There is not enough space on this device. Free some space, then try again."'
    );
    expect(failureBranch).toContain(
      'ts.journalPhotoError || "Couldn\'t add this photo. Try again."',
    );
    expect(reportedFailureBranch).not.toContain("onClose()");
  });
});
