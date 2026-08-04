export type RequiredRemoteCommitFailureOutcome =
  | "queued"
  | "stale"
  | "aborted"
  | "no-op";

export interface RequiredRemoteCommitOptions {
  expectedOwnerUserId: string;
  requireRemoteCommit: true;
  signal?: AbortSignal;
}

export interface RequiredRemoteCommitResult {
  status: "committed";
}

export class RequiredRemoteCommitError extends Error {
  readonly outcome: RequiredRemoteCommitFailureOutcome;
  readonly retryable = true;

  constructor(outcome: RequiredRemoteCommitFailureOutcome) {
    super(`Required remote commit was not acknowledged (${outcome})`);
    this.name = "RequiredRemoteCommitError";
    this.outcome = outcome;
  }
}

export const REQUIRED_REMOTE_COMMIT_RESULT: RequiredRemoteCommitResult = Object.freeze({
  status: "committed",
});
