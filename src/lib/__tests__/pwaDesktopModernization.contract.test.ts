import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectFile = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

describe("desktop PWA modernization characterization", () => {
  it("does not force desktop windows into portrait and publishes a 1024px maskable icon", () => {
    const manifest = JSON.parse(projectFile("public/manifest.webmanifest")) as {
      orientation?: string;
      icons?: Array<{ sizes?: string; purpose?: string }>;
    };

    expect(manifest.orientation).toBeUndefined();
    expect(
      manifest.icons?.some(
        (icon) => icon.sizes === "1024x1024" && icon.purpose?.split(/\s+/).includes("maskable"),
      ),
    ).toBe(true);
  });

  it("lets desktop shortcut launches select layout from the actual window", () => {
    const manifest = JSON.parse(projectFile("public/manifest.webmanifest")) as {
      shortcuts?: Array<{ url?: string }>;
    };

    expect(manifest.shortcuts?.length).toBeGreaterThan(0);
    expect(JSON.stringify(manifest.shortcuts)).not.toContain("navLayout");
  });

  it("captures beforeinstallprompt before lazy settings code mounts", () => {
    const mainSource = projectFile("src/main.tsx");

    expect(mainSource).toContain("initializePwaInstallPromptCapture");
    expect(mainSource.indexOf("initializePwaInstallPromptCapture();")).toBeLessThan(
      mainSource.indexOf("createRoot("),
    );
  });

  it("keeps every literal runtime cache inside the ZenFlow namespace", () => {
    const workerSource = projectFile("src/sw.ts");
    const literalCacheNames = [
      ...workerSource.matchAll(/\bcacheName:\s*["']([^"']+)["']/g),
      ...workerSource.matchAll(/\bconst\s+\w*CACHE\w*\s*=\s*["']([^"']+)["']/g),
    ].map((match) => match[1]);

    expect(literalCacheNames.length).toBeGreaterThan(0);
    expect(literalCacheNames.every((cacheName) => cacheName.startsWith("zenflow-"))).toBe(true);
  });
});
