import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsPanel } from "../SettingsPanel";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      settings: "Settings",
      widgetSettings: "Widget Settings",
      widgetSettingsDesc: "Configure widgets",
      dopamineSettings: "Dopamine Settings",
      dopamineSettingsDesc: "Customize feedback",
      dopamineCustomize: "Customize",
      appInstalled: "App installed",
      appInstalledDescription: "Installed",
      installApp: "Install app",
      installAppDescription: "Install",
      installNow: "Install now",
    },
  }),
}));

vi.mock("@/hooks/usePwaInstall", () => ({
  usePwaInstall: () => ({
    canInstall: false,
    isInstalled: false,
    promptInstall: vi.fn(),
  }),
}));

vi.mock("@/components/DopamineSettings", () => ({
  DopamineSettingsComponent: () => <div data-testid="dopamine-settings" />,
}));

vi.mock("@/components/FontScaleSettings", () => ({
  FontScaleSettings: () => <div data-testid="font-scale-settings" />,
}));

vi.mock("@/components/sync/DeviceSessionsCard", () => ({
  DeviceSessionsCard: () => <div data-testid="device-sessions-card" />,
}));

vi.mock("@/components/sync/SyncHealthCard", () => ({
  SyncHealthCard: () => <div data-testid="sync-health-card" />,
}));

vi.mock("@/components/settings", () => ({
  AboutSection: () => <div data-testid="section-about" />,
  AccountSection: () => <div data-testid="section-account" />,
  DataSection: () => <div data-testid="section-data" />,
  ModulesSection: () => <div data-testid="section-modules" />,
  NotificationsSection: () => <div data-testid="section-notifications" />,
  ProfileSection: () => <div data-testid="section-profile" />,
  SecuritySection: () => <div data-testid="section-security" />,
  WhatsNewBanner: () => <div data-testid="whats-new-banner" />,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({
    value,
    children,
  }: {
    value?: string[];
    children: React.ReactNode;
  }) => (
    <div data-testid="settings-accordion" data-open-sections={(value ?? []).join(",")}>
      {children}
    </div>
  ),
}));

const baseProps = {
  userName: "Avery",
  onNameChange: vi.fn(),
  onResetData: vi.fn(),
  reminders: {
    enabled: false,
    moodTimeMorning: "09:00",
    moodTimeAfternoon: "14:00",
    moodTimeEvening: "21:00",
    habitTime: "08:00",
    focusTime: "10:00",
    days: [1, 2, 3, 4, 5],
    quietHours: {
      start: "22:00",
      end: "07:00",
    },
    habitIds: [],
    smartEnabled: false,
    browserNotifications: false,
  },
  onRemindersChange: vi.fn(),
  habits: [],
  moods: [],
  focusSessions: [],
  gratitudeEntries: [],
  privacy: {
    analytics: false,
    noTracking: true,
    localOnly: false,
    crashReports: false,
  },
  onPrivacyChange: vi.fn(),
  showHeading: false,
  showSyncCards: false,
};

describe("SettingsPanel section routing", () => {
  it("replaces the open section when a new routed section is requested", () => {
    const { rerender } = render(<SettingsPanel {...baseProps} initialOpenSection="profile" />);

    expect(screen.getByTestId("settings-accordion")).toHaveAttribute(
      "data-open-sections",
      "profile",
    );

    rerender(<SettingsPanel {...baseProps} initialOpenSection="account" />);

    expect(screen.getByTestId("settings-accordion")).toHaveAttribute(
      "data-open-sections",
      "account",
    );
  });
});
