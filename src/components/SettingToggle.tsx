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
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 flex-shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground line-clamp-1">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
