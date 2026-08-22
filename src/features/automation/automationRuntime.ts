import { logger } from "@/lib/logger";
import { triggerDataRefresh } from "@/hooks/useIndexedDB";
import { getCurrentUserId } from "@/lib/supabaseClient";
import { db } from "@/storage/db";
import { getPersistentDeviceId } from "@/storage/eventSync";
import { bootstrapAutomationHistoryOnce } from "./automationBootstrap";
import { processAutomationSourceIntent } from "./automationCoordinator";
import { reconcilePendingAutomationHistoryPurges } from "./automationHistoryClear";
import { refreshAutomationPreference } from "./automationPreferences";
import { reconcilePendingAutomationEvents } from "./automationRemoteSync";
import { resolveFreshAutomationServiceGate } from "./automationServiceControl";

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
  step: "bootstrap" | "purge" | "remote",
  operation: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch {
    logger.warn("[AutomationRuntime] Recovery step deferred", { step });
    return false;
  }
}

export async function reconcileAutomationRuntime(
  options: AutomationRuntimeOptions,
): Promise<void> {
  const ownerUserId = await getCurrentUserId();
  if (!ownerUserId) {
    mountedDataRefreshOwner = null;
    return;
  }
  if (mountedDataRefreshOwner && mountedDataRefreshOwner !== ownerUserId) {
    mountedDataRefreshOwner = null;
  }

  await runRecoveryStep("bootstrap", () => bootstrapAutomationHistoryOnce(ownerUserId));
  const remoteRecovered = await runRecoveryStep("remote", () =>
    reconcilePendingAutomationEvents(ownerUserId),
  );
  if (remoteRecovered) {
    await runRecoveryStep("purge", () =>
      reconcilePendingAutomationHistoryPurges(ownerUserId),
    );
  }
  await refreshCommittedLocalData(ownerUserId);

  if (navigator.onLine) {
    try {
      await refreshAutomationPreference(ownerUserId);
    } catch {
      logger.warn("[AutomationRuntime] Preference refresh deferred");
      return;
    }
  }

  const deviceId = await getPersistentDeviceId();
  const intents = (await db.automationTransactions
    .where("ownerUserId")
    .equals(ownerUserId)
    .toArray())
    .filter((row) => row.kind === "source_pending")
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    );

  for (const intent of intents) {
    try {
      const result = await processAutomationSourceIntent(
        intent.id,
        {
          deviceId,
          getLocalizedMoodJournalTitle: () => options.localizedMoodJournalTitle,
          resolveFreshServiceGate: resolveFreshAutomationServiceGate,
        },
        ownerUserId,
      );
      if (result.status === "committed") mountedDataRefreshOwner = ownerUserId;
    } catch {
      logger.warn("[AutomationRuntime] Source reconciliation deferred");
      return;
    }
  }
  await refreshCommittedLocalData(ownerUserId);
}
