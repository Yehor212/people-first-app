import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  aliasLocator,
  classifyRefRelation,
  parseWorktreePorcelain,
  summarizeInventory,
} = require("../convergence-inventory-core.cjs");

describe("convergence inventory pure decisions", () => {
  it("parses branch, detached, locked, and prunable worktrees", () => {
    const fixture = [
      "worktree /repo/control",
      `HEAD ${"a".repeat(40)}`,
      "branch refs/heads/main",
      "",
      "worktree /repo/worktrees/task",
      `HEAD ${"b".repeat(40)}`,
      "detached",
      "locked active task",
      "",
      "worktree /repo/worktrees/stale",
      `HEAD ${"c".repeat(40)}`,
      "branch refs/heads/codex/stale",
      "prunable gitdir file points to non-existent location",
      "",
    ].join("\n");

    expect(parseWorktreePorcelain(fixture)).toEqual([
      {
        path: "/repo/control",
        head: "a".repeat(40),
        branch: "refs/heads/main",
        detached: false,
        locked: false,
        prunable: false,
      },
      {
        path: "/repo/worktrees/task",
        head: "b".repeat(40),
        branch: null,
        detached: true,
        locked: true,
        prunable: false,
      },
      {
        path: "/repo/worktrees/stale",
        head: "c".repeat(40),
        branch: "refs/heads/codex/stale",
        detached: false,
        locked: false,
        prunable: true,
      },
    ]);
  });

  it.each([
    [{ ahead: 0, behind: 137, unique: 0, equivalent: 0 }, "IN_MAIN"],
    [{ ahead: 2, behind: 166, unique: 0, equivalent: 2 }, "PATCH_EQUIVALENT"],
    [{ ahead: 3, behind: 351, unique: 2, equivalent: 1 }, "UNIQUE_COMMITS"],
    [{ ahead: 2, behind: 149, unique: 1, equivalent: 0 }, "UNIQUE_COMMITS"],
    [{ ahead: null, behind: null, unique: null, equivalent: null }, "UNRELATED"],
  ])("classifies %o as %s", (input, expected) => {
    expect(classifyRefRelation(input)).toBe(expected);
  });

  it("rejects inconsistent relation counts", () => {
    expect(() =>
      classifyRefRelation({ ahead: 1, behind: 1, unique: 1, equivalent: 1 })
    ).toThrow(/patch counts cannot exceed ahead/);
  });

  it("uses the longest locator alias and hashes unknown absolute paths", () => {
    const aliases = [
      { alias: "zenflow", path: "/Users/yehor/Projects/ZenFlow" },
      { alias: "worktrees", path: "/Users/yehor/Projects/ZenFlow/worktrees" },
    ];

    expect(
      aliasLocator("/Users/yehor/Projects/ZenFlow/worktrees/codex-task", aliases)
    ).toEqual({ alias: "worktrees", relativePath: "codex-task" });
    expect(aliasLocator("/private/unmapped/repo", aliases)).toEqual({
      alias: "UNALIASED",
      pathHash: "57dc8641d0203256",
    });
  });

  it("summarizes activity, dirty state, refs, and PR ownership separately", () => {
    const summary = summarizeInventory({
      worktrees: [
        { activity: "ACTIVE_SKIP", changeCount: 6 },
        { activity: "FROZEN", changeCount: 0, ignoredCount: 2 },
        { activity: "UNVERIFIED", changeCount: null },
        { activity: "FROZEN", changeCount: 12 },
      ],
      refs: [
        { name: "refs/heads/in-main", classification: "IN_MAIN" },
        { name: "refs/heads/equivalent", classification: "PATCH_EQUIVALENT" },
        { name: "refs/heads/unique", classification: "UNIQUE_COMMITS" },
        { name: "refs/heads/unrelated", classification: "UNRELATED" },
      ],
      pullRequests: [
        { state: "OPEN", authorIsBot: false },
        { state: "OPEN", authorIsBot: true },
        { state: "CLOSED", authorIsBot: false },
      ],
    });

    expect(summary).toEqual({
      worktrees: 4,
      activeSkipWorktrees: 1,
      dirtyWorktrees: 3,
      unverifiedWorktrees: 1,
      refs: 4,
      logicalRefNames: 4,
      inMainRefs: 1,
      patchEquivalentRefs: 1,
      uniqueCommitRefs: 1,
      unrelatedRefs: 1,
      openHumanPullRequests: 1,
      openBotPullRequests: 1,
    });
  });
});
