import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const requireForTest = createRequire(import.meta.url);
const {
  findAndroidReleaseConfigIssues,
  inspectAndroidReleaseNativeServicesInputs,
  inspectAndroidReleaseSigningInputs,
} = requireForTest(
  join(process.cwd(), "scripts/check-android-release-config.cjs"),
) as {
  findAndroidReleaseConfigIssues(options: { rootDir: string }): Array<{
    code: string;
    file: string;
  }>;
  inspectAndroidReleaseSigningInputs(options: { rootDir: string }): {
    shapeReady: boolean;
    keyProperties: {
      exists: boolean;
      regularFile: boolean;
      symlink: boolean;
      tracked: boolean;
      ignored: boolean;
    };
    requiredKeys: Record<"storeFile" | "storePassword" | "keyAlias" | "keyPassword", boolean>;
    keystore: {
      configured: boolean;
      exists: boolean;
      regularFile: boolean;
      symlink: boolean;
    };
    issueCodes: string[];
    secretValuesPrinted: false;
  };
  inspectAndroidReleaseNativeServicesInputs(options: { rootDir: string }): {
    shapeReady: boolean;
    googleServices: {
      exists: boolean;
      regularFile: boolean;
      symlink: boolean;
      tracked: boolean;
      ignored: boolean;
      nonEmpty: boolean;
      jsonValid: boolean;
      packageMatches: boolean;
      mobileSdkAppIdPresent: boolean;
      projectNumberPresent: boolean;
    };
    issueCodes: string[];
    sensitiveValuesPrinted: false;
  };
};

function writeFixture(root: string, relativePath: string, source: string): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
}

function createPassingFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "android-release-config-"));
  writeFixture(root, "package.json", '{"version":"2.1.0"}\n');
  writeFixture(
    root,
    "package-lock.json",
    '{"version":"2.1.0","packages":{"":{"version":"2.1.0"}}}\n',
  );
  writeFixture(
    root,
    "src/lib/appVersion.ts",
    "export const APP_VERSION = '2.1.0'; // Synced with package.json\n",
  );
  writeFixture(
    root,
    "android/variables.gradle",
    `ext {
      minSdkVersion = 26
      compileSdkVersion = 36
      targetSdkVersion = 36
    }`,
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
    def zenflowGoogleServicesFile = file('google-services.json')
    def zenflowGoogleServicesConfigured = zenflowGoogleServicesFile.isFile()
    def zenflowReleaseSigningConfigured = true
    def releaseBuildRequested = false
    if (releaseBuildRequested && !zenflowGoogleServicesConfigured) {
      throw new GradleException("Release Firebase inputs are unavailable.")
    }
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
          ndk { debugSymbolLevel 'FULL' }
        }
      }
    }
    if (zenflowGoogleServicesConfigured) {
      apply plugin: 'com.google.gms.google-services'
    }`,
  );
  writeFixture(
    root,
    "android/app/src/main/AndroidManifest.xml",
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
      <application android:enableOnBackInvokedCallback="true">
        <activity android:name=".MainActivity" android:exported="true" />
      </application>
    </manifest>`,
  );
  writeFixture(
    root,
    "android/app/src/main/java/com/zenflow/app/MainActivity.java",
    `class MainActivity {
      void register() { registerPlugin(AndroidBackPlugin.class); }
    }`,
  );
  writeFixture(
    root,
    "android/app/src/main/java/com/zenflow/app/AndroidBackPlugin.java",
    `class AndroidBackPlugin {
      void load() {
        Object callback = new OnBackPressedCallback(true);
        getOnBackPressedDispatcher().addCallback(callback);
      }
    }`,
  );
  writeFixture(
    root,
    "capacitor.config.ts",
    `export default { plugins: { App: { disableBackButtonHandler: true } } };`,
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

function initializeGitFixture(root: string): void {
  execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "ignore" });
  writeFixture(
    root,
    "android/.gitignore",
    "key.properties\n*.jks\napp/google-services.json\n",
  );
}

describe("Android release configuration", () => {
  it("accepts the API 36 adaptive predictive-Back contract", () => {
    expect(findAndroidReleaseConfigIssues({ rootDir: createPassingFixture() })).toEqual([]);
  });

  it("rejects a pre-2.1 version name or an unauthorised version-code increment", () => {
    const root = createPassingFixture();
    writeFixture(
      root,
      "android/app/build.gradle",
      `android {
        compileSdk = rootProject.ext.compileSdkVersion
        defaultConfig {
          minSdkVersion rootProject.ext.minSdkVersion
          targetSdkVersion rootProject.ext.targetSdkVersion
          versionCode 36
          versionName "2.0.0"
        }
        buildTypes {
          release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            ndk { debugSymbolLevel 'FULL' }
          }
        }
      }`,
    );

    expect(findAndroidReleaseConfigIssues({ rootDir: root }).map(({ code }) => code)).toEqual(
      expect.arrayContaining(["VERSION_NAME_MISMATCH", "VERSION_CODE_NOT_AUTHORIZED"]),
    );
  });

  it("rejects package and runtime metadata that drift from the Android 2.1 version name", () => {
    const root = createPassingFixture();
    writeFixture(root, "package.json", '{"version":"2.0.0"}\n');
    writeFixture(
      root,
      "package-lock.json",
      '{"version":"2.0.0","packages":{"":{"version":"2.0.0"}}}\n',
    );
    writeFixture(
      root,
      "src/lib/appVersion.ts",
      "export const APP_VERSION = '2.0.0'; // Synced with package.json\n",
    );

    expect(findAndroidReleaseConfigIssues({ rootDir: root }).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "PACKAGE_VERSION_MISMATCH",
        "PACKAGE_LOCK_VERSION_MISMATCH",
        "APP_VERSION_MISMATCH",
      ]),
    );
  });

  it("rejects SDK drift and predictive-Back opt-outs", () => {
    const root = createPassingFixture();
    writeFixture(
      root,
      "android/variables.gradle",
      `ext {
        minSdkVersion = 25
        compileSdkVersion = 35
        targetSdkVersion = 35
      }`,
    );
    writeFixture(
      root,
      "android/app/src/main/AndroidManifest.xml",
      `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application android:enableOnBackInvokedCallback="false">
          <activity android:name=".MainActivity" />
        </application>
      </manifest>`,
    );

    expect(findAndroidReleaseConfigIssues({ rootDir: root }).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "MIN_SDK_MISMATCH",
        "COMPILE_SDK_MISMATCH",
        "TARGET_SDK_MISMATCH",
        "PREDICTIVE_BACK_DISABLED",
      ]),
    );
  });

  it("rejects non-adaptive activity and large-screen restrictions", () => {
    const restrictedAttributes = [
      'android:screenOrientation="portrait"',
      'android:resizeableActivity="false"',
      'android:maxAspectRatio="1.86"',
      'android:minAspectRatio="1.33"',
      'android:largeScreens="false"',
      'android:xlargeScreens="false"',
    ];

    for (const restrictedAttribute of restrictedAttributes) {
      const root = createPassingFixture();
      writeFixture(
        root,
        "android/app/src/main/AndroidManifest.xml",
        `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application android:enableOnBackInvokedCallback="true" ${restrictedAttribute} />
        </manifest>`,
      );

      expect(
        findAndroidReleaseConfigIssues({ rootDir: root }).map(({ code }) => code),
        restrictedAttribute,
      ).toContain("ADAPTIVE_WINDOW_RESTRICTION");
    }
  });

  it("rejects a missing custom bridge or competing Capacitor handler", () => {
    const root = createPassingFixture();
    writeFixture(
      root,
      "android/app/src/main/java/com/zenflow/app/MainActivity.java",
      "class MainActivity {}",
    );
    writeFixture(root, "capacitor.config.ts", "export default { plugins: {} };");

    expect(findAndroidReleaseConfigIssues({ rootDir: root }).map(({ code }) => code)).toEqual(
      expect.arrayContaining(["BACK_PLUGIN_NOT_REGISTERED", "CAPACITOR_BACK_HANDLER_ENABLED"]),
    );
  });

  it("rejects release builds without R8, resource shrinking, mapping config or full native symbols", () => {
    const root = createPassingFixture();
    writeFixture(
      root,
      "android/app/build.gradle",
      `android {
        compileSdk = rootProject.ext.compileSdkVersion
        defaultConfig {
          minSdkVersion rootProject.ext.minSdkVersion
          targetSdkVersion rootProject.ext.targetSdkVersion
        }
        buildTypes { release {} }
      }`,
    );

    expect(findAndroidReleaseConfigIssues({ rootDir: root }).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "RELEASE_MINIFICATION_DISABLED",
        "RELEASE_RESOURCE_SHRINKING_DISABLED",
        "RELEASE_PROGUARD_CONFIG_MISSING",
        "RELEASE_NATIVE_SYMBOLS_INCOMPLETE",
      ]),
    );
  });

  it("rejects a release script that does not fail closed when upload signing inputs are unavailable", () => {
    const root = createPassingFixture();
    writeFixture(
      root,
      "android/app/build.gradle",
      `android {
        compileSdk = rootProject.ext.compileSdkVersion
        defaultConfig {
          minSdkVersion rootProject.ext.minSdkVersion
          targetSdkVersion rootProject.ext.targetSdkVersion
          versionCode 35
          versionName "2.1.0"
        }
        buildTypes {
          release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            ndk { debugSymbolLevel 'FULL' }
          }
        }
      }`,
    );

    expect(findAndroidReleaseConfigIssues({ rootDir: root }).map(({ code }) => code)).toContain(
      "RELEASE_SIGNING_GUARD_MISSING",
    );
  });

  it("rejects a release script that can silently ship without Android Firebase inputs", () => {
    const root = createPassingFixture();
    writeFixture(
      root,
      "android/app/build.gradle",
      `android {
        compileSdk = rootProject.ext.compileSdkVersion
        defaultConfig {
          minSdkVersion rootProject.ext.minSdkVersion
          targetSdkVersion rootProject.ext.targetSdkVersion
          versionCode 35
          versionName "2.1.0"
        }
        buildTypes {
          release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            ndk { debugSymbolLevel 'FULL' }
          }
        }
      }`,
    );

    expect(findAndroidReleaseConfigIssues({ rootDir: root }).map(({ code }) => code)).toContain(
      "RELEASE_FIREBASE_GUARD_MISSING",
    );
  });

  it("reports a missing Android Firebase config without reading or serializing its values", () => {
    const root = createPassingFixture();
    initializeGitFixture(root);

    const missing = inspectAndroidReleaseNativeServicesInputs({ rootDir: root });

    expect(missing.shapeReady).toBe(false);
    expect(missing.issueCodes).toContain("GOOGLE_SERVICES_MISSING");
    expect(missing.sensitiveValuesPrinted).toBe(false);

    writeFixture(
      root,
      "android/app/google-services.json",
      JSON.stringify({
        project_info: { project_number: "FIREBASE_PROJECT_NUMBER_CANARY" },
        client: [
          {
            client_info: {
              mobilesdk_app_id: "FIREBASE_MOBILE_APP_ID_CANARY",
              android_client_info: { package_name: "com.zenflow.app" },
            },
          },
        ],
      }),
    );
    const present = inspectAndroidReleaseNativeServicesInputs({ rootDir: root });

    expect(present).toEqual({
      shapeReady: true,
      googleServices: {
        exists: true,
        regularFile: true,
        symlink: false,
        tracked: false,
        ignored: true,
        nonEmpty: true,
        jsonValid: true,
        packageMatches: true,
        mobileSdkAppIdPresent: true,
        projectNumberPresent: true,
      },
      issueCodes: [],
      sensitiveValuesPrinted: false,
    });
    expect(JSON.stringify(present)).not.toContain("FIREBASE_PROJECT_NUMBER_CANARY");
    expect(JSON.stringify(present)).not.toContain("FIREBASE_MOBILE_APP_ID_CANARY");
  });

  it("reports complete ignored signing inputs without serializing any credential value or path", () => {
    const root = createPassingFixture();
    initializeGitFixture(root);
    writeFixture(
      root,
      "android/key.properties",
      [
        "storeFile=release-upload.jks",
        "storePassword=SECRET_STORE_PASSWORD_CANARY",
        "keyAlias=SECRET_UPLOAD_ALIAS_CANARY",
        "keyPassword=SECRET_KEY_PASSWORD_CANARY",
      ].join("\n"),
    );
    writeFixture(root, "android/release-upload.jks", "not-a-real-test-keystore");

    const result = inspectAndroidReleaseSigningInputs({ rootDir: root });
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      shapeReady: true,
      keyProperties: {
        exists: true,
        regularFile: true,
        symlink: false,
        tracked: false,
        ignored: true,
      },
      requiredKeys: {
        storeFile: true,
        storePassword: true,
        keyAlias: true,
        keyPassword: true,
      },
      keystore: {
        configured: true,
        exists: true,
        regularFile: true,
        symlink: false,
      },
      issueCodes: [],
      secretValuesPrinted: false,
    });
    expect(serialized).not.toContain("SECRET_STORE_PASSWORD_CANARY");
    expect(serialized).not.toContain("SECRET_UPLOAD_ALIAS_CANARY");
    expect(serialized).not.toContain("SECRET_KEY_PASSWORD_CANARY");
    expect(serialized).not.toContain("release-upload.jks");
  });

  it("fails closed with fixed codes when signing properties or the referenced keystore are absent", () => {
    const root = createPassingFixture();
    initializeGitFixture(root);
    writeFixture(root, "android/key.properties", "storeFile=missing-upload.jks\nkeyAlias=upload\n");

    const result = inspectAndroidReleaseSigningInputs({ rootDir: root });

    expect(result.shapeReady).toBe(false);
    expect(result.requiredKeys).toEqual({
      storeFile: true,
      storePassword: false,
      keyAlias: true,
      keyPassword: false,
    });
    expect(result.issueCodes).toEqual(
      expect.arrayContaining([
        "SIGNING_PROPERTY_MISSING_STORE_PASSWORD",
        "SIGNING_PROPERTY_MISSING_KEY_PASSWORD",
        "KEYSTORE_MISSING",
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("missing-upload.jks");
  });

  it("rejects symlinked signing properties or keystore inputs", () => {
    const keyPropertiesRoot = createPassingFixture();
    initializeGitFixture(keyPropertiesRoot);
    writeFixture(
      keyPropertiesRoot,
      "outside.properties",
      "storeFile=release-upload.jks\nstorePassword=x\nkeyAlias=x\nkeyPassword=x\n",
    );
    symlinkSync("../outside.properties", join(keyPropertiesRoot, "android/key.properties"));

    const keyPropertiesResult = inspectAndroidReleaseSigningInputs({
      rootDir: keyPropertiesRoot,
    });
    expect(keyPropertiesResult.shapeReady).toBe(false);
    expect(keyPropertiesResult.issueCodes).toContain("KEY_PROPERTIES_SYMLINK");

    const keystoreRoot = createPassingFixture();
    initializeGitFixture(keystoreRoot);
    writeFixture(
      keystoreRoot,
      "android/key.properties",
      "storeFile=release-upload.jks\nstorePassword=x\nkeyAlias=x\nkeyPassword=x\n",
    );
    writeFixture(keystoreRoot, "outside.jks", "not-a-real-test-keystore");
    symlinkSync("../outside.jks", join(keystoreRoot, "android/release-upload.jks"));

    const keystoreResult = inspectAndroidReleaseSigningInputs({ rootDir: keystoreRoot });
    expect(keystoreResult.shapeReady).toBe(false);
    expect(keystoreResult.issueCodes).toContain("KEYSTORE_SYMLINK");
  });
});
