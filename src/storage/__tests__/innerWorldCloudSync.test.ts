import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCurrentUserId: vi.fn(),
  getSession: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    from: mocks.from,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

import { createDefaultInnerWorld } from "@/lib/innerWorldHelpers";
import { pushInnerWorldToCloud } from "@/storage/innerWorldCloudSync";

describe("innerWorldCloudSync account ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.getCurrentUserId.mockResolvedValue("user-a");
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-a" } } },
      error: null,
    });
  });

  it("does not upsert account A world data after the active account changes to B", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-b");
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-b" } } },
      error: null,
    });

    await pushInnerWorldToCloud(createDefaultInnerWorld(), "user-a");

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("upserts a legitimate world only under its explicitly stamped owner", async () => {
    const world = createDefaultInnerWorld();

    await pushInnerWorldToCloud(world, "user-a");

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-a",
        world_data: world,
      }),
      { onConflict: "user_id" }
    );
  });
});
