import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Android 16 native contract", () => {
  it("targets API 36 and explicitly keeps predictive Back enabled", () => {
    const variables = read("android/variables.gradle");
    const manifest = read("android/app/src/main/AndroidManifest.xml");

    expect(variables).toMatch(/compileSdkVersion\s*=\s*36/);
    expect(variables).toMatch(/targetSdkVersion\s*=\s*36/);
    expect(manifest).toContain('android:enableOnBackInvokedCallback="true"');
    expect(manifest).not.toContain('android:enableOnBackInvokedCallback="false"');
  });

  it("uses supported callback integration without legacy Back dispatch", () => {
    const activity = read("android/app/src/main/java/com/zenflow/app/MainActivity.java");
    const backHandler = read("src/lib/androidBackHandler.ts");

    expect(activity).not.toMatch(/\bonBackPressed\s*\(/);
    expect(activity).not.toContain("KEYCODE_BACK");
    expect(activity).not.toContain("dispatchKeyEvent");
    expect(backHandler).toContain('AndroidBackBridge.addListener("backInvoked"');
    expect(backHandler).not.toContain('App.addListener("backButton"');
  });

  it("clears update cache only through the bridge WebView after Activity creation", () => {
    const activity = read("android/app/src/main/java/com/zenflow/app/MainActivity.java");
    const onCreateStart = activity.indexOf("public void onCreate(Bundle savedInstanceState)");
    const superCall = activity.indexOf("super.onCreate(savedInstanceState);", onCreateStart);
    const clearCall = activity.indexOf("clearWebViewCacheOnUpdate();", onCreateStart);

    expect(onCreateStart).toBeGreaterThan(-1);
    expect(superCall).toBeGreaterThan(onCreateStart);
    expect(clearCall).toBeGreaterThan(superCall);
    expect(activity).not.toContain("new WebView(this)");
    expect(activity).toContain("getBridge().getWebView().clearCache(true)");
    expect(activity).toContain('Log.w("ZenFlowStartup", "WEBVIEW_CACHE_CLEAR_FAILED")');
  });

  it("keeps the native launch surface until the first committed WebView frame", () => {
    const capacitorConfig = read("capacitor.config.ts");
    const appLifecycle = read("src/hooks/useAppLifecycle.ts");

    expect(capacitorConfig).toMatch(/launchAutoHide:\s*false/);
    expect(appLifecycle).toContain("if (isAndroid)");
    expect(appLifecycle).toContain("window.requestAnimationFrame");
    expect(appLifecycle).toContain("window.cancelAnimationFrame");
    expect(appLifecycle).toContain("SplashScreen.hide()");
    expect(appLifecycle).toContain("if (isIos)");
    expect(appLifecycle).not.toContain("setLoadingFadeOut(true)");
    expect(appLifecycle).not.toContain("LOADING_FADE_MS");
  });

  it("bundles the installed AdMob module instead of leaving a bare WebView specifier", () => {
    const adController = read("src/lib/adController.ts");

    expect(adController).toContain("import('@capacitor-community/admob')");
    expect(adController).not.toContain("@vite-ignore");
    expect(adController).not.toContain("const moduleName = '@capacitor-community/admob'");
  });
});
