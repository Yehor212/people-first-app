import {
  useEffect,
  useRef,
  type AriaRole,
  type ChangeEvent,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, type LucideIcon } from "lucide-react";
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
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  fill?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
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
  ariaLabel?: string;
}

interface SettingsExternalLinkProps {
  href: string;
  children: ReactNode;
  size?: "xs" | "sm";
}

interface SettingsInlineButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  isLoading?: boolean;
  testId?: string;
  variant?: "primary" | "secondary" | "danger";
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
  confirmVariant?: "primary" | "secondary" | "danger";
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
    "border border-[hsl(var(--settings-v2-accent)/0.45)] bg-[hsl(var(--settings-v2-accent)/0.14)] text-[hsl(var(--settings-v2-accent))] shadow-[0_12px_28px_-22px_hsl(var(--settings-v2-accent)/0.52)] hover:bg-[hsl(var(--settings-v2-accent)/0.2)] focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2",
  secondary:
    "border border-[hsl(var(--settings-v2-border)/0.64)] bg-[hsl(var(--settings-v2-panel)/0.78)] text-foreground shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.42)] hover:bg-[hsl(var(--settings-v2-panel)/0.92)] focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2",
  danger:
    "border border-destructive/48 bg-destructive/14 text-destructive shadow-[0_10px_22px_-18px_hsl(var(--destructive)/0.54)] hover:bg-destructive/20 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:opacity-60",
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
  placeholder,
  autoFocus = false,
  disabled,
  fill = false,
  onKeyDown,
  tone = "neutral",
}: SettingsTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const focusInput = () => inputRef.current?.focus({ preventScroll: true });
    focusInput();
    const frame = window.requestAnimationFrame(focusInput);
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, disabled]);

  return (
    <input
      ref={inputRef}
      id={id}
      type={type}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      autoComplete={autoComplete}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
      onKeyDown={onKeyDown}
      className={cn(
        "min-h-[48px] w-full rounded-[8px] px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent)/0.55)] disabled:cursor-not-allowed disabled:opacity-60",
        fill && "flex-1",
        tone === "danger"
          ? "border border-destructive/20 bg-background"
          : "border border-[hsl(var(--settings-v2-border)/0.5)] bg-[hsl(var(--settings-v2-shell)/0.46)]"
      )}
    />
  );
}

export function SettingsSelectField({ id, value, options, onChange }: SettingsSelectFieldProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[48px] w-full appearance-none rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.5)] bg-[hsl(var(--settings-v2-shell)/0.46)] px-4 pe-11 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent)/0.55)]"
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
  icon: Icon,
  isLoading = false,
  onClick,
  disabled,
  testId,
  variant = "secondary",
}: SettingsInlineButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={isLoading ? "true" : undefined}
      data-button-tone={variant}
      data-testid={testId}
      className={cn(
        "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-[8px] px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55",
        "motion-safe:transition-[transform,background-color,border-color,box-shadow,color,opacity] motion-safe:duration-200 motion-safe:ease-out",
        "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none",
        SETTINGS_INLINE_BUTTON_CLASS[variant]
      )}
    >
      {Icon ? (
        <Icon
          className={cn("h-4 w-4 shrink-0", isLoading && "motion-safe:animate-spin")}
          aria-hidden="true"
          data-testid={testId ? testId + "-icon" : undefined}
        />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export function SettingsStatus({
  children,
  tone = "muted",
  center = false,
  ariaLabel,
}: SettingsStatusProps) {
  if (!children) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn(
        "text-sm",
        tone === "danger" ? "text-destructive" : "text-muted-foreground",
        center && "text-center"
      )}
    >
      {children}
    </p>
  );
}

export function SettingsExternalLink({ href, children, size = "xs" }: SettingsExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 items-center rounded-[8px] px-1 text-primary underline hover:text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        size === "sm" ? "text-sm" : "text-xs"
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
  confirmVariant = "primary",
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const descriptionId = `${titleId}-description`;

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    panelRef.current?.focus({ preventScroll: true });

    return () => {
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current
        ?.querySelector<HTMLElement>("[data-dialog-panel]")
        ?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (active === panelRef.current) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain p-4 pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      ref={dialogRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="fixed inset-0 bg-background/70 backdrop-blur-md"
        aria-label={cancelLabel}
        onClick={onCancel}
      />
      <div
        ref={panelRef}
        data-dialog-panel="true"
        tabIndex={-1}
        className="relative max-h-[calc(var(--app-viewport-height)-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.58)] bg-[hsl(var(--settings-v2-card)/0.96)] p-5 shadow-[var(--zen-shadow-card)]"
      >
        <h3 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
        {detail ? <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p> : null}
        <div className="mt-4 grid gap-2 min-[360px]:grid-cols-2">
          <SettingsInlineButton onClick={onCancel}>{cancelLabel}</SettingsInlineButton>
          <SettingsInlineButton onClick={onConfirm} variant={confirmVariant}>
            {confirmLabel}
          </SettingsInlineButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
