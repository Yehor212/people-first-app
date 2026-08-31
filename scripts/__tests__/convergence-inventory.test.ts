import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  collectInventory,
  parseArguments,
  renderPublicSummary,
  resolveAndValidateOutputLocation,
  sanitizeStatusEntry,
  validateOutputLocation,
  writePrivateSnapshots,
} from "../convergence-inventory.mjs";

const roots: string[] = [];
const MAIN_SHA = "b2341c0ca405e2f32892e4e96be86474290abe63";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("convergence inventory CLI boundaries", () => {
  it("requires absolute roots and exact required arguments", () => {
    expect(() =>
      parseArguments([
        "--legacy-root",
        "relative/root",
        "--canonical-root",
        "/repo/canonical",
        "--output-dir",
        "/private/inventory",
        "--expected-main-sha",
        MAIN_SHA,
      ])
    ).toThrow(/legacy-root must be absolute/);

    expect(
      parseArguments([
        "--legacy-root",
        "/repo/legacy",
        "--canonical-root",
        "/repo/canonical",
        "--output-dir",
        "/private/inventory",
        "--additional-root",
        "/repo/secondary",
        "--additional-root",
        "/repo/tertiary",
        "--expected-main-sha",
        MAIN_SHA,
      ])
    ).toEqual({
      legacyRoot: "/repo/legacy",
      canonicalRoot: "/repo/canonical",
      outputDir: "/private/inventory",
      additionalRoots: ["/repo/secondary", "/repo/tertiary"],
      expectedMainSha: MAIN_SHA,
    });
  });

  it("refuses an output directory inside an inventoried repository", () => {
    expect(() => validateOutputLocation("/repo/control/private", ["/repo/control"])).toThrow(
      /outside every repository/
    );
    expect(validateOutputLocation("/private/inventory", ["/repo/control"])).toBe(
      "/private/inventory"
    );
  });

  it("refuses an output path whose existing ancestor symlinks into a repository", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "zenflow-convergence-symlink-"));
    roots.push(parent);
    const repository = path.join(parent, "repository");
    const alias = path.join(parent, "output-alias");
    await mkdir(repository);
    await symlink(repository, alias, "dir");

    await expect(
      resolveAndValidateOutputLocation(path.join(alias, "snapshot"), [repository])
    ).rejects.toThrow(/outside every repository/);
  });

  it("redacts secret-like status paths but preserves public source paths", () => {
    expect(sanitizeStatusEntry("??", ".env.production")).toEqual({
      code: "??",
      pathCategory: "SECRET_LIKE",
      pathHash: "48f73ea2653e45c4",
    });
    expect(sanitizeStatusEntry("??", "config/secrets/private.json")).toEqual({
      code: "??",
      pathCategory: "SECRET_LIKE",
      pathHash: "8f5e5851c8e840fe",
    });
    expect(sanitizeStatusEntry(" M", "src/App.tsx")).toEqual({
      code: " M",
      path: "src/App.tsx",
    });
  });

  it("fails closed when the canonical origin/main SHA differs", async () => {
    const run = fakeRunner({ canonicalMain: "a".repeat(40) });

    await expect(
      collectInventory(options(), { now: () => "2026-08-31T07:10:00.000Z", run })
    ).rejects.toThrow(/expected main SHA/);
  });

  it("uses argument arrays without a shell and returns a bounded private snapshot", async () => {
    const calls: Array<{ command: string; args: string[]; shell: boolean }> = [];
    const run = fakeRunner({ calls, canonicalMain: MAIN_SHA });

    const inventory = await collectInventory(options(), {
      now: () => "2026-08-31T07:10:00.000Z",
      run,
    });

    expect(calls.length).toBeGreaterThan(5);
    expect(calls.every((call) => Array.isArray(call.args) && call.shell === false)).toBe(true);
    expect(inventory).toMatchObject({
      schema: "zenflow-convergence-inventory/v1",
      observedAt: "2026-08-31T07:10:00.000Z",
      expectedMainSha: MAIN_SHA,
      worktrees: [
        { activity: "ACTIVE_SKIP", changeCount: 0 },
        { activity: "FROZEN", changeCount: 0 },
      ],
      pullRequests: [],
    });
    expect(inventory.registries).toHaveLength(2);
    expect(inventory.refs).toHaveLength(1);
    expect(inventory.refs[0]).toMatchObject({
      name: "refs/heads/codex/already-main",
      classification: "IN_MAIN",
    });
    expect(inventory.refs[0].registryIds).toHaveLength(2);
    expect(JSON.stringify(renderPublicSummary(inventory))).not.toMatch(
      /\/Users\/|\/repo\/|src\/App/
    );
  });

  it("writes private snapshots atomically with restrictive modes", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "zenflow-convergence-output-"));
    roots.push(parent);
    const repository = path.join(parent, "repository");
    await mkdir(repository);
    const outputDir = path.join(parent, "snapshot");
    const inventory = {
      schema: "zenflow-convergence-inventory/v1",
      observedAt: "2026-08-31T07:10:00.000Z",
      expectedMainSha: MAIN_SHA,
      worktrees: [],
      refs: [],
      pullRequests: [],
      registries: [],
      warnings: [],
    };

    const missingRoots = { inventory, outputDir } as unknown as Parameters<
      typeof writePrivateSnapshots
    >[0];
    await expect(writePrivateSnapshots(missingRoots)).rejects.toThrow(
      /repositoryRoots/
    );
    const result = await writePrivateSnapshots({
      inventory,
      outputDir,
      repositoryRoots: [repository],
    });
    const canonicalOutput = await realpath(outputDir);

    expect(result).toEqual({
      inventoryPath: path.join(canonicalOutput, "inventory.json"),
      summaryPath: path.join(canonicalOutput, "summary.json"),
    });
    expect((await stat(outputDir)).mode & 0o777).toBe(0o700);
    expect((await stat(result.inventoryPath)).mode & 0o777).toBe(0o600);
    expect((await stat(result.summaryPath)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(result.summaryPath, "utf8"))).toEqual(
      renderPublicSummary(inventory)
    );
  });
});

function options() {
  return {
    legacyRoot: "/repo/legacy",
    canonicalRoot: "/repo/canonical",
    outputDir: "/private/inventory",
    additionalRoots: [],
    expectedMainSha: MAIN_SHA,
  };
}

function fakeRunner({
  calls = [],
  canonicalMain,
}: {
  calls?: Array<{ command: string; args: string[]; shell: boolean }>;
  canonicalMain: string;
}) {
  return async ({
    command,
    args,
    cwd,
    shell,
  }: {
    command: string;
    args: string[];
    cwd?: string;
    shell: boolean;
  }) => {
    calls.push({ command, args, shell });
    const key = [command, cwd || "", ...args].join("\u0001");
    const worktreeFixture = [
      "worktree /repo/legacy",
      `HEAD ${MAIN_SHA}`,
      "branch refs/heads/main",
      "",
    ].join("\n");
    const canonicalWorktreeFixture = [
      "worktree /repo/canonical",
      `HEAD ${MAIN_SHA}`,
      "branch refs/heads/main",
      "",
    ].join("\n");
    const outputs = new Map<string, string>([
      [["git", "/repo/canonical", "remote", "get-url", "origin"].join("\u0001"), "https://github.com/Yehor212/people-first-app.git\n"],
      [["git", "/repo/canonical", "remote", "get-url", "--push", "--all", "origin"].join("\u0001"), "https://github.com/Yehor212/people-first-app.git\n"],
      [["git", "/repo/legacy", "remote", "get-url", "origin"].join("\u0001"), "https://github.com/Yehor212/people-first-app.git\n"],
      [["git", "/repo/legacy", "remote", "get-url", "--push", "--all", "origin"].join("\u0001"), "https://github.com/Yehor212/people-first-app.git\n"],
      [["git", "/repo/canonical", "rev-parse", "HEAD"].join("\u0001"), `${canonicalMain}\n`],
      [["git", "/repo/canonical", "rev-parse", "refs/remotes/origin/main"].join("\u0001"), `${canonicalMain}\n`],
      [["git", "/repo/canonical", "worktree", "list", "--porcelain"].join("\u0001"), canonicalWorktreeFixture],
      [["git", "/repo/canonical", "for-each-ref", "--format=%(objectname)%09%(refname)", "refs/heads", "refs/remotes/origin"].join("\u0001"), `${MAIN_SHA}\trefs/heads/main\n${MAIN_SHA}\trefs/heads/codex/already-main\n${MAIN_SHA}\trefs/remotes/origin/main\n`],
      [["git", "/repo/canonical", "rev-list", "--left-right", "--count", `refs/heads/codex/already-main...${MAIN_SHA}`].join("\u0001"), "0\t0\n"],
      [["git", "/repo/canonical", "status", "--porcelain=v1", "--untracked-files=all", "-z"].join("\u0001"), ""],
      [["git", "/repo/canonical", "status", "--porcelain=v1", "--ignored", "--untracked-files=normal", "-z"].join("\u0001"), ""],
      [["git", "/repo/canonical", "rev-parse", "--git-common-dir"].join("\u0001"), "/repo/canonical/.git\n"],
      [["git", "/repo/legacy", "worktree", "list", "--porcelain"].join("\u0001"), worktreeFixture],
      [["git", "/repo/legacy", "for-each-ref", "--format=%(objectname)%09%(refname)", "refs/heads", "refs/remotes/origin"].join("\u0001"), `${MAIN_SHA}\trefs/heads/main\n${MAIN_SHA}\trefs/heads/codex/already-main\n${MAIN_SHA}\trefs/remotes/origin/main\n`],
      [["git", "/repo/legacy", "rev-list", "--left-right", "--count", `refs/heads/codex/already-main...${MAIN_SHA}`].join("\u0001"), "0\t0\n"],
      [["git", "/repo/legacy", "status", "--porcelain=v1", "--untracked-files=all", "-z"].join("\u0001"), ""],
      [["git", "/repo/legacy", "status", "--porcelain=v1", "--ignored", "--untracked-files=normal", "-z"].join("\u0001"), ""],
      [["git", "/repo/legacy", "rev-parse", "--git-common-dir"].join("\u0001"), "/repo/legacy/.git\n"],
      [["git", "/repo/legacy", "rev-parse", "HEAD"].join("\u0001"), `${MAIN_SHA}\n`],
      [["lsof", "", "-nP", "-a", "-d", "cwd", "-Fpcn"].join("\u0001"), "p123\ncnode\nn/repo/legacy\n"],
      [["lsof", "", "-nP", "-Fpcn"].join("\u0001"), "p123\ncnode\nn/repo/legacy/src/file.ts\n"],
      [["gh", "/repo/canonical", "pr", "list", "--repo", "Yehor212/people-first-app", "--state", "open", "--limit", "100", "--json", "number,title,headRefName,headRefOid,baseRefName,isDraft,mergeable,updatedAt,author,url"].join("\u0001"), "[]\n"],
    ]);
    if (!outputs.has(key)) throw new Error(`unexpected fake command: ${key}`);
    return { stdout: outputs.get(key)!, stderr: "", status: 0 };
  };
}
