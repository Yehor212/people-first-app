export type WorkspaceEntry = {
  branch: string;
  detached?: boolean;
  head?: string;
  locked: boolean;
  lockReason?: string;
  path: string;
};

export type WorkspaceInspection = {
  ahead: number | null;
  baseSha: string | null;
  behind: number | null;
  branch: string;
  changes: string[];
  clean: boolean;
  commonDir: string;
  detached: boolean;
  head: string;
  ignoredPaths: string[];
  locked: boolean;
  lockReason: string | null;
  mainLaneCount: number;
  remoteId: string;
  remoteIdentity: string;
  pushRemoteIdentities: string[];
  rootDir: string;
  statusHash: string;
  tree: string;
  upstream: string | null;
  upstreamHead: string | null;
  worktrees: WorkspaceEntry[];
};

export class WorkspaceError extends Error {
  code: string;
}

export const KIMI_AUDIO_REVIEW_2026_07_26: ReadonlyArray<{
  filename: string;
  sha256: string;
}>;

export function bootstrapHumanReviewWorkspace(input: {
  audioInventory?: Array<{ filename: string; sha256: string }>;
  audioReviewPath: string;
  audioSourcePath: string;
  controlPath: string;
  expectedRemote?: string;
  workspaceFile: string;
}): {
  audioCount: number;
  audioReviewPath: string;
  branch: "main";
  clean: true;
  controlPath: string;
  head: string;
  ready: true;
  repository: string;
  repositoryCount: 1;
  workspaceFile: string;
};

export function inspectHumanReviewWorkspace(input: {
  audioInventory?: Array<{ filename: string; sha256: string }>;
  audioReviewPath: string;
  controlPath: string;
  expectedRemote?: string;
  workspaceFile: string;
}): {
  audioCount: number;
  audioReviewPath: string;
  branch: "main";
  clean: true;
  controlPath: string;
  head: string;
  ready: true;
  repository: string;
  repositoryCount: 1;
  workspaceFile: string;
};

export function inspectWorkspace(input: {
  cwd: string;
  expectedRemote?: string;
}): WorkspaceInspection;

export function createWorkspace(input: {
  agent: "codex";
  cwd: string;
  destination: string;
  expectedRemote?: string;
  task: string;
}): {
  branch: string;
  commonDir: string;
  destination: string;
  head: string;
  locked: true;
  workspaceFile: string;
};

export function syncWorkspace(input: {
  apply?: boolean;
  cwd: string;
  expectedRemote?: string;
  reviewedSha?: string | null;
}): {
  action: "fetch-only" | "fast-forward" | "current";
  ahead: number;
  behind: number;
  head: string;
  remoteHead: string;
  restartRequired?: boolean;
  reviewedProtectedPaths?: string[];
};

export function handoffWorkspace(input: { cwd: string; expectedRemote?: string }): {
  baseSha: string;
  behindMain: number;
  branch: string;
  changedPathCount: number;
  changedPaths: string[];
  clean: true;
  commonDir: string;
  head: string;
  ignoredLocalState: {
    includedInHandoff: false;
    pathCount: number;
    preservationVerified: false;
  };
  locked: true;
  originMain: string;
  ready: true;
  repository: string;
  role: string;
  rootDir: string;
  schemaVersion: 1;
  statusHash: string;
  tree: string;
  upstreamHead: string;
  verificationDone: {
    present: boolean;
    sha256: string | null;
  };
};

export function readBoundedRegularFileForTest(input: {
  afterLstat?: () => void;
  errorPrefix?: string;
  filePath: string;
  maxBytes: number;
}): Buffer;
