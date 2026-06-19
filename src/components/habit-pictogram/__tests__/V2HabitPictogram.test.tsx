import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { V2HabitPictogram } from "../V2HabitPictogram";
import { getHabitIconAsset } from "../habitMotionAssets";
import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";

const pictogramIds: V2HabitPictogramId[] = [
  "drink-water",
  "walk-distance",
  "exercise",
  "read",
  "meditate",
  "sleep",
  "stretch",
  "healthy-food",
  "protein",
  "vitamins",
  "brush-teeth",
  "sunlight",
  "touch-grass",
  "journal",
  "gratitude",
  "breathwork",
  "phone-break",
  "deep-work",
  "tidy-room",
  "quit-smoking",
  "quit-drinking",
  "focus",
];

const legacyEmoji = /[💧🚶🏃👟🥾🤸🧘🪷🏋💪🥗🥚💊🪥🌅🌤🌿✍📝🙏✨🌬🫁📖📚📵🎧🎯🛏😴☕🧹🚭🚬🕯🍷🫗🎵🧠]/u;

const expectedStoryboards: Record<V2HabitPictogramId, string> = {
  "drink-water": "droplet-fill-ripple-cycle",
  "walk-distance": "left-right-footstep-cadence",
  exercise: "weighted-rep-compress-release",
  read: "page-turn-flip",
  meditate: "slow-neural-breath-pulse",
  sleep: "moon-sway-star-dim",
  stretch: "body-reach-return",
  "healthy-food": "bowl-warm-orbit",
  protein: "shell-settle-crack-soft",
  vitamins: "capsule-roll-check",
  "brush-teeth": "tooth-sweep-sparkle",
  sunlight: "sunrise-horizon-lift",
  "touch-grass": "leaf-breathe-ground",
  journal: "pen-line-write",
  gratitude: "heart-offer-glow",
  breathwork: "inhale-exhale-ribbon",
  "phone-break": "signal-cut-fade",
  "deep-work": "reticle-lock-focus",
  "tidy-room": "broom-sweep-finish",
  "quit-smoking": "smoke-dissolve-ban",
  "quit-drinking": "glass-steady-clear-drop",
  focus: "coffee-steam-loop",
};

const expectedStoryboardMotions: Record<V2HabitPictogramId, string> = {
  "drink-water": "v2hp-b62-droplet-ripple",
  "walk-distance": "v2hp-b62-footstep-cadence",
  exercise: "v2hp-b62-weighted-rep",
  read: "v2hp-b62-page-turn",
  meditate: "v2hp-b62-neural-breath",
  sleep: "v2hp-b62-moon-sway",
  stretch: "v2hp-b62-reach-return",
  "healthy-food": "v2hp-b62-bowl-orbit",
  protein: "v2hp-b62-shell-settle",
  vitamins: "v2hp-b62-capsule-roll",
  "brush-teeth": "v2hp-b62-tooth-sweep",
  sunlight: "v2hp-b62-sunrise-lift",
  "touch-grass": "v2hp-b62-leaf-ground",
  journal: "v2hp-b62-pen-write",
  gratitude: "v2hp-b62-heart-offer",
  breathwork: "v2hp-b62-ribbon-breathe",
  "phone-break": "v2hp-b62-signal-cut",
  "deep-work": "v2hp-b62-reticle-lock",
  "tidy-room": "v2hp-b62-broom-sweep",
  "quit-smoking": "v2hp-b62-smoke-dissolve",
  "quit-drinking": "v2hp-b62-glass-steady",
  focus: "v2hp-b62-coffee-steam",
};

function extractKeyframeBlock(css: string, motionName: string): string {
  const keyframeStart = css.indexOf("@keyframes " + motionName + " {");
  expect(keyframeStart, motionName).toBeGreaterThanOrEqual(0);
  const nextKeyframe = css.indexOf("\n\n@keyframes ", keyframeStart + 1);
  const nextMedia = css.indexOf("\n\n@media ", keyframeStart + 1);
  const endCandidates = [nextKeyframe, nextMedia].filter((index) => index > keyframeStart);
  const keyframeEnd = endCandidates.length > 0 ? Math.min(...endCandidates) : css.length;
  return css.slice(keyframeStart, keyframeEnd);
}

function keyframeStops(block: string): string[] {
  return Array.from(block.matchAll(/(^|\n)\s*(\d+)%/g)).map((match) => match[2] + "%");
}

describe("V2HabitPictogram", () => {
  it.each(pictogramIds)("renders %s as an Option B liquid-glass totem from layered real icon sources", (pictogramId) => {
    const { container } = render(<V2HabitPictogram pictogramId={pictogramId} />);

    const root = container.querySelector('[data-habit-pictogram="' + pictogramId + '"]');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-pictogram-style", "option-b-liquid-glass-totem");
    expect(root).toHaveAttribute("data-icon-source", "phosphor-icons-react-real-source-icon");
    expect(root).toHaveAttribute("data-icon-renderer", "phosphor-react-inline-svg");
    expect(root).toHaveAttribute("data-icon-license", "mit");
    expect(root).toHaveAttribute("data-icon-composition", "two-layer-real-source-svg-inside-liquid-glass-totem");
    expect(root).toHaveAttribute("data-approval-state", "candidate-option-b-pending-user-approval");
    expect(root).toHaveAttribute("data-design-contract", "no-emoji-no-raster-no-generated-icon");
    expect(root).toHaveAttribute("data-visual-upgrade", "option-b-liquid-glass-totem-system");
    expect(root).toHaveAttribute("data-art-direction", "option-b-liquid-glass-totems-real-source-suite");
    expect(root).toHaveAttribute("data-icon-treatment", "option-b-liquid-glass-totem");
    expect(root).toHaveAttribute("data-object-archetype");
    expect(root).toHaveAttribute("data-silhouette-family");
    expect(root).toHaveAttribute("data-material-family");
    expect(root).toHaveAttribute("data-surface-finish");
    expect(root).toHaveAttribute("data-layout-family");
    expect(root).toHaveAttribute("data-composition-archetype");
    expect(root).toHaveAttribute("data-object-treatment");
    expect(root).toHaveAttribute("data-motion-signature");
    expect(root).toHaveAttribute("data-motion-kind");
    expect(root).toHaveAttribute("data-motion-system", "option-b-liquid-glass-motion-per-habit");
    expect(root).toHaveAttribute("data-material-treatment", "refractive-liquid-glass-real-source-icon");
    expect(root).toHaveAttribute("data-companion-treatment", "removed-no-mini-icon");
    expect(root).toHaveAttribute("data-accent-renderer", "none");
    expect(root).toHaveAttribute("data-mini-icon-treatment", "removed");
    expect(root).toHaveAttribute("data-frame-animation-system", "semantic-keyframe-storyboard-per-habit");
    expect(root).toHaveAttribute("data-motion-quality", "telegram-grade-vector-loop");
    expect(root).toHaveAttribute("data-animation-loop-profile", "seamless-vector-micro-loop");
    expect(root).toHaveAttribute("data-animation-frame-rate-target", "60");
    expect(root).toHaveAttribute("data-animation-loop-max-duration-ms", "3000");
    expect(root).toHaveAttribute("data-animation-performance-contract", "transform-opacity-only");
    expect(root).toHaveAttribute("data-motion-storyboard", expectedStoryboards[pictogramId]);
    expect(root).toHaveAttribute("data-animation-frames", "0-12-24-36-48-60-72-84-100");
    expect(root).toHaveAttribute("data-primary-icon-weight");
    expect(root).toHaveAttribute("data-relief-icon-weight", "fill");
    expect(root).toHaveAttribute("data-companion-icon-weight", "none");
    expect(root).toHaveAttribute("data-source-pack", "phosphor-icons-react@2.1.10");
    expect(root).toHaveAttribute("data-source-authenticity", "licensed-icon-component-not-generated");
    expect(root).toHaveAttribute("data-source-stroke-icon-weight", "none");
    expect(root?.querySelectorAll("svg")).toHaveLength(2);
    expect(root?.querySelector("[data-pictogram-layer='liquid-glass-contact-shadow']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='liquid-glass-aura']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='liquid-glass-totem-shell']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='liquid-glass-totem-core']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='liquid-glass-refraction']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='liquid-glass-rim']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='liquid-glass-caustic']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='source-fill-relief']")).toBeInTheDocument();
    expect(root?.querySelector("[data-habit-motion-player]")).toBeInTheDocument();
    expect(root?.querySelector("[data-habit-motion-player]")).toHaveAttribute("data-renderer", "css");
    expect(root?.querySelector("[data-pictogram-layer='source-hero-glyph']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='habit-motion-motif']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='source-accent-glyph']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='accent-object-stage']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='semantic-motion-frame-primary']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='semantic-motion-frame-secondary']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='semantic-motion-frame-tertiary']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='real-source-app-icon-tile']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='app-icon-depth']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='tile-specular-ribbon']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='tile-edge-glint']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='source-stroke-core']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer*='atelier']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer*='studio']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer*='enamel']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer*='generated-accent']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='precision-badge-shell']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='badge-inner-lens']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='source-crisp-foreground']")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer^='b39-']")).not.toBeInTheDocument();
    expect(root?.getAttribute("data-icon-treatment") ?? "").not.toMatch(/b39|b45|b46|b47|b48|b49|b60|atelier|enamel|sticker|glass-symbol|curated/i);
    expect(Array.from(root?.attributes ?? []).map((attr) => attr.value).join(" ")).not.toMatch(/atelier|enamel|sticker|curated/i);
    expect(root?.textContent ?? "").not.toMatch(legacyEmoji);
  });

  it.each(pictogramIds)("resolves production asset metadata for %s", (pictogramId) => {
    const asset = getHabitIconAsset(pictogramId);

    expect(asset.id).toBe(pictogramId);
    expect(asset.reduced).toMatch(/reduced\.svg$/);
    expect(asset.states).toEqual(["idle", "press", "complete", "disabled", "reduced"]);
    expect(asset.idle.durationMs).toBeLessThanOrEqual(3000);
    expect(asset.license).toBe("MIT");
  });

  it("does not keep rejected B45 through B60 contracts as the active pictogram style", () => {
    const { container } = render(
      <>
        {pictogramIds.map((pictogramId) => (
          <V2HabitPictogram key={pictogramId} pictogramId={pictogramId} />
        ))}
      </>,
    );

    expect(container.querySelectorAll('[data-pictogram-style="b45-crisp-real-icon-object-badge"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b45-crisp-real-icon-object-badge"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b45-crisp-real-icon-system-pass"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b46-real-source-icon-emblem"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b46-real-source-icon-emblem"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b46-real-source-icon-emblem-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b47-editorial-app-emblem"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b47-editorial-app-emblem"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b47-editorial-app-emblem-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b48-atelier-enamel-icon"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b48-atelier-enamel-icon"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b48-atelier-enamel-icon-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b49-real-glass-symbol"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b49-real-glass-symbol"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b49-real-glass-symbol-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b50-real-icon-object"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b50-real-icon-object"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b50-real-icon-object-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b51-real-motion-object"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b51-real-motion-object"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b51-real-motion-object-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b52-real-icon-duo-totem"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b52-real-icon-duo-totem"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b52-real-icon-duo-totem-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b53-real-source-medallion"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b53-real-source-medallion"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b53-real-source-medallion-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b54-real-source-artifact"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b54-real-source-artifact"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b54-real-source-artifact-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b55-real-source-studio-artifact"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b55-real-source-studio-artifact"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b55-real-source-studio-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b56-curated-source-object"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b56-curated-source-object"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b56-curated-source-object-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b57-real-object-source-icon"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b57-real-object-source-icon"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b57-real-object-source-icon-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b58-real-source-icon-object"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b58-real-source-icon-object"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b58-real-source-icon-object-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b59-liquid-glass-source-totem"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b59-liquid-glass-source-totem"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b59-liquid-glass-source-totem-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b60-precision-liquid-source-badge"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b60-precision-liquid-source-badge"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b60-precision-liquid-source-badge-system"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-pictogram-style="b61-source-app-icon-tile"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-approval-state="implemented-b61-source-app-icon-tile"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-visual-upgrade="b61-source-app-icon-tile-system"]')).toHaveLength(0);
  });

  it("gives starter habits distinct object and motion signatures", () => {
    const starterIds: V2HabitPictogramId[] = [
      "drink-water",
      "walk-distance",
      "exercise",
      "read",
      "meditate",
      "sleep",
    ];
    const { container } = render(
      <>
        {starterIds.map((pictogramId) => (
          <V2HabitPictogram key={pictogramId} pictogramId={pictogramId} />
        ))}
      </>,
    );

    const roots = [...container.querySelectorAll("[data-habit-pictogram]")];
    expect(new Set(roots.map((root) => root.getAttribute("data-object-treatment"))).size).toBe(
      starterIds.length,
    );
    expect(new Set(roots.map((root) => root.getAttribute("data-motion-signature"))).size).toBe(
      starterIds.length,
    );
    expect(new Set(roots.map((root) => root.getAttribute("data-motion-kind"))).size).toBeGreaterThan(3);
    expect(new Set(roots.map((root) => root.getAttribute("data-motion-storyboard"))).size).toBe(
      starterIds.length,
    );
    expect(new Set(roots.map((root) => root.getAttribute("data-composition-archetype"))).size).toBe(
      starterIds.length,
    );
  });

  it("uses a separate motion signature for every supported habit pictogram", () => {
    const { container } = render(
      <>
        {pictogramIds.map((pictogramId) => (
          <V2HabitPictogram key={pictogramId} pictogramId={pictogramId} />
        ))}
      </>,
    );

    const roots = [...container.querySelectorAll("[data-habit-pictogram]")];
    expect(roots).toHaveLength(pictogramIds.length);
    expect(new Set(roots.map((root) => root.getAttribute("data-motion-signature"))).size).toBe(
      pictogramIds.length,
    );
    expect(new Set(roots.map((root) => root.getAttribute("data-object-treatment"))).size).toBe(
      pictogramIds.length,
    );
    expect(new Set(roots.map((root) => root.getAttribute("data-composition-archetype"))).size).toBe(
      pictogramIds.length,
    );
    expect(new Set(roots.map((root) => root.getAttribute("data-motion-storyboard"))).size).toBe(
      pictogramIds.length,
    );
  });

  it("uses a separate real-object archetype for every supported habit pictogram", () => {
    const { container } = render(
      <>
        {pictogramIds.map((pictogramId) => (
          <V2HabitPictogram key={pictogramId} pictogramId={pictogramId} />
        ))}
      </>,
    );

    const roots = [...container.querySelectorAll("[data-habit-pictogram]")];
    expect(new Set(roots.map((root) => root.getAttribute("data-object-archetype"))).size).toBe(
      pictogramIds.length,
    );
  });

  it("uses varied silhouette, material, and real-object layout families instead of one repeated generated sticker", () => {
    const { container } = render(
      <>
        {pictogramIds.map((pictogramId) => (
          <V2HabitPictogram key={pictogramId} pictogramId={pictogramId} />
        ))}
      </>,
    );

    const roots = [...container.querySelectorAll("[data-habit-pictogram]")];
    expect(new Set(roots.map((root) => root.getAttribute("data-silhouette-family"))).size).toBeGreaterThanOrEqual(12);
    expect(new Set(roots.map((root) => root.getAttribute("data-material-family"))).size).toBe(pictogramIds.length);
    expect(new Set(roots.map((root) => root.getAttribute("data-primary-icon-weight"))).size).toBeGreaterThanOrEqual(4);
    expect(new Set(roots.map((root) => root.getAttribute("data-surface-finish"))).size).toBeGreaterThanOrEqual(14);
    expect(new Set(roots.map((root) => root.getAttribute("data-layout-family"))).size).toBeGreaterThanOrEqual(16);
    expect(new Set(roots.map((root) => root.getAttribute("data-art-direction")))).toEqual(
      new Set(["option-b-liquid-glass-totems-real-source-suite"]),
    );
    expect(roots.filter((root) => root.getAttribute("data-object-shape") === "orb")).toHaveLength(0);
  });

  it("defines a production CSS motion profile for every pictogram id", () => {
    const css = readFileSync("src/index.css", "utf8");

    for (const pictogramId of pictogramIds) {
      const profileSelector = '.v2hp-b41[data-habit-pictogram="' + pictogramId + '"]';
      expect(css).toContain(profileSelector + " {");
      expect(css).toContain(profileSelector + " .v2hp-b41__glass");
      expect(css).toContain(profileSelector + " .v2hp-b41__glyph");
      expect(css).toContain(profileSelector + " .v2hp-b41__spark");
    }

    const profileRoots = css.match(/\.v2hp-b41\[data-habit-pictogram="[^"]+"\] \{/g) ?? [];
    expect(new Set(profileRoots).size).toBe(pictogramIds.length);
  });

  it("defines a distinct production CSS visual profile for every pictogram id", () => {
    const css = readFileSync("src/index.css", "utf8");
    const requiredVariables = [
      "--v2hp-shell-radius:",
      "--v2hp-shell-scale:",
      "--v2hp-shell-tilt:",
      "--v2hp-glyph-scale:",
      "--v2hp-glint-left:",
    ];

    expect(css).toContain("border-radius: var(--v2hp-shell-radius);");
    expect(css).toContain("left: var(--v2hp-glint-left);");
    expect(css).toContain("transform: translate3d(var(--v2hp-glyph-x), var(--v2hp-glyph-y), 0) scale(var(--v2hp-glyph-scale));");

    const signatures = pictogramIds.map((pictogramId) => {
      const profileSelector = '.v2hp-b41[data-habit-pictogram="' + pictogramId + '"]';
      const profileStart = css.indexOf(profileSelector + " {");
      expect(profileStart, pictogramId).toBeGreaterThanOrEqual(0);
      const bodyStart = css.indexOf("{", profileStart) + 1;
      const bodyEnd = css.indexOf("\n}", bodyStart);
      const profileBlock = css.slice(bodyStart, bodyEnd);

      for (const variableName of requiredVariables) {
        expect(profileBlock, pictogramId + " " + variableName).toContain(variableName);
      }

      return requiredVariables
        .map((variableName) => {
          const line = profileBlock.split("\n").find((candidate) => candidate.trim().startsWith(variableName));
          return line?.split(":").slice(1).join(":").replace(";", "").trim() ?? "";
        })
        .join("|");
    });

    expect(new Set(signatures).size).toBe(pictogramIds.length);
  });

  it("defines a distinct real-source accent composition profile for every pictogram id", () => {
    const css = readFileSync("src/index.css", "utf8");
    const requiredVariables = [
      "--v2hp-accent-inset:",
      "--v2hp-accent-x:",
      "--v2hp-accent-y:",
      "--v2hp-accent-scale:",
      "--v2hp-accent-rotate:",
    ];

    expect(css).toContain(".v2hp-b41__accent");
    expect(css).toContain("transform: translate3d(var(--v2hp-accent-x), var(--v2hp-accent-y), 0) rotate(var(--v2hp-accent-rotate)) scale(var(--v2hp-accent-scale));");

    const signatures = pictogramIds.map((pictogramId) => {
      const profileSelector = '.v2hp-b41[data-habit-pictogram="' + pictogramId + '"]';
      const profileStart = css.indexOf(profileSelector + " {");
      expect(profileStart, pictogramId).toBeGreaterThanOrEqual(0);
      const bodyStart = css.indexOf("{", profileStart) + 1;
      const bodyEnd = css.indexOf("\n}", bodyStart);
      const profileBlock = css.slice(bodyStart, bodyEnd);

      for (const variableName of requiredVariables) {
        expect(profileBlock, pictogramId + " " + variableName).toContain(variableName);
      }

      return requiredVariables
        .map((variableName) => {
          const line = profileBlock.split("\n").find((candidate) => candidate.trim().startsWith(variableName));
          return line?.split(":").slice(1).join(":").replace(";", "").trim() ?? "";
        })
        .join("|");
    });

    expect(new Set(signatures).size).toBe(pictogramIds.length);
  });

  it("defines sculpted primary glyph CSS for real source fill and outline layers", () => {
    const css = readFileSync("src/index.css", "utf8");

    expect(css).toContain(".v2hp-b41__glyph-fill");
    expect(css).toContain("--v2hp-glyph-fill-x:");
    expect(css).toContain("--v2hp-glyph-fill-y:");
    expect(css).toContain("--v2hp-glyph-fill-scale:");
    expect(css).toContain("transform: translate3d(var(--v2hp-glyph-fill-x), var(--v2hp-glyph-fill-y), 0) scale(var(--v2hp-glyph-fill-scale));");
  });

  it("defines a B42 clarity profile so real source icons read as distinct premium objects", () => {
    const css = readFileSync("src/index.css", "utf8");
    const requiredVariables = [
      "--v2hp-plate-inset:",
      "--v2hp-plate-radius:",
      "--v2hp-plate-opacity:",
      "--v2hp-glyph-alpha:",
      "--v2hp-glyph-pop:",
    ];

    expect(css).toContain(".v2hp-b41__glyph-plate");
    expect(css).toContain("opacity: var(--v2hp-plate-opacity);");
    expect(css).toContain("border-radius: var(--v2hp-plate-radius);");
    expect(css).toContain("color: hsl(var(--foreground) / var(--v2hp-glyph-alpha));");
    expect(css).toContain("filter: var(--v2hp-glyph-pop);");

    const signatures = pictogramIds.map((pictogramId) => {
      const profileSelector = '.v2hp-b41[data-habit-pictogram="' + pictogramId + '"]';
      const profileStart = css.indexOf(profileSelector + " {");
      expect(profileStart, pictogramId).toBeGreaterThanOrEqual(0);
      const bodyStart = css.indexOf("{", profileStart) + 1;
      const bodyEnd = css.indexOf("\n}", bodyStart);
      const profileBlock = css.slice(bodyStart, bodyEnd);

      for (const variableName of requiredVariables) {
        expect(profileBlock, pictogramId + " " + variableName).toContain(variableName);
      }

      return requiredVariables
        .map((variableName) => {
          const line = profileBlock.split("\n").find((candidate) => candidate.trim().startsWith(variableName));
          return line?.split(":").slice(1).join(":").replace(";", "").trim() ?? "";
        })
        .join("|");
    });

    expect(new Set(signatures).size).toBe(pictogramIds.length);
  });

  it("defines a Option B liquid-glass totem system with varied physical shells, not one repeated generated sticker", () => {
    const css = readFileSync("src/index.css", "utf8");
    const requiredVariables = [
      "--v2hp-b50-shell-inset:",
      "--v2hp-b50-shell-radius:",
      "--v2hp-b50-shell-clip:",
      "--v2hp-b50-shell-rotate:",
      "--v2hp-b50-shell-scale-x:",
      "--v2hp-b50-shell-scale-y:",
      "--v2hp-b50-surface-inset:",
      "--v2hp-b50-glyph-inset:",
      "--v2hp-b50-glyph-scale:",
      "--v2hp-b50-glyph-x:",
      "--v2hp-b50-glyph-y:",
      "--v2hp-b50-highlight-rotate:",
      "--v2hp-b50-motion-x:",
      "--v2hp-b50-motion-y:",
    ];

    expect(css).toContain(".v2hp-b50__shell");
    expect(css).toContain(".v2hp-b50__surface");
    expect(css).toContain(".v2hp-b50__motion");
    expect(css).toContain(".v2hp-b50__highlight");
    expect(css).toContain(".v2hp-b50__glyph");
    expect(css).toContain('data-visual-upgrade="b54-real-source-artifact-system"');
    expect(css).toContain("animation: v2hp-b50-shell-lift");
    expect(css).toContain("animation: v2hp-b50-glyph-character");
    expect(css).toContain("clip-path: var(--v2hp-b50-shell-clip);");
    expect(css).toContain("transform: translate3d(var(--v2hp-b50-glyph-x), var(--v2hp-b50-glyph-y), 0) scale(var(--v2hp-b50-glyph-scale));");

    const clips: string[] = [];
    const radii: string[] = [];
    const signatures = pictogramIds.map((pictogramId) => {
      const profileSelector = '.v2hp-b41[data-habit-pictogram="' + pictogramId + '"]';
      const profileStart = css.indexOf(profileSelector + " {");
      expect(profileStart, pictogramId).toBeGreaterThanOrEqual(0);
      const bodyStart = css.indexOf("{", profileStart) + 1;
      const bodyEnd = css.indexOf("\n}", bodyStart);
      const profileBlock = css.slice(bodyStart, bodyEnd);

      for (const variableName of requiredVariables) {
        expect(profileBlock, pictogramId + " " + variableName).toContain(variableName);
      }

      const values = requiredVariables.map((variableName) => {
        const line = profileBlock.split("\n").find((candidate) => candidate.trim().startsWith(variableName));
        return line?.split(":").slice(1).join(":").replace(";", "").trim() ?? "";
      });
      clips.push(values[2]);
      radii.push(values[1]);
      return values.join("|");
    });

    expect(new Set(signatures).size).toBe(pictogramIds.length);
    expect(new Set(clips).size).toBeGreaterThanOrEqual(18);
    expect(new Set(radii).size).toBeGreaterThanOrEqual(14);
    expect(clips.filter((clip) => clip.includes("circle") || clip.includes("inset(0 round 999px)")).length).toBeLessThan(5);
  });



  it("defines Option B semantic storyboard motion for every supported pictogram without mini companion placement", () => {
    const css = readFileSync("src/index.css", "utf8");
    const requiredVariables = [
      "--v2hp-b51-shell-motion:",
      "--v2hp-b51-glyph-motion:",
      "--v2hp-b51-motif-motion:",
      "--v2hp-b51-motif-inset:",
      "--v2hp-b51-motif-clip:",
      "--v2hp-b51-motif-rotate:",
      "--v2hp-b62-storyboard-motion:",
      "--v2hp-b62-story-frame-a-inset:",
      "--v2hp-b62-story-frame-b-inset:",
      "--v2hp-b62-story-frame-c-inset:",
      "--v2hp-b62-story-frame-a-bg:",
      "--v2hp-b62-story-frame-b-bg:",
      "--v2hp-b62-story-frame-c-bg:",
    ];

    expect(css).toContain(".v2hp-b51__motif");
    expect(css).toContain(".v2hp-b62__story");
    expect(css).toContain(".v2hp-b62__story-a");
    expect(css).toContain(".v2hp-b62__story-b");
    expect(css).toContain(".v2hp-b62__story-c");
    expect(css).toContain("animation-name: var(--v2hp-b51-shell-motion);");
    expect(css).toContain("animation-name: var(--v2hp-b51-glyph-motion);");
    expect(css).toContain("animation-name: var(--v2hp-b51-motif-motion);");
    expect(css).toContain("animation-name: var(--v2hp-b62-storyboard-motion);");

    const shellMotions: string[] = [];
    const glyphMotions: string[] = [];
    const motifMotions: string[] = [];
    const motifClips: string[] = [];
    const storyboardMotions: string[] = [];
    const framePlacements: string[] = [];

    for (const pictogramId of pictogramIds) {
      const profileSelector = '.v2hp-b41[data-habit-pictogram="' + pictogramId + '"]';
      const profileStart = css.indexOf(profileSelector + " {");
      expect(profileStart, pictogramId).toBeGreaterThanOrEqual(0);
      const bodyStart = css.indexOf("{", profileStart) + 1;
      const bodyEnd = css.indexOf("\n}", bodyStart);
      const profileBlock = css.slice(bodyStart, bodyEnd);

      for (const variableName of requiredVariables) {
        expect(profileBlock, pictogramId + " " + variableName).toContain(variableName);
      }

      const valueFor = (variableName: string) => {
        const line = profileBlock.split("\n").find((candidate) => candidate.trim().startsWith(variableName));
        return line?.split(":").slice(1).join(":").replace(";", "").trim() ?? "";
      };

      const shellMotion = valueFor("--v2hp-b51-shell-motion:");
      const glyphMotion = valueFor("--v2hp-b51-glyph-motion:");
      const motifMotion = valueFor("--v2hp-b51-motif-motion:");
      const storyboardMotion = valueFor("--v2hp-b62-storyboard-motion:");
      shellMotions.push(shellMotion);
      glyphMotions.push(glyphMotion);
      motifMotions.push(motifMotion);
      motifClips.push(valueFor("--v2hp-b51-motif-clip:"));
      storyboardMotions.push(storyboardMotion);
      framePlacements.push(
        [
          valueFor("--v2hp-b62-story-frame-a-inset:"),
          valueFor("--v2hp-b62-story-frame-b-inset:"),
          valueFor("--v2hp-b62-story-frame-c-inset:"),
          valueFor("--v2hp-b62-story-frame-a-bg:"),
          valueFor("--v2hp-b62-story-frame-b-bg:"),
          valueFor("--v2hp-b62-story-frame-c-bg:"),
        ].join("|"),
      );
      expect(storyboardMotion).toBe(expectedStoryboardMotions[pictogramId]);
      expect(css).toContain("@keyframes " + shellMotion);
      expect(css).toContain("@keyframes " + glyphMotion);
      expect(css).toContain("@keyframes " + motifMotion);
      expect(css).toContain("@keyframes " + storyboardMotion);
    }

    expect(new Set(shellMotions).size).toBe(pictogramIds.length);
    expect(new Set(glyphMotions).size).toBe(pictogramIds.length);
    expect(new Set(motifMotions).size).toBe(pictogramIds.length);
    expect(new Set(motifClips).size).toBeGreaterThanOrEqual(18);
    expect(new Set(storyboardMotions).size).toBe(pictogramIds.length);
    expect(new Set(framePlacements).size).toBe(pictogramIds.length);
  });

  it("defines Telegram-grade micro-loop keyframes for every Option B habit storyboard", () => {
    const css = readFileSync("src/index.css", "utf8");

    expect(css).toContain("--v2hp-b62-story-duration: 2.8s;");
    expect(css).toContain("animation-duration: var(--v2hp-b62-story-duration);");
    expect(css).toContain("will-change: transform, opacity;");

    for (const pictogramId of pictogramIds) {
      const motionName = expectedStoryboardMotions[pictogramId];
      const block = extractKeyframeBlock(css, motionName);
      expect(block, motionName).toContain("transform:");
      expect(block, motionName).toContain("opacity:");
      expect(new Set(keyframeStops(block)).size, motionName).toBeGreaterThanOrEqual(9);
      expect(block, motionName).toMatch(/0% \{[^}]*opacity:[^}]*transform:/);
      expect(block, motionName).toMatch(/100% \{[^}]*opacity:[^}]*transform:/);

      const propertyNames = Array.from(block.matchAll(/\b([a-z-]+)\s*:/g)).map((match) => match[1]);
      const animatedProperties = propertyNames.filter((propertyName) => propertyName !== "keyframes");
      expect(new Set(animatedProperties), motionName).toEqual(new Set(["opacity", "transform"]));
    }
  });

  it("keeps Option B storyboard loops within Telegram-style duration limits", () => {
    const css = readFileSync("src/index.css", "utf8");
    const rootStart = css.indexOf(".v2hp-b41 {");
    expect(rootStart).toBeGreaterThanOrEqual(0);
    const rootBodyStart = css.indexOf("{", rootStart) + 1;
    const rootBodyEnd = css.indexOf("\n}", rootBodyStart);
    const rootBlock = css.slice(rootBodyStart, rootBodyEnd);
    const durationLine = rootBlock
      .split("\n")
      .find((line) => line.trim().startsWith("--v2hp-b62-story-duration:"));
    const durationSeconds = Number.parseFloat(durationLine?.split(":").slice(1).join(":") ?? "NaN");

    expect(durationSeconds).toBeGreaterThan(1.6);
    expect(durationSeconds).toBeLessThanOrEqual(3);
  });

  it("defines Option B liquid-glass totem material rules with real source hero glyphs instead of old badge templates", () => {
    const css = readFileSync("src/index.css", "utf8");

    expect(css).toContain('data-visual-upgrade="option-b-liquid-glass-totem-system"');
    expect(css).toContain("--v2hp-b62-glass-opacity: 0.74");
    expect(css).toContain("--v2hp-b62-refraction-opacity: 0.42");
    expect(css).toContain("--v2hp-b62-caustic-opacity: 0.34");
    expect(css).toContain("--v2hp-b62-hero-scale: 1.06");
    expect(css).toContain("--v2hp-b62-source-color-alpha: 0.98");
    expect(css).toContain("--v2hp-b62-contact-shadow-opacity: 0.28");
    expect(css).toContain('.v2hp-b41[data-visual-upgrade="option-b-liquid-glass-totem-system"] .v2hp-b62__totem');
    expect(css).toContain('.v2hp-b41[data-visual-upgrade="option-b-liquid-glass-totem-system"] .v2hp-b62__core');
    expect(css).toContain('.v2hp-b41[data-visual-upgrade="option-b-liquid-glass-totem-system"] .v2hp-b62__refraction');
    expect(css).toContain('.v2hp-b41[data-visual-upgrade="option-b-liquid-glass-totem-system"] .v2hp-b62__rim');
    expect(css).toContain('.v2hp-b41[data-visual-upgrade="option-b-liquid-glass-totem-system"] .v2hp-b62__caustic');
    expect(css).toContain('.v2hp-b41[data-visual-upgrade="option-b-liquid-glass-totem-system"] .v2hp-b62__foreground');
    expect(css).toContain('data-material-family="aqua-glass"');
    expect(css).toContain('data-material-family="brushed-brass"');
    expect(css).toContain('data-material-family="ink-paper"');
    expect(css).toContain("inset: var(--v2hp-b50-shell-inset);");
    expect(css).toContain("border-radius: var(--v2hp-b50-shell-radius);");
    expect(css).toContain("clip-path: var(--v2hp-b50-shell-clip);");
    expect(css).toContain("opacity: var(--v2hp-b62-glass-opacity);");
    expect(css).toContain("opacity: var(--v2hp-b62-refraction-opacity);");
    expect(css).toContain("color: hsl(var(--v2hp-b62-ink) / var(--v2hp-b62-source-color-alpha));");
    expect(css).not.toContain('.v2hp-b41[data-visual-upgrade="option-b-liquid-glass-totem-system"] .v2hp-b61__tile');
  });

  it("removes Option B mini companion icons and keeps motion frames CSS-only", () => {
    const css = readFileSync("src/index.css", "utf8");

    expect(css).toContain("data-companion-treatment=\"removed-no-mini-icon\"");
    expect(css).toContain("--v2hp-b62-storyboard-motion:");
    expect(css).toContain("--v2hp-b62-story-frame-a-bg:");
    expect(css).toContain("--v2hp-b62-story-frame-b-bg:");
    expect(css).toContain("--v2hp-b62-story-frame-c-bg:");
    expect(css).toContain(".v2hp-b62__story");
    expect(css).toContain("pointer-events: none;");
    expect(css).not.toContain('.v2hp-b41[data-visual-upgrade="option-b-liquid-glass-totem-system"] .v2hp-b52__accent-glyph');
    expect(css).not.toContain('data-companion-treatment="integrated-real-source-companion"');

    const rootStart = css.indexOf(".v2hp-b41 {");
    expect(rootStart).toBeGreaterThanOrEqual(0);
    const rootBodyStart = css.indexOf("{", rootStart) + 1;
    const rootBodyEnd = css.indexOf("\n}", rootBodyStart);
    const rootBlock = css.slice(rootBodyStart, rootBodyEnd);
    expect(rootBlock).toContain("--v2hp-b62-storyboard-motion:");
    expect(rootBlock).toContain("--v2hp-b62-story-frame-a-bg:");
  });

  it("defines a material object construction profile for every pictogram id", () => {
    const css = readFileSync("src/index.css", "utf8");
    const requiredVariables = [
      "--v2hp-core-angle:",
      "--v2hp-core-inset:",
      "--v2hp-rim-inset:",
      "--v2hp-accent-stage-inset:",
      "--v2hp-accent-stage-radius:",
    ];

    expect(css).toContain(".v2hp-b41__core");
    expect(css).toContain(".v2hp-b41__rim");
    expect(css).toContain(".v2hp-b41__accent-stage");
    expect(css).toContain("background: linear-gradient(var(--v2hp-core-angle)");
    expect(css).toContain("border-radius: var(--v2hp-accent-stage-radius);");

    const signatures = pictogramIds.map((pictogramId) => {
      const profileSelector = '.v2hp-b41[data-habit-pictogram="' + pictogramId + '"]';
      const profileStart = css.indexOf(profileSelector + " {");
      expect(profileStart, pictogramId).toBeGreaterThanOrEqual(0);
      const bodyStart = css.indexOf("{", profileStart) + 1;
      const bodyEnd = css.indexOf("\n}", bodyStart);
      const profileBlock = css.slice(bodyStart, bodyEnd);

      for (const variableName of requiredVariables) {
        expect(profileBlock, pictogramId + " " + variableName).toContain(variableName);
      }

      return requiredVariables
        .map((variableName) => {
          const line = profileBlock.split("\n").find((candidate) => candidate.trim().startsWith(variableName));
          return line?.split(":").slice(1).join(":").replace(";", "").trim() ?? "";
        })
        .join("|");
    });

    expect(new Set(signatures).size).toBe(pictogramIds.length);
  });

  it("maps old stored emoji values without rendering emoji text or rejected B39/B46/B47/B48 markers", () => {
    const { container } = render(<V2HabitPictogram value="💧" />);
    const root = container.querySelector('[data-habit-pictogram="drink-water"]');

    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("data-icon-source", "phosphor-icons-react-real-source-icon");
    expect(root).toHaveAttribute("data-pictogram-style", "option-b-liquid-glass-totem");
    expect(root).toHaveAttribute("data-approval-state", "candidate-option-b-pending-user-approval");
    expect(root).toHaveAttribute("data-icon-composition", "two-layer-real-source-svg-inside-liquid-glass-totem");
    expect(root?.querySelectorAll("svg")).toHaveLength(2);
    expect(root?.querySelector("[data-pictogram-layer='source-fill-relief']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='liquid-glass-totem-core']")).toBeInTheDocument();
    expect(root?.querySelector("[data-pictogram-layer='source-accent-glyph']")).not.toBeInTheDocument();
    expect(root?.getAttribute("data-motion-storyboard")).toBe("droplet-fill-ripple-cycle");
    expect(root?.innerHTML ?? "").not.toContain("b39");
    expect(root?.getAttribute("data-icon-treatment") ?? "").not.toContain("b46");
    expect(root?.getAttribute("data-icon-treatment") ?? "").not.toContain("b48");
    expect(root?.textContent ?? "").not.toMatch(legacyEmoji);
  });
});
