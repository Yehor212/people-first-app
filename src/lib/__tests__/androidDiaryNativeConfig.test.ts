import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Android diary native configuration", () => {
  it("keeps diary data out of Android backup/transfer and avoids broad media storage permissions", () => {
    const manifest = readSource("android/app/src/main/AndroidManifest.xml");
    const extractionRules = readSource("android/app/src/main/res/xml/data_extraction_rules.xml");

    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(extractionRules).toContain('<exclude domain="root" path="." />');
    expect(manifest).toContain('android.permission.RECORD_AUDIO');
    expect(manifest).not.toContain('android.permission.READ_EXTERNAL_STORAGE');
    expect(manifest).not.toContain('android.permission.WRITE_EXTERNAL_STORAGE');
    expect(manifest).not.toContain('android.permission.READ_MEDIA_IMAGES');
  });

  it("keeps the Android WebView transport hardened for private diary content", () => {
    const capacitorConfig = readSource("capacitor.config.ts");

    expect(capacitorConfig).toContain("webContentsDebuggingEnabled: false");
    expect(capacitorConfig).toContain("allowMixedContent: false");
    expect(capacitorConfig).toContain("androidScheme: \"https\"");
    expect(capacitorConfig).toContain("cleartext: false");
  });

  it("keeps Android widget diary entry points wired to immutable deep links", () => {
    const manifest = readSource("android/app/src/main/AndroidManifest.xml");
    const miniWidget = readSource("android/app/src/main/java/com/zenflow/app/WidgetProviderMini.java");
    const smallWidget = readSource("android/app/src/main/java/com/zenflow/app/WidgetProviderSmall.java");

    expect(manifest).toContain('android:scheme="zenflow"');
    expect(manifest).toContain('android:host="diary"');
    expect(miniWidget).toContain('Uri.parse("zenflow://diary/mood")');
    expect(miniWidget).toContain('Uri.parse("zenflow://diary/editor")');
    expect(smallWidget).toContain('Uri.parse("zenflow://diary/mood")');
    expect(miniWidget).toContain("moodIntent.setPackage(context.getPackageName())");
    expect(miniWidget).toContain("editorIntent.setPackage(context.getPackageName())");
    expect(smallWidget).toContain("intent.setPackage(context.getPackageName())");
    expect(miniWidget).toContain("PendingIntent.FLAG_IMMUTABLE");
    expect(smallWidget).toContain("PendingIntent.FLAG_IMMUTABLE");
  });
  it("lets Capacitor forward each Android diary intent exactly once", () => {
    const activitySource = readSource("android/app/src/main/java/com/zenflow/app/MainActivity.java");
    const onNewIntentBody = activitySource.match(/protected void onNewIntent\(Intent intent\) \{([\s\S]*?)\n {4}\}/)?.[1] ?? "";

    expect(onNewIntentBody.match(/super\.onNewIntent\(intent\)/g)?.length).toBe(1);
    expect(onNewIntentBody).not.toContain("handleDeepLinkIntent(intent)");
    expect(activitySource).not.toContain("this.bridge.onNewIntent(intent)");
  });

});
