import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { OverlayLayer } from "@/components/OverlayLayer";
import { useUIStore } from "@/stores/uiStore";
import { useUserDataStore } from "@/stores/userDataStore";

vi.mock("@/components/ConfettiBurst", () => ({
  ConfettiBurst: () => null,
}));

vi.mock("@/components/ConsentBanner", () => ({
  ConsentBanner: () => <div data-testid="consent-banner">Consent</div>,
}));

vi.mock("@/components/UpdatePrompt", () => ({
  UpdatePrompt: () => null,
}));

vi.mock("@/lib/appUpdateManager", () => ({
  dismissUpdate: vi.fn(),
}));

vi.mock("@/components/OnboardingOverlay", () => ({
  OnboardingOverlay: () => <div data-testid="welcome-overlay">Welcome</div>,
}));

vi.mock("@/components/FeatureUnlock", () => ({
  FeatureUnlock: () => null,
}));

vi.mock("@/components/WelcomeBackModal", () => ({
  WelcomeBackModal: () => null,
}));

vi.mock("@/components/StorageErrorBanner", () => ({
  StorageErrorBanner: () => null,
}));

const defaultAwardXp = vi.fn();
const defaultEarnTreats = vi.fn(() => ({
  earned: 0,
  bonus: 0,
  multiplier: 1,
  newBalance: 0,
}));

function resetStores() {
  useUIStore.setState({
    confettiBurst: null,
    showWelcomeOverlay: false,
    featureToUnlock: null,
    showWelcomeBack: false,
    welcomeBackData: null,
    updateState: null,
  });

  useUserDataStore.setState({
    privacy: { noTracking: false, analytics: false, consentShown: false },
    onboardingComplete: false,
  });
}

describe("OverlayLayer", () => {
  afterEach(() => {
    resetStores();
  });

  it("does not render the consent banner under the welcome overlay", () => {
    resetStores();
    useUIStore.setState({ showWelcomeOverlay: true });
    useUserDataStore.setState({
      privacy: { noTracking: false, analytics: false, consentShown: false },
      onboardingComplete: true,
    });

    render(
      <OverlayLayer awardXp={defaultAwardXp} earnTreats={defaultEarnTreats} />,
    );

    expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
  });
});
