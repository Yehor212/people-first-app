import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Habit } from "@/types";
import type { AutomationPreference } from "../types";

const mocks = vi.hoisted(() => ({
  enable: vi.fn(),
  read: vi.fn(),
  revoke: vi.fn(),
  resolveGate: vi.fn(),
  vaultKey: ["vault-key", null][0],
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      cancel: "Cancel",
      connectedRecordsDescription: "Let enabled ZenFlow areas update one another.",
      connectedRecordsEnableConfirm: "Turn on",
      connectedRecordsEnableDescription: "Review exactly what ZenFlow may write.",
      connectedRecordsEnableDetail: "Writes happen only for the rules you select.",
      connectedRecordsEnableTitle: "Turn on connected records?",
      connectedRecordsFocusHabit: "Habit updated by completed focus sessions",
      connectedRecordsHistory: "View history and undo",
      connectedRecordsRequiresProtection: "Unlock and protect your diary first.",
      connectedRecordsRevocationPending: "Turning off will finish when you reconnect.",
      connectedRecordsRuleFocusHabit: "Completed focus → mapped habit",
      connectedRecordsRuleHabitPlanning: "Habit → dedicated planning block",
      connectedRecordsRuleHabitPlanningHint:
        "Marks only the exact same-date block you choose after the habit is completed.",
      connectedRecordsPlanningMappingsTitle: "Dedicated planning blocks",
      connectedRecordsPlanningMappingsDescription:
        "Choose one of today's reminder blocks for each habit you want to connect.",
      connectedRecordsPlanningHabitName: "Habit",
      connectedRecordsPlanningBlockLabel: "Today's dedicated block",
      connectedRecordsPlanningBlockNone: "Not connected",
      connectedRecordsPlanningNoBlocks:
        "Add an enabled reminder to a habit before connecting a planning block.",
      connectedRecordsChoosePlanningBlockError:
        "Choose at least one dedicated planning block.",
      connectedRecordsRuleJournalMood: "Explicit diary mood → mood check-in",
      connectedRecordsRuleMoodJournal: "Mood note → diary entry",
      connectedRecordsSaveRules: "Save rules",
      connectedRecordsServiceUnavailable: "Connected records are unavailable right now.",
      connectedRecordsTitle: "Connected records",
      connectedRecordsToggle: "Connected records",
      connectedRecordsToggleHint: "Nothing is connected until you turn this on.",
      connectedRecordsChooseHabit: "Choose a habit",
      connectedRecordsChooseRuleError: "Choose at least one connection.",
    },
  }),
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  JOURNAL_CONTENT_SESSION_CHANGED_EVENT: "journal-session-change",
  getJournalContentVaultKey: () => mocks.vaultKey,
}));

vi.mock("../automationPreferences", () => ({
  enableAutomationPreference: mocks.enable,
  readAutomationPreference: mocks.read,
  revokeAutomationPreference: mocks.revoke,
}));

vi.mock("../automationServiceControl", () => ({
  resolveFreshAutomationServiceGate: mocks.resolveGate,
}));

vi.mock("../AutomationHistorySheet", () => ({
  AutomationHistorySheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="automation-history-sheet" /> : null,
}));

import { ConnectedRecordsSettings } from "../ConnectedRecordsSettings";

const disabledPreference: AutomationPreference = {
  schemaVersion: 1,
  enabled: false,
  serverRevision: 0,
  consentEpoch: null,
  consentedAt: null,
  revokedAt: null,
  revocationPending: false,
  enabledRuleIds: [],
  focusHabitId: null,
  focusMinimumMinutes: 25,
  planningHabitMappings: {},
  updatedAt: 1,
};

const habit: Habit = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Read",
  icon: "book",
  color: 0,
  position: 0,
  createdAt: 1,
  habitType: "boolean",
  frequency: { numerator: 1, denominator: 1 },
  question: "",
  description: "",
  isArchived: false,
  targetValue: 1,
  targetType: "atLeast",
  unit: "",
  entries: {},
  reminders: [],
};

describe("ConnectedRecordsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.vaultKey = "vault-key";
    mocks.read.mockResolvedValue(disabledPreference);
    mocks.resolveGate.mockResolvedValue({ allowed: true, code: "SERVICE_ENABLED" });
    mocks.enable.mockImplementation(async (input) => ({
      ...disabledPreference,
      enabled: true,
      serverRevision: 1,
      consentEpoch: "22222222-2222-4222-8222-222222222222",
      consentedAt: 2,
      enabledRuleIds: input.enabledRuleIds,
      focusHabitId: input.focusHabitId,
      updatedAt: 2,
    }));
    mocks.revoke.mockResolvedValue({ status: "completed", preference: disabledPreference });
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
  });

  it("requires one explicit confirmation before enabling the selected write rules", async () => {
    render(<ConnectedRecordsSettings habits={[habit]} />);

    const master = await screen.findByRole("switch", { name: "Connected records" });
    fireEvent.click(master);

    expect(await screen.findByRole("dialog", { name: "Turn on connected records?" })).toBeVisible();
    expect(mocks.enable).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));

    await waitFor(() =>
      expect(mocks.enable).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledRuleIds: [
            "mood.note-to-journal.v1",
            "journal.mood-to-checkin.v1",
          ],
          focusHabitId: null,
        }),
      ),
    );
  });

  it("fails closed when the fresh service control is unavailable", async () => {
    mocks.resolveGate.mockResolvedValue({
      allowed: false,
      code: "SERVICE_REFRESH_UNAVAILABLE",
    });
    render(<ConnectedRecordsSettings habits={[habit]} />);

    fireEvent.click(await screen.findByRole("switch", { name: "Connected records" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connected records are unavailable right now.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.enable).not.toHaveBeenCalled();
  });

  it("requires the protected diary vault before showing the enable confirmation", async () => {
    mocks.vaultKey = null;
    render(<ConnectedRecordsSettings habits={[habit]} />);

    fireEvent.click(await screen.findByRole("switch", { name: "Connected records" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unlock and protect your diary first.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.enable).not.toHaveBeenCalled();
  });

  it("rejects an empty rule selection before requesting write authority", async () => {
    render(<ConnectedRecordsSettings habits={[habit]} />);

    fireEvent.click(await screen.findByRole("switch", { name: "Mood note → diary entry" }));
    fireEvent.click(screen.getByRole("switch", { name: "Explicit diary mood → mood check-in" }));
    fireEvent.click(screen.getByRole("switch", { name: "Connected records" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose at least one connection.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.enable).not.toHaveBeenCalled();
  });

  it("saves a focus-to-habit mapping without another consent dialog after opt-in", async () => {
    mocks.read.mockResolvedValue({
      ...disabledPreference,
      enabled: true,
      serverRevision: 4,
      consentEpoch: "22222222-2222-4222-8222-222222222222",
      consentedAt: 2,
      enabledRuleIds: ["mood.note-to-journal.v1"],
      updatedAt: 4,
    });
    render(<ConnectedRecordsSettings habits={[habit]} />);

    fireEvent.click(await screen.findByRole("switch", { name: "Completed focus → mapped habit" }));
    fireEvent.change(screen.getByLabelText("Habit updated by completed focus sessions"), {
      target: { value: habit.id },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save rules" }));

    await waitFor(() =>
      expect(mocks.enable).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledRuleIds: ["mood.note-to-journal.v1", "focus.to-mapped-habit.v1"],
          focusHabitId: habit.id,
        }),
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("serializes repeated confirmation clicks into one enable request", async () => {
    let resolveEnable: ((value: AutomationPreference) => void) | undefined;
    mocks.enable.mockImplementation(
      () =>
        new Promise<AutomationPreference>((resolve) => {
          resolveEnable = resolve;
        }),
    );
    render(<ConnectedRecordsSettings habits={[habit]} />);

    fireEvent.click(await screen.findByRole("switch", { name: "Connected records" }));
    const confirm = await screen.findByRole("button", { name: "Turn on" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(mocks.enable).toHaveBeenCalledTimes(1));
    resolveEnable?.({
      ...disabledPreference,
      enabled: true,
      serverRevision: 1,
      consentEpoch: "22222222-2222-4222-8222-222222222222",
      consentedAt: 2,
      enabledRuleIds: ["mood.note-to-journal.v1", "journal.mood-to-checkin.v1"],
      updatedAt: 2,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps every rule switch keyboard-addressable with a 48px target and description", async () => {
    render(<ConnectedRecordsSettings habits={[habit]} />);

    const switches = await screen.findAllByRole("switch");
    expect(switches).toHaveLength(5);
    for (const control of switches) {
      expect(control).toHaveClass("min-h-[48px]", "min-w-[52px]");
      expect(control).toHaveAttribute("aria-describedby");
      expect(control).not.toHaveAttribute("tabindex", "-1");
    }

    const moodRule = screen.getByRole("switch", { name: "Mood note → diary entry" });
    expect(moodRule).toBeChecked();
    fireEvent.keyDown(moodRule, { key: " " });
    expect(moodRule).not.toBeChecked();
    expect(screen.getByRole("button", { name: "View history and undo" })).toHaveClass(
      "min-h-[48px]",
    );
  });

  it("maps the fourth rule to one explicit same-date generated block with ownership markers", async () => {
    const plannedHabit: Habit = {
      ...habit,
      reminders: [{ enabled: true, time: "09:30", days: [] }],
    };
    render(<ConnectedRecordsSettings habits={[plannedHabit]} />);

    fireEvent.click(
      await screen.findByRole("switch", { name: "Habit → dedicated planning block" }),
    );
    const mapping = screen.getByLabelText("Today's dedicated block");
    const dedicatedBlockOption = mapping.querySelectorAll("option")[1];
    expect(dedicatedBlockOption.textContent).toBe("\u206609:30–10:00\u2069");
    const eventId = dedicatedBlockOption.value;
    fireEvent.change(mapping, { target: { value: eventId } });
    fireEvent.click(screen.getByRole("switch", { name: "Connected records" }));
    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }));

    await waitFor(() =>
      expect(mocks.enable).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledRuleIds: [
            "mood.note-to-journal.v1",
            "journal.mood-to-checkin.v1",
            "habit.to-planning.v1",
          ],
          planningHabitMappings: { [plannedHabit.id]: eventId },
          planningBlocks: [
            expect.objectContaining({
              id: eventId,
              source: "habit",
              habitId: plannedHabit.id,
              isAutoGenerated: true,
              isEditable: false,
              completed: false,
            }),
          ],
        }),
      ),
    );
  });

  it("fails closed when planning is selected without an eligible dedicated block", async () => {
    render(<ConnectedRecordsSettings habits={[habit]} />);

    fireEvent.click(
      await screen.findByRole("switch", { name: "Habit → dedicated planning block" }),
    );
    expect(screen.getByText("Add an enabled reminder to a habit before connecting a planning block."))
      .toBeVisible();
    fireEvent.click(screen.getByRole("switch", { name: "Connected records" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose at least one dedicated planning block.",
    );
    expect(mocks.enable).not.toHaveBeenCalled();
  });

  it("revokes immediately and keeps an offline revocation visibly pending", async () => {
    mocks.read.mockResolvedValue({
      ...disabledPreference,
      enabled: true,
      serverRevision: 4,
      consentEpoch: "22222222-2222-4222-8222-222222222222",
      consentedAt: 2,
      enabledRuleIds: ["mood.note-to-journal.v1"],
      updatedAt: 4,
    });
    mocks.revoke.mockResolvedValue({
      status: "pending",
      preference: {
        ...disabledPreference,
        serverRevision: 4,
        revokedAt: 5,
        revocationPending: true,
        updatedAt: 5,
      },
    });
    render(<ConnectedRecordsSettings habits={[habit]} />);

    const master = await screen.findByRole("switch", { name: "Connected records" });
    expect(master).toBeChecked();
    fireEvent.click(master);

    await waitFor(() => expect(mocks.revoke).toHaveBeenCalledTimes(1));
    expect(master).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Turning off will finish when you reconnect.",
    );
  });
});
