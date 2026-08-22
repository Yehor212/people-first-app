import { useId } from "react";
import { Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  ActionButtonProps,
  PanelFrameProps,
  SettingsChoiceButtonProps,
  SettingsFieldHeaderProps,
  SettingsInsetButtonProps,
  SettingsInsetProps,
  ToggleRowProps,
} from "./V2SettingsPrimitiveTypes";
export {
  SettingsButtonGrid,
  SettingsDialog,
  SettingsExternalLink,
  SettingsInlineButton,
  SettingsSelectField,
  SettingsStatus,
  SettingsTextInput,
} from "./V2SettingsFormPrimitives";

const ACTION_BUTTON_VARIANT_CLASS: Record<NonNullable<ActionButtonProps["variant"]>, string> = {
  primary:
    "border border-[hsl(var(--settings-v2-accent)/0.45)] bg-[hsl(var(--settings-v2-accent)/0.14)] text-foreground shadow-[0_12px_28px_-22px_hsl(var(--settings-v2-accent)/0.52)] hover:bg-[hsl(var(--settings-v2-accent)/0.2)]",
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
  compact:
    "flex min-h-[48px] min-w-[48px] items-center justify-center gap-2 rounded-full px-3 text-center text-sm",
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
    "border-[hsl(var(--settings-v2-accent)/0.46)] bg-[hsl(var(--settings-v2-accent)/0.1)] text-foreground shadow-[0_10px_22px_-22px_hsl(var(--settings-v2-accent)/0.28)]",
  subtle:
    "border-[hsl(var(--settings-v2-accent)/0.42)] bg-[hsl(var(--settings-v2-accent)/0.08)] text-foreground shadow-[0_10px_22px_-24px_hsl(var(--settings-v2-accent)/0.24)]",
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
  const titleId = useId();
  const descriptionId = useId();

  return (
    <section
      className={cn(
        "relative w-full min-w-0 max-w-full overflow-hidden rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.42)] bg-[hsl(var(--settings-v2-card)/0.62)] shadow-[var(--zen-shadow-card)]",
        variant === "studio"
          ? "p-2 min-[360px]:p-3.5 sm:p-4 md:p-5"
          : "p-2.5 min-[360px]:p-3 md:p-3.5"
      )}
      data-testid={testId}
      data-panel-variant={variant}
      aria-labelledby={showHeader ? titleId : undefined}
      aria-describedby={showHeader ? descriptionId : undefined}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-4 top-0 h-px rounded-b-full bg-[hsl(var(--settings-v2-rim-light)/0.22)]"
      />
      {showHeader && (
        <div
          className={cn(
            "mb-2.5 flex flex-col items-start gap-2.5 min-[360px]:flex-row min-[360px]:gap-3",
            variant === "studio" && "mb-3.5"
          )}
          data-slot="settings-panel-header"
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.42)] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]",
              variant === "studio" &&
                "h-10 w-10 bg-[hsl(var(--settings-v2-accent)/0.12)] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.24)]"
            )}
            data-slot="settings-panel-icon"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span
            className="w-full min-w-0 [hyphens:manual] [overflow-wrap:break-word] min-[360px]:w-auto"
            data-slot="settings-panel-copy"
          >
            <h3
              id={titleId}
              className={cn(
                "block break-words text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]",
                variant === "studio" && "text-base sm:text-lg"
              )}
            >
              {title}
            </h3>
            <span
              id={descriptionId}
              className="mt-1 block break-words text-xs leading-relaxed text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]"
            >
              {description}
            </span>
          </span>
        </div>
      )}
      <div className="min-w-0 space-y-2.5">{children}</div>
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
        "grid min-h-[58px] grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-none border-x-0 border-t-0 border-b border-[hsl(var(--settings-v2-border)/0.36)] bg-transparent px-1 py-3 last:border-b-0 min-[360px]:grid-cols-[2.25rem_minmax(0,1fr)_auto]",
        surfaceWeight === "quiet" &&
          "border-transparent focus-within:border-[hsl(var(--settings-v2-accent)/0.34)]",
        disabled && "opacity-60"
      )}
      data-surface-weight={surfaceWeight}
      data-testid={testId}
    >
      <span className="col-start-1 row-start-1 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center text-[hsl(var(--settings-v2-accent))]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="col-start-2 col-end-3 row-start-1 min-w-0 self-center break-words text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
        {title}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
        aria-describedby={descriptionId}
        className="col-start-2 row-start-2 mt-1 shrink-0 justify-self-end min-[360px]:col-start-3 min-[360px]:row-start-1 min-[360px]:mt-0.5"
      />
      <span
        id={descriptionId}
        className="col-start-2 col-end-3 row-start-3 min-w-0 break-words text-xs leading-relaxed text-muted-foreground [hyphens:manual] [overflow-wrap:break-word] min-[360px]:col-end-4 min-[360px]:row-start-2"
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
      <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:break-word]">
        {children}
      </span>
    </button>
  );
}

export function SettingsInset({
  children,
  containerRef,
  tone = "neutral",
  presentation = "contained",
  testId,
  className,
  tabIndex,
  role,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
}: SettingsInsetProps) {
  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full min-w-0 max-w-full space-y-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent)/0.55)]",
        presentation === "flat-row"
          ? "rounded-none border-x-0 border-t-0 border-b border-[hsl(var(--settings-v2-border)/0.42)] bg-transparent px-1 py-3 focus-visible:ring-inset focus-visible:ring-offset-0 md:py-3.5"
          : "rounded-[8px] border p-2 min-[360px]:p-3 focus-visible:ring-offset-2 md:p-3.5",
        presentation === "contained" && SETTINGS_INSET_TONE_CLASS[tone],
        className
      )}
      data-inset-presentation={presentation}
      data-testid={testId}
      tabIndex={tabIndex}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
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
      className="min-h-[48px] w-full min-w-0 whitespace-normal break-words rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.58)] bg-[hsl(var(--settings-v2-shell)/0.56)] p-4 text-center [hyphens:manual] [overflow-wrap:break-word] shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.42)] motion-safe:transition-[transform,background-color,border-color,box-shadow] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
  lang,
  dir,
}: SettingsChoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      data-interaction-surface="settings-choice"
      data-testid={testId}
      lang={lang}
      dir={dir}
      className={cn(
        "relative min-w-0 whitespace-normal break-words border font-semibold [hyphens:manual] [overflow-wrap:break-word] shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.38)] motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
        SETTINGS_CHOICE_PRESENTATION_CLASS[presentation],
        selected
          ? SETTINGS_CHOICE_SELECTED_CLASS[selectedTone]
          : SETTINGS_CHOICE_SURFACE_CLASS[surface],
        className
      )}
    >
      {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      <span
        className="min-w-0 max-w-full break-words [hyphens:manual] [overflow-wrap:break-word]"
        data-slot="settings-choice-label"
      >
        {children}
      </span>
      {selected ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center",
            presentation === "stacked" && "absolute end-2 top-2"
          )}
          data-slot="settings-choice-selection"
        >
          <Check className="h-4 w-4" />
        </span>
      ) : null}
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
      <span className="flex min-w-0 items-start gap-2">
        {Icon ? (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              tone === "danger" ? "text-destructive" : "text-primary"
            )}
            aria-hidden="true"
          />
        ) : null}
        <span
          className={cn(
            "min-w-0 break-words text-sm font-semibold [hyphens:manual] [overflow-wrap:break-word]",
            tone === "danger" ? "text-destructive" : "text-foreground"
          )}
        >
          {title}
        </span>
      </span>
      {description ? (
        <span className="mt-1 block break-words text-xs leading-relaxed text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
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
