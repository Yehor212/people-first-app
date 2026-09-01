import { uiPreviewFixtureBoundary, type UiPreviewFixtureLocale } from "./fixtures";

export const UI_PREVIEW_COMPONENTS = [
  "BUTTON",
  "ICON_BUTTON",
  "LINK",
  "FIELD",
  "SELECTION_CONTROL",
  "STATUS",
  "SETTINGS_ROW",
  "EMPTY_ERROR_OFFLINE",
] as const;

export const UI_PREVIEW_STATES = [
  "default",
  "hover",
  "focus-visible",
  "pressed",
  "selected",
  "checked",
  "disabled",
  "loading",
  "success",
  "warning",
  "error",
  "destructive",
  "offline",
  "permission-blocked",
  "pending-sync",
  "long-content",
  "rtl",
  "high-contrast",
  "reduced-motion",
  "recovery",
] as const;

export const UI_PREVIEW_FOUNDATIONS = [
  "color-roles",
  "typography-roles",
  "spacing-scale",
  "radius-scale",
  "elevation-scale",
  "focus-contract",
  "target-contract",
  "motion-contract",
  "container-contract",
] as const;

export interface UiPreviewCase {
  id: string;
  component: string;
  state: string;
  locale: "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";
  width: number;
  input: "keyboard" | "pointer" | "touch";
  reducedMotion: boolean;
  source: string;
  evidenceKind: "PRODUCTION_COMPONENT" | "NATIVE_ELEMENT" | "CONTRACT_PATTERN";
  stateMechanism: "runtime-pseudo" | "semantic-state" | "cross-cutting-context" | "static-contract";
}

export type UiPreviewComponent = (typeof UI_PREVIEW_COMPONENTS)[number];
export type UiPreviewState = (typeof UI_PREVIEW_STATES)[number];
export type UiPreviewFoundation = (typeof UI_PREVIEW_FOUNDATIONS)[number];
export type UiPreviewTheme = "paper" | "ink" | "oled" | "high-contrast";
export type UiPreviewInput = UiPreviewCase["input"];

export interface RegisteredUiPreviewCase extends UiPreviewCase {
  component: UiPreviewComponent;
  state: UiPreviewState;
  locale: UiPreviewFixtureLocale;
}

export interface UiPreviewNotApplicable {
  component: UiPreviewComponent;
  state: UiPreviewState;
  reason: string;
}

export interface RegisteredUiPreviewFoundation {
  id: UiPreviewFoundation;
  label: string;
  tokenReferences: readonly string[];
}

const renderedStateMatrix: Readonly<Record<UiPreviewComponent, readonly UiPreviewState[]>> = {
  BUTTON: [
    "default",
    "hover",
    "focus-visible",
    "pressed",
    "disabled",
    "loading",
    "destructive",
    "rtl",
    "high-contrast",
    "reduced-motion",
  ],
  ICON_BUTTON: [
    "default",
    "hover",
    "focus-visible",
    "pressed",
    "disabled",
    "loading",
    "destructive",
    "rtl",
    "high-contrast",
    "reduced-motion",
  ],
  LINK: [
    "default",
    "hover",
    "focus-visible",
    "pressed",
    "long-content",
    "rtl",
    "high-contrast",
    "reduced-motion",
  ],
  FIELD: [
    "default",
    "hover",
    "focus-visible",
    "disabled",
    "loading",
    "success",
    "warning",
    "error",
    "long-content",
    "rtl",
    "high-contrast",
    "reduced-motion",
  ],
  SELECTION_CONTROL: [
    "default",
    "hover",
    "focus-visible",
    "pressed",
    "selected",
    "checked",
    "disabled",
    "rtl",
    "high-contrast",
    "reduced-motion",
  ],
  STATUS: [
    "default",
    "loading",
    "success",
    "warning",
    "error",
    "offline",
    "permission-blocked",
    "pending-sync",
    "long-content",
    "rtl",
    "high-contrast",
    "reduced-motion",
    "recovery",
  ],
  SETTINGS_ROW: [
    "default",
    "hover",
    "focus-visible",
    "pressed",
    "selected",
    "disabled",
    "loading",
    "warning",
    "error",
    "destructive",
    "offline",
    "permission-blocked",
    "pending-sync",
    "long-content",
    "rtl",
    "high-contrast",
    "reduced-motion",
    "recovery",
  ],
  EMPTY_ERROR_OFFLINE: [
    "default",
    "loading",
    "error",
    "offline",
    "permission-blocked",
    "long-content",
    "rtl",
    "high-contrast",
    "reduced-motion",
    "recovery",
  ],
};

const locales: readonly UiPreviewFixtureLocale[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];

const inputs: readonly UiPreviewInput[] = ["keyboard", "pointer", "touch"];

const crossCuttingStates: readonly UiPreviewState[] = ["rtl", "high-contrast", "reduced-motion"];

const componentEvidence: Readonly<
  Record<UiPreviewComponent, Pick<UiPreviewCase, "source" | "evidenceKind">>
> = {
  BUTTON: {
    source: "src/components/ui/button.tsx",
    evidenceKind: "PRODUCTION_COMPONENT",
  },
  ICON_BUTTON: {
    source: "src/components/ui/button.tsx",
    evidenceKind: "PRODUCTION_COMPONENT",
  },
  LINK: {
    source: "native:a",
    evidenceKind: "NATIVE_ELEMENT",
  },
  FIELD: {
    source: "src/components/ui/input.tsx",
    evidenceKind: "PRODUCTION_COMPONENT",
  },
  SELECTION_CONTROL: {
    source: "src/components/ui/switch.tsx",
    evidenceKind: "PRODUCTION_COMPONENT",
  },
  STATUS: {
    source: "src/pages/nav-v2/settings/components/V2SettingsFormPrimitives.tsx",
    evidenceKind: "PRODUCTION_COMPONENT",
  },
  SETTINGS_ROW: {
    source: "src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx",
    evidenceKind: "PRODUCTION_COMPONENT",
  },
  EMPTY_ERROR_OFFLINE: {
    source: "docs/superpowers/specs/2026-07-28-ui-system-conformance-contract.md",
    evidenceKind: "CONTRACT_PATTERN",
  },
};

function previewId(component: UiPreviewComponent, state: UiPreviewState): string {
  return `${component.toLowerCase().replace(/_/g, "-")}-${state}`;
}

function widthFor(component: UiPreviewComponent): number {
  if (component === "SETTINGS_ROW" || component === "EMPTY_ERROR_OFFLINE") return 380;
  if (component === "FIELD" || component === "STATUS") return 340;
  return 320;
}

function stateMechanismFor(state: UiPreviewState): UiPreviewCase["stateMechanism"] {
  if (state === "hover" || state === "focus-visible" || state === "pressed") {
    return "runtime-pseudo";
  }
  if (crossCuttingStates.includes(state)) return "cross-cutting-context";
  if (state === "default" || state === "long-content") return "static-contract";
  return "semantic-state";
}

let representativeIndex = 0;

export const uiPreviewCases: readonly RegisteredUiPreviewCase[] = UI_PREVIEW_COMPONENTS.flatMap(
  (component) =>
    renderedStateMatrix[component].map((state) => {
      const currentIndex = representativeIndex;
      representativeIndex += 1;

      const locale =
        state === "default"
          ? "en"
          : state === "rtl"
            ? currentIndex % 2 === 0
              ? "ar"
              : "he"
            : locales[currentIndex % locales.length];
      const input =
        state === "focus-visible"
          ? "keyboard"
          : state === "hover"
            ? "pointer"
            : state === "pressed"
              ? "touch"
              : inputs[currentIndex % inputs.length];

      return {
        id: previewId(component, state),
        component,
        state,
        locale,
        width: widthFor(component),
        input,
        reducedMotion: state === "reduced-motion",
        ...componentEvidence[component],
        stateMechanism: stateMechanismFor(state),
      };
    })
);

export const uiPreviewFoundations: readonly RegisteredUiPreviewFoundation[] = [
  {
    id: "color-roles",
    label: "Semantic color roles",
    tokenReferences: [
      "--background",
      "--foreground",
      "--primary",
      "--primary-foreground",
      "--destructive",
      "--destructive-foreground",
    ],
  },
  {
    id: "typography-roles",
    label: "Typography roles",
    tokenReferences: [
      "--typography-family-display",
      "--typography-family-body",
      "--typography-scale-sm",
      "--typography-scale-base",
      "--typography-scale-xl",
    ],
  },
  {
    id: "spacing-scale",
    label: "Runtime layout spacing anchors",
    tokenReferences: [
      "--v2-phone-drawer-inset",
      "--v2-phone-content-inline-end",
      "--v2-phone-content-block-end",
      "--v2-phone-drawer-size",
    ],
  },
  {
    id: "radius-scale",
    label: "Radius scale",
    tokenReferences: ["--radius-xs", "--radius-sm", "--radius-md", "--radius-lg"],
  },
  {
    id: "elevation-scale",
    label: "Elevation scale",
    tokenReferences: ["--zen-shadow-xs", "--zen-shadow-sm", "--zen-shadow-md"],
  },
  {
    id: "focus-contract",
    label: "Visible focus contract",
    tokenReferences: ["--ring", "--background"],
  },
  {
    id: "target-contract",
    label: "Minimum target contract",
    tokenReferences: ["--v2-phone-drawer-size"],
  },
  {
    id: "motion-contract",
    label: "Motion duration contract",
    tokenReferences: ["--duration-fast", "--duration-normal", "--duration-slow"],
  },
  {
    id: "container-contract",
    label: "Container contract",
    tokenReferences: ["--container-max-width", "--container-padding"],
  },
];

function notApplicableReason(component: UiPreviewComponent, state: UiPreviewState): string {
  switch (component) {
    case "BUTTON":
      return `${state} is owned by a persistent choice, field, status, or recovery surface; a ZenFlow action button does not retain that state.`;
    case "ICON_BUTTON":
      return `${state} would change the icon button into status content; ZenFlow exposes that condition beside the utility action instead.`;
    case "LINK":
      return `${state} is not navigation interaction; ZenFlow links keep destination semantics and delegate this condition to the owning control or status.`;
    case "FIELD":
      return `${state} is not an editable display-name field condition; ZenFlow presents it through a selection, status, or recovery surface.`;
    case "SELECTION_CONTROL":
      return `${state} is not a persistent binary-choice condition; ZenFlow reports it through status or recovery content without changing the switch meaning.`;
    case "STATUS":
      return `${state} requires an interactive control; ZenFlow status content remains non-interactive and is announced without button semantics.`;
    case "SETTINGS_ROW":
      return `${state} belongs to the row's nested control or adjacent status; the Account preferences group does not claim it as a row state.`;
    case "EMPTY_ERROR_OFFLINE":
      return `${state} does not describe an unavailable-content surface; ZenFlow keeps that interaction on the nested recovery action or owning control.`;
  }
}

const renderedPairs = new Set(
  uiPreviewCases.map(({ component, state }) => `${component}\u0000${state}`)
);

export const uiPreviewNotApplicable: readonly UiPreviewNotApplicable[] =
  UI_PREVIEW_COMPONENTS.flatMap((component) =>
    UI_PREVIEW_STATES.filter((state) => !renderedPairs.has(`${component}\u0000${state}`)).map(
      (state) => ({
        component,
        state,
        reason: notApplicableReason(component, state),
      })
    )
  );

export const uiPreviewRegistry = Object.freeze({
  fixtureSentinel: uiPreviewFixtureBoundary.sentinel,
  foundations: uiPreviewFoundations,
  cases: uiPreviewCases,
  notApplicable: uiPreviewNotApplicable,
});
