import { z } from "zod";

import { hashAutomationValue } from "./canonicalJson";
import {
  automationRuleIdSchema,
  automationSourceTypeSchema,
  type AutomationRuleId,
  type AutomationSourceType,
} from "./types";

const automationSourceIdentitySchema = z
  .object({
    ownerUserId: z.string().uuid(),
    consentEpoch: z.string().uuid(),
    ruleId: automationRuleIdSchema,
    ruleVersion: z.literal(1),
    sourceType: automationSourceTypeSchema,
    sourceId: z.string().min(1).max(512),
    sourceRevision: z.string().min(1).max(512),
  })
  .strict();

export interface AutomationSourceIdentity {
  ownerUserId: string;
  consentEpoch: string;
  ruleId: AutomationRuleId;
  ruleVersion: 1;
  sourceType: AutomationSourceType;
  sourceId: string;
  sourceRevision: string;
}

export async function computeAutomationSourceKey(
  identity: AutomationSourceIdentity,
): Promise<string> {
  const parsed = automationSourceIdentitySchema.parse(identity);
  return hashAutomationValue({
    consentEpoch: parsed.consentEpoch,
    ownerUserId: parsed.ownerUserId,
    ruleId: parsed.ruleId,
    ruleVersion: parsed.ruleVersion,
    source: {
      id: parsed.sourceId,
      revision: parsed.sourceRevision,
      type: parsed.sourceType,
    },
  });
}
