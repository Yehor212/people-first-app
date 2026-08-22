import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  channel: {
    on: vi.fn(),
    send: vi.fn(),
    subscribe: vi.fn(),
  },
  channelFactory: vi.fn(),
  removeChannel: vi.fn(),
  loggerSync: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    sync: mocks.loggerSync,
    warn: mocks.loggerWarn,
  },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    channel: mocks.channelFactory,
    removeChannel: mocks.removeChannel,
  },
}));

import {
  broadcastChange,
  destroySyncBroadcast,
  initSyncBroadcast,
  onRemoteChange,
} from "../syncBroadcast";

type BroadcastCallback = (event: { payload: unknown }) => void;
type SubscribeCallback = (status: string) => void;

describe("syncBroadcast", () => {
  let broadcastHandler: BroadcastCallback | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    broadcastHandler = null;
    mocks.channel.on.mockImplementation(
      (_type: string, _filter: unknown, handler: BroadcastCallback) => {
        broadcastHandler = handler;
        return mocks.channel;
      }
    );
    mocks.channel.send.mockResolvedValue("ok");
    mocks.channel.subscribe.mockImplementation((handler: SubscribeCallback) => {
      handler("SUBSCRIBED");
      return mocks.channel;
    });
    mocks.channelFactory.mockReturnValue(mocks.channel);
  });

  afterEach(() => {
    destroySyncBroadcast(true);
  });

  it("joins a private per-user channel for sync wake signals", () => {
    initSyncBroadcast("user-1");

    expect(mocks.channelFactory).toHaveBeenCalledWith("sync-signal:user-1", {
      config: { private: true },
    });
  });

  it("sanitizes broadcast payloads before notifying remote-change handlers", () => {
    const handler = vi.fn();
    initSyncBroadcast("user-1");
    onRemoteChange(handler);

    broadcastHandler?.({
      payload: {
        entity: "journal",
        deviceId: "remote-device",
        ts: 1770000000000,
        seq: 1,
        eventSeq: 42,
        privateContent: "must not pass through",
      },
    });

    expect(handler).toHaveBeenCalledWith({
      entity: "journal",
      deviceId: "remote-device",
      ts: 1770000000000,
      seq: 1,
      eventSeq: 42,
    });
  });

  it("ignores malformed wake signals", () => {
    const handler = vi.fn();
    initSyncBroadcast("user-1");
    onRemoteChange(handler);

    broadcastHandler?.({
      payload: {
        entity: "journal",
        deviceId: "",
        ts: 1770000000000,
        seq: 1,
      },
    });
    broadcastHandler?.({
      payload: {
        entity: "unknown",
        deviceId: "remote-device",
        ts: 1770000000000,
        seq: 2,
      },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).toHaveBeenCalledWith("[Broadcast] Ignored malformed sync signal");
  });

  it("sends only minimal wake metadata", () => {
    initSyncBroadcast("user-1");

    broadcastChange("habits", 55);

    expect(mocks.channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "data-changed",
      payload: expect.objectContaining({
        entity: "habits",
        deviceId: expect.any(String),
        ts: expect.any(Number),
        seq: 1,
        eventSeq: 55,
      }),
    });
    const payload = mocks.channel.send.mock.calls[0][0].payload;
    expect(payload).not.toHaveProperty("entityId");
    expect(payload).not.toHaveProperty("payload");
    expect(payload).not.toHaveProperty("privateContent");
  });

  it("accepts the ciphertext-only automation wake category without forwarding a payload", () => {
    const handler = vi.fn();
    initSyncBroadcast("user-1");
    onRemoteChange(handler);

    broadcastHandler?.({
      payload: {
        entity: "automation",
        deviceId: "remote-device",
        ts: 1770000000000,
        seq: 3,
        eventSeq: 56,
        revisionCiphertext: "must not pass through",
      },
    });

    expect(handler).toHaveBeenCalledWith({
      entity: "automation",
      deviceId: "remote-device",
      ts: 1770000000000,
      seq: 3,
      eventSeq: 56,
    });
  });
});
