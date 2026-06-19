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
    const indexSource = readSource("src/pages/Index.tsx");
    const deepLinkSource = readSource("src/lib/deepLinks.ts");
    const nativeSignalSource = readSource("src/lib/nativeDiaryDeepLinkSignal.ts");
    const navSource = readSource("src/components/navigation-v2/NavV2Orchestrator.tsx");
    const navigationHookSource = readSource("src/hooks/useNavigationV2.ts");
    const journalSource = readSource("src/features/journal/JournalModule.tsx");
    const v1HookSource = readSource("src/hooks/useDeepLinkHandler.ts");

    expect(intentSource).toContain("requestDiaryEditorOpen");
    expect(intentSource).toContain("consumePendingDiaryEditorOpen");
    expect(intentSource).toContain("subscribeToDiaryEditorOpen");

    expect(navSource).toContain("subscribeToDeepLinks");
    expect(navSource).toContain('data.type === "diary"');
    expect(navSource).toContain('setActivePage("diary"');
    expect(navSource).toContain("requestDiaryEditorOpen()");

    expect(indexSource).toContain("useDeepLinkHandler");
    expect(indexSource).toContain("handleDiaryDeepLinks: false");
    expect(indexSource).toContain("hasPendingNativeDiaryDeepLink");
    expect(indexSource).toContain("NATIVE_DIARY_DEEP_LINK_EVENT");

    expect(deepLinkSource).toContain("NATIVE_DIARY_DEEP_LINK_EVENT");
    expect(deepLinkSource).toContain("markNativeDiaryDeepLinkRequested");
    expect(nativeSignalSource).toContain("nativeDiaryDeepLinkRequested = true");
    expect(nativeSignalSource).toContain("hasPendingNativeDiaryDeepLink");
    expect(nativeSignalSource).toContain("consumePendingNativeDiaryDeepLink");
    expect(nativeSignalSource).toContain("clearPendingNativeDiaryDeepLink");
    expect(navigationHookSource).toContain("consumePendingNativeDiaryDeepLink");
    expect(navigationHookSource).toContain('return { page: "diary", unknownPath: null };');

    expect(journalSource).toContain("consumePendingDiaryEditorOpen");
    expect(journalSource).toContain("subscribeToDiaryEditorOpen");
    expect(journalSource).toContain("handleNewEntry();");

    expect(v1HookSource).toContain("requestDiaryEditorOpen");
    expect(v1HookSource).not.toContain('new CustomEvent("zenflow-open-journal-editor")');
  });
});
