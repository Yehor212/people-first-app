import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, Link2, Save } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  JOURNAL_CONTENT_SESSION_CHANGED_EVENT,
  getJournalContentVaultKey,
} from "@/features/journal/journalContentSession";
import {
  PanelFrame,
  SettingsDialog,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsSelectField,
  ToggleRow,
} from "@/pages/nav-v2/settings/components/V2SettingsControlPrimitives";
import type { Habit } from "@/types";
import { generateHabitScheduleEvents } from "@/lib/habitScheduleSync";
import { AutomationHistorySheet } from "./AutomationHistorySheet";
import { HabitPlanningMappingsField } from "./HabitPlanningMappingsField";
import {
  enableAutomationPreference,
  readAutomationPreference,
  revokeAutomationPreference,
  type AutomationPreferenceEnableInput,
} from "./automationPreferences";
import { resolveFreshAutomationServiceGate } from "./automationServiceControl";
import {
  type AutomationPreference,
  type AutomationRuleId,
} from "./types";
import {
  DEFAULT_CONNECTED_RECORD_RULES,
  EDITABLE_CONNECTED_RECORD_RULES,
  initialConnectedRecordRuleIds,
} from "./connectedRecordsUiRules";

interface ConnectedRecordsSettingsProps {
  habits: Habit[];
}

export function ConnectedRecordsSettings({ habits }: ConnectedRecordsSettingsProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [preference, setPreference] = useState<AutomationPreference | null>(null);
  const [draftRuleIds, setDraftRuleIds] = useState<AutomationRuleId[]>(
    DEFAULT_CONNECTED_RECORD_RULES,
  );
  const [focusHabitId, setFocusHabitId] = useState<string | null>(null);
  const [planningHabitMappings, setPlanningHabitMappings] = useState<Record<string, string>>({});
  const [serviceAllowed, setServiceAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enableConfirmationOpen, setEnableConfirmationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [vaultAvailable, setVaultAvailable] = useState(() => Boolean(getJournalContentVaultKey()));
  const operationInFlightRef = useRef(false);
  const historyTriggerRef = useRef<HTMLButtonElement>(null);

  const activeHabits = useMemo(
    () => habits.filter((habit) => !habit.isArchived),
    [habits],
  );
  const planningCandidates = useMemo(
    () => generateHabitScheduleEvents(activeHabits, 0),
    [activeHabits],
  );

  const applyPreference = useCallback((next: AutomationPreference) => {
    setPreference(next);
    setDraftRuleIds(initialConnectedRecordRuleIds(next));
    setFocusHabitId(next.focusHabitId);
    setPlanningHabitMappings(next.planningHabitMappings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readAutomationPreference(),
      resolveFreshAutomationServiceGate(),
    ])
      .then(([storedPreference, gate]) => {
        if (cancelled) return;
        applyPreference(storedPreference);
        setServiceAllowed(gate.allowed);
      })
      .catch(() => {
        if (!cancelled) {
          setError(tx.connectedRecordsLoadError || "Connected-record settings are unavailable.");
          setServiceAllowed(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyPreference, tx.connectedRecordsLoadError]);

  useEffect(() => {
    const updateVaultState = () => setVaultAvailable(Boolean(getJournalContentVaultKey()));
    window.addEventListener(JOURNAL_CONTENT_SESSION_CHANGED_EVENT, updateVaultState);
    return () => window.removeEventListener(JOURNAL_CONTENT_SESSION_CHANGED_EVENT, updateVaultState);
  }, []);

  const buildEnableInput = (): AutomationPreferenceEnableInput | null => {
    if (draftRuleIds.length === 0) {
      setError(tx.connectedRecordsChooseRuleError || "Choose at least one connection.");
      return null;
    }
    if (
      draftRuleIds.includes("focus.to-mapped-habit.v1") &&
      !focusHabitId
    ) {
      setError(tx.connectedRecordsChooseHabitError || "Choose a habit for completed focus sessions.");
      return null;
    }
    const planningEnabled = draftRuleIds.includes("habit.to-planning.v1");
    const selectedPlanningBlocks = planningEnabled
      ? planningCandidates.filter(
          (event) => event.habitId && planningHabitMappings[event.habitId] === event.id,
        )
      : [];
    if (planningEnabled && selectedPlanningBlocks.length === 0) {
      setError(
        tx.connectedRecordsChoosePlanningBlockError ||
          "Choose at least one dedicated planning block.",
      );
      return null;
    }
    const validPlanningMappings = Object.fromEntries(
      selectedPlanningBlocks.map((event) => [event.habitId!, event.id]),
    );
    return {
      enabledRuleIds: draftRuleIds,
      focusHabitId: draftRuleIds.includes("focus.to-mapped-habit.v1") ? focusHabitId : null,
      focusMinimumMinutes: preference?.focusMinimumMinutes ?? 25,
      planningHabitMappings: validPlanningMappings,
      planningBlocks: selectedPlanningBlocks,
    };
  };

  const saveRules = async () => {
    if (operationInFlightRef.current) return;
    const input = buildEnableInput();
    if (!input) return;
    operationInFlightRef.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const gate = await resolveFreshAutomationServiceGate();
      setServiceAllowed(gate.allowed);
      if (!gate.allowed) {
        setError(
          tx.connectedRecordsServiceUnavailable || "Connected records are unavailable right now.",
        );
        return;
      }
      const next = await enableAutomationPreference(input);
      applyPreference(next);
      setEnableConfirmationOpen(false);
      setStatus(tx.connectedRecordsSaved || "Connected-record rules saved.");
    } catch {
      setError(tx.connectedRecordsSaveError || "Connected-record rules could not be saved.");
    } finally {
      operationInFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleMasterChange = async (checked: boolean) => {
    if (operationInFlightRef.current || loading) return;
    setError(null);
    setStatus(null);
    if (checked) {
      if (!navigator.onLine) {
        setError(tx.connectedRecordsRequiresOnline || "Connect to the internet to turn this on.");
        return;
      }
      if (!vaultAvailable) {
        setError(
          tx.connectedRecordsRequiresProtection || "Unlock and protect your diary first.",
        );
        return;
      }
      const gate = await resolveFreshAutomationServiceGate();
      setServiceAllowed(gate.allowed);
      if (!gate.allowed) {
        setError(
          tx.connectedRecordsServiceUnavailable || "Connected records are unavailable right now.",
        );
        return;
      }
      if (buildEnableInput()) setEnableConfirmationOpen(true);
      return;
    }

    operationInFlightRef.current = true;
    setBusy(true);
    try {
      const result = await revokeAutomationPreference();
      applyPreference(result.preference);
      setStatus(
        result.status === "pending"
          ? tx.connectedRecordsRevocationPending || "Turning off will finish when you reconnect."
          : tx.connectedRecordsDisabled || "Connected records are off.",
      );
    } catch {
      setError(tx.connectedRecordsDisableError || "Connected records could not be turned off.");
    } finally {
      operationInFlightRef.current = false;
      setBusy(false);
    }
  };

  const toggleRule = (ruleId: AutomationRuleId, checked: boolean) => {
    setError(null);
    setStatus(null);
    setDraftRuleIds((current) =>
      checked
        ? current.includes(ruleId)
          ? current
          : [...current, ruleId]
        : current.filter((candidate) => candidate !== ruleId),
    );
  };

  const updatePlanningMapping = (habitId: string, eventId: string | null) => {
    setError(null);
    setStatus(null);
    setPlanningHabitMappings((current) => {
      if (eventId) return { ...current, [habitId]: eventId };
      const next = { ...current };
      delete next[habitId];
      return next;
    });
  };

  return (
    <>
      <PanelFrame
        icon={Link2}
        title={tx.connectedRecordsTitle || "Connected records"}
        description={
          tx.connectedRecordsDescription || "Let enabled ZenFlow areas update one another."
        }
        testId="settings-connected-records"
      >
        <ToggleRow
          icon={Link2}
          title={tx.connectedRecordsToggle || "Connected records"}
          description={
            tx.connectedRecordsToggleHint || "Nothing is connected until you turn this on."
          }
          checked={preference?.enabled === true}
          disabled={loading || busy}
          onCheckedChange={(checked) => void handleMasterChange(checked)}
          testId="connected-records-master-toggle"
          surfaceWeight="quiet"
        />

        <SettingsInset testId="connected-records-rules">
          <SettingsFieldHeader
            icon={Link2}
            title={tx.connectedRecordsRulesTitle || "Choose exact connections"}
            description={
              tx.connectedRecordsRulesDescription ||
              "These rules write only the records named below. They never infer text or feelings."
            }
          />
          {EDITABLE_CONNECTED_RECORD_RULES.map((rule) => (
            <ToggleRow
              key={rule.id}
              icon={rule.icon}
              title={tx[rule.titleKey] || rule.id}
              description={
                tx[`${rule.titleKey}Hint`] ||
                "Runs only after the source record is saved and all safety checks pass."
              }
              checked={draftRuleIds.includes(rule.id)}
              disabled={loading || busy}
              onCheckedChange={(checked) => toggleRule(rule.id, checked)}
              testId={`connected-records-rule-${rule.id}`}
              surfaceWeight="quiet"
            />
          ))}

          {draftRuleIds.includes("focus.to-mapped-habit.v1") ? (
            <div className="space-y-2">
              <label
                htmlFor="connected-records-focus-habit"
                className="block break-words text-sm font-semibold text-foreground [overflow-wrap:break-word]"
              >
                {tx.connectedRecordsFocusHabit || "Habit updated by completed focus sessions"}
              </label>
              <SettingsSelectField
                id="connected-records-focus-habit"
                value={focusHabitId ?? ""}
                onChange={(value) => setFocusHabitId(value || null)}
                options={[
                  { value: "", label: tx.connectedRecordsChooseHabit || "Choose a habit" },
                  ...activeHabits.map((habit) => ({ value: habit.id, label: habit.name })),
                ]}
              />
            </div>
          ) : null}

          {draftRuleIds.includes("habit.to-planning.v1") ? (
            <HabitPlanningMappingsField
              habits={activeHabits}
              candidates={planningCandidates}
              mappings={planningHabitMappings}
              onChange={updatePlanningMapping}
              disabled={loading || busy}
            />
          ) : null}

          {preference?.enabled ? (
            <SettingsInlineButton
              onClick={() => void saveRules()}
              disabled={busy || loading || draftRuleIds.length === 0}
              isLoading={busy}
              icon={Save}
              variant="primary"
              testId="connected-records-save-rules"
            >
              {tx.connectedRecordsSaveRules || "Save rules"}
            </SettingsInlineButton>
          ) : null}
        </SettingsInset>

        <SettingsInlineButton
          buttonRef={historyTriggerRef}
          onClick={() => setHistoryOpen(true)}
          disabled={loading}
          icon={History}
          testId="connected-records-open-history"
        >
          {tx.connectedRecordsHistory || "View history and undo"}
        </SettingsInlineButton>

        {!serviceAllowed && !loading && !preference?.enabled ? (
          <p className="text-xs text-muted-foreground" role="status">
            {tx.connectedRecordsServiceUnavailable || "Connected records are unavailable right now."}
          </p>
        ) : null}
        {!vaultAvailable ? (
          <p className="text-xs text-muted-foreground" role="status">
            {tx.connectedRecordsRequiresProtection || "Unlock and protect your diary first."}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="break-words text-sm text-destructive [overflow-wrap:break-word]">
            {error}
          </p>
        ) : null}
        {status ? (
          <p role="status" aria-live="polite" className="break-words text-sm text-muted-foreground [overflow-wrap:break-word]">
            {status}
          </p>
        ) : null}
      </PanelFrame>

      {enableConfirmationOpen ? (
        <SettingsDialog
          titleId="connected-records-enable-title"
          title={tx.connectedRecordsEnableTitle || "Turn on connected records?"}
          description={
            tx.connectedRecordsEnableDescription || "Review exactly what ZenFlow may write."
          }
          detail={
            tx.connectedRecordsEnableDetail ||
            "Writes happen only for the rules you select. You can turn them off without deleting existing history."
          }
          cancelLabel={tx.cancel || "Cancel"}
          confirmLabel={tx.connectedRecordsEnableConfirm || "Turn on"}
          onCancel={() => setEnableConfirmationOpen(false)}
          onConfirm={() => void saveRules()}
        />
      ) : null}

      <AutomationHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        returnFocusRef={historyTriggerRef}
      />
    </>
  );
}
