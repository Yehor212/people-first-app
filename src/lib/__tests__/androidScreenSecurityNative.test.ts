import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Android native diary screen security", () => {
  it("backs the Android Block Screenshots diary toggle with a native FLAG_SECURE plugin", () => {
    const pluginPath = "android/app/src/main/java/com/zenflow/app/ScreenSecurityPlugin.java";

    expect(existsSync(resolve(process.cwd(), pluginPath))).toBe(true);

    const pluginSource = readSource(pluginPath);
    const activitySource = readSource("android/app/src/main/java/com/zenflow/app/MainActivity.java");

    expect(pluginSource).toContain('@CapacitorPlugin(name = "ScreenSecurity")');
    expect(pluginSource).toContain("WindowManager.LayoutParams.FLAG_SECURE");
    expect(pluginSource).toContain("window.addFlags");
    expect(pluginSource).toContain("window.clearFlags");
    expect(pluginSource).toContain("getBridge().executeOnMainThread");
    expect(activitySource).toContain("registerPlugin(ScreenSecurityPlugin.class);");

    const screenSecurityRegisterIndex = activitySource.indexOf("registerPlugin(ScreenSecurityPlugin.class);");
    const bridgeCreateIndex = activitySource.indexOf("super.onCreate(savedInstanceState);");
    expect(screenSecurityRegisterIndex).toBeGreaterThanOrEqual(0);
    expect(bridgeCreateIndex).toBeGreaterThanOrEqual(0);
    expect(screenSecurityRegisterIndex).toBeLessThan(bridgeCreateIndex);
  });
});
