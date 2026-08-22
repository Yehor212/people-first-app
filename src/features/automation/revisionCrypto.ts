import {
  decryptJournalContent,
  encryptJournalContent,
} from "@/features/journal/journalCrypto";
import {
  AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH,
  automationRevisionBindingSchema,
  automationRevisionEnvelopeSchema,
  type AutomationRevisionBinding,
  type AutomationRevisionEnvelope,
} from "./types";
import { canonicalizeAutomationValue } from "./canonicalJson";

export { canonicalizeAutomationValue, hashAutomationValue } from "./canonicalJson";

export const AUTOMATION_REVISION_PREFIX = "zenflow:automation-revision:v1:";

export class AutomationRevisionCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomationRevisionCryptoError";
  }
}

export function getAutomationRevisionBinding(
  revision: AutomationRevisionEnvelope,
): AutomationRevisionBinding {
  return automationRevisionBindingSchema.parse({
    schemaVersion: revision.schemaVersion,
    transactionId: revision.transactionId,
    ownerUserId: revision.ownerUserId,
    consentEpoch: revision.consentEpoch,
    sourceKey: revision.sourceKey,
    sourceType: revision.source.type,
    sourceId: revision.source.id,
    ruleId: revision.ruleId,
    ruleVersion: revision.ruleVersion,
  });
}

function parseExpectedBinding(binding: AutomationRevisionBinding): AutomationRevisionBinding {
  try {
    return automationRevisionBindingSchema.parse(binding);
  } catch {
    throw new AutomationRevisionCryptoError("Invalid automation revision binding");
  }
}

export async function encryptAutomationRevision(
  revision: AutomationRevisionEnvelope,
  vaultKey: string,
): Promise<string> {
  const parsed = automationRevisionEnvelopeSchema.parse(revision);
  if (!vaultKey) {
    throw new AutomationRevisionCryptoError("An unlocked vault is required");
  }

  const binding = getAutomationRevisionBinding(parsed);
  const ciphertext = AUTOMATION_REVISION_PREFIX +
    (await encryptJournalContent(canonicalizeAutomationValue(parsed), vaultKey, {
      additionalData: canonicalizeAutomationValue(binding),
    }));
  if (ciphertext.length > AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH) {
    throw new AutomationRevisionCryptoError("Encrypted automation revision is too large");
  }
  return ciphertext;
}

export async function decryptAutomationRevision(
  ciphertext: string,
  vaultKey: string,
  expectedBinding: AutomationRevisionBinding,
): Promise<AutomationRevisionEnvelope> {
  if (!ciphertext.startsWith(AUTOMATION_REVISION_PREFIX) || !vaultKey) {
    throw new AutomationRevisionCryptoError("Invalid automation revision envelope");
  }
  if (ciphertext.length > AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH) {
    throw new AutomationRevisionCryptoError("Encrypted automation revision is too large");
  }

  const binding = parseExpectedBinding(expectedBinding);
  try {
    const plaintext = await decryptJournalContent(
      ciphertext.slice(AUTOMATION_REVISION_PREFIX.length),
      vaultKey,
      { additionalData: canonicalizeAutomationValue(binding) },
    );
    const parsedJson: unknown = JSON.parse(plaintext);
    const revision = automationRevisionEnvelopeSchema.parse(parsedJson);
    const innerBinding = getAutomationRevisionBinding(revision);
    if (
      canonicalizeAutomationValue(innerBinding) !==
      canonicalizeAutomationValue(binding)
    ) {
      throw new AutomationRevisionCryptoError("Automation revision binding mismatch");
    }
    return revision;
  } catch {
    throw new AutomationRevisionCryptoError("Failed to decrypt automation revision");
  }
}
