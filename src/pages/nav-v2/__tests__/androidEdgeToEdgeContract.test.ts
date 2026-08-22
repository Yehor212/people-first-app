import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Android edge-to-edge native contract", () => {
  it("keeps edge-to-edge active without native decor masking or immersive hiding", () => {
    const mainActivity = read("android/app/src/main/java/com/zenflow/app/MainActivity.java");
    const styles = read("android/app/src/main/res/values/styles.xml");

    expect(mainActivity).toContain("import android.graphics.Color;");
    expect(mainActivity).toContain("EdgeToEdge.enable(this)");
    expect(mainActivity).toContain("WindowCompat.setDecorFitsSystemWindows(getWindow(), false)");
    expect(mainActivity.indexOf("enableNativeEdgeToEdge();")).toBeLessThan(
      mainActivity.indexOf("super.onCreate(savedInstanceState);")
    );
    expect((mainActivity.match(/enableNativeEdgeToEdge\(\);/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(mainActivity).toContain("setStatusBarColor(Color.TRANSPARENT)");
    expect(mainActivity).toContain("setNavigationBarColor(Color.TRANSPARENT)");
    expect(mainActivity).toContain("applyNativeEdgeBackdrop();");
    expect(mainActivity).toContain("getWindow().getDecorView().post(this::applyNativeEdgeBackdrop)");
    expect(mainActivity).toContain("StatusBarStylePlugin.applyCurrentEdgeBackdrop(this)");
    expect(mainActivity).toContain("public void onResume()");
    expect(mainActivity).toContain("onConfigurationChanged(Configuration newConfig)");
    expect(mainActivity).toContain("setStatusBarContrastEnforced(false)");
    expect(mainActivity).toContain("setNavigationBarContrastEnforced(false)");
    expect(mainActivity).not.toContain("SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN");
    expect(mainActivity).not.toContain("SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION");
    expect(mainActivity).not.toContain("WindowInsetsCompat.Type.systemBars()");
    expect(mainActivity).not.toContain("WindowInsetsControllerCompat");
    expect(mainActivity).not.toContain("controller.hide");
    expect(mainActivity).not.toContain("BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE");
    expect(mainActivity).not.toContain("ZENFLOW_EDGE_UNDERLAY_COLORS");
    expect(mainActivity).not.toContain("new GradientDrawable");
    expect(mainActivity).not.toContain("setBackgroundDrawable(");
    expect(mainActivity).not.toContain("getDecorView().setBackground(");
    expect(mainActivity).not.toContain("setStatusBarColor(getColor(R.color.zenflow_edge_bleed_status))");
    expect(mainActivity).not.toContain("setNavigationBarColor(getColor(R.color.zenflow_edge_bleed_navigation))");

    expect(styles).toContain('<item name="android:statusBarColor">@android:color/transparent</item>');
    expect(styles).toContain('<item name="android:navigationBarColor">@android:color/transparent</item>');
    expect(styles).not.toContain('<item name="android:statusBarColor">@color/zenflow_edge_bleed_status</item>');
    expect(styles).not.toContain('<item name="android:navigationBarColor">@color/zenflow_edge_bleed_navigation</item>');
    expect(styles).not.toContain("@color/zenflow_edge_underlay");
  });

  it("uses @capacitor-community/safe-area as the only Android WebView inset owner", () => {
    const capacitorConfig = read("capacitor.config.ts");
    const packageJson = read("package.json");

    expect(packageJson).toContain('"@capacitor-community/safe-area"');
    expect(capacitorConfig).toContain("SystemBars");
    expect(capacitorConfig).toContain('insetsHandling: "disable"');
    expect(capacitorConfig).not.toContain('insetsHandling: "css"');
    expect(capacitorConfig).not.toContain("hidden: true");
    expect(capacitorConfig).toContain("SafeArea");
    expect(capacitorConfig).toContain("initialViewportFitCover: true");
  });

  it("uses a V2 edge-bleed backdrop behind transparent native system bars", () => {
    const mainActivity = read("android/app/src/main/java/com/zenflow/app/MainActivity.java");
    const styles = read("android/app/src/main/res/values/styles.xml");
    const colors = read("android/app/src/main/res/values/edge_to_edge_colors.xml");
    const backdrop = read("android/app/src/main/res/drawable/zenflow_edge_bleed_backdrop.xml");

    expect(mainActivity).not.toContain("installAndroidSafeAreaFallbackBackground");
    expect(mainActivity).not.toContain("new View(this)");
    expect(mainActivity).not.toContain("addView(fallbackBackgroundView");
    expect(mainActivity).not.toContain("new GradientDrawable");
    expect(mainActivity).not.toContain("setBackgroundDrawable(");
    expect(mainActivity).not.toContain("ZENFLOW_EDGE_UNDERLAY_COLORS");
    expect(styles).toContain('<item name="android:windowBackground">@color/zenflow_edge_bleed_window</item>');
    expect(styles).toContain('<item name="android:statusBarColor">@android:color/transparent</item>');
    expect(styles).toContain('<item name="android:navigationBarColor">@android:color/transparent</item>');
    expect(colors).toContain('name="zenflow_edge_bleed_status"');
    expect(colors).toContain('name="zenflow_edge_bleed_navigation"');
    expect(colors).toContain('name="zenflow_edge_bleed_window"');
    expect(colors).toContain("#80CDD1");
    expect(colors).toContain("#C5DCCF");
    expect(backdrop).toContain("@color/zenflow_edge_bleed_status");
    expect(backdrop).toContain("@color/zenflow_edge_bleed_mid");
    expect(backdrop).toContain("@color/zenflow_edge_bleed_navigation");
    expect(backdrop).toContain('android:angle="270"');
    expect(styles).not.toContain('<item name="android:windowBackground">@android:color/transparent</item>');
    expect(styles).not.toContain("zenflow_edge_underlay");
  });

  it("keeps the native edge backdrop and both system-bar icon modes aligned with the app theme", () => {
    const mainActivity = read("android/app/src/main/java/com/zenflow/app/MainActivity.java");
    const statusBarPlugin = read(
      "android/app/src/main/java/com/zenflow/app/StatusBarStylePlugin.java"
    );
    const darkColorsPath = "android/app/src/main/res/values/edge_to_edge_dark_colors.xml";
    const darkBackdropPath =
      "android/app/src/main/res/drawable/zenflow_edge_bleed_backdrop_dark.xml";

    expect(existsSync(darkColorsPath)).toBe(true);
    expect(existsSync(darkBackdropPath)).toBe(true);

    const darkColors = read(darkColorsPath);
    const darkBackdrop = read(darkBackdropPath);

    expect(mainActivity).toContain("StatusBarStylePlugin.applyCurrentEdgeBackdrop(this)");
    expect(statusBarPlugin).toContain("static void applyCurrentEdgeBackdrop");
    expect(statusBarPlugin).toContain("setAppearanceLightStatusBars(!darkTheme)");
    expect(statusBarPlugin).toContain("setAppearanceLightNavigationBars(!darkTheme)");
    expect(statusBarPlugin).toContain("R.drawable.zenflow_edge_bleed_backdrop_dark");
    expect(statusBarPlugin).toContain("window.setBackgroundDrawableResource(backdropResource)");
    expect(statusBarPlugin).toContain("decorView.setBackgroundResource(backdropResource)");
    expect(darkColors).toContain('name="zenflow_edge_bleed_status_dark"');
    expect(darkColors).toContain('name="zenflow_edge_bleed_navigation_dark"');
    expect(darkColors).toContain('name="zenflow_edge_bleed_window_dark"');
    expect(darkBackdrop).toContain("@color/zenflow_edge_bleed_status_dark");
    expect(darkBackdrop).toContain("@color/zenflow_edge_bleed_navigation_dark");
  });

  it("serves Capacitor Android assets from the native localhost root, not the GitHub Pages base", () => {
    const viteConfig = read("vite.config.ts");

    expect(viteConfig).toContain("process.env.CAPACITOR_BUILD === \"true\"");
    expect(viteConfig).toContain("const base = isCapacitor ? \"./\" : webBase;");
    expect(viteConfig).toContain("const pwaEnabled = !isCapacitor");

    const nativeIndexPath = "android/app/src/main/assets/public/index.html";
    if (!existsSync(nativeIndexPath)) return;

    const nativeIndex = read(nativeIndexPath);

    expect(nativeIndex).not.toContain('"/people-first-app/assets/');
    expect(nativeIndex).not.toContain('href="/people-first-app/manifest.webmanifest');
    expect(nativeIndex).not.toContain('src="/people-first-app/registerSW.js');
    expect(nativeIndex).not.toContain('id="vite-plugin-pwa:register-sw"');
    expect(nativeIndex).toMatch(/src="\.\/assets\/index-[^"]+\.js"/);
    expect(nativeIndex).toMatch(/href="\.\/assets\/index-[^"]+\.css"/);
  });
});
