import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

const MANIFEST_PATH = "android/app/src/main/AndroidManifest.xml";
const ACTIVITY_PATH = "android/app/src/main/java/com/zenflow/app/MainActivity.java";
const LAYOUT_PATH = "android/app/src/main/res/layout/activity_main.xml";
const CAPACITOR_CONFIG_PATH = "capacitor.config.ts";
const PACKAGE_LOCK_PATH = "package-lock.json";
const DENSITY_BUCKETS = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"] as const;

describe("Android adaptive window contract", () => {
  it("keeps the native WebView container fluid instead of assigning a device-sized frame", () => {
    const layout = read(LAYOUT_PATH);

    expect(layout.match(/android:layout_width="match_parent"/g)).toHaveLength(2);
    expect(layout.match(/android:layout_height="match_parent"/g)).toHaveLength(2);
    expect(layout).not.toMatch(/android:layout_(?:width|height)="\d+(?:\.\d+)?dp"/);
    expect(layout).not.toMatch(/android:(?:minWidth|minHeight|maxWidth|maxHeight)=/);
  });

  it("keeps the activity resizable across phone, sw600dp, split-screen and freeform windows", () => {
    const manifest = read(MANIFEST_PATH);
    const configChanges = manifest.match(/android:configChanges="([^"]+)"/)?.[1]?.split("|") ?? [];

    expect(configChanges).toEqual(
      expect.arrayContaining([
        "orientation",
        "keyboardHidden",
        "keyboard",
        "screenSize",
        "smallestScreenSize",
        "screenLayout",
        "uiMode",
        "navigation",
        "density",
      ]),
    );
    expect(manifest).toContain('android:windowSoftInputMode="adjustResize"');
    expect(manifest).not.toMatch(/android:screenOrientation\s*=/);
    expect(manifest).not.toMatch(/android:resizeableActivity\s*=\s*"false"/);
    expect(manifest).not.toMatch(/android:(?:maxAspectRatio|minAspectRatio)\s*=/);
    expect(manifest).not.toMatch(
      /android:(?:smallScreens|normalScreens|largeScreens|xlargeScreens|resizeable)\s*=\s*"false"/,
    );
  });

  it("retains a complete portrait and landscape splash resource matrix", () => {
    for (const orientation of ["port", "land"] as const) {
      for (const density of DENSITY_BUCKETS) {
        const path = `android/app/src/main/res/drawable-${orientation}-${density}/splash.png`;
        expect(existsSync(path), path).toBe(true);
        expect(statSync(path).size, path).toBeGreaterThan(0);
      }
    }
  });

  it("reapplies edge-to-edge ownership after resume and configuration changes", () => {
    const activity = read(ACTIVITY_PATH);
    const onResume = activity.match(
      /public void onResume\(\)\s*\{(?<body>[\s\S]*?)\n\s*\}/,
    )?.groups?.body;
    const onConfigurationChanged = activity.match(
      /public void onConfigurationChanged\(Configuration newConfig\)\s*\{(?<body>[\s\S]*?)\n\s*\}/,
    )?.groups?.body;

    expect(onResume).toContain("super.onResume();");
    expect(onResume).toContain("enableNativeEdgeToEdge();");
    expect(onConfigurationChanged).toContain("super.onConfigurationChanged(newConfig);");
    expect(onConfigurationChanged).toContain("enableNativeEdgeToEdge();");
  });

  it("uses the Capacitor SystemBars fix that does not apply an IME inset twice", () => {
    const lock = JSON.parse(read(PACKAGE_LOCK_PATH)) as {
      packages?: Record<string, { version?: string }>;
    };
    const packageNames = ["android", "core", "cli"] as const;
    const versions = packageNames.map(
      (name) => lock.packages?.[`node_modules/@capacitor/${name}`]?.version,
    );

    expect(new Set(versions).size).toBe(1);
    expect(versions.every(Boolean)).toBe(true);

    const [major, minor] = (versions[0] ?? "0.0.0").split(".").map(Number);
    expect(major).toBe(8);
    expect(minor).toBeGreaterThanOrEqual(4);

    // ZenFlow's community SafeArea plugin owns CSS safe-area values. The
    // SystemBars plugin must therefore stay disabled and, since 8.4.0, no
    // longer adds IME padding to an already adjustResize-sized WebView.
    expect(read(CAPACITOR_CONFIG_PATH)).toContain('insetsHandling: "disable"');
  });
});
