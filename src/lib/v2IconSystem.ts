import {
  AlarmClockCheck,
  BadgeCheck,
  BadgePlus,
  BookOpenCheck,
  BookMarked,
  ChartSpline,
  CircleFadingPlus,
  CirclePlus,
  Coffee,
  Dumbbell,
  Droplets,
  GlassWater,
  Flower2,
  FolderHeart,
  FolderOpen,
  FolderPlus,
  Footprints,
  Goal,
  HeartPulse,
  LibraryBig,
  MapPinned,
  Menu,
  NotebookPen,
  OctagonAlert,
  PaintbrushVertical,
  PenLine,
  PersonStanding,
  Route,
  SlidersHorizontal,
  Smartphone,
  SmartphoneNfc,
  SunMedium,
  Sprout,
  TextCursorInput,
  WandSparkles,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { NavV2Page } from "@/hooks/useNavigationV2";

export const V2_NAV_ICONS: Record<NavV2Page, LucideIcon> = {
  orb: HeartPulse,
  habits: Sprout,
  diary: NotebookPen,
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
} satisfies Record<string, LucideIcon>;

export const V2_HABIT_TEMPLATE_ICONS: Record<string, LucideIcon> = {
  "drink-water": GlassWater,
  water: Droplets,
  "walk-run": Footprints,
  stretch: PersonStanding,
  exercise: Dumbbell,
  "healthy-food": Sprout,
  vitamins: BadgePlus,
  "brush-teeth": BadgeCheck,
  sunlight: SunMedium,
  "touch-grass": Sprout,
  "movement-break": PersonStanding,
  protein: Sprout,
  meditate: HeartPulse,
  journal: NotebookPen,
  gratitude: Flower2,
  "breath-pause": Wind,
  breathwork: Wind,
  "read-page": BookOpenCheck,
  read: BookOpenCheck,
  "learn-english": TextCursorInput,
  "phone-break": SmartphoneNfc,
  "phone-free-morning": Smartphone,
  "deep-work": Goal,
  "no-doomscroll": SmartphoneNfc,
  sleep: AlarmClockCheck,
  "delayed-caffeine": Coffee,
  "tidy-room": WandSparkles,
  "walk-distance": Footprints,
  "quit-smoking": Wind,
  "quit-drinking": Droplets,
  "smoking-limit": Wind,
  "alcohol-limit": Droplets,
};

export const V2_HABIT_TEMPLATE_SYMBOLS: Record<string, string> = {
  "drink-water": "💧",
  water: "🥤",
  "walk-run": "👟",
  stretch: "🧘",
  exercise: "🏋️",
  "healthy-food": "🥗",
  vitamins: "💊",
  "brush-teeth": "🪥",
  sunlight: "🌤️",
  "touch-grass": "🌿",
  "movement-break": "🚶",
  protein: "🥚",
  meditate: "🪷",
  journal: "✍️",
  gratitude: "🙏",
  "breath-pause": "🌬️",
  breathwork: "🫁",
  "read-page": "📖",
  read: "📚",
  "learn-english": "💬",
  "phone-break": "📵",
  "phone-free-morning": "🌅",
  "deep-work": "🎧",
  "no-doomscroll": "📵",
  sleep: "🛏️",
  "delayed-caffeine": "☕",
  "tidy-room": "🧹",
  "walk-distance": "🥾",
  "quit-smoking": "🚭",
  "quit-drinking": "🫗",
  "smoking-limit": "🕯️",
  "alcohol-limit": "🍷",
};

export function getV2HabitTemplateIcon(templateId: string): LucideIcon {
  return V2_HABIT_TEMPLATE_ICONS[templateId] ?? V2_SHELL_ICONS.insight;
}

export function getV2HabitTemplateSymbol(templateId: string): string {
  return V2_HABIT_TEMPLATE_SYMBOLS[templateId] ?? "✨";
}

export const V2_SETTINGS_ICONS = {
  appearance: PaintbrushVertical,
  notifications: AlarmClockCheck,
  privacy: BadgeCheck,
} satisfies Record<string, LucideIcon>;
