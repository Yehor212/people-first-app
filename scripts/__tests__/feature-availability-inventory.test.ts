import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

describe("feature availability inventory", () => {
  it("derives progressive unlocks from settled IndexedDB truth without a zero placeholder", () => {
    const provider = read("src/contexts/FeatureFlagsContext.tsx");

    expect(provider).toContain("runWithSettledDataRead(getEntryCount)");
    expect(provider).toContain("waitForAccountBoundaryDataSettlement");
    expect(provider).not.toMatch(/journalEntries\s*:\s*0\b/);
    expect(provider).toContain("journalEntries: journalEntryCount.count");
  });

  it("routes runtime and deep-link consumers through the structured decision adapter", () => {
    const deltaSync = read("src/hooks/useDeltaSyncEffects.ts");
    const deepLinks = read("src/hooks/useDeepLinkHandler.ts");
    const modalLayer = read("src/components/ModalLayer.tsx");
    const v2Progression = read(
      "src/components/navigation-v2/V2ProgressionModalLayer.tsx",
    );

    expect(deltaSync).toContain('isFeatureVisible("deltaSync")');
    expect(deltaSync).not.toContain('isFeatureEnabled("deltaSync")');
    expect(deepLinks).toContain('getFeatureAvailability("challenges")');
    expect(deepLinks).toContain("availability.visible");
    expect(modalLayer).toContain('getFeatureAvailability("focusTimer")');
    expect(modalLayer).toContain('getFeatureAvailability("quests")');
    expect(v2Progression).toContain('getFeatureAvailability("challenges")');
    expect(modalLayer).toContain("FeatureAvailabilityDialog");
    expect(v2Progression).toContain("FeatureAvailabilityDialog");
  });

  it("keeps unapproved services, rewards, Lottie, and ceremony fail closed", () => {
    const manifest = read("src/lib/featureAvailability.ts");

    expect(manifest).toContain('fixedEntry("aiCoach"');
    expect(manifest).toContain('reason: "service-not-approved"');
    expect(manifest).toContain('fixedEntry("v2Rewards"');
    expect(manifest).toContain('fixedEntry("habitLottieRuntime"');
    expect(manifest).toContain('fixedEntry("journalSaveCeremony"');
    expect(manifest).not.toMatch(
      /fixedEntry\("(?:aiCoach|v2Rewards|habitLottieRuntime|journalSaveCeremony)"[\s\S]{0,220}?visible:\s*true/,
    );
  });

  it("documents every requested product surface, gate owner, consumer status, and platform", () => {
    const inventory = read(
      "specs/002-product-regression-recovery/gate-inventory.md",
    );
    const requiredMarkers = [
      "auth/onboarding/recovery",
      "orb/mood",
      "habits/garden/tasks/focus",
      "diary",
      "stats/achievements/friends/challenges",
      "settings/sync/import/export/delete",
      "PWA/offline/update",
      "Android/iOS/Tauri shells",
      "FeatureFlagsContext",
      "design_flags",
      "compile-time",
      "consumer-missing",
      "UNVERIFIED",
      "Web/PWA",
      "Android",
      "iOS",
      "Tauri",
    ];

    for (const marker of requiredMarkers) {
      expect(inventory, `missing inventory marker: ${marker}`).toContain(marker);
    }
  });
});
