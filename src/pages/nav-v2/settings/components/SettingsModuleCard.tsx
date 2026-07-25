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
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[8px] border bg-[hsl(var(--settings-v2-card)/0.76)] shadow-[var(--zen-shadow-card)]",
        "motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200",
        expanded
          ? "border-[hsl(var(--settings-v2-accent)/0.46)] bg-[hsl(var(--settings-v2-accent)/0.1)] shadow-[0_14px_36px_-30px_hsl(var(--settings-v2-shadow)/0.42)]"
          : "border-[hsl(var(--settings-v2-border)/0.52)]"
      )}
      data-active={expanded ? "true" : "false"}
      data-visual-role={item.role}
      data-testid={`settings-module-${item.id}`}
    >
      {expanded ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-[hsl(var(--settings-v2-accent))]"
        />
      ) : null}
      <button
        id={buttonId}
        type="button"
        onClick={() => onOpen(item.id)}
        disabled={!controlsWired}
        className={cn(
          "relative grid min-h-[72px] w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-[8px] p-3 text-start min-[420px]:grid-cols-[auto_minmax(0,1fr)_auto]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2",
          "shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.42)] motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none hover:bg-[hsl(var(--settings-v2-panel)/0.72)] disabled:cursor-default disabled:hover:bg-transparent"
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
          className="col-span-2 row-start-3 block min-w-0 text-pretty text-xs leading-relaxed text-muted-foreground min-[420px]:col-span-1 min-[420px]:col-start-2 min-[420px]:row-start-2"
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
        />
      </button>
    </article>
  );
}

function SettingsCardIcon({ icon: Icon, selected }: { icon: LucideIcon; selected: boolean }) {
  return (
    <span
      className={cn(
        "col-start-1 row-start-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border",
        selected
          ? "border-[hsl(var(--settings-v2-accent)/0.46)] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]"
          : "border-[hsl(var(--settings-v2-border)/0.54)] bg-[hsl(var(--settings-v2-shell)/0.62)] text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
