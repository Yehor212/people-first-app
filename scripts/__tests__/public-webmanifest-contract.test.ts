import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicManifestPath = "public/manifest.webmanifest";
const docsManifestPath = "docs/manifest.webmanifest";
const brandLogoAssetsPath = "config/brand-logo-assets.json";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("public web manifest contract", () => {
  it("serves a real JSON manifest from public so local review routes do not return SPA HTML", () => {
    expect(existsSync(publicManifestPath)).toBe(true);
    expect(existsSync(docsManifestPath)).toBe(true);

    const publicManifestText = readFileSync(publicManifestPath, "utf8");
    expect(publicManifestText.trim().startsWith("{")).toBe(true);
    expect(publicManifestText).not.toContain("<!DOCTYPE html>");

    const publicManifest = readJson(publicManifestPath);
    const docsManifest = readJson(docsManifestPath);
    const brandLogoAssets = readJson(brandLogoAssetsPath);
    const iconRevision = brandLogoAssets.pwaInstallIconRevision;
    expect(publicManifest).toEqual(docsManifest);
    expect(publicManifest).toMatchObject({
      name: "ZenFlow - Daily Wellness",
      short_name: "ZenFlow",
      description:
        "Habit, mood and productivity tracker. Previously opened areas can work offline; some features need internet.",
      start_url: "/people-first-app/",
      scope: "/people-first-app/",
      display: "standalone",
      icons: expect.arrayContaining([
        expect.objectContaining({ src: `pwa-192.png?v=${iconRevision}` }),
        expect.objectContaining({ src: `pwa-maskable-512.png?v=${iconRevision}` }),
        expect.objectContaining({
          src: `pwa-maskable-1024.png?v=${iconRevision}`,
          sizes: "1024x1024",
          purpose: "maskable",
        }),
      ]),
    });
    expect(publicManifest).not.toHaveProperty("orientation");
    expect(JSON.stringify(publicManifest)).not.toContain("Works offline");
    expect(readFileSync("vite.config.ts", "utf8")).not.toContain("Works offline");
    expect(readFileSync("scripts/generate-icons.cjs", "utf8")).not.toContain("Works offline");
  });
  it("lets installed PWA shortcuts choose the responsive layout for their window", () => {
    const publicManifest = readJson(publicManifestPath) as {
      shortcuts?: Array<{ name?: string; url?: string }>;
    };
    const docsManifest = readJson(docsManifestPath) as {
      shortcuts?: Array<{ name?: string; url?: string }>;
    };
    const viteConfig = readFileSync("vite.config.ts", "utf8");
    const iconGenerator = readFileSync("scripts/generate-icons.cjs", "utf8");

    for (const manifest of [publicManifest, docsManifest]) {
      expect(manifest.shortcuts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Log Mood", url: "/people-first-app/orb/?nav=v2" }),
          expect.objectContaining({ name: "Track Habit", url: "/people-first-app/habits/?nav=v2" }),
        ]),
      );
      expect(JSON.stringify(manifest.shortcuts)).not.toContain("?tab=home");
      expect(JSON.stringify(manifest.shortcuts)).not.toContain("navLayout");
    }

    expect(viteConfig).toContain('url: `${base}orb/?nav=v2`');
    expect(viteConfig).toContain('url: `${base}habits/?nav=v2`');
    expect(
      viteConfig.match(
        /\{ src: pwaIconSrc\("pwa-192\.png"\), sizes: "192x192", type: "image\/png" \}/g,
      ),
    ).toHaveLength(2);
    expect(viteConfig).not.toContain("?tab=home");
    expect(viteConfig).not.toContain("navLayout=phone");
    expect(iconGenerator).toContain("${DOCS_PWA_BASE}orb/?nav=v2");
    expect(iconGenerator).toContain("${DOCS_PWA_BASE}habits/?nav=v2");
    expect(iconGenerator).not.toContain("?tab=home");
    expect(iconGenerator).not.toContain("navLayout=phone");
  });
});
