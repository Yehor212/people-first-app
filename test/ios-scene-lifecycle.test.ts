// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const appDelegate = read("ios/App/App/AppDelegate.swift");
const sceneDelegate = read("ios/App/App/SceneDelegate.swift");
const infoPlist = read("ios/App/App/Info.plist");
const xcodeProject = read("ios/App/App.xcodeproj/project.pbxproj");

describe("iOS scene lifecycle", () => {
  it("registers the application scene and compiles its delegate", () => {
    expect(infoPlist).toContain("<key>UIApplicationSceneManifest</key>");
    expect(infoPlist).toContain("<key>UISceneConfigurations</key>");
    expect(infoPlist).toContain("<key>UIWindowSceneSessionRoleApplication</key>");
    expect(infoPlist).toContain("$(PRODUCT_MODULE_NAME).SceneDelegate");
    expect(infoPlist).toContain("<string>Main</string>");

    expect(appDelegate).toContain("configurationForConnecting");
    expect(appDelegate).toContain("UISceneConfiguration");
    expect(xcodeProject).toContain("SceneDelegate.swift");
    expect(xcodeProject).toContain("SceneDelegate.swift in Sources");
  });

  it("preserves Capacitor deep-link forwarding for warm and cold scene launches", () => {
    expect(sceneDelegate).toContain("connectionOptions.urlContexts");
    expect(sceneDelegate).toContain("connectionOptions.userActivities");
    expect(sceneDelegate).toContain("openURLContexts");
    expect(sceneDelegate).toContain("continue userActivity");
    expect(sceneDelegate).toContain("ApplicationDelegateProxy.shared.application");
  });
});
