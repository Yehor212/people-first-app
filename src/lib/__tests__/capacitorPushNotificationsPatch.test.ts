import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Capacitor push notifications missing-Firebase patch", () => {
  it("ships the Android crash containment through the pinned patch-package pipeline", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const patch = read("patches/@capacitor+push-notifications+8.0.4.patch");

    expect(packageJson.scripts?.postinstall).toBe(
      "node node_modules/patch-package/index.js --error-on-fail",
    );
    expect(packageJson.dependencies?.["@capacitor/push-notifications"]).toBe("^8.0.0");
    expect(packageJson.devDependencies?.["patch-package"]).toBe("^8.0.1");
    expect(patch).toContain("PushNotificationsPlugin.java");
    expect(patch.match(/catch \(IllegalStateException exception\)/g)).toHaveLength(2);
    expect(patch.match(/FIREBASE_NOT_CONFIGURED/g)).toHaveLength(2);
    expect(patch).not.toContain("android/build/");
  });
});
