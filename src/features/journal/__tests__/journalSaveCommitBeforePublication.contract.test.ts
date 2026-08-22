import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function ordered(sourceText: string, markers: readonly string[]): void {
  let previous = -1;
  for (const marker of markers) {
    const current = sourceText.indexOf(marker);
    expect(current, `missing ordering marker: ${marker}`).toBeGreaterThan(previous);
    previous = current;
  }
}

describe("T176 journal commit-before-publication contract", () => {
  it("publishes the saved entry to React state only after storage resolves", () => {
    const hook = source("src/features/journal/useJournal.ts");
    const createStart = hook.indexOf("const createEntry = useCallback");
    const updateStart = hook.indexOf("const updateEntry = useCallback", createStart);
    const createBlock = hook.slice(createStart, updateStart);

    ordered(createBlock, ["await storage.saveEntry", "setEntries", "setTotalCount", "return entry"]);
  });

  it("keeps secondary sync, rewards, ceremony and editor exit after durable save completion", () => {
    const module = source("src/features/journal/JournalModule.tsx");
    const saveStart = module.indexOf("const handleSaveEntry = useCallback");
    const saveEnd = module.indexOf("const handleSaveCeremonyConsume", saveStart);
    const saveBlock = module.slice(saveStart, saveEnd);
    const editor = source("src/features/journal/useJournalEditorState.ts");
    const editorSaveStart = editor.indexOf("const handleSave = useCallback");
    const editorSaveEnd = editor.indexOf("const handleRetry = useCallback", editorSaveStart);
    const editorSaveBlock = editor.slice(editorSaveStart, editorSaveEnd);

    ordered(saveBlock, [
      "await commitJournalSaveAndCaptureTheme",
      "setPortalEntryPrefill(null)",
      "triggerSync()",
      "rewardUser(\"journal\"",
      "createJournalSaveCommitReceipt",
    ]);
    ordered(editorSaveBlock, [
      "await onSave(",
      "saveCommittedRef.current = true",
      'setSaveState("saved")',
      "setTimeout(() => onBack(), 600)",
    ]);
  });

  it("coalesces rapid Save/retry and blocks Back after commit eligibility", () => {
    const editor = source("src/features/journal/useJournalEditorState.ts");
    expect(editor).toContain("if (saveInFlightRef.current) return saveInFlightRef.current");
    expect(editor).toContain("if (saveCommittedRef.current) return Promise.resolve()");
    expect(editor).toContain("if (saveInFlightRef.current || saveCommittedRef.current) return");
  });

  it("keeps truthful recovery state when durable save is unavailable", () => {
    const editor = source("src/features/journal/useJournalEditorState.ts");
    const saveStart = editor.indexOf("const handleSave = useCallback");
    const saveEnd = editor.indexOf("const handleRetry = useCallback", saveStart);
    const saveBlock = editor.slice(saveStart, saveEnd);

    expect(saveBlock).toContain('setSaveState("error")');
    expect(saveBlock).not.toContain("clearDraft(");
    expect(editor).toContain("persistDraftOnUnmountRef.current");
  });

  it("fences owner-sensitive save work against ABA session transitions", () => {
    const boundary = source("src/storage/accountBoundaryRuntime.ts");
    const storage = source("src/features/journal/journalStorage.ts");

    expect(boundary).toContain("captureAccountSessionTransitionGeneration");
    expect(boundary).toContain("assertAccountSessionTransitionGeneration");
    expect(storage).toContain("captureAccountSessionTransitionGeneration()");
    expect(storage).toContain("runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK");
    expect(storage).toContain("assertAccountSessionTransitionGeneration(sessionGeneration)");
  });

  it("has no journal import or callback dependency on advertising", () => {
    const journalPaths = [
      "src/features/journal/journalStorage.ts",
      "src/features/journal/useJournal.ts",
      "src/features/journal/useJournalEditorState.ts",
      "src/features/journal/JournalModule.tsx",
    ];
    const combined = journalPaths.map(source).join("\n");

    expect(combined).not.toMatch(/adController|AdContext|AdMob|UserMessagingPlatform/i);
  });

  it("ships the normal dependency and Android plugin graph with the ad SDK absent", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const androidGraph = [
      source("android/app/build.gradle"),
      source("android/app/capacitor.build.gradle"),
      source("android/capacitor.settings.gradle"),
      source("android/app/src/main/AndroidManifest.xml"),
    ].join("\n");

    expect(packageJson.dependencies).not.toHaveProperty("@capacitor-community/admob");
    expect(packageJson.devDependencies).not.toHaveProperty("@capacitor-community/admob");
    expect(androidGraph).not.toMatch(/capacitor-community-admob|com\.google\.android\.gms\.ads/i);
  });
});
