import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/storage/db";
import {
  JournalAutomationHistoryRequiresVaultError,
  assertAutomationHistoryClearedForVaultRemoval,
} from "../journalAutomationVaultGuard";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";

describe("journal vault removal automation-history guard", () => {
  beforeEach(async () => {
    await db.automationTransactions.clear();
    await db.automationRemoteEvents.clear();
  });

  afterAll(() => {
    db.close();
  });

  it("allows vault removal only when no connected-record row still depends on it", async () => {
    await expect(assertAutomationHistoryClearedForVaultRemoval()).resolves.toBeUndefined();
  });

  it("allows vault removal when only prose-free detached record revisions remain", async () => {
    await db.automationTransactions.put({
      kind: "record_revision",
      id: "record_revision:mood:mood-1",
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "mood",
      entityId: "mood-1",
      recordExists: true,
      revisionToken: "44444444-4444-4444-8444-444444444444",
      stateHash: `sha256:${"0".repeat(64)}`,
      mutationGeneration: 2,
      transactionId: null,
      updatedAt: 120,
    });

    await expect(assertAutomationHistoryClearedForVaultRemoval()).resolves.toBeUndefined();
  });

  it.each(["transaction", "source_pending"] as const)(
    "blocks vault removal while a %s row remains",
    async kind => {
      if (kind === "transaction") {
        await db.automationTransactions.put({
          kind,
          id: TRANSACTION_ID,
          ownerUserId: OWNER_ID,
          consentEpoch: CONSENT_EPOCH,
          sourceKey: `sha256:${"0".repeat(64)}`,
          ruleId: "mood.note-to-journal.v1",
          ruleVersion: 1,
          sourceType: "mood",
          sourceId: "mood-1",
          status: "commit_pending",
          revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
          createdAt: 100,
          updatedAt: 100,
          schemaVersion: 1,
        });
      } else {
        await db.automationTransactions.put({
          kind,
          id: "source-intent-1",
          schemaVersion: 1,
          ownerUserId: OWNER_ID,
          consentEpoch: CONSENT_EPOCH,
          accountBoundaryGeneration: "boundary-1",
          source: {
            schemaVersion: 1,
            type: "mood",
            id: "mood-1",
            revision: "updatedAt:100",
            committedAt: 100,
          },
          candidateRuleIds: ["mood.note-to-journal.v1"],
          sourceKey: `sha256:${"0".repeat(64)}`,
          createdAt: 100,
          updatedAt: 100,
        });
      }

      const result = assertAutomationHistoryClearedForVaultRemoval();
      await expect(result).rejects.toBeInstanceOf(JournalAutomationHistoryRequiresVaultError);
      await expect(result).rejects.toMatchObject({ code: "AUTOMATION_HISTORY_REQUIRES_VAULT" });
      expect(await db.automationTransactions.count()).toBe(1);
    },
  );

  it("blocks vault removal while an encrypted remote event awaits unlock replay", async () => {
    await db.automationRemoteEvents.put({
      id: "automation-remote-event:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      syncEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      syncEventSequence: 12,
      transactionId: TRANSACTION_ID,
      historyGeneration: 1,
      serverSequence: 1,
      deliveryKind: "delta",
      transaction: {
        id: TRANSACTION_ID,
        consentEpoch: CONSENT_EPOCH,
        sourceKey: `sha256:${"0".repeat(64)}`,
        ruleId: "mood.note-to-journal.v1",
        ruleVersion: 1,
        sourceType: "mood",
        sourceId: "mood-1",
        status: "committed",
        revisionCiphertext: "zenflow:automation-revision:v1:encrypted",
        createdAt: 100,
        updatedAt: 100,
        serverSequence: 1,
        historyGeneration: 1,
        schemaVersion: 1,
      },
      receivedAt: 100,
    });

    await expect(assertAutomationHistoryClearedForVaultRemoval()).rejects.toBeInstanceOf(
      JournalAutomationHistoryRequiresVaultError,
    );
  });
});
