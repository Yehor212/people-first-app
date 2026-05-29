import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SyncHealthCard } from "../SyncHealthCard";
import { SYNC_HEALTH_RECEIPT_EVENT } from "@/observability/syncHealthRecorder";

const mocks = vi.hoisted(() => ({
  cloudEnabled: true,
  hasValidSession: true,
  processQueue: vi.fn(() => Promise.resolve()),
  offline: {
    actions: [] as Array<{
      id: string;
      type: string;
      entityId: string;
      payload: unknown;
      timestamp: number;
      retries: number;
      maxRetries: number;
      priority?: "critical" | "high" | "normal" | "low";
      lastError?: string;
    }>,
    pendingCount: 0,
    isOnline: true,
    isProcessing: false,
    hasPendingActions: false,
    lastProcessedAt: null as number | null,
  },
  orchestrator: {
    status: "idle",
    queueLength: 0,
    isOnline: true,
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      settingsCloudSyncTitle: "Cloud sync",
      settingsCloudSyncDescription: "Sync your data across devices.",
      syncNow: "Sync now",
      syncPending: "Waiting",
      syncLastSync: "Last sync",
      syncSuccess: "Sync complete.",
      syncOffline: "Offline",
      syncError: "Sync failed.",
      sessionExpired: "Cloud sync paused",
      syncInboxTitle: "Sync inbox",
      syncOutboxEmpty: "No local actions are waiting.",
      syncOutboxWaiting: "Waiting for sync",
      syncOutboxMore: "{count} more waiting",
      syncRecentActivity: "Recent sync activity",
      syncRetryCount: "{count} retry",
      syncActionSavedLocal: "{domain} saved locally",
      syncActionSynced: "{domain} synced",
      syncActionNeedsRetry: "{domain} needs retry",
      syncActionQueueBlocked: "Saved actions need attention",
      syncActionQueueDrained: "Saved actions sent",
      syncActionQueueDraining: "Sending saved actions",
      syncDomainDefault: "Sync",
      syncDomainHabits: "Habits",
      syncDomainJournal: "Journal",
    },
  }),
}));

vi.mock("@/hooks/useOfflineQueue", () => ({
  useOfflineQueue: () => ({
    ...mocks.offline,
    processQueue: mocks.processQueue,
    clearQueue: vi.fn(),
  }),
}));

vi.mock("@/lib/cloudSyncSettings", () => ({
  isCloudSyncEnabled: () => mocks.cloudEnabled,
}));

vi.mock("@/lib/syncOrchestrator", () => ({
  useSyncOrchestrator: () => ({
    state: mocks.orchestrator,
  }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {},
}));

vi.mock("@/stores", () => ({
  useAppStore: (selector: (state: { hasValidSession: boolean }) => unknown) =>
    selector({ hasValidSession: mocks.hasValidSession }),
}));

describe("SyncHealthCard", () => {
  beforeEach(() => {
    mocks.cloudEnabled = true;
    mocks.hasValidSession = true;
    mocks.processQueue.mockClear();
    mocks.offline.actions = [];
    mocks.offline.pendingCount = 0;
    mocks.offline.isOnline = true;
    mocks.offline.isProcessing = false;
    mocks.offline.hasPendingActions = false;
    mocks.offline.lastProcessedAt = null;
    mocks.orchestrator.status = "idle";
    mocks.orchestrator.queueLength = 0;
    mocks.orchestrator.isOnline = true;
  });

  it("shows outbox counts without exposing entity ids or payloads", () => {
    mocks.offline.actions = [
      {
        id: "local-1",
        type: "DELETE_HABIT",
        entityId: "habit-private-id",
        payload: { name: "private habit name" },
        timestamp: 1000,
        retries: 0,
        maxRetries: 5,
        priority: "critical",
      },
    ];
    mocks.offline.pendingCount = 1;
    mocks.offline.hasPendingActions = true;

    render(<SyncHealthCard />);

    const cardText = screen.getByTestId("sync-health-card").textContent || "";
    expect(cardText).toContain("Cloud sync");
    expect(cardText).toContain("1");
    expect(cardText).toContain("Habits saved locally");
    expect(cardText).toContain("Important");
    expect(cardText).not.toContain("habit-private-id");
    expect(cardText).not.toContain("private habit name");
  });

  it("does not show a manual sync action when there is no pending work", () => {
    render(<SyncHealthCard />);

    expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
  });

  it("lets the user retry pending outbox work", () => {
    mocks.offline.actions = [
      {
        id: "local-1",
        type: "SYNC_JOURNAL_ENTRY",
        entityId: "journal-private-id",
        payload: {},
        timestamp: 1000,
        retries: 0,
        maxRetries: 5,
      },
    ];
    mocks.offline.pendingCount = 1;
    mocks.offline.hasPendingActions = true;

    render(<SyncHealthCard />);

    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    expect(mocks.processQueue).toHaveBeenCalledTimes(1);
  });

  it("updates the latest action from privacy-safe sync receipts", () => {
    render(<SyncHealthCard />);

    fireEvent(
      window,
      new CustomEvent(SYNC_HEALTH_RECEIPT_EVENT, {
        detail: {
          kind: "processed",
          source: "queue",
          actionType: "SYNC_JOURNAL_ENTRY",
        },
      }),
    );

    expect(screen.getByTestId("sync-health-receipt")).toHaveTextContent("Journal synced");
    expect(screen.getByTestId("sync-recent-activity")).toHaveTextContent("Journal synced");
  });

  it("shows blocked saved-action receipts without exposing queued payloads", () => {
    render(<SyncHealthCard />);

    fireEvent(
      window,
      new CustomEvent(SYNC_HEALTH_RECEIPT_EVENT, {
        detail: {
          kind: "queue-blocked",
          source: "delta",
          actionType: "WRITE_SYNC_EVENT",
          priority: "critical",
        },
      }),
    );

    expect(screen.getByTestId("sync-health-receipt")).toHaveTextContent(
      "Saved actions need attention"
    );
    expect(screen.getByTestId("sync-health-card").textContent || "").not.toContain(
      "private journal body"
    );
  });

  it("shows a bounded sync inbox and never renders private queued payloads", () => {
    mocks.offline.actions = [
      {
        id: "local-1",
        type: "SYNC_JOURNAL_ENTRY",
        entityId: "journal-secret-1",
        payload: { text: "private journal body" },
        timestamp: 1000,
        retries: 0,
        maxRetries: 5,
      },
      {
        id: "local-2",
        type: "SYNC_JOURNAL_ENTRY",
        entityId: "journal-secret-2",
        payload: { text: "another private body" },
        timestamp: 1001,
        retries: 1,
        maxRetries: 5,
        lastError: "network contains no content",
      },
      {
        id: "local-3",
        type: "DELETE_HABIT",
        entityId: "habit-secret",
        payload: { name: "private habit" },
        timestamp: 1002,
        retries: 0,
        maxRetries: 5,
      },
      {
        id: "local-4",
        type: "DELETE_HABIT",
        entityId: "habit-secret-2",
        payload: { name: "private habit two" },
        timestamp: 1003,
        retries: 0,
        maxRetries: 5,
      },
    ];
    mocks.offline.pendingCount = 4;
    mocks.offline.hasPendingActions = true;

    render(<SyncHealthCard />);

    const inboxText = screen.getByTestId("sync-inbox").textContent || "";
    expect(inboxText).toContain("Sync inbox");
    expect(inboxText).toContain("1 more waiting");
    expect(inboxText).toContain("Journal saved locally");
    expect(inboxText).toContain("Journal needs retry");
    expect(inboxText).not.toContain("journal-secret");
    expect(inboxText).not.toContain("private journal body");
    expect(inboxText).not.toContain("private habit");
  });
});
