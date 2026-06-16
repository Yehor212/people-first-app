import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function extractBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start);
  expect(end, `missing end marker after: ${startMarker}`).toBeGreaterThan(start);
  return source.slice(start, end + endMarker.length);
}

describe("runtime performance guards", () => {
  it("keeps every Workbox runtime cache purgeable on browser quota errors", () => {
    const source = readSource("src/sw.ts");
    const cachePolicies = source.match(/new ExpirationPlugin\(\{[\s\S]*?\}\)/g) ?? [];

    expect(cachePolicies.length).toBeGreaterThanOrEqual(5);
    for (const policy of cachePolicies) {
      expect(policy).toContain("maxEntries");
      expect(policy).toContain("maxAgeSeconds");
      expect(policy).toContain("purgeOnQuotaError: true");
    }
  });

  it("keeps same-origin lazy assets in a purgeable runtime cache instead of the install precache", () => {
    const source = readSource("src/sw.ts");
    const runtimeAssetsBlock = extractBlock(
      source,
      'new CacheFirst({\n    cacheName: "zenflow-runtime-assets"',
      "purgeOnQuotaError: true,",
    );

    expect(runtimeAssetsBlock).toContain("new CacheFirst");
    expect(runtimeAssetsBlock).toContain("maxEntries");
    expect(runtimeAssetsBlock).toContain("maxAgeSeconds");
    expect(runtimeAssetsBlock).toContain("purgeOnQuotaError: true");
    expect(source).toContain('url.origin === self.location.origin');
    expect(source).toContain('url.pathname.includes("/assets/")');
  });

  it("scopes the service-worker precache to the app shell and canonical orb boot path", () => {
    const source = readSource("vite.config.ts");

    expect(source).not.toContain('"**/*.{js,css,html,ico,png,svg,woff2}"');
    expect(source).toContain('"assets/index-*.js"');
    expect(source).toContain('"assets/index-*.css"');
    expect(source).toContain('"assets/orbWorker-*.js"');
    expect(source).toContain('"assets/OrbPage-*.js"');
    expect(source).toContain('"assets/OrbPage-*.css"');
    expect(source).not.toContain('"feature-graphic.png"');
    expect(source).not.toContain('"og-image.png"');
  });

  it("keeps PWA navigations fresh online with an offline app-shell fallback", () => {
    const source = readSource("src/sw.ts");
    const navigationBlock = extractBlock(
      source,
      "// Handle navigation requests",
      "return Response.error();",
    );

    expect(source).toContain('const APP_SHELL_URL = "index.html";');
    expect(navigationBlock).toContain("return await fetch(request);");
    expect(navigationBlock).toContain("matchPrecache(APP_SHELL_URL)");
    expect(navigationBlock).toContain("logger.warn");
    expect(source).not.toContain('request.mode === "navigate", new NetworkOnly()');
  });

  it("strips the PWA manifest link from native Capacitor bundles", () => {
    const source = readSource("scripts/capacitor-prune-assets.cjs");

    expect(source).toContain('process.env.CAPACITOR_BUILD !== "true"');
    expect(source).toContain("const ANDROID_PUBLIC");
    expect(source).toContain("const ANDROID_RES");
    expect(source).toContain("const ANDROID_APP_BUILD");
    expect(source).toContain("const ANDROID_CORDOVA_PLUGINS");
    expect(source).toContain("const IOS_APP");
    expect(source).toContain("pruneMacDuplicateArtifacts");
    expect(source).toContain("/ \\d+(?=\\.|$)/");
    expect(source).toContain("entry.isDirectory()");
    expect(source).toContain('pruneMacDuplicateArtifacts(ANDROID_PUBLIC, "android-public")');
    expect(source).toContain('pruneMacDuplicateArtifacts(ANDROID_RES, "android-res")');
    expect(source).toContain('pruneMacDuplicateArtifacts(ANDROID_APP_BUILD, "android-app-build")');
    expect(source).toContain('pruneMacDuplicateArtifacts(ANDROID_CORDOVA_PLUGINS, "android-cordova-plugins")');
    expect(source).toContain('pruneMacDuplicateArtifacts(IOS_APP, "ios-app")');
    expect(source).toContain("stripNativeManifestLink");
    expect(source).toContain("rel=[\"']manifest[\"']");
    expect(source).toContain("removed native manifest link from index.html");
    expect(source).toContain("stripNativeManifestLink();");
  });

  it("cleans duplicate native artifacts again after Android Capacitor sync", () => {
    const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;

    expect(scripts["cap:sync:android"]).toContain("npx cap sync android &&");
    expect(scripts["cap:sync:android"]).toContain(
      "cross-env CAPACITOR_BUILD=true node scripts/capacitor-prune-assets.cjs"
    );
  });

  it("cleans duplicate native artifacts again after iOS Capacitor sync", () => {
    const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;

    expect(scripts["cap:sync:ios"]).toContain("npx cap sync ios &&");
    expect(scripts["cap:sync:ios"]).toContain(
      "cross-env CAPACITOR_BUILD=true node scripts/capacitor-prune-assets.cjs"
    );
    expect(scripts["cap:sync:ios"]).toMatch(
      /npx cap sync ios && cross-env CAPACITOR_BUILD=true node scripts\/capacitor-prune-assets\.cjs && node scripts\/normalize-ios-spm\.cjs/
    );
  });

  it("does not expose Android-only diary screenshot blocking on iOS", () => {
    const hookSource = readSource("src/features/journal/useScreenSecurity.ts");
    const moduleSource = readSource("src/features/journal/JournalModule.tsx");

    expect(hookSource).toContain("import { isAndroid }");
    expect(hookSource).toContain("const isSupported = isAndroid;");
    expect(hookSource).toContain("if (!isSupported || !enabled || !journalOpen) return;");
    expect(hookSource).toContain("return { enabled: isSupported ? enabled : false, setEnabled, isSupported };");
    expect(moduleSource).toContain("screenSecurity.isSupported &&");
    expect(moduleSource).not.toContain("screenSecurity.isNative &&");
  });

  it("strips the PWA manifest link when PWA output is disabled", () => {
    const source = readSource("vite.config.ts");

    expect(source).toContain("function stripDisabledPwaManifestPlugin");
    expect(source).toContain("pwaEnabled ? html : stripPwaManifestLink(html)");
    expect(source).toContain("stripDisabledPwaManifestPlugin(pwaEnabled)");
    expect(source).toContain("rel=[\"']manifest[\"']");
  });

  it("keeps desktop diary rail and stats controls at least 44px", () => {
    const moodDotStrip = readSource("src/features/journal/MoodDotStrip.tsx");
    const journalStats = readSource("src/features/journal/JournalStats.tsx");

    expect(moodDotStrip).toContain("const DOT_ITEM_HEIGHT = 48;");
    expect(moodDotStrip).toContain("const totalHeight = entries.length * DOT_ITEM_HEIGHT;");
    expect(moodDotStrip).toContain("top: realIndex * DOT_ITEM_HEIGHT");
    expect(moodDotStrip).toContain("h-[44px] w-[44px]");
    expect(journalStats).not.toContain("min-w-[32px] min-h-[32px]");
    expect(journalStats).toContain("min-w-[44px] min-h-[44px]");
  });

  it("keeps document visibilitychange free of heavy lifecycle work", () => {
    const source = readSource("src/main.tsx");
    const listener = extractBlock(
      source,
      'document.addEventListener("visibilitychange", () => {',
      "\n});",
    );

    expect(source).toContain("function scheduleLifecycleTask");
    expect(listener).toContain("savePendingQueueSnapshot({ hidden: true })");
    expect(listener).toContain('scheduleLifecycleTask("pause")');
    expect(listener).toContain('scheduleLifecycleTask("resume")');
    expect(listener).not.toContain("handleAppPause()");
    expect(listener).not.toContain("handleAppResume()");
  });

  it("splits resume audio, version, and sync work across browser tasks", () => {
    const source = readSource("src/main.tsx");
    const resumeBlock = extractBlock(
      source,
      "async function handleAppResume(): Promise<void> {",
      "\n}",
    );
    const yieldCount = (resumeBlock.match(/await yieldToNextTask\(\);/g) ?? []).length;

    expect(source).toContain("function yieldToNextTask");
    expect(yieldCount).toBeGreaterThanOrEqual(3);
    expect(resumeBlock.indexOf("await yieldToNextTask();")).toBeLessThan(
      resumeBlock.indexOf("await resumeAllAudio();"),
    );
    expect(resumeBlock.lastIndexOf("await yieldToNextTask();")).toBeLessThan(
      resumeBlock.indexOf("if (navigator.onLine)"),
    );
  });

  it("keeps V2 shell challenge storage lazy until progress changes", () => {
    const source = readSource("src/pages/Index.tsx");

    expect(source).not.toContain("useState(() => getChallenges())");
    expect(source).not.toContain("useState(() => getBadges())");
    expect(source).toContain("useRef<ChallengeList | null>(null)");
    expect(source).toContain("useRef<BadgeList | null>(null)");
    expect(source).toContain("const current = challengesRef.current ?? getChallenges()");
    expect(source).toContain("const current = badgesRef.current ?? getBadges()");
  });
});
