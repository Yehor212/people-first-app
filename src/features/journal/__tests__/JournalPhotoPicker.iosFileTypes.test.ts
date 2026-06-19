import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSupportedJournalPhotoFile } from "../JournalPhotoPicker";

const pickerSource = readFileSync("src/features/journal/JournalPhotoPicker.tsx", "utf8");

describe("JournalPhotoPicker iOS photo file support", () => {
  it("accepts HEIC and HEIF photos from iOS camera or photo library", () => {
    expect(isSupportedJournalPhotoFile({ name: "IMG_1001.HEIC", type: "image/heic" })).toBe(true);
    expect(isSupportedJournalPhotoFile({ name: "IMG_1002.heif", type: "image/heif" })).toBe(true);
  });

  it("falls back to trusted image extensions when iOS omits the MIME type", () => {
    expect(isSupportedJournalPhotoFile({ name: "IMG_1003.HEIC", type: "" })).toBe(true);
    expect(isSupportedJournalPhotoFile({ name: "IMG_1004.jpeg", type: "" })).toBe(true);
    expect(isSupportedJournalPhotoFile({ name: "notes.txt", type: "" })).toBe(false);
  });

  it("keeps the iOS bottom sheet opaque enough not to ghost the editor tools underneath", () => {
    expect(pickerSource).toContain('"bg-card backdrop-blur-xl border-t border-border/40"');
    expect(pickerSource).not.toContain('"bg-card/95 backdrop-blur-xl border-t border-border/40"');
  });

  it("keeps action buttons inside the iOS viewport during the bottom-sheet entrance", () => {
    expect(pickerSource).toContain('pb-[calc(max(1rem,env(safe-area-inset-bottom))+0.75rem)]');
  });

  it("keeps the picker open and shows an error when iOS photo processing fails", () => {
    const failureBranch = /catch \(err\)[\s\S]*?finally/.exec(pickerSource)?.[0] ?? "";

    expect(failureBranch).toContain('logger.error("[JournalPhotoPicker] Photo upload failed:", err);');
    expect(failureBranch).toContain('setError(ts.journalPhotoError || "Failed to add photo. Try again.");');
    expect(failureBranch).not.toContain("onClose()");
  });
});
