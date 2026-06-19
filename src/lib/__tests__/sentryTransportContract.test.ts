import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REQUIRED_SENTRY_ORIGINS = [
  "https://*.sentry.io",
  "https://*.ingest.sentry.io",
  "https://*.ingest.us.sentry.io",
  "https://*.ingest.de.sentry.io",
] as const;

function readIndexConnectSrcOrigins(): string[] {
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const cspMatch = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/
  );

  expect(cspMatch, "index.html must define a Content-Security-Policy meta tag").not.toBeNull();

  const connectSrc = cspMatch?.[1]
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("connect-src "));

  expect(connectSrc, "CSP must include connect-src").toBeTruthy();

  return connectSrc?.split(/\s+/).slice(1) ?? [];
}

function readNativeAccessOrigins(scriptName: string): string[] {
  const source = readFileSync(join(process.cwd(), "scripts", scriptName), "utf8");
  const originsMatch = source.match(/const ALLOWED_ACCESS_ORIGINS = \[([\s\S]*?)\];/);

  expect(originsMatch, `${scriptName} must expose ALLOWED_ACCESS_ORIGINS`).not.toBeNull();

  return Array.from(originsMatch?.[1].matchAll(/"([^"]+)"/g) ?? [], (match) => match[1]);
}

describe("sentry transport contract", () => {
  it("allows Sentry ingest origins used by unregioned, US, and EU DSNs", () => {
    const webOrigins = readIndexConnectSrcOrigins();
    const androidOrigins = readNativeAccessOrigins("normalize-android-config.cjs");
    const iosOrigins = readNativeAccessOrigins("normalize-ios-config.cjs");

    for (const origin of REQUIRED_SENTRY_ORIGINS) {
      expect(webOrigins, `index.html connect-src should include ${origin}`).toContain(origin);
      expect(androidOrigins, `Android access origins should include ${origin}`).toContain(origin);
      expect(iosOrigins, `iOS access origins should include ${origin}`).toContain(origin);
    }
  });
});
