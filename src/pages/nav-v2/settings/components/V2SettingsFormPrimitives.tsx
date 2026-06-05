import {
  type AriaRole,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsButtonGridProps {
  children: ReactNode;
  columns?: "two" | "three" | "confirm";
  role?: AriaRole;
  ariaLabel?: string;
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

const SETTINGS_BUTTON_GRID_CLASS: Record<
  NonNullable<SettingsButtonGridProps["columns"]>,
  string
> = {
  two: "grid gap-2 min-[520px]:grid-cols-2",
  three: "grid gap-2 min-[520px]:grid-cols-3",
  confirm: "grid gap-2 min-[420px]:grid-cols-2",
};

const SETTINGS_INLINE_BUTTON_CLASS = {
  primary:
    "zen-gradient text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-2",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-2",
  danger:
    "bg-destructive text-destructive-foreground focus-visible:ring-destructive/40 disabled:opacity-60",
};

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
