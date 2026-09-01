import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from "node:zlib";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const scriptPath = resolve("scripts/prepare-pages-artifact.cjs");
const require = createRequire(import.meta.url);
const { computeWorkboxRevision } = require("../check-release-artifact-integrity.cjs") as {
  computeWorkboxRevision: (content: string | Uint8Array) => string;
};
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function manifestLinkCount(html: string): number {
  return html.match(/<link\s+rel=["']manifest["'][^>]*>/gi)?.length ?? 0;
}

describe("prepare Pages artifact", () => {
  it("keeps plain, gzip, Brotli, and direct-route HTML on the same cache-busted manifest", () => {
    const root = mkdtempSync(join(tmpdir(), "zenflow-pages-prepare-"));
    tempRoots.push(root);
    const indexPath = join(root, "dist", "index.html");
    mkdirSync(dirname(indexPath), { recursive: true });
    const original = [
      "<!doctype html>",
      "<html><head>",
      '  <link rel="manifest" href="/people-first-app/manifest.webmanifest">',
      '  <link rel="manifest" href="/people-first-app/manifest.webmanifest?old=1">',
      '  <script id="vite-plugin-pwa:register-sw"></script>',
      "</head><body></body></html>",
    ].join("\n");
    writeFileSync(indexPath, original);
    writeFileSync(`${indexPath}.gz`, gzipSync(original));
    writeFileSync(`${indexPath}.br`, brotliCompressSync(original));
    const oldRevision = computeWorkboxRevision(original);
    writeFileSync(
      join(root, "dist", "sw.js"),
      `precacheAndRoute([{"revision":"${oldRevision}","url":"index.html"}],{});`
    );
    writeFileSync(join(root, "dist", "assets.js"), "prepared artifact bytes");

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);

    const prepared = readFileSync(indexPath, "utf8");
    expect(manifestLinkCount(prepared)).toBe(1);
    expect(prepared).toContain("manifest.webmanifest?v=");
    expect(gunzipSync(readFileSync(`${indexPath}.gz`)).toString("utf8")).toBe(prepared);
    expect(brotliDecompressSync(readFileSync(`${indexPath}.br`)).toString("utf8")).toBe(prepared);
    const preparedRevision = computeWorkboxRevision(prepared);
    const serviceWorker = readFileSync(join(root, "dist", "sw.js"), "utf8");
    expect(serviceWorker).toContain(`{"revision":"${preparedRevision}","url":"index.html"}`);
    expect(serviceWorker).not.toContain(oldRevision);

    for (const route of ["orb", "habits", "diary", "planning", "settings", "desktop"]) {
      expect(readFileSync(join(root, "dist", route, "index.html"), "utf8")).toBe(prepared);
    }

    const preparedManifestPath = join(
      root,
      "dist",
      ".zenflow-prepared-pages-artifact-manifest.json"
    );
    expect(existsSync(preparedManifestPath)).toBe(true);
    const preparedManifest = JSON.parse(readFileSync(preparedManifestPath, "utf8")) as {
      schemaVersion: number;
      producer: string;
      files: Array<{ path: string; sizeBytes: number; mode: string; sha256: string }>;
    };
    expect(preparedManifest.schemaVersion).toBe(1);
    expect(preparedManifest.producer).toBe("zenflow-prepared-pages-artifact-v1");
    expect(preparedManifest.files).toContainEqual({
      path: "assets.js",
      sizeBytes: 23,
      mode: "100644",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });
});
