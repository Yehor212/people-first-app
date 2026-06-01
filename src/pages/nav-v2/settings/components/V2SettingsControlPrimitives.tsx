import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
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
