import Dexie, { type Table } from "dexie";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const requireForTest = createRequire(import.meta.url);
const { findAndroidReleaseConfigIssues } = requireForTest(
  join(process.cwd(), "scripts/check-android-release-config.cjs"),
) as {
  findAndroidReleaseConfigIssues(options: { rootDir: string }): Array<{
    code: string;
    file: string;
  }>;
};

class V11FixtureDB extends Dexie {
  settings!: Table<{ key: string; value: unknown }, string>;
  automationTransactions!: Table<{ id: string; ownerUserId: string }, string>;
  automationHistoryMarkers!: Table<{ ownerUserId: string; historyGeneration: number }, string>;
  automationRemoteEvents!: Table<{ id: string; ownerUserId: string }, string>;

  constructor(name: string) {
    super(name);
    this.version(10).stores({ settings: "key" });
    this.version(11).stores({
      settings: "key",
      automationTransactions: "id, ownerUserId",
      automationHistoryMarkers: "ownerUserId, historyGeneration",
      automationRemoteEvents: "id, ownerUserId",
    });
  }
}

class LegacyV10FixtureDB extends Dexie {
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor(name: string) {
    super(name);
    this.version(10).stores({ settings: "key" });
  }
}

function writeFixture(root: string, relativePath: string, source: string): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
}

function createReleaseFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "android-forward-rollback-"));
  writeFixture(root, "package.json", JSON.stringify({ version: "2.1.0" }));
  writeFixture(
    root,
    "package-lock.json",
    JSON.stringify({ version: "2.1.0", packages: { "": { version: "2.1.0" } } }),
  );
  writeFixture(root, "src/lib/appVersion.ts", 'export const APP_VERSION = "2.1.0";\n');
  writeFixture(
    root,
    "android/variables.gradle",
    "ext { minSdkVersion = 26; compileSdkVersion = 36; targetSdkVersion = 36 }",
  );
  writeFixture(
    root,
    "android/app/build.gradle",
    `def ZENFLOW_RELEASE_SIGNING_PROPERTY_KEYS = [
      'storeFile',
      'storePassword',
      'keyAlias',
      'keyPassword',
    ] as Set
    def zenflowReleaseSigningConfigured = true
    def releaseBuildRequested = false
    if (releaseBuildRequested && !zenflowReleaseSigningConfigured) {
      throw new GradleException("Release signing inputs are unavailable.")
    }
    android {
      compileSdk = rootProject.ext.compileSdkVersion
      defaultConfig {
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 35
        versionName "2.1.0"
      }
      signingConfigs { release {} }
      buildTypes {
        release {
          signingConfig signingConfigs.release
          minifyEnabled true
          shrinkResources true
          proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
          ndk {
            debugSymbolLevel 'FULL'
          }
        }
      }
    }`,
  );
  writeFixture(
    root,
    "android/app/src/main/AndroidManifest.xml",
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
      <application android:enableOnBackInvokedCallback="true" />
    </manifest>`,
  );
  writeFixture(
    root,
    "android/app/src/main/java/com/zenflow/app/MainActivity.java",
    "class MainActivity { void init() { registerPlugin(AndroidBackPlugin.class); } }",
  );
  writeFixture(
    root,
    "android/app/src/main/java/com/zenflow/app/AndroidBackPlugin.java",
    "class AndroidBackPlugin { void load() { new OnBackPressedCallback(true); addCallback(this); } }",
  );
  writeFixture(
    root,
    "capacitor.config.ts",
    "export default { plugins: { App: { disableBackButtonHandler: true } } };",
  );
  writeFixture(
    root,
    "src/storage/db.ts",
    `this.version(11).stores({ automationTransactions: "id", automationHistoryMarkers: "ownerUserId", automationRemoteEvents: "id" });
     await db.automationTransactions.clear();
     await db.automationHistoryMarkers.clear();
     await db.automationRemoteEvents.clear();`,
  );
  writeFixture(
    root,
    "docs/release/ANDROID_2_1_RUNBOOK.md",
    "forward_schema_floor: 11\nlegacy_v10_rollback: forbidden\nrollback_artifact: v11-aware-or-newer",
  );
  return root;
}

describe("Android 2.1 forward-only rollback", () => {
  it("demonstrates that a legacy v10 clear leaves the unknown v11 account store behind", async () => {
    const databaseName = `ZenFlowForwardRollback-${crypto.randomUUID()}`;
    const current = new V11FixtureDB(databaseName);
    await current.open();
    await current.settings.put({ key: "account", value: "owner-a" });
    await current.automationTransactions.put({ id: "tx-a", ownerUserId: "owner-a" });
    await current.automationHistoryMarkers.put({ ownerUserId: "owner-a", historyGeneration: 1 });
    await current.automationRemoteEvents.put({ id: "event-a", ownerUserId: "owner-a" });
    current.close();

    const legacy = new LegacyV10FixtureDB(databaseName);
    await legacy.open();
    expect(legacy.tables.map(({ name }) => name)).not.toContain("automationTransactions");
    expect(legacy.tables.map(({ name }) => name)).not.toContain("automationRemoteEvents");
    await legacy.settings.clear();
    legacy.close();

    const reopened = new V11FixtureDB(databaseName);
    try {
      await reopened.open();
      await expect(reopened.settings.count()).resolves.toBe(0);
      await expect(reopened.automationTransactions.count()).resolves.toBe(1);
      await expect(reopened.automationHistoryMarkers.count()).resolves.toBe(1);
      await expect(reopened.automationRemoteEvents.count()).resolves.toBe(1);
    } finally {
      reopened.close();
      await Dexie.delete(databaseName);
    }
  });

  it("requires a v11-aware forward-only policy in code and the Android 2.1 runbook", () => {
    const root = createReleaseFixture();

    expect(findAndroidReleaseConfigIssues({ rootDir: root })).toEqual([]);
  });

  it("rejects a runbook that allows a v10 rollback after v11 distribution", () => {
    const root = createReleaseFixture();
    writeFixture(
      root,
      "docs/release/ANDROID_2_1_RUNBOOK.md",
      "forward_schema_floor: 10\nlegacy_v10_rollback: allowed\nrollback_artifact: v10",
    );

    expect(findAndroidReleaseConfigIssues({ rootDir: root }).map(({ code }) => code)).toEqual(
      expect.arrayContaining(["FORWARD_SCHEMA_FLOOR_INVALID", "LEGACY_V10_ROLLBACK_ALLOWED"]),
    );
  });
});
