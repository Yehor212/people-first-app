import { gunzipSync } from "node:zlib";

export interface TgsTargetFacts {
  width?: unknown;
  height?: unknown;
  fps?: unknown;
  frames?: unknown;
  deliveryProfile?: unknown;
}

export interface TgsFinding {
  rule: string;
  detail: string;
}

const MAX_COMPRESSED_MASTER_BYTES = 16 * 1024 * 1024;
const MAX_DECOMPRESSED_MASTER_BYTES = 64 * 1024 * 1024;
const MAX_INSPECTED_NODES = 8_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unsupportedFeature(animation: Record<string, unknown>): string | null {
  if (animation.chars || animation.fonts) return "text characters or fonts";
  if (Array.isArray(animation.assets)) {
    for (const asset of animation.assets) {
      if (!isRecord(asset)) return "malformed asset";
      if (typeof asset.p === "string" || typeof asset.u === "string" || asset.e === 1) {
        return "raster or external asset";
      }
      if (!Array.isArray(asset.layers)) return "non-vector asset";
    }
  }

  const stack: unknown[] = [animation];
  let inspected = 0;
  while (stack.length > 0) {
    const value = stack.pop();
    if (++inspected > MAX_INSPECTED_NODES) return "unbounded structure";
    if (Array.isArray(value)) {
      for (const entry of value) stack.push(entry);
      continue;
    }
    if (!isRecord(value)) continue;
    if (typeof value.x === "string" || typeof value.expression === "string") {
      return "expression";
    }
    if (value.ddd && value.ddd !== 0) return "3D layer";
    if (Array.isArray(value.masksProperties) && value.masksProperties.length > 0) {
      return "mask";
    }
    if (Array.isArray(value.ef) && value.ef.length > 0) return "layer effect";
    if (typeof value.ty === "number" && ![0, 3, 4].includes(value.ty)) {
      return `unsupported layer type ${value.ty}`;
    }
    if (typeof value.ty === "string" && ["gs", "mm", "rp", "sr"].includes(value.ty)) {
      return `unsupported shape primitive ${value.ty}`;
    }
    if (typeof value.sr === "number" && value.sr !== 1) return "time stretch";
    if (Object.hasOwn(value, "tm") && typeof value.ty === "number") {
      return "layer time remapping";
    }
    for (const entry of Object.values(value)) stack.push(entry);
  }
  return null;
}

export function inspectTgsArtifact(bytes: Buffer, target: TgsTargetFacts): TgsFinding[] {
  if (bytes.byteLength > MAX_COMPRESSED_MASTER_BYTES) {
    return [
      {
        rule: "visual-proof-tgs-bounds",
        detail: `TGS exceeds the ${MAX_COMPRESSED_MASTER_BYTES}-byte guarded inspection ceiling.`,
      },
    ];
  }

  let animation: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(
      gunzipSync(bytes, { maxOutputLength: MAX_DECOMPRESSED_MASTER_BYTES }).toString("utf8")
    );
    if (!isRecord(parsed)) throw new Error("root is not an object");
    animation = parsed;
  } catch {
    return [
      {
        rule: "visual-proof-tgs-parse",
        detail: "TGS is not bounded, valid gzip-compressed Lottie JSON.",
      },
    ];
  }

  const findings: TgsFinding[] = [];
  const expected = [
    ["w", target.width],
    ["h", target.height],
    ["fr", target.fps],
  ] as const;
  for (const [field, value] of expected) {
    if (typeof value === "number" && animation[field] !== value) {
      findings.push({
        rule: "visual-proof-tgs-metadata",
        detail: `TGS ${field} does not match target ${value}.`,
      });
    }
  }
  const frameCount =
    typeof animation.op === "number" && typeof animation.ip === "number"
      ? animation.op - animation.ip
      : null;
  if (typeof target.frames === "number" && frameCount !== target.frames) {
    findings.push({
      rule: "visual-proof-tgs-metadata",
      detail: `TGS frame range does not match target ${target.frames}.`,
    });
  }
  if (!Array.isArray(animation.layers) || animation.ddd !== 0) {
    findings.push({
      rule: "visual-proof-tgs-structure",
      detail: "TGS must be 2D Lottie JSON with a layers array.",
    });
  }
  const feature = unsupportedFeature(animation);
  if (feature) {
    findings.push({
      rule: "visual-proof-tgs-feature",
      detail: `TGS contains a Telegram-hostile feature: ${feature}.`,
    });
  }
  if (target.deliveryProfile === "telegram-compact" && bytes.byteLength > 64 * 1024) {
    findings.push({
      rule: "visual-proof-telegram-size",
      detail: "Compact Telegram TGS exceeds 64 KiB.",
    });
  }
  return findings;
}
