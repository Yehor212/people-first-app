import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("audio blind-spot release contracts", () => {
  it("declares microphone purpose strings for iOS and macOS desktop bundles", () => {
    const iosInfo = read("ios/App/App/Info.plist");
    const macosInfo = read("src-tauri/Info.plist");

    expect(iosInfo).toContain("NSMicrophoneUsageDescription");
    expect(macosInfo).toContain("NSMicrophoneUsageDescription");
    expect(macosInfo).toContain("journal audio recordings and voice dictation");
  });

  it("allows first-party journal voice recording while keeping other sensitive APIs denied", () => {
    const index = read("index.html");

    expect(index).toContain("Permissions-Policy");
    expect(index).toContain("microphone=(self)");
    expect(index).toContain("camera=()");
    expect(read("src/features/journal/useAudioRecorder.ts")).toContain("navigator.mediaDevices.getUserMedia");
  });

  it("caches shipped app audio for installed PWA offline reuse with bounded quota", () => {
    const serviceWorker = read("src/sw.ts");
    const cacheContract = read("src/lib/runtimeAudioCache.ts");

    expect(serviceWorker).toContain("RUNTIME_AUDIO_CACHE_NAME");
    expect(serviceWorker).toContain(
      "isRuntimeAudioPath(url.pathname, request.destination)",
    );
    expect(cacheContract).toContain('destination === "audio"');
    expect(cacheContract).toContain('localPath.includes("/sounds/")');
    expect(serviceWorker).toContain("maxEntries: 32");
    expect(serviceWorker).toContain("purgeOnQuotaError: true");
  });

  it("retires only the stale pre-v2 audio cache during service-worker activation", () => {
    const serviceWorker = read("src/sw.ts");
    const cacheContract = read("src/lib/runtimeAudioCache.ts");

    expect(cacheContract).toContain('RUNTIME_AUDIO_CACHE_NAME = "zenflow-runtime-audio-v2"');
    expect(cacheContract).toContain('"zenflow-runtime-audio"');
    expect(serviceWorker).toContain("selectRetiredRuntimeAudioCaches");
    expect(serviceWorker).toContain("caches.delete(cacheName)");
    expect(serviceWorker).not.toContain('caches.delete("zenflow-runtime-assets")');
  });


  it("serves shipped PWA audio from a full-response-backed range-aware cache", () => {
    const serviceWorker = read("src/sw.ts");
    const cacheContract = read("src/lib/runtimeAudioCache.ts");
    const appAudioAssets = read("src/lib/appAudioAssets.ts");
    const hyperfocusManifest = read("src/lib/hyperfocusGeneratedAudioManifest.ts");
    const cloudlightStart = appAudioAssets.indexOf('"cloudlight-evening-loop"');
    const cloudlightEntry = appAudioAssets.slice(
      cloudlightStart,
      appAudioAssets.indexOf("),", cloudlightStart) + 2,
    );

    expect(serviceWorker).toContain('workbox-range-requests');
    expect(serviceWorker).toContain('new RangeRequestsPlugin()');
    expect(serviceWorker).toContain('workbox-cacheable-response');
    expect(serviceWorker).toContain('new CacheableResponsePlugin');
    expect(serviceWorker).toContain('statuses: [200]');
    expect(serviceWorker).not.toContain('statuses: [200, 206]');
    expect(serviceWorker).toContain('APP_AUDIO_SW_CACHE_PATHS');
    expect(serviceWorker).toContain('warmRuntimeAudioCache');
    expect(cacheContract).toContain(
      'APP_AUDIO_ASSETS.filter((asset) => asset.warmCacheOnStartup).map',
    );
    expect(cacheContract).toContain('APP_AUDIO_FEEDBACK_EVENTS.map');
    expect(cacheContract).toContain('HYPERFOCUS_GENERATED_AUDIO_MANIFEST');
    expect(appAudioAssets).toContain('sounds/soft-air-veil.mp3');
    expect(cloudlightStart).toBeGreaterThanOrEqual(0);
    expect(cloudlightEntry).toContain("false");
    expect(appAudioAssets).toContain('sounds/gentle-water-bed.mp3');
    expect(appAudioAssets).toContain('sounds/soft-rain-veil.mp3');
    expect(appAudioAssets).toContain('makeFeedbackEvent("success"');
    expect(appAudioAssets).toContain('makeFeedbackEvent("complete"');
    expect(appAudioAssets).toContain('makeFeedbackEvent("streak"');
    expect(appAudioAssets).toContain('makeFeedbackEvent("milestone"');
    expect(appAudioAssets).toContain('makeFeedbackEvent("notification"');
    expect(hyperfocusManifest).toContain('sounds/hyperfocus/hyperfocus-forest-soft.mp3');
    expect(hyperfocusManifest).toContain('sounds/hyperfocus/hyperfocus-wind-intense.mp3');
  });

  it("keeps shipped audio cache warming out of the blocking service-worker install path", () => {
    const serviceWorker = read("src/sw.ts");
    const mainEntry = read("src/main.tsx");
    const installListener =
      serviceWorker.match(/self\.addEventListener\("install", \(event\) => \{[\s\S]*?\n\}\);/)?.[0] ??
      "";

    expect(installListener).toContain("self.skipWaiting()");
    expect(installListener).not.toContain("warmRuntimeAudioCache");
    expect(serviceWorker).toContain('"WARM_RUNTIME_AUDIO_CACHE"');
    expect(serviceWorker).toContain("AUDIO_CACHE_WARM_CONCURRENCY");
    expect(serviceWorker).toContain("AUDIO_CACHE_WARM_FETCH_TIMEOUT_MS");
    expect(serviceWorker).toContain("event.waitUntil(warmRuntimeAudioCacheOnce())");
    expect(mainEntry).toContain('"WARM_RUNTIME_AUDIO_CACHE"');
    expect(mainEntry).toContain("scheduleRuntimeAudioCacheWarmAfterStartup");
    expect(mainEntry).toContain("scheduleIdle(");
  });

  it("only warms shipped audio after startup when network and app context make it low-risk", () => {
    const mainEntry = read("src/main.tsx");

    expect(mainEntry).toContain("shouldWarmRuntimeAudioCacheAfterStartup");
    expect(mainEntry).toContain("getRuntimeAudioConnection");
    expect(mainEntry).toContain("connection?: NetworkConnectionLike");
    expect(mainEntry).toContain("saveData");
    expect(mainEntry).toContain("effectiveType");
    expect(mainEntry).toContain("(display-mode: standalone)");
    expect(mainEntry).toContain('"audioCacheWarm"');
    expect(mainEntry).toContain("if (!shouldWarmRuntimeAudioCacheAfterStartup()) return;");
  });

  it("bounds service-worker navigation fetches before falling back to the app shell", () => {
    const serviceWorker = read("src/sw.ts");

    expect(serviceWorker).toContain("NAVIGATION_NETWORK_TIMEOUT_MS");
    expect(serviceWorker).toContain("fetchNavigationWithTimeout");
    expect(serviceWorker).toContain("new AbortController()");
    expect(serviceWorker).toContain("signal: controller.signal");
    expect(serviceWorker).toContain("self.setTimeout(() => controller.abort(), NAVIGATION_NETWORK_TIMEOUT_MS)");
    expect(serviceWorker).toContain("self.clearTimeout(timeoutId)");
    expect(serviceWorker).toContain("return await fetchNavigationWithTimeout(request)");
  });

  it("keeps first-party app audio elements compatible with service-worker cached media", () => {
    const audioSurfaces = [
      read("src/components/auth-screen/AuthScreen.tsx"),
      read("src/pages/nav-v2/OrbAmbienceControl.tsx"),
      read("src/features/journal/JournalAmbienceSetting.tsx"),
      read("src/lib/ambientSounds.ts"),
    ];

    for (const source of audioSurfaces) {
      expect(source).toContain('crossOrigin');
    }
  });

  it("wires the audio guard into local CI, deploy CI, and drift checks", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const deployWorkflow = read(".github/workflows/deploy.yml");
    const driftWorkflow = read(".github/workflows/drift-checks.yml");

    expect(packageJson.scripts["ci:preflight"]).toContain("npm run check:app-audio");
    expect(packageJson.scripts["check:hyperfocus-audio"]).toBe("node scripts/check-hyperfocus-audio-assets.cjs");
    expect(packageJson.scripts["ci:preflight"]).toContain("npm run check:hyperfocus-audio");
    expect(deployWorkflow).toContain("npm run check:app-audio");
    expect(driftWorkflow).toContain("'public/sounds/**'");
    expect(driftWorkflow).toContain("'docs/audio/**'");
    expect(driftWorkflow).toContain("name: app-audio");
    expect(driftWorkflow).toContain("cmd: npm run check:app-audio");
  });

  it("keeps third-party notices aligned with the current BigSoundBank CC0 Hyperfocus runtime", () => {
    const notices = read("THIRD_PARTY_NOTICES.md");

    expect(notices).toContain("First-party generated audio");
    expect(notices).toContain("scripts/generate-non-hyperfocus-audio.cjs");
    expect(notices).toContain("lamejs");
    expect(notices).not.toContain("MixKit — Hyperfocus Nature Sound Effects");
    expect(notices).toContain("BigSoundBank / LaSonotheque — Hyperfocus CC0 Nature Sound Effects");
    expect(notices).toContain("src/lib/hyperfocusGeneratedAudioManifest.ts");
    expect(notices).toContain("docs/audio/hyperfocus-generated-audio-provenance.json");
    expect(notices).toContain("docs/audio/hyperfocus-runtime-v2-manifest.json");
    expect(notices).toContain("https://bigsoundbank.com/licenses.html");
    expect(notices).not.toContain("mixkit-small-waves-harbor-rocks-1208.wav");
  });

  it("keeps public privacy copy aligned with microphone, sync, ads, crash, and current app-audio surfaces", () => {
    const privacyCopies = [
      read("public/privacy.html"),
      read("public/privacy-policy.html"),
      read("docs/privacy-policy.html"),
    ];

    for (const privacy of privacyCopies) {
      expect(privacy).toContain("speech recognition");
      expect(privacy).toContain("browser or operating system");
      expect(privacy).toContain("processed outside ZenFlow");
    }

    const privacy = privacyCopies[0];

    expect(privacy).toContain("Microphone and journal audio recordings");
    expect(privacy).toContain("Supabase");
    expect(privacy).toContain("AdMob");
    expect(privacy).toContain("Sentry");
    expect(privacy).toContain("App Audio");
    expect(privacy).not.toContain("Audio comfort feedback");
    expect(privacy).not.toContain("Any data to external servers");
    expect(privacy).not.toContain("Usage analytics or tracking data</li>");
  });
});
