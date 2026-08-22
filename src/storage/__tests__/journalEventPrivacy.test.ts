import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeSyncEventWriteIntent } from "@/storage/eventSync";

const PRIVATE_CANARY = "PRIVATE_JOURNAL_EVENT_CANARY";
const MIGRATION_PATH =
  "supabase/migrations/20260808010000_journal_sync_event_privacy.sql";

describe("journal ordered-event privacy", () => {
  it("reduces journal upserts to contentless identity metadata before queue or network", () => {
    const normalized = normalizeSyncEventWriteIntent({
      entityType: "journal",
      entityId: "journal-1",
      op: "upsert",
      payload: {
        id: "journal-1",
        title: PRIVATE_CANARY,
        content: PRIVATE_CANARY,
        stack: PRIVATE_CANARY,
        arbitrary: [PRIVATE_CANARY],
      },
      deviceId: "device-1",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });

    expect(normalized.payload).toEqual({ schemaVersion: 1 });
    expect(JSON.stringify(normalized)).not.toContain(PRIVATE_CANARY);
  });

  it("keeps journal delete events payload-free", () => {
    const normalized = normalizeSyncEventWriteIntent({
      entityType: "journal",
      entityId: "journal-1",
      op: "delete",
      payload: { deletedContent: PRIVATE_CANARY },
      deviceId: "device-1",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    });

    expect(normalized.payload).toBeNull();
    expect(JSON.stringify(normalized)).not.toContain(PRIVATE_CANARY);
  });

  it("purges legacy journal bodies and enforces contentless future rows server-side", () => {
    const migration = existsSync(MIGRATION_PATH) ? readFileSync(MIGRATION_PATH, "utf8") : "";

    expect(migration).toMatch(
      /UPDATE\s+public\.sync_events[\s\S]+entity_type\s*=\s*'journal'[\s\S]+jsonb_build_object\s*\(\s*'schemaVersion'\s*,\s*1\s*\)/i
    );
    expect(migration).toMatch(
      /BEFORE\s+INSERT\s+ON\s+public\.sync_events[\s\S]+entity_type\s*=\s*'journal'/i
    );
    expect(migration).toMatch(/NEW\.payload\s*:=\s*CASE/i);
    expect(migration).toMatch(
      /REVOKE\s+ALL[\s\S]+FUNCTION[\s\S]+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i
    );
    expect(migration).toMatch(/journal_sync_event_payload_is_contentless/i);
    expect(migration).not.toMatch(/GRANT\s+EXECUTE[\s\S]+authenticated/i);
  });
});
