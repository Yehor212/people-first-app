import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn<() => Promise<string | null>>(),
  getSession: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    from: mocks.from,
  },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/syncOrchestrator", () => ({
  syncOrchestrator: { sync: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

import { pushQuestsToCloud, pushTasksToCloud } from "../tasksCloudSync";
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

describe("tasksCloudSync account ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue("account-b");
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "account-b" } } },
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
  });

  it("refuses account-A task rows after account B becomes active", async () => {
    mocks.getCurrentUserId.mockResolvedValueOnce("account-a");
    await expect(
      pushTasksToCloud([taskOwnedByA], "account-a")
    ).rejects.toThrow("account boundary");

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("refuses account-A quest rows after account B becomes active", async () => {
    mocks.getCurrentUserId.mockResolvedValueOnce("account-a");
    await expect(
      pushQuestsToCloud(
        { daily: questOwnedByA, weekly: null, bonus: null },
        "account-a"
      )
    ).rejects.toThrow("account boundary");

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("uses the immutable account-A owner for legitimate task rows", async () => {
    mocks.getCurrentUserId.mockResolvedValue("account-a");

    await pushTasksToCloud([taskOwnedByA], "account-a");

    expect(mocks.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ user_id: "account-a", task_id: "task-a" })],
      {
        onConflict: "user_id,task_id",
        ignoreDuplicates: false,
      }
    );
  });

  it("uses the immutable account-A owner for legitimate quest rows", async () => {
    mocks.getCurrentUserId.mockResolvedValue("account-a");

    await pushQuestsToCloud(
      { daily: questOwnedByA, weekly: null, bonus: null },
      "account-a"
    );

    expect(mocks.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ user_id: "account-a", quest_id: "quest-a" })],
      {
        onConflict: "user_id,quest_id",
        ignoreDuplicates: false,
      }
    );
  });
});
