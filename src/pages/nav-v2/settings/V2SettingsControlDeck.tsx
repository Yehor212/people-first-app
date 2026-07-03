import { memo } from "react";
import { AboutPanel } from "./V2SettingsAboutPanel";
import { AccountPanel } from "./V2SettingsAccountPanel";
import { DataPanel, PrivacyPanel } from "./V2SettingsDataPanels";
import { NotificationsPanel } from "./V2SettingsNotificationsPanel";
import { SoundPanel } from "./V2SettingsSoundPanel";
import { AppearancePanel, LanguagePanel, ProfilePanel } from "./V2SettingsProfilePanels";
import type { V2SettingsControls, V2SettingsSectionId } from "./types";

interface V2SettingsControlDeckProps {
  controls: V2SettingsControls;
  selectedSectionId: V2SettingsSectionId;
}

export const V2SettingsControlDeck = memo(function V2SettingsControlDeck({
  controls,
  selectedSectionId,
}: V2SettingsControlDeckProps) {
  switch (selectedSectionId) {
    case "appearance":
      return <AppearancePanel />;
    case "sound":
      return <SoundPanel />;
    case "language":
      return <LanguagePanel />;
    case "notifications":
      return <NotificationsPanel controls={controls} />;
    case "privacy":
      return <PrivacyPanel controls={controls} />;
    case "data":
      return <DataPanel controls={controls} />;
    case "account":
      return <AccountPanel controls={controls} />;
    case "about":
      return <AboutPanel />;
    case "profile":
    default:
      return <ProfilePanel controls={controls} />;
  }
});
