/**
 * FeatureToggleItem Component
 *
 * Reusable toggle item for the Modules section in Settings.
 * Shows feature name, description, icon and toggle switch.
 */

import { memo, ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { Lock } from 'lucide-react';

interface FeatureToggleItemProps {
  icon: ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isCore?: boolean;      // Core features (mood/habits) cannot be disabled
  isLocked?: boolean;    // Feature not yet unlocked via onboarding
  lockedMessage?: string;
}

export const FeatureToggleItem = memo(function FeatureToggleItem({
  icon,
  title,
  description,
  enabled,
  onToggle,
  isCore = false,
  isLocked = false,
  lockedMessage,
}: FeatureToggleItemProps) {
  const isDisabled = isCore || isLocked;

  return (
    <div
      className={`flex min-w-0 flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-start py-3 ${isDisabled ? 'opacity-60' : ''}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0">
          {isLocked ? (
            <Lock className="w-4 h-4 text-muted-foreground" />
          ) : (
            icon
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="whitespace-normal break-words text-sm font-medium leading-snug text-foreground">
            {title}
          </p>
          <p className="mt-0.5 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
            {isLocked && lockedMessage ? lockedMessage : description}
          </p>
        </div>
      </div>
      <Switch
        checked={enabled && !isLocked}
        onCheckedChange={onToggle}
        disabled={isDisabled}
        aria-label={title}
        className="self-end shrink-0 min-[420px]:self-start"
      />
    </div>
  );
});
