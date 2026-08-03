import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  acquireSharedDistBuildLock,
  createSharedDistBuildPlan,
  parseSharedDistBuildArgs,
  releaseSharedDistBuildLock,
  runSharedDistBuild,
  runSharedDistBuildCli,
  sharedDistBuildLockPath,
} from "../run-shared-dist-build.mjs";
import { validateCompletedProductionWebBuild } from "../validate-production-web-build.ts";

const REPO_ROOT = path.resolve(".");
const MODULE_URL = pathToFileURL(path.join(REPO_ROOT, "scripts", "run-shared-dist-build.mjs")).href;
const temporaryRoots = [];
const liveChildren = new Set();

afterEach(() => {
  for (const child of liveChildren) child.kill("SIGKILL");
  liveChildren.clear();
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function temporaryRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "zenflow-shared-dist-build-"));
  temporaryRoots.push(root);
  return root;
}

function spawnNode(source, env = {}) {
  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  liveChildren.add(child);
  return child;
}

function collectChild(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (status, signal) => {
      liveChildren.delete(child);
      resolve({ status, signal, stdout, stderr });
    });
  });
}

async function waitForFile(filePath, child, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(filePath)) return;
    if (child.exitCode !== null) {
      throw new Error(`lock owner exited before marker creation: ${child.exitCode}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${filePath}`);
}

describe("shared dist build input boundary", () => {
  it.each([
    [
      ["--target", "web", "--mode", "production"],
      { kind: "build", target: "web", mode: "production" },
    ],
    [
      ["--mode", "development", "--target", "web"],
      { kind: "build", target: "web", mode: "development" },
    ],
    [
      ["--target", "android", "--mode", "production"],
      { kind: "build", target: "android", mode: "production" },
    ],
    [
      ["--target", "ios", "--mode", "production"],
      { kind: "build", target: "ios", mode: "production" },
    ],
    [["--validate-production-web"], { kind: "validate-production-web" }],
  ])("accepts one exact supported invocation", (argv, expected) => {
    expect(parseSharedDistBuildArgs(argv)).toEqual(expected);
  });

  it.each([
    [],
    ["--target", "web"],
    ["--target", "desktop", "--mode", "production"],
    ["--target", "android", "--mode", "development"],
    ["--target", "web", "--mode", "preview"],
    ["--target", "web", "--target", "ios", "--mode", "production"],
    ["--target", "web", "--mode", "production", "--force"],
    ["--validate-production-web", "--target", "web"],
  ])("rejects unsupported, incomplete, duplicate, or extra arguments: %j", (argv) => {
    expect(() => parseSharedDistBuildArgs(argv)).toThrow(/SHARED DIST BUILD:/);
  });
});

describe("shared dist build plans", () => {
  it("keeps the production-web manifest lifecycle and pruning inside one ordered plan", () => {
    const plan = createSharedDistBuildPlan({
      rootDir: REPO_ROOT,
      target: "web",
      mode: "production",
      nodeExecutable: "/portable/node",
    });

    expect(plan.map((command) => command.label)).toEqual([
      "design tokens",
      "production-web manifest begin",
      "Vite production web build",
      "dist duplicate-artifact prune",
      "production-web manifest complete",
    ]);
    expect(plan.every((command) => command.executable === "/portable/node")).toBe(true);
    expect(plan.every((command) => Array.isArray(command.args))).toBe(true);
    expect(plan.some((command) => command.args.includes("--bundle-manifest-begin"))).toBe(true);
    expect(plan.some((command) => command.args.includes("--bundle-manifest-complete"))).toBe(true);
    expect(plan.find((command) => command.label === "Vite production web build")?.args).toContain(
      "production"
    );
  });

  it("preserves development build semantics while still producing a lockable plan", () => {
    const plan = createSharedDistBuildPlan({
      rootDir: REPO_ROOT,
      target: "web",
      mode: "development",
      nodeExecutable: "/portable/node",
    });

    expect(plan.map((command) => command.label)).toEqual([
      "design tokens",
      "Vite development web build",
    ]);
    expect(plan[1].args).toContain("development");
  });

  it.each(["android", "ios"])(
    "preserves CAPACITOR_BUILD, native prune, dist prune, and verify for %s",
    (target) => {
      const plan = createSharedDistBuildPlan({
        rootDir: REPO_ROOT,
        target,
        mode: "production",
        nodeExecutable: "/portable/node",
      });

      expect(plan.map((command) => command.label)).toEqual([
        "design tokens",
        `Vite production ${target} build`,
        "Capacitor asset prune",
        "dist duplicate-artifact prune",
        "dist duplicate-artifact verify",
      ]);
      expect(plan.slice(0, 3).every((command) => command.env?.CAPACITOR_BUILD === "true")).toBe(
        true
      );
      expect(plan[2].args).toEqual([path.join(REPO_ROOT, "scripts", "capacitor-prune-assets.cjs")]);
      expect(plan.slice(3).every((command) => command.env === undefined)).toBe(true);
      expect(plan.at(-1)?.args).toContain("--verify");
      expect(plan.some((command) => command.args.includes("--bundle-manifest-begin"))).toBe(false);
    }
  );
});

describe("shared dist build lock", () => {
  it("allows only one real child process to own the shared dist lock", async () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();
    const markerPath = path.join(rootDir, "owner-ready");
    const releasePath = path.join(rootDir, "release-owner");
    const owner = spawnNode(
      `
        import { existsSync, writeFileSync } from "node:fs";
        const { withSharedDistBuildLock } = await import(process.env.ZENFLOW_TEST_MODULE_URL);
        withSharedDistBuildLock(
          {
            rootDir: process.env.ZENFLOW_TEST_ROOT,
            lockBaseDir: process.env.ZENFLOW_TEST_LOCK_BASE,
            target: "web",
            mode: "production",
          },
          () => {
            writeFileSync(process.env.ZENFLOW_TEST_MARKER, "ready");
            const deadline = Date.now() + 5000;
            while (!existsSync(process.env.ZENFLOW_TEST_RELEASE) && Date.now() < deadline) {
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
            }
            if (!existsSync(process.env.ZENFLOW_TEST_RELEASE)) throw new Error("release timeout");
          },
        );
      `,
      {
        ZENFLOW_TEST_MODULE_URL: MODULE_URL,
        ZENFLOW_TEST_ROOT: rootDir,
        ZENFLOW_TEST_LOCK_BASE: lockBaseDir,
        ZENFLOW_TEST_MARKER: markerPath,
        ZENFLOW_TEST_RELEASE: releasePath,
      }
    );
    const ownerResultPromise = collectChild(owner);
    await waitForFile(markerPath, owner);

    const contender = spawnNode(
      `
        const { withSharedDistBuildLock } = await import(process.env.ZENFLOW_TEST_MODULE_URL);
        try {
          withSharedDistBuildLock(
            {
              rootDir: process.env.ZENFLOW_TEST_ROOT,
              lockBaseDir: process.env.ZENFLOW_TEST_LOCK_BASE,
              target: "ios",
              mode: "production",
            },
            () => {},
          );
          process.exitCode = 0;
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
          process.exitCode = 23;
        }
      `,
      {
        ZENFLOW_TEST_MODULE_URL: MODULE_URL,
        ZENFLOW_TEST_ROOT: rootDir,
        ZENFLOW_TEST_LOCK_BASE: lockBaseDir,
      }
    );
    const contenderResult = await collectChild(contender);

    expect(contenderResult.status).toBe(23);
    expect(contenderResult.stderr).toContain("shared dist is already locked");
    expect(contenderResult.stderr.length).toBeLessThan(2_048);
    writeFileSync(releasePath, "release");
    const ownerResult = await ownerResultPromise;
    expect(ownerResult.status, ownerResult.stderr).toBe(0);
    expect(existsSync(sharedDistBuildLockPath(rootDir, { lockBaseDir }))).toBe(false);
  }, 10_000);

  it("releases its own lock when an orchestrated command fails", () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();

    expect(() =>
      runSharedDistBuild({
        rootDir,
        lockBaseDir,
        target: "web",
        mode: "development",
        env: {},
        runCommand() {
          throw new Error("fixture command failure");
        },
      })
    ).toThrow("fixture command failure");
    expect(existsSync(sharedDistBuildLockPath(rootDir, { lockBaseDir }))).toBe(false);

    const lease = acquireSharedDistBuildLock({
      rootDir,
      lockBaseDir,
      target: "web",
      mode: "development",
    });
    releaseSharedDistBuildLock(lease);
  });

  it("does not reclaim or delete a valid-looking foreign stale lock", () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();
    const lockPath = sharedDistBuildLockPath(rootDir, { lockBaseDir });
    mkdirSync(lockPath, { recursive: true, mode: 0o700 });
    writeFileSync(
      path.join(lockPath, "owner.json"),
      JSON.stringify({
        schemaVersion: 1,
        pid: 999_999,
        target: "web",
        mode: "production",
        startedAt: "2020-01-01T00:00:00.000Z",
        nonce: "a".repeat(64),
      })
    );

    expect(() =>
      acquireSharedDistBuildLock({
        rootDir,
        lockBaseDir,
        target: "android",
        mode: "production",
      })
    ).toThrow(/shared dist is already locked/);
    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(path.join(lockPath, "owner.json"), "utf8")).toContain("999999");
  });

  it("keeps malformed foreign lock metadata private and fails closed", () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();
    const lockPath = sharedDistBuildLockPath(rootDir, { lockBaseDir });
    mkdirSync(lockPath, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(lockPath, "owner.json"), '{"secret":"must-not-leak"}');

    let error;
    try {
      acquireSharedDistBuildLock({
        rootDir,
        lockBaseDir,
        target: "web",
        mode: "production",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("owner metadata unavailable");
    expect(error.message).not.toContain("must-not-leak");
    expect(existsSync(lockPath)).toBe(true);
  });

  it("rejects validation while a foreign lock exists and leaves it untouched", () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();
    const lockPath = sharedDistBuildLockPath(rootDir, { lockBaseDir });
    mkdirSync(lockPath, { recursive: true, mode: 0o700 });
    const labels = [];

    expect(() =>
      runSharedDistBuildCli({
        argv: ["--validate-production-web"],
        rootDir,
        lockBaseDir,
        env: {},
        runCommand(command) {
          labels.push(command.label);
        },
      })
    ).toThrow("shared dist is already locked");

    expect(labels).toEqual([]);
    expect(existsSync(lockPath)).toBe(true);
  });

  it("holds the shared lock for the entire clean validation plan", () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();
    const labels = [];

    runSharedDistBuildCli({
      argv: ["--validate-production-web"],
      rootDir,
      lockBaseDir,
      env: {},
      runCommand(command) {
        labels.push(command.label);
        expect(existsSync(sharedDistBuildLockPath(rootDir, { lockBaseDir }))).toBe(true);
        expect(() =>
          acquireSharedDistBuildLock({
            rootDir,
            lockBaseDir,
            target: "android",
            mode: "production",
          })
        ).toThrow(/shared dist is already locked/i);
      },
    });

    expect(labels).toEqual(["production-web manifest validate", "dist duplicate-artifact verify"]);
    expect(existsSync(sharedDistBuildLockPath(rootDir, { lockBaseDir }))).toBe(false);
  });

  it("rejects a forged release lease without unlinking its caller-supplied owner path", () => {
    const fakeLock = temporaryRoot();
    const victimRoot = temporaryRoot();
    const victim = path.join(victimRoot, "must-survive.txt");
    const nonce = "a".repeat(64);
    writeFileSync(victim, "do not delete");
    writeFileSync(
      path.join(fakeLock, "owner.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        pid: process.pid,
        target: "web",
        mode: "production",
        startedAt: new Date().toISOString(),
        nonce,
      })}\n`
    );

    expect(() =>
      releaseSharedDistBuildLock({
        lockPath: fakeLock,
        ownerPath: victim,
        pid: process.pid,
        target: "web",
        mode: "production",
        nonce,
      })
    ).toThrow(/ownership|issued lease|owner path/i);
    expect(readFileSync(victim, "utf8")).toBe("do not delete");
    expect(existsSync(path.join(fakeLock, "owner.json"))).toBe(true);
  });

  it("rejects production-web context mismatch before validation starts", () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();
    let commandCount = 0;

    expect(() =>
      runSharedDistBuildCli({
        argv: ["--validate-production-web"],
        rootDir,
        lockBaseDir,
        env: { CAPACITOR_BUILD: "true" },
        runCommand() {
          commandCount += 1;
        },
      })
    ).toThrow("CAPACITOR_BUILD=true");
    expect(commandCount).toBe(0);
  });

  it("ignores resurrected repo-local conflict copies for locking and validation", () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();
    const resurrectedRepoLock = path.join(
      rootDir,
      "node_modules",
      ".cache",
      "zenflow-shared-build",
      "shared-dist.lock"
    );
    mkdirSync(resurrectedRepoLock, { recursive: true });
    writeFileSync(path.join(resurrectedRepoLock, "owner 2.json"), "FileProvider conflict copy");

    const lease = acquireSharedDistBuildLock({
      rootDir,
      lockBaseDir,
      target: "web",
      mode: "production",
    });
    expect(lease.lockPath).not.toContain(rootDir);
    releaseSharedDistBuildLock(lease);

    const labels = [];
    runSharedDistBuildCli({
      argv: ["--validate-production-web"],
      rootDir,
      lockBaseDir,
      env: {},
      runCommand(command) {
        labels.push(command.label);
      },
    });

    expect(labels).toEqual(["production-web manifest validate", "dist duplicate-artifact verify"]);
    expect(readFileSync(path.join(resurrectedRepoLock, "owner 2.json"), "utf8")).toBe(
      "FileProvider conflict copy"
    );
  });

  it("hash-binds distinct canonical repository roots to distinct opaque lock names", () => {
    const firstRoot = temporaryRoot();
    const secondRoot = temporaryRoot();
    const lockBaseDir = temporaryRoot();

    const firstLock = sharedDistBuildLockPath(firstRoot, { lockBaseDir });
    const secondLock = sharedDistBuildLockPath(secondRoot, { lockBaseDir });

    expect(firstLock).not.toBe(secondLock);
    expect(path.basename(firstLock)).toMatch(/^repo-[a-f0-9]{64}\.lock$/);
    expect(path.basename(secondLock)).toMatch(/^repo-[a-f0-9]{64}\.lock$/);
  });

  it("uses a private namespace without leaking the raw repository path", () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();

    const lease = acquireSharedDistBuildLock({
      rootDir,
      lockBaseDir,
      target: "web",
      mode: "development",
    });
    const ownerMetadata = readFileSync(lease.ownerPath, "utf8");
    const parsedOwner = JSON.parse(ownerMetadata);
    const namespaceStat = statSync(path.dirname(lease.lockPath));

    expect(lease.rootDir).toBe(realpathSync(rootDir));
    expect(lease.lockPath).not.toContain(rootDir);
    expect(path.basename(lease.lockPath)).not.toContain(path.basename(rootDir));
    expect(ownerMetadata).not.toContain(rootDir);
    expect(ownerMetadata).not.toContain(path.basename(rootDir));
    expect(parsedOwner).not.toHaveProperty("rootDir");
    expect(parsedOwner).not.toHaveProperty("repositoryPath");
    if (process.platform !== "win32") {
      expect(namespaceStat.mode & 0o077).toBe(0);
    }

    releaseSharedDistBuildLock(lease);
  });

  it("rejects a symlinked external lock base without writing through it", () => {
    const rootDir = temporaryRoot();
    const linkContainer = temporaryRoot();
    const outsideRoot = temporaryRoot();
    const symlinkedBase = path.join(linkContainer, "lock-base-link");
    symlinkSync(outsideRoot, symlinkedBase, "dir");

    expect(() =>
      acquireSharedDistBuildLock({
        rootDir,
        lockBaseDir: symlinkedBase,
        target: "web",
        mode: "production",
      })
    ).toThrow(/lock base|symbolic link|lock location/);
    expect(readdirSync(outsideRoot)).toEqual([]);
  });

  it("rejects a symlinked managed namespace without escaping the external base", () => {
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();
    const outsideRoot = temporaryRoot();
    const expectedLockPath = sharedDistBuildLockPath(rootDir, { lockBaseDir });
    mkdirSync(path.dirname(path.dirname(expectedLockPath)), { recursive: true });
    symlinkSync(outsideRoot, path.dirname(expectedLockPath), "dir");

    expect(() =>
      acquireSharedDistBuildLock({
        rootDir,
        lockBaseDir,
        target: "ios",
        mode: "production",
      })
    ).toThrow(/namespace|symbolic link|lock location/);
    expect(readdirSync(outsideRoot)).toEqual([]);
  });

  it("rejects an existing machine-local namespace unless its mode is exactly 0700", () => {
    if (process.platform === "win32") return;
    const rootDir = temporaryRoot();
    const lockBaseDir = temporaryRoot();
    const expectedLockPath = sharedDistBuildLockPath(rootDir, { lockBaseDir });
    const namespacePath = path.dirname(expectedLockPath);
    mkdirSync(namespacePath, { mode: 0o500 });
    chmodSync(namespacePath, 0o500);

    expect(() =>
      acquireSharedDistBuildLock({
        rootDir,
        lockBaseDir,
        target: "web",
        mode: "production",
      })
    ).toThrow("permissions must be 0700");
    expect(readdirSync(namespacePath)).toEqual([]);
  });
});

describe("package build wiring", () => {
  it("routes every dist writer through the orchestrator and keeps postbuild read-only", () => {
    const packageJson = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));

    expect(packageJson.scripts.build).toBe(
      "node scripts/run-shared-dist-build.mjs --target web --mode production"
    );
    expect(packageJson.scripts.postbuild).toBe(
      "node scripts/run-shared-dist-build.mjs --validate-production-web"
    );
    expect(packageJson.scripts["build:dev"]).toBe(
      "node scripts/run-shared-dist-build.mjs --target web --mode development"
    );
    expect(packageJson.scripts["build:android"]).toBe(
      "node scripts/run-shared-dist-build.mjs --target android --mode production"
    );
    expect(packageJson.scripts["build:ios"]).toBe(
      "node scripts/run-shared-dist-build.mjs --target ios --mode production"
    );
  });
});

describe("production-web validation helper", () => {
  it("calls the real manifest validator and fails closed when evidence is missing", () => {
    const rootDir = temporaryRoot();

    expect(() => validateCompletedProductionWebBuild(rootDir, {})).toThrow(
      "bundle manifest is missing"
    );
  });

  it("rejects native environment state before reading production-web evidence", () => {
    const rootDir = temporaryRoot();

    expect(() => validateCompletedProductionWebBuild(rootDir, { CAPACITOR_BUILD: "true" })).toThrow(
      "CAPACITOR_BUILD=true"
    );
  });
});
