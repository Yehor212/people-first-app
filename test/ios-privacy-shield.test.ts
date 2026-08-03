// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sceneDelegate = readFileSync(resolve(process.cwd(), "ios/App/App/SceneDelegate.swift"), "utf8");

describe("iOS native privacy shield", () => {
  it("covers app content before inactive app-switcher snapshots and removes the cover on active", () => {
    expect(sceneDelegate).toContain("private var privacyShieldView");
    expect(sceneDelegate).toContain("showPrivacyShield()");
    expect(sceneDelegate).toContain("hidePrivacyShield()");
    expect(sceneDelegate).toContain("sceneWillResignActive");
    expect(sceneDelegate).toContain("sceneDidBecomeActive");
    expect(sceneDelegate).toContain("UIVisualEffectView");
    expect(sceneDelegate).toContain("UIBlurEffect");
    expect(sceneDelegate).toContain("window.addSubview(shield)");
    expect(sceneDelegate).toContain("privacyShieldView?.removeFromSuperview()");
  });
});
