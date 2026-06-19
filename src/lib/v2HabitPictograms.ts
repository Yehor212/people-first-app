export type V2HabitPictogramId =
  | "drink-water"
  | "walk-distance"
  | "exercise"
  | "read"
  | "meditate"
  | "sleep"
  | "stretch"
  | "healthy-food"
  | "vitamins"
  | "brush-teeth"
  | "sunlight"
  | "touch-grass"
  | "protein"
  | "journal"
  | "gratitude"
  | "breathwork"
  | "phone-break"
  | "deep-work"
  | "tidy-room"
  | "quit-smoking"
  | "quit-drinking"
  | "focus";

export type V2HabitPictogramFamily =
  | "water"
  | "walk"
  | "energy"
  | "read"
  | "mind"
  | "sleep"
  | "leaf"
  | "nutrition"
  | "care"
  | "sun"
  | "journal"
  | "gratitude"
  | "breath"
  | "phone"
  | "focus"
  | "tidy"
  | "release";

const TEMPLATE_TO_PICTOGRAM: Record<string, V2HabitPictogramId> = {
  "drink-water": "drink-water",
  water: "drink-water",
  "walk-run": "walk-distance",
  "walk-distance": "walk-distance",
  "movement-break": "walk-distance",
  exercise: "exercise",
  stretch: "stretch",
  "healthy-food": "healthy-food",
  protein: "protein",
  vitamins: "vitamins",
  "brush-teeth": "brush-teeth",
  sunlight: "sunlight",
  "touch-grass": "touch-grass",
  meditate: "meditate",
  journal: "journal",
  gratitude: "gratitude",
  "breath-pause": "breathwork",
  breathwork: "breathwork",
  "read-page": "read",
  read: "read",
  "learn-english": "read",
  "phone-break": "phone-break",
  "phone-free-morning": "sunlight",
  "no-doomscroll": "phone-break",
  "deep-work": "deep-work",
  sleep: "sleep",
  "delayed-caffeine": "focus",
  "tidy-room": "tidy-room",
  "quit-smoking": "quit-smoking",
  "smoking-limit": "quit-smoking",
  "quit-drinking": "quit-drinking",
  "alcohol-limit": "quit-drinking",
};

const ICON_ALIASES: Record<string, V2HabitPictogramId> = {
  leaf: "touch-grass",
  leaves: "touch-grass",
  sprout: "touch-grass",
  seed: "touch-grass",
  water: "drink-water",
  droplet: "drink-water",
  droplets: "drink-water",
  glasswater: "drink-water",
  glass: "drink-water",
  hydrate: "drink-water",
  walk: "walk-distance",
  run: "walk-distance",
  route: "walk-distance",
  footprints: "walk-distance",
  personstanding: "stretch",
  body: "exercise",
  dumbbell: "exercise",
  strength: "exercise",
  book: "read",
  books: "read",
  bookopen: "read",
  bookopencheck: "read",
  reading: "read",
  mind: "meditate",
  mindfulness: "meditate",
  heartpulse: "meditate",
  lotus: "meditate",
  moon: "sleep",
  rest: "sleep",
  alarmclockcheck: "sleep",
  wind: "breathwork",
  breathe: "breathwork",
  breathing: "breathwork",
  flower: "gratitude",
  flower2: "gratitude",
  sparkles: "gratitude",
  gratitude: "gratitude",
  notebookpen: "journal",
  penline: "journal",
  pencil: "journal",
  smartphone: "phone-break",
  smartphonenfc: "phone-break",
  phone: "phone-break",
  focus: "deep-work",
  goal: "deep-work",
  target: "deep-work",
  coffee: "focus",
  caffeine: "focus",
  sun: "sunlight",
  sunmedium: "sunlight",
  nutrition: "healthy-food",
  food: "healthy-food",
  vitamins: "vitamins",
  pill: "vitamins",
  brush: "brush-teeth",
  teeth: "brush-teeth",
  tidy: "tidy-room",
  clean: "tidy-room",
  release: "quit-smoking",
};

const EMOJI_ALIASES = new Map<string, V2HabitPictogramId>([
  ["💧", "drink-water"],
  ["🥤", "drink-water"],
  ["🚶", "walk-distance"],
  ["🏃", "walk-distance"],
  ["👟", "walk-distance"],
  ["🥾", "walk-distance"],
  ["🤸", "stretch"],
  ["🧘", "meditate"],
  ["🪷", "meditate"],
  ["🏋️", "exercise"],
  ["💪", "exercise"],
  ["🥗", "healthy-food"],
  ["🥚", "protein"],
  ["💊", "vitamins"],
  ["🪥", "brush-teeth"],
  ["🌅", "sunlight"],
  ["🌤️", "sunlight"],
  ["🌿", "touch-grass"],
  ["✍️", "journal"],
  ["📝", "journal"],
  ["🙏", "gratitude"],
  ["✨", "gratitude"],
  ["🌬️", "breathwork"],
  ["🫁", "breathwork"],
  ["📖", "read"],
  ["📚", "read"],
  ["💬", "read"],
  ["📵", "phone-break"],
  ["🎧", "deep-work"],
  ["🎯", "deep-work"],
  ["🛏️", "sleep"],
  ["😴", "sleep"],
  ["☕", "focus"],
  ["🧹", "tidy-room"],
  ["🚭", "quit-smoking"],
  ["🚬", "quit-smoking"],
  ["🕯️", "quit-smoking"],
  ["🍷", "quit-drinking"],
  ["🫗", "quit-drinking"],
  ["🎵", "focus"],
  ["🧠", "meditate"],
]);

const PICTOGRAM_FAMILIES: Record<V2HabitPictogramId, V2HabitPictogramFamily> = {
  "drink-water": "water",
  "walk-distance": "walk",
  exercise: "energy",
  read: "read",
  meditate: "mind",
  sleep: "sleep",
  stretch: "leaf",
  "healthy-food": "nutrition",
  protein: "nutrition",
  vitamins: "care",
  "brush-teeth": "care",
  sunlight: "sun",
  "touch-grass": "leaf",
  journal: "journal",
  gratitude: "gratitude",
  breathwork: "breath",
  "phone-break": "phone",
  "deep-work": "focus",
  "tidy-room": "tidy",
  "quit-smoking": "release",
  "quit-drinking": "release",
  focus: "focus",
};

function normalizeIconKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function isProbablyEmojiGlyph(value?: string): boolean {
  const raw = (value ?? "").trim();
  if (!raw) return false;
  if (EMOJI_ALIASES.has(raw)) return true;
  return Array.from(raw).some((char) => char.charCodeAt(0) > 127);
}

export function resolveV2HabitPictogramId(value?: string): V2HabitPictogramId {
  const raw = (value ?? "").trim();
  if (!raw) return "focus";
  const emojiAlias = EMOJI_ALIASES.get(raw);
  if (emojiAlias) return emojiAlias;
  const key = normalizeIconKey(raw);
  return TEMPLATE_TO_PICTOGRAM[key] ?? ICON_ALIASES[key] ?? "focus";
}

export function hasV2HabitPictogram(value?: string): boolean {
  const raw = (value ?? "").trim();
  if (!raw) return false;
  if (EMOJI_ALIASES.has(raw)) return true;
  const key = normalizeIconKey(raw);
  return key in TEMPLATE_TO_PICTOGRAM || key in ICON_ALIASES;
}

export function getV2HabitTemplatePictogramId(templateId: string): V2HabitPictogramId {
  return resolveV2HabitPictogramId(templateId);
}

export function getV2HabitPictogramFamily(id: V2HabitPictogramId): V2HabitPictogramFamily {
  return PICTOGRAM_FAMILIES[id];
}
