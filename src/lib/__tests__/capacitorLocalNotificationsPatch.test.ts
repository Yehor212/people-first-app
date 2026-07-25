import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Capacitor local-notification reliability patch", () => {
  it("reapplies the audited dependency patch after every install", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts?.postinstall).toBe(
      "node node_modules/patch-package/index.js --error-on-fail",
    );
    expect(packageJson.devDependencies?.["patch-package"]).toBe("^8.0.1");
    expect(read("patches/@capacitor+local-notifications+8.1.0.patch")).toContain(
      "DEFAULT_NOTIFICATION_URI",
    );
  });

  it("uses the Android system notification sound when the channel requests default", () => {
    const source = read(
      "node_modules/@capacitor/local-notifications/android/src/main/java/com/capacitorjs/plugins/localnotifications/NotificationChannelManager.java",
    );

    expect(source).toContain("Settings.System.DEFAULT_NOTIFICATION_URI");
    expect(source).toContain('"default".equals(sound)');
  });

  it("uses the iOS system sound and resolves scheduling only after every native completion", () => {
    const source = read(
      "node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsPlugin.swift",
    );
    const schedule = source.slice(
      source.indexOf("@objc func schedule"),
      source.indexOf("@objc override public func requestPermissions"),
    );

    expect(source).toContain('sound == "default"');
    expect(source).toContain("? .default");
    expect(schedule).toContain("DispatchGroup()");
    expect(schedule).toContain("group.notify");
    expect(schedule.indexOf("group.notify")).toBeLessThan(schedule.lastIndexOf("call.resolve"));
  });
});
