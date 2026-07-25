import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeviceSessionsCard,
  formatDeviceLastActivity,
  formatDeviceSessionLabel,
} from "../DeviceSessionsCard";

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
      app_version: "2.0.0",
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
      app_version: "2.0.0",
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
      syncDeviceLastSeen: "Last activity: {value}",
      syncDeviceLastSeenUnknown: "Unknown",
      syncDeviceBrowser: "Browser",
      syncDeviceInstalledApp: "ZenFlow app",
      syncDeviceUnknownSystem: "Unknown system",
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

    expect(await screen.findByText("Chrome · Windows")).toBeInTheDocument();
    expect(screen.getByText("ZenFlow app · iOS")).toBeInTheDocument();

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

  it.each([
    ["en", "Last activity: {value}"],
    ["uk", "Остання активність: {value}"],
    ["es", "Última actividad: {value}"],
    ["de", "Zuletzt aktiv: {value}"],
    ["fr", "Dernière activité : {value}"],
    ["ja", "最終利用: {value}"],
    ["ar", "آخر نشاط: {value}"],
    ["he", "פעילות אחרונה: {value}"],
  ])("formats a complete localized last-activity state for %s", (locale, template) => {
    const now = Date.parse("2026-07-15T12:00:00.000Z");
    const seenAt = "2026-07-15T11:55:00.000Z";
    const relative = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
      style: "long",
    }).format(-5, "minute");

    expect(
      formatDeviceLastActivity(seenAt, locale, template, "Unknown", now),
    ).toBe(template.replace("{value}", relative));
  });

  it("uses the localized unknown state instead of an English fallback", () => {
    expect(
      formatDeviceLastActivity("not-a-date", "ar", "آخر نشاط: {value}", "غير معروف"),
    ).toBe("آخر نشاط: غير معروف");
  });

  it("turns the stored coarse device label into a locale-safe user label", () => {
    expect(
      formatDeviceSessionLabel("PWA on iOS", {
        browser: "المتصفح",
        installedApp: "تطبيق ZenFlow",
        unknownSystem: "نظام غير معروف",
      }),
    ).toBe("تطبيق ZenFlow · iOS");
    expect(
      formatDeviceSessionLabel("Browser on Unknown", {
        browser: "דפדפן",
        installedApp: "אפליקציית ZenFlow",
        unknownSystem: "מערכת לא ידועה",
      }),
    ).toBe("דפדפן · מערכת לא ידועה");
  });
});
