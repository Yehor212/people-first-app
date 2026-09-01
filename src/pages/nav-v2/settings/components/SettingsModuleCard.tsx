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
  showSeparator = false,
}: {
  item: SettingsModuleCardData;
  expanded: boolean;
  controlsWired: boolean;
  buttonId: string;
  panelId: string;
  panelMounted: boolean;
  onOpen: (sectionId: V2SettingsSectionId) => void;
  showSeparator?: boolean;
}) {
  const Icon = item.icon;
  const labelId = `${buttonId}-label`;
  const valueId = item.value ? `${buttonId}-value` : undefined;
  const descriptionId = `${buttonId}-description`;

  return (
    <article
      className="relative min-w-0"
      role="listitem"
      data-containment="row"
      data-active={expanded ? "true" : "false"}
      data-visual-role={item.role}
      data-testid={`settings-module-${item.id}`}
    >
      {showSeparator ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute end-3 start-3 top-0 h-px bg-[hsl(var(--settings-v2-border)/0.42)] min-[420px]:start-[4rem]"
          data-slot="settings-module-separator"
        />
      ) : null}
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
          "relative grid min-h-[72px] w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-[6px] p-3 text-start min-[420px]:grid-cols-[auto_minmax(0,1fr)_auto]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-1",
          "motion-safe:transition-[background-color,color] motion-safe:duration-150 motion-safe:ease-out hover:bg-[hsl(var(--settings-v2-panel)/0.72)] active:bg-[hsl(var(--settings-v2-panel)/0.88)] disabled:cursor-default disabled:hover:bg-transparent",
          expanded &&
            "bg-[hsl(var(--settings-v2-accent)/0.1)] forced-colors:outline forced-colors:outline-2 forced-colors:outline-[Highlight]"
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
          className="col-span-2 row-start-2 min-w-0 min-[420px]:col-span-1 min-[420px]:col-start-2 min-[420px]:row-start-1"
          data-slot="settings-module-copy"
          style={settingsModuleTextWrapStyle}
        >
          <span
            id={labelId}
            className="block text-pretty text-sm font-semibold text-foreground"
            data-slot="settings-module-label"
          >
            {item.label}
          </span>
          {item.value ? (
            <span
              id={valueId}
              className="mt-1 block text-pretty text-sm font-semibold leading-tight text-foreground"
              data-slot="settings-module-value"
            >
              {item.value}
            </span>
          ) : null}
        </span>
        <span
          id={descriptionId}
          className="col-span-2 row-start-3 block min-w-0 text-pretty text-xs leading-relaxed text-muted-foreground min-[420px]:col-span-1 min-[420px]:col-start-2 min-[420px]:row-start-2"
          data-slot="settings-module-description"
          style={settingsModuleTextWrapStyle}
        >
          {item.description}
        </span>
        <ChevronRight
          className={cn(
            "col-start-2 row-start-1 mt-1 h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 min-[420px]:col-start-3 rtl:rotate-180",
            expanded && "text-foreground"
          )}
          aria-hidden="true"
          data-slot="settings-module-chevron"
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
