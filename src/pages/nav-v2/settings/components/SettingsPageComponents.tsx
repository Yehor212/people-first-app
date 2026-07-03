import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { ThemeToggleV2 } from "@/components/navigation-v2/ThemeToggleV2";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { NonOrbVisualRole } from "@/lib/nonOrbVisualRoles";
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

const settingsModuleTextWrapStyle: CSSProperties = { overflowWrap: "anywhere" };

export const SettingsPageShell = forwardRef<HTMLElement, SettingsPageShellProps>(
  function SettingsPageShell({ children, controlsWired, labelledBy }, ref) {
    return (
      <main
        ref={ref}
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="v2-fullscreen-page v2-readable-page v2-readable-page--standard mx-auto grid min-h-[var(--app-viewport-height)] w-full max-w-6xl grid-cols-1 content-start gap-3 px-4 pt-[calc(var(--safe-top)+4.75rem)] pb-[calc(var(--safe-bottom)+1.25rem)] outline-none sm:pt-[calc(var(--safe-top)+4.25rem)] md:px-6 md:pt-[calc(var(--safe-top)+2rem)] md:pb-[calc(var(--safe-bottom)+2rem)] lg:gap-4"
        aria-labelledby={labelledBy}
        data-testid="settings-page"
        data-v2-readable-page="settings"
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

  return (
    <section
      className="relative grid min-w-0 gap-3 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.52)] bg-[hsl(var(--settings-v2-card)/0.92)] p-3 shadow-[var(--zen-shadow-card)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-4"
      data-testid="settings-page-control-card"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.5)] bg-[hsl(var(--settings-v2-panel)/0.72)] text-[hsl(var(--settings-v2-accent))]">
          <SettingsIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            ZENFLOW
          </p>
          <h1
            id="settings-page-heading"
            className="mt-0.5 font-display text-2xl font-semibold tracking-normal text-foreground md:text-3xl"
          >
            {title}
          </h1>
          <p className="mt-1 max-w-2xl font-body text-sm leading-relaxed text-muted-foreground">
            {lead}
          </p>
        </div>
      </div>

      <div
        className="mt-14 flex min-h-[52px] min-w-0 items-center justify-between gap-3 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.44)] bg-[hsl(var(--settings-v2-shell)/0.56)] px-3 py-2 md:mt-0"
        data-testid="settings-theme-strip"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[hsl(var(--settings-v2-accent)/0.12)] text-[hsl(var(--settings-v2-accent))]">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {themeTitle}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{themeLabel}</span>
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
  const activeItem = controlsWired
    ? (items.find((item) => item.id === expandedId) ?? items[0])
    : null;
  const activePanelId = activeItem ? `settings-module-panel-${activeItem.id}` : undefined;
  const activeButtonId = activeItem ? `settings-module-card-${activeItem.id}` : undefined;
  const isDesktopWorkspace = useMediaQuery("(min-width: 1024px)");
  const moduleList = (
    <div
      className="order-2 grid min-w-0 gap-2 lg:order-1 lg:sticky lg:top-[calc(var(--safe-top)+1rem)]"
      data-testid="settings-module-list"
    >
      {items.map((item) => {
        const expanded = activeItem?.id === item.id;
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
          />
        );
      })}
    </div>
  );
  const selectedPanel =
    activeItem && activePanelId && activeButtonId ? (
      <section
        className="order-1 min-w-0 lg:order-2"
        data-testid="settings-selected-panel"
        data-selected-section={activeItem.id}
      >
        <div
          id={activePanelId}
          role="region"
          aria-labelledby={activeButtonId}
          className="grid min-w-0 scroll-mt-[calc(var(--safe-top)+5.75rem)] gap-3 sm:scroll-mt-[calc(var(--safe-top)+5rem)] lg:scroll-mt-[calc(var(--safe-top)+1rem)]"
          data-testid={activePanelId}
        >
          <div
            id="settings-v2-control-deck"
            className="grid min-w-0 gap-3"
            data-testid="settings-page-control-deck"
            data-selected-section={activeItem.id}
          >
            {renderPanel(activeItem)}
          </div>
        </div>
      </section>
    ) : null;

  return (
    <section
      aria-label={label}
      className={cn(
        "grid min-w-0 gap-3",
        controlsWired && "lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)] lg:items-start"
      )}
      data-testid="settings-page-workspace"
      data-layout="control-surface"
    >
      {isDesktopWorkspace ? (
        <>
          {moduleList}
          {selectedPanel}
        </>
      ) : (
        <>
          {selectedPanel}
          {moduleList}
        </>
      )}
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
}: {
  item: SettingsModuleCardData;
  expanded: boolean;
  controlsWired: boolean;
  buttonId: string;
  panelId: string;
  onOpen: (sectionId: V2SettingsSectionId) => void;
}) {
  const Icon = item.icon;

  return (
    <article
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[8px] border bg-[hsl(var(--settings-v2-card)/0.76)] shadow-[var(--zen-shadow-card)]",
        "motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200",
        expanded
          ? "border-[hsl(var(--settings-v2-accent))] bg-[hsl(var(--settings-v2-panel)/0.82)] shadow-[0_14px_36px_-28px_hsl(var(--settings-v2-shadow)/0.56)]"
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
          "relative flex min-h-[72px] w-full min-w-0 items-start gap-3 rounded-[8px] p-3 text-start",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2",
          "shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.42)] motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none hover:bg-[hsl(var(--settings-v2-panel)/0.72)] disabled:cursor-default disabled:hover:bg-transparent"
        )}
        data-interaction-surface="settings-module"
        data-testid={`settings-module-card-${item.id}`}
        {...(controlsWired
          ? {
              "aria-expanded": expanded,
              "aria-controls": panelId,
            }
          : {})}
        aria-label={
          item.value
            ? `${item.label}: ${item.value}. ${item.description}`
            : `${item.label}: ${item.description}`
        }
      >
        <SettingsCardIcon icon={Icon} selected={expanded} />
        <span className="min-w-0 flex-1" style={settingsModuleTextWrapStyle}>
          <span className="block text-sm font-semibold text-foreground">{item.label}</span>
          {item.value ? (
            <span className="mt-1 block text-sm font-semibold leading-tight text-foreground">
              {item.value}
            </span>
          ) : null}
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </span>
        </span>
        <ChevronRight
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 rtl:rotate-180",
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
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border",
        selected
          ? "border-[hsl(var(--settings-v2-accent))] bg-[hsl(var(--settings-v2-accent)/0.18)] text-[hsl(var(--settings-v2-accent))]"
          : "border-[hsl(var(--settings-v2-border)/0.54)] bg-[hsl(var(--settings-v2-shell)/0.62)] text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
