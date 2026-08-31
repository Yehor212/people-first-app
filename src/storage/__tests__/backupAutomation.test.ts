import { beforeEach, describe, expect, it, vi } from "vitest";

const vaultMocks = vi.hoisted(() => ({
  key: "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI=", // gitleaks:allow - synthetic test vault key
  replaceAuthorized: true,
}));

vi.mock("@/lib/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => vaultMocks.key),
  getJournalContentVaultRevision: vi.fn(() => 1),
  consumeJournalReplaceAuthorization: vi.fn(() => vaultMocks.replaceAuthorized),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expectedOwnerUserId?: string) => expectedOwnerUserId ?? null),
}));

import { captureOriginAccountBoundaryGeneration } from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";
import {
  exportBackup,
  importBackup,
  type BackupPayloadV3,
  type BackupPayloadV4,
} from "@/storage/backup";
import { encryptAutomationRevision } from "@/features/automation/revisionCrypto";
import { SK } from "@/lib/storageKeys";
import type {
  AutomationHistoryMarker,
  AutomationRecordRevisionStoreRow,
  AutomationSourceIntent,
  AutomationTransactionStoreRow,
} from "@/features/automation/types";
import { AUTOMATION_PREFERENCE_SETTING_KEY } from "@/features/automation/types";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNER_ID = "99999999-9999-4999-8999-999999999999";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const AFTER_REVISION = "77777777-7777-4777-8777-777777777777";
const SOURCE_KEY = `sha256:${"a".repeat(64)}`;

const emptyData = {
  moods: [],
  habits: [],
  focusSessions: [],
  gratitudeEntries: [],
  settings: [],
};

function marker(
  historyGeneration = 1,
  overrides: Partial<AutomationHistoryMarker> = {},
): AutomationHistoryMarker {
  return {
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    historyGeneration,
    snapshotSequence: 1,
    lastAppliedServerSequence: 1,
    bootstrapCompletedAt: 100,
    updatedAt: 100,
    purgedTransactionIds: [],
    ...overrides,
  };
}

async function committedRow(
  overrides: Partial<AutomationTransactionStoreRow> = {},
  privateText = "private user-authored text",
): Promise<AutomationTransactionStoreRow> {
  const ownerUserId = overrides.ownerUserId ?? OWNER_ID;
  const transactionId = overrides.id ?? TRANSACTION_ID;
  const sourceKey = overrides.sourceKey ?? SOURCE_KEY;
  const revisionCiphertext = await encryptAutomationRevision(
    {
      schemaVersion: 1,
      transactionId,
      ownerUserId,
      consentEpoch: CONSENT_EPOCH,
      sourceKey,
      ruleId: "mood.note-to-journal.v1",
      ruleVersion: 1,
      source: {
        schemaVersion: 1,
        type: "mood",
        id: "mood-1",
        revision: "updatedAt:100",
        committedAt: 100,
      },
      mutations: [
        {
          entityType: "journal",
          entityId: "journal-1",
          operation: "upsert",
          before: null,
          after: { id: "journal-1", content: privateText },
          beforeHash: `sha256:${"0".repeat(64)}`,
          afterHash: `sha256:${"1".repeat(64)}`,
          beforeRevisionToken: null,
          afterRevisionToken: AFTER_REVISION,
        },
      ],
      plannedAt: 100,
    },
    vaultMocks.key,
  );

  return {
    kind: "transaction",
    id: transactionId,
    ownerUserId,
    consentEpoch: CONSENT_EPOCH,
    sourceKey,
    ruleId: "mood.note-to-journal.v1",
    ruleVersion: 1,
    sourceType: "mood",
    sourceId: "mood-1",
    status: "committed",
    revisionCiphertext,
    createdAt: 100,
    updatedAt: 100,
    serverSequence: 1,
    historyGeneration: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

function syntacticCommittedRow(index: number): AutomationTransactionStoreRow {
  const suffix = String(index + 1).padStart(12, "0");
  const revisionPrefix = "zenflow:automation-revision:v1:";
  return {
    kind: "transaction",
    id: `22222222-2222-4222-8222-${suffix}`,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    sourceKey: `sha256:${(index + 1).toString(16).padStart(64, "0")}`,
    ruleId: "mood.note-to-journal.v1",
    ruleVersion: 1,
    sourceType: "mood",
    sourceId: `mood-${index + 1}`,
    status: "committed",
    revisionCiphertext: revisionPrefix + "x".repeat(89_000 - revisionPrefix.length),
    createdAt: 100 + index,
    updatedAt: 100 + index,
    serverSequence: index + 1,
    historyGeneration: 1,
    schemaVersion: 1,
  };
}

function sourceIntent(index = 0): AutomationSourceIntent {
  const hex = index.toString(16).padStart(64, "0");
  return {
    kind: "source_pending",
    id: `source_pending:${index}`,
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    consentEpoch: CONSENT_EPOCH,
    accountBoundaryGeneration: captureOriginAccountBoundaryGeneration(),
    source: {
      schemaVersion: 1,
      type: "mood",
      id: `mood-${index}`,
      revision: `updatedAt:${100 + index}`,
      committedAt: 100 + index,
    },
    candidateRuleIds: ["mood.note-to-journal.v1"],
    sourceKey: `sha256:${hex}`,
    createdAt: 100 + index,
    updatedAt: 100 + index,
  };
}

function recordRevision(
  transactionId: string | null = TRANSACTION_ID,
  overrides: Partial<AutomationRecordRevisionStoreRow> = {},
): AutomationRecordRevisionStoreRow {
  return {
    kind: "record_revision",
    id: "record_revision:journal:journal-1",
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    entityType: "journal",
    entityId: "journal-1",
    recordExists: true,
    revisionToken: AFTER_REVISION,
    stateHash: `sha256:${"d".repeat(64)}`,
    mutationGeneration: 1,
    transactionId,
    updatedAt: 100,
    ...overrides,
  };
}

function payload(
  automationTransactions: BackupPayloadV4["data"]["automationTransactions"],
  automationHistoryMarkers: BackupPayloadV4["data"]["automationHistoryMarkers"],
): BackupPayloadV4 {
  return {
    schemaVersion: 4,
    createdAt: "2026-08-08T00:00:00.000Z",
    deviceId: "test-device",
    data: {
      ...emptyData,
      automationTransactions,
      automationHistoryMarkers,
    },
  };
}

describe("automation backup v4", () => {
  beforeEach(async () => {
    vaultMocks.replaceAuthorized = true;
    await db.open();
    await db.automationTransactions.clear();
    await db.automationHistoryMarkers.clear();
    await db.settings.clear();
  });

  it("exports ciphertext rows, pending intents and owner history markers without plaintext", async () => {
    const row = await committedRow();
    const intent = sourceIntent();
    await db.automationTransactions.bulkPut([row, intent]);
    await db.automationHistoryMarkers.put(marker());

    const exported = await exportBackup();
    const serialized = JSON.stringify(exported);

    expect(exported.schemaVersion).toBe(4);
    expect(exported.data.automationTransactions).toEqual(
      expect.arrayContaining([row, intent]),
    );
    expect(exported.data.automationHistoryMarkers).toEqual([marker()]);
    expect(serialized).not.toContain("private user-authored text");
  });

  it("fails closed instead of exporting automation history from multiple owners", async () => {
    const local = await committedRow();
    const foreign = await committedRow({
      id: "99999999-9999-4999-8999-999999999998",
      ownerUserId: OTHER_OWNER_ID,
      sourceKey: `sha256:${"c".repeat(64)}`,
    });
    await db.automationTransactions.bulkPut([local, foreign]);
    await db.automationHistoryMarkers.bulkPut([
      marker(),
      marker(1, { ownerUserId: OTHER_OWNER_ID }),
    ]);

    await expect(exportBackup()).rejects.toMatchObject({
      code: "AUTOMATION_HISTORY_OWNER_MISMATCH",
    });
  });

  it("excludes unaccepted offline transactions that cannot safely replay without their outbox", async () => {
    const pending = await committedRow({
      status: "commit_pending",
      serverSequence: undefined,
      historyGeneration: undefined,
    });
    await db.automationTransactions.put(pending);
    await db.automationHistoryMarkers.put(marker());

    const exported = await exportBackup();

    expect(exported.data.automationTransactions).not.toContainEqual(pending);
    expect(exported.data.automationHistoryMarkers).toEqual([marker()]);
  });

  it("keeps destructive purge receipts device-local and rejects them on import", async () => {
    const operationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const receipt = {
      kind: "purge_pending" as const,
      id: `automation-purge:${operationId}`,
      schemaVersion: 1 as const,
      operationId,
      ownerUserId: OWNER_ID,
      transactionIds: [TRANSACTION_ID],
      capturedTransactionIds: [TRANSACTION_ID],
      capturedSourceIntentIds: [],
      all: false,
      deviceId: "android-install-1",
      createdAt: 120,
      updatedAt: 120,
    };
    await db.automationTransactions.put(receipt);
    await db.automationHistoryMarkers.put(marker());

    const exported = await exportBackup();
    expect(exported.data.automationTransactions).not.toContainEqual(receipt);
    await expect(
      importBackup(payload([receipt], [marker()]), "merge", {
        expectedOwnerUserId: OWNER_ID,
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_INVALID" });
  });

  it("excludes the server-linearized consent preference from portable settings", async () => {
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: { schemaVersion: 1, enabled: false, serverRevision: 2 },
    });

    const exported = await exportBackup();

    expect(exported.data.settings).not.toContainEqual(
      expect.objectContaining({ key: AUTOMATION_PREFERENCE_SETTING_KEY }),
    );
  });

  it("imports same-owner ciphertext only after validating its authenticated outer binding", async () => {
    const row = await committedRow();

    const report = await importBackup(payload([row], [marker()]), "merge", {
      expectedOwnerUserId: OWNER_ID,
    });

    await expect(db.automationTransactions.get(row.id)).resolves.toEqual(row);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toEqual(marker());
    expect(report.automationTransactions).toEqual({ added: 1, updated: 0, skipped: 0 });
  });

  it("rejects cross-owner automation history atomically", async () => {
    const foreign = await committedRow({ ownerUserId: OTHER_OWNER_ID });

    await expect(
      importBackup(
        payload([foreign], [marker(1, { ownerUserId: OTHER_OWNER_ID })]),
        "merge",
        { expectedOwnerUserId: OWNER_ID },
      ),
    ).rejects.toMatchObject({
      code: "AUTOMATION_HISTORY_OWNER_MISMATCH",
    });
    await expect(db.automationTransactions.count()).resolves.toBe(0);
    await expect(db.automationHistoryMarkers.count()).resolves.toBe(0);
  });

  it("rejects duplicate transaction identities instead of accepting input-order overwrite", async () => {
    const first = await committedRow();
    const duplicate = { ...first, updatedAt: first.updatedAt + 1 };

    await expect(
      importBackup(payload([first, duplicate], [marker()]), "merge", {
        expectedOwnerUserId: OWNER_ID,
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_DUPLICATE" });

    await expect(db.automationTransactions.count()).resolves.toBe(0);
    await expect(db.automationHistoryMarkers.count()).resolves.toBe(0);
  });

  it("rejects duplicate authoritative server sequence across different transaction IDs", async () => {
    const first = await committedRow();
    const second = await committedRow({
      id: "88888888-8888-4888-8888-888888888888",
      sourceKey: `sha256:${"b".repeat(64)}`,
      serverSequence: first.serverSequence,
    });

    await expect(
      importBackup(payload([first, second], [marker()]), "merge", {
        expectedOwnerUserId: OWNER_ID,
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_DUPLICATE" });

    await expect(db.automationTransactions.count()).resolves.toBe(0);
  });

  it("rejects a tampered outer binding before writing any automation row", async () => {
    const row = await committedRow();
    const tampered = { ...row, sourceKey: `sha256:${"b".repeat(64)}` };

    await expect(
      importBackup(payload([tampered], [marker()]), "merge", {
        expectedOwnerUserId: OWNER_ID,
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_INVALID" });

    await expect(db.automationTransactions.count()).resolves.toBe(0);
    await expect(db.automationHistoryMarkers.count()).resolves.toBe(0);
  });

  it("rejects partial committed history without its generation marker", async () => {
    const row = await committedRow();
    const partial = payload([row], [marker()]);
    delete partial.data.automationHistoryMarkers;

    await expect(
      importBackup(partial, "merge", { expectedOwnerUserId: OWNER_ID }),
    ).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_INVALID" });

    await expect(db.automationTransactions.count()).resolves.toBe(0);
  });

  it("rejects an older history generation instead of resurrecting it", async () => {
    await db.automationHistoryMarkers.put(marker(2, { snapshotSequence: 2, lastAppliedServerSequence: 2 }));
    const staleRow = await committedRow();

    await expect(
      importBackup(payload([staleRow], [marker(1)]), "merge", {
        expectedOwnerUserId: OWNER_ID,
      }),
    ).rejects.toMatchObject({
      code: "AUTOMATION_HISTORY_STALE",
    });
    await expect(db.automationTransactions.count()).resolves.toBe(0);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      historyGeneration: 2,
    });
  });

  it("keeps a newer local server state when an older same-generation backup arrives", async () => {
    const local = await committedRow({
      status: "undone",
      updatedAt: 200,
      undoneAt: 200,
      undoTransactionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      serverSequence: 2,
    });
    const stale = await committedRow();
    await db.automationTransactions.put(local);
    await db.automationHistoryMarkers.put(
      marker(1, { snapshotSequence: 2, lastAppliedServerSequence: 2, updatedAt: 200 }),
    );

    const report = await importBackup(payload([stale], [marker()]), "merge", {
      expectedOwnerUserId: OWNER_ID,
    });

    await expect(db.automationTransactions.get(local.id)).resolves.toEqual(local);
    expect(report.automationTransactions).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it("accepts reordered unique server rows without using client timestamp order", async () => {
    const first = await committedRow();
    const second = await committedRow({
      id: "88888888-8888-4888-8888-888888888888",
      sourceKey: `sha256:${"b".repeat(64)}`,
      serverSequence: 2,
      createdAt: 50,
      updatedAt: 50,
    });

    const report = await importBackup(
      payload(
        [second, first],
        [marker(1, { snapshotSequence: 2, lastAppliedServerSequence: 2 })],
      ),
      "merge",
      { expectedOwnerUserId: OWNER_ID },
    );

    await expect(db.automationTransactions.get(first.id)).resolves.toEqual(first);
    await expect(db.automationTransactions.get(second.id)).resolves.toEqual(second);
    expect(report.automationTransactions).toEqual({ added: 2, updated: 0, skipped: 0 });
  });

  it("keeps permanent per-item purge tombstones ahead of an old backup row", async () => {
    await db.automationHistoryMarkers.put(
      marker(1, { purgedTransactionIds: [TRANSACTION_ID], updatedAt: 200 }),
    );
    await db.automationTransactions.put(recordRevision());
    const staleRow = await committedRow();

    const report = await importBackup(payload([staleRow], [marker()]), "merge", {
      expectedOwnerUserId: OWNER_ID,
    });

    await expect(db.automationTransactions.get(TRANSACTION_ID)).resolves.toBeUndefined();
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toMatchObject({
      purgedTransactionIds: [TRANSACTION_ID],
    });
    await expect(
      db.automationTransactions.get("record_revision:journal:journal-1"),
    ).resolves.toMatchObject({ transactionId: null });
    expect(report.automationTransactions).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it("detaches an imported record revision whose transaction is absent", async () => {
    const orphan = recordRevision();

    const report = await importBackup(payload([orphan], [marker()]), "merge", {
      expectedOwnerUserId: OWNER_ID,
    });

    await expect(db.automationTransactions.get(orphan.id)).resolves.toEqual({
      ...orphan,
      transactionId: null,
    });
    expect(report.automationTransactions).toEqual({ added: 1, updated: 0, skipped: 0 });
  });

  it("does not overwrite a newer local record revision with an older backup row", async () => {
    const transaction = await committedRow();
    const localRevision = recordRevision(TRANSACTION_ID, {
      mutationGeneration: 2,
      revisionToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      stateHash: `sha256:${"e".repeat(64)}`,
      updatedAt: 200,
    });
    const staleRevision = recordRevision();
    await db.automationTransactions.bulkPut([transaction, localRevision]);
    await db.automationHistoryMarkers.put(marker());

    const report = await importBackup(payload([staleRevision], [marker()]), "merge", {
      expectedOwnerUserId: OWNER_ID,
    });

    await expect(db.automationTransactions.get(localRevision.id)).resolves.toEqual(localRevision);
    expect(report.automationTransactions).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it("imports only source intents captured in the current owner boundary", async () => {
    const current = sourceIntent(1);
    const stale = { ...sourceIntent(2), accountBoundaryGeneration: "expired-boundary" };

    const report = await importBackup(payload([current, stale], [marker()]), "merge", {
      expectedOwnerUserId: OWNER_ID,
    });

    await expect(db.automationTransactions.get(current.id)).resolves.toEqual(current);
    await expect(db.automationTransactions.get(stale.id)).resolves.toBeUndefined();
    expect(report.automationTransactions).toEqual({ added: 1, updated: 0, skipped: 1 });
  });

  it("preserves v11 history when replacing from a legacy v3 backup with no history collection", async () => {
    const row = await committedRow();
    await db.automationTransactions.put(row);
    await db.automationHistoryMarkers.put(marker());
    const legacy: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-08-07T00:00:00.000Z",
      deviceId: "legacy-device",
      data: emptyData,
    };

    await importBackup(legacy, "replace", { expectedOwnerUserId: OWNER_ID });

    await expect(db.automationTransactions.get(row.id)).resolves.toEqual(row);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toEqual(marker());
  });

  it("requires current vault authorization before replacing existing automation history", async () => {
    const local = await committedRow();
    const incoming = await committedRow({
      id: "88888888-8888-4888-8888-888888888888",
      sourceKey: `sha256:${"b".repeat(64)}`,
      historyGeneration: 2,
    });
    await db.automationTransactions.put(local);
    await db.automationHistoryMarkers.put(marker());
    await db.settings.put({
      key: SK.JOURNAL_VAULT_KEY,
      value: { wrappedKey: "owner-bound", updatedAt: 1 },
    });
    vaultMocks.replaceAuthorized = false;

    await expect(
      importBackup(
        payload(
          [incoming],
          [marker(2, { snapshotSequence: 1, lastAppliedServerSequence: 1 })],
        ),
        "replace",
        { expectedOwnerUserId: OWNER_ID },
      ),
    ).rejects.toMatchObject({ code: "JOURNAL_REPLACE_AUTHORIZATION_REQUIRED" });

    await expect(db.automationTransactions.toArray()).resolves.toEqual([local]);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toEqual(marker());
  });

  it("does not let an empty replace erase existing encrypted history without authorization", async () => {
    const local = await committedRow();
    await db.automationTransactions.put(local);
    await db.automationHistoryMarkers.put(marker());

    await expect(
      importBackup(payload([], []), "replace", { expectedOwnerUserId: OWNER_ID }),
    ).rejects.toMatchObject({ code: "JOURNAL_REPLACE_AUTHORIZATION_REQUIRED" });

    await expect(db.automationTransactions.get(local.id)).resolves.toEqual(local);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toEqual(marker());
  });

  it("clears only the current owner history on an authorized empty replace", async () => {
    const local = await committedRow();
    const foreign = await committedRow({
      id: "99999999-9999-4999-8999-999999999998",
      ownerUserId: OTHER_OWNER_ID,
      sourceKey: `sha256:${"c".repeat(64)}`,
    });
    await db.automationTransactions.bulkPut([local, foreign]);
    await db.automationHistoryMarkers.bulkPut([
      marker(),
      marker(1, { ownerUserId: OTHER_OWNER_ID }),
    ]);
    await db.settings.put({
      key: SK.JOURNAL_VAULT_KEY,
      value: { wrappedKey: "owner-bound", updatedAt: 1 },
    });

    await importBackup(payload([], []), "replace", { expectedOwnerUserId: OWNER_ID });

    await expect(db.automationTransactions.get(local.id)).resolves.toBeUndefined();
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toBeUndefined();
    await expect(db.automationTransactions.get(foreign.id)).resolves.toEqual(foreign);
    await expect(db.automationHistoryMarkers.get(OTHER_OWNER_ID)).resolves.toBeDefined();
  });

  it("atomically replaces an older generation after current vault authorization", async () => {
    const local = await committedRow();
    const incoming = await committedRow({
      id: "88888888-8888-4888-8888-888888888888",
      sourceKey: `sha256:${"b".repeat(64)}`,
      historyGeneration: 2,
    });
    const incomingMarker = marker(2, {
      snapshotSequence: 1,
      lastAppliedServerSequence: 1,
      allHistoryPurgedAt: 150,
      updatedAt: 150,
    });
    await db.automationTransactions.put(local);
    await db.automationHistoryMarkers.put(marker());
    await db.settings.put({
      key: SK.JOURNAL_VAULT_KEY,
      value: { wrappedKey: "owner-bound", updatedAt: 1 },
    });

    await importBackup(payload([incoming], [incomingMarker]), "replace", {
      expectedOwnerUserId: OWNER_ID,
    });

    await expect(db.automationTransactions.toArray()).resolves.toEqual([incoming]);
    await expect(db.automationHistoryMarkers.get(OWNER_ID)).resolves.toEqual(incomingMarker);
  });

  it("replaces only the current owner realm and preserves unrelated owner rows", async () => {
    const local = await committedRow();
    const foreign = await committedRow({
      id: "99999999-9999-4999-8999-999999999998",
      ownerUserId: OTHER_OWNER_ID,
      sourceKey: `sha256:${"c".repeat(64)}`,
    });
    const incoming = await committedRow({
      id: "88888888-8888-4888-8888-888888888888",
      sourceKey: `sha256:${"b".repeat(64)}`,
      historyGeneration: 2,
    });
    const incomingMarker = marker(2);
    await db.automationTransactions.bulkPut([local, foreign]);
    await db.automationHistoryMarkers.bulkPut([
      marker(),
      marker(1, { ownerUserId: OTHER_OWNER_ID }),
    ]);
    await db.settings.put({
      key: SK.JOURNAL_VAULT_KEY,
      value: { wrappedKey: "owner-bound", updatedAt: 1 },
    });

    await importBackup(payload([incoming], [incomingMarker]), "replace", {
      expectedOwnerUserId: OWNER_ID,
    });

    await expect(db.automationTransactions.get(local.id)).resolves.toBeUndefined();
    await expect(db.automationTransactions.get(incoming.id)).resolves.toEqual(incoming);
    await expect(db.automationTransactions.get(foreign.id)).resolves.toEqual(foreign);
    await expect(db.automationHistoryMarkers.get(OTHER_OWNER_ID)).resolves.toMatchObject({
      ownerUserId: OTHER_OWNER_ID,
      historyGeneration: 1,
    });
  });

  it("rejects cumulative automation ciphertext above 8 MiB before crypto work", async () => {
    const rows = Array.from({ length: 96 }, (_, index) => syntacticCommittedRow(index));
    const oversizedMarker = marker(1, {
      snapshotSequence: rows.length,
      lastAppliedServerSequence: rows.length,
    });

    await expect(
      importBackup(payload(rows, [oversizedMarker]), "merge", {
        expectedOwnerUserId: OWNER_ID,
      }),
    ).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_TOO_LARGE" });

    await expect(db.automationTransactions.count()).resolves.toBe(0);
    await expect(db.automationHistoryMarkers.count()).resolves.toBe(0);
  });

  it("rejects over-limit pending-intent collections instead of silently truncating", async () => {
    const tooMany = Array.from({ length: 129 }, (_, index) => sourceIntent(index));

    await expect(
      importBackup(payload(tooMany, [marker()]), "merge", {
        expectedOwnerUserId: OWNER_ID,
      }),
    ).rejects.toMatchObject({
      code: "AUTOMATION_HISTORY_INVALID",
    });
    await expect(db.automationTransactions.count()).resolves.toBe(0);
  });
});
