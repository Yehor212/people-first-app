export const NATIVE_REMINDER_RECONCILE_EVENT = "zenflow:native-reminder-reconcile";
export const OPEN_REMINDER_SETTINGS_EVENT = "zenflow:open-reminder-settings";

export type ReminderSettingsIncidentReason =
  | "permission-required"
  | "schedule-uncertain";

export interface OpenReminderSettingsEventDetail {
  reason: ReminderSettingsIncidentReason;
}

export type NativeReminderReconcileReason = "app-resume" | "account-cleanup";

export interface NativeReminderReconcileEventDetail {
  reason: NativeReminderReconcileReason;
}

export function dispatchNativeReminderReconcile(
  reason: NativeReminderReconcileReason,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NativeReminderReconcileEventDetail>(
      NATIVE_REMINDER_RECONCILE_EVENT,
      { detail: { reason } },
    ),
  );
}

export function requestReminderSettingsNavigation(
  reason: ReminderSettingsIncidentReason,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenReminderSettingsEventDetail>(OPEN_REMINDER_SETTINGS_EVENT, {
      detail: { reason },
    }),
  );
}
