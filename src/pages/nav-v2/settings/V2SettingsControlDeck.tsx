import { memo } from "react";
import { AboutPanel } from "./V2SettingsAboutPanel";
import { AccountPanel } from "./V2SettingsAccountPanel";
import { DataPanel } from "./V2SettingsDataPanels";
import { PrivacyPanel } from "./V2SettingsPrivacyPanel";
import { NotificationsPanel } from "./V2SettingsNotificationsPanel";
import { SoundPanel } from "./V2SettingsSoundPanel";
import { AppearancePanel, LanguagePanel, ProfilePanel } from "./V2SettingsProfilePanels";
import type { V2SettingsControls, V2SettingsSectionId } from "./types";

interface V2SettingsControlDeckProps {
  controls: V2SettingsControls;
  selectedSectionId: V2SettingsSectionId;
  accountSessionState: boolean | null;
}

export const V2SettingsControlDeck = memo(function V2SettingsControlDeck({
  controls,
  selectedSectionId,
  accountSessionState,
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
          <DataPanel controls={controls} />
        </>
      );
    case "account":
      return (
        <>
          <ProfilePanel controls={controls} />
          <AccountPanel controls={controls} accountSessionState={accountSessionState} />
        </>
      );
    case "about":
      return <AboutPanel />;
    default:
      return <AccountPanel controls={controls} accountSessionState={accountSessionState} />;
  }
});
