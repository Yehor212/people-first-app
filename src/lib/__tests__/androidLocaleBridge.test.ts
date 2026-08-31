import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Android app locale bridge", () => {
  it("declares all eight locales and registers the native locale plugin", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    const localeConfig = read("android/app/src/main/res/xml/locales_config.xml");
    const activity = read("android/app/src/main/java/com/zenflow/app/MainActivity.java");
    const plugin = read("android/app/src/main/java/com/zenflow/app/LocalePlugin.java");

    expect(manifest).toContain('android:localeConfig="@xml/locales_config"');
    for (const language of ["en", "uk", "es", "de", "fr", "ja", "ar", "he"]) {
      expect(localeConfig).toContain(`android:name="${language}"`);
      expect(plugin).toContain(`"${language}"`);
    }
    expect(activity).toContain("registerPlugin(LocalePlugin.class);");
    expect(plugin).toContain("LocaleManager");
    expect(plugin).toContain("setApplicationLocales");
  });

  it("synchronizes the active web language without changing non-Android runtimes", () => {
    const bridge = read("src/lib/nativeLocale.ts");
    const context = read("src/contexts/LanguageContext.tsx");

    expect(bridge).toContain('registerPlugin<NativeLocalePlugin>("ZenFlowLocale")');
    expect(bridge).toContain("if (!isNative || !isAndroid) return;");
    expect(context).toContain("syncNativeLocale(active.language)");
    expect(context).toContain("Native locale update failed");
  });
});
