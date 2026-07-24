import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorStateSource = readFileSync("src/features/journal/useJournalEditorState.ts", "utf8");
const editorSource = readFileSync("src/features/journal/JournalEntryEditor.tsx", "utf8");
const moduleSource = readFileSync("src/features/journal/JournalModule.tsx", "utf8");

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

  it("keeps an active recording when its modal is closed", () => {
    const closeRecordingBlock =
      /const closeRecordingOverlay = useCallback\([\s\S]*?\n {2}\}, \[[^\]]*\]\);/.exec(editorSource)?.[0] ?? "";

    expect(closeRecordingBlock).toContain("handleStopRecording");
    expect(closeRecordingBlock).not.toContain("handleDiscardRecording");
  });

  it("distinguishes a pending microphone request from active recording", () => {
    expect(editorSource).toContain("recorder.isRequestingPermission");
    expect(editorSource).toContain("journalAudioPreparing");
  });

  it("offers pause and resume as stable accessible recording actions", () => {
    expect(editorSource).toContain("recorder.isPaused ? recorder.resume : recorder.pause");
    expect(editorSource).toContain('recorder.isPaused ? ts.resume || "Resume" : ts.pause || "Pause"');
    expect(editorSource).toContain('"min-h-[48px] flex-1 rounded-xl');
    expect(editorSource).toContain("journalRecordingPaused");
  });

  it("uses theme tokens and reduced-motion-safe feedback while dictation is active", () => {
    const dictationBlock =
      /\{\/\* Voice dictation indicator \*\/[\s\S]*?\{\/\* Tags \*\//.exec(editorSource)?.[0] ?? "";

    expect(dictationBlock).toContain("border-primary/20");
    expect(dictationBlock).toContain("bg-primary/10");
    expect(dictationBlock).toContain("shouldAnimate()");
    expect(dictationBlock).toContain("!privacyShieldActive");
    expect(dictationBlock).toContain('role="status"');
    expect(dictationBlock).not.toMatch(/red-[0-9]/);
  });

  it("keeps failed captures retryable and confirms permanent audio removal", () => {
    expect(editorStateSource).toContain("audioSaveRetryAvailable");
    expect(editorStateSource).toContain("retryAudioSave");
    expect(editorStateSource).toContain("audioRemovalPendingId");
    expect(editorStateSource).toContain("requestRemoveAudio");
    expect(editorStateSource).toContain("confirmRemoveAudio");
    expect(editorSource).toContain("journal-audio-remove-confirm-title");
    expect(editorSource).toContain('role="alertdialog"');
  });

  it("keeps recording Escape on the recovery-aware modal path", () => {
    const editorEscapeBranch =
      /if \(showRecordingOverlay\) \{[\s\S]*?\n {8}\}/.exec(editorStateSource)?.[0] ?? "";
    const closeRecordingBlock =
      /const closeRecordingOverlay = useCallback\([\s\S]*?\n {2}\}, \[[^\]]*\]\);/.exec(editorSource)?.[0] ?? "";

    expect(editorEscapeBranch).not.toContain("recorder.stop");
    expect(editorEscapeBranch).not.toContain("setShowRecordingOverlay(false)");
    expect(closeRecordingBlock).toContain("audioSaveRetryAvailable");
    expect(closeRecordingBlock).toContain("requestDiscardRecording");
  });

  it("restores mobile recording focus to the connected Tools control", () => {
    expect(editorSource).toContain("mobileToolsButtonRef");
    expect(editorSource).toContain(
      "useModalA11y(showRecordingOverlay, closeRecordingOverlay, mobileToolsButtonRef)",
    );
  });

  it("moves escaped focus to Retry when a failed save replaces the recording controls", () => {
    expect(editorSource).toContain("recordingRetryRef");
    expect(editorSource).toContain("focusModalRecoveryAction");
    expect(editorSource).toContain("if (!audioSaveRetryAvailable) return");
    expect(editorSource).toContain("recordingRetryRef.current");
  });

  it("uses truthful staged-removal copy for audio already attached to an existing entry", () => {
    expect(editorSource).toContain("journalAudioRemoveDescriptionStaged");
    expect(editorSource).toContain("entry?.audioIds?.includes(audioRemovalPendingId)");
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

  it("does not start breathing or haptics before the user asks on the panic lock", () => {
    const panicOverlay = /\{\/\* Panic Lock[\s\S]*?\{\/\* Theme transition overlay/.exec(editorSource)?.[0] ?? "";

    expect(panicOverlay).toContain("<DiaryBreatheWidget initiallyPaused />");
  });

  it("offers a fail-closed exit when biometric unlock is unavailable", () => {
    const panicOverlay = /\{\/\* Panic Lock[\s\S]*?\{\/\* Theme transition overlay/.exec(editorSource)?.[0] ?? "";
    const panicExitHandler = /const handlePanicExit = useCallback\([\s\S]*?\n {2}\}, \[[^\]]*\]\);/.exec(editorSource)?.[0] ?? "";

    expect(editorSource).toContain("onPanicExit?: () => void");
    expect(panicExitHandler).toContain("persistDraftWithActiveRecording");
    expect(panicExitHandler).toContain("isDirty || hasImmediateChanges() || hasPendingRecording");
    expect(panicExitHandler).not.toContain("isDirty || hasImmediateChanges)");
    expect(panicExitHandler).toContain("panicExitNeedsConfirmation");
    expect(panicOverlay).toContain('journalPanicLeave || "Leave diary"');
    expect(panicOverlay).toContain('journalPanicLeaveWithoutSaving || "Leave without saving"');

    expect(moduleSource).toContain("handlePanicExitFromEditor");
    expect(moduleSource).toContain("storageSetRaw(SK.JOURNAL_PRIVATE_MODE, \"true\")");
    expect(moduleSource).toContain("security.lock()");
    expect(moduleSource.match(/onPanicExit=\{handlePanicExitFromEditor\}/g)).toHaveLength(2);
  });
});
