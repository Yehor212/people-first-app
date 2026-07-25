import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const mutableFs = require("node:fs") as typeof import("node:fs");

interface PruneOptions {
  repositoryRoot: string;
}

interface ReadOnlyBoundaryOptions {
  allowedRoot: string;
}

interface SettleOptions extends PruneOptions {
  passes?: number | string;
  delayMs?: number | string;
  stablePasses?: number | string;
  minimumPasses?: number | string;
}

const {
  findDuplicateArtifactCandidates,
  findDuplicateArtifacts,
  hasDuplicateArtifactOrdinal,
  pruneDuplicateArtifacts,
  pruneDuplicateArtifactsUntilSettled,
  runCli,
  settleDefaultsForPlatform,
  verifyNoDuplicateArtifacts,
} = require("../prune-duplicate-artifacts.cjs") as {
  findDuplicateArtifactCandidates: (root: string, options: PruneOptions) => string[];
  findDuplicateArtifacts: (root: string, options: PruneOptions) => string[];
  hasDuplicateArtifactOrdinal: (name: string) => boolean;
  pruneDuplicateArtifacts: (root: string, options: PruneOptions) => { removed: number };
  pruneDuplicateArtifactsUntilSettled: (
    root: string,
    options: SettleOptions
  ) => { removed: number; passes: number };
  runCli: (
    argv?: string[],
    runtime?: { repositoryRoot: string; cwd: string }
  ) => { removed: number; passes: number };
  settleDefaultsForPlatform: (platform: NodeJS.Platform) => {
    passes: number;
    delayMs: number;
    stablePasses: number;
    minimumPasses: number;
  };
  verifyNoDuplicateArtifacts: (
    root: string,
    options: PruneOptions | ReadOnlyBoundaryOptions
  ) => { duplicates: string[] };
};

const tempRoots: string[] = [];
const liveChildren = new Set<ChildProcessWithoutNullStreams>();

function temporaryDirectory(prefix = "zenflow-prune-duplicates-") {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  tempRoots.push(root);
  return root;
}

function repositoryFixture() {
  const repositoryRoot = temporaryDirectory("zenflow-prune-repository-");
  const generatedRoot = join(repositoryRoot, "dist");
  mkdirSync(generatedRoot, { recursive: true });
  return {
    repositoryRoot,
    generatedRoot,
    options: { repositoryRoot },
  };
}

function writeFixture(root: string, relPath: string, contents: string | Buffer = relPath) {
  const absolutePath = join(root, relPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
  return absolutePath;
}

function spawnDelayedWrite(
  readyPath: string,
  targetPath: string,
  contents: string,
  delayMs: number
) {
  const source = [
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'fs.writeFileSync(process.env.READY_PATH, "ready");',
    "setTimeout(() => {",
    "  fs.mkdirSync(path.dirname(process.env.TARGET_PATH), { recursive: true });",
    "  fs.writeFileSync(process.env.TARGET_PATH, process.env.TARGET_CONTENTS);",
    "}, Number(process.env.WRITE_DELAY_MS));",
  ].join("\n");
  const child = spawn(process.execPath, ["-e", source], {
    env: {
      ...process.env,
      READY_PATH: readyPath,
      TARGET_PATH: targetPath,
      TARGET_CONTENTS: contents,
      WRITE_DELAY_MS: String(delayMs),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  liveChildren.add(child);
  return child;
}

function collectChild(child: ChildProcessWithoutNullStreams) {
  return new Promise<{ status: number | null; stderr: string }>((resolve, reject) => {
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (status) => {
      liveChildren.delete(child);
      resolve({ status, stderr });
    });
  });
}

async function waitForFile(filePath: string, child: ChildProcessWithoutNullStreams) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (existsSync(filePath)) return;
    if (child.exitCode !== null) {
      throw new Error(`delayed writer exited before ready: ${child.exitCode}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for delayed writer readiness");
}

afterEach(() => {
  for (const child of liveChildren) child.kill("SIGKILL");
  liveChildren.clear();
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("fail-closed duplicate artifact pruning", () => {
  it("keeps observing macOS through the full settle window that follows the reproduced 6s resurrection", () => {
    const policy = settleDefaultsForPlatform("darwin");

    expect(policy.minimumPasses).toBe(policy.passes);
    expect((policy.minimumPasses - 1) * policy.delayMs).toBeGreaterThan(6_000);
  });

  it("uses one pure Finder/FileProvider space-ordinal predicate", () => {
    expect(hasDuplicateArtifactOrdinal("index 2.js")).toBe(true);
    expect(hasDuplicateArtifactOrdinal("archive 12.tar.gz")).toBe(true);
    expect(hasDuplicateArtifactOrdinal("chunk 3")).toBe(true);
    expect(hasDuplicateArtifactOrdinal("version2.json")).toBe(false);
    expect(hasDuplicateArtifactOrdinal("index 2copy.js")).toBe(false);
    expect(hasDuplicateArtifactOrdinal("index ２.js")).toBe(false);
  });

  it("deletes byte-identical file copies and keeps canonical generated files", () => {
    const { generatedRoot, options } = repositoryFixture();
    const canonical = writeFixture(generatedRoot, "assets/index.js", "same bytes");
    const duplicate = writeFixture(generatedRoot, "assets/index 2.js", "same bytes");
    const ordinaryNumber = writeFixture(generatedRoot, "version2.json", "ordinary");

    expect(
      findDuplicateArtifacts(generatedRoot, options).map((entry: string) =>
        relative(generatedRoot, entry)
      )
    ).toEqual(["assets/index 2.js"]);
    expect(pruneDuplicateArtifacts(generatedRoot, options)).toMatchObject({ removed: 1 });
    expect(existsSync(canonical)).toBe(true);
    expect(existsSync(duplicate)).toBe(false);
    expect(existsSync(ordinaryNumber)).toBe(true);
  });

  it("deletes a recursively byte-identical directory copy", () => {
    const { generatedRoot, options } = repositoryFixture();
    writeFixture(generatedRoot, "assets/chunk/index.js", "same js");
    writeFixture(generatedRoot, "assets/chunk/nested/data.bin", Buffer.from([1, 2, 3]));
    const duplicateDirectory = join(generatedRoot, "assets/chunk 2");
    writeFixture(generatedRoot, "assets/chunk 2/index.js", "same js");
    writeFixture(generatedRoot, "assets/chunk 2/nested/data.bin", Buffer.from([1, 2, 3]));

    expect(pruneDuplicateArtifacts(generatedRoot, options)).toMatchObject({ removed: 1 });
    expect(existsSync(join(generatedRoot, "assets/chunk"))).toBe(true);
    expect(existsSync(duplicateDirectory)).toBe(false);
  });

  it("deletes a covered directory copy when the canonical directory has additional files", () => {
    const { generatedRoot, options } = repositoryFixture();
    writeFixture(generatedRoot, "assets/index.js", "same js");
    writeFixture(generatedRoot, "assets/current-only.js", "new build output");
    const duplicateDirectory = join(generatedRoot, "assets 2");
    writeFixture(generatedRoot, "assets 2/index.js", "same js");

    expect(pruneDuplicateArtifacts(generatedRoot, options)).toMatchObject({ removed: 1 });
    expect(existsSync(join(generatedRoot, "assets", "current-only.js"))).toBe(true);
    expect(existsSync(duplicateDirectory)).toBe(false);
  });

  it("throws and preserves all candidates when a file copy differs", () => {
    const { generatedRoot, options } = repositoryFixture();
    const safeDuplicate = writeFixture(generatedRoot, "assets/safe 2.js", "safe");
    writeFixture(generatedRoot, "assets/safe.js", "safe");
    const differentDuplicate = writeFixture(generatedRoot, "assets/index 2.js", "newer bytes");
    writeFixture(generatedRoot, "assets/index.js", "canonical bytes");

    expect(() => pruneDuplicateArtifacts(generatedRoot, options)).toThrow(/byte-identical/);
    expect(existsSync(safeDuplicate)).toBe(true);
    expect(existsSync(differentDuplicate)).toBe(true);
  });

  it("rolls back the whole batch when a later candidate changes after the first move", () => {
    const { generatedRoot, options } = repositoryFixture();
    const first = writeFixture(generatedRoot, "assets/a 2.js", "same-a");
    writeFixture(generatedRoot, "assets/a.js", "same-a");
    const second = writeFixture(generatedRoot, "assets/b 2.js", "same-b");
    writeFixture(generatedRoot, "assets/b.js", "same-b");
    const originalRename = mutableFs.renameSync;
    let injected = false;

    mutableFs.renameSync = ((from, to) => {
      originalRename(from, to);
      if (!injected && String(from).endsWith("a 2.js")) {
        injected = true;
        writeFileSync(second, "changed-after-first-move");
      }
    }) as typeof mutableFs.renameSync;
    try {
      expect(() => pruneDuplicateArtifacts(generatedRoot, options)).toThrow(
        /byte-identical|changed/i
      );
    } finally {
      mutableFs.renameSync = originalRename;
    }

    expect(injected).toBe(true);
    expect(existsSync(first)).toBe(true);
    expect(readFileSync(first, "utf8")).toBe("same-a");
    expect(existsSync(second)).toBe(true);
    expect(readFileSync(second, "utf8")).toBe("changed-after-first-move");
  });

  it("rolls back an earlier move when the next batch move fails", () => {
    const { generatedRoot, options } = repositoryFixture();
    const first = writeFixture(generatedRoot, "assets/a 2.js", "same-a");
    writeFixture(generatedRoot, "assets/a.js", "same-a");
    const second = writeFixture(generatedRoot, "assets/b 2.js", "same-b");
    writeFixture(generatedRoot, "assets/b.js", "same-b");
    const originalRename = mutableFs.renameSync;
    let moveCount = 0;

    mutableFs.renameSync = ((from, to) => {
      if (String(from).includes(" 2.")) {
        moveCount += 1;
        if (moveCount === 2) throw new Error("injected second-move failure");
      }
      originalRename(from, to);
    }) as typeof mutableFs.renameSync;
    try {
      expect(() => pruneDuplicateArtifacts(generatedRoot, options)).toThrow(/second-move|batch/i);
    } finally {
      mutableFs.renameSync = originalRename;
    }

    expect(moveCount).toBe(2);
    expect(existsSync(first)).toBe(true);
    expect(existsSync(second)).toBe(true);
  });

  it("throws and preserves a directory copy when any nested byte differs", () => {
    const { generatedRoot, options } = repositoryFixture();
    writeFixture(generatedRoot, "assets/chunk/index.js", "canonical");
    const differentDirectory = join(generatedRoot, "assets/chunk 2");
    writeFixture(generatedRoot, "assets/chunk 2/index.js", "different");

    expect(() => pruneDuplicateArtifacts(generatedRoot, options)).toThrow(/byte-identical/);
    expect(existsSync(differentDirectory)).toBe(true);
  });

  it("throws and preserves unmatched numbered files and directories", () => {
    const { generatedRoot, options } = repositoryFixture();
    const unmatchedFile = writeFixture(generatedRoot, "release notes 2.txt", "human content");
    const unmatchedDirectory = join(generatedRoot, "orphan 2");
    writeFixture(generatedRoot, "orphan 2/inside.txt", "human content");

    expect(() =>
      pruneDuplicateArtifactsUntilSettled(generatedRoot, {
        ...options,
        passes: 3,
        delayMs: 1,
        stablePasses: 2,
        minimumPasses: 2,
      })
    ).toThrow(/canonical sibling/);
    expect(existsSync(unmatchedFile)).toBe(true);
    expect(existsSync(unmatchedDirectory)).toBe(true);
  });

  it("keeps verification non-mutating for unsafe candidates", () => {
    const { repositoryRoot, generatedRoot, options } = repositoryFixture();
    const duplicate = writeFixture(generatedRoot, "assets/index 2.js", "same");
    writeFixture(generatedRoot, "assets/index.js", "same");

    expect(() => verifyNoDuplicateArtifacts(generatedRoot, options)).toThrow(
      "Duplicate generated artifact(s) remain"
    );
    expect(() =>
      runCli(["dist", "--verify"], { repositoryRoot, cwd: repositoryRoot })
    ).toThrow("Duplicate generated artifact(s) remain");
    expect(existsSync(duplicate)).toBe(true);
  });

  it("rejects absolute CLI targets even when they point at an allowlisted generated root", () => {
    const { repositoryRoot, generatedRoot } = repositoryFixture();
    const duplicate = writeFixture(generatedRoot, "assets/index 2.js", "same");
    writeFixture(generatedRoot, "assets/index.js", "same");

    expect(() =>
      runCli([generatedRoot, "--verify"], { repositoryRoot, cwd: repositoryRoot })
    ).toThrow("Generated-root target must be an exact allowlisted relative path");
    expect(existsSync(duplicate)).toBe(true);
  });

  it("supports non-mutating verification inside an explicit read-only boundary", () => {
    const allowedRoot = temporaryDirectory("zenflow-read-only-boundary-");
    const stagedRoot = join(allowedRoot, "output", "pages-artifact.nosync");
    const duplicate = writeFixture(stagedRoot, "assets/index 2.js", "same");
    writeFixture(stagedRoot, "assets/index.js", "same");

    expect(() => verifyNoDuplicateArtifacts(stagedRoot, { allowedRoot })).toThrow(
      "Duplicate generated artifact(s) remain"
    );
    expect(existsSync(duplicate)).toBe(true);
  });

  it("rejects non-mutating verification outside its explicit read-only boundary", () => {
    const allowedRoot = temporaryDirectory("zenflow-read-only-boundary-");
    const outsideRoot = temporaryDirectory("zenflow-read-only-outside-");

    expect(() => verifyNoDuplicateArtifacts(outsideRoot, { allowedRoot })).toThrow(
      "escapes allowed read-only root"
    );
  });

  it("rejects verify-like unknown CLI flags before any settle action", () => {
    const { repositoryRoot, generatedRoot } = repositoryFixture();

    expect(() =>
      runCli([generatedRoot, "--verify-extra", "--passes=0"], {
        repositoryRoot,
        cwd: repositoryRoot,
      })
    ).toThrow("Unknown option: --verify-extra");
  });
});

describe("generated-root filesystem boundary", () => {
  it.each(["ios/App/App", "android/app/src/main/res/xml", "output"])(
    "rejects destructive pruning for non-disposable root %s",
    (relativeRoot) => {
      const { repositoryRoot } = repositoryFixture();
      const root = join(repositoryRoot, relativeRoot);
      mkdirSync(root, { recursive: true });

      expect(() => pruneDuplicateArtifacts(root, { repositoryRoot })).toThrow(
        /not an allowlisted disposable generated root/
      );
    }
  );

  it("rejects a generated-root symlink and preserves its external victim", () => {
    const { repositoryRoot, generatedRoot } = repositoryFixture();
    const externalRoot = temporaryDirectory();
    rmSync(generatedRoot, { recursive: true });
    const victim = writeFixture(externalRoot, "victim 2.txt", "do not delete");
    symlinkSync(externalRoot, generatedRoot, "dir");

    expect(() => pruneDuplicateArtifacts(generatedRoot, { repositoryRoot })).toThrow(
      /symbolic link/
    );
    expect(readFileSync(victim, "utf8")).toBe("do not delete");
  });

  it("rejects a symlinked ancestor and preserves its external victim", () => {
    const { repositoryRoot } = repositoryFixture();
    const externalAssets = temporaryDirectory();
    const ancestor = join(repositoryRoot, "android/app/src/main/assets");
    mkdirSync(dirname(ancestor), { recursive: true });
    mkdirSync(join(externalAssets, "public"), { recursive: true });
    const victim = writeFixture(externalAssets, "public/victim 2.txt", "do not delete");
    symlinkSync(externalAssets, ancestor, "dir");
    const target = join(ancestor, "public");

    expect(() => pruneDuplicateArtifacts(target, { repositoryRoot })).toThrow(/symbolic link/);
    expect(readFileSync(victim, "utf8")).toBe("do not delete");
  });

  it("rejects a symlink entry before deleting any otherwise-safe candidate", () => {
    const { generatedRoot, options } = repositoryFixture();
    const externalRoot = temporaryDirectory();
    const victim = writeFixture(externalRoot, "victim 2.txt", "do not delete");
    writeFixture(generatedRoot, "assets/index.js", "same");
    const safeDuplicate = writeFixture(generatedRoot, "assets/index 2.js", "same");
    symlinkSync(externalRoot, join(generatedRoot, "external-link"), "dir");

    expect(() => pruneDuplicateArtifacts(generatedRoot, options)).toThrow(/symbolic link/);
    expect(existsSync(safeDuplicate)).toBe(true);
    expect(readFileSync(victim, "utf8")).toBe("do not delete");
  });
});

describe("settle-loop evidence", () => {
  it("keeps the Darwin default observation open for all 24 passes and catches a late writer", async () => {
    const { generatedRoot, options } = repositoryFixture();
    const darwinDefaults = settleDefaultsForPlatform("darwin");
    expect(darwinDefaults).toEqual({
      passes: 24,
      delayMs: 500,
      stablePasses: 3,
      minimumPasses: 24,
    });

    writeFixture(generatedRoot, "assets/index.js", "same bytes");
    const duplicate = join(generatedRoot, "assets/index 2.js");
    const ready = join(generatedRoot, "writer-ready");
    const child = spawnDelayedWrite(ready, duplicate, "same bytes", 160);
    const childResultPromise = collectChild(child);
    await waitForFile(ready, child);

    const result = pruneDuplicateArtifactsUntilSettled(generatedRoot, {
      ...options,
      ...darwinDefaults,
      delayMs: 10,
    });
    const childResult = await childResultPromise;

    expect(childResult.status, childResult.stderr).toBe(0);
    expect(result).toEqual({ removed: 1, passes: 24 });
    expect(existsSync(duplicate)).toBe(false);
  });

  it.each([
    [{ passes: 0 }, "passes"],
    [{ passes: -1 }, "passes"],
    [{ passes: 1.5 }, "passes"],
    [{ delayMs: 0 }, "delayMs"],
    [{ stablePasses: 0 }, "stablePasses"],
    [{ minimumPasses: 0 }, "minimumPasses"],
    [{ passes: 2, stablePasses: 3 }, "passes must be >= stablePasses"],
    [{ passes: 2, minimumPasses: 3 }, "passes must be >= minimumPasses"],
  ])("rejects invalid or impossible settle configuration %j", (invalid, expected) => {
    const { generatedRoot, options } = repositoryFixture();

    expect(() =>
      pruneDuplicateArtifactsUntilSettled(generatedRoot, {
        ...options,
        passes: 3,
        delayMs: 1,
        stablePasses: 2,
        minimumPasses: 2,
        ...invalid,
      })
    ).toThrow(expected);
  });

  it("returns only after minimum observation and consecutive clean passes", () => {
    const { generatedRoot, options } = repositoryFixture();
    writeFixture(generatedRoot, "assets/index.js", "canonical");

    expect(
      pruneDuplicateArtifactsUntilSettled(generatedRoot, {
        ...options,
        passes: 8,
        delayMs: 1,
        stablePasses: 2,
        minimumPasses: 5,
      })
    ).toEqual({ removed: 0, passes: 5 });
  });

  it("observes and removes a real delayed identical FileProvider-style copy", async () => {
    const { generatedRoot, options } = repositoryFixture();
    writeFixture(generatedRoot, "assets/index.js", "same bytes");
    const duplicate = join(generatedRoot, "assets/index 2.js");
    const ready = join(generatedRoot, "writer-ready");
    const child = spawnDelayedWrite(ready, duplicate, "same bytes", 60);
    const childResultPromise = collectChild(child);
    await waitForFile(ready, child);

    const result = pruneDuplicateArtifactsUntilSettled(generatedRoot, {
      ...options,
      passes: 8,
      delayMs: 40,
      stablePasses: 2,
      minimumPasses: 5,
    });
    const childResult = await childResultPromise;

    expect(childResult.status, childResult.stderr).toBe(0);
    expect(result.removed).toBe(1);
    expect(result.passes).toBeGreaterThanOrEqual(5);
    expect(existsSync(duplicate)).toBe(false);
    expect(verifyNoDuplicateArtifacts(generatedRoot, options)).toEqual({ duplicates: [] });
  });

  it("throws when a real late resurrection prevents the configured clean window", async () => {
    const { generatedRoot, options } = repositoryFixture();
    writeFixture(generatedRoot, "assets/index.js", "same bytes");
    const duplicate = join(generatedRoot, "assets/index 2.js");
    const ready = join(generatedRoot, "writer-ready");
    const child = spawnDelayedWrite(ready, duplicate, "same bytes", 60);
    const childResultPromise = collectChild(child);
    await waitForFile(ready, child);

    expect(() =>
      pruneDuplicateArtifactsUntilSettled(generatedRoot, {
        ...options,
        passes: 3,
        delayMs: 40,
        stablePasses: 2,
        minimumPasses: 3,
      })
    ).toThrow("did not settle after 3 pass(es)");
    const childResult = await childResultPromise;

    expect(childResult.status, childResult.stderr).toBe(0);
  });
});

describe("package prune targets", () => {
  it("limits destructive Android/iOS prune targets to disposable generated public roots", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["prune:release-artifacts:android"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs android/app/src/main/assets/public"
    );
    expect(packageJson.scripts["check:release-artifacts:android"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs android/app/src/main/assets/public --verify && node scripts/prune-duplicate-artifacts.cjs android/app/src/main/res/xml --verify"
    );
    expect(packageJson.scripts["prune:release-artifacts:ios"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs ios/App/App/public"
    );
    expect(packageJson.scripts["check:release-artifacts:ios"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs ios/App/App/public --verify"
    );
  });
});
