import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("journal save ceremony integration contract", () => {
  it("keeps the editor terminally locked after commit until navigation unmounts it", () => {
    const editorState = source("src/features/journal/useJournalEditorState.ts");
    expect(editorState).toContain("saveCommittedRef");
    expect(editorState).toContain("if (saveCommittedRef.current)");
    expect(editorState).toContain("saveCommittedRef.current = true");
  });

  it("reads the live applied theme only after the durable journal commit resolves", () => {
    const module = source("src/features/journal/JournalModule.tsx");
    expect(module).toContain("commitJournalSaveAndCaptureTheme");
    expect(module).toContain("useThemeStore.getState().appliedTheme");
    expect(module).toContain("appliedTheme: committedTheme");
  });

  it("preloads only after the editor reports a dirty state and motion remains allowed", () => {
    const editor = source("src/features/journal/JournalEntryEditor.tsx");
    const module = source("src/features/journal/JournalModule.tsx");
    expect(editor).toContain("onDirtyStateChange");
    expect(module).toContain("preloadJournalSaveCeremonyRuntime");
    expect(module).toContain("scheduleIdle");
    expect(module).toContain("saveCeremonyMotionAllowed");
    expect(module).toContain("!saveCeremonyMotionAllowed");
    expect(module).toContain("saveCeremonyMotionAllowedRef.current");
    expect(module).toContain("if (!saveCeremonyMotionAllowedRef.current)");
    expect(module).toContain("saveCeremonyPreloadRequestedRef.current = false");
  });

  it("uses one mutually exclusive standard or milestone ceremony with one haptic owner", () => {
    const module = source("src/features/journal/JournalModule.tsx");
    const streak = source("src/features/journal/StreakCelebration.tsx");
    expect(module).toContain("skipPopup: true");
    expect(module).toContain("sound: null");
    expect(module).toContain("ceremonyReceipt: null");
    expect(module).toContain("<JournalSaveCeremonyHost");
    expect(module).not.toContain("void haptics.journalSaved();");
    expect(streak.match(/void hapticSuccess\(\);/g)).toHaveLength(1);
  });

  it("keeps the visible save indicator as the single successful-save live announcement", () => {
    const editorState = source("src/features/journal/useJournalEditorState.ts");
    const saveIndicator = source("src/features/journal/SaveIndicator.tsx");
    expect(editorState).not.toContain(
      'announceSuccess(ts.journalEntrySaved || "Entry saved");',
    );
    expect(saveIndicator).toContain(
      'aria-live={state === "error" ? "assertive" : "polite"}',
    );
  });

  it("waits for the mobile editor exit surface before starting the ceremony", () => {
    const module = source("src/features/journal/JournalModule.tsx");
    expect(module).toContain("mobileEditorSurfacePresent");
    expect(module).toContain("onExitComplete={handleMobileEditorExitComplete}");
    expect(module).toContain(
      "isDiaryDesktopLayout || !mobileEditorSurfacePresent",
    );
  });

  it("binds presentation to the lifecycle epoch captured before the durable commit", () => {
    const module = source("src/features/journal/JournalModule.tsx");
    expect(module).toContain("captureJournalSaveCeremonyLifecycle");
    expect(module).toContain("mayPresentJournalSaveCeremony");
    expect(module).toContain("saveLifecycle");
  });

  it("bounds replay memory and keeps lifecycle ownership outside the player host", () => {
    const host = source(
      "src/features/journal/save-ceremony/JournalSaveCeremonyHost.tsx",
    );
    expect(host).toContain("MAX_REMEMBERED_RECEIPTS");
    expect(host).toContain("JOURNAL_SAVE_CEREMONY_CANCEL_EVENT");
    expect(host).not.toContain('import("@capacitor/app")');
  });

  it("uses a non-modal content veil without expensive backdrop blur", () => {
    const host = source(
      "src/features/journal/save-ceremony/JournalSaveCeremonyHost.tsx",
    );
    const css = source(
      "src/features/journal/save-ceremony/journalSaveCeremony.css",
    );
    expect(host).toContain('data-testid="journal-save-ceremony-veil"');
    expect(host).toContain("data-playback={playbackMode}");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(css).not.toContain("backdrop-filter");
  });

  it("ships behind an explicit build flag and precaches TGS assets", () => {
    const env = source("src/lib/env.ts");
    const module = source("src/features/journal/JournalModule.tsx");
    const vite = source("vite.config.ts");
    expect(env).toContain("VITE_ENABLE_JOURNAL_SAVE_CEREMONY");
    expect(env).toContain("__JOURNAL_SAVE_CEREMONY_BUILD_ENABLED__");
    expect(vite).toContain("__JOURNAL_SAVE_CEREMONY_BUILD_ENABLED__");
    expect(module).toContain("__JOURNAL_SAVE_CEREMONY_BUILD_ENABLED__");
    expect(module).not.toContain(
      'import { JournalSaveCeremonyHost } from "./save-ceremony/JournalSaveCeremonyHost"',
    );
    expect(module).not.toContain(
      'import { preloadJournalSaveCeremonyRuntime } from "./save-ceremony/journalSaveCeremonyRuntime"',
    );
    expect(module).toContain(
      'import("./save-ceremony/JournalSaveCeremonyHost")',
    );
    expect(module).toContain("<LazyJournalSaveCeremonyHost");
    expect(vite).toContain("assets/atelier-v12-3-*.tgs");
    expect(vite).toContain("assets/atelier-v12-3-*-reduced*.svg");
  });
});
