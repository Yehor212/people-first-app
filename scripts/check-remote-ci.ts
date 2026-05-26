/**
 * Remote CI Verification — checks GitHub Actions status for current commit.
 *
 * Root cause fix for Anti-Pattern #13 "Local All-Clear":
 * Local CI (npm run ci:preflight) ≠ Remote CI (GitHub Actions).
 * This script is the ONLY authority for "CI passed."
 *
 * Usage:
 *   npx tsx scripts/check-remote-ci.ts          # Check latest run for current HEAD
 *   npx tsx scripts/check-remote-ci.ts --wait   # Wait for running CI to complete (max 15 min)
 *
 * Requires: gh CLI authenticated (gh auth login)
 * Exit: 0 = pass, 1 = fail/timeout, 2 = not authenticated
 */

import { execSync } from "child_process";

const MAX_WAIT_MS = 15 * 60 * 1000; // 15 minutes
const POLL_INTERVAL_MS = 15 * 1000; // 15 seconds

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

function main(): void {
  const args = process.argv.slice(2);
  const doWait = args.includes("--wait");

  // 1. Check gh auth
  console.log("\n  REMOTE CI VERIFICATION");
  console.log("=".repeat(50));

  const authStatus = run("gh auth status 2>&1");
  if (
    authStatus.includes("not logged in") ||
    authStatus.includes("error validating")
  ) {
    console.error("\n  ✗ gh CLI not authenticated. Run: gh auth login\n");
    process.exit(2);
  }
  console.log("\n  ✓ gh CLI authenticated");

  // 2. Get current commit
  const commitSha = run("git rev-parse HEAD");
  const commitShort = commitSha.slice(0, 7);
  console.log(`  ✓ Current commit: ${commitShort}`);

  // 3. Get repo info
  const repoInfo = run(
    "gh repo view --json nameWithOwner --jq .nameWithOwner 2>&1",
  );
  if (!repoInfo.includes("/")) {
    console.error(
      "\n  ✗ Cannot determine repo. Run from a GitHub repo directory.\n",
    );
    process.exit(2);
  }
  console.log(`  ✓ Repository: ${repoInfo}`);

  // 4. Find CI run for this commit
  const findRun = (): {
    id: number;
    status: string;
    conclusion: string;
    name: string;
  } | null => {
    try {
      const result = run(
        `gh run list --commit ${commitSha} --limit 1 --json databaseId,status,conclusion,name --jq ".[0]"`,
      );
      if (result && result.startsWith("{")) {
        const parsed = JSON.parse(result);
        return {
          id: parsed.databaseId,
          status: parsed.status,
          conclusion: parsed.conclusion,
          name: parsed.name,
        };
      }
    } catch {
      /* no run found */
    }
    return null;
  };

  let ciRun = findRun();

  if (!ciRun) {
    console.log("\n  ? No CI run found for commit " + commitShort);
    if (!doWait) {
      console.log("    Run with --wait to poll, or check:");
      console.log(`    https://github.com/${repoInfo}/actions\n`);
      process.exit(1);
    }
    console.log("    Waiting for CI to start...");
  }

  // 5. Wait for completion (if --wait)
  if (doWait) {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_MS) {
      ciRun = findRun();

      if (ciRun && ciRun.status === "completed") {
        break;
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const status = ciRun ? ciRun.status : "not started";
      process.stdout.write(`\r  ⏳ Waiting... ${elapsed}s (${status})   `);

      sleep(POLL_INTERVAL_MS);
    }

    process.stdout.write("\r" + " ".repeat(60) + "\r");

    if (!ciRun || ciRun.status !== "completed") {
      console.log("\n  ✗ Timeout waiting for CI (15 min). Check manually:");
      console.log(`    https://github.com/${repoInfo}/actions\n`);
      process.exit(1);
    }
  }

  if (!ciRun) {
    process.exit(1);
  }

  // 6. Report result
  console.log(`\n  Workflow: ${ciRun.name}`);
  console.log(`  Run ID:   ${ciRun.id}`);

  if (ciRun.status !== "completed") {
    console.log(`  Status:   ${ciRun.status} (still running)`);
    console.log(`\n  Run with --wait to poll until complete.\n`);
    process.exit(1);
  }

  // 7. Get job details (JSON parsing — avoids encoding issues on Windows)
  try {
    const jobsJson = run(`gh run view ${ciRun.id} --json jobs --jq ".jobs"`);
    if (jobsJson && jobsJson.startsWith("[")) {
      const jobs = JSON.parse(jobsJson) as Array<{
        name: string;
        conclusion: string;
      }>;
      console.log("\n  Jobs:");
      for (const job of jobs) {
        const icon =
          job.conclusion === "success"
            ? "✓"
            : job.conclusion === "skipped"
              ? "~"
              : "✗";
        console.log(`    ${icon} ${job.name}: ${job.conclusion}`);
      }
    }
  } catch {
    /* job details unavailable */
  }

  // 8. Final verdict
  if (ciRun.conclusion === "success") {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`  RESULT: PASS ✓ (Remote CI verified for ${commitShort})`);
    console.log(`${"=".repeat(50)}\n`);
    process.exit(0);
  } else {
    const failedLog = failedLogForRun(ciRun.id);
    const infrastructureFailure = classifyInfrastructureFailure(failedLog);
    console.log(`\n${"=".repeat(50)}`);
    console.log(`  RESULT: FAIL ✗ (${ciRun.conclusion} for ${commitShort})`);
    console.log(`${"=".repeat(50)}`);
    if (infrastructureFailure) {
      console.log("\n  INFRASTRUCTURE FAILURE DETECTED");
      console.log(`  Reason:   ${infrastructureFailure.reason}`);
      console.log(`  Evidence: ${infrastructureFailure.evidence}`);
      console.log(
        "  Action:   Do not mark CI green. Rerun after GitHub Actions/Pages recovers.",
      );
    }
    console.log(`\n  View logs: gh run view ${ciRun.id} --log-failed\n`);
    process.exit(1);
  }
}

main();
