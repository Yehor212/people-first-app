import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const assetRoot = resolve(process.cwd(), "src/assets/journal/save-ceremony");

const expectedAssets = [
  {
    file: "atelier-v12-3-night.tgs",
    bytes: 37_872,
    sha256: "7047a29d245c165315d49f3de5102c37406b78a9b5a95437ca20fa5db1d2bc28",
  },
  {
    file: "atelier-v12-3-day.tgs",
    bytes: 37_779,
    sha256: "a55c998596f8210664d51f8eb51eb40a090dbc4dc76d8ea7109cdd30098d1170",
  },
  {
    file: "atelier-v12-3-night-reduced.svg",
    bytes: 112_948,
    sha256: "35d097507bcbcd4198fb1717ddce63253a69fec3ff01eaf598fe24648aab6c61",
  },
  {
    file: "atelier-v12-3-day-reduced.svg",
    bytes: 118_821,
    sha256: "7aaac329edc6efcf4a7898b6aa8a7abec6c23311c62c046444d0a8694d95a9e6",
  },
] as const;

describe("hash-bound journal save ceremony assets", () => {
  it.each(expectedAssets)("$file matches the approved bytes and SHA-256", (asset) => {
    const bytes = readFileSync(resolve(assetRoot, asset.file));
    expect(bytes.byteLength).toBe(asset.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
  });

  it.each(expectedAssets.filter((asset) => asset.file.endsWith(".tgs")))(
    "$file is the approved 512px, 60fps, three-second vector composition",
    (asset) => {
      const compressed = readFileSync(resolve(assetRoot, asset.file));
      const animation = JSON.parse(gunzipSync(compressed).toString("utf8")) as {
        w: number;
        h: number;
        fr: number;
        ip: number;
        op: number;
      };

      expect(animation).toMatchObject({ w: 512, h: 512, fr: 60, ip: 0, op: 180 });
    },
  );
});
