import { memo } from "react";
import { AccountPanel } from "./V2SettingsAccountPanel";
import { DataPanel } from "./V2SettingsDataPanels";
import { PrivacyPanel } from "./V2SettingsPrivacyPanel";
import { NotificationsPanel } from "./V2SettingsNotificationsPanel";
import { SoundPanel } from "./V2SettingsSoundPanel";
import { AppearancePanel, LanguagePanel, ProfilePanel } from "./V2SettingsProfilePanels";
import type { AccountAuthController, AccountViewState } from "./useSettingsOverviewModules";
import type { V2SettingsControls, V2SettingsSectionId } from "./types";

interface V2SettingsControlDeckProps {
  controls: V2SettingsControls;
  selectedSectionId: V2SettingsSectionId;
  accountAuth: AccountAuthController;
  accountViewState: AccountViewState;
}

export const V2SettingsControlDeck = memo(function V2SettingsControlDeck({
  controls,
  selectedSectionId,
  accountAuth,
  accountViewState,
}: V2SettingsControlDeckProps) {
  switch (selectedSectionId) {
    case "appearance":
      return (
        <>
          <AppearancePanel />
          <LanguagePanel />
        </>
      );
    case "sound":
      return <SoundPanel />;
    case "notifications":
      return <NotificationsPanel controls={controls} />;
    case "privacy":
      return (
        <>
          <PrivacyPanel controls={controls} />
          <DataPanel controls={controls} accountViewState={accountViewState} />
        </>
      );
    case "account":
      return (
        <>
          <ProfilePanel
            controls={controls}
            interactionBlocked={Boolean(
              accountAuth.signOutBlockReason || accountAuth.isSigningOut
            )}
          />
          <AccountPanel controls={controls} auth={accountAuth} accountViewState={accountViewState} />
        </>
      );
    default:
      return <AccountPanel controls={controls} auth={accountAuth} accountViewState={accountViewState} />;
  }
});
