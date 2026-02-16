import { Suspense } from 'react';
import { LazyErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { SkeletonSection } from '@/components/ui/skeleton';
import { getModalToggle } from '@/stores';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import type { ReminderSettings, PrivacySettings } from '@/types';

const SettingsPanel = lazyWithRetry(() => import('@/components/SettingsPanel').then(m => ({ default: m.SettingsPanel })), 'SettingsPanel');

const setShowWidgetSettings = getModalToggle('showWidgetSettings');

interface SettingsTabProps {
  userName: string;
  onNameChange: (name: string) => void;
  onResetData: () => void;
  reminders: ReminderSettings;
  onRemindersChange: (updater: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings)) => void;
  safeHabits: Habit[];
  safeMoods: MoodEntry[];
  safeFocusSessions: FocusSession[];
  safeGratitudeEntries: GratitudeEntry[];
  privacy: PrivacySettings;
  onPrivacyChange: (privacy: PrivacySettings) => void;
  initialOpenSection: string | undefined;
}

export function SettingsTab({
  userName, onNameChange, onResetData, reminders, onRemindersChange,
  safeHabits, safeMoods, safeFocusSessions, safeGratitudeEntries,
  privacy, onPrivacyChange, initialOpenSection,
}: SettingsTabProps) {
  return (
    <div className="animate-tab-enter">
      <Header userName={userName} />
      <LazyErrorBoundary componentName="Settings">
        <Suspense fallback={<SkeletonSection />}>
          <SettingsPanel
            userName={userName}
            onNameChange={onNameChange}
            onResetData={onResetData}
            reminders={reminders}
            onRemindersChange={onRemindersChange}
            habits={safeHabits}
            moods={safeMoods}
            focusSessions={safeFocusSessions}
            gratitudeEntries={safeGratitudeEntries}
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
