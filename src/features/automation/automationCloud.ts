import type { z } from "zod";

import { supabase } from "@/lib/supabaseClient";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import {
  automationCommitRequestSchema,
  automationCommitResultSchema,
  automationHistoryPurgeRequestSchema,
  automationHistoryPurgeResultSchema,
  automationHistorySnapshotPageResultSchema,
  automationHistorySnapshotSchema,
  automationUndoRequestSchema,
  automationUndoResultSchema,
  type AutomationCommitRequest,
  type AutomationCommitResult,
  type AutomationHistoryPurgeRequest,
  type AutomationHistoryPurgeResult,
  type AutomationHistorySnapshotCursor,
  type AutomationHistorySnapshot,
  type AutomationHistorySnapshotToken,
  type AutomationUndoRequest,
  type AutomationUndoResult,
} from "./types";

export type AutomationCloudErrorCode =
  | "AUTOMATION_CLOUD_INVALID_REQUEST"
  | "AUTOMATION_CLOUD_INVALID_RESPONSE"
  | "AUTOMATION_CLOUD_OWNER_UNAVAILABLE"
  | "AUTOMATION_CLOUD_SNAPSHOT_STALE"
  | "AUTOMATION_CLOUD_UNAVAILABLE";

export class AutomationCloudError extends Error {
  readonly code: AutomationCloudErrorCode;

  constructor(code: AutomationCloudErrorCode) {
    super(code);
    this.name = "AutomationCloudError";
    this.code = code;
  }
}

type AutomationRpcName =
  | "commit_automation_transaction"
  | "undo_automation_transaction"
  | "get_automation_history_snapshot"
  | "purge_automation_history";

interface AutomationRpcResult {
  data: unknown;
  error: unknown;
}

interface AutomationRpcClient {
  rpc(
    name: AutomationRpcName,
    args?: Record<string, unknown>,
  ): PromiseLike<AutomationRpcResult>;
}

function rpcClient(): AutomationRpcClient {
  if (!supabase) throw new AutomationCloudError("AUTOMATION_CLOUD_UNAVAILABLE");
  return supabase as unknown as AutomationRpcClient;
}

async function requireOwner(expectedOwnerUserId?: string): Promise<string> {
  const ownerUserId = await validateSyncOwner(
    expectedOwnerUserId,
    "Automation cloud operation",
  );
  if (!ownerUserId) {
    throw new AutomationCloudError("AUTOMATION_CLOUD_OWNER_UNAVAILABLE");
  }
  return ownerUserId;
}

function parseRequest<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AutomationCloudError("AUTOMATION_CLOUD_INVALID_REQUEST");
  return parsed.data;
}

function parseResponse<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AutomationCloudError("AUTOMATION_CLOUD_INVALID_RESPONSE");
  return parsed.data;
}

async function invoke(
  name: AutomationRpcName,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const client = rpcClient();
  const result = args === undefined ? await client.rpc(name) : await client.rpc(name, args);
  if (result.error) throw new AutomationCloudError("AUTOMATION_CLOUD_UNAVAILABLE");
  return result.data;
}

export async function commitAutomationTransaction(
  rawRequest: AutomationCommitRequest,
  expectedOwnerUserId?: string,
): Promise<AutomationCommitResult> {
  const request = parseRequest(automationCommitRequestSchema, rawRequest);
  const ownerUserId = await requireOwner(expectedOwnerUserId);
  const response = await invoke("commit_automation_transaction", { p_request: request });
  await requireOwner(ownerUserId);
  return parseResponse(automationCommitResultSchema, response);
}

export async function undoAutomationTransaction(
  rawRequest: AutomationUndoRequest,
  expectedOwnerUserId?: string,
): Promise<AutomationUndoResult> {
  const request = parseRequest(automationUndoRequestSchema, rawRequest);
  const ownerUserId = await requireOwner(expectedOwnerUserId);
  const response = await invoke("undo_automation_transaction", { p_request: request });
  await requireOwner(ownerUserId);
  return parseResponse(automationUndoResultSchema, response);
}

export async function fetchAutomationHistorySnapshot(
  expectedOwnerUserId?: string,
): Promise<AutomationHistorySnapshot> {
  const ownerUserId = await requireOwner(expectedOwnerUserId);
  const maximumAttempts = 3;

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    let snapshotToken: AutomationHistorySnapshotToken | null = null;
    let cursor: AutomationHistorySnapshotCursor | null = null;
    let allHistoryPurgedAt: number | undefined;
    let firstPage = true;
    const seenCursors = new Set<string>();
    const tombstones: AutomationHistorySnapshot["tombstones"] = [];
    const transactions: AutomationHistorySnapshot["transactions"] = [];
    const recordRevisions: AutomationHistorySnapshot["recordRevisions"] = [];
    let stale = false;

    for (;;) {
      const response = await invoke("get_automation_history_snapshot", {
        p_snapshot_token: snapshotToken,
        p_cursor: cursor,
      });
      await requireOwner(ownerUserId);
      const page = parseResponse(automationHistorySnapshotPageResultSchema, response);
      if (page.code === "SNAPSHOT_STALE") {
        stale = true;
        break;
      }

      if (
        snapshotToken !== null &&
        (page.snapshotToken.historyGeneration !== snapshotToken.historyGeneration ||
          page.snapshotToken.snapshotSequence !== snapshotToken.snapshotSequence ||
          page.snapshotToken.recordRevisionVersion !==
            snapshotToken.recordRevisionVersion)
      ) {
        throw new AutomationCloudError("AUTOMATION_CLOUD_INVALID_RESPONSE");
      }
      if (
        !firstPage &&
        page.allHistoryPurgedAt !== allHistoryPurgedAt
      ) {
        throw new AutomationCloudError("AUTOMATION_CLOUD_INVALID_RESPONSE");
      }

      snapshotToken = page.snapshotToken;
      allHistoryPurgedAt = page.allHistoryPurgedAt;
      firstPage = false;
      tombstones.push(...page.tombstones);
      transactions.push(...page.transactions);
      recordRevisions.push(...page.recordRevisions);

      if (page.nextCursor === null) {
        return parseResponse(automationHistorySnapshotSchema, {
          schemaVersion: 1,
          historyGeneration: snapshotToken.historyGeneration,
          snapshotSequence: snapshotToken.snapshotSequence,
          ...(allHistoryPurgedAt === undefined ? {} : { allHistoryPurgedAt }),
          tombstones,
          transactions,
          recordRevisions,
        });
      }
      if (
        page.nextCursor.transactionsComplete &&
        page.nextCursor.tombstonesComplete &&
        page.nextCursor.recordRevisionsComplete
      ) {
        throw new AutomationCloudError("AUTOMATION_CLOUD_INVALID_RESPONSE");
      }
      const cursorKey = JSON.stringify(page.nextCursor);
      if (seenCursors.has(cursorKey)) {
        throw new AutomationCloudError("AUTOMATION_CLOUD_INVALID_RESPONSE");
      }
      seenCursors.add(cursorKey);
      cursor = page.nextCursor;
    }

    if (!stale) break;
  }

  throw new AutomationCloudError("AUTOMATION_CLOUD_SNAPSHOT_STALE");
}

export async function purgeAutomationHistory(
  rawRequest: AutomationHistoryPurgeRequest,
  expectedOwnerUserId?: string,
): Promise<AutomationHistoryPurgeResult> {
  const request = parseRequest(automationHistoryPurgeRequestSchema, rawRequest);
  const ownerUserId = await requireOwner(expectedOwnerUserId);
  const response = await invoke("purge_automation_history", {
    p_operation_id: request.operationId,
    p_transaction_ids: request.transactionIds,
    p_all: request.all,
    p_device_id: request.deviceId,
  });
  await requireOwner(ownerUserId);
  return parseResponse(automationHistoryPurgeResultSchema, response);
}
