import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const TARGET_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const temporaryDirectories: string[] = [];

type FakeScenario =
  | "success"
  | "failed-job"
  | "pending-job"
  | "pending-then-success";

function runRemoteCiWithFakeGh({
  args,
  scenario = "success",
  headSequence = [TARGET_SHA, TARGET_SHA],
}: {
  args: string[];
  scenario?: FakeScenario;
  headSequence?: string[];
}) {
  const directory = mkdtempSync(join(tmpdir(), "zenflow-remote-ci-"));
  temporaryDirectories.push(directory);
  const binDirectory = join(directory, "bin");
  const tracePath = join(directory, "gh-trace.jsonl");
  const headCallPath = join(directory, "pr-head-calls");
  const runListCallPath = join(directory, "run-list-calls");
  mkdirSync(binDirectory);
  writeFileSync(tracePath, "", "utf8");
  writeFileSync(
    join(binDirectory, "gh"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const tracePath = process.env.ZENFLOW_FAKE_GH_TRACE;
fs.appendFileSync(tracePath, JSON.stringify(args) + "\\n");
const targetSha = process.env.ZENFLOW_FAKE_GH_TARGET_SHA;
const scenario = process.env.ZENFLOW_FAKE_GH_SCENARIO;
const headSequence = process.env.ZENFLOW_FAKE_GH_HEAD_SEQUENCE.split(",");
const headCallPath = process.env.ZENFLOW_FAKE_GH_HEAD_CALL_PATH;
const runListCallPath = process.env.ZENFLOW_FAKE_GH_RUN_LIST_CALL_PATH;
if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write("Logged in to github.com\\n");
  process.exit(0);
}
if (args[0] === "repo" && args[1] === "view") {
  process.stdout.write("Yehor212/people-first-app\\n");
  process.exit(0);
}
if (args[0] === "pr" && args[1] === "view") {
  const count = fs.existsSync(headCallPath) ? Number(fs.readFileSync(headCallPath, "utf8")) : 0;
  fs.writeFileSync(headCallPath, String(count + 1));
  process.stdout.write(JSON.stringify({
    headRefOid: headSequence[Math.min(count, headSequence.length - 1)] || targetSha,
    state: "OPEN"
  }));
  process.exit(0);
}
if (args[0] === "run" && args[1] === "list") {
  const count = fs.existsSync(runListCallPath) ? Number(fs.readFileSync(runListCallPath, "utf8")) : 0;
  fs.writeFileSync(runListCallPath, String(count + 1));
  process.stdout.write(JSON.stringify([
    { databaseId: 1, status: "completed", conclusion: "success", name: "Deploy to GitHub Pages", workflowName: "Deploy to GitHub Pages", event: "pull_request", headSha: targetSha },
    { databaseId: 2, status: "completed", conclusion: "success", name: "Production Data Integrity", workflowName: "Production Data Integrity", event: "pull_request", headSha: targetSha }
  ]));
  process.exit(0);
}
if (args[0] === "run" && args[1] === "view" && args.includes("jobs")) {
  const runId = args[2];
  const runListCalls = fs.existsSync(runListCallPath) ? Number(fs.readFileSync(runListCallPath, "utf8")) : 0;
  const pending = scenario === "pending-job" || (scenario === "pending-then-success" && runListCalls === 1);
  const buildConclusion = scenario === "failed-job" ? "failure" : pending ? null : "success";
  const buildStatus = pending ? "in_progress" : "completed";
  const jobs = runId === "1"
    ? [
        { name: "build", status: buildStatus, conclusion: buildConclusion },
        { name: "android-gate", status: "completed", conclusion: "success" },
        { name: "ios-gate", status: "completed", conclusion: "success" }
      ]
    : [{ name: "production-data-integrity", status: "completed", conclusion: "success" }];
  process.stdout.write(JSON.stringify(jobs));
  process.exit(0);
}
if (args[0] === "run" && args[1] === "view") {
  process.stdout.write("project failure\\n");
  process.exit(0);
}
process.stderr.write("Unexpected gh invocation: " + JSON.stringify(args));
process.exit(64);
`,
    "utf8",
  );
  chmodSync(join(binDirectory, "gh"), 0o755);

  const result = spawnSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/check-remote-ci.ts",
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
        ZENFLOW_FAKE_GH_TRACE: tracePath,
        ZENFLOW_FAKE_GH_TARGET_SHA: TARGET_SHA,
        ZENFLOW_FAKE_GH_SCENARIO: scenario,
        ZENFLOW_FAKE_GH_HEAD_SEQUENCE: headSequence.join(","),
        ZENFLOW_FAKE_GH_HEAD_CALL_PATH: headCallPath,
        ZENFLOW_FAKE_GH_RUN_LIST_CALL_PATH: runListCallPath,
      },
    },
  );
  const trace = readFileSync(tracePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
  return { result, trace };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("check-remote-ci CLI boundary", () => {
  it("binds PR mode to the supplied head SHA and asks GitHub only for pull-request runs", () => {
    const { result, trace } = runRemoteCiWithFakeGh({
      args: ["--wait", "--wait-ms", "60000", "--pr", "44", "--sha", TARGET_SHA],
    });

    expect(result.status, result.stderr).toBe(0);
    expect(trace.filter((args) => args[0] === "pr" && args[1] === "view")).toHaveLength(2);
    const runList = trace.find((args) => args[0] === "run" && args[1] === "list");
    expect(runList).toEqual(
      expect.arrayContaining(["--commit", TARGET_SHA, "--event", "pull_request"]),
    );
  });

  it("fails closed when the PR head changes before the final pass decision", () => {
    const { result } = runRemoteCiWithFakeGh({
      args: ["--pr", "44", "--sha", TARGET_SHA],
      headSequence: [TARGET_SHA, OTHER_SHA],
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("head SHA does not match");
  });

  it.each(["failed-job", "pending-job"] as const)(
    "rejects a required %s result instead of reporting remote CI success",
    (scenario) => {
      const { result } = runRemoteCiWithFakeGh({
        args: ["--pr", "44", "--sha", TARGET_SHA],
        scenario,
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("RESULT: FAIL");
    },
  );

  it("refreshes a pending required job before declaring a wait failure", () => {
    const { result, trace } = runRemoteCiWithFakeGh({
      args: ["--wait", "--wait-ms", "60000", "--pr", "44", "--sha", TARGET_SHA],
      scenario: "pending-then-success",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(trace.filter((args) => args[0] === "run" && args[1] === "list")).toHaveLength(2);
    expect(result.stdout).toContain("RESULT: PASS");
  });

  it("rejects an invalid bounded wait before invoking gh", () => {
    const { result, trace } = runRemoteCiWithFakeGh({
      args: ["--wait", "--wait-ms", "59999", "--pr", "44", "--sha", TARGET_SHA],
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("between");
    expect(trace).toEqual([]);
  });
});
