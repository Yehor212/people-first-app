import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { V2HabitPictogram } from "../V2HabitPictogram";
import {
  APPROVED_HABIT_ANIMATED_RASTER_IDS,
  APPROVED_HABIT_LOTTIE_IDS,
  HABIT_LOTTIE_RUNTIME_ENABLED,
  APPROVED_HABIT_RASTER_IDS,
  REJECTED_HABIT_LOTTIE_IDS,
  REVIEW_CANDIDATE_HABIT_LOTTIE_IDS,
  V2_HABIT_ICON_ASSETS,
  getHabitIconAsset,
} from "../habitMotionAssets";
import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";

const pictogramIds = V2_HABIT_ICON_ASSETS.map((asset) => asset.id);
const assetModuleSource = readFileSync(
  "src/components/habit-pictogram/habitMotionAssets.ts",
  "utf8"
);
const approvedLottieIds = new Set<V2HabitPictogramId>(["drink-water", "read"]);
const approvedRasterIds = new Set<V2HabitPictogramId>();
const approvedAnimatedRasterIds = new Set<V2HabitPictogramId>();
const runtimeLottieIds = new Set<V2HabitPictogramId>();
const approvedMotionIds = new Set<V2HabitPictogramId>([
  ...approvedLottieIds,
  ...approvedRasterIds,
  ...approvedAnimatedRasterIds,
]);
const lockedIds = pictogramIds.filter((id) => !approvedMotionIds.has(id));
const legacyEmoji =
  /[💧🚶🏃👟🥾🤸🧘🪷🏋💪🥗🥚💊🪥🌅🌤🌿✍📝🙏✨🌬🫁📖📚📵🎧🎯🛏😴☕🧹🚭🚬🕯🍷🫗🎵🧠]/u;
const bannedRawShortcut =
  /(phosphor|lucide|heroicon|fontawesome|twemoji|noto|stock-source|template-source)/i;
const forbiddenRawFeature =
  /"ty":"sr"|"ty":5|"masksProperties"|"ef":\[|"chars":\[|"fonts"|"t\.d"|"u":"images?\/|"p":".*\.(png|webp|jpg|jpeg|gif)"/i;

type LottieShape = {
  nm?: string;
  ty?: string;
  it?: LottieShape[];
  ks?: { a?: number; k?: unknown };
  o?: { k?: unknown };
  p?: { k?: unknown };
  s?: { k?: unknown };
  r?: { k?: unknown };
};

type LottieAnimation = {
  v?: string;
  fr?: number;
  ip?: number;
  op?: number;
  w?: number;
  h?: number;
  nm?: string;
  assets?: unknown[];
  chars?: unknown[];
  fonts?: unknown;
  meta?: Record<string, unknown>;
  markers?: Array<{ cm?: string; tm?: number; dr?: number }>;
  layers?: Array<{
    nm?: string;
    ty?: number;
    ef?: unknown[];
    masksProperties?: unknown[];
    ks?: {
      o?: { k?: unknown };
      p?: { k?: unknown };
      s?: { k?: unknown };
      r?: { k?: unknown };
    };
    shapes?: LottieShape[];
  }>;
};

function readLottie(id: V2HabitPictogramId): LottieAnimation {
  return JSON.parse(
    readFileSync("src/assets/habit-icons/v2/" + id + "/idle.lottie.json", "utf8")
  ) as LottieAnimation;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function isAnimatedProperty(value: unknown) {
  if (!isObjectRecord(value)) return false;
  if (value.a === 1) return true;
  if (Array.isArray(value.k)) {
    return value.k.some(
      (item) => isObjectRecord(item) && Object.prototype.hasOwnProperty.call(item, "t")
    );
  }
  return false;
}

function countAnimatedProperties(value: unknown): number {
  if (!isObjectRecord(value)) return 0;
  let total = isAnimatedProperty(value) ? 1 : 0;
  const children = Array.isArray(value) ? value : Object.values(value);
  for (const item of children) total += countAnimatedProperties(item);
  return total;
}

function countShapeAnimatedChannels(shapes: LottieShape[] = []): number {
  return shapes.reduce(
    (count, shape) => count + countAnimatedProperties(shape) + countShapeAnimatedChannels(shape.it),
    0
  );
}

function collectShapes(shapes: LottieShape[] = []): LottieShape[] {
  return shapes.flatMap((shape) => [shape, ...collectShapes(shape.it)]);
}

function countShapeTypes(shapes: LottieShape[] = []): Record<string, number> {
  return shapes.reduce<Record<string, number>>((counts, shape) => {
    if (shape.ty) counts[shape.ty] = (counts[shape.ty] ?? 0) + 1;
    for (const [type, count] of Object.entries(countShapeTypes(shape.it))) {
      counts[type] = (counts[type] ?? 0) + count;
    }
    return counts;
  }, {});
}

function countAnimatedChannels(animation: LottieAnimation) {
  return (animation.layers ?? []).reduce((count, layer) => {
    return count + countAnimatedProperties(layer.ks) + countShapeAnimatedChannels(layer.shapes);
  }, 0);
}

describe("V2HabitPictogram", () => {
  it("keeps production habit icon metadata compact instead of importing the full audit manifest", () => {
    expect(assetModuleSource).not.toContain(
      'import manifest from "@/assets/habit-icons/v2/manifest.json"'
    );
    expect(assetModuleSource).toContain("STATIC_HABIT_IDS");
    expect(assetModuleSource).toContain("makeStaticAsset");
  });

  it("promotes confirmed Read/Drink Water Lotties and keeps Walk Distance locked after APNG rejection", () => {
    expect(HABIT_LOTTIE_RUNTIME_ENABLED).toBe(false);
    expect([...APPROVED_HABIT_LOTTIE_IDS].sort()).toEqual(["drink-water", "read"]);
    expect([...APPROVED_HABIT_RASTER_IDS]).toEqual([]);
    expect([...APPROVED_HABIT_ANIMATED_RASTER_IDS]).toEqual([]);
    expect([...REVIEW_CANDIDATE_HABIT_LOTTIE_IDS]).toEqual([]);
    expect([...REJECTED_HABIT_LOTTIE_IDS]).toEqual([
      "read-original-v91",
      "walk-distance",
      "walk-distance-animated-raster-v1",
      "walk-distance-kinetic-soles-v1",
    ]);
    expect(V2_HABIT_ICON_ASSETS).toHaveLength(22);

    const readAsset = getHabitIconAsset("read");
    expect(readAsset.idle.renderer).toBe("lottie");
    expect(readAsset.lottie).toBe("read/idle.lottie.json");
    expect(readAsset.source).toBe("user-confirmed-reference-derived-production/read");
    expect(readAsset.license).toBe("User-confirmed rights");
    expect(readAsset.referenceVariant).toBe("read/reference-derived.lottie.json");
    expect(readAsset).toMatchObject({
      reviewStatus: "approved-production-user-confirmed-no-logo",
      productionRights: "CONFIRMED_BY_USER_2026-06-22",
    });
    expect(readAsset.quality.layers).toBeGreaterThanOrEqual(48);
    expect(readAsset.quality.shapeRecords).toBeGreaterThanOrEqual(1200);
    expect(readAsset.quality.animatedChannels).toBeGreaterThanOrEqual(380);

    const waterAsset = getHabitIconAsset("drink-water");
    expect(waterAsset.idle.renderer).toBe("lottie");
    expect(waterAsset.lottie).toBe("drink-water/idle.lottie.json");
    expect(waterAsset.source).toBe(
      "zenflow-original-approved-lottie/drink-water-v29-continuous-entry"
    );
    expect(waterAsset.license).toBe("Original");
    expect(waterAsset.idle.name).toBe("v2hp-drink-water-continuous-entry-v29-approved");
    expect(waterAsset.quality.layers).toBeGreaterThanOrEqual(260);
    expect(waterAsset.quality.shapeRecords).toBeGreaterThanOrEqual(1800);
    expect(waterAsset.quality.animatedChannels).toBeGreaterThanOrEqual(2000);
    expect(existsSync("src/assets/habit-icons/v2/drink-water/idle.lottie.json")).toBe(true);

    const walkAsset = getHabitIconAsset("walk-distance");
    expect(walkAsset.idle.renderer).toBe("still");
    expect(walkAsset.lottie).toBeUndefined();
    expect(walkAsset.raster).toBeUndefined();
    expect(walkAsset.animatedRaster).toBeUndefined();
    expect(walkAsset.source).toBe(
      "zenflow-static-reduced-awaiting-lottie-approval/walk-distance"
    );
    expect(walkAsset.license).toBe("Original");
    expect(walkAsset.idle.name).toBe(
      "v2hp-locked-static-walk-distance-awaiting-lottie-approval"
    );
    expect(walkAsset.quality.frames).toBe(0);
    expect(walkAsset.quality.animatedChannels).toBe(0);

    lockedIds.forEach((id) => {
      const asset = getHabitIconAsset(id);
      expect(asset.idle.renderer).toBe("still");
      expect(asset.lottie).toBeUndefined();
      expect(asset.idle.bytes).toBe(0);
      expect(asset.quality.frames).toBe(0);
      expect(asset.quality.layers).toBe(0);
      expect(asset.quality.shapeRecords).toBe(0);
      expect(asset.quality.animatedChannels).toBe(0);
      expect(asset.source).toBe("zenflow-static-reduced-awaiting-lottie-approval/" + id);
      expect(existsSync("src/assets/habit-icons/v2/" + id + "/reduced.svg")).toBe(true);
    });
  });

  it.each(pictogramIds)("renders %s without rejected DOM motion stacks or emoji", (pictogramId) => {
    const { container } = render(<V2HabitPictogram pictogramId={pictogramId} />);
    const root = container.querySelector('[data-habit-pictogram="' + pictogramId + '"]');
    const asset = getHabitIconAsset(pictogramId);
    const approvedLottie = runtimeLottieIds.has(pictogramId);
    const approvedStaticLottieFallback =
      !HABIT_LOTTIE_RUNTIME_ENABLED && approvedLottieIds.has(pictogramId);
    const approvedRaster = approvedRasterIds.has(pictogramId);
    const approvedAnimatedRaster = approvedAnimatedRasterIds.has(pictogramId);
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute(
      "data-pictogram-style",
      approvedLottie
        ? "single-lottie-json-icon"
        : approvedAnimatedRaster
          ? "artist-grade-animated-raster-icon"
          : approvedRaster
            ? "artist-grade-raster-sticker-icon"
            : "locked-static-reduced-icon"
    );
    expect(root).toHaveAttribute(
      "data-icon-renderer",
      approvedLottie
        ? "lottie-svg-runtime"
        : approvedAnimatedRaster
          ? "animated-raster-apng"
          : approvedRaster
            ? "raster-webp-image"
            : "reduced-svg-still"
    );
    expect(root).toHaveAttribute(
      "data-design-contract",
      "no-emoji-no-dom-motion-stack-approval-gated-asset"
    );
    expect(root).toHaveAttribute(
      "data-motion-system",
      approvedLottie
        ? "approved-single-lottie-json"
        : approvedAnimatedRaster
          ? "approved-animated-raster-sequence"
          : approvedRaster
            ? "approved-raster-sticker"
            : approvedStaticLottieFallback
              ? "approved-lottie-static-fallback-runtime-disabled"
              : "locked-static-until-user-approval"
    );
    expect(root).toHaveAttribute("data-reduced-asset", asset.reduced);
    if (approvedLottie) {
      expect(root).toHaveAttribute("data-lottie-asset", asset.lottie);
      expect(root?.querySelector("[data-habit-lottie-player]")).toBeInTheDocument();
      expect(
        root?.querySelector('[data-habit-motion-still="' + pictogramId + '"]')
      ).not.toBeInTheDocument();
    } else if (approvedAnimatedRaster) {
      expect(root).not.toHaveAttribute("data-lottie-asset");
      expect(root).not.toHaveAttribute("data-raster-asset");
      expect(root).toHaveAttribute("data-animated-raster-asset", asset.animatedRaster?.idle);
      expect(root?.querySelector("[data-habit-lottie-player]")).not.toBeInTheDocument();
      expect(root?.querySelector("[data-habit-animated-raster]")).toBeInTheDocument();
      expect(root?.querySelector("[data-habit-raster-sticker]")).not.toBeInTheDocument();
      expect(
        root?.querySelector('[data-habit-motion-still="' + pictogramId + '"]')
      ).not.toBeInTheDocument();
    } else if (approvedRaster) {
      expect(root).not.toHaveAttribute("data-lottie-asset");
      expect(root).toHaveAttribute("data-raster-asset", asset.raster);
      expect(root?.querySelector("[data-habit-lottie-player]")).not.toBeInTheDocument();
      expect(root?.querySelector("[data-habit-raster-sticker]")).toBeInTheDocument();
      expect(
        root?.querySelector('[data-habit-motion-still="' + pictogramId + '"]')
      ).not.toBeInTheDocument();
    } else {
      expect(root).not.toHaveAttribute("data-lottie-asset");
      expect(root?.querySelector("[data-habit-lottie-player]")).not.toBeInTheDocument();
      expect(
        root?.querySelector('[data-habit-motion-still="' + pictogramId + '"]')
      ).toBeInTheDocument();
    }
    expect(root?.querySelector("[data-pictogram-layer]")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-telegram-motion-stage]")).not.toBeInTheDocument();
    expect(root?.querySelector("[data-motion-part]")).not.toBeInTheDocument();
    expect(root?.querySelector(".v2hp-b63__scene")).not.toBeInTheDocument();
    expect(root?.textContent ?? "").not.toMatch(legacyEmoji);
  });

  it("records the Read animation as user-confirmed approved production art", () => {
    const readPath = "src/assets/habit-icons/v2/read/idle.lottie.json";
    const raw = readFileSync(readPath, "utf8");
    const read = JSON.parse(raw) as LottieAnimation;
    const readAsset = getHabitIconAsset("read");
    const layerNames = read.layers?.map((layer) => layer.nm ?? "") ?? [];

    expect(readAsset.source).toBe("user-confirmed-reference-derived-production/read");
    expect(readAsset.license).toBe("User-confirmed rights");
    expect(readAsset.referenceVariant).toBe("read/reference-derived.lottie.json");
    expect(existsSync("src/assets/habit-icons/v2/read/reference-rig.lottie.json")).toBe(false);
    expect(raw).toContain("telegram-animoji.tgs");
    expect(raw).toContain("user-confirmed-reference-derived-production-use");
    expect(raw).not.toContain("reference-rig");
    expect(read.nm).toBe("v2hp-lottie-read-reference-derived-review-v1");
    expect(read.meta).toMatchObject({
      generator: "zenflow-read-reference-derived-free-toolchain-v1",
      sourcePolicy: "user-confirmed-reference-derived-production-use",
      productionRights: "CONFIRMED_BY_USER_2026-06-22",
      copiedOrTracedReference: true,
      productionApprovalAllowedWithoutRightsConfirmation: true,
      purpose: "approved read habit animation",
      coverLogoPolicy: "removed-after-visual-rejection",
      coverTreatment: "premium-clothbound-book-cover-without-logo-or-brand-mark",
    });
    expect(layerNames).toEqual(
      expect.arrayContaining(["Cover Opened", "Front R", "Front L", "Page R", "Page L"])
    );
  });

  it("keeps the approved Read Lottie Telegram-safe", () => {
    const readPath = "src/assets/habit-icons/v2/read/idle.lottie.json";
    const raw = readFileSync(readPath, "utf8");
    const read = JSON.parse(raw) as LottieAnimation;
    const layerNames = read.layers?.map((layer) => layer.nm ?? "") ?? [];
    const shapes = read.layers?.flatMap((layer) => collectShapes(layer.shapes)) ?? [];
    const shapeTypes = countShapeTypes(shapes);

    expect(raw).not.toMatch(forbiddenRawFeature);
    expect(raw).not.toMatch(bannedRawShortcut);
    expect(getHabitIconAsset("read").source).toBe(
      "user-confirmed-reference-derived-production/read"
    );
    expect(read.nm).toBe("v2hp-lottie-read-reference-derived-review-v1");
    expect(read.fr).toBe(60);
    expect(read.ip).toBe(0);
    expect(read.op).toBe(179);
    expect(read.w).toBe(512);
    expect(read.h).toBe(512);
    expect(read.meta).toMatchObject({
      sourcePolicy: "user-confirmed-reference-derived-production-use",
      productionRights: "CONFIRMED_BY_USER_2026-06-22",
      productionApprovalAllowedWithoutRightsConfirmation: true,
      faceOrPersonGlyphsAllowed: false,
      genericFloatPulseAllowed: false,
      copiedOrTracedReference: true,
      coverLogoPolicy: "removed-after-visual-rejection",
    });
    expect(read.markers ?? []).toEqual([]);
    expect(layerNames).toEqual(
      expect.arrayContaining([
        "Yellow Thing",
        "Middle",
        "Text R",
        "Page L 8",
        "Page R 13",
        "Cover Opened",
      ])
    );
    expect(read.layers?.length ?? 0).toBeGreaterThanOrEqual(48);
    expect(shapes.length).toBeGreaterThanOrEqual(1200);
    expect(shapeTypes.sh).toBeGreaterThanOrEqual(300);
    expect(shapeTypes.st).toBeGreaterThanOrEqual(280);
    expect(shapeTypes.gf).toBeGreaterThanOrEqual(20);
    expect(shapeTypes.tm).toBeGreaterThanOrEqual(29);
    expect(countAnimatedChannels(read)).toBeGreaterThanOrEqual(380);
    expect(gzipSync(raw).length).toBeLessThanOrEqual(64 * 1024);
  });

  it("uses no Telegram-hostile Lottie features in the approved Read candidate", () => {
    const read = readLottie("read");
    const shapes = read.layers?.flatMap((layer) => collectShapes(layer.shapes)) ?? [];

    expect(read.assets ?? []).toEqual([]);
    expect(read.chars).toBeUndefined();
    expect(read.fonts).toBeUndefined();
    expect(read.layers?.some((layer) => layer.ty === 5)).toBe(false);
    expect(read.layers?.some((layer) => (layer.ef?.length ?? 0) > 0)).toBe(false);
    expect(read.layers?.some((layer) => (layer.masksProperties?.length ?? 0) > 0)).toBe(false);
    expect(shapes.some((shape) => shape.ty === "sr")).toBe(false);
  });

  it("keeps Walk Distance blocked from APNG runtime approval until a true TGS/Lottie rig exists", () => {
    const rejectedLottiePath = "src/assets/habit-icons/v2/walk-distance/idle.lottie.json";
    const walkAsset = getHabitIconAsset("walk-distance");

    expect(walkAsset.source).toBe(
      "zenflow-static-reduced-awaiting-lottie-approval/walk-distance"
    );
    expect(walkAsset.idle.name).toBe(
      "v2hp-locked-static-walk-distance-awaiting-lottie-approval"
    );
    expect(walkAsset.lottie).toBeUndefined();
    expect(walkAsset.raster).toBeUndefined();
    expect(walkAsset.animatedRaster).toBeUndefined();
    expect(assetModuleSource).not.toContain(
      'lottie: "walk-distance/idle.lottie.json"'
    );
    expect(assetModuleSource).not.toContain("walk-distance/animated/idle.apng");
    expect(assetModuleSource).not.toContain(
      "v2hp-walk-distance-sneaker-road-step-animated-raster-v1-approved"
    );
    if (existsSync(rejectedLottiePath)) {
      const rejectedRaw = readFileSync(rejectedLottiePath, "utf8");
      expect(rejectedRaw).toContain('"rejectedReason":"procedural-code-drawn-not-read-quality"');
    }
  });

  it("uses the reduced SVG still when motion is disabled", () => {
    const { container } = render(<V2HabitPictogram pictogramId="read" motionAllowed={false} />);
    const root = container.querySelector('[data-habit-pictogram="read"]');

    expect(root?.querySelector("[data-habit-lottie-player]")).not.toBeInTheDocument();
    expect(root?.querySelector('[data-habit-motion-still="read"]')).toBeInTheDocument();
  });

  it("labels non-decorative icons from the asset label", () => {
    const { container } = render(
      <V2HabitPictogram pictogramId="quit-smoking" decorative={false} />
    );
    const root = container.querySelector('[data-habit-pictogram="quit-smoking"]');

    expect(root).toHaveAttribute("role", "img");
    expect(root).toHaveAttribute("aria-label", "Quit smoking");
  });

  it("keeps only the live V2 habit motion CSS contracts", () => {
    const { container } = render(<V2HabitPictogram pictogramId="walk-distance" />);
    const root = container.querySelector('[data-habit-pictogram="walk-distance"]');
    const css = readFileSync("src/index.css", "utf8");

    const legacyPrototypeSelectors = css.match(/\.v2hp-b\d+[\w-]*/g) ?? [];
    const prototypeKeyframes = Array.from(
      css.matchAll(/@keyframes\s+(v2hp-(?:b\d+|fallback)-[\w-]+)/g),
      (match) => match[1]
    ).sort();

    expect(root).not.toHaveAttribute("data-visual-upgrade", "option-b-liquid-glass-totem-system");
    expect(root?.querySelector(".v2hp-b62__foreground")).not.toBeInTheDocument();
    expect(root?.querySelector(".v2hp-b63__scene")).not.toBeInTheDocument();
    expect(legacyPrototypeSelectors).toEqual([]);
    expect(prototypeKeyframes).toEqual([
      "v2hp-b41-hero-facet",
      "v2hp-b41-hero-float",
      "v2hp-b41-hero-plate",
    ]);

    expect(css).toContain(".v2hp-motion-player__still,");
    expect(css).toContain('.v2hp-motion-player[data-renderer="still"]');
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.v2hp-motion-player\s*\{\s*animation: none;/
    );
    expect(css).toContain(".journal-memory-field {");
    expect(css).toContain("@keyframes journal-memory-field-paper-drift");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after/
    );
  });
});
