import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const consentMocks = vi.hoisted(() => ({
  flush: vi.fn(),
  hasPending: vi.fn(),
  isGranted: vi.fn(),
  revoke: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock("../journalAiConsent", () => ({
  flushJournalAiConsentRevocation: consentMocks.flush,
  hasPendingJournalAiConsentRevocation: consentMocks.hasPending,
  isJournalAiConsentGranted: consentMocks.isGranted,
  revokeJournalAiConsent: consentMocks.revoke,
  subscribeJournalAiConsent: consentMocks.subscribe,
}));

import { JournalSettingsContent } from "../JournalSettingsContent";
import type { useJournalSecurity } from "../useJournalSecurity";

type JournalSecurityState = ReturnType<typeof useJournalSecurity>;

const security = {
  biometricAvailable: false,
  biometricEnabled: false,
  cloudProtectionPending: false,
  cloudProtectionPendingKind: null,
  changePassword: vi.fn(),
  cooldownRemaining: 0,
  failedAttempts: 0,
  hasPassword: false,
  isLocked: false,
  isUnlocked: true,
  loading: false,
  loadError: false,
  lock: vi.fn(),
  removePassword: vi.fn(),
  retryLoad: vi.fn(),
  setBiometricEnabled: vi.fn(),
  setPassword: vi.fn(),
  touch: vi.fn(),
  unlock: vi.fn(),
  unlockWithBiometric: vi.fn(),
  vaultKey: null,
} as unknown as JournalSecurityState;

const ts = {
  journalAiConsentUnavailable: "Private search could not be enabled.",
  journalAiRevoke: "Turn off private search and remove its permission",
  journalAiRevokePending: "Private search is off. Removing its permission will retry when you are online.",
  journalAiRevoking: "Turning off private search...",
  journalAiSearchOff: "Private search is off. Standard text search stays on this device.",
  journalAiSearchPrivacy: "Private search privacy",
  journalAiPrivacyConfirm: "Private search stays inside the ZenFlow account boundary.",
  journalSettings: "Diary settings",
};

function renderSettings() {
  return render(
    <JournalSettingsContent
      ts={ts}
      security={security}
      section="overview"
      onSectionChange={vi.fn()}
      privateMode={false}
      onPrivateModeChange={vi.fn()}
      onOpenExport={vi.fn()}
      onRequestRemovePassword={vi.fn()}
    />,
  );
}

describe("JournalSettingsContent private-search consent controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consentMocks.isGranted.mockReturnValue(true);
    consentMocks.hasPending.mockResolvedValue(false);
    consentMocks.flush.mockResolvedValue({ status: "none" });
    consentMocks.revoke.mockResolvedValue({ status: "completed" });
  });

  it("lets the user withdraw consent and confirms that private search is off", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Turn off private search and remove its permission" }));

    await waitFor(() => expect(consentMocks.revoke).toHaveBeenCalledOnce());
    expect(screen.getByText("Private search is off. Standard text search stays on this device.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn off private search and remove its permission" })).not.toBeInTheDocument();
  });

  it("keeps an honest retry state when remote deletion is waiting for a connection", async () => {
    consentMocks.revoke.mockResolvedValue({ status: "pending" });
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Turn off private search and remove its permission" }));

    expect(await screen.findByText("Private search is off. Removing its permission will retry when you are online.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn off private search and remove its permission" })).toBeEnabled();
  });
});
