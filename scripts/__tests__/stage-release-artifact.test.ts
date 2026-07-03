import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const require = createRequire(import.meta.url);
const { stageReleaseArtifact } = require("../stage-release-artifact.cjs") as {
  stageReleaseArtifact: (
    source: string,
    target: string,
    options?: { allowedRoot?: string; passes?: number; delayMs?: number },
  ) => { copied: number; target: string };
};
const { findDuplicateArtifactCandidates } = require("../prune-duplicate-artifacts.cjs") as {
  findDuplicateArtifactCandidates: (root: string) => string[];
};

const tempRoots: string[] = [];

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
  writeFixture(root, "index.html");
  writeFixture(root, "manifest.webmanifest");
  writeFixture(root, "registerSW.js");
  writeFixture(root, "sw.js", 'precacheAndRoute([{url:"/people-first-app/index.html",revision:"1"}],{});');
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("stageReleaseArtifact", () => {
  it("copies a cleaned release artifact into a nosync staging directory", () => {
    const root = fixtureRoot();
    const source = join(root, "dist");
    const target = join(root, "output", "pages-artifact.nosync");
    writeMinimalPwaArtifact(source);
    const canonical = writeFixture(source, "assets/index.js");
    writeFixture(source, ".nojekyll");

    const result = stageReleaseArtifact(source, target, { allowedRoot: root, passes: 1, delayMs: 1 });

    expect(result.copied).toBeGreaterThan(0);
    expect(relative(root, result.target)).toBe("output/pages-artifact.nosync");
    expect(existsSync(canonical)).toBe(true);
    expect(existsSync(join(target, "assets", "index.js"))).toBe(true);
    expect(existsSync(join(target, ".nojekyll"))).toBe(true);
    expect(findDuplicateArtifactCandidates(target)).toEqual([]);
  });

  it("settles dirty generated source artifacts before staging", () => {
    const root = fixtureRoot();
    const source = join(root, "dist");
    const target = join(root, "output", "pages-artifact.nosync");
    writeMinimalPwaArtifact(source);
    const duplicate = writeFixture(source, "assets/index 2.js");
    writeFixture(source, "assets/index.js");

    stageReleaseArtifact(source, target, { allowedRoot: root, passes: 1, delayMs: 1 });

    expect(existsSync(duplicate)).toBe(false);
    expect(existsSync(join(target, "assets", "index.js"))).toBe(true);
    expect(findDuplicateArtifactCandidates(source)).toEqual([]);
    expect(findDuplicateArtifactCandidates(target)).toEqual([]);
  });

  it("replaces stale staged artifacts before copying", () => {
    const root = fixtureRoot();
    const source = join(root, "dist");
    const target = join(root, "output", "pages-artifact.nosync");
    writeMinimalPwaArtifact(source);
    writeFixture(target, "stale.js");

    stageReleaseArtifact(source, target, { allowedRoot: root, passes: 1, delayMs: 1 });

    expect(existsSync(join(target, "index.html"))).toBe(true);
    expect(existsSync(join(target, "stale.js"))).toBe(false);
  });

  it("rejects staging from inside the target before deleting anything", () => {
    const root = fixtureRoot();
    const target = join(root, "output", "pages-artifact.nosync");
    const source = join(target, "dist");
    const sourceIndex = writeFixture(source, "index.html");
    writeFixture(source, "manifest.webmanifest");
    writeFixture(source, "registerSW.js");
    writeFixture(source, "sw.js", 'precacheAndRoute([{url:"/people-first-app/index.html",revision:"1"}],{});');

    expect(() => stageReleaseArtifact(source, target, { allowedRoot: root, passes: 1, delayMs: 1 })).toThrow(
      "Refusing to stage release artifact from inside its target",
    );
    expect(existsSync(sourceIndex)).toBe(true);
  });
});
