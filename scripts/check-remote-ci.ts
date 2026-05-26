/**
 * Remote CI Verification - checks GitHub Actions status for the current commit.
 *
 * Root cause fix for Anti-Pattern #13 "Local All-Clear":
 * local CI is not remote CI. This script is the only authority for
 * "remote CI passed" and requires every workflow for the current commit to pass.
 *
 * Usage:
 *   npx tsx scripts/check-remote-ci.ts          # Check current HEAD
 *   npx tsx scripts/check-remote-ci.ts --wait   # Wait for running CI to complete
 *
 * Requires: gh CLI authenticated (gh auth login)
 * Exit: 0 = pass, 1 = fail/timeout/running, 2 = local gh/repo setup problem
 */

import { execSync } from "child_process";

const MAX_WAIT_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = 15 * 1000;

type CiRun = {
  id: number;
  status: string;
  conclusion: string;
  name: string;
};

type Job = {
  name: string;
  conclusion: string;
};

function run(cmd: string): string {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    return (err.stdout?.toString() || err.stderr?.toString() || "").trim();
  }
}

function sleep(ms: number): void {
  execSync(`node -e "setTimeout(()=>{},${ms})"`, { stdio: "ignore" });
}

function failedLogForRun(runId: number): string {
  return run(`gh run view ${runId} --log-failed 2>&1`);
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
    if (evidence) {
      return { reason: failure.reason, evidence };
    }
  }

  return null;
}

function iconForConclusion(conclusion: string): string {
  if (conclusion === "success") return "PASS";
  if (conclusion === "skipped") return "SKIP";
  if (!conclusion) return "PENDING";
  return "FAIL";
}

function parseRuns(json: string): CiRun[] {
  if (!json.startsWith("[")) return [];

  const parsed = JSON.parse(json) as Array<{
    databaseId: number;
    status: string;
    conclusion: string;
    name: string;
  }>;

  return parsed.map((runItem) => ({
    id: runItem.databaseId,
    status: runItem.status,
    conclusion: runItem.conclusion,
    name: runItem.name,
  }));
}

function findRuns(commitSha: string): CiRun[] {
  try {
    const result = run(
      `gh run list --commit ${commitSha} --limit 20 --json databaseId,status,conclusion,name --jq "."`,
    );
    return parseRuns(result);
  } catch {
    return [];
  }
}

function jobsForRun(runId: number): Job[] {
  try {
    const jobsJson = run(`gh run view ${runId} --json jobs --jq ".jobs"`);
    if (!jobsJson.startsWith("[")) return [];
    return JSON.parse(jobsJson) as Job[];
  } catch {
    return [];
  }
}

function printRunList(ciRuns: CiRun[]): void {
  console.log("\n  Workflows:");
  for (const ciRun of ciRuns) {
    console.log(
      `    ${ciRun.name}: ${ciRun.status} / ${ciRun.conclusion || "pending"} (run ${ciRun.id})`,
    );
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const doWait = args.includes("--wait");

  console.log("\n  REMOTE CI VERIFICATION");
  console.log("=".repeat(50));

  const authStatus = run("gh auth status 2>&1");
  if (
    authStatus.includes("not logged in") ||
    authStatus.includes("error validating")
  ) {
    console.error("\n  FAIL gh CLI not authenticated. Run: gh auth login\n");
    process.exit(2);
  }
  console.log("\n  PASS gh CLI authenticated");

  const commitSha = run("git rev-parse HEAD");
  const commitShort = commitSha.slice(0, 7);
  console.log(`  PASS Current commit: ${commitShort}`);

  const repoInfo = run(
    "gh repo view --json nameWithOwner --jq .nameWithOwner 2>&1",
  );
  if (!repoInfo.includes("/")) {
    console.error(
      "\n  FAIL Cannot determine repo. Run from a GitHub repo directory.\n",
    );
    process.exit(2);
  }
  console.log(`  PASS Repository: ${repoInfo}`);

  let ciRuns = findRuns(commitSha);

  if (ciRuns.length === 0) {
    console.log("\n  ? No CI run found for commit " + commitShort);
    if (!doWait) {
      console.log("    Run with --wait to poll, or check:");
      console.log(`    https://github.com/${repoInfo}/actions\n`);
      process.exit(1);
    }
    console.log("    Waiting for CI to start...");
  }

  if (doWait) {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_MS) {
      ciRuns = findRuns(commitSha);

      if (
        ciRuns.length > 0 &&
        ciRuns.every((ciRun) => ciRun.status === "completed")
      ) {
        break;
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const pendingCount = ciRuns.filter(
        (ciRun) => ciRun.status !== "completed",
      ).length;
      const status =
        ciRuns.length === 0 ? "not started" : `${pendingCount} running`;
      process.stdout.write(`\r  Waiting... ${elapsed}s (${status})   `);

      sleep(POLL_INTERVAL_MS);
    }

    process.stdout.write("\r" + " ".repeat(60) + "\r");

    if (
      ciRuns.length === 0 ||
      ciRuns.some((ciRun) => ciRun.status !== "completed")
    ) {
      console.log("\n  FAIL Timeout waiting for remote CI. Check manually:");
      console.log(`    https://github.com/${repoInfo}/actions\n`);
      process.exit(1);
    }
  }

  if (ciRuns.length === 0) {
    process.exit(1);
  }

  printRunList(ciRuns);

  const pendingRuns = ciRuns.filter((ciRun) => ciRun.status !== "completed");
  if (pendingRuns.length > 0) {
    console.log(
      `\n  Status: ${pendingRuns.length} workflow(s) still running for ${commitShort}`,
    );
    console.log("\n  Run with --wait to poll until complete.\n");
    process.exit(1);
  }

  for (const ciRun of ciRuns) {
    const jobs = jobsForRun(ciRun.id);
    if (jobs.length === 0) continue;

    console.log(`\n  Jobs: ${ciRun.name}`);
    for (const job of jobs) {
      console.log(
        `    ${iconForConclusion(job.conclusion)} ${job.name}: ${job.conclusion}`,
      );
    }
  }

  const failedRuns = ciRuns.filter((ciRun) => ciRun.conclusion !== "success");
  if (failedRuns.length === 0) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(
      `  RESULT: PASS (all remote workflows verified for ${commitShort})`,
    );
    console.log(`${"=".repeat(50)}\n`);
    process.exit(0);
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(
    `  RESULT: FAIL (${failedRuns.length} workflow failure(s) for ${commitShort})`,
  );
  console.log(`${"=".repeat(50)}`);

  for (const failedRun of failedRuns) {
    const failedLog = failedLogForRun(failedRun.id);
    const infrastructureFailure = classifyInfrastructureFailure(failedLog);

    console.log(
      `\n  Failed workflow: ${failedRun.name} (${failedRun.conclusion})`,
    );
    if (infrastructureFailure) {
      console.log("  INFRASTRUCTURE FAILURE DETECTED");
      console.log(`  Reason:   ${infrastructureFailure.reason}`);
      console.log(`  Evidence: ${infrastructureFailure.evidence}`);
      console.log(
        "  Action:   Do not mark CI green. Rerun after GitHub Actions/Pages recovers.",
      );
    }
    console.log(`  View logs: gh run view ${failedRun.id} --log-failed`);
  }

  console.log();
  process.exit(1);
}

main();
