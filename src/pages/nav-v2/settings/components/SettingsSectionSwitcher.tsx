import { getRoleTone } from "@/lib/nonOrbVisualRoles";
import { cn } from "@/lib/utils";
import type { V2SettingsSectionId } from "../types";
import type { SettingsPageCardData } from "./SettingsPageComponents";

interface SettingsSectionSwitcherProps {
  items: SettingsPageCardData[];
  selectedId: V2SettingsSectionId;
  onOpen: (sectionId: V2SettingsSectionId) => void;
  controlsWired: boolean;
  label: string;
}

export function SettingsSectionSwitcher({
  items,
  selectedId,
  onOpen,
  controlsWired,
  label,
}: SettingsSectionSwitcherProps) {
  return (
    <nav
      aria-label={label}
      className="overflow-x-auto rounded-[1.5rem] border border-[hsl(var(--border)/0.58)] bg-[hsl(var(--card)/0.72)] p-2 shadow-[var(--zen-shadow-card)] backdrop-blur-xl [-webkit-overflow-scrolling:touch]"
      data-testid="settings-section-switcher"
    >
      <div className="flex min-w-max gap-2">
        {items.map((item) => {
          const tone = getRoleTone(item.role);
          const Icon = item.icon;
          const selected = selectedId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              aria-pressed={selected}
              aria-controls={controlsWired ? "settings-v2-control-deck" : undefined}
              aria-label={`${item.label}: ${item.description}`}
              className={cn(
                "flex min-h-[48px] shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-settings)/0.52)] focus-visible:ring-offset-2",
                "motion-safe:transition-[background-color,border-color,color,box-shadow] motion-safe:duration-200",
                selected
                  ? "border-[hsl(var(--zf-role-settings)/0.48)] bg-[hsl(var(--card)/0.94)] text-foreground shadow-sm"
                  : "border-[hsl(var(--border)/0.46)] bg-[hsl(var(--background)/0.34)] text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              data-testid={`settings-section-switcher-${item.id}`}
              data-visual-role={item.role}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1",
                  selected
                    ? cn(tone.iconClass, tone.ringClass)
                    : "bg-muted/45 ring-border/40",
                )}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
