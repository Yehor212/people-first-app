export const COMMAND_KINDS = [
  "ask",
  "status",
  "health",
  "plan",
  "fix",
  "review",
  "test",
  "security",
  "deploy",
  "rollback",
  "jobs",
  "cancel",
  "approve",
  "deny",
] as const;

export type CommandKind = (typeof COMMAND_KINDS)[number];
export type RiskLevel = "low" | "medium" | "high";
export type JobStatus =
  | "ASK"
  | "awaiting_approval"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "denied"
  | "unverified";

export interface CommandIntent {
  kind: CommandKind;
  prompt: string;
  rawText: string;
  targetRef: string;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  requestedGates: string[];
  confidence: number;
}

export interface ApprovalRecord {
  action: "approve" | "deny" | "cancel";
  telegramUserId: number;
  at: string;
  nonce: string;
}

export interface ApprovalSignal {
  jobId: string;
  action: "approve" | "deny" | "cancel";
  nonce: string;
  telegramUserId: number;
}

export interface ControlJob {
  id: string;
  requesterTelegramId: number;
  chatId: number | string;
  status: JobStatus;
  intent: CommandIntent;
  githubRunId?: number;
  githubRunUrl?: string;
  workflowInstanceId?: string;
  branch?: string;
  prUrl?: string;
  approvals: ApprovalRecord[];
  approvalNonce?: string;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowCallbackPayload {
  job_id: string;
  status: JobStatus | "UNVERIFIED";
  github_run_id?: number;
  github_run_url?: string;
  branch?: string;
  pr_url?: string;
  evidence?: string[];
}

export interface ControlWorkflowParams {
  jobId: string;
}

export interface KvNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{
    keys: Array<{ name: string }>;
  }>;
}

export interface WorkflowInstance {
  id: string;
  status(): Promise<unknown>;
  terminate(): Promise<void>;
  sendEvent?(options: { type: string; payload: unknown }): Promise<void>;
}

export interface WorkflowBinding<Params> {
  create(options: { id?: string; params?: Params }): Promise<WorkflowInstance>;
  get(id: string): Promise<WorkflowInstance>;
}

export interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_ADMIN_IDS?: string;
  GITHUB_APP_ID?: string;
  GITHUB_INSTALLATION_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  TELEGRAM_CONTROL_CALLBACK_SECRET?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_WORKFLOW_FILE?: string;
  GITHUB_BASE_REF?: string;
  CONTROL_STATE?: KvNamespace;
  CONTROL_WORKFLOW?: WorkflowBinding<ControlWorkflowParams>;
}
