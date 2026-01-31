/**
 * HealthConnectCard - Settings UI for Health Connect integration
 *
 * Shows:
 * - Connection status with Health Connect
 * - Permission controls
 * - Sync options for Focus Sessions
 * - Sleep and steps data preview
 *
 * Android only - hidden on other platforms.
 */

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useHealthConnect } from '@/hooks/useHealthConnect';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import {
  Heart,
  Activity,
  Moon,
  Footprints,
  Check,
  X,
  ExternalLink,
  Loader,
  AlertCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const AGE_VERIFIED_KEY = 'zenflow_health_age_verified';

interface HealthConnectCardProps {
  className?: string;
  onSyncSettingChange?: (enabled: boolean) => void;
  syncEnabled?: boolean;
}

export function HealthConnectCard({
  className,
  onSyncSettingChange,
  syncEnabled = false,
}: HealthConnectCardProps) {
  const { t } = useLanguage();
  const {
    state,
    isAndroid,
    requestPermissions,
    openHealthConnect,
    refreshState,
    getSleepData,
    getStepsData,
  } = useHealthConnect();

  const [localSyncEnabled, setLocalSyncEnabled] = useState(syncEnabled);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showAgeDialog, setShowAgeDialog] = useState(false);
  const [ageVerified, setAgeVerified] = useState(() => {
    try {
      return localStorage.getItem(AGE_VERIFIED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Don't render on non-Android platforms
  if (!isAndroid) {
    return null;
  }

  // Load health data preview when permissions granted
  useEffect(() => {
    const loadHealthData = async () => {
      if (!state.isAvailable || !state.permissions) return;

      setIsLoadingData(true);

      try {
        // Load sleep data if permitted
        if (state.permissions.sleep) {
          const sleepData = await getSleepData(1); // Last 24 hours
          if (sleepData.length > 0) {
            const totalSleepMinutes = sleepData.reduce((sum, s) => sum + s.durationMinutes, 0);
            setSleepMinutes(totalSleepMinutes);
          }
        }

        // Load steps data if permitted
        if (state.permissions.steps) {
          const stepsData = await getStepsData(1); // Last 24 hours
          setTodaySteps(stepsData.total);
        }
      } catch (error) {
        logger.error('[HealthConnect] Error loading data:', error);
      }

      setIsLoadingData(false);
    };

    loadHealthData();
  }, [state.isAvailable, state.permissions, getSleepData, getStepsData]);

  const handleSyncToggle = () => {
    const newValue = !localSyncEnabled;
    setLocalSyncEnabled(newValue);
    onSyncSettingChange?.(newValue);

    // Save preference
    localStorage.setItem('zenflow_health_connect_sync', String(newValue));
  };

  const handleRequestPermissions = async () => {
    // Check age verification first
    if (!ageVerified) {
      setShowAgeDialog(true);
      return;
    }
    await requestPermissions();
  };

  const handleAgeConfirm = async () => {
    try {
      localStorage.setItem(AGE_VERIFIED_KEY, 'true');
    } catch {
      // localStorage might not be available
    }
    setAgeVerified(true);
    setShowAgeDialog(false);
    // Now request permissions
    await requestPermissions();
  };

  const formatSleepTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Loading state
  if (state.isLoading) {
    return (
      <div className={cn('p-4 rounded-xl bg-muted/50 border border-border', className)}>
        <div className="flex items-center gap-3">
          <Loader className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {t.healthConnectLoading || 'Checking Health Connect...'}
          </span>
        </div>
      </div>
    );
  }

  // Not available state
  if (!state.isAvailable) {
    return (
      <div className={cn('p-4 rounded-xl bg-muted/50 border border-border', className)}>
        <div className="flex items-center gap-3">
          <Heart className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground">
              {t.healthConnect || 'Health Connect'}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {state.unavailableReason === 'update_required'
                ? (t.healthConnectUpdateRequired || 'Please update Health Connect app')
                : (t.healthConnectNotAvailable || 'Not available on this device')}
            </p>
          </div>
          {state.unavailableReason === 'update_required' && (
            <button
              onClick={openHealthConnect}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-primary" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Available - show full card
  return (
    <div className={cn('p-4 rounded-xl bg-card border border-border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
            <Heart className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {t.healthConnect || 'Health Connect'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.healthConnectDescription || 'Sync with Google Health Connect'}
            </p>
          </div>
        </div>
        <button
          onClick={refreshState}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label={t.refresh || 'Refresh'}
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Permissions Status */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t.permissions || 'Permissions'}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Mindfulness Permission */}
          <div className={cn(
            'p-2 rounded-lg flex flex-col items-center gap-1',
            state.permissions?.mindfulness ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted/50'
          )}>
            <Activity className={cn(
              'w-4 h-4',
              state.permissions?.mindfulness ? 'text-green-500' : 'text-muted-foreground'
            )} />
            <span className="text-xs text-center">
              {t.mindfulness || 'Mindfulness'}
            </span>
            {state.permissions?.mindfulness ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <X className="w-3 h-3 text-muted-foreground" />
            )}
          </div>

          {/* Sleep Permission */}
          <div className={cn(
            'p-2 rounded-lg flex flex-col items-center gap-1',
            state.permissions?.sleep ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-muted/50'
          )}>
            <Moon className={cn(
              'w-4 h-4',
              state.permissions?.sleep ? 'text-purple-500' : 'text-muted-foreground'
            )} />
            <span className="text-xs text-center">
              {t.sleep || 'Sleep'}
            </span>
            {state.permissions?.sleep ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <X className="w-3 h-3 text-muted-foreground" />
            )}
          </div>

          {/* Steps Permission */}
          <div className={cn(
            'p-2 rounded-lg flex flex-col items-center gap-1',
            state.permissions?.steps ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-muted/50'
          )}>
            <Footprints className={cn(
              'w-4 h-4',
              state.permissions?.steps ? 'text-blue-500' : 'text-muted-foreground'
            )} />
            <span className="text-xs text-center">
              {t.steps || 'Steps'}
            </span>
            {state.permissions?.steps ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <X className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Request Permissions Button */}
        {!state.permissions?.allGranted && (
          <button
            onClick={handleRequestPermissions}
            className="w-full mt-2 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            {t.grantPermissions || 'Grant Permissions'}
          </button>
        )}
      </div>

      {/* Health Data Preview */}
      {(state.permissions?.sleep || state.permissions?.steps) && (
        <div className="space-y-2 mb-4 pt-4 border-t border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t.todayHealth || "Today's Health"}
          </div>

          {isLoadingData ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader className="w-4 h-4 animate-spin" />
              {t.loading || 'Loading...'}
            </div>
          ) : (
            <div className="flex gap-4">
              {/* Sleep Data */}
              {state.permissions?.sleep && sleepMinutes !== null && (
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">
                    {formatSleepTime(sleepMinutes)}
                  </span>
                </div>
              )}

              {/* Steps Data */}
              {state.permissions?.steps && todaySteps !== null && (
                <div className="flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">
                    {todaySteps.toLocaleString()} {t.stepsLabel || 'steps'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sync Focus Sessions Toggle */}
      {state.permissions?.mindfulness && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <span className="text-sm font-medium text-foreground">
                {t.syncFocusSessions || 'Sync Focus Sessions'}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.syncFocusSessionsHint || 'Save focus sessions as mindfulness in Health Connect'}
              </p>
            </div>
            <button
              onClick={handleSyncToggle}
              role="switch"
              aria-checked={localSyncEnabled}
              aria-label={t.syncFocusSessions || 'Sync focus sessions'}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                localSyncEnabled ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  localSyncEnabled && 'translate-x-5'
                )}
              />
            </button>
          </div>
        </div>
      )}

      {/* Open Health Connect Button */}
      <button
        onClick={openHealthConnect}
        className="w-full mt-4 py-2 px-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <ExternalLink className="w-4 h-4" />
        {t.openHealthConnect || 'Open Health Connect'}
      </button>

      {/* Age Verification Dialog */}
      <AlertDialog open={showAgeDialog} onOpenChange={setShowAgeDialog}>
        <AlertDialogContent className="max-w-sm mx-4 z-[70]">
          <AlertDialogHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <AlertDialogTitle className="text-center">
              {t.onboardingAgeTitle || 'Age Verification'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {t.healthConnectAgeDesc || 'Health Connect features require you to be 13 years or older to use health data responsibly.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleAgeConfirm}
              className="w-full bg-gradient-to-r from-primary to-accent"
            >
              {t.onboardingAgeConfirm || 'I am 13 years or older'}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">
              {t.cancel || 'Cancel'}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default HealthConnectCard;
