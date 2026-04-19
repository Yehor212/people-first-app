/**
 * IdentityIconPicker — Curated lucide-react icon selector for identity clusters
 *
 * Stores icon names as strings (e.g., 'Brain') so they serialize to IndexedDB.
 * Renders the correct lucide component via the IDENTITY_ICONS map.
 */

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { zenTap } from "@/lib/animationUtils";
import {
  Brain,
  Heart,
  BookOpen,
  Dumbbell,
  Palette,
  Music,
  Sun,
  Moon,
  Leaf,
  Flame,
  Target,
  Sparkles,
  Coffee,
  Shield,
  GraduationCap,
  Briefcase,
  Users,
  Pencil,
  Eye,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Curated identity icons — small enough to not bloat the bundle */
export const IDENTITY_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "Brain", Icon: Brain },
  { name: "Heart", Icon: Heart },
  { name: "Dumbbell", Icon: Dumbbell },
  { name: "BookOpen", Icon: BookOpen },
  { name: "Leaf", Icon: Leaf },
  { name: "Flame", Icon: Flame },
  { name: "Target", Icon: Target },
  { name: "Sparkles", Icon: Sparkles },
  { name: "Palette", Icon: Palette },
  { name: "Music", Icon: Music },
  { name: "Sun", Icon: Sun },
  { name: "Moon", Icon: Moon },
  { name: "Coffee", Icon: Coffee },
  { name: "Shield", Icon: Shield },
  { name: "GraduationCap", Icon: GraduationCap },
  { name: "Briefcase", Icon: Briefcase },
  { name: "Users", Icon: Users },
  { name: "Pencil", Icon: Pencil },
  { name: "Eye", Icon: Eye },
  { name: "Star", Icon: Star },
];

const iconMap = new Map(IDENTITY_ICONS.map((i) => [i.name, i.Icon]));

/**
 * Renders a stored identity icon name as a lucide component.
 * Falls back to Target if name not found.
 */
export function IdentityIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap.get(name) || Target;
  return <Icon className={className} />;
}

interface IdentityIconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  isPrimaryCTA?: boolean;
}

export function IdentityIconPicker({
  value,
  onChange,
  isPrimaryCTA = false,
}: IdentityIconPickerProps) {
  const { t } = useLanguage();
  return (
    <div
      className="flex gap-1.5 flex-wrap"
      role="radiogroup"
      aria-label={t.identityIcon || "Identity icon"}
    >
      {IDENTITY_ICONS.map(({ name, Icon }) => (
        <motion.button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={name}
          onClick={(e) => {
            e.preventDefault();
            onChange(name);
          }}
          className={cn(
            "w-9 h-9 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center motion-safe:transition-all motion-safe:duration-200 cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            isPrimaryCTA
              ? value === name
                ? "bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40"
                : "bg-foreground/5 border border-foreground/10 hover:bg-foreground/10"
              : value === name
                ? "bg-primary/20 ring-2 ring-primary scale-105"
                : "bg-background hover:bg-muted hover:scale-105 border border-border/30"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={zenTap.button}
        >
          <Icon
            className={cn(
              "w-4 h-4",
              value === name
                ? isPrimaryCTA
                  ? "text-violet-300"
                  : "text-primary"
                : isPrimaryCTA
                  ? "text-foreground/50"
                  : "text-muted-foreground"
            )}
          />
        </motion.button>
      ))}
    </div>
  );
}
