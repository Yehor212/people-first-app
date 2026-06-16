// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appDelegate = readFileSync(resolve(process.cwd(), "ios/App/App/AppDelegate.swift"), "utf8");

describe("iOS native privacy shield", () => {
  it("covers app content before inactive app-switcher snapshots and removes the cover on active", () => {
    expect(appDelegate).toContain("private var privacyShieldView");
    expect(appDelegate).toContain("showPrivacyShield()");
    expect(appDelegate).toContain("hidePrivacyShield()");
    expect(appDelegate).toContain("applicationWillResignActive");
    expect(appDelegate).toContain("applicationDidBecomeActive");
    expect(appDelegate).toContain("UIVisualEffectView");
    expect(appDelegate).toContain("UIBlurEffect");
    expect(appDelegate).toContain("window.addSubview(shield)");
    expect(appDelegate).toContain("privacyShieldView?.removeFromSuperview()");
  });
});
