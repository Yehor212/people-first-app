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
export type NavV2VisualPageLike = "orb" | "habits" | "diary" | "settings";

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

export const NON_ORB_ROLE_TONES: Record<NonOrbVisualRole, NonOrbRoleTone> = {
  body: {
    cssVar: "--zf-role-body",
    textClass: "text-[hsl(var(--zf-role-body))]",
    borderClass: "border-[hsl(var(--zf-role-body)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-body)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-body)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-body)/0.20)] bg-[hsl(var(--zf-role-body)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-body)/0.38)] bg-[hsl(var(--zf-role-body)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-body)/0.62)]",
    iconClass:
      "border-[hsl(var(--zf-role-body)/0.24)] bg-[hsl(var(--zf-role-body)/0.12)] text-[hsl(var(--zf-role-body))]",
    ringClass: "ring-[hsl(var(--zf-role-body)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-body)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-body)/0.22)] via-[hsl(var(--zf-role-body)/0.08)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-body)/0.62)]",
  },
  mind: {
    cssVar: "--zf-role-mind",
    textClass: "text-[hsl(var(--zf-role-mind))]",
    borderClass: "border-[hsl(var(--zf-role-mind)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-mind)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-mind)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-mind)/0.20)] bg-[hsl(var(--zf-role-mind)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-mind)/0.38)] bg-[hsl(var(--zf-role-mind)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-mind)/0.62)]",
    iconClass:
      "border-[hsl(var(--zf-role-mind)/0.24)] bg-[hsl(var(--zf-role-mind)/0.12)] text-[hsl(var(--zf-role-mind))]",
    ringClass: "ring-[hsl(var(--zf-role-mind)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-mind)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-mind)/0.22)] via-[hsl(var(--zf-role-mind)/0.08)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-mind)/0.62)]",
  },
  focus: {
    cssVar: "--zf-role-focus",
    textClass: "text-[hsl(var(--zf-role-focus))]",
    borderClass: "border-[hsl(var(--zf-role-focus)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-focus)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-focus)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-focus)/0.20)] bg-[hsl(var(--zf-role-focus)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-focus)/0.38)] bg-[hsl(var(--zf-role-focus)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-focus)/0.62)]",
    iconClass:
      "border-[hsl(var(--zf-role-focus)/0.24)] bg-[hsl(var(--zf-role-focus)/0.12)] text-[hsl(var(--zf-role-focus))]",
    ringClass: "ring-[hsl(var(--zf-role-focus)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-focus)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-focus)/0.22)] via-[hsl(var(--zf-role-focus)/0.08)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-focus)/0.62)]",
  },
  rest: {
    cssVar: "--zf-role-rest",
    textClass: "text-[hsl(var(--zf-role-rest))]",
    borderClass: "border-[hsl(var(--zf-role-rest)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-rest)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-rest)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-rest)/0.20)] bg-[hsl(var(--zf-role-rest)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-rest)/0.38)] bg-[hsl(var(--zf-role-rest)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-rest)/0.62)]",
    iconClass:
      "border-[hsl(var(--zf-role-rest)/0.24)] bg-[hsl(var(--zf-role-rest)/0.12)] text-[hsl(var(--zf-role-rest))]",
    ringClass: "ring-[hsl(var(--zf-role-rest)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-rest)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-rest)/0.22)] via-[hsl(var(--zf-role-rest)/0.08)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-rest)/0.62)]",
  },
  energy: {
    cssVar: "--zf-role-energy",
    textClass: "text-[hsl(var(--zf-role-energy))]",
    borderClass: "border-[hsl(var(--zf-role-energy)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-energy)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-energy)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-energy)/0.20)] bg-[hsl(var(--zf-role-energy)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-energy)/0.38)] bg-[hsl(var(--zf-role-energy)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-energy)/0.58)]",
    iconClass:
      "border-[hsl(var(--zf-role-energy)/0.24)] bg-[hsl(var(--zf-role-energy)/0.12)] text-[hsl(var(--zf-role-energy))]",
    ringClass: "ring-[hsl(var(--zf-role-energy)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-energy)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-energy)/0.20)] via-[hsl(var(--zf-role-energy)/0.07)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-energy)/0.62)]",
  },
  release: {
    cssVar: "--zf-role-release",
    textClass: "text-[hsl(var(--zf-role-release))]",
    borderClass: "border-[hsl(var(--zf-role-release)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-release)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-release)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-release)/0.20)] bg-[hsl(var(--zf-role-release)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-release)/0.38)] bg-[hsl(var(--zf-role-release)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-release)/0.58)]",
    iconClass:
      "border-[hsl(var(--zf-role-release)/0.24)] bg-[hsl(var(--zf-role-release)/0.12)] text-[hsl(var(--zf-role-release))]",
    ringClass: "ring-[hsl(var(--zf-role-release)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-release)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-release)/0.20)] via-[hsl(var(--zf-role-release)/0.07)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-release)/0.62)]",
  },
  diary: {
    cssVar: "--zf-role-diary",
    textClass: "text-[hsl(var(--zf-role-diary))]",
    borderClass: "border-[hsl(var(--zf-role-diary)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-diary)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-diary)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-diary)/0.20)] bg-[hsl(var(--zf-role-diary)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-diary)/0.38)] bg-[hsl(var(--zf-role-diary)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-diary)/0.62)]",
    iconClass:
      "border-[hsl(var(--zf-role-diary)/0.24)] bg-[hsl(var(--zf-role-diary)/0.12)] text-[hsl(var(--zf-role-diary))]",
    ringClass: "ring-[hsl(var(--zf-role-diary)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-diary)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-diary)/0.22)] via-[hsl(var(--zf-role-diary)/0.08)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-diary)/0.62)]",
  },
  space: {
    cssVar: "--zf-role-space",
    textClass: "text-[hsl(var(--zf-role-space))]",
    borderClass: "border-[hsl(var(--zf-role-space)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-space)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-space)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-space)/0.20)] bg-[hsl(var(--zf-role-space)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-space)/0.38)] bg-[hsl(var(--zf-role-space)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-space)/0.62)]",
    iconClass:
      "border-[hsl(var(--zf-role-space)/0.24)] bg-[hsl(var(--zf-role-space)/0.12)] text-[hsl(var(--zf-role-space))]",
    ringClass: "ring-[hsl(var(--zf-role-space)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-space)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-space)/0.22)] via-[hsl(var(--zf-role-space)/0.08)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-space)/0.62)]",
  },
  gratitude: {
    cssVar: "--zf-role-gratitude",
    textClass: "text-[hsl(var(--zf-role-gratitude))]",
    borderClass: "border-[hsl(var(--zf-role-gratitude)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-gratitude)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-gratitude)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-gratitude)/0.20)] bg-[hsl(var(--zf-role-gratitude)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-gratitude)/0.38)] bg-[hsl(var(--zf-role-gratitude)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-gratitude)/0.62)]",
    iconClass:
      "border-[hsl(var(--zf-role-gratitude)/0.24)] bg-[hsl(var(--zf-role-gratitude)/0.12)] text-[hsl(var(--zf-role-gratitude))]",
    ringClass: "ring-[hsl(var(--zf-role-gratitude)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-gratitude)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-gratitude)/0.22)] via-[hsl(var(--zf-role-gratitude)/0.08)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-gratitude)/0.62)]",
  },
  settings: {
    cssVar: "--zf-role-settings",
    textClass: "text-[hsl(var(--zf-role-settings))]",
    borderClass: "border-[hsl(var(--zf-role-settings)/0.28)]",
    bgClass: "bg-[hsl(var(--zf-role-settings)/0.12)]",
    softBgClass: "bg-[hsl(var(--zf-role-settings)/0.07)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-settings)/0.20)] bg-[hsl(var(--zf-role-settings)/0.08)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-settings)/0.38)] bg-[hsl(var(--zf-role-settings)/0.15)] shadow-[0_18px_46px_-30px_hsl(var(--zf-role-settings)/0.62)]",
    iconClass:
      "border-[hsl(var(--zf-role-settings)/0.24)] bg-[hsl(var(--zf-role-settings)/0.12)] text-[hsl(var(--zf-role-settings))]",
    ringClass: "ring-[hsl(var(--zf-role-settings)/0.30)]",
    railClass: "bg-[hsl(var(--zf-role-settings)/0.82)]",
    gradientClass:
      "from-[hsl(var(--zf-role-settings)/0.22)] via-[hsl(var(--zf-role-settings)/0.08)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-settings)/0.62)]",
  },
};

export const HABIT_ROLE_TONES: Record<NonOrbVisualRole, NonOrbRoleTone> = {
  body: {
    cssVar: "--zf-role-body",
    textClass: "text-[hsl(var(--zf-role-body))]",
    borderClass: "border-[hsl(var(--zf-role-body)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-body)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-body)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-body)/0.58)] bg-[hsl(var(--zf-role-body)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-body)/0.72)] bg-[hsl(var(--zf-role-body)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-body)/0.86)]",
    iconClass:
      "border-[hsl(var(--zf-role-body)/0.66)] bg-[hsl(var(--zf-role-body)/0.42)] text-[hsl(var(--zf-role-body))]",
    ringClass: "ring-[hsl(var(--zf-role-body)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-body)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-body)/0.62)] via-[hsl(var(--zf-role-body)/0.34)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-body)/0.72)]",
  },
  mind: {
    cssVar: "--zf-role-mind",
    textClass: "text-[hsl(var(--zf-role-mind))]",
    borderClass: "border-[hsl(var(--zf-role-mind)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-mind)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-mind)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-mind)/0.58)] bg-[hsl(var(--zf-role-mind)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-mind)/0.72)] bg-[hsl(var(--zf-role-mind)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-mind)/0.86)]",
    iconClass:
      "border-[hsl(var(--zf-role-mind)/0.66)] bg-[hsl(var(--zf-role-mind)/0.42)] text-[hsl(var(--zf-role-mind))]",
    ringClass: "ring-[hsl(var(--zf-role-mind)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-mind)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-mind)/0.62)] via-[hsl(var(--zf-role-mind)/0.34)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-mind)/0.72)]",
  },
  focus: {
    cssVar: "--zf-role-focus",
    textClass: "text-[hsl(var(--zf-role-focus))]",
    borderClass: "border-[hsl(var(--zf-role-focus)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-focus)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-focus)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-focus)/0.58)] bg-[hsl(var(--zf-role-focus)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-focus)/0.72)] bg-[hsl(var(--zf-role-focus)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-focus)/0.86)]",
    iconClass:
      "border-[hsl(var(--zf-role-focus)/0.66)] bg-[hsl(var(--zf-role-focus)/0.42)] text-[hsl(var(--zf-role-focus))]",
    ringClass: "ring-[hsl(var(--zf-role-focus)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-focus)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-focus)/0.62)] via-[hsl(var(--zf-role-focus)/0.34)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-focus)/0.72)]",
  },
  rest: {
    cssVar: "--zf-role-rest",
    textClass: "text-[hsl(var(--zf-role-rest))]",
    borderClass: "border-[hsl(var(--zf-role-rest)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-rest)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-rest)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-rest)/0.58)] bg-[hsl(var(--zf-role-rest)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-rest)/0.72)] bg-[hsl(var(--zf-role-rest)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-rest)/0.86)]",
    iconClass:
      "border-[hsl(var(--zf-role-rest)/0.66)] bg-[hsl(var(--zf-role-rest)/0.42)] text-[hsl(var(--zf-role-rest))]",
    ringClass: "ring-[hsl(var(--zf-role-rest)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-rest)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-rest)/0.62)] via-[hsl(var(--zf-role-rest)/0.34)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-rest)/0.72)]",
  },
  energy: {
    cssVar: "--zf-role-energy",
    textClass: "text-[hsl(var(--zf-role-energy))]",
    borderClass: "border-[hsl(var(--zf-role-energy)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-energy)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-energy)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-energy)/0.58)] bg-[hsl(var(--zf-role-energy)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-energy)/0.72)] bg-[hsl(var(--zf-role-energy)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-energy)/0.82)]",
    iconClass:
      "border-[hsl(var(--zf-role-energy)/0.66)] bg-[hsl(var(--zf-role-energy)/0.42)] text-[hsl(var(--zf-role-energy))]",
    ringClass: "ring-[hsl(var(--zf-role-energy)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-energy)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-energy)/0.58)] via-[hsl(var(--zf-role-energy)/0.32)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-energy)/0.72)]",
  },
  release: {
    cssVar: "--zf-role-release",
    textClass: "text-[hsl(var(--zf-role-release))]",
    borderClass: "border-[hsl(var(--zf-role-release)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-release)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-release)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-release)/0.58)] bg-[hsl(var(--zf-role-release)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-release)/0.72)] bg-[hsl(var(--zf-role-release)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-release)/0.82)]",
    iconClass:
      "border-[hsl(var(--zf-role-release)/0.66)] bg-[hsl(var(--zf-role-release)/0.42)] text-[hsl(var(--zf-role-release))]",
    ringClass: "ring-[hsl(var(--zf-role-release)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-release)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-release)/0.58)] via-[hsl(var(--zf-role-release)/0.32)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-release)/0.72)]",
  },
  diary: {
    cssVar: "--zf-role-diary",
    textClass: "text-[hsl(var(--zf-role-diary))]",
    borderClass: "border-[hsl(var(--zf-role-diary)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-diary)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-diary)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-diary)/0.58)] bg-[hsl(var(--zf-role-diary)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-diary)/0.72)] bg-[hsl(var(--zf-role-diary)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-diary)/0.86)]",
    iconClass:
      "border-[hsl(var(--zf-role-diary)/0.66)] bg-[hsl(var(--zf-role-diary)/0.42)] text-[hsl(var(--zf-role-diary))]",
    ringClass: "ring-[hsl(var(--zf-role-diary)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-diary)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-diary)/0.62)] via-[hsl(var(--zf-role-diary)/0.34)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-diary)/0.72)]",
  },
  space: {
    cssVar: "--zf-role-space",
    textClass: "text-[hsl(var(--zf-role-space))]",
    borderClass: "border-[hsl(var(--zf-role-space)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-space)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-space)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-space)/0.58)] bg-[hsl(var(--zf-role-space)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-space)/0.72)] bg-[hsl(var(--zf-role-space)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-space)/0.86)]",
    iconClass:
      "border-[hsl(var(--zf-role-space)/0.66)] bg-[hsl(var(--zf-role-space)/0.42)] text-[hsl(var(--zf-role-space))]",
    ringClass: "ring-[hsl(var(--zf-role-space)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-space)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-space)/0.62)] via-[hsl(var(--zf-role-space)/0.34)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-space)/0.72)]",
  },
  gratitude: {
    cssVar: "--zf-role-gratitude",
    textClass: "text-[hsl(var(--zf-role-gratitude))]",
    borderClass: "border-[hsl(var(--zf-role-gratitude)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-gratitude)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-gratitude)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-gratitude)/0.58)] bg-[hsl(var(--zf-role-gratitude)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-gratitude)/0.72)] bg-[hsl(var(--zf-role-gratitude)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-gratitude)/0.86)]",
    iconClass:
      "border-[hsl(var(--zf-role-gratitude)/0.66)] bg-[hsl(var(--zf-role-gratitude)/0.42)] text-[hsl(var(--zf-role-gratitude))]",
    ringClass: "ring-[hsl(var(--zf-role-gratitude)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-gratitude)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-gratitude)/0.62)] via-[hsl(var(--zf-role-gratitude)/0.34)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-gratitude)/0.72)]",
  },
  settings: {
    cssVar: "--zf-role-settings",
    textClass: "text-[hsl(var(--zf-role-settings))]",
    borderClass: "border-[hsl(var(--zf-role-settings)/0.66)]",
    bgClass: "bg-[hsl(var(--zf-role-settings)/0.34)]",
    softBgClass: "bg-[hsl(var(--zf-role-settings)/0.28)]",
    surfaceClass:
      "border-[hsl(var(--zf-role-settings)/0.58)] bg-[hsl(var(--zf-role-settings)/0.30)]",
    activeSurfaceClass:
      "border-[hsl(var(--zf-role-settings)/0.72)] bg-[hsl(var(--zf-role-settings)/0.48)] shadow-[0_22px_52px_-28px_hsl(var(--zf-role-settings)/0.86)]",
    iconClass:
      "border-[hsl(var(--zf-role-settings)/0.66)] bg-[hsl(var(--zf-role-settings)/0.42)] text-[hsl(var(--zf-role-settings))]",
    ringClass: "ring-[hsl(var(--zf-role-settings)/0.64)]",
    railClass: "bg-[hsl(var(--zf-role-settings)/0.92)]",
    gradientClass:
      "from-[hsl(var(--zf-role-settings)/0.62)] via-[hsl(var(--zf-role-settings)/0.34)] to-transparent",
    focusRingClass: "focus-visible:ring-[hsl(var(--zf-role-settings)/0.72)]",
  },
};

const HABIT_STARTER_PLAY_TONES: Record<string, HabitStarterPlayTone> = {
  "drink-water": {
    role: "focus",
    tileClass:
      "border-[hsl(var(--zf-role-focus)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-focus)/0.90),hsl(var(--zf-role-space)/0.58)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-focus)/0.96)]",
    iconClass:
      "border-[hsl(var(--zf-role-focus)/0.92)] bg-[hsl(var(--zf-role-focus)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass: "bg-[hsl(var(--zf-role-focus))] shadow-[0_0_16px_hsl(var(--zf-role-focus)/0.74)]",
    haloClass: "bg-[hsl(var(--zf-role-focus)/0.22)]",
  },
  "walk-run": {
    role: "body",
    tileClass:
      "border-[hsl(var(--zf-role-body)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-body)/0.90),hsl(var(--zf-role-gratitude)/0.56)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-body)/0.96)]",
    iconClass:
      "border-[hsl(var(--zf-role-body)/0.92)] bg-[hsl(var(--zf-role-body)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass: "bg-[hsl(var(--zf-role-body))] shadow-[0_0_16px_hsl(var(--zf-role-body)/0.74)]",
    haloClass: "bg-[hsl(var(--zf-role-body)/0.22)]",
  },
  "walk-distance": {
    role: "body",
    tileClass:
      "border-[hsl(var(--zf-role-body)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-body)/0.90),hsl(var(--zf-role-energy)/0.50)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-body)/0.96)]",
    iconClass:
      "border-[hsl(var(--zf-role-body)/0.92)] bg-[hsl(var(--zf-role-body)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass: "bg-[hsl(var(--zf-role-body))] shadow-[0_0_16px_hsl(var(--zf-role-body)/0.74)]",
    haloClass: "bg-[hsl(var(--zf-role-body)/0.22)]",
  },
  exercise: {
    role: "energy",
    tileClass:
      "border-[hsl(var(--zf-role-energy)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-energy)/0.88),hsl(var(--zf-role-body)/0.56)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-energy)/0.94)]",
    iconClass:
      "border-[hsl(var(--zf-role-energy)/0.90)] bg-[hsl(var(--zf-role-energy)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass:
      "bg-[hsl(var(--zf-role-energy))] shadow-[0_0_16px_hsl(var(--zf-role-energy)/0.72)]",
    haloClass: "bg-[hsl(var(--zf-role-energy)/0.22)]",
  },
  read: {
    role: "focus",
    tileClass:
      "border-[hsl(var(--zf-role-focus)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-focus)/0.88),hsl(var(--zf-role-diary)/0.56)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-focus)/0.94)]",
    iconClass:
      "border-[hsl(var(--zf-role-focus)/0.90)] bg-[hsl(var(--zf-role-focus)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass: "bg-[hsl(var(--zf-role-focus))] shadow-[0_0_16px_hsl(var(--zf-role-focus)/0.72)]",
    haloClass: "bg-[hsl(var(--zf-role-focus)/0.22)]",
  },
  meditate: {
    role: "mind",
    tileClass:
      "border-[hsl(var(--zf-role-mind)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-mind)/0.88),hsl(var(--zf-role-rest)/0.54)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-mind)/0.94)]",
    iconClass:
      "border-[hsl(var(--zf-role-mind)/0.90)] bg-[hsl(var(--zf-role-mind)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass: "bg-[hsl(var(--zf-role-mind))] shadow-[0_0_16px_hsl(var(--zf-role-mind)/0.72)]",
    haloClass: "bg-[hsl(var(--zf-role-mind)/0.22)]",
  },
  sleep: {
    role: "rest",
    tileClass:
      "border-[hsl(var(--zf-role-rest)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-rest)/0.88),hsl(var(--zf-role-space)/0.56)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-rest)/0.94)]",
    iconClass:
      "border-[hsl(var(--zf-role-rest)/0.90)] bg-[hsl(var(--zf-role-rest)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass: "bg-[hsl(var(--zf-role-rest))] shadow-[0_0_16px_hsl(var(--zf-role-rest)/0.72)]",
    haloClass: "bg-[hsl(var(--zf-role-rest)/0.22)]",
  },
  stretch: {
    role: "release",
    tileClass:
      "border-[hsl(var(--zf-role-release)/0.88)] bg-[linear-gradient(145deg,hsl(var(--zf-role-release)/0.88),hsl(var(--zf-role-energy)/0.52)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-release)/0.94)]",
    iconClass:
      "border-[hsl(var(--zf-role-release)/0.90)] bg-[hsl(var(--zf-role-release)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass:
      "bg-[hsl(var(--zf-role-release))] shadow-[0_0_16px_hsl(var(--zf-role-release)/0.70)]",
    haloClass: "bg-[hsl(var(--zf-role-release)/0.22)]",
  },
  "read-page": {
    role: "diary",
    tileClass:
      "border-[hsl(var(--zf-role-diary)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-diary)/0.88),hsl(var(--zf-role-rest)/0.56)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-diary)/0.96)]",
    iconClass:
      "border-[hsl(var(--zf-role-diary)/0.92)] bg-[hsl(var(--zf-role-diary)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass: "bg-[hsl(var(--zf-role-diary))] shadow-[0_0_16px_hsl(var(--zf-role-diary)/0.74)]",
    haloClass: "bg-[hsl(var(--zf-role-diary)/0.22)]",
  },
  "breath-pause": {
    role: "rest",
    tileClass:
      "border-[hsl(var(--zf-role-rest)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-rest)/0.88),hsl(var(--zf-role-mind)/0.56)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-rest)/0.94)]",
    iconClass:
      "border-[hsl(var(--zf-role-rest)/0.92)] bg-[hsl(var(--zf-role-rest)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass: "bg-[hsl(var(--zf-role-rest))] shadow-[0_0_16px_hsl(var(--zf-role-rest)/0.72)]",
    haloClass: "bg-[hsl(var(--zf-role-rest)/0.22)]",
  },
  gratitude: {
    role: "gratitude",
    tileClass:
      "border-[hsl(var(--zf-role-gratitude)/0.90)] bg-[linear-gradient(145deg,hsl(var(--zf-role-gratitude)/0.88),hsl(var(--zf-role-release)/0.50)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-gratitude)/0.96)]",
    iconClass:
      "border-[hsl(var(--zf-role-gratitude)/0.92)] bg-[hsl(var(--zf-role-gratitude)/0.30)] text-[hsl(var(--zf-text-strong))]",
    proofClass:
      "bg-[hsl(var(--zf-role-gratitude))] shadow-[0_0_16px_hsl(var(--zf-role-gratitude)/0.72)]",
    haloClass: "bg-[hsl(var(--zf-role-gratitude)/0.22)]",
  },
};

const DEFAULT_HABIT_STARTER_PLAY_TONE: HabitStarterPlayTone = {
  role: "space",
  tileClass:
    "border-[hsl(var(--zf-role-space)/0.86)] bg-[linear-gradient(145deg,hsl(var(--zf-role-space)/0.82),hsl(var(--zf-role-diary)/0.50)_56%,hsl(var(--zf-night-0)/0.42))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16),0_20px_52px_-28px_hsl(var(--zf-role-space)/0.90)]",
  iconClass:
    "border-[hsl(var(--zf-role-space)/0.88)] bg-[hsl(var(--zf-role-space)/0.30)] text-[hsl(var(--zf-text-strong))]",
  proofClass: "bg-[hsl(var(--zf-role-space))] shadow-[0_0_16px_hsl(var(--zf-role-space)/0.70)]",
  haloClass: "bg-[hsl(var(--zf-role-space)/0.22)]",
};

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

export function getHabitCategoryVisualRole(
  category?: HabitCategoryLike | null,
): NonOrbVisualRole {
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
  category: HabitTemplateCategoryLike,
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

const USER_SPACE_ROLES: NonOrbVisualRole[] = [
  "space",
  "diary",
  "focus",
  "mind",
  "release",
  "rest",
];

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

  return USER_SPACE_ROLES[hashString(`${space.id}:${space.coverKey ?? ""}`) % USER_SPACE_ROLES.length];
}
