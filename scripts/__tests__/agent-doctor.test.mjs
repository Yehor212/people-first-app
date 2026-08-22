import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  MAX_SUMMARY_LENGTH,
  buildProbePlan,
  parseDoctorArgs,
  redactSummary,
  resolveWorkspaceConfig,
  runDoctor,
} from "../agent-doctor.mjs";

const EXPECTED_PROBE_IDS = [
  "agent-context",
  "agent-orchestra",
  "agent-orchestra-eval",
  "context-startup",
  "auto-context",
  "workspace",
];

function completedChild({ stdout = "", stderr = "", status = 0 } = {}) {
  return { error: null, signal: null, status, stderr, stdout };
}

function runWith(outcomes = {}, options = {}) {
  const calls = [];
  let tick = 0;
  const report = runDoctor({
    argv: options.argv ?? [],
    branch: options.branch ?? "codex/agent-doctor",
    clock: () => tick++,
    execute: (probe) => {
      calls.push(probe);
      return outcomes[probe.id] ?? completedChild();
    },
  });
  return { calls, report };
}

describe("agent doctor", () => {
  it("aggregates the fixed six probes into GO without a shell", () => {
    const { calls, report } = runWith();

    assert.equal(report.status, "GO");
    assert.equal(report.exitCode, 0);
    assert.deepEqual(
      report.checks.map((check) => check.id),
      EXPECTED_PROBE_IDS
    );
    assert.equal(calls.length, EXPECTED_PROBE_IDS.length);
    assert.ok(calls.every((probe) => probe.command === process.execPath));
    assert.ok(calls.every((probe) => probe.spawnOptions.shell === false));
    assert.deepEqual(report.configuration, {
      agent: "codex",
      branch: "codex/agent-doctor",
      mode: "edit",
      source: "automatic",
    });
  });

  it("retains later probe results and returns STOP when one probe fails", () => {
    const { calls, report } = runWith({
      "agent-orchestra": completedChild({ status: 1, stderr: "registry drift" }),
    });

    assert.equal(report.status, "STOP");
    assert.equal(report.exitCode, 2);
    assert.equal(calls.length, EXPECTED_PROBE_IDS.length);
    assert.deepEqual(
      report.checks.map((check) => check.status),
      ["GO", "STOP", "GO", "GO", "GO", "GO"]
    );
    assert.equal(report.checks[1].failureKind, "exit");
    assert.equal(report.checks[1].summary, "registry drift");
  });

  it("uses the system performance clock when no test clock is supplied", () => {
    const report = runDoctor({
      branch: "codex/agent-doctor",
      execute: () => completedChild(),
    });

    assert.equal(report.status, "GO");
    assert.equal(report.checks.length, EXPECTED_PROBE_IDS.length);
  });

  it("selects workspace diagnostics only from allowed branch prefixes", () => {
    assert.deepEqual(resolveWorkspaceConfig({ branch: "main", mode: "auto" }), {
      agent: null,
      branch: "main",
      mode: "review",
      source: "automatic",
    });
    assert.deepEqual(resolveWorkspaceConfig({ branch: "codex/safe", mode: "auto" }), {
      agent: "codex",
      branch: "codex/safe",
      mode: "edit",
      source: "automatic",
    });
    assert.deepEqual(resolveWorkspaceConfig({ branch: "kimi/safe", mode: "auto" }), {
      agent: "kimi",
      branch: "kimi/safe",
      mode: "edit",
      source: "automatic",
    });
    assert.throws(
      () => resolveWorkspaceConfig({ branch: "feature/unsafe", mode: "auto" }),
      /cannot select a workspace mode/
    );
  });

  it("rejects invalid options before it starts any health probe", () => {
    assert.throws(() => parseDoctorArgs(["--mode", "edit"]), /requires --agent/);
    assert.throws(
      () => parseDoctorArgs(["--mode", "review", "--agent", "codex"]),
      /does not accept --agent/
    );
    assert.throws(() => parseDoctorArgs(["--unknown"]), /unknown option/);

    const { calls, report } = runWith({}, { argv: ["--mode", "edit"] });
    assert.equal(report.status, "STOP");
    assert.equal(report.exitCode, 2);
    assert.equal(report.checks.length, 0);
    assert.equal(calls.length, 0);
    assert.match(report.errors[0], /requires --agent/);
  });

  it("uses the selected explicit workspace mode in the fixed workspace probe", () => {
    const plan = buildProbePlan({
      agent: "kimi",
      branch: "manual",
      mode: "edit",
      source: "explicit",
    });
    const workspace = plan.at(-1);

    assert.deepEqual(workspace.args, [
      "scripts/agent-workspace.mjs",
      "doctor",
      "--mode",
      "edit",
      "--agent",
      "kimi",
      "--json",
    ]);
  });

  it("extracts declared child errors instead of relaying raw diagnostic JSON", () => {
    const { report } = runWith({
      workspace: completedChild({
        status: 2,
        stdout: JSON.stringify({
          errors: ["edit startup check requires a clean worktree"],
          state: { rootDir: "/Users/private/operator/worktree" },
        }),
      }),
    });

    const workspace = report.checks.at(-1);
    assert.equal(workspace.summary, "edit startup check requires a clean worktree");
    assert.doesNotMatch(workspace.summary, /Users|rootDir|operator/);
  });

  it("redacts credential-like values and bounds all failure summaries", () => {
    const longTail = "z".repeat(MAX_SUMMARY_LENGTH * 2);
    const summary = redactSummary(
      `https://operator:password@example.test/path ssh://operator:password@example.test/path ghp_0123456789abcdefghijk Authorization: Bearer secret-value ${longTail}`
    );

    assert.ok(summary.length <= MAX_SUMMARY_LENGTH);
    assert.doesNotMatch(summary, /operator:password|ghp_0123456789abcdefghijk|secret-value/);
    assert.match(summary, /ssh:\/\/REDACTED@example\.test/);
    assert.match(summary, /REDACTED/);
  });

  it("keeps package wiring explicit and uses a dependency-free focused test", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    assert.equal(packageJson.scripts["doctor:agent"], "node scripts/agent-doctor.mjs");
    assert.equal(
      packageJson.scripts["test:agent-doctor"],
      "node --test scripts/__tests__/agent-doctor.test.mjs"
    );
  });
});
