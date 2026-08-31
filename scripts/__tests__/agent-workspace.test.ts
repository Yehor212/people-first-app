import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { renameSync, symlinkSync, writeFileSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  KIMI_AUDIO_REVIEW_2026_07_26,
  bootstrapHumanReviewWorkspace,
  createWorkspace,
  handoffWorkspace,
  inspectHumanReviewWorkspace,
  inspectWorkspace,
  readBoundedRegularFileForTest,
  syncWorkspace,
} from "../agent-workspace-runtime.cjs";

const WORKSPACE_CLI = path.resolve("scripts/agent-workspace.mjs");

type Fixture = {
  control: string;
  peer: string;
  remote: string;
  root: string;
};

type HumanReviewFixture = {
  audioInventory: Array<{ filename: string; sha256: string }>;
  control: string;
  expectedRemote: string;
  review: string;
  workspaceFile: string;
};

type BootstrapRaceHooks = {
  afterAudioReviewDirectoryCreated?: () => void;
  afterControlCloned?: () => void;
  afterDestinationBindingsCaptured?: () => void;
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await makeTreeWritable(root);
      await rm(root, { recursive: true, force: true });
    })
  );
});

describe("agent workspace lifecycle", () => {
  it("pins the production Kimi human-review inventory to exactly 17 files", () => {
    expect(KIMI_AUDIO_REVIEW_2026_07_26).toHaveLength(17);
    expect(new Set(KIMI_AUDIO_REVIEW_2026_07_26.map((entry) => entry.filename)).size).toBe(17);
  });

  it("bootstraps one clean Git main plus a visible non-Git read-only audio review root", async () => {
    const fixture = await repositoryFixture();
    const source = path.join(fixture.root, "kimi-recovered");
    const control = path.join(fixture.root, "human-main");
    const review = path.join(fixture.root, "kimi-audio-review");
    const workspaceFile = path.join(fixture.root, "ZenFlow-human-review.code-workspace");
    const filename = "hyperfocus-rain-soft.mp3";
    const bytes = Buffer.from("fixture-kimi-audio");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, filename), bytes);

    const result = bootstrapHumanReviewWorkspace({
      audioInventory: [{ filename, sha256 }],
      audioReviewPath: review,
      audioSourcePath: source,
      controlPath: control,
      expectedRemote: fixture.remote,
      workspaceFile,
    });

    expect(result).toMatchObject({
      audioCount: 1,
      audioReviewPath: review,
      branch: "main",
      clean: true,
      controlPath: control,
      repositoryCount: 1,
      workspaceFile,
    });
    expect(git(control, ["status", "--short"])).toBe("");
    expect(git(control, ["rev-parse", "HEAD"]).trim()).toBe(
      git(fixture.peer, ["rev-parse", "HEAD"]).trim()
    );
    expect(
      spawnSync("git", ["-C", review, "rev-parse", "--show-toplevel"], {
        encoding: "utf8",
      }).status
    ).not.toBe(0);
    expect(await readFile(path.join(review, "hyperfocus", filename))).toEqual(bytes);
    expect((await stat(review)).mode & 0o777).toBe(0o500);
    expect((await stat(path.join(review, "hyperfocus"))).mode & 0o777).toBe(0o500);
    expect((await stat(path.join(review, "hyperfocus", filename))).mode & 0o777).toBe(0o400);
    expect((await stat(path.join(review, "MANIFEST.json"))).mode & 0o777).toBe(0o400);
    expect((await stat(path.join(review, "README.md"))).mode & 0o777).toBe(0o400);
    expect((await stat(workspaceFile)).mode & 0o777).toBe(0o400);
    const manifestText = await readFile(path.join(review, "MANIFEST.json"), "utf8");
    const manifest = JSON.parse(manifestText);
    expect(manifest.copied).toEqual([{ filename, sha256, status: "QUARANTINED" }]);
    expect(manifestText).not.toContain(source);

    const workspace = JSON.parse(await readFile(workspaceFile, "utf8"));
    expect(workspace.folders).toEqual([
      { name: "ZenFlow — clean main", path: control },
      { name: "Kimi nature audio — review only", path: review },
    ]);
    expect(workspace.settings).toMatchObject({
      "files.readonlyFromPermissions": true,
      "git.autoRepositoryDetection": false,
      "git.detectWorktrees": false,
      "git.openRepositoryInParentFolders": "never",
      "git.scanRepositories": [],
    });

    expect(
      inspectHumanReviewWorkspace({
        audioInventory: [{ filename, sha256 }],
        audioReviewPath: review,
        controlPath: control,
        expectedRemote: fixture.remote,
        workspaceFile,
      })
    ).toMatchObject({ audioCount: 1, repositoryCount: 1, ready: true });

    const copiedAudio = path.join(review, "hyperfocus", filename);
    await chmod(copiedAudio, 0o644);
    expect(() =>
      inspectHumanReviewWorkspace({
        audioInventory: [{ filename, sha256 }],
        audioReviewPath: review,
        controlPath: control,
        expectedRemote: fixture.remote,
        workspaceFile,
      })
    ).toThrowError(/AUDIO_REVIEW_PERMISSIONS/);

    await chmod(copiedAudio, 0o400);
    const forgedWorkspace = path.join(fixture.root, "forged-review-workspace.json");
    await writeFile(forgedWorkspace, await readFile(workspaceFile));
    await rm(workspaceFile);
    await symlink(forgedWorkspace, workspaceFile);
    expect(() =>
      inspectHumanReviewWorkspace({
        audioInventory: [{ filename, sha256 }],
        audioReviewPath: review,
        controlPath: control,
        expectedRemote: fixture.remote,
        workspaceFile,
      })
    ).toThrowError(/AUDIO_REVIEW_UNSAFE_FILE/);
  }, 15_000);

  it(
    "rejects substituted review directories and a Git repository at the audio root",
    async () => {
      const rootAlias = await humanReviewFixture("root-alias");
      const movedReview = `${rootAlias.review}-actual`;
      await rename(rootAlias.review, movedReview);
      await symlink(movedReview, rootAlias.review, "dir");
      expect(() => inspectHumanFixture(rootAlias)).toThrowError(/AUDIO_REVIEW_UNSAFE_DIRECTORY/);

      const nestedAlias = await humanReviewFixture("nested-alias");
      const hyperfocus = path.join(nestedAlias.review, "hyperfocus");
      const movedHyperfocus = `${nestedAlias.review}-hyperfocus-actual`;
      await chmod(nestedAlias.review, 0o700);
      await chmod(hyperfocus, 0o700);
      await rename(hyperfocus, movedHyperfocus);
      await chmod(movedHyperfocus, 0o500);
      await symlink(movedHyperfocus, hyperfocus, "dir");
      await chmod(nestedAlias.review, 0o500);
      expect(() => inspectHumanFixture(nestedAlias)).toThrowError(/AUDIO_REVIEW_UNSAFE_DIRECTORY/);

      const repositoryReview = await humanReviewFixture("review-repository");
      await chmod(repositoryReview.review, 0o700);
      git(repositoryReview.review, ["init", "--initial-branch=main"]);
      await chmod(repositoryReview.review, 0o500);
      expect(() => inspectHumanFixture(repositoryReview)).toThrowError(/AUDIO_REVIEW_REPOSITORY/);
    },
    30_000
  );

  it("binds the full quarantine manifest, warning text, and workspace allowlist", async () => {
    const manifestFixture = await humanReviewFixture("manifest-tamper");
    const manifestPath = path.join(manifestFixture.review, "MANIFEST.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.reason = "Approved for release";
    await chmod(manifestFixture.review, 0o700);
    await chmod(manifestPath, 0o600);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await chmod(manifestPath, 0o400);
    await chmod(manifestFixture.review, 0o500);
    expect(() => inspectHumanFixture(manifestFixture)).toThrowError(
      /AUDIO_REVIEW_MANIFEST_INVALID/
    );

    const readmeFixture = await humanReviewFixture("readme-tamper");
    const readmePath = path.join(readmeFixture.review, "README.md");
    await chmod(readmeFixture.review, 0o700);
    await chmod(readmePath, 0o600);
    await writeFile(readmePath, "# Approved\n");
    await chmod(readmePath, 0o400);
    await chmod(readmeFixture.review, 0o500);
    expect(() => inspectHumanFixture(readmeFixture)).toThrowError(/AUDIO_REVIEW_README_INVALID/);

    const workspaceFixture = await humanReviewFixture("workspace-injection");
    const workspace = JSON.parse(await readFile(workspaceFixture.workspaceFile, "utf8"));
    workspace.tasks = {
      version: "2.0.0",
      tasks: [{ label: "injected", type: "shell", command: "echo unsafe" }],
    };
    await chmod(workspaceFixture.workspaceFile, 0o600);
    await writeFile(workspaceFixture.workspaceFile, `${JSON.stringify(workspace, null, 2)}\n`);
    await chmod(workspaceFixture.workspaceFile, 0o400);
    expect(() => inspectHumanFixture(workspaceFixture)).toThrowError(
      /HUMAN_REVIEW_WORKSPACE_INVALID/
    );
  }, 15_000);

  it("rejects a source/destination overlap before cloning or copying", async () => {
    const fixture = await repositoryFixture();
    const source = path.join(fixture.root, "overlap-source");
    const review = path.join(source, "review");
    const filename = "hyperfocus-rain-soft.mp3";
    const bytes = Buffer.from("overlap-audio");
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, filename), bytes);

    expect(() =>
      bootstrapHumanReviewWorkspace({
        audioInventory: [
          {
            filename,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          },
        ],
        audioReviewPath: review,
        audioSourcePath: source,
        controlPath: path.join(fixture.root, "overlap-control"),
        expectedRemote: fixture.remote,
        workspaceFile: path.join(fixture.root, "overlap.code-workspace"),
      })
    ).toThrowError(/HUMAN_REVIEW_PATH_OVERLAP/);
  });

  it("rejects a human-review main clone containing ignored local state", async () => {
    const fixture = await repositoryFixture();
    const source = path.join(fixture.root, "ignored-human-source");
    const control = path.join(fixture.root, "ignored-human-control");
    const review = path.join(fixture.root, "ignored-human-review");
    const workspaceFile = path.join(fixture.root, "ignored-human.code-workspace");
    const filename = "hyperfocus-rain-soft.mp3";
    const bytes = Buffer.from("ignored-human-audio");
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, filename), bytes);

    expect(() =>
      bootstrapWithRaceHooks(
        {
          audioInventory: [
            {
              filename,
              sha256: createHash("sha256").update(bytes).digest("hex"),
            },
          ],
          audioReviewPath: review,
          audioSourcePath: source,
          controlPath: control,
          expectedRemote: fixture.remote,
          workspaceFile,
        },
        {
          afterControlCloned: () => {
            writeFileSync(path.join(control, ".git", "info", "exclude"), ".env\n");
            writeFileSync(path.join(control, ".env"), "hidden-local-state\n");
          },
        }
      )
    ).toThrowError(/HUMAN_MAIN_PROOF_FAILED/);
    await expect(readFile(path.join(control, ".env"), "utf8")).resolves.toBe(
      "hidden-local-state\n"
    );
  });

  it("rejects a source/destination overlap hidden behind a symlinked ancestor", async () => {
    const fixture = await repositoryFixture();
    const source = path.join(fixture.root, "symlink-overlap-source");
    const alias = path.join(fixture.root, "symlink-overlap-alias");
    const filename = "hyperfocus-rain-soft.mp3";
    const bytes = Buffer.from("symlink-overlap-audio");
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, filename), bytes);
    await symlink(source, alias, "dir");

    expect(() =>
      bootstrapHumanReviewWorkspace({
        audioInventory: [
          {
            filename,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          },
        ],
        audioReviewPath: path.join(alias, "nested-review"),
        audioSourcePath: source,
        controlPath: path.join(fixture.root, "symlink-overlap-control"),
        expectedRemote: fixture.remote,
        workspaceFile: path.join(fixture.root, "symlink-overlap.code-workspace"),
      })
    ).toThrowError(/HUMAN_REVIEW_PATH_OVERLAP/);
  });

  it.skipIf(process.platform === "win32")(
    "refuses a human-review destination ancestor replacement after validation",
    async () => {
      const fixture = await repositoryFixture();
      const source = path.join(fixture.root, "ancestor-race-source");
      const targetRoot = path.join(fixture.root, "ancestor-race-targets");
      const movedRoot = `${targetRoot}-moved`;
      const filename = "hyperfocus-rain-soft.mp3";
      const bytes = Buffer.from("ancestor-race-audio");
      await mkdir(source, { recursive: true });
      await mkdir(targetRoot, { recursive: true });
      await writeFile(path.join(source, filename), bytes);

      expect(() =>
        bootstrapWithRaceHooks(
          {
            audioInventory: [
              {
                filename,
                sha256: createHash("sha256").update(bytes).digest("hex"),
              },
            ],
            audioReviewPath: path.join(targetRoot, "review"),
            audioSourcePath: source,
            controlPath: path.join(targetRoot, "control"),
            expectedRemote: fixture.remote,
            workspaceFile: path.join(targetRoot, "review.code-workspace"),
          },
          {
            afterDestinationBindingsCaptured: () => {
              renameSync(targetRoot, movedRoot);
              symlinkSync(movedRoot, targetRoot, "dir");
            },
          }
        )
      ).toThrowError(/HUMAN_REVIEW_PATH_RACE/);
      expect((await lstat(targetRoot)).isSymbolicLink()).toBe(true);
    }
  );

  it.skipIf(process.platform === "win32")(
    "refuses a human-review final-component replacement before file writes",
    async () => {
      const fixture = await repositoryFixture();
      const source = path.join(fixture.root, "component-race-source");
      const targetRoot = path.join(fixture.root, "component-race-targets");
      const review = path.join(targetRoot, "review");
      const movedReview = `${review}-moved`;
      const filename = "hyperfocus-rain-soft.mp3";
      const bytes = Buffer.from("component-race-audio");
      await mkdir(source, { recursive: true });
      await mkdir(targetRoot, { recursive: true });
      await writeFile(path.join(source, filename), bytes);

      expect(() =>
        bootstrapWithRaceHooks(
          {
            audioInventory: [
              {
                filename,
                sha256: createHash("sha256").update(bytes).digest("hex"),
              },
            ],
            audioReviewPath: review,
            audioSourcePath: source,
            controlPath: path.join(targetRoot, "control"),
            expectedRemote: fixture.remote,
            workspaceFile: path.join(targetRoot, "review.code-workspace"),
          },
          {
            afterAudioReviewDirectoryCreated: () => {
              renameSync(review, movedReview);
              symlinkSync(movedReview, review, "dir");
            },
          }
        )
      ).toThrowError(/HUMAN_REVIEW_PATH_RACE/);
      expect((await lstat(review)).isSymbolicLink()).toBe(true);
      await expect(stat(path.join(movedReview, "hyperfocus", filename))).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
  );

  it("rechecks the bounded file size after open before allocating", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "zenflow-bounded-file-"));
    roots.push(root);
    const candidate = path.join(root, "candidate.bin");
    await writeFile(candidate, "12345678");

    expect(() =>
      readBoundedRegularFileForTest({
        afterLstat: () => writeFileSync(candidate, Buffer.alloc(1024 * 1024)),
        filePath: candidate,
        maxBytes: 16,
      })
    ).toThrowError(/TEST_BOUNDED_FILE_(?:RACE|SIZE)/);
  });

  it("creates a unique locked feature worktree without touching caller changes", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-safe-sync");
    const before = git(fixture.control, ["rev-parse", "HEAD"]).trim();

    const result = createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "safe-sync",
    });

    expect(result).toMatchObject({
      branch: "codex/safe-sync",
      destination,
      locked: true,
    });
    expect(result.workspaceFile).toBe(`${destination}.code-workspace`);
    expect(JSON.parse(await readFile(result.workspaceFile, "utf8"))).toMatchObject({
      folders: [{ name: "ZenFlow — CODEX — safe-sync", path: destination }],
      settings: {
        "git.autoRepositoryDetection": false,
        "git.detectWorktrees": false,
        "git.openRepositoryInParentFolders": "never",
        "git.repositoryScanMaxDepth": 1,
        "git.scanRepositories": [],
        "window.title": "${rootName} — ${activeEditorShort}",
      },
    });
    expect(git(fixture.control, ["status", "--short"])).toBe("");
    expect(git(fixture.control, ["rev-parse", "HEAD"]).trim()).toBe(before);

    const workspace = inspectWorkspace({ cwd: destination, expectedRemote: fixture.remote });
    expect(workspace).toMatchObject({
      branch: "codex/safe-sync",
      clean: true,
      detached: false,
      locked: true,
    });
  });

  it("refuses worktree creation from a dirty integration lane without touching its files", async () => {
    const fixture = await repositoryFixture();
    await writeFile(path.join(fixture.control, "keep-local.txt"), "must survive\n", "utf8");

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination: path.join(fixture.root, "worktrees", "codex-dirty"),
        expectedRemote: fixture.remote,
        task: "dirty",
      })
    ).toThrowError(/DIRTY_WORKTREE/);
    expect(git(fixture.control, ["status", "--short"])).toContain("?? keep-local.txt");
  });

  it("inventories ignored local paths without treating them as transferred work", async () => {
    const fixture = await repositoryFixture();
    const excludesFile = path.join(fixture.root, "control-global-excludes");
    await writeFile(excludesFile, ".env\n", "utf8");
    git(fixture.control, ["config", "core.excludesFile", excludesFile]);
    await writeFile(path.join(fixture.control, ".env"), "owner-local\n", "utf8");

    expect(
      inspectWorkspace({
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toMatchObject({
      clean: true,
      ignoredPaths: [".env"],
    });
  });

  it("refuses lane creation from a control main containing ignored local state", async () => {
    const fixture = await repositoryFixture();
    const excludesFile = path.join(fixture.root, "control-create-global-excludes");
    await writeFile(excludesFile, ".env\n", "utf8");
    git(fixture.control, ["config", "core.excludesFile", excludesFile]);
    await writeFile(path.join(fixture.control, ".env"), "owner-local\n", "utf8");

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination: path.join(fixture.root, "worktrees", "codex-ignored-control"),
        expectedRemote: fixture.remote,
        task: "ignored-control",
      })
    ).toThrowError(/DIRTY_WORKTREE/);
    await expect(readFile(path.join(fixture.control, ".env"), "utf8")).resolves.toBe(
      "owner-local\n"
    );
  });

  it("refuses lane creation when control main is not the exact fetched origin/main", async () => {
    const fixture = await repositoryFixture();
    await commitAndPush(fixture.peer, "remote.txt", "remote\n", "remote advance");

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination: path.join(fixture.root, "worktrees", "codex-stale-control"),
        expectedRemote: fixture.remote,
        task: "stale-control",
      })
    ).toThrowError(/OUTDATED_CONTROL/);
  });

  it("refuses lane creation when the registry contains more than one main worktree", async () => {
    const fixture = await repositoryFixture();
    const duplicateMain = path.join(fixture.root, "duplicate-main");
    git(fixture.control, ["worktree", "add", "--force", duplicateMain, "main"]);

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination: path.join(fixture.root, "worktrees", "codex-invalid-topology"),
        expectedRemote: fixture.remote,
        task: "invalid-topology",
      })
    ).toThrowError(/MAIN_LANE_COUNT/);
  });

  it("refuses lane creation anywhere under an output directory", async () => {
    const fixture = await repositoryFixture();

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination: path.join(fixture.root, "output", "worktrees", "codex-output"),
        expectedRemote: fixture.remote,
        task: "output-path",
      })
    ).toThrowError(/INVALID_CREATE_REQUEST/);
  });

  it("refuses lane creation through a symlinked ancestor that resolves under output", async () => {
    const fixture = await repositoryFixture();
    const outputWorktrees = path.join(fixture.root, "output", "worktrees");
    const alias = path.join(fixture.root, "worktree-alias");
    await mkdir(outputWorktrees, { recursive: true });
    await symlink(outputWorktrees, alias, "dir");

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination: path.join(alias, "codex-output-alias"),
        expectedRemote: fixture.remote,
        task: "output-alias",
      })
    ).toThrowError(/INVALID_CREATE_REQUEST/);
  });

  it("refuses lane creation inside another Git repository", async () => {
    const fixture = await repositoryFixture();
    const foreignRepository = path.join(fixture.root, "foreign-repository");
    await mkdir(foreignRepository, { recursive: true });
    git(foreignRepository, ["init", "--initial-branch=main"]);

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination: path.join(foreignRepository, "worktrees", "codex-nested"),
        expectedRemote: fixture.remote,
        task: "nested-repository",
      })
    ).toThrowError(/NESTED_REPOSITORY_TARGET/);
  });

  it("rejects the retired Kimi actor even when the branch prefix matches", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-cli-actor");
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "cli-actor",
    });
    git(destination, [
      "remote",
      "set-url",
      "origin",
      "https://github.com/Yehor212/people-first-app.git",
    ]);
    git(destination, ["branch", "-m", "kimi/cli-actor"]);

    const result = spawnSync(
      process.execPath,
      [WORKSPACE_CLI, "doctor", "--mode", "edit", "--agent", "kimi", "--json"],
      { cwd: destination, encoding: "utf8" }
    );
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(output).toMatchObject({ status: "STOP", ok: false });
    expect(output.errors).toContain('edit mode requires --agent "codex"');
  });

  it("rolls back only exact newly created artifacts when worktree checkout fails", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-hook-failure");
    const branch = "codex/hook-failure";
    const hooksPath = path.resolve(
      fixture.control,
      git(fixture.control, ["rev-parse", "--git-path", "hooks"]).trim()
    );
    const postCheckout = path.join(hooksPath, "post-checkout");
    await writeFile(postCheckout, "#!/usr/bin/env sh\nexit 1\n", { mode: 0o700 });
    await chmod(postCheckout, 0o700);

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination,
        expectedRemote: fixture.remote,
        task: "hook-failure",
      })
    ).toThrowError(/GIT_COMMAND_FAILED/);
    expect(git(fixture.control, ["worktree", "list", "--porcelain"])).not.toContain(destination);
    expect(
      spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
        cwd: fixture.control,
      }).status
    ).not.toBe(0);
    await expect(stat(`${destination}.code-workspace`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("refuses failed-creation rollback when a checkout hook leaves an ignored .env", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-ignored-recovery");
    const branch = "codex/ignored-recovery";
    const excludesFile = path.join(fixture.root, "worktree-global-excludes");
    await writeFile(excludesFile, ".env\n", "utf8");
    git(fixture.control, ["config", "core.excludesFile", excludesFile]);
    const hooksPath = path.resolve(
      fixture.control,
      git(fixture.control, ["rev-parse", "--git-path", "hooks"]).trim()
    );
    const postCheckout = path.join(hooksPath, "post-checkout");
    await writeFile(
      postCheckout,
      "#!/usr/bin/env sh\nprintf 'owner recovery\\n' > .env\nexit 1\n",
      { mode: 0o700 }
    );
    await chmod(postCheckout, 0o700);

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination,
        expectedRemote: fixture.remote,
        task: "ignored-recovery",
      })
    ).toThrowError(/WORKTREE_CREATE_ROLLBACK_REFUSED/);
    await expect(readFile(path.join(destination, ".env"), "utf8")).resolves.toBe(
      "owner recovery\n"
    );
    expect(git(fixture.control, ["worktree", "list", "--porcelain"])).toContain(destination);
    expect(
      spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
        cwd: fixture.control,
      }).status
    ).toBe(0);
    await expect(stat(`${destination}.code-workspace`)).resolves.toBeDefined();
  });

  it("rejects a successfully checked-out lane when a hook leaves an ignored .env", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-ignored-success");
    const excludesFile = path.join(fixture.root, "worktree-success-global-excludes");
    await writeFile(excludesFile, ".env\n", "utf8");
    git(fixture.control, ["config", "core.excludesFile", excludesFile]);
    const hooksPath = path.resolve(
      fixture.control,
      git(fixture.control, ["rev-parse", "--git-path", "hooks"]).trim()
    );
    const postCheckout = path.join(hooksPath, "post-checkout");
    await writeFile(
      postCheckout,
      "#!/usr/bin/env sh\nprintf 'hidden lane state\\n' > .env\nexit 0\n",
      { mode: 0o700 }
    );
    await chmod(postCheckout, 0o700);

    expect(() =>
      createWorkspace({
        agent: "codex",
        cwd: fixture.control,
        destination,
        expectedRemote: fixture.remote,
        task: "ignored-success",
      })
    ).toThrowError(/WORKTREE_CREATION_PROOF_FAILED/);
    await expect(readFile(path.join(destination, ".env"), "utf8")).resolves.toBe(
      "hidden lane state\n"
    );
  });

  it.skipIf(process.platform === "win32")(
    "refuses a final-component replacement after worktree checkout",
    async () => {
      const fixture = await repositoryFixture();
      const destination = path.join(fixture.root, "worktrees", "codex-final-component-race");
      const hooksPath = path.resolve(
        fixture.control,
        git(fixture.control, ["rev-parse", "--git-path", "hooks"]).trim()
      );
      const postCheckout = path.join(hooksPath, "post-checkout");
      await writeFile(
        postCheckout,
        [
          "#!/usr/bin/env sh",
          'moved="${PWD}-moved"',
          'mv "$PWD" "$moved"',
          'ln -s "$moved" "$PWD"',
          "",
        ].join("\n"),
        { mode: 0o700 }
      );
      await chmod(postCheckout, 0o700);

      expect(() =>
        createWorkspace({
          agent: "codex",
          cwd: fixture.control,
          destination,
          expectedRemote: fixture.remote,
          task: "final-component-race",
        })
      ).toThrowError(/WORKSPACE_PATH_RACE/);
      expect((await lstat(destination)).isSymbolicLink()).toBe(true);
      expect(hasRef(fixture.control, "refs/heads/codex/final-component-race")).toBe(true);
    }
  );

  it.skipIf(process.platform === "win32")(
    "refuses an ancestor replacement after worktree checkout",
    async () => {
      const fixture = await repositoryFixture();
      const laneRoot = path.join(fixture.root, "lane-root");
      const destination = path.join(laneRoot, "worktrees", "codex-ancestor-race");
      const hooksPath = path.resolve(
        fixture.control,
        git(fixture.control, ["rev-parse", "--git-path", "hooks"]).trim()
      );
      const postCheckout = path.join(hooksPath, "post-checkout");
      await writeFile(
        postCheckout,
        [
          "#!/usr/bin/env sh",
          'worktrees="$(dirname "$PWD")"',
          'ancestor="$(dirname "$worktrees")"',
          'moved="${ancestor}-moved"',
          'mv "$ancestor" "$moved"',
          'ln -s "$moved" "$ancestor"',
          "",
        ].join("\n"),
        { mode: 0o700 }
      );
      await chmod(postCheckout, 0o700);

      expect(() =>
        createWorkspace({
          agent: "codex",
          cwd: fixture.control,
          destination,
          expectedRemote: fixture.remote,
          task: "ancestor-race",
        })
      ).toThrowError(/WORKSPACE_PATH_RACE/);
      expect((await lstat(laneRoot)).isSymbolicLink()).toBe(true);
      expect(hasRef(fixture.control, "refs/heads/codex/ancestor-race")).toBe(true);
    }
  );

  it("fetches by default without changing a clean checkout", async () => {
    const fixture = await repositoryFixture();
    await commitAndPush(fixture.peer, "remote.txt", "remote\n", "remote advance");
    const before = git(fixture.control, ["rev-parse", "HEAD"]).trim();

    const result = syncWorkspace({
      cwd: fixture.control,
      expectedRemote: fixture.remote,
    });

    expect(result.action).toBe("fetch-only");
    expect(result.behind).toBe(1);
    expect(git(fixture.control, ["rev-parse", "HEAD"]).trim()).toBe(before);
  });

  it("refuses sync when the shared registry contains multiple main lanes", async () => {
    const fixture = await repositoryFixture();
    git(fixture.control, [
      "worktree",
      "add",
      "--force",
      path.join(fixture.root, "duplicate-main-sync"),
      "main",
    ]);

    expect(() =>
      syncWorkspace({
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/MAIN_LANE_COUNT/);
  });

  it("retains stale remote-tracking recovery refs during create, sync, and handoff fetches", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-ref-recovery");
    git(fixture.control, ["config", "remote.origin.prune", "true"]);

    const createRef = await leaveStaleRemoteTrackingRef(
      fixture,
      fixture.control,
      "recovery/create"
    );
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "ref-recovery",
    });
    expect(hasRef(fixture.control, createRef)).toBe(true);

    const syncRef = await leaveStaleRemoteTrackingRef(fixture, fixture.control, "recovery/sync");
    syncWorkspace({
      cwd: fixture.control,
      expectedRemote: fixture.remote,
    });
    expect(hasRef(fixture.control, syncRef)).toBe(true);

    await commit(destination, "candidate.txt", "tracked\n", "candidate");
    git(destination, ["push", "-u", "origin", "HEAD"]);
    const handoffRef = await leaveStaleRemoteTrackingRef(fixture, destination, "recovery/handoff");
    handoffWorkspace({
      cwd: destination,
      expectedRemote: fixture.remote,
    });
    expect(hasRef(destination, handoffRef)).toBe(true);
  }, 15_000);

  it("fast-forwards only with explicit apply on a clean behind-only main", async () => {
    const fixture = await repositoryFixture();
    await commitAndPush(fixture.peer, "remote.txt", "remote\n", "remote advance");
    const expected = git(fixture.peer, ["rev-parse", "HEAD"]).trim();

    const result = syncWorkspace({
      apply: true,
      cwd: fixture.control,
      expectedRemote: fixture.remote,
    });

    expect(result.action).toBe("fast-forward");
    expect(result.head).toBe(expected);
    expect(git(fixture.control, ["rev-parse", "HEAD"]).trim()).toBe(expected);
  });

  it("refuses an exact incoming collision with an ignored local file before fast-forward", async () => {
    const fixture = await repositoryFixture();
    const excludesFile = path.join(fixture.root, "collision-global-excludes");
    await writeFile(excludesFile, "collision.env\n", "utf8");
    git(fixture.control, ["config", "core.excludesFile", excludesFile]);
    await writeFile(path.join(fixture.control, "collision.env"), "owner-local\n", "utf8");
    await commitAndPush(
      fixture.peer,
      "collision.env",
      "incoming-tracked\n",
      "incoming ignored collision"
    );
    const before = git(fixture.control, ["rev-parse", "HEAD"]).trim();

    expect(() =>
      syncWorkspace({
        apply: true,
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/IGNORED_LOCAL_STATE/);
    expect(git(fixture.control, ["rev-parse", "HEAD"]).trim()).toBe(before);
    await expect(readFile(path.join(fixture.control, "collision.env"), "utf8")).resolves.toBe(
      "owner-local\n"
    );
  });

  it("refuses an incoming descendant of an ignored local file before fast-forward", async () => {
    const fixture = await repositoryFixture();
    const excludesFile = path.join(fixture.root, "ancestor-collision-global-excludes");
    await writeFile(excludesFile, "collision-parent\n", "utf8");
    git(fixture.control, ["config", "core.excludesFile", excludesFile]);
    await writeFile(path.join(fixture.control, "collision-parent"), "owner-local\n", "utf8");
    await commitAndPush(
      fixture.peer,
      "collision-parent/incoming.txt",
      "incoming-tracked\n",
      "incoming ignored ancestor collision"
    );
    const before = git(fixture.control, ["rev-parse", "HEAD"]).trim();

    expect(() =>
      syncWorkspace({
        apply: true,
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/IGNORED_LOCAL_STATE/);
    expect(git(fixture.control, ["rev-parse", "HEAD"]).trim()).toBe(before);
    await expect(readFile(path.join(fixture.control, "collision-parent"), "utf8")).resolves.toBe(
      "owner-local\n"
    );
  });

  it("refuses apply before a post-merge hook can mutate non-colliding ignored state", async () => {
    const fixture = await repositoryFixture();
    const excludesFile = path.join(fixture.root, "noncollision-global-excludes");
    await writeFile(excludesFile, ".env\n", "utf8");
    git(fixture.control, ["config", "core.excludesFile", excludesFile]);
    await writeFile(path.join(fixture.control, ".env"), "owner-local\n", "utf8");
    const hooksPath = path.resolve(
      fixture.control,
      git(fixture.control, ["rev-parse", "--git-path", "hooks"]).trim()
    );
    const postMerge = path.join(hooksPath, "post-merge");
    await writeFile(
      postMerge,
      "#!/usr/bin/env sh\nprintf 'mutated-by-hook\\n' > .env\nexit 0\n",
      { mode: 0o700 }
    );
    await chmod(postMerge, 0o700);
    await commitAndPush(
      fixture.peer,
      "incoming.txt",
      "incoming-tracked\n",
      "non-colliding incoming path"
    );
    const before = git(fixture.control, ["rev-parse", "HEAD"]).trim();

    expect(() =>
      syncWorkspace({
        apply: true,
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/IGNORED_LOCAL_STATE/);
    expect(git(fixture.control, ["rev-parse", "HEAD"]).trim()).toBe(before);
    await expect(readFile(path.join(fixture.control, ".env"), "utf8")).resolves.toBe(
      "owner-local\n"
    );
    expect(
      inspectWorkspace({
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      }).ignoredPaths
    ).toEqual([".env"]);
  });

  it("refuses apply when untracked work exists and preserves HEAD", async () => {
    const fixture = await repositoryFixture();
    await commitAndPush(fixture.peer, "remote.txt", "remote\n", "remote advance");
    await writeFile(path.join(fixture.control, "untracked.txt"), "owner work\n", "utf8");
    const before = git(fixture.control, ["rev-parse", "HEAD"]).trim();

    expect(() =>
      syncWorkspace({
        apply: true,
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/DIRTY_WORKTREE/);
    expect(git(fixture.control, ["rev-parse", "HEAD"]).trim()).toBe(before);
    expect(git(fixture.control, ["status", "--short"])).toContain("?? untracked.txt");
  });

  it("refuses ahead and diverged histories without stash, reset, or rebase", async () => {
    const fixture = await repositoryFixture();
    await commit(fixture.control, "local.txt", "local\n", "local-only commit");
    await commitAndPush(fixture.peer, "remote.txt", "remote\n", "remote-only commit");
    const before = git(fixture.control, ["rev-parse", "HEAD"]).trim();

    expect(() =>
      syncWorkspace({
        apply: true,
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/DIVERGED/);
    expect(git(fixture.control, ["rev-parse", "HEAD"]).trim()).toBe(before);
    expect(git(fixture.control, ["log", "-1", "--format=%s"]).trim()).toBe("local-only commit");
  });

  it("keeps feature lanes fetch-only even when a fast-forward would be possible", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-fetch-only");
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "fetch-only",
    });
    await commitAndPush(fixture.peer, "remote.txt", "remote\n", "remote advance");
    const before = git(destination, ["rev-parse", "HEAD"]).trim();

    expect(() =>
      syncWorkspace({
        apply: true,
        cwd: destination,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/FEATURE_SYNC_REFUSED/);
    expect(git(destination, ["rev-parse", "HEAD"]).trim()).toBe(before);
  });

  it("requires an exact reviewed SHA before applying protected incoming files", async () => {
    const fixture = await repositoryFixture();
    await mkdir(path.join(fixture.peer, "docs", "ai"), { recursive: true });
    await commitAndPush(
      fixture.peer,
      "docs/ai/REMOTE_AGENT_RULE.md",
      "# Incoming agent rule\n",
      "protected advance"
    );
    const remoteHead = git(fixture.peer, ["rev-parse", "HEAD"]).trim();

    expect(() =>
      syncWorkspace({
        apply: true,
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/PROTECTED_INCOMING_REVIEW_REQUIRED/);

    const result = syncWorkspace({
      apply: true,
      cwd: fixture.control,
      expectedRemote: fixture.remote,
      reviewedSha: remoteHead,
    });
    expect(result).toMatchObject({
      action: "fast-forward",
      head: remoteHead,
      restartRequired: true,
    });
  });

  it("treats every incoming scripts path as protected", async () => {
    const fixture = await repositoryFixture();
    await commitAndPush(
      fixture.peer,
      "scripts/unrelated-but-executable.mjs",
      "process.stdout.write('review me\\n');\n",
      "protected script advance"
    );

    expect(() =>
      syncWorkspace({
        apply: true,
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/PROTECTED_INCOMING_REVIEW_REQUIRED/);
  });

  it("refuses synchronization from detached HEAD", async () => {
    const fixture = await repositoryFixture();
    git(fixture.control, ["switch", "--detach"]);

    expect(() =>
      syncWorkspace({
        apply: true,
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/DETACHED_HEAD/);
  });

  it("rejects a repository whose origin does not match the expected remote", async () => {
    const fixture = await repositoryFixture();

    expect(() =>
      inspectWorkspace({
        cwd: fixture.control,
        expectedRemote: "https://github.com/example/not-zenflow.git",
      })
    ).toThrowError(/REMOTE_MISMATCH/);
  });

  it("rejects a repository whose origin push URL does not match the expected remote", async () => {
    const fixture = await repositoryFixture();
    git(fixture.control, [
      "remote",
      "set-url",
      "--push",
      "origin",
      "https://github.com/example/exfiltration-target.git",
    ]);

    expect(() =>
      inspectWorkspace({
        cwd: fixture.control,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/REMOTE_(?:PUSH_)?MISMATCH/);
  });

  it.each([
    ["insecure HTTP", "http://github.com/Yehor212/people-first-app.git"],
    ["explicit SSH port", "ssh://git@github.com:2222/Yehor212/people-first-app.git"],
    ["query-bearing HTTPS", "https://github.com/Yehor212/people-first-app.git?transport=unsafe"],
  ])("rejects a noncanonical canonical-repository remote: %s", async (_label, remote) => {
    const fixture = await repositoryFixture();
    git(fixture.control, ["remote", "set-url", "origin", remote]);

    expect(() =>
      inspectWorkspace({
        cwd: fixture.control,
        expectedRemote: "https://github.com/Yehor212/people-first-app.git",
      })
    ).toThrowError(/(?:NONCANONICAL_REMOTE_URL|UNSAFE_REMOTE_URL)/);
  });

  it("rejects credential-bearing HTTPS remotes without printing the credential", async () => {
    const fixture = await repositoryFixture();
    git(fixture.control, [
      "remote",
      "set-url",
      "origin",
      "https://embedded-user:embedded-secret@github.com/Yehor212/people-first-app.git",
    ]);

    let failure: Error | null = null;
    try {
      inspectWorkspace({
        cwd: fixture.control,
        expectedRemote: "https://github.com/Yehor212/people-first-app.git",
      });
    } catch (error) {
      failure = error as Error;
    }
    expect(failure?.message).toMatch(/^CREDENTIAL_BEARING_REMOTE:/);
    expect(failure?.message).not.toContain("embedded-user");
    expect(failure?.message).not.toContain("embedded-secret");
  });

  it("accepts handoff only after a locked feature branch is clean and exactly pushed", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-audio");
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "audio",
    });
    await commit(destination, "candidate.txt", "tracked\n", "candidate");
    git(destination, ["push", "-u", "origin", "HEAD"]);

    const receipt = handoffWorkspace({
      cwd: destination,
      expectedRemote: fixture.remote,
    });

    expect(receipt).toMatchObject({
      baseSha: expect.stringMatching(/^[0-9a-f]{40,64}$/),
      branch: "codex/audio",
      changedPaths: ["candidate.txt"],
      clean: true,
      ready: true,
      verificationDone: {
        present: false,
        sha256: null,
      },
    });
    expect(receipt.head).toBe(receipt.upstreamHead);

    const verificationPath = path.join(destination, ".verification-done");
    await writeFile(verificationPath, "x".repeat(256 * 1024 + 1), "utf8");
    expect(() =>
      handoffWorkspace({
        cwd: destination,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/UNSAFE_VERIFICATION_RECEIPT/);
    await rm(verificationPath);

    if (process.platform !== "win32") {
      await symlink(path.join(destination, "candidate.txt"), verificationPath);
      expect(() =>
        handoffWorkspace({
          cwd: destination,
          expectedRemote: fixture.remote,
        })
      ).toThrowError(/UNSAFE_VERIFICATION_RECEIPT/);
      await rm(verificationPath);
    }

    await writeFile(path.join(destination, "forgotten.txt"), "not handed off\n", "utf8");
    expect(() =>
      handoffWorkspace({
        cwd: destination,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/DIRTY_WORKTREE/);
  }, 30_000);

  it("refuses handoff for the retired Kimi branch namespace", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-retired-actor");
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "retired-actor",
    });
    git(destination, ["branch", "-m", "kimi/retired-actor"]);
    await commit(destination, "candidate.txt", "tracked\n", "candidate");
    git(destination, ["push", "-u", "origin", "HEAD"]);

    expect(() =>
      handoffWorkspace({
        cwd: destination,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/INVALID_AGENT_BRANCH/);
  }, 30_000);

  it("refuses handoff when the shared registry contains multiple main lanes", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-topology-handoff");
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "topology-handoff",
    });
    await commit(destination, "handoff.txt", "handoff\n", "handoff");
    git(destination, ["push", "-u", "origin", "HEAD"]);
    git(fixture.control, [
      "worktree",
      "add",
      "--force",
      path.join(fixture.root, "duplicate-main-handoff"),
      "main",
    ]);

    expect(() =>
      handoffWorkspace({
        cwd: destination,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/MAIN_LANE_COUNT/);
  });

  it("marks ignored local paths as excluded and unverified in the handoff receipt", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-local-env");
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "local-env",
    });
    const excludesFile = path.join(fixture.root, "handoff-global-excludes");
    await writeFile(excludesFile, ".env\n", "utf8");
    git(destination, ["config", "core.excludesFile", excludesFile]);
    await writeFile(path.join(destination, ".env"), "owner-local\n", "utf8");
    await commit(destination, "candidate.txt", "tracked\n", "candidate");
    git(destination, ["push", "-u", "origin", "HEAD"]);

    const receipt = handoffWorkspace({
      cwd: destination,
      expectedRemote: fixture.remote,
    });

    expect(receipt).toMatchObject({
      changedPaths: ["candidate.txt"],
      ignoredLocalState: {
        includedInHandoff: false,
        pathCount: 1,
        preservationVerified: false,
      },
      ready: true,
    });
    await expect(readFile(path.join(destination, ".env"), "utf8")).resolves.toBe("owner-local\n");
    expect(git(destination, ["ls-tree", "--name-only", receipt.upstreamHead])).not.toContain(
      ".env"
    );
  }, 30_000);

  it("refuses handoff when only a stale retained remote-tracking branch remains", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-stale-upstream");
    const branch = "codex/stale-upstream";
    const remoteTrackingRef = `refs/remotes/origin/${branch}`;
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "stale-upstream",
    });
    await commit(destination, "candidate.txt", "tracked\n", "candidate");
    git(destination, ["push", "-u", "origin", "HEAD"]);
    expect(hasRef(destination, remoteTrackingRef)).toBe(true);
    git(fixture.peer, ["push", "origin", "--delete", branch]);

    expect(() =>
      handoffWorkspace({
        cwd: destination,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/REMOTE_BRANCH_MISSING/);
    expect(hasRef(destination, remoteTrackingRef)).toBe(true);
  });

  it("hands off an exact pushed feature tip even when main advanced after lane creation", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-concurrent-main");
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "concurrent-main",
    });
    const originalMain = git(fixture.control, ["rev-parse", "HEAD"]).trim();
    await commit(destination, "feature.txt", "feature\n", "feature work");
    await commitAndPush(fixture.peer, "main-advance.txt", "main\n", "main advance");
    const currentMain = git(fixture.peer, ["rev-parse", "HEAD"]).trim();
    git(destination, ["push", "-u", "origin", "HEAD"]);

    const receipt = handoffWorkspace({
      cwd: destination,
      expectedRemote: fixture.remote,
    });

    expect(receipt).toMatchObject({
      baseSha: originalMain,
      behindMain: 1,
      head: receipt.upstreamHead,
      originMain: currentMain,
      ready: true,
    });
  });

  it("refuses an oversized handoff path manifest", async () => {
    const fixture = await repositoryFixture();
    const destination = path.join(fixture.root, "worktrees", "codex-oversized");
    createWorkspace({
      agent: "codex",
      cwd: fixture.control,
      destination,
      expectedRemote: fixture.remote,
      task: "oversized",
    });
    const generated = path.join(destination, "generated");
    await mkdir(generated, { recursive: true });
    await Promise.all(
      Array.from({ length: 501 }, (_, index) =>
        writeFile(
          path.join(generated, `file-${String(index).padStart(3, "0")}.txt`),
          `${index}\n`,
          "utf8"
        )
      )
    );
    git(destination, ["add", "--", "generated"]);
    git(destination, ["commit", "-m", "oversized handoff"]);
    git(destination, ["push", "-u", "origin", "HEAD"]);

    expect(() =>
      handoffWorkspace({
        cwd: destination,
        expectedRemote: fixture.remote,
      })
    ).toThrowError(/HANDOFF_PATH_LIMIT_EXCEEDED/);
  });
});

async function humanReviewFixture(label: string): Promise<HumanReviewFixture> {
  const fixture = await repositoryFixture();
  const source = path.join(fixture.root, `${label}-source`);
  const control = path.join(fixture.root, `${label}-control`);
  const review = path.join(fixture.root, `${label}-review`);
  const workspaceFile = path.join(fixture.root, `${label}.code-workspace`);
  const filename = "hyperfocus-rain-soft.mp3";
  const bytes = Buffer.from(`fixture-kimi-audio-${label}`);
  const audioInventory = [
    {
      filename,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  ];
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, filename), bytes);
  bootstrapHumanReviewWorkspace({
    audioInventory,
    audioReviewPath: review,
    audioSourcePath: source,
    controlPath: control,
    expectedRemote: fixture.remote,
    workspaceFile,
  });
  return {
    audioInventory,
    control,
    expectedRemote: fixture.remote,
    review,
    workspaceFile,
  };
}

async function makeTreeWritable(candidate: string): Promise<void> {
  let info;
  try {
    info = await lstat(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (info.isSymbolicLink()) return;
  if (!info.isDirectory()) {
    await chmod(candidate, 0o600);
    return;
  }
  await chmod(candidate, 0o700);
  const entries = await readdir(candidate);
  await Promise.all(entries.map((entry) => makeTreeWritable(path.join(candidate, entry))));
}

function inspectHumanFixture(fixture: HumanReviewFixture) {
  return inspectHumanReviewWorkspace({
    audioInventory: fixture.audioInventory,
    audioReviewPath: fixture.review,
    controlPath: fixture.control,
    expectedRemote: fixture.expectedRemote,
    workspaceFile: fixture.workspaceFile,
  });
}

function bootstrapWithRaceHooks(
  input: Parameters<typeof bootstrapHumanReviewWorkspace>[0],
  hooks: BootstrapRaceHooks
): ReturnType<typeof bootstrapHumanReviewWorkspace> {
  const bootstrap = bootstrapHumanReviewWorkspace as unknown as (
    value: Parameters<typeof bootstrapHumanReviewWorkspace>[0] & {
      _testHooks: BootstrapRaceHooks;
    }
  ) => ReturnType<typeof bootstrapHumanReviewWorkspace>;
  return bootstrap({ ...input, _testHooks: hooks });
}

async function repositoryFixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "zenflow-agent-workspace-"));
  roots.push(root);
  const remote = path.join(root, "origin.git");
  const seed = path.join(root, "seed");
  const control = path.join(root, "control");
  const peer = path.join(root, "peer");

  git(root, ["init", "--bare", "--initial-branch=main", remote]);
  await mkdir(seed, { recursive: true });
  git(seed, ["init", "--initial-branch=main"]);
  configureIdentity(seed);
  await writeFile(path.join(seed, "README.md"), "# Fixture\n", "utf8");
  await writeFile(path.join(seed, ".gitignore"), ".verification-done\n", "utf8");
  git(seed, ["add", "README.md", ".gitignore"]);
  git(seed, ["commit", "-m", "initial"]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "main"]);
  git(root, ["clone", remote, control]);
  git(root, ["clone", remote, peer]);
  configureIdentity(control);
  configureIdentity(peer);

  return { control, peer, remote, root };
}

async function commitAndPush(
  cwd: string,
  relativePath: string,
  body: string,
  message: string
): Promise<void> {
  await commit(cwd, relativePath, body, message);
  git(cwd, ["push", "origin", "HEAD"]);
}

async function commit(
  cwd: string,
  relativePath: string,
  body: string,
  message: string
): Promise<void> {
  const absolutePath = path.join(cwd, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, body, "utf8");
  git(cwd, ["add", "--", relativePath]);
  git(cwd, ["commit", "-m", message]);
}

async function leaveStaleRemoteTrackingRef(
  fixture: Fixture,
  fetchCwd: string,
  branch: string
): Promise<string> {
  git(fixture.peer, ["switch", "-c", branch]);
  await commitAndPush(
    fixture.peer,
    `${branch.replaceAll("/", "-")}.txt`,
    "recovery ref\n",
    `create ${branch}`
  );
  git(fixture.peer, ["switch", "main"]);
  git(fetchCwd, ["fetch", "origin"]);
  git(fixture.peer, ["push", "origin", "--delete", branch]);
  const ref = `refs/remotes/origin/${branch}`;
  expect(hasRef(fetchCwd, ref)).toBe(true);
  return ref;
}

function hasRef(cwd: string, ref: string): boolean {
  return (
    spawnSync("git", ["show-ref", "--verify", "--quiet", ref], {
      cwd,
      stdio: "ignore",
    }).status === 0
  );
}

function configureIdentity(cwd: string): void {
  git(cwd, ["config", "user.name", "Agent Workspace Test"]);
  git(cwd, ["config", "user.email", "agent-workspace@example.invalid"]);
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (${result.status})\n${result.stdout || ""}\n${result.stderr || ""}`
    );
  }
  return result.stdout;
}
