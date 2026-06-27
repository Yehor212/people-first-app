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
      start_url: "/people-first-app/",
      scope: "/people-first-app/",
      display: "standalone",
      icons: expect.arrayContaining([
        expect.objectContaining({ src: `pwa-192.png?v=${iconRevision}` }),
        expect.objectContaining({ src: `pwa-maskable-512.png?v=${iconRevision}` }),
      ]),
    });
  });
});
