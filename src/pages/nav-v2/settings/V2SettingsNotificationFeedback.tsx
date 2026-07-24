import { AlertCircle, Bell, Volume2 } from "lucide-react";
import { NOTIFICATION_SOUNDS, type NotificationSoundType } from "@/lib/notificationSounds";
import {
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsFieldHeader,
  SettingsInset,
  SettingsStatus,
} from "./components/V2SettingsControlPrimitives";

interface NotificationInlineAlertProps {
  children: string;
  testId?: string;
}

export function NotificationInlineAlert({ children, testId }: NotificationInlineAlertProps) {
  return (
    <SettingsInset tone="danger" testId={testId}>
      <div className="flex min-w-0 items-start gap-3 text-sm text-destructive" role="alert">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:break-word]">
          {children}
        </span>
      </div>
    </SettingsInset>
  );
}

interface NotificationSoundSettingsProps {
  copy: Record<string, string>;
  selectedSound: NotificationSoundType;
  isUpdating: boolean;
  error: string | null;
  onSelect: (sound: NotificationSoundType) => void;
}

export function NotificationSoundSettings({
  copy,
  selectedSound,
  isUpdating,
  error,
  onSelect,
}: NotificationSoundSettingsProps) {
  return (
    <SettingsInset>
      <SettingsFieldHeader icon={Volume2} title={copy.notificationSound || "Notification sound"} />
      <SettingsButtonGrid columns="two">
        {NOTIFICATION_SOUNDS.map((sound) => {
          const label = copy[sound.labelKey] || sound.id;
          return (
            <SettingsChoiceButton
              key={sound.id}
              onClick={() => onSelect(sound.id)}
              selected={selectedSound === sound.id}
              disabled={isUpdating}
              surface="card"
            >
              <span className="block min-w-0 break-words text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
                {label}
              </span>
              <span className="mt-1 block min-w-0 break-words text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
                {copy[`${sound.labelKey}Desc`] || sound.description}
              </span>
            </SettingsChoiceButton>
          );
        })}
      </SettingsButtonGrid>
      {error ? (
        <div
          role="alert"
          aria-label={error}
          className="mt-3 flex min-w-0 items-start gap-2 text-sm text-destructive"
          data-testid="settings-v2-notification-sound-error"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:break-word]">
            {error}
          </span>
        </div>
      ) : null}
    </SettingsInset>
  );
}

export function NotificationSystemGuidance({
  copy,
  description,
}: {
  copy: Record<string, string>;
  description: string;
}) {
  return (
    <SettingsInset testId="settings-v2-notification-system-guidance">
      <SettingsFieldHeader
        icon={Bell}
        title={copy.notificationSystemSettingsTitle || "If reminders are silent"}
      />
      <SettingsStatus>{description}</SettingsStatus>
    </SettingsInset>
  );
}
