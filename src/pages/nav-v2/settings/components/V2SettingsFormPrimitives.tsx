import {
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useBackHandler } from "@/hooks/useBackHandler";
import { cn } from "@/lib/utils";
import type {
  SettingsButtonGridProps,
  SettingsDialogProps,
  SettingsExternalLinkProps,
  SettingsInlineButtonProps,
  SettingsSelectFieldProps,
  SettingsStatusProps,
  SettingsTextInputProps,
} from "./V2SettingsPrimitiveTypes";

const SETTINGS_BUTTON_GRID_CLASS: Record<
  NonNullable<SettingsButtonGridProps["columns"]>,
  string
> = {
  two: "grid w-full min-w-0 max-w-full gap-2 min-[520px]:grid-cols-2",
  three: "grid w-full min-w-0 max-w-full gap-2 min-[520px]:grid-cols-3",
  confirm: "grid w-full min-w-0 max-w-full gap-2 min-[420px]:grid-cols-2",
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
  ariaInvalid,
  ariaDescribedBy,
  ariaLabel,
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
      aria-invalid={ariaInvalid || undefined}
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      dir="auto"
      className={cn(
        "min-h-[48px] min-w-0 w-full rounded-[8px] px-4 text-base text-foreground outline-none ltr:placeholder:text-left rtl:placeholder:text-right focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent)/0.55)] disabled:cursor-not-allowed disabled:opacity-60",
        fill && "flex-1",
        tone === "danger"
          ? "border border-destructive/20 bg-background"
          : "border border-[hsl(var(--settings-v2-border)/0.5)] bg-[hsl(var(--settings-v2-shell)/0.46)]"
      )}
    />
  );
}

export function SettingsSelectField({
  id,
  value,
  options,
  onChange,
  ariaDescribedBy,
  ariaLabel,
}: SettingsSelectFieldProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
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
  buttonRef,
  icon: Icon,
  isLoading = false,
  onClick,
  disabled,
  testId,
  variant = "secondary",
  width = "full",
}: SettingsInlineButtonProps) {
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
        "inline-flex min-h-[48px] max-w-full min-w-0 items-center justify-center gap-2 whitespace-normal rounded-[8px] px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55",
        width === "content" ? "w-auto" : "w-full",
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
      <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:break-word]">
        {children}
      </span>
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
        "min-w-0 break-words text-sm [hyphens:manual] [overflow-wrap:break-word]",
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
        "inline-flex min-h-[48px] min-w-0 items-center whitespace-normal break-words rounded-[8px] px-1 text-primary underline [hyphens:manual] [overflow-wrap:break-word] hover:text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
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
  confirmFocusRef,
  returnFocusRef,
  children,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const restoreTargetRef = useRef<RefObject<HTMLElement | null> | undefined>(returnFocusRef);
  const descriptionId = `${titleId}-description`;

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    restoreTargetRef.current = returnFocusRef;

    panelRef.current?.focus({ preventScroll: true });

    return () => {
      (restoreTargetRef.current?.current ?? previousFocusRef.current)?.focus({
        preventScroll: true,
      });
    };
  }, [returnFocusRef]);

  const handleCancel = useCallback(() => {
    restoreTargetRef.current = returnFocusRef;
    onCancel();
  }, [onCancel, returnFocusRef]);

  useBackHandler(true, handleCancel);

  const handleConfirm = () => {
    restoreTargetRef.current = confirmFocusRef ?? returnFocusRef;
    onConfirm();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleCancel();
      return;
    }
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
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain py-4 pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      ref={dialogRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="fixed inset-0 bg-background/70 backdrop-blur-md"
        onClick={handleCancel}
      />
      <div
        ref={panelRef}
        data-dialog-panel="true"
        tabIndex={-1}
        className="relative max-h-[calc(var(--app-viewport-height)-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.58)] bg-[hsl(var(--settings-v2-card)/0.96)] p-5 shadow-[var(--zen-shadow-card)]"
      >
        <h3
          id={titleId}
          className="min-w-0 break-words text-lg font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]"
        >
          {title}
        </h3>
        <p
          id={descriptionId}
          className="mt-2 min-w-0 break-words text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]"
        >
          {description}
        </p>
        {detail ? (
          <p
            dir="auto"
            className="mt-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]"
          >
            {detail}
          </p>
        ) : null}
        {children ? <div className="mt-4 space-y-2.5">{children}</div> : null}
        <div className="mt-4 grid gap-2 min-[420px]:grid-cols-2">
          <SettingsInlineButton onClick={handleCancel}>{cancelLabel}</SettingsInlineButton>
          <SettingsInlineButton onClick={handleConfirm} variant={confirmVariant}>
            {confirmLabel}
          </SettingsInlineButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
