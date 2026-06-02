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
