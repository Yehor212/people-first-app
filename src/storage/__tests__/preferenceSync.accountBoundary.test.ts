import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const claimStatus: {
    value: "none" | "pending" | "invalid" | "unavailable";
  } = { value: "none" };
  return {
    getUser: vi.fn(),
    getCurrentUserId: vi.fn(),
    getLocalDataOwnerId: vi.fn(),
    setTheme: vi.fn(() => ({ ok: true })),
    claimStatus,
  };
});

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { getUser: mocks.getUser } },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  readPendingLocalBackupAccountClaim: vi.fn(() => ({ status: mocks.claimStatus.value })),
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: { getState: () => ({ setTheme: mocks.setTheme }) },
}));

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { pullPreferences } from "@/storage/preferenceSync";

describe("owner-bound cloud preference pull", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.claimStatus.value = "none";
    mocks.getCurrentUserId.mockResolvedValue("user-a");
    mocks.getLocalDataOwnerId.mockResolvedValue("user-a");
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-a",
          user_metadata: { ui_preferences: { theme: "dark", defaultTab: "journal" } },
        },
      },
    });
  });

  it("applies preferences only for the exact admitted owner", async () => {
    await pullPreferences("user-a");

    expect(mocks.setTheme).toHaveBeenCalledWith("ink");
    expect(localStorage.getItem("zenflow-default-tab")).toBe("journal");
  });

  it("does not apply account B preferences when A changes to B during getUser", async () => {
    let resolveUser!: (value: unknown) => void;
    mocks.getUser.mockReturnValueOnce(new Promise((resolve) => { resolveUser = resolve; }));

    const pull = pullPreferences("user-a");
    await Promise.resolve();
    mocks.getCurrentUserId.mockResolvedValue("user-b");
    mocks.getLocalDataOwnerId.mockResolvedValue("user-b");
    resolveUser({
      data: {
        user: {
          id: "user-b",
          user_metadata: { ui_preferences: { theme: "dark", defaultTab: "journal" } },
        },
      },
    });
    await pull;

    expect(mocks.setTheme).not.toHaveBeenCalled();
    expect(localStorage.getItem("zenflow-default-tab")).toBeNull();
  });

  it.each(["pending", "invalid", "unavailable"] as const)(
    "does not apply preferences when the claim becomes %s during the request",
    async (status) => {
      let resolveUser!: (value: unknown) => void;
      mocks.getUser.mockReturnValueOnce(new Promise((resolve) => { resolveUser = resolve; }));

      const pull = pullPreferences("user-a");
      await Promise.resolve();
      mocks.claimStatus.value = status;
      resolveUser({
        data: {
          user: {
            id: "user-a",
            user_metadata: { ui_preferences: { theme: "dark", defaultTab: "journal" } },
          },
        },
      });
      await pull;

      expect(mocks.setTheme).not.toHaveBeenCalled();
      expect(localStorage.getItem("zenflow-default-tab")).toBeNull();
    }
  );
});
