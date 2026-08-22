import {
  getJournalContentVaultKey,
  getJournalContentVaultRevision,
} from "@/features/journal/journalContentSession";
import { encryptJournalContent } from "@/features/journal/journalCrypto";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { sanitizeString } from "@/lib/sanitize";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  captureOriginAccountBoundaryGeneration,
  isOriginAccountBoundaryGenerationCurrent,
} from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { z } from "zod";

import { hashAutomationValue } from "./canonicalJson";
import type {
  AutomationServiceGateCode,
  AutomationServiceGateResult,
} from "./automationGate";
import {
  commitLocalAutomationTransaction,
  readAutomationTargetSnapshot,
} from "./automationRepository";
import {
  AutomationPlannerBoundaryError,
  type AutomationJournalProtection,
  type AutomationMappedHabitSnapshot,
} from "./plannerContracts";
import { deriveAutomationTargetIdentity, planAutomation } from "./planner";
import { readAutomationPreference } from "./automationPreferences";
import type { AutomationNoOpCode } from "./ruleCatalog";
import {
  automationHistoryMarkerSchema,
  automationSourceIntentSchema,
  type AutomationPreference,
  type AutomationSourceIntent,
} from "./types";

const deviceIdSchema = z.string().min(1).max(512);

export interface AutomationCoordinatorDependencies {
  readonly deviceId: string;
  readonly getLocalizedMoodJournalTitle: () => string;
  readonly resolveFreshServiceGate: () => Promise<AutomationServiceGateResult>;
}

export type AutomationCoordinatorDeferredCode =
  | Exclude<AutomationServiceGateCode, "SERVICE_ENABLED">
  | "VAULT_LOCKED"
  | "HISTORY_UNAVAILABLE"
  | "PREFERENCE_CHANGED";

export type AutomationCoordinatorResult =
  | { status: "missing" }
  | { status: "committed"; transactionId: string }
  | { status: "noop"; code: AutomationNoOpCode }
  | { status: "deferred"; code: AutomationCoordinatorDeferredCode };

export class AutomationCoordinatorError extends Error {
  readonly code:
    | "AUTOMATION_COORDINATOR_OWNER_UNAVAILABLE"
    | "AUTOMATION_COORDINATOR_BOUNDARY_CHANGED"
    | "AUTOMATION_COORDINATOR_INTENT_INVALID"
    | "AUTOMATION_COORDINATOR_DEVICE_INVALID";

  constructor(code: AutomationCoordinatorError["code"]) {
    super(code);
    this.name = "AutomationCoordinatorError";
    this.code = code;
  }
}

async function requireOwner(expectedOwnerUserId: string): Promise<void> {
  const ownerUserId = await validateSyncOwner(
    expectedOwnerUserId,
    "Connected-record source coordinator",
  );
  if (!ownerUserId || ownerUserId !== expectedOwnerUserId) {
    throw new AutomationCoordinatorError("AUTOMATION_COORDINATOR_OWNER_UNAVAILABLE");
  }
}

function requireBoundary(accountBoundaryGeneration: string): void {
  if (!isOriginAccountBoundaryGenerationCurrent(accountBoundaryGeneration)) {
    throw new AutomationCoordinatorError("AUTOMATION_COORDINATOR_BOUNDARY_CHANGED");
  }
}

async function resolveGate(
  dependencies: AutomationCoordinatorDependencies,
): Promise<AutomationServiceGateResult> {
  try {
    return await dependencies.resolveFreshServiceGate();
  } catch {
    return { allowed: false, code: "SERVICE_REFRESH_UNAVAILABLE" };
  }
}

function deniedGateResult(
  gate: AutomationServiceGateResult,
): AutomationCoordinatorResult | null {
  if (gate.allowed) return null;
  return {
    status: "deferred",
    code:
      gate.code === "SERVICE_ENABLED"
        ? "SERVICE_REFRESH_UNAVAILABLE"
        : gate.code,
  };
}

async function readSourceRecord(intent: AutomationSourceIntent): Promise<unknown> {
  switch (intent.source.type) {
    case "mood":
      return db.moods.get(intent.source.id);
    case "journal":
      return db.journalEntries.get(intent.source.id);
    case "focus":
      return db.focusSessions.get(intent.source.id);
    case "habit":
      return db.habits.get(intent.source.id);
  }
}

async function mappedHabitSnapshot(
  preference: AutomationPreference,
): Promise<AutomationMappedHabitSnapshot | undefined> {
  if (!preference.focusHabitId) return undefined;
  const habit = await db.habits.get(preference.focusHabitId);
  if (!habit) return undefined;
  return {
    id: habit.id,
    isArchived: habit.isArchived,
    habitType: habit.habitType,
    targetType: habit.targetType,
    targetValue: habit.targetValue,
  };
}

async function journalProtection(
  intent: AutomationSourceIntent,
  sourceRecord: unknown,
  vaultKey: string,
  dependencies: AutomationCoordinatorDependencies,
): Promise<AutomationJournalProtection | undefined> {
  if (intent.source.type !== "mood") return undefined;
  const note =
    sourceRecord && typeof sourceRecord === "object"
      ? (sourceRecord as { note?: unknown }).note
      : undefined;
  if (typeof note !== "string") return undefined;
  const sanitizedNote = sanitizeString(note);
  if (!sanitizedNote) return undefined;
  return {
    localizedTitle: dependencies.getLocalizedMoodJournalTitle(),
    protectedContent: await encryptJournalContent(sanitizedNote, vaultKey),
    sanitizedNoteHash: await hashAutomationValue(sanitizedNote),
  };
}

function preferenceAuthorizesIntent(
  preference: AutomationPreference,
  intent: AutomationSourceIntent,
): AutomationNoOpCode | null {
  if (!preference.enabled || preference.consentEpoch !== intent.consentEpoch) {
    return "PREFERENCE_DISABLED";
  }
  if (
    intent.candidateRuleIds.length !== 1 ||
    !preference.enabledRuleIds.includes(intent.candidateRuleIds[0])
  ) {
    return "RULE_DISABLED";
  }
  return null;
}

async function deleteExactIntent(
  intent: AutomationSourceIntent,
  expectedOwnerUserId: string,
  accountBoundaryGeneration: string,
): Promise<void> {
  await requireOwner(expectedOwnerUserId);
  requireBoundary(accountBoundaryGeneration);
  await runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    await requireOwner(expectedOwnerUserId);
    requireBoundary(accountBoundaryGeneration);
    await db.transaction("rw", db.automationTransactions, async () => {
      const current = automationSourceIntentSchema.safeParse(
        await db.automationTransactions.get(intent.id),
      );
      if (!current.success) return;
      if (
        current.data.ownerUserId === intent.ownerUserId &&
        current.data.consentEpoch === intent.consentEpoch &&
        current.data.sourceKey === intent.sourceKey &&
        current.data.source.type === intent.source.type &&
        current.data.source.id === intent.source.id &&
        current.data.source.revision === intent.source.revision
      ) {
        await db.automationTransactions.delete(intent.id);
      }
      requireBoundary(accountBoundaryGeneration);
    });
  });
  await requireOwner(expectedOwnerUserId);
}

async function deferIfRuntimeChanged(
  intent: AutomationSourceIntent,
  initialPreference: AutomationPreference,
  initialHistoryGeneration: number,
  vaultKey: string,
  vaultRevision: number,
  dependencies: AutomationCoordinatorDependencies,
): Promise<AutomationCoordinatorResult | null> {
  const gate = deniedGateResult(await resolveGate(dependencies));
  if (gate) return gate;
  const [currentPreference, currentMarker] = await Promise.all([
    readAutomationPreference(),
    db.automationHistoryMarkers.get(intent.ownerUserId),
  ]);
  const marker = automationHistoryMarkerSchema.safeParse(currentMarker);
  if (
    currentPreference.serverRevision !== initialPreference.serverRevision ||
    currentPreference.consentEpoch !== initialPreference.consentEpoch ||
    !currentPreference.enabled ||
    !currentPreference.enabledRuleIds.includes(intent.candidateRuleIds[0]) ||
    !marker.success ||
    marker.data.historyGeneration !== initialHistoryGeneration
  ) {
    return { status: "deferred", code: "PREFERENCE_CHANGED" };
  }
  if (
    getJournalContentVaultKey() !== vaultKey ||
    getJournalContentVaultRevision() !== vaultRevision
  ) {
    return { status: "deferred", code: "VAULT_LOCKED" };
  }
  return null;
}

export async function processAutomationSourceIntent(
  intentId: string,
  dependencies: AutomationCoordinatorDependencies,
  expectedOwnerUserId: string,
): Promise<AutomationCoordinatorResult> {
  const deviceId = deviceIdSchema.safeParse(dependencies.deviceId);
  if (!deviceId.success) {
    throw new AutomationCoordinatorError("AUTOMATION_COORDINATOR_DEVICE_INVALID");
  }
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  await requireOwner(expectedOwnerUserId);
  requireBoundary(accountBoundaryGeneration);

  const rawIntent = await db.automationTransactions.get(intentId);
  if (rawIntent === undefined) return { status: "missing" };
  const parsedIntent = automationSourceIntentSchema.safeParse(rawIntent);
  if (!parsedIntent.success) {
    throw new AutomationCoordinatorError("AUTOMATION_COORDINATOR_INTENT_INVALID");
  }
  const intent = parsedIntent.data;
  if (
    intent.ownerUserId !== expectedOwnerUserId ||
    intent.id !== intentId ||
    intent.accountBoundaryGeneration !== accountBoundaryGeneration
  ) {
    throw new AutomationCoordinatorError("AUTOMATION_COORDINATOR_INTENT_INVALID");
  }

  const preference = await readAutomationPreference();
  const preferenceNoOp = preferenceAuthorizesIntent(preference, intent);
  if (preferenceNoOp) {
    await deleteExactIntent(intent, expectedOwnerUserId, accountBoundaryGeneration);
    return { status: "noop", code: preferenceNoOp };
  }
  const initialGate = deniedGateResult(await resolveGate(dependencies));
  if (initialGate) return initialGate;

  const vaultKey = getJournalContentVaultKey();
  const vaultRevision = getJournalContentVaultRevision();
  if (!vaultKey || vaultRevision === null || !Number.isSafeInteger(vaultRevision)) {
    return { status: "deferred", code: "VAULT_LOCKED" };
  }
  const marker = automationHistoryMarkerSchema.safeParse(
    await db.automationHistoryMarkers.get(expectedOwnerUserId),
  );
  if (!marker.success) return { status: "deferred", code: "HISTORY_UNAVAILABLE" };

  const sourceRecord = await readSourceRecord(intent);
  const ruleId = intent.candidateRuleIds[0];
  let targetIdentity;
  try {
    targetIdentity = await deriveAutomationTargetIdentity({
      ruleId,
      ownerUserId: expectedOwnerUserId,
      source: intent.source,
      preference,
      sourceRecord,
    });
  } catch (error) {
    if (error instanceof AutomationPlannerBoundaryError) {
      await deleteExactIntent(intent, expectedOwnerUserId, accountBoundaryGeneration);
      return { status: "noop", code: error.code };
    }
    throw error;
  }
  const [target, mappedHabit, protection] = await Promise.all([
    readAutomationTargetSnapshot(targetIdentity, expectedOwnerUserId),
    mappedHabitSnapshot(preference),
    journalProtection(intent, sourceRecord, vaultKey, dependencies),
  ]);
  const plan = await planAutomation({
    ruleId,
    ownerUserId: expectedOwnerUserId,
    consentEpoch: intent.consentEpoch,
    preference,
    sourceKey: intent.sourceKey,
    source: intent.source,
    sourceRecord,
    target,
    journalProtection: protection,
    mappedHabit,
  });
  if (plan.kind === "noop") {
    await deleteExactIntent(intent, expectedOwnerUserId, accountBoundaryGeneration);
    return { status: "noop", code: plan.code };
  }
  if (marker.data.purgedTransactionIds?.includes(plan.revision.transactionId)) {
    await deleteExactIntent(intent, expectedOwnerUserId, accountBoundaryGeneration);
    return { status: "noop", code: "SOURCE_PURGED" };
  }

  const changed = await deferIfRuntimeChanged(
    intent,
    preference,
    marker.data.historyGeneration,
    vaultKey,
    vaultRevision,
    dependencies,
  );
  if (changed) return changed;
  await requireOwner(expectedOwnerUserId);
  requireBoundary(accountBoundaryGeneration);

  await commitLocalAutomationTransaction(plan.revision, {
    expectedOwnerUserId,
    accountBoundaryGeneration,
    vaultKey,
    vaultRevision,
    expectedPreferenceRevision: preference.serverRevision,
    expectedHistoryGeneration: marker.data.historyGeneration,
    deviceId: deviceId.data,
  });
  await deleteExactIntent(intent, expectedOwnerUserId, accountBoundaryGeneration);
  return { status: "committed", transactionId: plan.revision.transactionId };
}
