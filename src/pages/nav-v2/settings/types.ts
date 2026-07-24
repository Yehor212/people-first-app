import type {
  FocusSession,
  GratitudeEntry,
  Habit,
  MoodEntry,
  PrivacySettings,
  ReminderSettings,
} from "@/types";
import type { OriginAccountBoundaryGeneration } from "@/storage/accountBoundaryRuntime";

export type V2SettingsSectionId = "account" | "appearance" | "sound" | "notifications" | "privacy";

export interface V2SettingsControls {
  userName: string;
  /** Distinguishes the historical "Friend" seed from a name the user chose. */
  userNameCustom?: boolean;
  onNameChange: (
    name: string,
    userChosen?: boolean,
    expectedOwnerGeneration?: OriginAccountBoundaryGeneration
  ) => void | Promise<void>;
  onResetData: () => void | Promise<void>;
  reminders: ReminderSettings;
  onRemindersChange: (
    value: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings)
  ) => void | Promise<void>;
  habits: Habit[];
  moods?: MoodEntry[];
  focusSessions?: FocusSession[];
  gratitudeEntries?: GratitudeEntry[];
  privacy: PrivacySettings;
  onPrivacyChange: (
    value: PrivacySettings | ((prev: PrivacySettings) => PrivacySettings)
  ) => void | Promise<void>;
  onOpenWidgetSettings?: () => void;
  initialOpenSection?: string;
}
