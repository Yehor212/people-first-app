import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateSyncOwner: vi.fn(),
  sync: vi.fn(),
  safeLocalStorageGet: vi.fn(),
  safeLocalStorageSet: vi.fn(),
  triggerDataRefresh: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("@/lib/syncOrchestrator", () => ({
  syncOrchestrator: { sync: mocks.sync },
}));

vi.mock("@/lib/safeJson", () => ({
  safeLocalStorageGet: mocks.safeLocalStorageGet,
  safeLocalStorageSet: mocks.safeLocalStorageSet,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mocks.triggerDataRefresh,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

import { syncQuests, syncTasks } from "../tasksCloudSync";
import type { Task } from "@/lib/taskMomentum";
import type { Quest } from "@/lib/randomQuests";

const taskOwnedByA: Task = {
  id: "task-a",
  name: "Account A task",
  urgent: false,
  estimatedMinutes: 20,
  completed: false,
};

const questOwnedByA: Quest = {
  id: "quest-a",
  type: "daily",
  category: "focus",
  title: "Account A quest",
  description: "Complete a focused session",
  condition: { type: "focus_minutes", count: 20 },
  reward: { xp: 20, message: "Focused" },
  progress: 0,
  total: 20,
  completed: false,
  expiresAt: Date.now() + 60_000,
  createdAt: Date.now(),
};

describe("tasksCloudSync local account boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sync.mockImplementation(
      async (_type: string, operation: () => Promise<void>) => operation()
    );
    mocks.limit.mockResolvedValue({ data: [], error: null });
    mocks.order.mockReturnValue({ limit: mocks.limit });
    mocks.eq.mockReturnValue({ order: mocks.order });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.triggerDataRefresh.mockResolvedValue(undefined);
  });

  it("does not write merged account-A tasks locally after switching to B", async () => {
    mocks.safeLocalStorageGet.mockReturnValue([taskOwnedByA]);
    mocks.validateSyncOwner
      .mockResolvedValueOnce("account-a")
      .mockResolvedValueOnce("account-a")
      .mockRejectedValue(new Error("Task sync stopped at an account boundary"));

    await expect(syncTasks("account-a")).rejects.toThrow("account boundary");

    expect(mocks.sync).toHaveBeenCalledWith(
      "tasks",
      expect.any(Function),
      expect.objectContaining({ expectedOwnerUserId: "account-a" })
    );
    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
    expect(mocks.triggerDataRefresh).not.toHaveBeenCalled();
  });

  it("does not write merged account-A quests locally after switching to B", async () => {
    mocks.safeLocalStorageGet.mockReturnValue({
      daily: questOwnedByA,
      weekly: null,
      bonus: null,
    });
    mocks.validateSyncOwner
      .mockResolvedValueOnce("account-a")
      .mockResolvedValueOnce("account-a")
      .mockRejectedValue(new Error("Quest sync stopped at an account boundary"));

    await expect(syncQuests("account-a")).rejects.toThrow("account boundary");

    expect(mocks.sync).toHaveBeenCalledWith(
      "quests",
      expect.any(Function),
      expect.objectContaining({ expectedOwnerUserId: "account-a" })
    );
    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
    expect(mocks.triggerDataRefresh).not.toHaveBeenCalled();
  });
});
