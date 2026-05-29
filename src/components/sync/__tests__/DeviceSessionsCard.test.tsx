import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceSessionsCard } from "../DeviceSessionsCard";

type MockDeviceSession = {
  id: string;
  user_id: string;
  device_id: string;
  label: string;
  platform: "desktop" | "pwa";
  app_version: string;
  first_seen_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

const mocks = vi.hoisted(() => ({
  currentDeviceId: "device_current_private",
  sessions: [
    {
      id: "session-current",
      user_id: "user-1",
      device_id: "device_current_private",
      label: "Chrome on Windows",
      platform: "desktop",
      app_version: "1.7.3",
      first_seen_at: "2026-05-18T01:00:00.000Z",
      last_seen_at: "2026-05-18T02:00:00.000Z",
      revoked_at: null,
      created_at: "2026-05-18T01:00:00.000Z",
      updated_at: "2026-05-18T02:00:00.000Z",
    },
    {
      id: "session-phone",
      user_id: "user-1",
      device_id: "device_phone_private",
      label: "PWA on iOS",
      platform: "pwa",
      app_version: "1.7.3",
      first_seen_at: "2026-05-17T01:00:00.000Z",
      last_seen_at: "2026-05-17T02:00:00.000Z",
      revoked_at: null,
      created_at: "2026-05-17T01:00:00.000Z",
      updated_at: "2026-05-17T02:00:00.000Z",
    },
  ] satisfies MockDeviceSession[],
  upsert: vi.fn(() => Promise.resolve(null)),
  list: vi.fn<() => Promise<MockDeviceSession[]>>(() => Promise.resolve([])),
  getCurrent: vi.fn(() => Promise.resolve("device_current_private")),
  revoke: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      refresh: "Refresh",
      syncDeviceSessionsTitle: "Your devices",
      syncDeviceSessionsDescription: "See where your account is syncing.",
      syncDeviceSessionsActive: "Active devices",
      syncDeviceCurrent: "Current device",
      syncDeviceLastSeen: "Last seen",
      syncRevokeDevice: "Mark inactive",
      syncRevoking: "Revoking",
      syncDeviceSessionsFootnote: "No private content is stored.",
    },
  }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {},
}));

vi.mock("@/storage/deviceSessions", () => ({
  DEVICE_SESSIONS_UPDATED_EVENT: "zenflow:device-sessions-updated",
  getCurrentDeviceSessionId: mocks.getCurrent,
  listDeviceSessions: mocks.list,
  revokeDeviceSession: mocks.revoke,
  upsertCurrentDeviceSession: mocks.upsert,
}));

describe("DeviceSessionsCard", () => {
  beforeEach(() => {
    mocks.upsert.mockClear();
    mocks.getCurrent.mockClear();
    mocks.list.mockReset();
    mocks.revoke.mockClear();
    mocks.list.mockResolvedValue(mocks.sessions);
  });

  it("shows account devices without exposing raw device ids", async () => {
    render(<DeviceSessionsCard />);

    expect(await screen.findByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText("PWA on iOS")).toBeInTheDocument();

    const cardText = screen.getByTestId("device-sessions-card").textContent || "";
    expect(cardText).toContain("Current device");
    expect(cardText).not.toContain("device_current_private");
    expect(cardText).not.toContain("device_phone_private");
  });

  it("marks a non-current device inactive only", async () => {
    render(<DeviceSessionsCard />);

    const revoke = await screen.findByRole("button", { name: "Mark inactive" });
    fireEvent.click(revoke);

    await waitFor(() => {
      expect(mocks.revoke).toHaveBeenCalledWith("session-phone");
    });
  });
});
