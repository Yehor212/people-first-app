import {
  useId,
  type AriaRole,
  type KeyboardEventHandler,
  type ReactNode,
  type Ref,
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
  variant?: "default" | "studio";
}

interface ToggleRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
  surfaceWeight?: "default" | "quiet";
}

interface ActionButtonProps {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  testId?: string;
}

interface SettingsInsetProps {
  children: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
  tone?: "neutral" | "danger" | "success";
  testId?: string;
  className?: string;
  tabIndex?: number;
  role?: AriaRole;
  ariaLabel?: string;
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
  selectedTone?: "solid" | "subtle" | "danger";
  surface?: "background" | "card" | "secondary";
  disabled?: boolean;
  testId?: string;
  className?: string;
}

interface SettingsFieldHeaderProps {
  title: string;
  description?: string;
  htmlFor?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "danger";
}

const ACTION_BUTTON_VARIANT_CLASS: Record<NonNullable<ActionButtonProps["variant"]>, string> = {
  primary:
    "border border-[hsl(var(--settings-v2-accent)/0.45)] bg-[hsl(var(--settings-v2-accent)/0.14)] text-[hsl(var(--settings-v2-accent))] shadow-[0_12px_28px_-22px_hsl(var(--settings-v2-accent)/0.52)] hover:bg-[hsl(var(--settings-v2-accent)/0.2)]",
  secondary:
    "border border-[hsl(var(--settings-v2-border)/0.64)] bg-[hsl(var(--settings-v2-panel)/0.78)] text-foreground shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.42)] hover:bg-[hsl(var(--settings-v2-panel)/0.92)]",
  danger:
    "border border-destructive/48 bg-destructive/14 text-destructive shadow-[0_10px_22px_-18px_hsl(var(--destructive)/0.54)] hover:bg-destructive/20",
};

const SETTINGS_INSET_TONE_CLASS: Record<NonNullable<SettingsInsetProps["tone"]>, string> = {
  neutral: "border-[hsl(var(--settings-v2-border)/0.42)] bg-[hsl(var(--settings-v2-shell)/0.46)]",
  danger: "border-destructive/20 bg-destructive/10",
  success: "border-primary/20 bg-primary/10",
};

const SETTINGS_CHOICE_PRESENTATION_CLASS: Record<
  NonNullable<SettingsChoiceButtonProps["presentation"]>,
  string
> = {
  compact: "flex min-h-[44px] items-center justify-center gap-2 rounded-full px-3 text-center text-sm",
  default: "flex min-h-[48px] items-center gap-2 rounded-[8px] px-4 py-3 text-start text-sm",
  stacked:
    "flex min-h-[68px] flex-col items-center justify-center gap-2 rounded-[8px] p-3 text-center text-sm",
};

const SETTINGS_CHOICE_SURFACE_CLASS: Record<
  NonNullable<SettingsChoiceButtonProps["surface"]>,
  string
> = {
  background:
    "border-[hsl(var(--settings-v2-border)/0.48)] bg-[hsl(var(--settings-v2-shell)/0.48)] text-foreground hover:bg-[hsl(var(--settings-v2-panel)/0.78)]",
  card: "border-[hsl(var(--settings-v2-border)/0.48)] bg-[hsl(var(--settings-v2-card)/0.62)] text-foreground hover:bg-[hsl(var(--settings-v2-panel)/0.78)]",
  secondary:
    "border-[hsl(var(--settings-v2-border)/0.36)] bg-[hsl(var(--settings-v2-panel)/0.62)] text-foreground hover:bg-[hsl(var(--settings-v2-panel)/0.78)]",
};

const SETTINGS_CHOICE_SELECTED_CLASS: Record<
  NonNullable<SettingsChoiceButtonProps["selectedTone"]>,
  string
> = {
  solid:
    "border-[hsl(var(--settings-v2-accent)/0.46)] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))] shadow-[0_10px_22px_-22px_hsl(var(--settings-v2-accent)/0.28)]",
  subtle:
    "border-[hsl(var(--settings-v2-accent)/0.42)] bg-[hsl(var(--settings-v2-accent)/0.08)] text-[hsl(var(--settings-v2-accent))] shadow-[0_10px_22px_-24px_hsl(var(--settings-v2-accent)/0.24)]",
  danger:
    "border-destructive/45 bg-destructive/10 text-destructive shadow-[0_10px_22px_-22px_hsl(var(--destructive)/0.42)]",
};

export function PanelFrame({
  icon: Icon,
  title,
  description,
  children,
  testId,
  showHeader = true,
  variant = "default",
}: PanelFrameProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.42)] bg-[hsl(var(--settings-v2-card)/0.62)] p-3 shadow-[var(--zen-shadow-card)] md:p-3.5",
        variant === "studio" && "p-3.5 sm:p-4 md:p-5"
      )}
      data-testid={testId}
      data-panel-variant={variant}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-4 top-0 h-px rounded-b-full bg-[hsl(var(--settings-v2-rim-light)/0.22)]"
      />
      {showHeader && (
        <div className={cn("mb-2.5 flex items-start gap-3", variant === "studio" && "mb-3.5")}>
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.42)] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]",
              variant === "studio" && "h-10 w-10 bg-[hsl(var(--settings-v2-accent)/0.12)] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.24)]"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className={cn("block text-sm font-semibold text-foreground", variant === "studio" && "text-base sm:text-lg")}>{title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {description}
            </span>
          </span>
        </div>
      )}
      <div className="space-y-2.5">{children}</div>
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
  surfaceWeight = "default",
}: ToggleRowProps) {
  const descriptionId = useId();

  return (
    <div
      className={cn(
        "grid min-h-[58px] grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.36)] bg-[hsl(var(--settings-v2-shell)/0.38)] p-3 min-[420px]:grid-cols-[2.25rem_minmax(0,1fr)_auto] md:p-3.5",
        surfaceWeight === "quiet" &&
          "border-transparent bg-[hsl(var(--settings-v2-shell)/0.28)] focus-within:border-[hsl(var(--settings-v2-accent)/0.34)]",
        disabled && "opacity-60"
      )}
      data-surface-weight={surfaceWeight}
      data-testid={testId}
    >
      <span className="col-start-1 row-start-1 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="col-start-2 row-start-1 min-w-0 self-center break-words hyphens-auto text-sm font-semibold text-foreground">
        {title}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
        aria-describedby={descriptionId}
        className="col-start-2 row-start-3 mt-1 shrink-0 justify-self-end min-[420px]:col-start-3 min-[420px]:row-start-1 min-[420px]:mt-0.5 min-[420px]:justify-self-auto"
      />
      <span
        id={descriptionId}
        className="col-start-2 col-end-3 row-start-2 min-w-0 text-xs leading-relaxed text-muted-foreground min-[420px]:col-end-4"
      >
        {description}
      </span>
    </div>
  );
}

export function ActionButton({
  icon: Icon,
  children,
  onClick,
  buttonRef,
  disabled,
  isLoading = false,
  variant = "secondary",
  testId,
}: ActionButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={isLoading ? "true" : undefined}
      data-button-tone={variant}
      data-testid={testId}
      className={cn(
        "flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 whitespace-normal rounded-[8px] px-4 py-3 text-sm font-semibold motion-safe:transition-[opacity,transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none",
        ACTION_BUTTON_VARIANT_CLASS[variant]
      )}
    >
      <Icon
        className={cn("h-4 w-4 shrink-0", isLoading && "motion-safe:animate-spin")}
        aria-hidden="true"
      />
      <span className="min-w-0 break-words hyphens-auto [overflow-wrap:anywhere]">{children}</span>
    </button>
  );
}

export function SettingsInset({
  children,
  containerRef,
  tone = "neutral",
  testId,
  className,
  tabIndex,
  role,
  ariaLabel,
}: SettingsInsetProps) {
  return (
    <div
      ref={containerRef}
      className={cn(
        "space-y-2.5 rounded-[8px] border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent)/0.55)] focus-visible:ring-offset-2 md:p-3.5",
        SETTINGS_INSET_TONE_CLASS[tone],
        className,
      )}
      data-testid={testId}
      tabIndex={tabIndex}
      role={role}
      aria-label={ariaLabel}
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
      className="w-full rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.58)] bg-[hsl(var(--settings-v2-shell)/0.56)] p-4 text-center shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.42)] motion-safe:transition-[transform,background-color,border-color,box-shadow] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
  className,
}: SettingsChoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      data-interaction-surface="settings-choice"
      data-testid={testId}
      className={cn(
        "border font-semibold shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.38)] motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
        SETTINGS_CHOICE_PRESENTATION_CLASS[presentation],
        selected
          ? SETTINGS_CHOICE_SELECTED_CLASS[selectedTone]
          : SETTINGS_CHOICE_SURFACE_CLASS[surface],
        className
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
            tone === "danger" ? "text-destructive" : "text-foreground"
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
      <label htmlFor={htmlFor} className="mb-2.5 block">
        {content}
      </label>
    );
  }

  return <div className="mb-2.5">{content}</div>;
}
