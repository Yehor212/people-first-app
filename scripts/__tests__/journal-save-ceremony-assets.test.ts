import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const checker = resolve(root, "scripts/check-journal-save-ceremony-assets.cjs");

describe("journal save ceremony build asset gate", () => {
  it("validates the exact approved production assets", () => {
    const result = spawnSync(process.execPath, [checker], {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("4 hash-bound assets verified");
  });

  it("runs before every web and native build entrypoint", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const name of ["prebuild", "prebuild:dev", "prebuild:android", "prebuild:ios"]) {
      expect(pkg.scripts[name]).toBe("npm run check:journal-save-ceremony-assets");
    }
  });

  it("fails closed when one approved asset byte changes", () => {
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), "journal-save-ceremony-assets-"));
    try {
      cpSync(
        resolve(root, "src/assets/journal/save-ceremony"),
        temporaryRoot,
        { recursive: true },
      );
      const target = resolve(temporaryRoot, "atelier-v12-3-night.tgs");
      const bytes = readFileSync(target);
      bytes[bytes.length - 1] ^= 1;
      writeFileSync(target, bytes);

      const result = spawnSync(
        process.execPath,
        [checker, "--asset-root", temporaryRoot],
        { cwd: root, encoding: "utf8", timeout: 30_000 },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("differs from the approved byte/hash record");
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("rejects a paired asset and mutable-manifest substitution", () => {
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), "journal-save-ceremony-assets-"));
    try {
      cpSync(
        resolve(root, "src/assets/journal/save-ceremony"),
        temporaryRoot,
        { recursive: true },
      );
      const target = resolve(temporaryRoot, "atelier-v12-3-night-reduced.svg");
      const replacement = Buffer.concat([
        readFileSync(target),
        Buffer.from("\n<!-- substituted -->\n"),
      ]);
      writeFileSync(target, replacement);

      const manifestPath = resolve(temporaryRoot, "manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        assets: {
          night: {
            reduced: { bytes: number; sha256: string };
          };
        };
      };
      manifest.assets.night.reduced.bytes = replacement.byteLength;
      manifest.assets.night.reduced.sha256 = createHash("sha256")
        .update(replacement)
        .digest("hex");
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const result = spawnSync(
        process.execPath,
        [checker, "--asset-root", temporaryRoot],
        { cwd: root, encoding: "utf8", timeout: 30_000 },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("does not match the independent trust anchor");
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
