import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const require = createRequire(import.meta.url);
const prepareScriptPath = join(process.cwd(), "scripts", "prepare-pages-artifact.cjs");
const { stageReleaseArtifact } = require("../stage-release-artifact.cjs") as {
  stageReleaseArtifact: (
    source: string,
    target: string,
    options?: {
      allowedRoot?: string;
      passes?: number;
      delayMs?: number;
      stablePasses?: number;
      minimumPasses?: number;
    }
  ) => { copied: number; target: string };
};
const { findDuplicateArtifactCandidates } = require("../prune-duplicate-artifacts.cjs") as {
  findDuplicateArtifactCandidates: (root: string, options: { allowedRoot: string }) => string[];
};
const { computeWorkboxRevision } = require("../check-release-artifact-integrity.cjs") as {
  computeWorkboxRevision: (content: string | Uint8Array) => string;
};

const tempRoots: string[] = [];
const { pwaInstallIconRevision } = JSON.parse(
  readFileSync("config/brand-logo-assets.json", "utf8")
) as { pwaInstallIconRevision: string };
const directRoutes = ["orb", "habits", "diary", "planning", "settings", "desktop"];
const preparedIndexHtml =
  "<!doctype html><html><head>" +
  `<link rel="manifest" href="/people-first-app/manifest.webmanifest?v=${pwaInstallIconRevision}">` +
  '</head><body><div id="root"></div></body></html>';

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "zenflow-stage-release-"));
  tempRoots.push(root);
  return root;
}

function writeFixture(root: string, relPath: string, content = relPath) {
  const absPath = join(root, relPath);
  mkdirSync(join(absPath, ".."), { recursive: true });
  writeFileSync(absPath, content);
  return absPath;
}

function writeMinimalPwaArtifact(root: string) {
  writeFixture(root, "index.html", preparedIndexHtml);
  for (const route of directRoutes) {
    writeFixture(root, `${route}/index.html`, preparedIndexHtml);
  }
  writeFixture(root, "manifest.webmanifest");
  writeFixture(root, "registerSW.js");
  const indexRevision = computeWorkboxRevision(preparedIndexHtml);
  writeFixture(
    root,
    "sw.js",
    `precacheAndRoute([{url:"/people-first-app/index.html",revision:"${indexRevision}"}],{});`
  );
}

function prepareArtifact(repositoryRoot: string) {
  const result = spawnSync(process.execPath, [prepareScriptPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("stageReleaseArtifact", () => {
  const onePassOptions = {
    passes: 1,
    delayMs: 1,
    stablePasses: 1,
    minimumPasses: 1,
  };
  const settleAfterMutationOptions = {
    ...onePassOptions,
    passes: 2,
  };

  it("copies a cleaned release artifact into a nosync staging directory", () => {
    const root = fixtureRoot();
    const source = join(root, "dist");
    const target = join(root, "output", "pages-artifact.nosync");
    writeMinimalPwaArtifact(source);
    const canonical = writeFixture(source, "assets/index.js");
    writeFixture(source, ".nojekyll");
    const internalBuildManifest = writeFixture(
      source,
      ".zenflow-ratchet-production-web-manifest.json",
      "{}"
    );
    prepareArtifact(root);

    const result = stageReleaseArtifact(source, target, { allowedRoot: root, ...onePassOptions });

    expect(result.copied).toBeGreaterThan(0);
    expect(relative(root, result.target)).toBe("output/pages-artifact.nosync");
    expect(existsSync(canonical)).toBe(true);
    expect(existsSync(internalBuildManifest)).toBe(true);
    expect(existsSync(join(target, "assets", "index.js"))).toBe(true);
    expect(existsSync(join(target, ".nojekyll"))).toBe(true);
    expect(existsSync(join(target, ".zenflow-ratchet-production-web-manifest.json"))).toBe(false);
    expect(existsSync(join(target, ".zenflow-prepared-pages-artifact-manifest.json"))).toBe(false);
    expect(findDuplicateArtifactCandidates(target, { allowedRoot: root })).toEqual([]);
  });

  it("rejects a generated source artifact changed after preparation", () => {
    const root = fixtureRoot();
    const source = join(root, "dist");
    const target = join(root, "output", "pages-artifact.nosync");
    writeMinimalPwaArtifact(source);
    writeFixture(source, "assets/index.js", "same bytes");
    prepareArtifact(root);
    const duplicate = writeFixture(source, "assets/index 2.js", "same bytes");

    expect(() =>
      stageReleaseArtifact(source, target, {
        allowedRoot: root,
        ...settleAfterMutationOptions,
      })
    ).toThrow("Prepared Pages artifact manifest does not match current artifact files");
    expect(existsSync(duplicate)).toBe(true);
    expect(existsSync(target)).toBe(false);
  });

  it("replaces stale staged artifacts before copying", () => {
    const root = fixtureRoot();
    const source = join(root, "dist");
    const target = join(root, "output", "pages-artifact.nosync");
    writeMinimalPwaArtifact(source);
    prepareArtifact(root);
    writeFixture(target, "stale.js");

    stageReleaseArtifact(source, target, { allowedRoot: root, ...onePassOptions });

    expect(existsSync(join(target, "index.html"))).toBe(true);
    expect(existsSync(join(target, "stale.js"))).toBe(false);
  });

  it("rejects a same-path mutation of a revision-null precache asset", () => {
    const root = fixtureRoot();
    const source = join(root, "dist");
    const target = join(root, "output", "pages-artifact.nosync");
    writeMinimalPwaArtifact(source);
    const originalAsset = "original hashed asset";
    writeFixture(source, "assets/index-hash.js", originalAsset);
    const indexRevision = computeWorkboxRevision(preparedIndexHtml);
    writeFixture(
      source,
      "sw.js",
      `precacheAndRoute([{url:"/people-first-app/index.html",revision:"${indexRevision}"},{url:"assets/index-hash.js",revision:null}],{});`
    );
    prepareArtifact(root);
    writeFixture(source, "assets/index-hash.js", "mutated hashed asset!");

    expect(() =>
      stageReleaseArtifact(source, target, { allowedRoot: root, ...onePassOptions })
    ).toThrow("Prepared Pages artifact byte mismatch: assets/index-hash.js");
    expect(existsSync(target)).toBe(false);
  });

  it("rejects a source that was never sealed by Pages preparation", () => {
    const root = fixtureRoot();
    const source = join(root, "dist");
    const target = join(root, "output", "pages-artifact.nosync");
    writeMinimalPwaArtifact(source);

    expect(() =>
      stageReleaseArtifact(source, target, { allowedRoot: root, ...onePassOptions })
    ).toThrow("Prepared Pages artifact manifest is missing");
    expect(existsSync(target)).toBe(false);
  });

  it("rejects staging from inside the target before deleting anything", () => {
    const root = fixtureRoot();
    const target = join(root, "output", "pages-artifact.nosync");
    const source = join(target, "dist");
    const sourceIndex = writeFixture(source, "index.html");
    writeFixture(source, "manifest.webmanifest");
    writeFixture(source, "registerSW.js");
    writeFixture(
      source,
      "sw.js",
      'precacheAndRoute([{url:"/people-first-app/index.html",revision:"1"}],{});'
    );

    expect(() =>
      stageReleaseArtifact(source, target, { allowedRoot: root, ...onePassOptions })
    ).toThrow("Refusing to stage release artifact from inside its target");
    expect(existsSync(sourceIndex)).toBe(true);
  });
});
