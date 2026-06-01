import { type LucideIcon } from "lucide-react";
import { getRoleTone, type NonOrbVisualRole } from "@/lib/nonOrbVisualRoles";
import { cn } from "@/lib/utils";
import type { V2SettingsSectionId } from "../types";

export interface SettingsSectionSwitcherItem {
  id: V2SettingsSectionId;
  icon: LucideIcon;
  label: string;
  description: string;
  role: NonOrbVisualRole;
  value?: string;
}

interface SettingsSectionSwitcherProps {
  items: SettingsSectionSwitcherItem[];
  selectedId: V2SettingsSectionId;
  controlsWired: boolean;
  onOpen: (sectionId: V2SettingsSectionId) => void;
  label: string;
}

export function SettingsSectionSwitcher({
  items,
  selectedId,
  controlsWired,
  onOpen,
  label,
}: SettingsSectionSwitcherProps) {
  return (
    <section
      aria-label={label}
      className="rounded-3xl border border-[hsl(var(--border)/0.52)] bg-[hsl(var(--card)/0.72)] p-2 shadow-[var(--zen-shadow-card)]"
      data-testid="settings-section-switcher"
    >
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={label}>
        {items.map((item) => {
          const selected = item.id === selectedId;
          const tone = getRoleTone(item.role);
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "relative flex min-h-[56px] min-w-[132px] flex-1 items-center gap-2 rounded-2xl border px-3 py-2 text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-settings)/0.52)] focus-visible:ring-offset-2",
                "motion-safe:transition-[background-color,border-color,box-shadow,transform] motion-safe:duration-200",
                selected
                  ? "border-[hsl(var(--zf-role-settings)/0.54)] bg-[hsl(var(--background)/0.54)] shadow-[0_12px_34px_-26px_hsl(var(--zf-role-settings)/0.9)]"
                  : cn(tone.borderClass, "bg-[hsl(var(--background)/0.26)] hover:bg-[hsl(var(--card)/0.82)]")
              )}
              aria-pressed={selected}
              aria-controls="settings-v2-control-deck"
              aria-disabled={!controlsWired}
              data-testid={`settings-section-switcher-${item.id}`}
              data-selected={selected ? "true" : "false"}
              onClick={() => {
                if (controlsWired) onOpen(item.id);
              }}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                  selected ? tone.iconClass : "border-[hsl(var(--border)/0.5)] bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {item.label}
                </span>
                {item.value ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.value}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
