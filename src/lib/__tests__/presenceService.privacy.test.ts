import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  getChannels: vi.fn(),
  getCurrentUserId: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    channel: mocks.channel,
    getChannels: mocks.getChannels,
    removeChannel: mocks.removeChannel,
  },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

function legacyPublicPresenceChannel(ownerUserId: string) {
  const channel = {
    topic: "realtime:zenflow-presence",
    params: { config: { presence: { key: ownerUserId } } },
    on: vi.fn(),
    subscribe: vi.fn(),
    track: vi.fn(() => Promise.resolve("ok")),
    untrack: vi.fn(() => Promise.resolve("ok")),
    presenceState: vi.fn(() => ({ [ownerUserId]: [{ online_at: "now" }] })),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return channel;
}

describe("Presence privacy boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.getCurrentUserId.mockResolvedValue(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    mocks.getChannels.mockReturnValue([]);
    mocks.removeChannel.mockResolvedValue("ok");
    mocks.channel.mockReturnValue(
      legacyPublicPresenceChannel("123e4567-e89b-12d3-a456-426614174000"),
    );
  });

  it("does not publish raw account UUIDs to the shared public Presence topic", async () => {
    const { getOnlineUserIds, joinPresence } = await import("@/lib/presenceService");

    await joinPresence();

    expect(mocks.channel).not.toHaveBeenCalled();
    expect(getOnlineUserIds()).toEqual(new Set());
  });

  it("discovers and removes a legacy public Presence channel retained by the shared SDK client", async () => {
    const ownerUserId = "123e4567-e89b-12d3-a456-426614174000";
    const legacyChannel = legacyPublicPresenceChannel(ownerUserId);
    mocks.getChannels.mockReturnValue([legacyChannel]);
    const { leavePresence } = await import("@/lib/presenceService");

    await leavePresence();

    expect(legacyChannel.untrack).toHaveBeenCalledTimes(1);
    expect(mocks.removeChannel).toHaveBeenCalledWith(legacyChannel);
  });

  it("requires both untrack and channel removal acknowledgements", async () => {
    const ownerUserId = "123e4567-e89b-12d3-a456-426614174000";
    const legacyChannel = legacyPublicPresenceChannel(ownerUserId);
    legacyChannel.untrack.mockResolvedValueOnce("timed out");
    mocks.getChannels.mockReturnValue([legacyChannel]);
    const { leavePresenceForAccountBoundary } = await import(
      "@/lib/presenceService"
    );

    await expect(
      leavePresenceForAccountBoundary(ownerUserId),
    ).rejects.toThrow("Presence teardown was not acknowledged");

    expect(legacyChannel.untrack).toHaveBeenCalledTimes(1);
    expect(mocks.removeChannel).toHaveBeenCalledWith(legacyChannel);
  });

  it("preserves a newer account's retained channel during stale-owner cleanup", async () => {
    const previousOwnerUserId = "123e4567-e89b-12d3-a456-426614174000";
    const currentOwnerUserId = "223e4567-e89b-12d3-a456-426614174000";
    const currentChannel = legacyPublicPresenceChannel(currentOwnerUserId);
    mocks.getChannels.mockReturnValue([currentChannel]);
    const { leavePresenceForAccountBoundary } = await import(
      "@/lib/presenceService"
    );

    await expect(
      leavePresenceForAccountBoundary(previousOwnerUserId),
    ).resolves.toEqual({ status: "owner-changed" });

    expect(currentChannel.untrack).not.toHaveBeenCalled();
    expect(mocks.removeChannel).not.toHaveBeenCalled();
  });

  it("blocks owner-bound cleanup when a retained channel has no verifiable owner", async () => {
    const ownerUserId = "123e4567-e89b-12d3-a456-426614174000";
    const unknownChannel = legacyPublicPresenceChannel(ownerUserId);
    (unknownChannel as unknown as { params: unknown }).params = {
      config: { presence: {} },
    };
    mocks.getChannels.mockReturnValue([unknownChannel]);
    const { leavePresenceForAccountBoundary } = await import(
      "@/lib/presenceService"
    );

    await expect(
      leavePresenceForAccountBoundary(ownerUserId),
    ).rejects.toThrow("Presence channel ownership could not be verified");

    expect(unknownChannel.untrack).not.toHaveBeenCalled();
    expect(mocks.removeChannel).not.toHaveBeenCalled();
  });

  it("blocks mixed-owner teardown instead of deleting either account's channel", async () => {
    const previousOwnerUserId = "123e4567-e89b-12d3-a456-426614174000";
    const currentOwnerUserId = "223e4567-e89b-12d3-a456-426614174000";
    const previousChannel = legacyPublicPresenceChannel(previousOwnerUserId);
    const currentChannel = legacyPublicPresenceChannel(currentOwnerUserId);
    mocks.getChannels.mockReturnValue([previousChannel, currentChannel]);
    const { leavePresenceForAccountBoundary } = await import(
      "@/lib/presenceService"
    );

    await expect(
      leavePresenceForAccountBoundary(previousOwnerUserId),
    ).rejects.toThrow("Presence channel ownership is mixed");

    expect(previousChannel.untrack).not.toHaveBeenCalled();
    expect(currentChannel.untrack).not.toHaveBeenCalled();
    expect(mocks.removeChannel).not.toHaveBeenCalled();
  });
});
