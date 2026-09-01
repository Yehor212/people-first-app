import {
  AlarmClockCheck,
  BadgeCheck,
  BadgePlus,
  BookMarked,
  CalendarClock,
  ChartSpline,
  CircleFadingPlus,
  CirclePlus,
  Flower2,
  FolderHeart,
  FolderOpen,
  FolderPlus,
  Goal,
  HeartPulse,
  LibraryBig,
  MapPinned,
  Menu,
  MoreHorizontal,
  NotebookPen,
  OctagonAlert,
  PaintbrushVertical,
  PenLine,
  Route,
  SlidersHorizontal,
  Sprout,
  TextCursorInput,
  WandSparkles,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { NavV2Page } from "@/hooks/useNavigationV2";
import { getV2HabitTemplatePictogramId } from "@/lib/v2HabitPictograms";

export const V2_NAV_ICONS: Record<NavV2Page, LucideIcon> = {
  orb: HeartPulse,
  habits: Sprout,
  diary: NotebookPen,
  planning: CalendarClock,
  settings: SlidersHorizontal,
};

export const V2_SHELL_ICONS = {
  menu: Menu,
  add: CirclePlus,
  confirm: BadgeCheck,
  insight: WandSparkles,
  warning: OctagonAlert,
  trend: ChartSpline,
} satisfies Record<string, LucideIcon>;

export const V2_JOURNAL_ICONS = {
  createFolder: FolderPlus,
  openFolder: FolderOpen,
  gratitudeFolder: FolderHeart,
  gratitude: Flower2,
  entry: BookMarked,
  newEntry: PenLine,
  prompt: TextCursorInput,
  quietRelease: Wind,
} satisfies Record<string, LucideIcon>;

export const V2_HABIT_JOURNEY_ICONS = {
  identity: HeartPulse,
  cue: MapPinned,
  repeat: CircleFadingPlus,
  gratitude: Flower2,
  library: LibraryBig,
  create: BadgePlus,
  reminder: AlarmClockCheck,
  focus: Goal,
  route: Route,
  actions: MoreHorizontal,
} satisfies Record<string, LucideIcon>;

const V2_HABIT_TEMPLATE_IDS = [
  "drink-water",
  "water",
  "walk-run",
  "stretch",
  "exercise",
  "healthy-food",
  "vitamins",
  "brush-teeth",
  "sunlight",
  "touch-grass",
  "movement-break",
  "protein",
  "meditate",
  "journal",
  "gratitude",
  "breath-pause",
  "breathwork",
  "read-page",
  "read",
  "learn-english",
  "phone-break",
  "phone-free-morning",
  "deep-work",
  "no-doomscroll",
  "sleep",
  "delayed-caffeine",
  "tidy-room",
  "walk-distance",
  "quit-smoking",
  "quit-drinking",
  "smoking-limit",
  "alcohol-limit",
] as const;

export const V2_HABIT_TEMPLATE_SYMBOLS: Record<string, string> = Object.fromEntries(
  V2_HABIT_TEMPLATE_IDS.map((templateId) => [templateId, getV2HabitTemplatePictogramId(templateId)])
);

export function getV2HabitTemplateSymbol(templateId: string): string {
  return V2_HABIT_TEMPLATE_SYMBOLS[templateId] ?? getV2HabitTemplatePictogramId(templateId);
}

export const V2_SETTINGS_ICONS = {
  appearance: PaintbrushVertical,
  notifications: AlarmClockCheck,
  privacy: BadgeCheck,
} satisfies Record<string, LucideIcon>;
