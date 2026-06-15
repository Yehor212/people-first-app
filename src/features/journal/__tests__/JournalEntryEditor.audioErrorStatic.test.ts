import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorStateSource = readFileSync("src/features/journal/useJournalEditorState.ts", "utf8");
const editorSource = readFileSync("src/features/journal/JournalEntryEditor.tsx", "utf8");

describe("Journal audio failure feedback", () => {
  it("does not silently swallow audio save/start failures", () => {
    expect(editorStateSource).toContain("announceError");
    expect(editorStateSource).toContain("const [audioError, setAudioError]");
    expect(editorStateSource).toContain('logger.warn("[Journal]", "Audio save failed:", err)');
    expect(editorStateSource).toContain('logger.warn("[Journal]", "Recording failed to start:", err)');
    expect(editorStateSource).toContain("announceError(message)");
    expect(editorStateSource).toContain("ts.journalAudioUnsupported");
    expect(editorStateSource).toContain("ts.journalAudioPermissionDenied");
    expect(editorStateSource).toContain("recorder.error");
    expect(editorStateSource).toContain("setShowRecordingOverlay(false)");
    expect(editorStateSource).toContain("audioError,");
  });

  it("renders audio failures as a visible accessible alert", () => {
    expect(editorSource).toContain("audioError,");
    expect(editorSource).toContain('role="alert"');
    expect(editorSource).toContain("border-destructive/30");
    expect(editorSource).toContain("{audioError}");
  });
});
