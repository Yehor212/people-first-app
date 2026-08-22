import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_AVAILABILITY_MANIFEST } from "../../src/lib/featureAvailability";

const root = process.cwd();
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

const surfaceInventory = [
  {
    id: "auth-onboarding-recovery",
    paths: ["src/components/OnboardingFlow.tsx", "src/hooks/useDeepLinkHandler.ts"],
    platforms: ["web", "pwa", "android", "ios", "desktop"],
  },
  {
    id: "orb-mood",
    paths: ["src/pages/nav-v2/OrbPageSteps.tsx"],
    platforms: ["web", "pwa", "android", "ios", "desktop"],
  },
  {
    id: "habits-garden-tasks-focus",
    paths: ["src/contexts/FeatureFlagsContext.tsx", "src/components/ModalLayer.tsx"],
    platforms: ["web", "pwa", "android", "ios", "desktop"],
  },
  {
    id: "diary",
    paths: ["src/features/journal/JournalModule.tsx"],
    platforms: ["web", "pwa", "android", "ios", "desktop"],
  },
  {
    id: "social-insights",
    paths: ["src/components/navigation-v2/V2ProgressionModalLayer.tsx"],
    platforms: ["web", "pwa", "android", "ios", "desktop"],
  },
  {
    id: "settings-sync-data",
    paths: ["src/hooks/useDeltaSyncEffects.ts", "src/pages/nav-v2/SettingsPage.tsx"],
    platforms: ["web", "pwa", "android", "ios", "desktop"],
  },
  {
    id: "pwa-offline-update",
    paths: ["vite.config.ts", "src/lib/offlineQueue.ts"],
    platforms: ["web", "pwa"],
  },
  {
    id: "native-desktop-shells",
    paths: [
      "android/app/build.gradle",
      "ios/App/App.xcodeproj/project.pbxproj",
      "src-tauri/tauri.conf.json",
    ],
    platforms: ["android", "ios", "desktop"],
  },
] as const;

describe("feature availability source inventory", () => {
  it("keeps every requested product surface mapped to real source and platforms", () => {
    expect(new Set(surfaceInventory.map((surface) => surface.id)).size).toBe(
      surfaceInventory.length
    );
    for (const surface of surfaceInventory) {
      expect(
        surface.paths.every((path) => existsSync(resolve(root, path))),
        surface.id
      ).toBe(true);
      expect(surface.platforms.length, surface.id).toBeGreaterThan(0);
    }
    expect(new Set(surfaceInventory.flatMap((surface) => [...surface.platforms]))).toEqual(
      new Set(["web", "pwa", "android", "ios", "desktop"])
    );
  });

  it("routes every currently reviewed boolean consumer through the adapter", () => {
    const consumers = [
      read("src/components/ModalLayer.tsx"),
      read("src/components/navigation-v2/V2MindfulMomentLayer.tsx"),
      read("src/components/navigation-v2/V2ProgressionModalLayer.tsx"),
      read("src/hooks/useDeepLinkHandler.ts"),
      read("src/hooks/useDeltaSyncEffects.ts"),
    ].join("\n");

    for (const feature of ["focusTimer", "quests", "challenges", "deltaSync"]) {
      expect(consumers).toContain(`isFeatureVisible("${feature}")`);
      expect(FEATURE_AVAILABILITY_MANIFEST.find((entry) => entry.key === feature)).toMatchObject({
        hasRuntimeConsumer: true,
      });
    }
    for (const feature of ["breathingExercise", "gratitudeJournal", "tasks", "innerWorld"]) {
      expect(consumers).not.toContain(`isFeatureVisible("${feature}")`);
      expect(FEATURE_AVAILABILITY_MANIFEST.find((entry) => entry.key === feature)).toMatchObject({
        hasRuntimeConsumer: false,
      });
    }
  });

  it("uses authoritative diary state and retains the reviewed no-enable posture", () => {
    const provider = read("src/contexts/FeatureFlagsContext.tsx");
    expect(provider).toContain("db.journalEntries.count()");
    expect(provider).not.toMatch(/journalEntries:\s*0\b/);
    expect(read("src/pages/Index.tsx")).toContain("const V2_REWARDS_ENABLED = false");
    expect(read("src/components/habit-pictogram/habitMotionAssets.ts")).toContain(
      "HABIT_LOTTIE_RUNTIME_ENABLED = false"
    );
    expect(
      FEATURE_AVAILABILITY_MANIFEST.find((entry) => entry.key === "journalSaveCeremony")
    ).toMatchObject({ disposition: "blocked", fixedReason: "build-capability-missing" });
  });
});
