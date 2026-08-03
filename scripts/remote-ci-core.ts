export const DEFAULT_EXPECTED_CHECKS = [
  "Deploy to GitHub Pages::build",
  "Deploy to GitHub Pages::android-gate",
  "Deploy to GitHub Pages::ios-gate",
  "Production Data Integrity::production-data-integrity",
] as const;

// The current main critical path can take 85 minutes (build, deployment, then
// public smoke); leave bounded queue and GitHub scheduling room without making
// the CLI wait indefinitely.
export const DEFAULT_WAIT_MS = 120 * 60 * 1000;
export const MIN_WAIT_MS = 60 * 1000;
export const MAX_WAIT_MS = 3 * 60 * 60 * 1000;

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const PR_NUMBER_PATTERN = /^[1-9][0-9]*$/;

export type RemoteCiOptions = {
  wait: boolean;
  prNumber?: number;
  sha?: string;
  expectedChecks: string[];
  waitMs: number;
};

export type RemoteCiRun = {
  id: number;
  name: string;
  workflowName: string;
  event: string;
  status: string;
  conclusion: string | null;
  headSha: string;
};

export type RemoteCiJob = {
  runId: number;
  name: string;
  status: string;
  conclusion: string | null;
};

export type RemoteCiEvidence = {
  pass: boolean;
  wrongShaRunIds: number[];
  wrongEventRunIds: number[];
  incompleteRunIds: number[];
  failedRunIds: number[];
  missingExpectedChecks: string[];
  duplicateExpectedChecks: string[];
  incompleteExpectedChecks: string[];
  nonSuccessExpectedChecks: string[];
};

function nextValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function normalizeSha(value: string): string {
  if (!SHA_PATTERN.test(value)) {
    throw new Error("--sha must be a full 40-character SHA");
  }
  return value.toLowerCase();
}

function parsePrNumber(value: string): number {
  if (!PR_NUMBER_PATTERN.test(value)) {
    throw new Error("--pr must be a positive pull request number");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("--pr is outside the supported integer range");
  }
  return parsed;
}

function parseWaitMs(value: string): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error("--wait-ms must be an integer number of milliseconds");
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_WAIT_MS ||
    parsed > MAX_WAIT_MS
  ) {
    throw new Error(
      `--wait-ms must be between ${MIN_WAIT_MS} and ${MAX_WAIT_MS} milliseconds`,
    );
  }
  return parsed;
}

function parseExpectedCheck(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160 || /[\r\n\0]/.test(trimmed)) {
    throw new Error("--expected-check must be a non-empty single-line job name");
  }
  const segments = trimmed.split("::");
  if (segments.length !== 2 || !segments[0].trim() || !segments[1].trim()) {
    throw new Error(
      "--expected-check must use the exact Workflow Name::job-name format",
    );
  }
  return `${segments[0].trim()}::${segments[1].trim()}`;
}

export function parseRemoteCiOptions(args: string[]): RemoteCiOptions {
  let wait = false;
  let prNumber: number | undefined;
  let sha: string | undefined;
  let waitMs = DEFAULT_WAIT_MS;
  let waitMsWasProvided = false;
  const expectedChecks: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    switch (argument) {
      case "--wait":
        wait = true;
        break;
      case "--pr":
        prNumber = parsePrNumber(nextValue(args, index, argument));
        index += 1;
        break;
      case "--sha":
        sha = normalizeSha(nextValue(args, index, argument));
        index += 1;
        break;
      case "--expected-check":
        expectedChecks.push(parseExpectedCheck(nextValue(args, index, argument)));
        index += 1;
        break;
      case "--wait-ms":
        waitMs = parseWaitMs(nextValue(args, index, argument));
        waitMsWasProvided = true;
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (prNumber !== undefined && !sha) {
    throw new Error("--pr requires --sha with the exact current PR head SHA");
  }
  if (waitMsWasProvided && !wait) {
    throw new Error("--wait-ms requires --wait");
  }

  const resolvedExpectedChecks =
    expectedChecks.length > 0 ? expectedChecks : [...DEFAULT_EXPECTED_CHECKS];
  const duplicateExpectedCheck = resolvedExpectedChecks.find(
    (check, index) => resolvedExpectedChecks.indexOf(check) !== index,
  );
  if (duplicateExpectedCheck) {
    throw new Error(`--expected-check is repeated: ${duplicateExpectedCheck}`);
  }

  return { wait, prNumber, sha, expectedChecks: resolvedExpectedChecks, waitMs };
}

export function assertPrHeadSha(
  prNumber: number,
  expectedSha: string,
  observedSha: string,
): void {
  const normalizedExpected = normalizeSha(expectedSha);
  const normalizedObserved = normalizeSha(observedSha);
  if (normalizedObserved !== normalizedExpected) {
    throw new Error(
      `PR #${prNumber} head SHA does not match the supplied SHA (${normalizedObserved} != ${normalizedExpected})`,
    );
  }
}

export function evaluateRemoteCiEvidence({
  targetSha,
  expectedChecks,
  runs,
  jobs,
  expectedEvent,
}: {
  targetSha: string;
  expectedChecks: readonly string[];
  runs: readonly RemoteCiRun[];
  jobs: readonly RemoteCiJob[];
  expectedEvent?: string;
}): RemoteCiEvidence {
  const normalizedTargetSha = normalizeSha(targetSha);
  const wrongShaRunIds = runs
    .filter((run) => {
      try {
        return normalizeSha(run.headSha) !== normalizedTargetSha;
      } catch {
        return true;
      }
    })
    .map((run) => run.id);
  const wrongEventRunIds = expectedEvent
    ? runs.filter((run) => run.event !== expectedEvent).map((run) => run.id)
    : [];
  const trustedRuns = runs.filter(
    (run) =>
      !wrongShaRunIds.includes(run.id) && !wrongEventRunIds.includes(run.id),
  );
  const trustedRunsById = new Map(trustedRuns.map((run) => [run.id, run]));
  const incompleteRunIds = runs
    .filter((run) => run.status !== "completed")
    .map((run) => run.id);
  const failedRunIds = runs
    .filter((run) => run.status === "completed" && run.conclusion !== "success")
    .map((run) => run.id);
  const trustedJobs = jobs.filter((job) => trustedRunsById.has(job.runId));
  const missingExpectedChecks: string[] = [];
  const duplicateExpectedChecks: string[] = [];
  const incompleteExpectedChecks: string[] = [];
  const nonSuccessExpectedChecks: string[] = [];

  for (const expectedCheck of expectedChecks) {
    const matchingJobs = trustedJobs.filter((job) => {
      const run = trustedRunsById.get(job.runId);
      return run && `${run.workflowName}::${job.name}` === expectedCheck;
    });
    if (matchingJobs.length === 0) {
      missingExpectedChecks.push(expectedCheck);
      continue;
    }
    if (matchingJobs.length > 1) {
      duplicateExpectedChecks.push(expectedCheck);
      continue;
    }
    if (
      matchingJobs[0].status !== "completed" ||
      matchingJobs[0].conclusion === null
    ) {
      incompleteExpectedChecks.push(expectedCheck);
      continue;
    }
    if (matchingJobs[0].conclusion !== "success") {
      nonSuccessExpectedChecks.push(expectedCheck);
    }
  }

  return {
    pass:
      runs.length > 0 &&
      wrongShaRunIds.length === 0 &&
      wrongEventRunIds.length === 0 &&
      incompleteRunIds.length === 0 &&
      failedRunIds.length === 0 &&
      missingExpectedChecks.length === 0 &&
      duplicateExpectedChecks.length === 0 &&
      incompleteExpectedChecks.length === 0 &&
      nonSuccessExpectedChecks.length === 0,
    wrongShaRunIds,
    wrongEventRunIds,
    incompleteRunIds,
    failedRunIds,
    missingExpectedChecks,
    duplicateExpectedChecks,
    incompleteExpectedChecks,
    nonSuccessExpectedChecks,
  };
}
