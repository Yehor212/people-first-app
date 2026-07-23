/**
 * Remote CI verification for an exact commit or pull-request head.
 *
 * Local CI is not remote CI. A PASS from this script means that each named
 * expected job was observed in a GitHub workflow run for the selected SHA at
 * the time of verification. It does not prove a future PR state or deployment.
 *
 * Usage:
 *   npx tsx scripts/check-remote-ci.ts
 *   npx tsx scripts/check-remote-ci.ts --wait
 *   npx tsx scripts/check-remote-ci.ts --wait --pr 44 --sha <40-char-head-sha>
 *   npx tsx scripts/check-remote-ci.ts --wait --sha <sha> \
 *     --expected-check "Workflow Name::job-name"
 *
 * Default expected checks apply to normal pull-request and main-push CI.
 * Dispatch-only workflows must supply their own fully qualified expected jobs.
 *
 * Requires: authenticated gh CLI
 * Exit: 0 = exact evidence passed, 1 = CI evidence failed, 2 = local/gh setup
 */

import { execFileSync } from "node:child_process";
import {
  assertPrHeadSha,
  evaluateRemoteCiEvidence,
  parseRemoteCiOptions,
  type RemoteCiEvidence,
  type RemoteCiJob,
  type RemoteCiRun,
} from "./remote-ci-core";

const POLL_INTERVAL_MS = 15 * 1000;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const REPOSITORY_PATTERN = /^[^/\s]+\/[^/\s]+$/;

class SetupError extends Error {}

class VerificationError extends Error {}

type CommandResult = {
  ok: boolean;
  output: string;
};

type PullRequestBinding = {
  headRefOid: string;
  state: string;
};

type CollectedEvidence = {
  runs: RemoteCiRun[];
  jobs: RemoteCiJob[];
  evidence: RemoteCiEvidence;
};

function runCommand(executable: string, args: string[]): CommandResult {
  try {
    return {
      ok: true,
      output: execFileSync(executable, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (error) {
    const commandError = error as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    return {
      ok: false,
      output: [commandError.stdout, commandError.stderr]
        .filter(Boolean)
        .map((value) => value!.toString())
        .join("\n")
        .trim(),
    };
  }
}

function commandOutput(executable: string, args: string[], label: string): string {
  const result = runCommand(executable, args);
  if (!result.ok) {
    throw new SetupError(`${label} failed; verify local gh/git setup and authentication`);
  }
  return result.output;
}

function gh(args: string[], label: string): string {
  return commandOutput("gh", args, label);
}

function sleep(milliseconds: number): void {
  const view = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(view, 0, 0, milliseconds);
}

function failedLogForRun(repository: string, runId: number): string {
  return runCommand("gh", [
    "run",
    "view",
    String(runId),
    "--repo",
    repository,
    "--log-failed",
  ]).output;
}

function matchingEvidence(log: string, snippets: string[]): string | null {
  const lowerLog = log.toLowerCase();
  return (
    snippets.find((snippet) => lowerLog.includes(snippet.toLowerCase())) ?? null
  );
}

function classifyInfrastructureFailure(log: string): {
  reason: string;
  evidence: string;
} | null {
  const knownInfrastructureFailures = [
    {
      reason: "GitHub Actions could not download an action archive from codeload",
      snippets: [
        "failed to download archive",
        "https://codeload.github.com",
        "an action could not be found at the uri",
      ],
    },
    {
      reason: "GitHub Actions checkout/authentication failed before project code ran",
      snippets: [
        "your account is suspended",
        "the requested url returned error: 403",
        "fatal: unable to access",
      ],
    },
    {
      reason: "GitHub Actions lost runner/authentication access",
      snippets: [
        "authentication issues",
        "failure in starting actions runs",
        "downloading actions",
      ],
    },
  ];

  for (const failure of knownInfrastructureFailures) {
    const evidence = matchingEvidence(log, failure.snippets);
    if (evidence) return { reason: failure.reason, evidence };
  }
  return null;
}

function iconForConclusion(conclusion: string | null): string {
  if (conclusion === "success") return "PASS";
  if (conclusion === "skipped") return "SKIP";
  if (!conclusion) return "PENDING";
  return "FAIL";
}

function parseJsonArray(json: string, label: string): unknown[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) throw new Error("expected an array");
    return parsed;
  } catch {
    throw new SetupError(`${label} returned malformed JSON`);
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SetupError(`${label} returned a malformed record`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SetupError(`${label} is missing`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return requiredString(value, label);
}

function requiredRunId(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new SetupError(`${label} is invalid`);
  }
  return value as number;
}

function parseRuns(json: string): RemoteCiRun[] {
  return parseJsonArray(json, "gh run list").map((value, index) => {
    const item = asRecord(value, `gh run list item ${index}`);
    const headSha = requiredString(item.headSha, `gh run list item ${index} headSha`);
    if (!SHA_PATTERN.test(headSha)) {
      throw new SetupError(`gh run list item ${index} headSha is not a full SHA`);
    }
    return {
      id: requiredRunId(item.databaseId, `gh run list item ${index} databaseId`),
      name: requiredString(item.name, `gh run list item ${index} name`),
      workflowName: requiredString(
        item.workflowName,
        `gh run list item ${index} workflowName`,
      ),
      event: requiredString(item.event, `gh run list item ${index} event`),
      status: requiredString(item.status, `gh run list item ${index} status`),
      conclusion: nullableString(
        item.conclusion,
        `gh run list item ${index} conclusion`,
      ),
      headSha,
    };
  });
}

function parseJobs(json: string, runId: number): RemoteCiJob[] {
  return parseJsonArray(json, `gh run view ${runId}`).map((value, index) => {
    const item = asRecord(value, `gh run view ${runId} job ${index}`);
    return {
      runId,
      name: requiredString(item.name, `gh run view ${runId} job ${index} name`),
      status: requiredString(item.status, `gh run view ${runId} job ${index} status`),
      conclusion: nullableString(
        item.conclusion,
        `gh run view ${runId} job ${index} conclusion`,
      ),
    };
  });
}

function findRuns(
  repository: string,
  commitSha: string,
  event?: "pull_request",
): RemoteCiRun[] {
  const args = [
    "run",
    "list",
    "--repo",
    repository,
    "--commit",
    commitSha,
    "--limit",
    "100",
    "--json",
    "databaseId,status,conclusion,name,workflowName,event,headSha",
    "--jq",
    ".",
  ];
  if (event) args.push("--event", event);
  return parseRuns(gh(args, "gh run list"));
}

function jobsForRun(repository: string, runId: number): RemoteCiJob[] {
  return parseJobs(
    gh(
      [
        "run",
        "view",
        String(runId),
        "--repo",
        repository,
        "--json",
        "jobs",
        "--jq",
        ".jobs",
      ],
      `gh run view ${runId}`,
    ),
    runId,
  );
}

function pullRequestBinding(repository: string, prNumber: number): PullRequestBinding {
  const raw = gh(
    ["pr", "view", String(prNumber), "--repo", repository, "--json", "headRefOid,state"],
    `gh pr view ${prNumber}`,
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new SetupError(`gh pr view ${prNumber} returned malformed JSON`);
  }
  const record = asRecord(parsed, `gh pr view ${prNumber}`);
  const headRefOid = requiredString(record.headRefOid, `gh pr view ${prNumber} headRefOid`);
  if (!SHA_PATTERN.test(headRefOid)) {
    throw new SetupError(`gh pr view ${prNumber} returned an invalid head SHA`);
  }
  return {
    headRefOid,
    state: requiredString(record.state, `gh pr view ${prNumber} state`),
  };
}

function verifyOpenPrHead(repository: string, prNumber: number, targetSha: string): void {
  const binding = pullRequestBinding(repository, prNumber);
  if (binding.state !== "OPEN") {
    throw new VerificationError(`PR #${prNumber} is not open during CI verification`);
  }
  try {
    assertPrHeadSha(prNumber, targetSha, binding.headRefOid);
  } catch (error) {
    throw new VerificationError((error as Error).message);
  }
}

function printRunList(ciRuns: RemoteCiRun[]): void {
  console.log("\n  Workflows:");
  for (const ciRun of ciRuns) {
    console.log(
      `    ${ciRun.workflowName}: ${ciRun.status} / ${ciRun.conclusion ?? "pending"} (${ciRun.headSha.slice(0, 7)}, run ${ciRun.id})`,
    );
  }
}

function printJobs(ciRuns: RemoteCiRun[], jobs: RemoteCiJob[]): void {
  for (const ciRun of ciRuns) {
    const jobsForThisRun = jobs.filter((job) => job.runId === ciRun.id);
    console.log(`\n  Jobs: ${ciRun.workflowName}`);
    for (const job of jobsForThisRun) {
      console.log(
        `    ${iconForConclusion(job.conclusion)} ${job.name}: ${job.conclusion ?? job.status}`,
      );
    }
  }
}

function collectEvidence(
  repository: string,
  targetSha: string,
  expectedChecks: readonly string[],
  expectedEvent?: "pull_request",
): CollectedEvidence {
  const runs = findRuns(repository, targetSha, expectedEvent);
  const jobs = runs.flatMap((run) => jobsForRun(repository, run.id));
  return {
    runs,
    jobs,
    evidence: evaluateRemoteCiEvidence({
      targetSha,
      expectedChecks,
      runs,
      jobs,
      expectedEvent,
    }),
  };
}

function evidenceCanNoLongerPass(evidence: RemoteCiEvidence): boolean {
  return (
    evidence.wrongShaRunIds.length > 0 ||
    evidence.wrongEventRunIds.length > 0 ||
    evidence.failedRunIds.length > 0 ||
    evidence.nonSuccessExpectedChecks.length > 0 ||
    evidence.duplicateExpectedChecks.length > 0
  );
}

function waitForEvidence({
  repository,
  targetSha,
  expectedChecks,
  expectedEvent,
  wait,
  waitMs,
}: {
  repository: string;
  targetSha: string;
  expectedChecks: readonly string[];
  expectedEvent?: "pull_request";
  wait: boolean;
  waitMs: number;
}): CollectedEvidence {
  let collected = collectEvidence(
    repository,
    targetSha,
    expectedChecks,
    expectedEvent,
  );
  if (!wait || collected.evidence.pass || evidenceCanNoLongerPass(collected.evidence)) {
    return collected;
  }

  const deadline = Date.now() + waitMs;
  let immediateRefresh = true;
  while (Date.now() < deadline) {
    if (!immediateRefresh) {
      const elapsedSeconds = Math.round((Date.now() + waitMs - deadline) / 1000);
      const missing = collected.evidence.missingExpectedChecks.length;
      const pending =
        collected.evidence.incompleteRunIds.length +
        collected.evidence.incompleteExpectedChecks.length;
      const status =
        collected.runs.length === 0
          ? "not started"
          : `${pending} workflow/check result(s) pending, ${missing} expected check(s) not yet observed`;
      process.stdout.write(`\r  Waiting... ${elapsedSeconds}s (${status})   `);
      sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
    }
    collected = collectEvidence(repository, targetSha, expectedChecks, expectedEvent);
    if (collected.evidence.pass || evidenceCanNoLongerPass(collected.evidence)) {
      break;
    }
    immediateRefresh = false;
  }
  process.stdout.write("\r" + " ".repeat(100) + "\r");
  return collected;
}

function printEvidenceFailures(
  repository: string,
  targetSha: string,
  collected: CollectedEvidence,
): void {
  const { evidence, runs } = collected;
  if (runs.length === 0) console.log("  No GitHub workflow run was found for the selected SHA.");
  if (evidence.wrongShaRunIds.length > 0) {
    console.log(`  Wrong-SHA workflow runs: ${evidence.wrongShaRunIds.join(", ")}`);
  }
  if (evidence.wrongEventRunIds.length > 0) {
    console.log(`  Wrong-event workflow runs: ${evidence.wrongEventRunIds.join(", ")}`);
  }
  if (evidence.incompleteRunIds.length > 0) {
    console.log(`  Incomplete workflow runs: ${evidence.incompleteRunIds.join(", ")}`);
  }
  if (evidence.missingExpectedChecks.length > 0) {
    console.log(`  Missing expected checks: ${evidence.missingExpectedChecks.join(", ")}`);
  }
  if (evidence.duplicateExpectedChecks.length > 0) {
    console.log(`  Duplicate expected checks: ${evidence.duplicateExpectedChecks.join(", ")}`);
  }
  if (evidence.incompleteExpectedChecks.length > 0) {
    console.log(`  Incomplete expected checks: ${evidence.incompleteExpectedChecks.join(", ")}`);
  }
  if (evidence.nonSuccessExpectedChecks.length > 0) {
    console.log(`  Non-success expected checks: ${evidence.nonSuccessExpectedChecks.join(", ")}`);
  }

  for (const runId of evidence.failedRunIds) {
    const failedRun = runs.find((run) => run.id === runId);
    if (!failedRun) continue;
    const infrastructureFailure = classifyInfrastructureFailure(failedLogForRun(repository, runId));
    console.log(`\n  Failed workflow: ${failedRun.workflowName} (${failedRun.conclusion})`);
    if (infrastructureFailure) {
      console.log("  INFRASTRUCTURE FAILURE DETECTED");
      console.log(`  Reason:   ${infrastructureFailure.reason}`);
      console.log(`  Evidence: ${infrastructureFailure.evidence}`);
    }
    console.log(`  View logs: gh run view ${runId} --repo ${repository} --log-failed`);
  }

  console.log(`\n  Selected SHA: ${targetSha}`);
}

function main(): number {
  let options: ReturnType<typeof parseRemoteCiOptions>;
  try {
    options = parseRemoteCiOptions(process.argv.slice(2));
  } catch (error) {
    throw new SetupError((error as Error).message);
  }

  console.log("\n  REMOTE CI VERIFICATION");
  console.log("=".repeat(50));

  const authStatus = runCommand("gh", ["auth", "status"]);
  if (
    !authStatus.ok ||
    authStatus.output.includes("not logged in") ||
    authStatus.output.includes("error validating")
  ) {
    throw new SetupError("gh CLI is not authenticated; run gh auth login");
  }
  console.log("\n  PASS gh CLI authenticated");

  const repository = gh(
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    "gh repo view",
  );
  if (!REPOSITORY_PATTERN.test(repository)) {
    throw new SetupError("cannot determine GitHub repository from this directory");
  }
  console.log(`  PASS Repository: ${repository}`);

  const targetSha = (
    options.sha ?? commandOutput("git", ["rev-parse", "HEAD"], "git rev-parse HEAD")
  ).toLowerCase();
  if (!SHA_PATTERN.test(targetSha)) {
    throw new SetupError("target commit is not a full SHA");
  }
  console.log(`  PASS Selected commit: ${targetSha.slice(0, 7)}`);

  const expectedEvent = options.prNumber === undefined ? undefined : "pull_request";
  if (options.prNumber !== undefined) {
    verifyOpenPrHead(repository, options.prNumber, targetSha);
    console.log(`  PASS PR #${options.prNumber} is open and matches the supplied head SHA`);
  }
  console.log(`  PASS Expected checks: ${options.expectedChecks.join(", ")}`);

  const collected = waitForEvidence({
    repository,
    targetSha,
    expectedChecks: options.expectedChecks,
    expectedEvent,
    wait: options.wait,
    waitMs: options.waitMs,
  });

  if (collected.runs.length > 0) {
    printRunList(collected.runs);
    printJobs(collected.runs, collected.jobs);
  }

  if (!collected.evidence.pass) {
    console.log(`\n${"=".repeat(50)}`);
    console.log("  RESULT: FAIL (remote CI evidence is incomplete or failed)");
    console.log(`${"=".repeat(50)}`);
    printEvidenceFailures(repository, targetSha, collected);
    return 1;
  }

  if (options.prNumber !== undefined) {
    verifyOpenPrHead(repository, options.prNumber, targetSha);
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`  RESULT: PASS (exact remote CI evidence verified for ${targetSha.slice(0, 7)})`);
  console.log(`${"=".repeat(50)}\n`);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  const message = error instanceof Error ? error.message : "unexpected verification error";
  const exitCode = error instanceof SetupError ? 2 : 1;
  console.error(`\n  FAIL ${message}\n`);
  process.exit(exitCode);
}
