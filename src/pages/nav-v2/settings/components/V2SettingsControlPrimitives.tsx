import {
  type AriaRole,
  type ChangeEvent,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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

interface SettingsButtonGridProps {
  children: ReactNode;
  columns?: "two" | "three" | "confirm";
  role?: AriaRole;
  ariaLabel?: string;
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

interface SettingsTextInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
  fill?: boolean;
  tone?: "neutral" | "danger";
}

interface SettingsSelectFieldProps {
  id: string;
  value: string | number;
  options: Array<{ value: string | number; label: string }>;
  onChange: (value: string) => void;
}

interface SettingsStatusProps {
  children?: ReactNode;
  tone?: "muted" | "danger";
  center?: boolean;
}

interface SettingsExternalLinkProps {
  href: string;
  children: ReactNode;
  size?: "xs" | "sm";
}

interface SettingsDialogProps {
  titleId: string;
  title: string;
  description: string;
  detail?: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
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

const SETTINGS_BUTTON_GRID_CLASS: Record<
  NonNullable<SettingsButtonGridProps["columns"]>,
  string
> = {
  two: "grid gap-2 min-[520px]:grid-cols-2",
  three: "grid gap-2 min-[520px]:grid-cols-3",
  confirm: "grid gap-2 min-[420px]:grid-cols-2",
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

const SETTINGS_INLINE_BUTTON_CLASS = {
  primary:
    "zen-gradient text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-2",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-2",
  danger:
    "bg-destructive text-destructive-foreground focus-visible:ring-destructive/40 disabled:opacity-60",
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

export function SettingsButtonGrid({
  children,
  columns = "two",
  role,
  ariaLabel,
}: SettingsButtonGridProps) {
  return (
    <div className={SETTINGS_BUTTON_GRID_CLASS[columns]} role={role} aria-label={ariaLabel}>
      {children}
    </div>
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

export function SettingsTextInput({
  value,
  onChange,
  id,
  type = "text",
  autoComplete,
  disabled,
  fill = false,
  tone = "neutral",
}: SettingsTextInputProps) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      autoComplete={autoComplete}
      disabled={disabled}
      className={cn(
        "min-h-[48px] w-full rounded-2xl px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        fill && "flex-1",
        tone === "danger"
          ? "border border-destructive/20 bg-background"
          : "border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--background)/0.48)]",
      )}
    />
  );
}

export function SettingsSelectField({
  id,
  value,
  options,
  onChange,
}: SettingsSelectFieldProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[48px] w-full appearance-none rounded-2xl border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card)/0.58)] px-4 pe-11 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function SettingsInlineButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-[44px] rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2",
        SETTINGS_INLINE_BUTTON_CLASS[variant],
      )}
    >
      {children}
    </button>
  );
}

export function SettingsStatus({
  children,
  tone = "muted",
  center = false,
}: SettingsStatusProps) {
  if (!children) return null;

  return (
    <p
      className={cn(
        "text-sm",
        tone === "danger" ? "text-destructive" : "text-muted-foreground",
        center && "text-center",
      )}
    >
      {children}
    </p>
  );
}

export function SettingsExternalLink({
  href,
  children,
  size = "xs",
}: SettingsExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-primary underline hover:text-primary/90",
        size === "sm" ? "text-sm" : "text-xs",
      )}
    >
      {children}
    </a>
  );
}

export function SettingsDialog({
  titleId,
  title,
  description,
  detail,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: SettingsDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="fixed inset-0 bg-background/70 backdrop-blur-md"
        aria-label={cancelLabel}
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-[1.5rem] border border-[hsl(var(--border)/0.58)] bg-card p-5 shadow-2xl">
        <h3 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {detail ? <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p> : null}
        <div className="mt-4 grid gap-2 min-[360px]:grid-cols-2">
          <SettingsInlineButton onClick={onCancel}>{cancelLabel}</SettingsInlineButton>
          <SettingsInlineButton onClick={onConfirm} variant="primary">
            {confirmLabel}
          </SettingsInlineButton>
        </div>
      </div>
    </div>
  );
}
