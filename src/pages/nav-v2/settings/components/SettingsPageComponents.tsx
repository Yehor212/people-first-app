import { forwardRef, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { ThemeToggleV2 } from "@/components/navigation-v2/ThemeToggleV2";
import { getRoleTone, type NonOrbVisualRole } from "@/lib/nonOrbVisualRoles";
import { V2_NAV_ICONS } from "@/lib/v2IconSystem";
import { cn } from "@/lib/utils";
import type { V2SettingsSectionId } from "../types";

export interface SettingsPageCardData {
  id: V2SettingsSectionId;
  icon: LucideIcon;
  label: string;
  description: string;
  role: NonOrbVisualRole;
}

export interface SettingsModuleCardData extends SettingsPageCardData {
  value?: string;
}

interface SettingsPageShellProps {
  children: ReactNode;
  controlsWired: boolean;
  labelledBy: string;
}

interface SettingsHeroCardProps {
  title: string;
  lead: string;
  themeTitle: string;
  themeLabel: string;
}

interface SettingsModuleListProps {
  items: SettingsModuleCardData[];
  expandedId: V2SettingsSectionId | null;
  onOpen: (sectionId: V2SettingsSectionId) => void;
  controlsWired: boolean;
  label: string;
  renderPanel: (item: SettingsModuleCardData) => ReactNode;
}

export const SettingsPageShell = forwardRef<HTMLElement, SettingsPageShellProps>(
  function SettingsPageShell({ children, controlsWired, labelledBy }, ref) {
    return (
      <main
        ref={ref}
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="mx-auto flex min-h-[100svh] max-w-3xl flex-col gap-4 px-4 py-6 outline-none md:px-6 md:py-10"
        aria-labelledby={labelledBy}
        data-testid="settings-page"
        data-visual-role="settings"
        data-controls-wired={controlsWired ? "true" : "false"}
      >
        {children}
      </main>
    );
  }
);

export function SettingsHeroCard({ title, lead, themeTitle, themeLabel }: SettingsHeroCardProps) {
  const SettingsIcon = V2_NAV_ICONS.settings;
  const settingsTone = getRoleTone("settings");

  return (
    <section
      className="relative overflow-hidden rounded-[1.75rem] border border-[hsl(var(--zf-role-settings)/0.24)] bg-[linear-gradient(145deg,hsl(var(--card)/0.92),hsl(var(--surface-elevated)/0.88)_52%,hsl(var(--zf-role-space)/0.08))] p-4 shadow-[var(--zen-shadow-soft)] backdrop-blur-xl md:p-5"
      data-testid="settings-page-control-card"
    >
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
            settingsTone.iconClass
          )}
        >
          <SettingsIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--zf-role-settings)/0.76)]">
            ZENFLOW
          </p>
          <h1
            id="settings-page-heading"
            className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground"
          >
            {title}
          </h1>
          <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-foreground/80 drop-shadow-[0_1px_6px_hsl(var(--background)/0.64)]">
            {lead}
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border-t border-[hsl(var(--border)/0.42)] bg-[hsl(var(--background)/0.24)] px-3 py-2 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--zf-role-mind)/0.12)] text-[hsl(var(--zf-role-mind))]">
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground drop-shadow-[0_1px_8px_hsl(var(--background)/0.72)]">
              {themeTitle}
            </span>
            <span className="block truncate text-xs text-muted-foreground drop-shadow-[0_1px_8px_hsl(var(--background)/0.72)]">
              {themeLabel}
            </span>
          </span>
        </div>
        <ThemeToggleV2 collapsed presentation="settings-card" testId="settings-v2-theme-toggle" />
      </div>
    </section>
  );
}

export function SettingsModuleList({
  items,
  expandedId,
  onOpen,
  controlsWired,
  label,
  renderPanel,
}: SettingsModuleListProps) {
  return (
    <section aria-label={label} className="grid gap-3" data-testid="settings-module-list">
      {items.map((item) => {
        const expanded = expandedId === item.id;
        const panelId = `settings-module-panel-${item.id}`;
        const buttonId = `settings-module-card-${item.id}`;

        return (
          <SettingsModuleCard
            key={item.id}
            item={item}
            expanded={expanded}
            controlsWired={controlsWired}
            buttonId={buttonId}
            panelId={panelId}
            onOpen={onOpen}
          >
            {expanded && controlsWired ? (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="mt-3 rounded-3xl border border-[hsl(var(--border)/0.52)] bg-[hsl(var(--background)/0.34)] p-2 shadow-inner md:p-3"
                data-testid={`settings-module-panel-${item.id}`}
              >
                {renderPanel(item)}
              </div>
            ) : null}
          </SettingsModuleCard>
        );
      })}
    </section>
  );
}

function SettingsModuleCard({
  item,
  expanded,
  controlsWired,
  buttonId,
  panelId,
  onOpen,
  children,
}: {
  item: SettingsModuleCardData;
  expanded: boolean;
  controlsWired: boolean;
  buttonId: string;
  panelId: string;
  onOpen: (sectionId: V2SettingsSectionId) => void;
  children: ReactNode;
}) {
  const tone = getRoleTone(item.role);
  const Icon = item.icon;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-[hsl(var(--card)/0.76)] p-3 shadow-[var(--zen-shadow-card)]",
        "motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200",
        expanded
          ? "border-[hsl(var(--zf-role-settings)/0.52)] bg-[hsl(var(--card)/0.9)] shadow-[0_18px_46px_-28px_hsl(var(--zf-role-settings)/0.82)]"
          : tone.borderClass
      )}
      data-visual-role={item.role}
      data-testid={`settings-module-${item.id}`}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-5 top-0 h-[2px] rounded-b-full", tone.railClass)}
      />
      <button
        id={buttonId}
        type="button"
        onClick={() => onOpen(item.id)}
        className={cn(
          "relative flex min-h-[96px] w-full items-start gap-3 rounded-[1.35rem] p-3 text-start",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-settings)/0.52)] focus-visible:ring-offset-2",
          "motion-safe:transition-[transform,background-color] motion-safe:duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--card)/0.72)]"
        )}
        data-testid={`settings-module-card-${item.id}`}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={
          item.value
            ? `${item.label}: ${item.value}. ${item.description}`
            : `${item.label}: ${item.description}`
        }
        aria-disabled={!controlsWired}
      >
        <SettingsCardIcon icon={Icon} role={item.role} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{item.label}</span>
          {item.value ? (
            <span className="mt-2 block text-base font-semibold leading-tight text-foreground">
              {item.value}
            </span>
          ) : null}
          <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "ml-auto mt-1 h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200",
            expanded && "rotate-180 text-foreground"
          )}
          aria-hidden="true"
        />
      </button>
      {children}
    </article>
  );
}

function SettingsCardIcon({ icon: Icon, role }: { icon: LucideIcon; role: NonOrbVisualRole }) {
  const tone = getRoleTone(role);

  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
        tone.iconClass
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}
