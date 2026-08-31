import { supabase } from "@/lib/supabaseClient";
import {
  broadcastCommittedSyncEvent,
  type ClientWritableSyncEntityType,
  type SyncEvent,
  type SyncOp,
} from "@/storage/eventSync";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import type { Json } from "@/types/supabase";
import { z } from "zod";

const syncEventSchema = z
  .object({
    id: z.string().uuid(),
    seq: z.number().int().positive(),
    entity_type: z.enum([
      "mood",
      "habit",
      "focus",
      "gratitude",
      "journal",
      "habit_completion",
      "setting",
      "automation_transaction",
      "automation_history_purge",
    ]),
    entity_id: z.string().min(1).max(512),
    op: z.enum(["upsert", "delete"]),
    payload: z.record(z.unknown()).nullable(),
    device_id: z.string().min(1).max(512),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

const manualSyncReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    code: z.enum(["COMMITTED", "ALREADY_COMMITTED"]),
    operationId: z.string().uuid(),
    event: syncEventSchema,
  })
  .strict();

export interface ManualSyncAcceptanceRequest {
  ownerUserId: string;
  operationId: string;
  entityType: Extract<
    ClientWritableSyncEntityType,
    "mood" | "focus" | "journal" | "habit_completion" | "setting"
  >;
  entityId: string;
  op: SyncOp;
  projection: Json;
  deviceId: string;
  signal?: AbortSignal;
}

/**
 * Commits a durable manual outbox row through the server transaction that owns
 * both the domain mutation and its ordered event receipt.
 */
export async function commitManualSyncEvent(
  request: ManualSyncAcceptanceRequest,
): Promise<SyncEvent> {
  const owner = await validateSyncOwner(request.ownerUserId, "Manual sync acceptance");
  if (!owner || owner !== request.ownerUserId || !supabase) {
    throw new Error("Manual sync acceptance is unavailable");
  }

  const rpcRequest = supabase.rpc("commit_manual_sync_event", {
    p_request: {
      schemaVersion: 1,
      operationId: request.operationId,
      entityType: request.entityType,
      entityId: request.entityId,
      op: request.op,
      projection: request.projection,
      deviceId: request.deviceId,
    },
  });
  const { data, error } = request.signal
    ? await rpcRequest.abortSignal(request.signal)
    : await rpcRequest;
  if (error) {
    throw new Error("Manual sync acceptance failed");
  }

  const receipt = manualSyncReceiptSchema.safeParse(data);
  if (
    !receipt.success ||
    receipt.data.operationId !== request.operationId ||
    receipt.data.event.entity_type !== request.entityType ||
    receipt.data.event.entity_id !== request.entityId ||
    receipt.data.event.op !== request.op ||
    receipt.data.event.device_id !== request.deviceId
  ) {
    throw new Error("Manual sync acceptance receipt is invalid");
  }

  const currentOwner = await validateSyncOwner(
    request.ownerUserId,
    "Manual sync acceptance receipt",
  );
  if (!currentOwner || currentOwner !== request.ownerUserId) {
    throw new Error("Manual sync acceptance receipt is invalid");
  }

  const event = receipt.data.event;
  broadcastCommittedSyncEvent(event);
  return event;
}
