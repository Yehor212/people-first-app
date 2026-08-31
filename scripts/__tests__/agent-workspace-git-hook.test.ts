import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const HOOK = path.resolve("scripts/agent-workspace-git-hook.cjs");
const CANONICAL_REMOTE = "https://github.com/Yehor212/people-first-app.git";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Codex Git commit and push guard", () => {
  it("blocks commits on main and permits them on an agent feature branch", async () => {
    const root = await repository();

    expect(run(root, ["pre-commit"]).status).toBe(1);
    git(root, ["switch", "-c", "codex/focused-task"]);
    expect(run(root, ["pre-commit"]).status).toBe(0);
  });

  it("blocks every direct main update and permits a new feature branch update", async () => {
    const root = await repository();
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    const zero = "0".repeat(head.length);

    const main = run(root, ["pre-push"], `refs/heads/main ${head} refs/heads/main ${zero}\n`);
    expect(main.status).toBe(1);
    expect(main.stderr).toContain("direct pushes");

    git(root, ["switch", "-c", "codex/focused-task"]);
    const feature = run(
      root,
      ["pre-push"],
      `refs/heads/codex/focused-task ${head} refs/heads/codex/focused-task ${zero}\n`
    );
    expect(feature.status, feature.stderr).toBe(0);
  });

  it("blocks a non-fast-forward feature push", async () => {
    const root = await repository();
    git(root, ["switch", "-c", "codex/task"]);
    const oldHead = git(root, ["rev-parse", "HEAD"]).trim();
    await writeFile(path.join(root, "next.txt"), "next\n", "utf8");
    git(root, ["add", "next.txt"]);
    git(root, ["commit", "-m", "next"]);
    const newHead = git(root, ["rev-parse", "HEAD"]).trim();

    const result = run(
      root,
      ["pre-push"],
      `refs/heads/codex/task ${oldHead} refs/heads/codex/task ${newHead}\n`
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("non-fast-forward");
  });

  it("blocks deleting a remote feature branch that may hold handoff history", async () => {
    const root = await repository();
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    const zero = "0".repeat(head.length);

    const result = run(
      root,
      ["pre-push"],
      `(delete) ${zero} refs/heads/codex/recovery-tip ${head}\n`
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("deleting remote refs");
  });

  it.each([
    ["a tag", "refs/tags/unsafe-release"],
    ["the retired Kimi namespace", "refs/heads/kimi/focused-task"],
    ["a renamed same-agent branch", "refs/heads/codex/other-task"],
    ["an unsupported branch namespace", "refs/heads/shared/focused-task"],
  ])("blocks a feature ref pushed to %s", async (_label, remoteRef) => {
    const root = await repository();
    git(root, ["switch", "-c", "codex/focused-task"]);
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    const zero = "0".repeat(head.length);

    const result = run(
      root,
      ["pre-push"],
      `refs/heads/codex/focused-task ${head} ${remoteRef} ${zero}\n`
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/same-named|tag/);
  });

  it.each(["refs/heads/codex/other-task"])(
    "blocks a same-named update for a branch not checked out in this worktree: %s",
    async (otherRef) => {
      const root = await repository();
      git(root, ["switch", "-c", "codex/current-task"]);
      const head = git(root, ["rev-parse", "HEAD"]).trim();
      const zero = "0".repeat(head.length);

      const result = run(root, ["pre-push"], `${otherRef} ${head} ${otherRef} ${zero}\n`);

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/current worktree branch|checked-out branch/i);
    }
  );

  it("blocks pushes when Git reports a non-canonical remote target", async () => {
    const root = await repository();
    git(root, ["switch", "-c", "codex/task"]);
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    const zero = "0".repeat(head.length);

    const result = run(
      root,
      ["pre-push", "origin", "https://github.com/example/exfiltration-target.git"],
      `refs/heads/codex/task ${head} refs/heads/codex/task ${zero}\n`
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("remote");
  });

  it("blocks credential-bearing canonical-looking push URLs", async () => {
    const root = await repository();
    git(root, ["switch", "-c", "codex/task"]);
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    const zero = "0".repeat(head.length);
    const unsafeRemote =
      "https://fake-user:fake-secret@github.com/Yehor212/people-first-app.git?transport=unsafe#fragment";

    const result = run(
      root,
      ["pre-push", "origin", unsafeRemote],
      `refs/heads/codex/task ${head} refs/heads/codex/task ${zero}\n`
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("remote");
  });
});

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "zenflow-git-hook-"));
  roots.push(root);
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.name", "Git Hook Test"]);
  git(root, ["config", "user.email", "git-hook@example.invalid"]);
  await writeFile(path.join(root, "README.md"), "# Test\n", "utf8");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-m", "initial"]);
  return root;
}

function run(cwd: string, args: string[], input = "") {
  const hookArgs =
    args[0] === "pre-push" && args.length === 1 ? [...args, "origin", CANONICAL_REMOTE] : args;
  return spawnSync(process.execPath, [HOOK, ...hookArgs], {
    cwd,
    encoding: "utf8",
    input,
  });
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
}
