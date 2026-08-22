import { describe, expect, it } from "vitest";
import {
  AUTOMATION_REVISION_PREFIX,
  decryptAutomationRevision,
  encryptAutomationRevision,
} from "../revisionCrypto";
import { canonicalizeAutomationValue, hashAutomationValue } from "../canonicalJson";
import {
  AUTOMATION_RULE_IDS,
  AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH,
  type AutomationRevisionBinding,
  type AutomationRevisionEnvelope,
} from "../types";
import { encryptJournalContent } from "@/features/journal/journalCrypto";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";
const CONSENT_EPOCH = "33333333-3333-4333-8333-333333333333";
const VAULT_KEY = "YXV0b21hdGlvbi10ZXN0LXZhdWx0LWtleS0zMmI="; // gitleaks:allow - synthetic test vault key
const SOURCE_KEY = `sha256:${"0".repeat(64)}`;
const AFTER_REVISION = "77777777-7777-4777-8777-777777777777";

const binding: AutomationRevisionBinding = {
  schemaVersion: 1,
  transactionId: TRANSACTION_ID,
  ownerUserId: OWNER_ID,
  consentEpoch: CONSENT_EPOCH,
  sourceKey: SOURCE_KEY,
  sourceType: "mood",
  sourceId: "mood-1",
  ruleId: AUTOMATION_RULE_IDS[0],
  ruleVersion: 1,
};

const revision: AutomationRevisionEnvelope = {
  schemaVersion: binding.schemaVersion,
  transactionId: binding.transactionId,
  ownerUserId: binding.ownerUserId,
  consentEpoch: binding.consentEpoch,
  sourceKey: binding.sourceKey,
  ruleId: binding.ruleId,
  ruleVersion: binding.ruleVersion,
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
      after: {
        id: "journal-1",
        content: "user-authored private text",
        tags: ["mood"],
      },
      beforeHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      afterHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      beforeRevisionToken: null,
      afterRevisionToken: AFTER_REVISION,
    },
  ],
  plannedAt: 101,
};

describe("automation revision crypto", () => {
  it("canonicalizes JSON deterministically without mutating its input", () => {
    const input = { z: [3, { b: true, a: "x" }], a: -0, nested: { y: null, x: 1 } };
    const before = structuredClone(input);

    expect(canonicalizeAutomationValue(input)).toBe(
      '{"a":0,"nested":{"x":1,"y":null},"z":[3,{"a":"x","b":true}]}',
    );
    expect(input).toEqual(before);
  });

  it.each([
    { label: "undefined", value: { private: undefined } },
    { label: "non-finite", value: { count: Number.POSITIVE_INFINITY } },
    { label: "function", value: { handler: () => undefined } },
    { label: "bigint", value: { count: 1n } },
  ])("rejects unsupported $label values", ({ value }) => {
    expect(() => canonicalizeAutomationValue(value)).toThrow();
  });

  it("rejects cyclic values", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalizeAutomationValue(cyclic)).toThrow();
  });

  it("produces a stable SHA-256 identity over canonical JSON", async () => {
    const first = await hashAutomationValue({ b: 2, a: 1 });
    const second = await hashAutomationValue({ a: 1, b: 2 });

    expect(first).toBe(second);
    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("encrypts private revision text with fresh envelopes and decrypts it exactly", async () => {
    const first = await encryptAutomationRevision(revision, VAULT_KEY);
    const second = await encryptAutomationRevision(revision, VAULT_KEY);

    expect(first).toMatch(new RegExp(`^${AUTOMATION_REVISION_PREFIX}`));
    expect(first).not.toContain("user-authored private text");
    expect(first).not.toBe(second);
    await expect(decryptAutomationRevision(first, VAULT_KEY, binding)).resolves.toEqual(revision);
  });

  it.each([
    ["owner", { ownerUserId: "44444444-4444-4444-8444-444444444444" }],
    ["transaction", { transactionId: "55555555-5555-4555-8555-555555555555" }],
    ["consent epoch", { consentEpoch: "66666666-6666-4666-8666-666666666666" }],
    ["source key", { sourceKey: `sha256:${"f".repeat(64)}` }],
    ["source type", { sourceType: "journal" }],
    ["source id", { sourceId: "mood-2" }],
    ["rule", { ruleId: AUTOMATION_RULE_IDS[1] }],
  ] as const)("rejects ciphertext moved to a different outer %s binding", async (_label, patch) => {
    const encrypted = await encryptAutomationRevision(revision, VAULT_KEY);

    await expect(
      decryptAutomationRevision(encrypted, VAULT_KEY, { ...binding, ...patch }),
    ).rejects.toThrow();
  });

  it("rejects wrong keys, tampering, unsupported prefixes, and invalid decrypted schemas", async () => {
    const encrypted = await encryptAutomationRevision(revision, VAULT_KEY);
    const tampered = encrypted.slice(0, -1) + (encrypted.endsWith("A") ? "B" : "A");

    await expect(decryptAutomationRevision(encrypted, "wrong-vault-key", binding)).rejects.toThrow();
    await expect(decryptAutomationRevision(tampered, VAULT_KEY, binding)).rejects.toThrow();
    await expect(decryptAutomationRevision("plaintext", VAULT_KEY, binding)).rejects.toThrow();

    await expect(
      encryptAutomationRevision(
        { ...revision, schemaVersion: 2 } as unknown as AutomationRevisionEnvelope,
        VAULT_KEY,
      ),
    ).rejects.toThrow();

    const invalidDecryptedSchema =
      AUTOMATION_REVISION_PREFIX +
      (await encryptJournalContent(JSON.stringify({ schemaVersion: 2 }), VAULT_KEY, {
        additionalData: canonicalizeAutomationValue(binding),
      }));
    await expect(
      decryptAutomationRevision(invalidDecryptedSchema, VAULT_KEY, binding),
    ).rejects.toThrow();
  });

  it("fails closed when ciphertext or encrypted revisions exceed the release bound", async () => {
    await expect(
      decryptAutomationRevision(
        AUTOMATION_REVISION_PREFIX +
          "x".repeat(AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH),
        VAULT_KEY,
        binding,
      ),
    ).rejects.toThrow(/large/i);

    const oversizedRevision: AutomationRevisionEnvelope = {
      ...revision,
      mutations: [
        {
          ...revision.mutations[0],
          after: { content: "x".repeat(AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH) },
        },
      ],
    };
    await expect(encryptAutomationRevision(oversizedRevision, VAULT_KEY)).rejects.toThrow(/large/i);
  });
});
