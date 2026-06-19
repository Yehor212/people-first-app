import {
  Barbell,
  BookOpenText,
  BowlFood,
  Brain,
  Broom,
  CigaretteSlash,
  Coffee,
  Drop,
  Egg,
  Footprints,
  HandHeart,
  Leaf,
  MoonStars,
  Notebook,
  PersonSimpleTaiChi,
  PhoneSlash,
  Pill,
  Sparkle,
  SunHorizon,
  Target,
  Tooth,
  Wind,
  Wine,
  type Icon,
  type IconWeight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { HabitMotionPlayer } from "./HabitMotionPlayer";
import type { HabitIconMotionState, HabitIconRenderer } from "./habitMotionAssets";
import {
  getV2HabitPictogramFamily,
  resolveV2HabitPictogramId,
  type V2HabitPictogramId,
} from "@/lib/v2HabitPictograms";

interface V2HabitPictogramProps {
  value?: string;
  pictogramId?: V2HabitPictogramId;
  className?: string;
  decorative?: boolean;
  motionMode?: HabitIconRenderer | "auto";
  motionState?: HabitIconMotionState;
  motionAllowed?: boolean;
}

type MotionKind =
  | "liquid-drift"
  | "stride-cadence"
  | "loaded-rebound"
  | "page-flutter"
  | "neural-focus"
  | "lunar-parallax"
  | "elastic-reach"
  | "nourish-orbit"
  | "capsule-settle"
  | "clean-sweep"
  | "solar-rise"
  | "leaf-breathe"
  | "gratitude-glow"
  | "air-ribbon"
  | "signal-cut"
  | "aperture-lock"
  | "release-fade"
  | "steam-pulse";

interface B41PictogramMeta {
  Icon: Icon;
  object: string;
  accent: string;
  motion: string;
  motionKind: MotionKind;
  storyboard: string;
  tone: "aqua" | "moss" | "ember" | "paper" | "violet" | "jade" | "solar" | "sky" | "rose" | "sage";
  shape: string;
  layout: string;
  composition: string;
  material: string;
  finish: string;
  primaryWeight: IconWeight;
}

const PICTOGRAM_META: Record<V2HabitPictogramId, B41PictogramMeta> = {
  "drink-water": {
    Icon: Drop,
    object: "liquid-drop-ampoule",
    accent: "waterline-wavelet",
    motion: "inner-waterline-drift",
    motionKind: "liquid-drift",
    storyboard: "droplet-fill-ripple-cycle",
    tone: "aqua",
    shape: "drop",
    layout: "vessel-drop-ticket",
    composition: "liquid-drop-hero",
    material: "aqua-glass",
    finish: "water-polished-glass",
    primaryWeight: "duotone",
  },
  "walk-distance": {
    Icon: Footprints,
    object: "glass-trail-compass",
    accent: "route-trace",
    motion: "two-step-path-cadence",
    motionKind: "stride-cadence",
    storyboard: "left-right-footstep-cadence",
    tone: "moss",
    shape: "trail",
    layout: "stepping-route-label",
    composition: "path-step-stack",
    material: "trail-suede",
    finish: "stitched-matte-suede",
    primaryWeight: "bold",
  },
  exercise: {
    Icon: Barbell,
    object: "kinetic-weight-core",
    accent: "power-bolt",
    motion: "loaded-rebound-edge-glint",
    motionKind: "loaded-rebound",
    storyboard: "weighted-rep-compress-release",
    tone: "ember",
    shape: "gear-tile",
    layout: "power-slab-corner",
    composition: "strength-bar",
    material: "brushed-brass",
    finish: "weighted-brushed-metal",
    primaryWeight: "regular",
  },
  read: {
    Icon: BookOpenText,
    object: "open-book-prism",
    accent: "page-marker",
    motion: "page-flutter-ink-shimmer",
    motionKind: "page-flutter",
    storyboard: "page-turn-flip",
    tone: "paper",
    shape: "book-page",
    layout: "open-spread-index",
    composition: "open-page",
    material: "ink-paper",
    finish: "folded-paper-board",
    primaryWeight: "duotone",
  },
  meditate: {
    Icon: Brain,
    object: "neural-calm-orb",
    accent: "slow-pulse-ring",
    motion: "neural-pulse-slow-focus",
    motionKind: "neural-focus",
    storyboard: "slow-neural-breath-pulse",
    tone: "violet",
    shape: "neural-ring",
    layout: "neural-seal-orbit",
    composition: "neural-seal",
    material: "lilac-porcelain",
    finish: "soft-fired-porcelain",
    primaryWeight: "light",
  },
  sleep: {
    Icon: MoonStars,
    object: "moon-glass-talisman",
    accent: "night-cloud",
    motion: "lunar-sway-star-parallax",
    motionKind: "lunar-parallax",
    storyboard: "moon-sway-star-dim",
    tone: "violet",
    shape: "moon-crescent",
    layout: "night-cutout-badge",
    composition: "night-charm",
    material: "midnight-glaze",
    finish: "moonlit-fired-glaze",
    primaryWeight: "fill",
  },
  stretch: {
    Icon: PersonSimpleTaiChi,
    object: "balance-halo-figure",
    accent: "body-bloom",
    motion: "elastic-reach-calm-recovery",
    motionKind: "elastic-reach",
    storyboard: "body-reach-return",
    tone: "jade",
    shape: "body-figure",
    layout: "balance-figure-poster",
    composition: "balance-figure",
    material: "jade-stone",
    finish: "carved-jade-stone",
    primaryWeight: "bold",
  },
  "healthy-food": {
    Icon: BowlFood,
    object: "nourish-bowl-orb",
    accent: "fresh-nourish-mark",
    motion: "warm-nourish-orbit",
    motionKind: "nourish-orbit",
    storyboard: "bowl-warm-orbit",
    tone: "sage",
    shape: "bowl",
    layout: "bowl-market-label",
    composition: "market-bowl",
    material: "glazed-ceramic",
    finish: "warm-glazed-ceramic",
    primaryWeight: "fill",
  },
  protein: {
    Icon: Egg,
    object: "protein-oval-shell",
    accent: "protein-core",
    motion: "protein-shell-settle",
    motionKind: "capsule-settle",
    storyboard: "shell-settle-crack-soft",
    tone: "paper",
    shape: "protein-oval",
    layout: "protein-shell-stamp",
    composition: "protein-oval",
    material: "pearl-shell",
    finish: "soft-pearl-shell",
    primaryWeight: "duotone",
  },
  vitamins: {
    Icon: Pill,
    object: "vitamin-capsule-core",
    accent: "daily-care-check",
    motion: "vitamin-capsule-roll",
    motionKind: "capsule-settle",
    storyboard: "capsule-roll-check",
    tone: "rose",
    shape: "pill-capsule",
    layout: "capsule-tab-strip",
    composition: "capsule-tab",
    material: "translucent-capsule",
    finish: "semi-transparent-capsule",
    primaryWeight: "bold",
  },
  "brush-teeth": {
    Icon: Tooth,
    object: "clean-glass-prism",
    accent: "clean-spark",
    motion: "clean-sweep-spark",
    motionKind: "clean-sweep",
    storyboard: "tooth-sweep-sparkle",
    tone: "sky",
    shape: "clean-glass-tile",
    layout: "clean-spark-tile",
    composition: "clean-prism",
    material: "blue-porcelain",
    finish: "clean-blue-porcelain",
    primaryWeight: "regular",
  },
  sunlight: {
    Icon: SunHorizon,
    object: "morning-sun-lens",
    accent: "soft-sun-halo",
    motion: "solar-rise-halo",
    motionKind: "solar-rise",
    storyboard: "sunrise-horizon-lift",
    tone: "solar",
    shape: "sun-lens",
    layout: "sunrise-window-card",
    composition: "sunrise-lens",
    material: "sunlit-brass",
    finish: "sun-warmed-brass",
    primaryWeight: "fill",
  },
  "touch-grass": {
    Icon: Leaf,
    object: "leaf-glass-seed",
    accent: "grounding-sprout",
    motion: "leaf-breathe-grounding",
    motionKind: "leaf-breathe",
    storyboard: "leaf-breathe-ground",
    tone: "sage",
    shape: "leaf-seed",
    layout: "leaf-ground-marker",
    composition: "leaf-token",
    material: "pressed-leaf",
    finish: "pressed-botanical-paper",
    primaryWeight: "duotone",
  },
  journal: {
    Icon: Notebook,
    object: "journal-page-prism",
    accent: "ink-stroke",
    motion: "journal-line-shimmer",
    motionKind: "page-flutter",
    storyboard: "pen-line-write",
    tone: "paper",
    shape: "journal-page",
    layout: "notebook-margin-slab",
    composition: "notebook-slab",
    material: "graphite-paper",
    finish: "graphite-ink-paper",
    primaryWeight: "regular",
  },
  gratitude: {
    Icon: HandHeart,
    object: "gratitude-heart-votive",
    accent: "heart-offering",
    motion: "gratitude-glow-soft-hold",
    motionKind: "gratitude-glow",
    storyboard: "heart-offer-glow",
    tone: "rose",
    shape: "heart-votive",
    layout: "heart-offering-token",
    composition: "heart-votive",
    material: "rose-glaze",
    finish: "rose-fired-glaze",
    primaryWeight: "fill",
  },
  breathwork: {
    Icon: Wind,
    object: "air-ribbon-vial",
    accent: "air-feather",
    motion: "inhale-exhale-ribbon-sweep",
    motionKind: "air-ribbon",
    storyboard: "inhale-exhale-ribbon",
    tone: "sky",
    shape: "air-ribbon",
    layout: "air-ribbon-ticket",
    composition: "air-ribbon",
    material: "frosted-acetate",
    finish: "frosted-translucent-acetate",
    primaryWeight: "bold",
  },
  "phone-break": {
    Icon: PhoneSlash,
    object: "signal-cut-shield",
    accent: "signal-shield-cut",
    motion: "signal-cut-release",
    motionKind: "signal-cut",
    storyboard: "signal-cut-fade",
    tone: "jade",
    shape: "signal-shield",
    layout: "signal-shield-card",
    composition: "signal-shield",
    material: "matte-signal-plastic",
    finish: "matte-safety-polymer",
    primaryWeight: "duotone",
  },
  "deep-work": {
    Icon: Target,
    object: "optical-lens-reticle",
    accent: "focus-time-lock",
    motion: "aperture-lock-counter-rings",
    motionKind: "aperture-lock",
    storyboard: "reticle-lock-focus",
    tone: "solar",
    shape: "focus-target",
    layout: "reticle-lock-poster",
    composition: "reticle-lock",
    material: "optical-glass",
    finish: "ground-optical-glass",
    primaryWeight: "regular",
  },
  "tidy-room": {
    Icon: Broom,
    object: "clean-sweep-crystal",
    accent: "done-seal",
    motion: "room-sweep-glint",
    motionKind: "clean-sweep",
    storyboard: "broom-sweep-finish",
    tone: "sky",
    shape: "clean-sweep",
    layout: "clean-sweep-label",
    composition: "sweep-label",
    material: "powder-coated-metal",
    finish: "powder-coated-tool-metal",
    primaryWeight: "bold",
  },
  "quit-smoking": {
    Icon: CigaretteSlash,
    object: "release-smoke-vial",
    accent: "release-no-symbol",
    motion: "smoke-release-fade",
    motionKind: "release-fade",
    storyboard: "smoke-dissolve-ban",
    tone: "rose",
    shape: "release-vial",
    layout: "release-cut-strip",
    composition: "release-strip",
    material: "cut-paper",
    finish: "cut-paper-safety-label",
    primaryWeight: "duotone",
  },
  "quit-drinking": {
    Icon: Wine,
    object: "clear-choice-glass",
    accent: "clear-drop",
    motion: "clear-choice-steadying",
    motionKind: "release-fade",
    storyboard: "glass-steady-clear-drop",
    tone: "violet",
    shape: "clear-goblet",
    layout: "clear-glass-tab",
    composition: "clear-goblet",
    material: "clear-crystal",
    finish: "cut-clear-crystal",
    primaryWeight: "regular",
  },
  focus: {
    Icon: Coffee,
    object: "steam-focus-cup",
    accent: "bean-focus-note",
    motion: "steam-pulse-focus",
    motionKind: "steam-pulse",
    storyboard: "coffee-steam-loop",
    tone: "paper",
    shape: "steam-cup",
    layout: "steam-focus-ticket",
    composition: "steam-ticket",
    material: "ceramic-mug",
    finish: "warm-ceramic-glaze",
    primaryWeight: "fill",
  },
};

function toReadableLabel(id: V2HabitPictogramId): string {
  return id.replace(/-/g, " ");
}

export function V2HabitPictogram({
  value,
  pictogramId,
  className,
  decorative = true,
  motionMode = "auto",
  motionState = "idle",
  motionAllowed = true,
}: V2HabitPictogramProps) {
  const id = pictogramId ?? resolveV2HabitPictogramId(value);
  const family = getV2HabitPictogramFamily(id);
  const meta = PICTOGRAM_META[id];
  const SourceIcon = meta?.Icon ?? Sparkle;

  return (
    <span
      className={cn(
        "v2-habit-pictogram v2hp-b41 inline-flex h-5 w-5 items-center justify-center",
        className,
      )}
      data-habit-pictogram={id}
      data-pictogram-family={family}
      data-pictogram-style="option-b-liquid-glass-totem"
      data-icon-source="phosphor-icons-react-real-source-icon"
      data-icon-renderer="phosphor-react-inline-svg"
      data-icon-license="mit"
      data-icon-composition="two-layer-real-source-svg-inside-liquid-glass-totem"
      data-source-pack="phosphor-icons-react@2.1.10"
      data-source-authenticity="licensed-icon-component-not-generated"
      data-approval-state="candidate-option-b-pending-user-approval"
      data-design-contract="no-emoji-no-raster-no-generated-icon"
      data-visual-upgrade="option-b-liquid-glass-totem-system"
      data-art-direction="option-b-liquid-glass-totems-real-source-suite"
      data-icon-treatment="option-b-liquid-glass-totem"
      data-object-realism="real-source-liquid-glass-totem-v2"
      data-template-guard="no-shared-ai-template"
      data-option-choice="b-liquid-glass-totems"
      data-liquid-glass-contract="refractive-source-icon-totem"
      data-object-treatment={meta.object}
      data-object-archetype={meta.object}
      data-silhouette-family={meta.shape}
      data-material-family={meta.material}
      data-surface-finish={meta.finish}
      data-layout-family={meta.layout}
      data-composition-archetype={meta.composition}
      data-motion-signature={meta.motion}
      data-motion-kind={meta.motionKind}
      data-motion-system="option-b-liquid-glass-motion-per-habit"
      data-material-treatment="refractive-liquid-glass-real-source-icon"
      data-companion-treatment="removed-no-mini-icon"
      data-accent-renderer="none"
      data-mini-icon-treatment="removed"
      data-frame-animation-system="semantic-keyframe-storyboard-per-habit"
      data-motion-quality="telegram-grade-vector-loop"
      data-animation-loop-profile="seamless-vector-micro-loop"
      data-animation-frame-rate-target="60"
      data-animation-loop-max-duration-ms="3000"
      data-animation-performance-contract="transform-opacity-only"
      data-motion-storyboard={meta.storyboard}
      data-animation-frames="0-12-24-36-48-60-72-84-100"
      data-primary-icon-weight={meta.primaryWeight}
      data-relief-icon-weight="fill"
      data-source-stroke-icon-weight="none"
      data-companion-icon-weight="none"
      data-tone={meta.tone}
      data-object-shape={meta.shape}
      data-physical-form={meta.shape}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : toReadableLabel(id)}
      role={decorative ? undefined : "img"}
    >
      <HabitMotionPlayer
        pictogramId={id}
        renderer={motionMode}
        state={motionState}
        motionAllowed={motionAllowed}
      />
      <span
        className="v2hp-b50__motion"
        data-pictogram-layer="motion-field"
        data-pictogram-motion={meta.motionKind}
      />
      <span className="v2hp-b62__cast" data-pictogram-layer="liquid-glass-contact-shadow" />
      <span className="v2hp-b62__aura" data-pictogram-layer="liquid-glass-aura" />
      <span className="v2hp-b62__totem" data-pictogram-layer="liquid-glass-totem-shell" />
      <span className="v2hp-b62__core" data-pictogram-layer="liquid-glass-totem-core" />
      <span className="v2hp-b62__refraction" data-pictogram-layer="liquid-glass-refraction" />
      <span className="v2hp-b62__rim" data-pictogram-layer="liquid-glass-rim" />
      <span className="v2hp-b62__caustic" data-pictogram-layer="liquid-glass-caustic" />
      <span className="v2hp-b51__motif" data-pictogram-layer="habit-motion-motif" />
      <span className="v2hp-b52__signal" data-pictogram-layer="motion-signal" />
      <span className="v2hp-b62__story v2hp-b62__story-a" data-pictogram-layer="semantic-motion-frame-primary" />
      <span className="v2hp-b62__story v2hp-b62__story-b" data-pictogram-layer="semantic-motion-frame-secondary" />
      <span className="v2hp-b62__story v2hp-b62__story-c" data-pictogram-layer="semantic-motion-frame-tertiary" />
      <span className="v2hp-b62__relief" data-pictogram-layer="source-fill-relief">
        <SourceIcon aria-hidden="true" className="h-full w-full" weight="fill" />
      </span>
      <span className="v2hp-b50__glyph v2hp-b62__foreground" data-pictogram-layer="source-hero-glyph">
        <SourceIcon aria-hidden="true" className="h-full w-full" weight={meta.primaryWeight} />
      </span>
    </span>
  );
}
