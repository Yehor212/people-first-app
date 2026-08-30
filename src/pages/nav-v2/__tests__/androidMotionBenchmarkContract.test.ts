import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Android motion benchmark boundary", () => {
  it("keeps the profileable benchmark release-like and locally debug-signed", () => {
    const gradle = read("android/app/build.gradle");
    const benchmarkManifestPath = "android/app/src/benchmark/AndroidManifest.xml";

    expect(existsSync(benchmarkManifestPath)).toBe(true);
    expect(gradle).toContain(
      'buildConfigField "boolean", "ZENFLOW_ANDROID_MOTION_BENCHMARK", "false"'
    );
    expect(gradle).toContain("benchmark {");
    expect(gradle).toContain("initWith release");
    expect(gradle).toContain("minifyEnabled true");
    expect(gradle).toContain("signingConfig signingConfigs.debug");
    expect(gradle).toContain("matchingFallbacks = ['release']");
    expect(gradle).toContain(
      'buildConfigField "boolean", "ZENFLOW_ANDROID_MOTION_BENCHMARK", "true"'
    );

    const benchmarkManifest = read(benchmarkManifestPath);
    expect(benchmarkManifest).toContain("<profileable");
    expect(benchmarkManifest).toContain('android:shell="true"');
    expect(benchmarkManifest).toContain('android:enabled="true"');
  });

  it("enables WebView inspection from BuildConfig only and keeps release disabled", () => {
    const mainActivity = read("android/app/src/main/java/com/zenflow/app/MainActivity.java");
    const capacitorConfig = read("capacitor.config.ts");

    const debuggingCall =
      "WebView.setWebContentsDebuggingEnabled(BuildConfig.ZENFLOW_ANDROID_MOTION_BENCHMARK);";
    expect(mainActivity).toContain(debuggingCall);
    expect(mainActivity.indexOf(debuggingCall)).toBeGreaterThan(
      mainActivity.indexOf("super.onCreate(savedInstanceState);")
    );
    expect(mainActivity).not.toContain("WebView.setWebContentsDebuggingEnabled(true)");
    expect(capacitorConfig).toContain("webContentsDebuggingEnabled: false");
  });

  it("builds the frame probe into benchmark assets only", () => {
    const packageJson = read("package.json");
    const viteConfig = read("vite.config.ts");
    const viteTypes = read("src/vite-env.d.ts");
    const valenceOrb = read("src/components/state-of-mind/ValenceOrb.tsx");
    const app = read("src/App.tsx");

    expect(packageJson).toContain('"build:android:benchmark"');
    expect(packageJson).toContain('"cap:sync:android:benchmark"');
    expect(packageJson).toContain("ZENFLOW_ANDROID_MOTION_BENCHMARK=true");
    expect(viteConfig).toContain("__ANDROID_MOTION_BENCHMARK__");
    expect(viteConfig).toContain('process.env.ZENFLOW_ANDROID_MOTION_BENCHMARK === "true"');
    expect(viteTypes).toContain("declare const __ANDROID_MOTION_BENCHMARK__: boolean;");
    expect(valenceOrb).toContain("__ANDROID_MOTION_BENCHMARK__");
    expect(valenceOrb).toContain('location.protocol === "https:"');
    expect(valenceOrb).toContain('location.hostname === "localhost"');
    expect(app).toContain("__ANDROID_MOTION_BENCHMARK__");
    expect(app).toContain('location.protocol === "https:"');
    expect(app).toContain('location.hostname === "localhost"');
    expect(app).toContain('searchParams.get("androidMotionProbe") === "loader"');
    expect(app).toContain("<SplashScreen");
  });

  it("exposes banner lifecycle state only behind the Android benchmark flag", () => {
    const adController = read("src/lib/adController.ts");
    const adContext = read("src/contexts/AdContext.tsx");

    expect(adController).toContain("__ANDROID_MOTION_BENCHMARK__");
    expect(adController).toContain("__ZENFLOW_ANDROID_BANNER_BENCHMARK__");
    expect(adController).toContain("bannerCreated");
    expect(adController).toContain("bannerVisible");
    expect(adController).toContain("bannerHeight");
    expect(adContext).toContain("__ANDROID_MOTION_BENCHMARK__");
    expect(adContext).toContain("__ZENFLOW_ANDROID_BANNER_CONTEXT_BENCHMARK__");
  });

  it("does not classify release-like benchmark dependency tasks as a publishable release", () => {
    const gradle = read("android/app/build.gradle");

    expect(gradle).toContain("gradle.startParameter.taskNames");
    expect(gradle).toContain("publishableReleaseTaskRequested");
    expect(gradle).not.toContain("taskGraph.allTasks.any");
  });
});
