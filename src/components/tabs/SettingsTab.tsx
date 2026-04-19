import { Suspense } from "react";
import { LazyErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/Header";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { SkeletonSection } from "@/components/ui/skeleton";
import { getModalToggle, useUserDataStore } from "@/stores";
import type { ReminderSettings, PrivacySettings } from "@/types";

const SettingsPanel = lazyWithRetry(
  () => import("@/components/SettingsPanel").then((m) => ({ default: m.SettingsPanel })),
  "SettingsPanel"
);

const setShowWidgetSettings = getModalToggle("showWidgetSettings");

interface SettingsTabProps {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void;
  reminders: ReminderSettings;
  onRemindersChange: (
    updater: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings)
  ) => void;
  privacy: PrivacySettings;
  onPrivacyChange: (value: PrivacySettings | ((prev: PrivacySettings) => PrivacySettings)) => void;
  initialOpenSection: string | undefined;
}

export function SettingsTab({
  userName,
  onNameChange,
  onResetData,
  reminders,
  onRemindersChange,
  privacy,
  onPrivacyChange,
  initialOpenSection,
}: SettingsTabProps) {
  const moods = useUserDataStore((s) => s.moods);
  const habits = useUserDataStore((s) => s.habits);
  const focusSessions = useUserDataStore((s) => s.focusSessions);
  const gratitudeEntries = useUserDataStore((s) => s.gratitudeEntries);

  return (
    <div className="motion-safe:animate-tab-enter">
      <Header userName={userName} />
      <LazyErrorBoundary componentName="Settings">
        <Suspense fallback={<SkeletonSection />}>
          <SettingsPanel
            userName={userName}
            onNameChange={onNameChange}
            onResetData={onResetData}
            reminders={reminders}
            onRemindersChange={onRemindersChange}
            habits={habits}
            moods={moods}
            focusSessions={focusSessions}
            gratitudeEntries={gratitudeEntries}
            privacy={privacy}
            onPrivacyChange={onPrivacyChange}
            onOpenWidgetSettings={() => setShowWidgetSettings(true)}
            initialOpenSection={initialOpenSection}
          />
        </Suspense>
      </LazyErrorBoundary>
    </div>
  );
}
