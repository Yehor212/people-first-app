import { useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const TRANSACTION_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
  loadRows: vi.fn(),
  backRegistrations: [] as Array<{ open: boolean; close: () => void }>,
  requestUndo: vi.fn(),
  forget: vi.fn(),
  clearAll: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      cancel: "Cancel",
      close: "Close",
      automationHistoryActionError: "That change could not be completed.",
      automationHistoryVaultRequired: "Unlock your protected diary to change history.",
      automationHistoryClearAll: "Clear all history",
      automationHistoryClearConfirm: "Clear all",
      automationHistoryClearDescription:
        "This permanently removes every connected-record undo and turns connected records off.",
      automationHistoryClearTitle: "Clear all connected history?",
      automationHistoryDescription: "Encrypted history of automatic writes.",
      automationHistoryEmpty: "No connected-record history yet.",
      automationHistoryError: "Connected-record history is unavailable right now.",
      automationHistoryForget: "Forget",
      automationHistoryForgetConfirm: "Forget",
      automationHistoryForgetDescription:
        "This removes this undo history but keeps your mood, diary, focus, and habit records.",
      automationHistoryForgetTitle: "Forget this history item?",
      connectedRecordsRuleMoodJournal: "Mood note → diary entry",
      automationHistoryStatusConnected: "Connected",
      automationHistoryStatusNeedsReview: "Needs review",
      automationHistoryStatusReverted: "Undone",
      automationHistoryTitle: "Connected-record history",
      automationHistoryUndo: "Undo",
      automationHistoryUndoPending: "Undo requested",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: (open: boolean, close: () => void) => {
    mocks.backRegistrations.push({ open, close });
  },
}));

vi.mock("@/storage/db", () => ({
  db: {
    automationTransactions: {
      where: () => ({ equals: () => ({ toArray: () => mocks.loadRows() }) }),
    },
  },
  getLocalDataOwnerId: async () => OWNER_ID,
}));

vi.mock("@/storage/eventSync", () => ({
  getPersistentDeviceId: async () => "device-test",
}));

vi.mock("../automationUndo", () => ({ requestAutomationUndo: mocks.requestUndo }));
vi.mock("../automationHistoryClear", () => ({
  clearAllAutomationHistory: mocks.clearAll,
  forgetAutomationTransactions: mocks.forget,
}));

import { AutomationHistorySheet } from "../AutomationHistorySheet";

function committedRow() {
  return {
    kind: "transaction",
    id: TRANSACTION_ID,
    schemaVersion: 1,
    ownerUserId: OWNER_ID,
    consentEpoch: "33333333-3333-4333-8333-333333333333",
    sourceKey: `sha256:${"a".repeat(64)}`,
    ruleId: "mood.note-to-journal.v1",
    ruleVersion: 1,
    sourceType: "mood",
    sourceId: "mood-1",
    status: "committed",
    revisionCiphertext:
      "zenflow:automation-revision:v1:private-canary-that-must-never-render",
    createdAt: 100,
    updatedAt: 110,
    serverSequence: 4,
    historyGeneration: 1,
  };
}

describe("AutomationHistorySheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.backRegistrations.length = 0;
    mocks.rows = [committedRow()];
    mocks.loadRows.mockImplementation(async () => mocks.rows);
    mocks.requestUndo.mockResolvedValue({ status: "pending", operationId: "undo-1" });
    mocks.forget.mockResolvedValue({ purged: 1, all: false });
    mocks.clearAll.mockResolvedValue({ purged: 1, all: true });
  });

  it("renders ciphertext-safe provenance and owns Android Back", async () => {
    const onClose = vi.fn();
    render(<AutomationHistorySheet open onClose={onClose} />);

    expect(await screen.findByText("Mood note → diary entry")).toBeVisible();
    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.queryByText("private-canary-that-must-never-render")).not.toBeInTheDocument();

    const back = mocks.backRegistrations.find((registration) => registration.open);
    expect(back).toBeDefined();
    back?.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses logical safe-area spacing, 48px actions and reduced-motion-safe progress", async () => {
    let resolveRows: ((value: unknown[]) => void) | undefined;
    mocks.loadRows.mockImplementationOnce(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolveRows = resolve;
        }),
    );
    render(<AutomationHistorySheet open onClose={vi.fn()} />);

    const sheet = screen.getByTestId("automation-history-sheet");
    expect(sheet).toHaveClass(
      "pe-[max(1rem,var(--safe-inline-end))]",
      "pb-[calc(var(--safe-bottom)+1rem)]",
    );
    const title = screen.getByRole("heading", { name: "Connected-record history" });
    expect(title.parentElement).toHaveClass("pr-12");
    expect(title.parentElement).not.toHaveClass("pe-12");
    const loading = screen.getByRole("status");
    const progressIcon = loading.querySelector("svg");
    expect(progressIcon).toHaveClass("motion-safe:animate-spin");
    expect(progressIcon).not.toHaveClass("animate-spin");

    await waitFor(() => expect(resolveRows).toBeTypeOf("function"));
    await act(async () => {
      resolveRows?.(mocks.rows);
    });

    const undo = await screen.findByRole("button", { name: "Undo" });
    const forget = screen.getByRole("button", { name: "Forget" });
    const clear = screen.getByRole("button", { name: "Clear all history" });
    for (const action of [undo, forget, clear]) {
      expect(action).toHaveClass("min-h-[48px]");
      expect(action).toHaveClass("motion-safe:transition-[transform,background-color,border-color,box-shadow,color,opacity]");
    }
  });

  it("queues undo without changing the projection optimistically", async () => {
    render(<AutomationHistorySheet open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() =>
      expect(mocks.requestUndo).toHaveBeenCalledWith(TRANSACTION_ID, OWNER_ID, "device-test"),
    );
    expect(await screen.findByText("Undo requested")).toBeVisible();
  });

  it("requires a separate explicit confirmation before clearing every undo record", async () => {
    render(<AutomationHistorySheet open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Clear all history" }));
    expect(
      await screen.findByRole("dialog", { name: "Clear all connected history?" }),
    ).toBeVisible();
    expect(mocks.clearAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    await waitFor(() => expect(mocks.clearAll).toHaveBeenCalledWith(OWNER_ID, "device-test"));
  });

  it("requires a separate confirmation before forgetting one history item", async () => {
    render(<AutomationHistorySheet open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Forget" }));
    const dialog = await screen.findByRole("dialog", { name: "Forget this history item?" });
    expect(mocks.forget).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Forget" }));

    await waitFor(() =>
      expect(mocks.forget).toHaveBeenCalledWith([TRANSACTION_ID], OWNER_ID, "device-test"),
    );
  });

  it("labels conflicts for review and prevents an unsafe undo retry", async () => {
    mocks.rows = [{ ...committedRow(), status: "conflict" }];
    render(<AutomationHistorySheet open onClose={vi.fn()} />);

    expect(await screen.findByText("Needs review")).toBeVisible();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("renders terminal undo, empty and load-error states without exposing a payload", async () => {
    mocks.rows = [
      {
        ...committedRow(),
        status: "undone",
        undoneAt: 120,
        undoTransactionId: "44444444-4444-4444-8444-444444444444",
        updatedAt: 120,
      },
    ];
    const view = render(<AutomationHistorySheet open onClose={vi.fn()} />);

    expect(await screen.findByText("Undone")).toBeVisible();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();

    mocks.rows = [];
    view.rerender(<AutomationHistorySheet open={false} onClose={vi.fn()} />);
    view.rerender(<AutomationHistorySheet open onClose={vi.fn()} />);
    expect(await screen.findByText("No connected-record history yet.")).toBeVisible();

    mocks.loadRows.mockRejectedValueOnce(new Error("storage unavailable"));
    view.rerender(<AutomationHistorySheet open={false} onClose={vi.fn()} />);
    view.rerender(<AutomationHistorySheet open onClose={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connected-record history is unavailable right now.",
    );
    expect(screen.queryByText("storage unavailable")).not.toBeInTheDocument();
  });

  it("maps a locked vault failure to an actionable privacy-safe message", async () => {
    mocks.forget.mockRejectedValue({ code: "AUTOMATION_HISTORY_CLEAR_VAULT_LOCKED" });
    render(<AutomationHistorySheet open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Forget" }));
    const dialog = await screen.findByRole("dialog", { name: "Forget this history item?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Forget" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unlock your protected diary to change history.",
    );
  });

  it("serializes repeated destructive confirmations into one clear request", async () => {
    let resolveClear: ((value: { purged: number; all: boolean }) => void) | undefined;
    mocks.clearAll.mockImplementation(
      () =>
        new Promise<{ purged: number; all: boolean }>((resolve) => {
          resolveClear = resolve;
        }),
    );
    render(<AutomationHistorySheet open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Clear all history" }));
    const dialog = await screen.findByRole("dialog", { name: "Clear all connected history?" });
    const confirm = within(dialog).getByRole("button", { name: "Clear all" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(mocks.clearAll).toHaveBeenCalledTimes(1));
    resolveClear?.({ purged: 1, all: true });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Clear all connected history?" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("restores focus to the history trigger after Android Back closes the sheet", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
            Open history
          </button>
          <AutomationHistorySheet
            open={open}
            onClose={() => setOpen(false)}
            returnFocusRef={triggerRef}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open history" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByTestId("automation-history-sheet");

    const back = [...mocks.backRegistrations].reverse().find((registration) => registration.open);
    expect(back).toBeDefined();
    back?.close();

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
