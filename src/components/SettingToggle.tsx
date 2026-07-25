import { type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

interface SettingToggleProps {
  icon: ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function SettingToggle({ icon, label, description, checked, onCheckedChange }: SettingToggleProps) {
  return (
    <div className="flex min-w-0 flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="w-9 h-9 flex-shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="whitespace-normal break-words font-medium leading-snug">{label}</div>
          <div className="mt-0.5 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
            {description}
          </div>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="self-end shrink-0 min-[420px]:self-start"
      />
    </div>
  );
}
