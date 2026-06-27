export type NonOrbVisualRole =
  | "body"
  | "mind"
  | "focus"
  | "rest"
  | "energy"
  | "release"
  | "diary"
  | "space"
  | "gratitude"
  | "settings";

export type HabitCategoryLike =
  | "health"
  | "mindfulness"
  | "productivity"
  | "social"
  | "creativity"
  | "finance"
  | "self-care"
  | "other";

export type HabitTemplateCategoryLike = "body" | "mind" | "focus" | "rest" | "quit";
export type TimeOfDayLike = "morning" | "afternoon" | "evening" | "anytime";
export type NavV2VisualPageLike = "orb" | "habits" | "diary" | "planning" | "settings";

export interface NonOrbRoleTone {
  cssVar: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
  softBgClass: string;
  surfaceClass: string;
  activeSurfaceClass: string;
  iconClass: string;
  ringClass: string;
  railClass: string;
  gradientClass: string;
  focusRingClass: string;
}

export interface HabitStarterPlayTone {
  role: NonOrbVisualRole;
  tileClass: string;
  iconClass: string;
  proofClass: string;
  haloClass: string;
}

export interface RoleStyleVars {
  "--habit-role": string;
}

const VISUAL_ROLES: NonOrbVisualRole[] = [
  "body",
  "mind",
  "focus",
  "rest",
  "energy",
  "release",
  "diary",
  "space",
  "gratitude",
  "settings",
];

const ROLE_CSS_VARS: Record<NonOrbVisualRole, string> = {
  body: "--zf-role-body",
  mind: "--zf-role-mind",
  focus: "--zf-role-focus",
  rest: "--zf-role-rest",
  energy: "--zf-role-energy",
  release: "--zf-role-release",
  diary: "--zf-role-diary",
  space: "--zf-role-space",
  gratitude: "--zf-role-gratitude",
  settings: "--zf-role-settings",
};

function createRoleTone(
  role: NonOrbVisualRole,
  prefix: "zf-role" | "zf-habit-role"
): NonOrbRoleTone {
  return {
    cssVar: ROLE_CSS_VARS[role],
    textClass: "zf-role-text",
    borderClass: `${prefix}-border`,
    bgClass: `${prefix}-bg`,
    softBgClass: `${prefix}-bg-soft`,
    surfaceClass: `${prefix}-surface`,
    activeSurfaceClass: `${prefix}-surface-active`,
    iconClass: `${prefix}-icon`,
    ringClass: `${prefix}-ring`,
    railClass: `${prefix}-rail`,
    gradientClass: `${prefix}-gradient`,
    focusRingClass: `${prefix}-focus-ring`,
  };
}

function createRoleToneRecord(
  prefix: "zf-role" | "zf-habit-role"
): Record<NonOrbVisualRole, NonOrbRoleTone> {
  return Object.fromEntries(
    VISUAL_ROLES.map((role) => [role, createRoleTone(role, prefix)])
  ) as Record<NonOrbVisualRole, NonOrbRoleTone>;
}

export const NON_ORB_ROLE_TONES: Record<NonOrbVisualRole, NonOrbRoleTone> =
  createRoleToneRecord("zf-role");

export const HABIT_ROLE_TONES: Record<NonOrbVisualRole, NonOrbRoleTone> =
  createRoleToneRecord("zf-habit-role");

function createHabitStarterPlayTone(role: NonOrbVisualRole): HabitStarterPlayTone {
  return {
    role,
    tileClass: "zf-habit-starter-tile",
    iconClass: "zf-habit-starter-icon",
    proofClass: "zf-habit-starter-proof",
    haloClass: "zf-habit-starter-halo",
  };
}

const HABIT_STARTER_PLAY_ROLE: Record<string, NonOrbVisualRole> = {
  "drink-water": "focus",
  "walk-run": "body",
  "walk-distance": "body",
  exercise: "energy",
  read: "focus",
  meditate: "mind",
  sleep: "rest",
  stretch: "release",
  "read-page": "diary",
  "breath-pause": "rest",
  gratitude: "gratitude",
};

const HABIT_STARTER_PLAY_TONES: Record<string, HabitStarterPlayTone> = Object.fromEntries(
  Object.entries(HABIT_STARTER_PLAY_ROLE).map(([templateId, role]) => [
    templateId,
    createHabitStarterPlayTone(role),
  ])
);

const DEFAULT_HABIT_STARTER_PLAY_TONE = createHabitStarterPlayTone("space");

export function getHabitStarterPlayTone(templateId: string): HabitStarterPlayTone {
  return HABIT_STARTER_PLAY_TONES[templateId] ?? DEFAULT_HABIT_STARTER_PLAY_TONE;
}

export function getRoleTone(role: NonOrbVisualRole): NonOrbRoleTone {
  return NON_ORB_ROLE_TONES[role];
}

export function getHabitRoleTone(role: NonOrbVisualRole): NonOrbRoleTone {
  return HABIT_ROLE_TONES[role];
}

export function getRoleCssVar(role: NonOrbVisualRole): string {
  return NON_ORB_ROLE_TONES[role].cssVar;
}

export function getRoleStyleVars(role: NonOrbVisualRole): RoleStyleVars {
  return { "--habit-role": `var(${getRoleCssVar(role)})` };
}

export function getRoleHsl(role: NonOrbVisualRole, alpha?: number): string {
  const cssVar = getRoleCssVar(role);
  return alpha == null ? `hsl(var(${cssVar}))` : `hsl(var(${cssVar}) / ${alpha})`;
}

export function getHabitCategoryVisualRole(category?: HabitCategoryLike | null): NonOrbVisualRole {
  switch (category) {
    case "health":
      return "body";
    case "mindfulness":
      return "mind";
    case "productivity":
    case "finance":
      return "focus";
    case "self-care":
      return "rest";
    case "creativity":
      return "release";
    case "social":
      return "mind";
    case "other":
    default:
      return "space";
  }
}

export function getHabitVisualRole(habit: {
  category?: HabitCategoryLike | null;
  name?: string;
  habitType?: string;
}): NonOrbVisualRole {
  if (habit.category) return getHabitCategoryVisualRole(habit.category);

  const name = habit.name?.toLowerCase() ?? "";
  if (/\b(water|walk|run|sleep|cold|body|health|drink)\b/.test(name)) return "body";
  if (/\b(meditat|gratitude|journal|pray|breath|mind)\b/.test(name)) return "mind";
  if (/\b(work|focus|phone|read|study|plan)\b/.test(name)) return "focus";
  if (/\b(rest|recover|sleep|pause)\b/.test(name)) return "rest";
  if (/\b(create|draw|write|music|idea)\b/.test(name)) return "release";
  return habit.habitType === "numerical" ? "body" : "space";
}

export function getTemplateCategoryVisualRole(
  category: HabitTemplateCategoryLike
): NonOrbVisualRole {
  switch (category) {
    case "body":
      return "body";
    case "mind":
      return "mind";
    case "focus":
      return "focus";
    case "rest":
      return "rest";
    case "quit":
      return "release";
  }
}

export function getTimeOfDayVisualRole(bucket: TimeOfDayLike | string): NonOrbVisualRole {
  switch (bucket) {
    case "morning":
      return "energy";
    case "afternoon":
      return "focus";
    case "evening":
      return "rest";
    case "anytime":
    default:
      return "body";
  }
}

export function getNavVisualRole(page: NavV2VisualPageLike): NonOrbVisualRole {
  switch (page) {
    case "orb":
      return "mind";
    case "habits":
      return "body";
    case "diary":
      return "diary";
    case "planning":
      return "focus";
    case "settings":
      return "settings";
  }
}

const ACCENT_ROLE: Record<string, NonOrbVisualRole> = {
  primary: "space",
  mint: "gratitude",
  amber: "energy",
  rose: "release",
  violet: "diary",
  sky: "focus",
};

const COVER_ROLE: Record<string, NonOrbVisualRole> = {
  gratitude: "gratitude",
  garden: "gratitude",
  sprout: "gratitude",
  leaf: "gratitude",
  projects: "focus",
  project: "focus",
  briefcase: "focus",
  folder: "space",
  memory: "diary",
  journal: "diary",
  moon: "rest",
  private: "rest",
  ideas: "release",
  idea: "release",
  creative: "release",
};

const USER_SPACE_ROLES: NonOrbVisualRole[] = ["space", "diary", "focus", "mind", "release", "rest"];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getSpaceVisualRole(space: {
  id: string;
  autoSource?: "gratitude";
  private?: boolean;
  coverKey?: string;
  accent?: string;
  iconKey?: string;
}): NonOrbVisualRole {
  if (
    space.id === "space-gratitude" ||
    space.autoSource === "gratitude" ||
    space.coverKey === "gratitude"
  ) {
    return "gratitude";
  }
  if (space.private || space.coverKey === "private" || space.iconKey === "moon") return "rest";

  const coverRole = space.coverKey ? COVER_ROLE[space.coverKey] : undefined;
  if (coverRole && coverRole !== "space") return coverRole;

  const accentRole = space.accent ? ACCENT_ROLE[space.accent] : undefined;
  if (accentRole && accentRole !== "space") return accentRole;

  return USER_SPACE_ROLES[
    hashString(`${space.id}:${space.coverKey ?? ""}`) % USER_SPACE_ROLES.length
  ];
}
