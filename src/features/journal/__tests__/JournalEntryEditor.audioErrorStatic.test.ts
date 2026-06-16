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
    expect(editorStateSource).toContain("ts.journalVoiceNotSupported");
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

describe("Journal panic lock privacy guard", () => {
  it("requires native biometric success before clearing the panic lock", () => {
    const panicLockBlock =
      /const handlePanicUnlock = useCallback\([\s\S]*?\n {2}\}, \[[^\]]*setPanicLocked[^\]]*ts\.journalUnlockBiometric[^\]]*\]\);/.exec(editorSource)?.[0] ?? "";

    expect(panicLockBlock).toContain('import("@/plugins/BiometricPlugin")');
    expect(panicLockBlock).toContain("BiometricAuth.authenticate");
    expect(panicLockBlock).toContain("if (result.success)");
    expect(panicLockBlock).toContain("setPanicLocked(false)");

    const panicButtonBlock =
      /<button[\s\S]*?onClick=\{\(\) => \{\s*void handlePanicUnlock\(\);\s*\}\}[\s\S]*?journalUnlockBiometric[\s\S]*?<\/button>/.exec(
        editorSource,
      )?.[0] ?? "";

    expect(panicButtonBlock).toContain("handlePanicUnlock");
    expect(panicButtonBlock).not.toContain("setPanicLocked(false)");
  });
});
