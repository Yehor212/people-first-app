import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function sha256(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(join(root, relativePath)))
    .digest("hex");
}

describe("Android Baseline Profile and Macrobenchmark contract", () => {
  it("wires a release-equivalent Baseline Profile producer into the app", () => {
    const settings = read("android/settings.gradle");
    const rootBuild = read("android/build.gradle");
    const appBuild = read("android/app/build.gradle");
    const producerBuild = read("android/baselineprofile/build.gradle");

    expect(settings).toContain("include ':baselineprofile'");
    expect(rootBuild).toContain(
      "classpath 'androidx.baselineprofile:androidx.baselineprofile.gradle.plugin:1.4.1'",
    );
    expect(appBuild).toContain("apply plugin: 'androidx.baselineprofile'");
    expect(appBuild).toContain("baselineProfile project(':baselineprofile')");
    expect(appBuild).toContain(
      "implementation 'androidx.profileinstaller:profileinstaller:1.4.1'",
    );
    expect(appBuild).toContain("ZENFLOW_RELEASE_DISTRIBUTION_TASKS");
    expect(appBuild).toContain("task.project.path == ':app'");
    expect(appBuild).toContain("ZENFLOW_RELEASE_DISTRIBUTION_TASKS.contains(task.name)");
    expect(producerBuild).toContain("apply plugin: 'com.android.test'");
    expect(producerBuild).toContain("apply plugin: 'androidx.baselineprofile'");
    expect(producerBuild).toContain("targetProjectPath = ':app'");
    expect(producerBuild).toContain("sourceCompatibility JavaVersion.VERSION_21");
    expect(producerBuild).toContain("targetCompatibility JavaVersion.VERSION_21");
    expect(producerBuild).toContain(
      "implementation 'androidx.benchmark:benchmark-macro-junit4:1.4.1'",
    );
  });

  it("defines startup and all five critical V2 journeys without a hand-authored profile", () => {
    const journeys = read(
      "android/baselineprofile/src/main/java/com/zenflow/benchmark/ZenFlowJourneys.kt",
    );
    const generator = read(
      "android/baselineprofile/src/main/java/com/zenflow/benchmark/BaselineProfileGenerator.kt",
    );

    expect(generator).toContain("BaselineProfileRule");
    expect(generator).toContain("includeInStartupProfile = true");
    expect(generator).toContain("includeInStartupProfile = false");
    const startupSection = generator.slice(
      generator.indexOf("fun startup"),
      generator.indexOf("fun criticalJourneys"),
    );
    expect(startupSection).toContain("startActivityAndWait()");
    expect(startupSection).not.toContain("openHabits");
    expect(generator).toContain("if (!journeys.awaitSignedInShell()) return@collect");
    expect(generator).toContain("journeys.openOrb()");
    for (const journey of [
      "openHabits",
      "openDiary",
      "openPlanning",
      "openSettings",
      "openConnectedHistory",
    ]) {
      expect(generator).toContain(`journeys.${journey}()`);
    }
    expect(journeys).toContain('private const val PACKAGE_NAME = "com.zenflow.app"');
    expect(journeys).toContain("Until.hasObject(By.pkg(PACKAGE_NAME).depth(0))");
    expect(journeys).toContain('findText("Sign in to continue")');
    expect(journeys).not.toMatch(/authBypass|authGateChecked|localStorage|indexedDB/i);
  });

  it("measures cold startup and frame timing with explicit compilation modes", () => {
    const benchmark = read(
      "android/baselineprofile/src/main/java/com/zenflow/benchmark/ZenFlowMacrobenchmark.kt",
    );
    const journeys = read(
      "android/baselineprofile/src/main/java/com/zenflow/benchmark/ZenFlowJourneys.kt",
    );

    expect(benchmark).toContain("MacrobenchmarkRule");
    expect(benchmark).toContain("StartupTimingMetric()");
    expect(benchmark).toContain("FrameTimingMetric()");
    expect(benchmark).toContain("StartupMode.COLD");
    expect(benchmark).toContain("CompilationMode.None()");
    expect(benchmark).toContain("CompilationMode.Partial(BaselineProfileMode.Require)");
    expect(benchmark).toContain("iterations = 10");
    expect(benchmark).toContain("fun publicEntryFrames()");
    expect(benchmark).toContain("journeys.exercisePublicEntry()");
    expect(journeys).toContain("fun exercisePublicEntry()");
  });

  it("keeps public-entry readiness locale-neutral and outside frame measurement", () => {
    const benchmark = read(
      "android/baselineprofile/src/main/java/com/zenflow/benchmark/ZenFlowMacrobenchmark.kt",
    );
    const journeys = read(
      "android/baselineprofile/src/main/java/com/zenflow/benchmark/ZenFlowJourneys.kt",
    );
    const publicEntrySection = journeys.slice(
      journeys.indexOf("fun awaitPublicEntrySurface"),
      journeys.indexOf("fun awaitSignedInShell"),
    );

    expect(journeys).toContain("fun awaitPublicEntrySurface()");
    expect(journeys).toContain(
      'WEBVIEW_CLASS_NAME = "android.webkit.WebView"',
    );
    expect(journeys).toContain(
      "By.clazz(WEBVIEW_CLASS_NAME).pkg(PACKAGE_NAME)",
    );
    expect(journeys).toContain(
      "By.clazz(RADIO_GROUP_CLASS_NAME).pkg(PACKAGE_NAME)",
    );
    expect(journeys).toContain("it.childCount == THEME_OPTION_COUNT");
    expect(publicEntrySection).not.toMatch(
      /Welcome to ZenFlow|Sign in to continue|findText\("Continue"\)/,
    );

    const publicEntryBenchmark = benchmark.slice(
      benchmark.indexOf("fun publicEntryFrames()"),
      benchmark.indexOf("private fun measureColdStartup"),
    );
    expect(publicEntryBenchmark).toContain(
      "ZenFlowJourneys().awaitPublicEntrySurface()",
    );
    expect(publicEntryBenchmark.indexOf("awaitPublicEntrySurface")).toBeLessThan(
      publicEntryBenchmark.indexOf("journeys.exercisePublicEntry()"),
    );
  });

  it("keeps emulator measurements diagnostic and release performance fail-closed", () => {
    const evidence = JSON.parse(
      read("docs/release/android-2.1-performance-evidence.json"),
    );

    expect(evidence.releaseStatus).toBe("STOP");
    expect(evidence.device.kind).toBe("emulator");
    expect(evidence.device.representativeReleaseEvidence).toBe(false);
    expect(evidence.releaseThresholds.representativePhysicalDeviceRequired).toBe(true);
    expect(evidence.verdicts.emulatorFrameDiagnostic).toBe("FAIL");
    expect(evidence.verdicts.representativePhysicalDevice).toBe("UNVERIFIED");
    expect(evidence.verdicts.signedInPrivateJourney).toBe("UNVERIFIED");
    expect(evidence.verdicts.releasePerformance).toBe("STOP");

    expect(evidence.source.journeysSha256).toBe(
      sha256("android/baselineprofile/src/main/java/com/zenflow/benchmark/ZenFlowJourneys.kt"),
    );
    expect(evidence.source.macrobenchmarkSha256).toBe(
      sha256(
        "android/baselineprofile/src/main/java/com/zenflow/benchmark/ZenFlowMacrobenchmark.kt",
      ),
    );
    expect(evidence.profile.baselineProfileSha256).toBe(
      sha256("android/app/src/release/generated/baselineProfiles/baseline-prof.txt"),
    );
    expect(evidence.profile.startupProfileSha256).toBe(
      sha256("android/app/src/release/generated/baselineProfiles/startup-prof.txt"),
    );
  });
});
