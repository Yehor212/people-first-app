import type { AriaRole, KeyboardEventHandler, ReactNode, Ref, RefObject } from "react";
import type { LucideIcon } from "lucide-react";

export interface PanelFrameProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
  testId: string;
  showHeader?: boolean;
  variant?: "default" | "studio";
}

export interface ToggleRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
  surfaceWeight?: "default" | "quiet";
}

export interface ActionButtonProps {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  testId?: string;
}

export interface SettingsInsetProps {
  children: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
  tone?: "neutral" | "danger" | "success";
  presentation?: "contained" | "flat-row";
  emphasis?: "row" | "callout";
  testId?: string;
  className?: string;
  tabIndex?: number;
  role?: AriaRole;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

export interface SettingsInsetButtonProps {
  children: ReactNode;
  onClick: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  testId?: string;
}

export interface SettingsChoiceButtonProps {
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
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
}

export interface SettingsFieldHeaderProps {
  title: string;
  description?: string;
  htmlFor?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "danger";
}

export interface SettingsButtonGridProps {
  children: ReactNode;
  columns?: "two" | "three" | "confirm";
  role?: AriaRole;
  ariaLabel?: string;
}

export interface SettingsTextInputProps {
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
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

export interface SettingsSelectFieldProps {
  id: string;
  value: string | number;
  options: Array<{ value: string | number; label: string }>;
  onChange: (value: string) => void;
  ariaDescribedBy?: string;
}

export interface SettingsStatusProps {
  children?: ReactNode;
  tone?: "muted" | "danger";
  center?: boolean;
  ariaLabel?: string;
}

export interface SettingsExternalLinkProps {
  href: string;
  children: ReactNode;
  size?: "xs" | "sm";
}

export interface SettingsInlineButtonProps {
  children: ReactNode;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  disabled?: boolean;
  icon?: LucideIcon;
  isLoading?: boolean;
  testId?: string;
  variant?: "primary" | "secondary" | "danger";
  width?: "full" | "content";
}

export interface SettingsDialogProps {
  titleId: string;
  title: string;
  description: string;
  detail?: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmVariant?: "primary" | "secondary" | "danger";
  confirmFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  children?: ReactNode;
}
