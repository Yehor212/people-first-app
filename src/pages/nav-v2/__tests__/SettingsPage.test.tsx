import type React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Settings: "Settings",
      navV2Theme: "Theme",
      navV2SettingsPlaceholder: "Prepare your controls.",
      themeLight: "Light",
      themeDark: "Dark",
      theme: "Theme",
      appearance: "Appearance",
      notifications: "Notifications",
      remindersDescription: "Reminder controls.",
      language: "Language",
      selectLanguage: "Choose language.",
      privacy: "Privacy",
      settingsGroupSecurity: "Security",
      settingsSecurityDesc: "Protect your space.",
      settingsSectionData: "Data",
      settingsExportDescription: "Backup and export.",
      settingsGroupAbout: "About",
    },
  }),
}));

vi.mock("@/lib/motion", () => ({
  Bloom: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/motion/choreography", () => ({
  staggerDelay: () => ({}),
}));

vi.mock("@/components/navigation-v2/ThemeToggleV2", () => ({
  ThemeToggleV2: ({ testId }: { testId?: string }) => (
    <button type="button" data-testid={testId}>
      Theme toggle
    </button>
  ),
}));

vi.mock("@/components/sync/SyncHealthCard", () => ({
  SyncHealthCard: () => <section data-testid="sync-health-card">Sync health</section>,
}));

vi.mock("@/components/sync/DeviceSessionsCard", () => ({
  DeviceSessionsCard: () => <section data-testid="device-sessions-card">Device sessions</section>,
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (s: { appliedTheme: string }) => unknown) =>
    selector({ appliedTheme: "paper" }),
}));

describe("SettingsPage", () => {
  it("renders a paper-native V2 settings control surface", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("settings-page")).toHaveAttribute(
      "data-visual-role",
      "settings",
    );
    expect(screen.getByTestId("settings-page-control-card")).toBeInTheDocument();
    expect(screen.getByTestId("settings-v2-theme-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("sync-health-card")).toBeInTheDocument();
    expect(screen.getByTestId("device-sessions-card")).toBeInTheDocument();
    expect(screen.getByText("Appearance").closest("[data-visual-role]")).toHaveAttribute(
      "data-visual-role",
      "mind",
    );
    expect(screen.getByText("Notifications").closest("[data-visual-role]")).toHaveAttribute(
      "data-visual-role",
      "focus",
    );
    expect(screen.getByText("Security").closest("[data-visual-role]")).toHaveAttribute(
      "data-visual-role",
      "rest",
    );
  });
});
