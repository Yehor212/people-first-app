import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const requireForScript = createRequire(import.meta.url);
const scriptPath = join(process.cwd(), "scripts/normalize-android-config.cjs");

function writeFixture(root: string, file: string, source: string) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
}

function runNormalizeAndroidConfig(root: string): string[] {
  const logs: string[] = [];
  vm.runInNewContext(readFileSync(scriptPath, "utf8"), {
    __dirname: join(root, "scripts"),
    __filename: join(root, "scripts/normalize-android-config.cjs"),
    console: {
      log(message: string) {
        logs.push(message);
      },
    },
    process: { cwd: () => root },
    require: requireForScript,
  });
  return logs;
}

describe("normalize-android-config", () => {
  it("replaces generated wildcard access with explicit least-privilege origins", () => {
    const root = mkdtempSync(join(tmpdir(), "normalize-android-config-"));
    writeFixture(
      root,
      "android/app/src/main/res/xml/config.xml",
      [
        "<?xml version='1.0' encoding='utf-8'?>",
        '<widget version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">',
        '  <access origin="*" />',
        "</widget>",
      ].join("\n"),
    );

    const logs = runNormalizeAndroidConfig(root);
    const config = readFileSync(join(root, "android/app/src/main/res/xml/config.xml"), "utf8");

    expect(logs[0]).toContain("normalized android/app/src/main/res/xml/config.xml access origins");
    expect(config).not.toContain('<access origin="*" />');
    expect(config).toContain('<access origin="https://*.supabase.co" />');
    expect(config).toContain('<access origin="wss://*.supabase.co" />');
    expect(config).toContain('<access origin="https://api.zenflowapp.online" />');
    expect(config).toContain('<access origin="https://www.googleapis.com" />');
    expect(config).not.toContain('<access origin="https://*.googleapis.com" />');
    expect(config).toContain('<access origin="https://fonts.gstatic.com" />');
  });

  it("normalizes compact generated access tags on the widget line", () => {
    const root = mkdtempSync(join(tmpdir(), "normalize-android-config-"));
    writeFixture(
      root,
      "android/app/src/main/res/xml/config.xml",
      [
        "<?xml version='1.0' encoding='utf-8'?>",
        '<widget version="1.0.0" xmlns="http://www.w3.org/ns/widgets"><access origin="*" /><name>ZenFlow</name></widget>',
      ].join("\n"),
    );

    const logs = runNormalizeAndroidConfig(root);
    const config = readFileSync(join(root, "android/app/src/main/res/xml/config.xml"), "utf8");

    expect(logs[0]).toContain("normalized android/app/src/main/res/xml/config.xml access origins");
    expect(config).not.toContain('<access origin="*" />');
    expect(config).toContain('<access origin="https://*.supabase.co" />');
    expect(config).toContain("<name>ZenFlow</name>");
  });
});
