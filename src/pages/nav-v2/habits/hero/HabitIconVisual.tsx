import { IdentityVisual } from "@/components/IdentityIconPicker";
import { V2_HABIT_TEMPLATE_ICONS } from "@/lib/v2IconSystem";
import {
  BookOpenCheck,
  Droplets,
  Goal,
  Leaf,
  type LucideIcon,
} from "lucide-react";

const HABIT_ICON_ALIASES: Record<string, LucideIcon> = {
  leaf: Leaf,
  leaves: Leaf,
  water: Droplets,
  droplet: Droplets,
  droplets: Droplets,
  focus: Goal,
  goal: Goal,
  book: BookOpenCheck,
  books: BookOpenCheck,
  reading: BookOpenCheck,
};

function normalizeStoredIconName(value: string) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function getStoredHabitIconComponent(value?: string): LucideIcon | null {
  const key = normalizeStoredIconName(value ?? "");
  if (!key) return null;
  return V2_HABIT_TEMPLATE_ICONS[key] ?? HABIT_ICON_ALIASES[key] ?? null;
}

export function HabitIconVisual({
  value,
  iconClassName = "h-5 w-5",
  textClassName = "text-lg leading-none",
  fallback = "Target",
}: {
  value?: string;
  iconClassName?: string;
  textClassName?: string;
  fallback?: string;
}) {
  const Icon = getStoredHabitIconComponent(value);
  if (Icon) {
    return <Icon className={iconClassName} aria-hidden="true" />;
  }

  return (
    <IdentityVisual
      name={value}
      fallback={fallback}
      iconClassName={iconClassName}
      textClassName={textClassName}
    />
  );
}
