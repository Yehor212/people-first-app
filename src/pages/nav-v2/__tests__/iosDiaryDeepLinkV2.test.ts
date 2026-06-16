import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("V2 iOS diary deep link handling", () => {
  it("routes zenflow diary editor deep links through V2 and buffers editor open until Diary mounts", () => {
    expect(existsSync(resolve(process.cwd(), "src/lib/diaryDeepLinkIntent.ts"))).toBe(true);

    const intentSource = readSource("src/lib/diaryDeepLinkIntent.ts");
    const navSource = readSource("src/components/navigation-v2/NavV2Orchestrator.tsx");
    const journalSource = readSource("src/features/journal/JournalModule.tsx");
    const v1HookSource = readSource("src/hooks/useDeepLinkHandler.ts");

    expect(intentSource).toContain("requestDiaryEditorOpen");
    expect(intentSource).toContain("consumePendingDiaryEditorOpen");
    expect(intentSource).toContain("subscribeToDiaryEditorOpen");

    expect(navSource).toContain("subscribeToDeepLinks");
    expect(navSource).toContain('data.type === "diary"');
    expect(navSource).toContain('setActivePage("diary"');
    expect(navSource).toContain("requestDiaryEditorOpen()");

    expect(journalSource).toContain("consumePendingDiaryEditorOpen");
    expect(journalSource).toContain("subscribeToDiaryEditorOpen");
    expect(journalSource).toContain("handleNewEntry();");

    expect(v1HookSource).toContain("requestDiaryEditorOpen");
    expect(v1HookSource).not.toContain('new CustomEvent("zenflow-open-journal-editor")');
  });
});
