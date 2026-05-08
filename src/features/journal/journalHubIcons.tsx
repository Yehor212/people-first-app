import {
  BookMarked,
  BriefcaseBusiness,
  Compass,
  Feather,
  FolderOpen,
  Heart,
  Leaf,
  Lightbulb,
  Moon,
  PenLine,
  Sparkles,
  Sprout,
  Target,
  Timer,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { JournalIconKey } from "./types";

export const JOURNAL_ICON_MAP: Record<JournalIconKey, LucideIcon> = {
  bookOpen: BookMarked,
  briefcase: BriefcaseBusiness,
  compass: Compass,
  feather: Feather,
  flame: Wind,
  folder: FolderOpen,
  heart: Heart,
  leaf: Leaf,
  lightbulb: Lightbulb,
  moon: Moon,
  penLine: PenLine,
  sparkles: Sparkles,
  sprout: Sprout,
  target: Target,
  timer: Timer,
  waves: Waves,
};

export function getJournalIcon(iconKey: JournalIconKey): LucideIcon {
  return JOURNAL_ICON_MAP[iconKey] ?? PenLine;
}
