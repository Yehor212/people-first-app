import type { RefObject } from 'react';
import { MindMapCanvas } from '@/components/canvas/MindMapCanvas';
import { InstallBanner } from '@/components/InstallBanner';
import { SessionExpiredBanner } from '@/components/SessionExpiredBanner';
import { useAppStore, useUserDataStore } from '@/stores';
import type { MindMapCanvasRef } from '@/components/canvas/MindMapCanvas';
import type { MoodEntry, Habit } from '@/types';

interface HomeTabProps {
  safeHabits: Habit[];
  safeMoods: MoodEntry[];
  handleToggleHabit: (habitId: string, date: string) => void;
  canvasRef: RefObject<MindMapCanvasRef | null>;
}

export function HomeTab({
  safeHabits, safeMoods, handleToggleHabit, canvasRef,
}: HomeTabProps) {
  const userName = useUserDataStore(s => s.userName);
  const hasValidSession = useAppStore(s => s.hasValidSession);
  const googleAuthChecked = useUserDataStore(s => s.googleAuthChecked);
  const setActiveTab = useAppStore(s => s.setActiveTab);

  const latestMood = safeMoods.length > 0 ? safeMoods[safeMoods.length - 1].mood : null;

  return (
    <>
      <MindMapCanvas
        ref={canvasRef}
        habits={safeHabits}
        latestMood={latestMood}
        onHabitToggle={handleToggleHabit}
      />

      {/* Floating banners above canvas */}
      <div
        className="fixed inset-x-4 z-50 flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}
      >
        <InstallBanner />
        {hasValidSession === false && googleAuthChecked && userName !== 'Friend' && (
          <SessionExpiredBanner
            onSignIn={() => {
              useAppStore.getState().setSettingsOpenSection('account');
              setActiveTab('settings');
            }}
          />
        )}
      </div>
    </>
  );
}
