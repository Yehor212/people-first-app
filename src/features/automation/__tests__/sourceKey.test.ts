import { describe, expect, it } from "vitest";

import { computeAutomationSourceKey } from "../sourceKey";

const identity = {
  ownerUserId: "11111111-1111-4111-8111-111111111111",
  consentEpoch: "22222222-2222-4222-8222-222222222222",
  ruleId: "focus.to-mapped-habit.v1" as const,
  ruleVersion: 1 as const,
  sourceType: "focus" as const,
  sourceId: "focus/session:1",
  sourceRevision: "updatedAt:100",
};

describe("automation source key", () => {
  it("hashes the complete owner, epoch, rule and source revision identity", async () => {
    const sourceKey = await computeAutomationSourceKey(identity);

    expect(sourceKey).toMatch(/^sha256:[a-f0-9]{64}$/);
    await expect(
      computeAutomationSourceKey({ ...identity, sourceRevision: "updatedAt:101" }),
    ).resolves.not.toBe(sourceKey);
    await expect(
      computeAutomationSourceKey({
        ...identity,
        consentEpoch: "33333333-3333-4333-8333-333333333333",
      }),
    ).resolves.not.toBe(sourceKey);
  });

  it("uses canonical field framing so delimiter-shaped IDs cannot alias", async () => {
    const first = await computeAutomationSourceKey({
      ...identity,
      sourceId: "a|b",
      sourceRevision: "c",
    });
    const second = await computeAutomationSourceKey({
      ...identity,
      sourceId: "a",
      sourceRevision: "b|c",
    });

    expect(first).not.toBe(second);
  });
});
