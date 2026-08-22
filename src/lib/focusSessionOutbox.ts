import { persistCriticalOfflineActionInCurrentTransaction } from "@/lib/offlineQueue";
import { db } from "@/storage/db";
import type { FocusSession } from "@/types";

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export interface FocusSessionOutboxIdentity {
  readonly id: string;
  readonly operationId: string;
}

export async function createFocusSessionOutboxIdentity(
  session: FocusSession,
  expectedOwnerUserId: string
): Promise<FocusSessionOutboxIdentity> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Focus sync identity generation is unavailable");
  }
  const exactPayload = JSON.stringify({
    namespace: "zenflow-focus-sync-outbox",
    version: 1,
    ownerUserId: expectedOwnerUserId,
    session: {
      id: session.id,
      duration: session.duration,
      completedAt: session.completedAt,
      date: session.date,
      label: session.label ?? null,
      status: session.status ?? null,
      reflection: session.reflection ?? null,
      updatedAt: session.updatedAt ?? null,
    },
  });
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(exactPayload))
  );
  const uuidBytes = digest.slice(0, 16);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x80;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  const operationId = formatUuid(uuidBytes);
  return { id: `focus-session:${session.id}:${operationId}`, operationId };
}

function focusPayloadMatches(left: unknown, right: FocusSession): boolean {
  if (!left || typeof left !== "object" || Array.isArray(left)) return false;
  const candidate = left as Partial<FocusSession>;
  return (
    candidate.id === right.id &&
    candidate.duration === right.duration &&
    candidate.completedAt === right.completedAt &&
    candidate.date === right.date &&
    candidate.label === right.label &&
    candidate.status === right.status &&
    candidate.reflection === right.reflection &&
    candidate.updatedAt === right.updatedAt
  );
}

/**
 * Ensures the focus primary record has an owner-bound durable sync row inside
 * the caller's Dexie transaction. Identical retries reuse the same row; a
 * changed reflection receives a distinct row so an in-flight older delivery
 * cannot erase the newer payload.
 */
export async function persistFocusSessionOutboxInCurrentTransaction(
  session: FocusSession,
  expectedOwnerUserId: string,
  identity: FocusSessionOutboxIdentity
): Promise<void> {
  const { id, operationId } = identity;
  const existing = await db.offlineQueue.get(id);
  if (existing) {
    if (
      existing.type !== "CREATE_FOCUS_SESSION" ||
      existing.entityId !== session.id ||
      existing.ownerUserId !== expectedOwnerUserId ||
      existing.operationId !== operationId ||
      !focusPayloadMatches(existing.payload, session)
    ) {
      throw new Error("Focus sync outbox identity collision");
    }
    return;
  }
  await persistCriticalOfflineActionInCurrentTransaction(
    "CREATE_FOCUS_SESSION",
    session.id,
    session,
    expectedOwnerUserId,
    { id, operationId }
  );
}
