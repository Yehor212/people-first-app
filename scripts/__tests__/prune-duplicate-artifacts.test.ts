import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const require = createRequire(import.meta.url);
  const {
    findDuplicateArtifactCandidates,
    findDuplicateArtifacts,
    pruneDuplicateArtifacts,
    pruneDuplicateArtifactsUntilSettled,
    runCli,
    verifyNoDuplicateArtifacts,
  } = require("../prune-duplicate-artifacts.cjs") as {
    findDuplicateArtifactCandidates: (root: string) => string[];
    findDuplicateArtifacts: (root: string) => string[];
    pruneDuplicateArtifacts: (root: string) => { removed: number };
    pruneDuplicateArtifactsUntilSettled: (
      root: string,
      options?: { passes?: number; delayMs?: number },
    ) => { removed: number; passes: number };
    runCli: (argv?: string[]) => { removed: number };
    verifyNoDuplicateArtifacts: (root: string) => { duplicates: string[] };
  };

const tempRoots: string[] = [];

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "zenflow-prune-duplicates-"));
  tempRoots.push(root);
  return root;
}

function repoFixtureRoot() {
  const root = mkdtempSync(join(process.cwd(), "output", "zenflow-prune-duplicates-"));
  tempRoots.push(root);
  return root;
}

function writeFixture(root: string, relPath: string) {
  const absPath = join(root, relPath);
  mkdirSync(join(absPath, ".."), { recursive: true });
  writeFileSync(absPath, relPath);
  return absPath;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("pruneDuplicateArtifacts", () => {
  it("removes Finder-style duplicate artifacts while keeping canonical generated assets", () => {
    const root = fixtureRoot();
    const canonicalScript = writeFixture(root, "assets/index.js");
    const canonicalBrotli = writeFixture(root, "assets/index.js.br");
    const canonicalDirFile = writeFixture(root, "assets/chunk/index.js");
    const canonicalIcon = writeFixture(root, "pwa-512.png");
    const canonicalVersion = writeFixture(root, "version2.json");
    const duplicateScript = writeFixture(root, "assets/index 2.js");
    const duplicateBrotli = writeFixture(root, "assets/index.js 2.br");
    const duplicateIcon = writeFixture(root, "pwa-512 3.png");
    const duplicateDirFile = writeFixture(root, "assets/chunk 2/ignored.js");

    expect(
      findDuplicateArtifacts(root).map((entry: string) => relative(root, entry)).sort(),
    ).toEqual([
      "assets/chunk 2",
      "assets/index 2.js",
      "assets/index.js 2.br",
      "pwa-512 3.png",
    ]);

    const result = pruneDuplicateArtifacts(root);

    expect(result.removed).toBe(4);
    expect(existsSync(canonicalScript)).toBe(true);
    expect(existsSync(canonicalBrotli)).toBe(true);
    expect(existsSync(canonicalDirFile)).toBe(true);
    expect(existsSync(canonicalIcon)).toBe(true);
    expect(existsSync(canonicalVersion)).toBe(true);
    expect(existsSync(duplicateScript)).toBe(false);
    expect(existsSync(duplicateBrotli)).toBe(false);
    expect(existsSync(duplicateIcon)).toBe(false);
    expect(existsSync(duplicateDirFile)).toBe(false);
    expect(findDuplicateArtifacts(root)).toEqual([]);
  });

  it("removes unmatched space-number generated artifacts so verify can settle", () => {
    const root = fixtureRoot();
    const staleStandalone = writeFixture(root, "release notes 2.txt");
    const duplicateScript = writeFixture(root, "assets/index 2.js");
    writeFixture(root, "assets/index.js");

    const result = pruneDuplicateArtifacts(root);

    expect(result.removed).toBe(2);
    expect(existsSync(staleStandalone)).toBe(false);
    expect(existsSync(duplicateScript)).toBe(false);
    expect(findDuplicateArtifactCandidates(root)).toEqual([]);
  });

  it("fails verification when duplicate artifacts remain", () => {
    const root = fixtureRoot();
    writeFixture(root, "assets/index.js");
    writeFixture(root, "assets/index 2.js");

    expect(() => verifyNoDuplicateArtifacts(root)).toThrow(
      "Duplicate generated artifact(s) remain",
    );
  });

  it("keeps --verify as a pure non-mutating gate", () => {
    const root = repoFixtureRoot();
    const duplicate = writeFixture(root, "assets/index 2.js");
    writeFixture(root, "assets/index.js");

    expect(() => runCli([relative(process.cwd(), root), "--verify", "--passes=1", "--delay=1"])).toThrow(
      "Duplicate generated artifact(s) remain",
    );
    expect(existsSync(duplicate)).toBe(true);
  });

  it("does not burn every macOS settle pass when the artifact is already clean", () => {
    const root = fixtureRoot();
    writeFixture(root, "assets/index.js");

    expect(pruneDuplicateArtifactsUntilSettled(root, { passes: 24, delayMs: 1 })).toEqual({
      removed: 0,
      passes: 1,
    });
  });
});
