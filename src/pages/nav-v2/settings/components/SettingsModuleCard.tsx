import type { CSSProperties } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import type { NonOrbVisualRole } from "@/lib/nonOrbVisualRoles";
import { cn } from "@/lib/utils";
import type { V2SettingsSectionId } from "../types";

export interface SettingsModuleCardData {
  id: V2SettingsSectionId;
  icon: LucideIcon;
  label: string;
  description: string;
  role: NonOrbVisualRole;
  value?: string;
}

const settingsModuleTextWrapStyle: CSSProperties = {
  overflowWrap: "break-word",
  wordBreak: "normal",
  hyphens: "manual",
};

export function SettingsModuleCard({
  item,
  expanded,
  controlsWired,
  buttonId,
  panelId,
  panelMounted,
  onOpen,
}: {
  item: SettingsModuleCardData;
  expanded: boolean;
  controlsWired: boolean;
  buttonId: string;
  panelId: string;
  panelMounted: boolean;
  onOpen: (sectionId: V2SettingsSectionId) => void;
}) {
  const Icon = item.icon;
  const labelId = `${buttonId}-label`;
  const valueId = item.value ? `${buttonId}-value` : undefined;
  const descriptionId = `${buttonId}-description`;

  return (
    <article
      className="relative min-w-0 before:pointer-events-none before:absolute before:top-0 before:end-3 before:start-16 before:z-10 before:h-px before:bg-[hsl(var(--settings-v2-border)/0.52)] before:content-[''] first:before:hidden"
      data-active={expanded ? "true" : "false"}
      data-visual-role={item.role}
      data-testid={`settings-module-${item.id}`}
    >
      {expanded ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-2 start-0 z-10 w-1 rounded-e-full bg-[hsl(var(--settings-v2-accent))]"
        />
      ) : null}
      <button
        id={buttonId}
        type="button"
        onClick={() => onOpen(item.id)}
        disabled={!controlsWired}
        className={cn(
          "relative grid min-h-[72px] w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 p-3 text-start",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--settings-v2-accent))]",
          "motion-safe:transition-colors motion-safe:duration-200 disabled:cursor-default disabled:hover:bg-transparent",
          expanded
            ? "bg-[hsl(var(--settings-v2-accent)/0.08)] hover:bg-[hsl(var(--settings-v2-accent)/0.12)]"
            : "hover:bg-[hsl(var(--settings-v2-panel)/0.72)] active:bg-[hsl(var(--settings-v2-panel)/0.86)]"
        )}
        data-interaction-surface="settings-module"
        data-testid={`settings-module-card-${item.id}`}
        {...(controlsWired
          ? {
              "aria-controls": panelMounted ? panelId : undefined,
              "aria-current": expanded ? ("page" as const) : undefined,
            }
          : {})}
        aria-labelledby={labelId}
        aria-describedby={[valueId, descriptionId].filter(Boolean).join(" ")}
      >
        <SettingsCardIcon icon={Icon} selected={expanded} />
        <span
          className="col-start-2 col-end-3 row-start-1 min-w-0"
          style={settingsModuleTextWrapStyle}
        >
          <span id={labelId} className="block text-pretty text-sm font-semibold text-foreground">
            {item.label}
          </span>
          {item.value ? (
            <span
              id={valueId}
              className="mt-1 block text-pretty text-sm font-semibold leading-tight text-foreground"
            >
              {item.value}
            </span>
          ) : null}
        </span>
        <span
          id={descriptionId}
          className="col-start-2 col-end-3 row-start-2 block min-w-0 text-pretty text-xs leading-relaxed text-muted-foreground"
          style={settingsModuleTextWrapStyle}
        >
          {item.description}
        </span>
        <ChevronRight
          className={cn(
            "col-start-3 row-start-1 mt-1 h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 rtl:rotate-180",
            expanded && "text-foreground"
          )}
          aria-hidden="true"
        />
      </button>
    </article>
  );
}

function SettingsCardIcon({ icon: Icon, selected }: { icon: LucideIcon; selected: boolean }) {
  return (
    <span
      className={cn(
        "col-start-1 row-start-1 flex h-10 w-10 shrink-0 items-center justify-center",
        selected
          ? "text-[hsl(var(--settings-v2-accent))]"
          : "text-muted-foreground"
      )}
      data-slot="settings-module-icon"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
