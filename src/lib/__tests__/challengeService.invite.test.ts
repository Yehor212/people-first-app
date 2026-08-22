import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  getCurrentUserId: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  supabase: { from: mocks.from },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { resolveChallengeInvite } from "@/lib/challengeService";

describe("challenge invitation read-only resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.getCurrentUserId.mockResolvedValue("current-user");
  });

  it("returns offline before reading authentication or challenge data", async () => {
    const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    await expect(resolveChallengeInvite("ZEN-ABC123")).resolves.toEqual({
      status: "offline",
    });
    expect(mocks.getCurrentUserId).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    onlineSpy.mockRestore();
  });

  it("returns signed_out without querying the invitation", async () => {
    mocks.getCurrentUserId.mockResolvedValue(null);

    await expect(resolveChallengeInvite("ZEN-ABC123")).resolves.toEqual({
      status: "signed_out",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("distinguishes not-found and unavailable server results", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(resolveChallengeInvite("ZEN-ABC123")).resolves.toEqual({
      status: "not_found",
    });

    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "service_error" } });
    await expect(resolveChallengeInvite("ZEN-ABC123")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("returns only the authenticated actor and canonical server challenge", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "challenge-id",
        code: "ZEN-ABC123",
        creator_id: "creator-id",
        habit_name: "Morning walk",
        habit_icon: "🚶",
        duration: 14,
        start_date: "2026-08-01",
        end_date: "2026-08-15",
        status: "active",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
      error: null,
    });

    await expect(resolveChallengeInvite("zen-abc123")).resolves.toEqual({
      status: "found",
      actorUserId: "current-user",
      challenge: {
        id: "challenge-id",
        code: "ZEN-ABC123",
        creatorId: "creator-id",
        habitName: "Morning walk",
        habitIcon: "🚶",
        duration: 14,
        startDate: "2026-08-01",
        endDate: "2026-08-15",
        status: "active",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    });
    expect(mocks.eq).toHaveBeenCalledWith("code", "ZEN-ABC123");
  });
});
