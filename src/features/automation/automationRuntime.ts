import { logger } from "@/lib/logger";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import { getCurrentUserId } from "@/lib/supabaseClient";
import { db } from "@/storage/db";
import {
  AccountBoundaryChangedError,
  assertAccountSessionTransitionGeneration,
  assertOriginAccountBoundaryGeneration,
  captureAccountSessionTransitionGeneration,
  captureOriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { getPersistentDeviceId, reconcilePendingAutomationEvents } from "@/storage/eventSync";
import { bootstrapAutomationHistoryOnce } from "./automationBootstrap";
import { processAutomationSourceIntent } from "./automationCoordinator";
import { reconcilePendingAutomationHistoryPurges } from "./automationHistoryClear";
import { refreshAutomationPreference } from "./automationPreferences";
import { resolveFreshAutomationServiceGate } from "./automationServiceControl";
import { recoverDeferredAutomationSourceIntents } from "./automationSourcePersistence";
import { signalAutomationSourceReady } from "./automationRuntimeSignals";

export interface AutomationRuntimeOptions {
  readonly localizedMoodJournalTitle: string;
}

let mountedDataRefreshOwner: string | null = null;

async function refreshCommittedLocalData(ownerUserId: string): Promise<void> {
  if (mountedDataRefreshOwner !== ownerUserId) return;
  try {
    await triggerDataRefresh();
    if (mountedDataRefreshOwner === ownerUserId) mountedDataRefreshOwner = null;
  } catch {
    logger.warn("[AutomationRuntime] Mounted data refresh deferred");
  }
}

async function runRecoveryStep(
  step: "bootstrap" | "purge" | "remote" | "revision",
  operation: () => Promise<unknown>
): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch {
    logger.warn("[AutomationRuntime] Recovery step deferred", { step });
    return false;
  }
}

async function readPendingSourceIntents(ownerUserId: string) {
  return (await db.automationTransactions.where("ownerUserId").equals(ownerUserId).toArray())
    .filter((row) => row.kind === "source_pending")
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

export async function reconcileAutomationRuntime(options: AutomationRuntimeOptions): Promise<void> {
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const sessionGeneration = captureAccountSessionTransitionGeneration();
  const ownerUserId = await getCurrentUserId();
  assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
  assertAccountSessionTransitionGeneration(sessionGeneration);
  if (!ownerUserId) {
    mountedDataRefreshOwner = null;
    return;
  }
  const assertRuntimeContext = async () => {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    assertAccountSessionTransitionGeneration(sessionGeneration);
    if ((await getCurrentUserId()) !== ownerUserId) {
      throw new AccountBoundaryChangedError();
    }
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    assertAccountSessionTransitionGeneration(sessionGeneration);
  };
  if (mountedDataRefreshOwner && mountedDataRefreshOwner !== ownerUserId) {
    mountedDataRefreshOwner = null;
  }

  await runRecoveryStep("bootstrap", () => bootstrapAutomationHistoryOnce(ownerUserId));
  await assertRuntimeContext();
  const remoteRecovered = await runRecoveryStep("remote", () =>
    reconcilePendingAutomationEvents(ownerUserId)
  );
  await assertRuntimeContext();
  if (remoteRecovered) {
    await runRecoveryStep("purge", () => reconcilePendingAutomationHistoryPurges(ownerUserId));
    await assertRuntimeContext();
  }
  await refreshCommittedLocalData(ownerUserId);
  await assertRuntimeContext();

  let refreshedPreference: Awaited<ReturnType<typeof refreshAutomationPreference>> | null = null;
  if (navigator.onLine) {
    try {
      refreshedPreference = await refreshAutomationPreference(ownerUserId);
      await assertRuntimeContext();
    } catch {
      await assertRuntimeContext();
      logger.warn("[AutomationRuntime] Preference refresh deferred");
      return;
    }
  }

  const deviceId = await getPersistentDeviceId();
  await assertRuntimeContext();
  let sourceRecoveryRemaining = false;
  try {
    sourceRecoveryRemaining = (
      await recoverDeferredAutomationSourceIntents(ownerUserId)
    ).remaining;
    await assertRuntimeContext();
  } catch {
    await assertRuntimeContext();
    logger.warn("[AutomationRuntime] Recovery step deferred", { step: "source" });
    return;
  }
  let intents = await readPendingSourceIntents(ownerUserId);
  await assertRuntimeContext();

  // Ordinary domain writes receive their authoritative server revision token
  // only after their ordered sync event is durable. Refresh that bounded
  // snapshot before deriving any enabled connected-record mutation; a stale
  // or unavailable snapshot leaves every source intent durable for the next
  // event/lifecycle wake instead of submitting a transaction against a local
  // token that the server cannot accept.
  if (navigator.onLine && refreshedPreference?.enabled && intents.length > 0) {
    const revisionsReady = await runRecoveryStep("revision", () =>
      bootstrapAutomationHistoryOnce(ownerUserId, { force: true })
    );
    await assertRuntimeContext();
    if (!revisionsReady) return;
    intents = await readPendingSourceIntents(ownerUserId);
    await assertRuntimeContext();
  }

  for (const intent of intents) {
    try {
      const result = await processAutomationSourceIntent(
        intent.id,
        {
          deviceId,
          getLocalizedMoodJournalTitle: () => options.localizedMoodJournalTitle,
          resolveFreshServiceGate: resolveFreshAutomationServiceGate,
        },
        ownerUserId
      );
      await assertRuntimeContext();
      if (result.status === "committed") mountedDataRefreshOwner = ownerUserId;
    } catch {
      await assertRuntimeContext();
      logger.warn("[AutomationRuntime] Source reconciliation deferred");
      return;
    }
  }
  await refreshCommittedLocalData(ownerUserId);
  await assertRuntimeContext();
  if (sourceRecoveryRemaining) signalAutomationSourceReady();
}
