import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const journalModuleSource = readFileSync("src/features/journal/JournalModule.tsx", "utf8");
const onThisDaySource = readFileSync("src/features/journal/OnThisDayCard.tsx", "utf8");
const memoryPortalSource = readFileSync("src/features/journal/MemoryPortalCanvas.tsx", "utf8");

describe("web diary privacy and reset contracts", () => {
  it("does not remove the diary password on a generic token refresh", () => {
    const resetListenerBlock =
      /onAuthStateChange\(async \(event\)[\s\S]*?subscription = data\.subscription;/.exec(journalModuleSource)?.[0] ?? "";

    expect(resetListenerBlock).toContain('event === "SIGNED_IN"');
    expect(resetListenerBlock).not.toContain("TOKEN_REFRESHED");
    expect(resetListenerBlock).toContain("security.removePassword()");
  });

  it("passes private mode into every On This Day surface", () => {
    const moduleBlocks = [...journalModuleSource.matchAll(/<OnThisDayCard[\s\S]*?\/>/g)].map((match) => match[0]);
    expect(moduleBlocks.length).toBeGreaterThan(0);
    for (const block of moduleBlocks) {
      expect(block).toContain("privateMode={privateMode}");
    }

    const portalBlock = /<OnThisDayCard[\s\S]*?\/>/.exec(memoryPortalSource)?.[0] ?? "";
    expect(portalBlock).toContain("privateMode={privateMode}");
  });

  it("hides On This Day title, mood, and snippet while private mode is active", () => {
    expect(onThisDaySource).toContain("privateMode?: boolean");
    expect(onThisDaySource).toContain("privateMode = false");
    expect(onThisDaySource).toContain("!privateMode && entry.mood");
    expect(onThisDaySource).toContain("!privateMode && entry.title");
    expect(onThisDaySource).toContain("!privateMode && snippet");
    expect(onThisDaySource).toContain("journalHubSpacePrivate");
  });

  it("hides memory portal day capsule titles and tags while private mode is active", () => {
    expect(memoryPortalSource).toContain("privateMode ?");
    expect(memoryPortalSource).toContain("journalHubSpacePrivate");
    expect(memoryPortalSource).toContain("!privateMode && entry.tags");
  });
});
