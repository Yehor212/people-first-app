import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPECTED_CHECKS,
  DEFAULT_WAIT_MS,
  assertPrHeadSha,
  evaluateRemoteCiEvidence,
  parseRemoteCiOptions,
  type RemoteCiJob,
  type RemoteCiRun,
} from "../remote-ci-core";

const TARGET_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const EXPECTED_CHECKS = [
  "Deploy to GitHub Pages::build",
  "Deploy to GitHub Pages::android-gate",
  "Deploy to GitHub Pages::ios-gate",
  "Production Data Integrity::production-data-integrity",
] as const;

function completedRuns(headSha = TARGET_SHA): RemoteCiRun[] {
  return [
    {
      id: 1,
      name: "Deploy to GitHub Pages",
      workflowName: "Deploy to GitHub Pages",
      event: "pull_request",
      status: "completed",
      conclusion: "success",
      headSha,
    },
    {
      id: 2,
      name: "Production Data Integrity",
      workflowName: "Production Data Integrity",
      event: "pull_request",
      status: "completed",
      conclusion: "success",
      headSha,
    },
  ];
}

function successfulExpectedJobs(): RemoteCiJob[] {
  return [
    { runId: 1, name: "build", status: "completed", conclusion: "success" },
    { runId: 1, name: "android-gate", status: "completed", conclusion: "success" },
    { runId: 1, name: "ios-gate", status: "completed", conclusion: "success" },
    {
      runId: 2,
      name: "production-data-integrity",
      status: "completed",
      conclusion: "success",
    },
  ];
}

describe("remote CI exact-SHA contract", () => {
  it("requires an explicit SHA for PR mode and accepts a bounded named-check wait contract", () => {
    expect(DEFAULT_EXPECTED_CHECKS).toEqual(EXPECTED_CHECKS);
    expect(() => parseRemoteCiOptions(["--pr", "44"])).toThrow(
      "--pr requires --sha",
    );
    expect(() => parseRemoteCiOptions(["--sha", "not-a-sha"])).toThrow(
      "40-character SHA",
    );
    expect(() => parseRemoteCiOptions(["--wait-ms", "60000"])).toThrow(
      "--wait-ms requires --wait",
    );
    expect(() => parseRemoteCiOptions(["--wait", "--wait-ms", "59999"])).toThrow(
      "between",
    );

    expect(
      parseRemoteCiOptions([
        "--wait",
        "--pr",
        "44",
        "--sha",
        TARGET_SHA,
        "--expected-check",
        "Deploy to GitHub Pages::build",
        "--expected-check",
        "Deploy to GitHub Pages::ios-gate",
        "--wait-ms",
        "4500000",
      ]),
    ).toEqual({
      wait: true,
      prNumber: 44,
      sha: TARGET_SHA,
      expectedChecks: [
        "Deploy to GitHub Pages::build",
        "Deploy to GitHub Pages::ios-gate",
      ],
      waitMs: 4_500_000,
    });

    expect(parseRemoteCiOptions([])).toMatchObject({
      wait: false,
      expectedChecks: DEFAULT_EXPECTED_CHECKS,
      waitMs: DEFAULT_WAIT_MS,
    });
  });

  it("fails closed when an expected check is missing or its workflow belongs to another SHA", () => {
    const completeEvidence = evaluateRemoteCiEvidence({
      targetSha: TARGET_SHA,
      expectedChecks: DEFAULT_EXPECTED_CHECKS,
      runs: completedRuns(),
      jobs: successfulExpectedJobs(),
      expectedEvent: "pull_request",
    });
    expect(completeEvidence.pass).toBe(true);

    const missingCheck = evaluateRemoteCiEvidence({
      targetSha: TARGET_SHA,
      expectedChecks: DEFAULT_EXPECTED_CHECKS,
      runs: completedRuns(),
      jobs: successfulExpectedJobs().filter((job) => job.name !== "ios-gate"),
      expectedEvent: "pull_request",
    });
    expect(missingCheck.pass).toBe(false);
    expect(missingCheck.missingExpectedChecks).toEqual([
      "Deploy to GitHub Pages::ios-gate",
    ]);

    const failedCheck = evaluateRemoteCiEvidence({
      targetSha: TARGET_SHA,
      expectedChecks: DEFAULT_EXPECTED_CHECKS,
      runs: completedRuns(),
      jobs: successfulExpectedJobs().map((job) =>
        job.name === "build" ? { ...job, conclusion: "failure" } : job,
      ),
      expectedEvent: "pull_request",
    });
    expect(failedCheck.pass).toBe(false);
    expect(failedCheck.nonSuccessExpectedChecks).toEqual([
      "Deploy to GitHub Pages::build",
    ]);

    const pendingCheck = evaluateRemoteCiEvidence({
      targetSha: TARGET_SHA,
      expectedChecks: DEFAULT_EXPECTED_CHECKS,
      runs: completedRuns(),
      jobs: successfulExpectedJobs().map((job) =>
        job.name === "build"
          ? { ...job, status: "in_progress", conclusion: null }
          : job,
      ),
      expectedEvent: "pull_request",
    });
    expect(pendingCheck.pass).toBe(false);
    expect(pendingCheck.incompleteExpectedChecks).toEqual([
      "Deploy to GitHub Pages::build",
    ]);
    expect(pendingCheck.nonSuccessExpectedChecks).toEqual([]);

    const wrongSha = evaluateRemoteCiEvidence({
      targetSha: TARGET_SHA,
      expectedChecks: DEFAULT_EXPECTED_CHECKS,
      runs: completedRuns(OTHER_SHA),
      jobs: successfulExpectedJobs(),
      expectedEvent: "pull_request",
    });
    expect(wrongSha.pass).toBe(false);
    expect(wrongSha.wrongShaRunIds).toEqual([1, 2]);

    const duplicateCheck = evaluateRemoteCiEvidence({
      targetSha: TARGET_SHA,
      expectedChecks: DEFAULT_EXPECTED_CHECKS,
      runs: completedRuns(),
      jobs: [
        ...successfulExpectedJobs(),
        { runId: 1, name: "build", status: "completed", conclusion: "success" },
      ],
      expectedEvent: "pull_request",
    });
    expect(duplicateCheck.pass).toBe(false);
    expect(duplicateCheck.duplicateExpectedChecks).toEqual([
      "Deploy to GitHub Pages::build",
    ]);

    const wrongWorkflow = evaluateRemoteCiEvidence({
      targetSha: TARGET_SHA,
      expectedChecks: DEFAULT_EXPECTED_CHECKS,
      runs: completedRuns().map((run) =>
        run.id === 1 ? { ...run, workflowName: "Other workflow" } : run,
      ),
      jobs: successfulExpectedJobs(),
      expectedEvent: "pull_request",
    });
    expect(wrongWorkflow.pass).toBe(false);
    expect(wrongWorkflow.missingExpectedChecks).toContain(
      "Deploy to GitHub Pages::build",
    );

    const wrongEvent = evaluateRemoteCiEvidence({
      targetSha: TARGET_SHA,
      expectedChecks: DEFAULT_EXPECTED_CHECKS,
      runs: completedRuns().map((run) => ({ ...run, event: "push" })),
      jobs: successfulExpectedJobs(),
      expectedEvent: "pull_request",
    });
    expect(wrongEvent.pass).toBe(false);
    expect(wrongEvent.wrongEventRunIds).toEqual([1, 2]);
  });

  it("rejects a PR whose current head changes after the supplied SHA was selected", () => {
    expect(() => assertPrHeadSha(44, TARGET_SHA, OTHER_SHA)).toThrow(
      "PR #44 head SHA does not match",
    );
    expect(() => assertPrHeadSha(44, TARGET_SHA, TARGET_SHA.toUpperCase())).not.toThrow();
  });
});
