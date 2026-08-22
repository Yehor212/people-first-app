import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const script = "scripts/check-sentry-status.cjs";
const require = createRequire(import.meta.url);

type RunnerResult = {
  status: number | null;
  stdout?: string;
  stderr?: string;
  error?: { message?: string };
};

type StatusModule = {
  runSentryStatus: (input?: {
    env?: NodeJS.ProcessEnv;
    runner?: (command: string, args: string[], options: unknown) => RunnerResult;
  }) => { exitCode: number; stdout: string; stderr: string };
};

function loadStatusModule(): StatusModule {
  return require("../check-sentry-status.cjs") as StatusModule;
}

function result(stdout: string, status = 0): RunnerResult {
  return { status, stdout, stderr: "" };
}

describe("check-sentry-status", () => {
  it("is wired as a single Sentry status command without token-printing shortcuts", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const source = readFileSync(script, "utf8");

    expect(pkg.scripts?.["check:sentry"]).toBe("node scripts/check-sentry-status.cjs");
    expect(source).toContain("check-sentry-readiness.cjs");
    expect(source).toContain("smoke-sentry-api.cjs");
    expect(source).toContain("check-github-sentry-secrets.cjs");
    expect(source).toContain("check-sentry-artifacts.cjs");
    expect(source).not.toContain("SENTRY_AUTH_TOKEN=");
    expect(source).not.toContain("console.log(process.env.SENTRY_AUTH_TOKEN");
  });

  it("summarizes optional live gaps without failing the command", () => {
    const { runSentryStatus } = loadStatusModule();
    const calls: string[] = [];
    const outputs = [
      result("[sentry-readiness] UNVERIFIED - missing env\n"),
      result("[sentry-api] UNVERIFIED - missing env\n"),
      result("[sentry-github] PARTIAL - missing names\n"),
      result("[sentry-artifacts] PASS - checked 10 public artifact file(s); publicMaps=0; sourceMappingURL=0\n"),
    ];

    const summary = runSentryStatus({
      runner(command, args) {
        calls.push([command, ...args].join(" "));
        const next = outputs.shift();
        if (!next) throw new Error("unexpected extra command");
        return next;
      },
    });

    expect(summary.exitCode).toBe(0);
    expect(calls).toEqual([
      process.execPath + " scripts/check-sentry-readiness.cjs",
      process.execPath + " scripts/smoke-sentry-api.cjs",
      process.execPath + " scripts/check-github-sentry-secrets.cjs",
      process.execPath + " scripts/check-sentry-artifacts.cjs",
    ]);
    expect(summary.stdout).toContain("[sentry-status] SUMMARY");
    expect(summary.stdout).toContain("readiness=UNVERIFIED");
    expect(summary.stdout).toContain("api=UNVERIFIED");
    expect(summary.stdout).toContain("github=PARTIAL");
    expect(summary.stdout).toContain("artifacts=PASS");
  });

  it("fails required mode when any Sentry status check is not PASS", () => {
    const { runSentryStatus } = loadStatusModule();
    const outputs = [
      result("[sentry-readiness] PASS - ok\n"),
      result("[sentry-api] UNVERIFIED - missing env\n"),
      result("[sentry-github] PASS - ok\n"),
      result("[sentry-artifacts] PASS - ok\n"),
    ];

    const summary = runSentryStatus({
      env: { ZENFLOW_SENTRY_STATUS_REQUIRED: "true" },
      runner() {
        const next = outputs.shift();
        if (!next) throw new Error("unexpected extra command");
        return next;
      },
    });

    expect(summary.exitCode).toBe(2);
    expect(summary.stdout).toContain("[sentry-status] UNVERIFIED");
    expect(summary.stdout).toContain("api=UNVERIFIED");
  });

  it("returns hard failure when a child check fails", () => {
    const { runSentryStatus } = loadStatusModule();
    const outputs = [
      result("[sentry-readiness] PASS - ok\n"),
      result("[sentry-api] FAIL - status=401\n", 1),
      result("[sentry-github] PASS - ok\n"),
      result("[sentry-artifacts] PASS - ok\n"),
    ];

    const summary = runSentryStatus({
      runner() {
        const next = outputs.shift();
        if (!next) throw new Error("unexpected extra command");
        return next;
      },
    });

    expect(summary.exitCode).toBe(1);
    expect(summary.stdout).toContain("[sentry-status] FAIL");
    expect(summary.stdout).toContain("api=FAIL");
  });

  it("fails closed when a child runner throws a private diagnostic", () => {
    const { runSentryStatus } = loadStatusModule();
    const canary = "ZF_T172_SENTRY_CHILD_1c574f";

    const summary = runSentryStatus({
      runner() {
        throw new Error(canary);
      },
    });

    expect(JSON.stringify(summary)).not.toContain(canary);
    expect(summary.exitCode).toBe(1);
    expect(summary.stderr).toContain("ZF_EVIDENCE_FAILURE");
  });
});
