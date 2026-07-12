import type {
  FocusSession,
  GratitudeEntry,
  Habit,
  MoodEntry,
  PrivacySettings,
  ReminderSettings,
} from "@/types";

export type V2SettingsSectionId =
  | "account"
  | "appearance"
  | "sound"
  | "notifications"
  | "privacy"
  | "about";

export interface V2SettingsControls {
  userName: string;
  /** Distinguishes the historical "Friend" seed from a name the user chose. */
  userNameCustom?: boolean;
  onNameChange: (name: string) => void;
  onResetData: () => void | Promise<void>;
  reminders: ReminderSettings;
  onRemindersChange: (
    value: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings)
  ) => void;
  habits: Habit[];
  moods?: MoodEntry[];
  focusSessions?: FocusSession[];
  gratitudeEntries?: GratitudeEntry[];
  privacy: PrivacySettings;
  onPrivacyChange: (value: PrivacySettings | ((prev: PrivacySettings) => PrivacySettings)) => void;
  onOpenWidgetSettings?: () => void;
  initialOpenSection?: string;
}
