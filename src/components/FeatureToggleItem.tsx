/**
 * FeatureToggleItem Component
 *
 * Reusable toggle item for the Modules section in Settings.
 * Shows feature name, description, icon and toggle switch.
 */

import { ReactNode } from 'react';
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

export function FeatureToggleItem({
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
    <div className={`flex items-center justify-between py-3 ${isDisabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0">
          {isLocked ? (
            <Lock className="w-4 h-4 text-muted-foreground" />
          ) : (
            icon
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {isLocked && lockedMessage ? lockedMessage : description}
          </p>
        </div>
      </div>
      <Switch
        checked={enabled && !isLocked}
        onCheckedChange={onToggle}
        disabled={isDisabled}
        className="shrink-0 ml-3"
      />
    </div>
  );
}
