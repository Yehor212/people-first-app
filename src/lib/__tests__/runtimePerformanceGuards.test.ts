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
  it("waits for the Journal route shell before measuring phone and desktop performance", () => {
    const manifest = JSON.parse(readSource("config/chrome-performance-budgets.json")) as {
      routeGroups: Array<{
        routes: Array<{ name: string; readySelector?: string }>;
      }>;
    };
    const journalRoutes = manifest.routeGroups
      .flatMap((group) => group.routes)
      .filter((route) => route.name.startsWith("diary-v2-"));

    expect(journalRoutes).toHaveLength(2);
    for (const route of journalRoutes) {
      expect(route.readySelector).toBe('[data-testid="diary-page"]');
    }
  });

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
      "purgeOnQuotaError: true,"
    );

    expect(runtimeAssetsBlock).toContain("new CacheFirst");
    expect(runtimeAssetsBlock).toContain("maxEntries");
    expect(runtimeAssetsBlock).toContain("maxAgeSeconds");
    expect(runtimeAssetsBlock).toContain("purgeOnQuotaError: true");
    expect(source).toContain("url.origin === self.location.origin");
    expect(source).toContain('url.pathname.includes("/assets/")');
  });

  it("scopes the service-worker precache to the app shell and canonical orb boot path", () => {
    const source = readSource("vite.config.ts");

    expect(source).not.toContain('"**/*.{js,css,html,ico,png,svg,woff2}"');
    expect(source).toContain('"assets/index-*.js"');
    expect(source).toContain('"assets/index-*.css"');
    expect(source).not.toContain('"assets/runtime-perf-bootstrap-*.js"');
    expect(source).toContain('"assets/orbWorker-*.js"');
    expect(source).toContain('"assets/OrbPage-*.js"');
    expect(source).toContain('"assets/OrbPage-*.css"');
    expect(source).not.toContain('"feature-graphic.png"');
    expect(source).not.toContain('"og-image.png"');
  });

  it("keeps PWA navigations fresh online with bounded app-shell and offline-document fallbacks", () => {
    const source = readSource("src/sw.ts");
    const navigationBlock = extractBlock(
      source,
      "// Handle navigation requests",
      "return Response.error();"
    );

    expect(source).toContain('const APP_SHELL_URL = "index.html";');
    expect(source).toContain('const OFFLINE_DOCUMENT_URL = "offline.html";');
    expect(source).toContain("const NAVIGATION_NETWORK_TIMEOUT_MS = 4000;");
    expect(source).toContain("fetchNavigationWithTimeout(request)");
    expect(navigationBlock).toContain('request.destination === "document"');
    expect(navigationBlock).toContain("return await fetchNavigationWithTimeout(request);");
    expect(navigationBlock).toContain("matchPrecache(APP_SHELL_URL)");
    expect(navigationBlock).toContain("matchPrecache(OFFLINE_DOCUMENT_URL)");
    expect(navigationBlock).toContain("logger.warn");
    expect(source).not.toContain('request.mode === "navigate", new NetworkOnly()');
  });

  it("does not expose dead origin-wide cache or lifecycle commands to app messages", () => {
    const source = readSource("src/sw.ts");
    const messageBlock = extractBlock(
      source,
      "// Listen for messages from the main app",
      "event.waitUntil(warmRuntimeAudioCacheOnce());",
    );

    expect(source).toContain('const CLIENT_MESSAGE_TYPES = ["WARM_RUNTIME_AUDIO_CACHE"] as const;');
    expect(messageBlock).not.toContain("CLEAR_CACHES");
    expect(messageBlock).not.toContain("SKIP_WAITING");
    expect(messageBlock).not.toContain("REGISTER_SYNC");
    expect(messageBlock).not.toContain("caches.keys()");
  });

  it("names every literal runtime cache inside the ZenFlow namespace", () => {
    const source = readSource("src/sw.ts");
    const cacheNames = [...source.matchAll(/cacheName: "([^"]+)"/g)].map((match) => match[1]);

    expect(cacheNames.length).toBeGreaterThan(0);
    expect(cacheNames.every((cacheName) => cacheName.startsWith("zenflow-"))).toBe(true);
  });

  it("describes background sync as an open-client wake hint, not closed-browser processing", () => {
    const serviceWorkerSource = readSource("src/sw.ts");
    const queueSource = readSource("src/lib/offlineQueue.ts");

    expect(serviceWorkerSource).not.toContain("Enables sync even after browser is closed");
    expect(serviceWorkerSource).not.toContain("Uses Workbox BackgroundSyncQueue");
    expect(queueSource).not.toContain("sync after browser close");
    expect(queueSource).not.toContain("sync to happen even if user closes the browser");
  });

  it("captures the browser install prompt before lazy settings code can mount", () => {
    const source = readSource("src/main.tsx");

    expect(source).toContain(
      'import { initializePwaInstallPromptCapture } from "./lib/pwaInstallPrompt";'
    );
    expect(source).toContain('import { IS_DESKTOP_RUNTIME } from "./lib/env";');
    expect(source).toContain(
      "if (!isNative && !IS_DESKTOP_RUNTIME) initializePwaInstallPromptCapture();"
    );
  });

  it("turns automatic reload failures into visible retry recovery without blanking startup", () => {
    const source = readSource("src/main.tsx");
    const startupRecoveryBlock = extractBlock(
      source,
      "async function ensureFreshVersionBeforeRender(): Promise<boolean> {",
      'logger.log("[Main] Version is up to date");',
    );

    expect(source).toContain("async function attemptAutomaticHardReload(");
    expect(source).toContain("reportAutomaticUpdateReloadFailure({");
    expect(source).not.toContain("void forceHardReload();");
    expect(startupRecoveryBlock).toContain(
      'const navigated = await attemptAutomaticHardReload("startup-version-check");',
    );
    expect(startupRecoveryBlock).toContain("return !navigated;");
  });

  it("keeps browser automatic-update ownership out of the Tauri desktop runtime", () => {
    const source = readSource("src/main.tsx");
    const resumeBlock = extractBlock(
      source,
      "async function handleAppResume(): Promise<void> {",
      "// Clean up stale share cache files",
    );
    const startupRecoveryBlock = extractBlock(
      source,
      "async function ensureFreshVersionBeforeRender(): Promise<boolean> {",
      'logger.log("[Main] Version is up to date");',
    );
    const scheduledCheckBlock = extractBlock(
      source,
      "function scheduleVersionCheckAfterStartup(): void {",
      "scheduleIdle(",
    );

    expect(source).toContain('if (!IS_DESKTOP_RUNTIME && "serviceWorker" in navigator) {');
    expect(resumeBlock).toContain(
      "if (!isNative && !IS_DESKTOP_RUNTIME && navigator.onLine) {",
    );
    expect(startupRecoveryBlock).toContain("if (IS_DESKTOP_RUNTIME) return true;");
    expect(scheduledCheckBlock).toContain("IS_DESKTOP_RUNTIME");
  });

  it("writes PWA lifecycle evidence only to a repository-local output path", () => {
    const source = readSource("e2e/helpers/pwa-offline/playwright.config.ts");

    expect(source).toContain("ZENFLOW_PWA_JSON_OUTPUT");
    expect(source).toContain('jsonOutput.startsWith("output/")');
    expect(source).toContain('jsonOutput.includes("..")');
    expect(source).toContain('["json", { outputFile: resolve(repoRoot, jsonOutput) }]');
    expect(source).toContain('["list"]');
  });

  it("lets quarantined other-account queue rows coexist with resume delta sync", () => {
    const source = readSource("src/main.tsx");
    const resumeBlock = extractBlock(
      source,
      "async function handleAppResume(): Promise<void> {",
      "// Clean up stale share cache files"
    );

    expect(resumeBlock).toContain("const resumeOwnerUserId = await getCurrentSessionUserId();");
    expect(resumeBlock).toContain(
      "await offlineQueue.hasPendingActionsForOwnerReady(resumeOwnerUserId)"
    );
    expect(resumeBlock).toContain("!offlineQueue.hasPendingActionsForOwner(resumeOwnerUserId)");
    expect(resumeBlock).not.toContain("offlineQueue.hasPendingActions()");
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
    expect(source).toContain(
      'pruneMacDuplicateArtifacts(ANDROID_CORDOVA_PLUGINS, "android-cordova-plugins")'
    );
    expect(source).toContain('pruneMacDuplicateArtifacts(IOS_APP, "ios-app")');
    expect(source).toContain("stripNativeManifestLink");
    expect(source).toContain("rel=[\"']manifest[\"']");
    expect(source).toContain("removed native manifest link from index.html");
    expect(source).toContain("stripNativeManifestLink();");
    expect(source).toContain("pwa-192.png is KEPT");
    expect(source).not.toContain('"pwa-192.png",');
  });

  it("cleans duplicate native artifacts again after Android Capacitor sync", () => {
    const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;

    expect(scripts["cap:sync:android"]).toContain("npx cap sync android &&");
    expect(scripts["cap:sync:android"]).toContain(
      "cross-env CAPACITOR_BUILD=true node scripts/capacitor-prune-assets.cjs"
    );
    expect(scripts["cap:sync:android"]).toContain("node scripts/normalize-android-config.cjs");
    expect(scripts["cap:sync:android"]).toMatch(
      /npx cap sync android && cross-env CAPACITOR_BUILD=true node scripts\/capacitor-prune-assets\.cjs && node scripts\/normalize-android-config\.cjs/
    );
  });

  it("applies native cleanup and platform config normalization after all-platform Capacitor sync", () => {
    const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;

    expect(scripts["cap:sync"]).toContain("npx cap sync &&");
    expect(scripts["cap:sync"]).toContain(
      "cross-env CAPACITOR_BUILD=true node scripts/capacitor-prune-assets.cjs"
    );
    expect(scripts["cap:sync"]).toContain("node scripts/normalize-android-config.cjs");
    expect(scripts["cap:sync"]).toContain("node scripts/normalize-ios-config.cjs");
    expect(scripts["cap:sync"]).toContain("node scripts/normalize-ios-spm.cjs");
    expect(scripts["cap:sync"]).toMatch(
      /npx cap sync && cross-env CAPACITOR_BUILD=true node scripts\/capacitor-prune-assets\.cjs && node scripts\/normalize-android-config\.cjs && node scripts\/normalize-ios-config\.cjs && node scripts\/normalize-ios-spm\.cjs/
    );
  });

  it("cleans duplicate native artifacts and normalizes iOS config after Capacitor sync", () => {
    const scripts = JSON.parse(readSource("package.json")).scripts as Record<string, string>;

    expect(scripts["cap:sync:ios"]).toContain("npx cap sync ios &&");
    expect(scripts["cap:sync:ios"]).toContain(
      "cross-env CAPACITOR_BUILD=true node scripts/capacitor-prune-assets.cjs"
    );
    expect(scripts["cap:sync:ios"]).toContain("node scripts/normalize-ios-config.cjs");
    expect(scripts["cap:sync:ios"]).toMatch(
      /npx cap sync ios && cross-env CAPACITOR_BUILD=true node scripts\/capacitor-prune-assets\.cjs && node scripts\/normalize-ios-config\.cjs && node scripts\/normalize-ios-spm\.cjs/
    );

    const normalizer = readSource("scripts/normalize-ios-config.cjs");
    expect(normalizer).toContain("ALLOWED_ACCESS_ORIGINS");
    expect(normalizer).toContain("https://*.supabase.co");
    expect(normalizer).toContain("https://api.zenflowapp.online");
    expect(normalizer).toContain("https://cdn.pixabay.com");
    expect(normalizer).toContain("https://*.sentry.io");
    expect(normalizer).not.toContain('origin="*"');
  });

  it("sanitizes iOS app bundle extended attributes after resources copy before code signing", () => {
    const project = readSource("ios/App/App.xcodeproj/project.pbxproj");
    const targetBlock = extractBlock(
      project,
      "buildPhases = (\n\t\t\t\t7D20A1B62F92000100AA0001 /* Verify Release AdMob App ID */,",
      "\n\t\t\t);"
    );

    expect(project).toContain("Sanitize App Bundle Extended Attributes");
    expect(project).toContain('APP_BUNDLE=\\"$TARGET_BUILD_DIR/$WRAPPER_NAME\\"');
    expect(project).toContain('xattr -cr \\"$APP_BUNDLE\\"');
    expect(targetBlock.indexOf("504EC3021FED79650016851F /* Resources */")).toBeLessThan(
      targetBlock.indexOf("Sanitize App Bundle Extended Attributes")
    );
  });

  it("does not expose Android-only diary screenshot blocking on iOS", () => {
    const hookSource = readSource("src/features/journal/useScreenSecurity.ts");
    const moduleSource = readSource("src/features/journal/JournalModule.tsx");

    expect(hookSource).toContain("import { isAndroid }");
    expect(hookSource).toContain("const isSupported = isAndroid;");
    expect(hookSource).toContain("if (!isSupported || !enabled || !journalOpen) return;");
    expect(hookSource).toContain(
      "return { enabled: isSupported ? enabled : false, setEnabled, isSupported };"
    );
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

  it("keeps the production PWA service worker registration injected", () => {
    const source = readSource("vite.config.ts");

    expect(source).toContain('strategies: "injectManifest"');
    expect(source).toContain('registerType: "autoUpdate"');
    expect(source).toContain('injectRegister: "script-defer"');
    expect(source).toContain('"registerSW.js"');
  });

  it("disables the development service worker so strict CSP cannot receive the inline bootstrap", () => {
    const source = readSource("vite.config.ts");

    expect(source).toContain("enabled: false");
    expect(source).not.toContain('enabled: mode === "development"');
    expect(source).not.toContain("VITE_ENABLE_PWA_DEV");
  });

  it("keeps desktop diary rail and stats controls at least 44px", () => {
    const moodDotStrip = readSource("src/features/journal/MoodDotStrip.tsx");
    const journalStats = readSource("src/features/journal/JournalStats.tsx");

    expect(moodDotStrip).toContain("const DOT_ITEM_HEIGHT = 48;");
    expect(moodDotStrip).toContain("const totalHeight = railEntries.length * DOT_ITEM_HEIGHT;");
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
      "\n});"
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
      "\n}"
    );
    const yieldCount = (resumeBlock.match(/await yieldToNextTask\(\);/g) ?? []).length;

    expect(source).toContain("function yieldToNextTask");
    expect(yieldCount).toBeGreaterThanOrEqual(3);
    expect(resumeBlock.indexOf("await yieldToNextTask();")).toBeLessThan(
      resumeBlock.indexOf("await resumeAllAudio();")
    );
    expect(resumeBlock.lastIndexOf("await yieldToNextTask();")).toBeLessThan(
      resumeBlock.indexOf("if (navigator.onLine)")
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
