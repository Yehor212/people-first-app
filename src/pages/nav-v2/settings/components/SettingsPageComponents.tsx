import { forwardRef, type ReactNode } from "react";
import { CheckCircle2, SlidersHorizontal, type LucideIcon } from "lucide-react";
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

export interface SettingsCockpitCardData extends SettingsPageCardData {
  value: string;
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

interface SettingsCardCollectionProps<T extends SettingsPageCardData> {
  items: T[];
  selectedId: V2SettingsSectionId;
  onOpen: (sectionId: V2SettingsSectionId) => void;
  controlsWired: boolean;
}

interface SettingsControlDeckHeaderProps {
  label: string;
  description: string;
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
  },
);

export function SettingsHeroCard({
  title,
  lead,
  themeTitle,
  themeLabel,
}: SettingsHeroCardProps) {
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
            settingsTone.iconClass,
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
        <ThemeToggleV2
          collapsed
          presentation="settings-card"
          testId="settings-v2-theme-toggle"
        />
      </div>
    </section>
  );
}

export function SettingsCockpit({
  items,
  selectedId,
  onOpen,
  controlsWired,
  label,
}: SettingsCardCollectionProps<SettingsCockpitCardData> & { label: string }) {
  return (
    <section
      className="rounded-[1.75rem] border border-[hsl(var(--border)/0.58)] bg-[hsl(var(--card)/0.72)] p-3 shadow-[var(--zen-shadow-card)] backdrop-blur-xl"
      aria-label={label}
      data-testid="settings-cockpit"
    >
      <div className="grid gap-3 min-[560px]:grid-cols-2">
        {items.map((item) => (
          <SettingsCockpitCard
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            controlsWired={controlsWired}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

export function SettingsSectionGrid({
  items,
  selectedId,
  onOpen,
  controlsWired,
  label,
}: SettingsCardCollectionProps<SettingsPageCardData> & { label: string }) {
  return (
    <section
      className="grid gap-3 min-[520px]:grid-cols-2"
      aria-label={label}
      data-testid="settings-page-sections"
    >
      {items.map((item) => (
        <SettingsSectionCard
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          controlsWired={controlsWired}
          onOpen={onOpen}
        />
      ))}
    </section>
  );
}

export const SettingsControlDeckRegion = forwardRef<HTMLElement, {
  children: ReactNode;
  label: string;
}>(function SettingsControlDeckRegion({ children, label }, ref) {
  return (
    <section
      ref={ref}
      id="settings-v2-control-deck"
      className="scroll-mt-6"
      aria-label={label}
      data-testid="settings-page-control-deck"
    >
      {children}
    </section>
  );
});

export function SettingsControlDeckHeader({
  label,
  description,
}: SettingsControlDeckHeaderProps) {
  return (
    <div
      className="mb-3 rounded-3xl border border-[hsl(var(--border)/0.58)] bg-[hsl(var(--card)/0.72)] p-4 shadow-[var(--zen-shadow-card)]"
      data-testid="settings-page-control-deck-header"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--zf-role-settings)/0.12)] text-[hsl(var(--zf-role-settings))]">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">
            {label}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        </span>
      </div>
    </div>
  );
}

function SettingsCockpitCard({
  item,
  selected,
  controlsWired,
  onOpen,
}: {
  item: SettingsCockpitCardData;
  selected: boolean;
  controlsWired: boolean;
  onOpen: (sectionId: V2SettingsSectionId) => void;
}) {
  const tone = getRoleTone(item.role);
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-pressed={selected}
      aria-controls={controlsWired ? "settings-v2-control-deck" : undefined}
      aria-label={`${item.label}: ${item.value}. ${item.description}`}
      className={cn(
        "group relative min-h-[132px] overflow-hidden rounded-3xl border bg-[hsl(var(--background)/0.44)] p-4 text-start",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-settings)/0.52)] focus-visible:ring-offset-2",
        "motion-safe:transition-[transform,border-color,background-color,box-shadow] motion-safe:duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--card)/0.9)]",
        selected
          ? "border-[hsl(var(--zf-role-settings)/0.48)] shadow-[0_18px_46px_-28px_hsl(var(--zf-role-settings)/0.82)]"
          : tone.borderClass,
      )}
      data-testid={`settings-cockpit-card-${item.id}`}
      data-visual-role={item.role}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-5 top-0 h-[2px] rounded-b-full", tone.railClass)}
      />
      <span className="flex items-start gap-3">
        <SettingsCardIcon icon={Icon} role={item.role} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">
            {item.label}
          </span>
          <span className="mt-2 block text-base font-semibold leading-tight text-foreground">
            {item.value}
          </span>
          <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </span>
        </span>
      </span>
    </button>
  );
}

function SettingsSectionCard({
  item,
  selected,
  controlsWired,
  onOpen,
}: {
  item: SettingsPageCardData;
  selected: boolean;
  controlsWired: boolean;
  onOpen: (sectionId: V2SettingsSectionId) => void;
}) {
  const tone = getRoleTone(item.role);
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className={cn(
        "relative min-h-[116px] overflow-hidden rounded-3xl border bg-[hsl(var(--card)/0.76)] p-4 text-start shadow-[var(--zen-shadow-card)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-settings)/0.52)] focus-visible:ring-offset-2",
        "motion-safe:transition-[transform,border-color,background-color,box-shadow] motion-safe:duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--card)/0.88)]",
        tone.borderClass,
        selected && "border-[hsl(var(--zf-role-settings)/0.48)] bg-[hsl(var(--card)/0.92)]",
      )}
      data-testid={`settings-section-${item.id}`}
      data-visual-role={item.role}
      aria-pressed={selected}
      aria-controls={controlsWired ? "settings-v2-control-deck" : undefined}
      aria-label={`${item.label}: ${item.description}`}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-5 top-0 h-[2px] rounded-b-full", tone.railClass)}
      />
      <div className="flex items-start gap-3">
        <SettingsCardIcon icon={Icon} role={item.role} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">
            {item.label}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </span>
        </span>
      </div>
    </button>
  );
}

function SettingsCardIcon({
  icon: Icon,
  role,
}: {
  icon: LucideIcon;
  role: NonOrbVisualRole;
}) {
  const tone = getRoleTone(role);

  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
        tone.iconClass,
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}
