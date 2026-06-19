import type {
  FocusSession,
  GratitudeEntry,
  Habit,
  MoodEntry,
  PrivacySettings,
  ReminderSettings,
} from "@/types";

export type V2SettingsSectionId =
  | "profile"
  | "appearance"
  | "sound"
  | "language"
  | "notifications"
  | "privacy"
  | "data"
  | "account"
  | "about";

export interface V2SettingsControls {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void | Promise<void>;
  reminders: ReminderSettings;
  onRemindersChange: (
    value: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings),
  ) => void;
  habits: Habit[];
  moods?: MoodEntry[];
  focusSessions?: FocusSession[];
  gratitudeEntries?: GratitudeEntry[];
  privacy: PrivacySettings;
  onPrivacyChange: (
    value: PrivacySettings | ((prev: PrivacySettings) => PrivacySettings),
  ) => void;
  onOpenWidgetSettings?: () => void;
  initialOpenSection?: string;
}
