import {
  type KeyboardEventHandler,
  type ReactNode,
} from "react";
import { type LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
export {
  SettingsButtonGrid,
  SettingsDialog,
  SettingsExternalLink,
  SettingsInlineButton,
  SettingsSelectField,
  SettingsStatus,
  SettingsTextInput,
} from "./V2SettingsFormPrimitives";

interface PanelFrameProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
  testId: string;
  showHeader?: boolean;
}

interface ToggleRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
}

interface ActionButtonProps {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  testId?: string;
}

interface SettingsInsetProps {
  children: ReactNode;
  tone?: "neutral" | "danger" | "success";
  testId?: string;
}

interface SettingsInsetButtonProps {
  children: ReactNode;
  onClick: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  testId?: string;
}

interface SettingsChoiceButtonProps {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  presentation?: "compact" | "default" | "stacked";
  selectedTone?: "solid" | "subtle";
  surface?: "background" | "card" | "secondary";
  disabled?: boolean;
  testId?: string;
}

interface SettingsFieldHeaderProps {
  title: string;
  description?: string;
  htmlFor?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "danger";
}

const ACTION_BUTTON_VARIANT_CLASS: Record<
  NonNullable<ActionButtonProps["variant"]>,
  string
> = {
  primary: "zen-gradient text-primary-foreground shadow-[var(--zen-shadow-soft)]",
  secondary:
    "border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--secondary)/0.72)] text-secondary-foreground hover:bg-muted",
  danger:
    "border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15",
};

const SETTINGS_INSET_TONE_CLASS: Record<NonNullable<SettingsInsetProps["tone"]>, string> = {
  neutral: "border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)]",
  danger: "border-destructive/20 bg-destructive/10",
  success: "border-primary/20 bg-primary/10",
};

const SETTINGS_CHOICE_PRESENTATION_CLASS: Record<
  NonNullable<SettingsChoiceButtonProps["presentation"]>,
  string
> = {
  compact: "min-h-[44px] rounded-xl px-3 text-start text-sm",
  default: "min-h-[48px] rounded-2xl px-4 py-3 text-start text-sm",
  stacked:
    "flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center text-sm",
};

const SETTINGS_CHOICE_SURFACE_CLASS: Record<
  NonNullable<SettingsChoiceButtonProps["surface"]>,
  string
> = {
  background:
    "border-[hsl(var(--border)/0.55)] bg-[hsl(var(--background)/0.34)] text-foreground hover:bg-muted",
  card: "border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card)/0.48)] text-foreground hover:bg-muted",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-muted",
};

const SETTINGS_CHOICE_SELECTED_CLASS: Record<
  NonNullable<SettingsChoiceButtonProps["selectedTone"]>,
  string
> = {
  solid: "border-primary bg-primary text-primary-foreground",
  subtle: "border-primary bg-primary/10 text-primary",
};

export function PanelFrame({
  icon: Icon,
  title,
  description,
  children,
  testId,
  showHeader = true,
}: PanelFrameProps) {
  return (
    <section
      className="relative overflow-hidden rounded-[1.75rem] border border-[hsl(var(--border)/0.58)] bg-[hsl(var(--card)/0.78)] p-4 shadow-[var(--zen-shadow-card)] backdrop-blur-xl md:p-5"
      data-testid={testId}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-6 top-0 h-[2px] rounded-b-full bg-[linear-gradient(90deg,hsl(var(--zf-role-settings)/0.18),hsl(var(--zf-role-space)/0.7),hsl(var(--zf-role-rest)/0.2))]"
      />
      {showHeader && (
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[hsl(var(--zf-role-settings)/0.28)] bg-[hsl(var(--zf-role-settings)/0.12)] text-[hsl(var(--zf-role-settings))]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-foreground">{title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {description}
            </span>
          </span>
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  testId,
}: ToggleRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-[64px] items-start justify-between gap-4 rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4",
        disabled && "opacity-60",
      )}
      data-testid={testId}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted)/0.52)] text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        </span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export function ActionButton({
  icon: Icon,
  children,
  onClick,
  disabled,
  variant = "secondary",
  testId,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold motion-safe:transition-[opacity,transform,background-color] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        ACTION_BUTTON_VARIANT_CLASS[variant],
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}

export function SettingsInset({
  children,
  tone = "neutral",
  testId,
}: SettingsInsetProps) {
  return (
    <div
      className={cn("space-y-3 rounded-2xl border p-4", SETTINGS_INSET_TONE_CLASS[tone])}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function SettingsInsetButton({
  children,
  onClick,
  onKeyDown,
  testId,
}: SettingsInsetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      data-testid={testId}
      className="w-full rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {children}
    </button>
  );
}

export function SettingsChoiceButton({
  children,
  selected,
  onClick,
  icon: Icon,
  presentation = "default",
  selectedTone = "subtle",
  surface = "background",
  disabled,
  testId,
}: SettingsChoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      data-testid={testId}
      className={cn(
        "border font-semibold motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
        SETTINGS_CHOICE_PRESENTATION_CLASS[presentation],
        selected ? SETTINGS_CHOICE_SELECTED_CLASS[selectedTone] : SETTINGS_CHOICE_SURFACE_CLASS[surface],
      )}
    >
      {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function SettingsFieldHeader({
  title,
  description,
  htmlFor,
  icon: Icon,
  tone = "neutral",
}: SettingsFieldHeaderProps) {
  const content = (
    <>
      <span className="flex items-center gap-2">
        {Icon ? (
          <Icon
            className={cn("h-4 w-4", tone === "danger" ? "text-destructive" : "text-primary")}
            aria-hidden="true"
          />
        ) : null}
        <span
          className={cn(
            "text-sm font-semibold",
            tone === "danger" ? "text-destructive" : "text-foreground",
          )}
        >
          {title}
        </span>
      </span>
      {description ? (
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      ) : null}
    </>
  );

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className="mb-3 block">
        {content}
      </label>
    );
  }

  return <div className="mb-3">{content}</div>;
}
