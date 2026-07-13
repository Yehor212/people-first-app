import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("iOS StatusBarStyle native bridge", () => {
  it("registers a Capacitor plugin that updates the host view controller on the main thread", () => {
    const plugin = readProjectFile("ios/App/App/StatusBarStylePlugin.swift");
    const controller = readProjectFile("ios/App/App/BridgeViewController.swift");

    expect(plugin).toContain("class StatusBarStylePlugin: CAPPlugin, CAPBridgedPlugin");
    expect(plugin).toContain('public let jsName = "StatusBarStyle"');
    expect(plugin).toContain('CAPPluginMethod(name: "setStyle"');
    expect(plugin).toContain("DispatchQueue.main.async");
    expect(plugin).toContain("updateStatusBarStyle");
    expect(controller).toContain("bridge?.registerPluginInstance(StatusBarStylePlugin())");
    expect(controller).toContain("override var preferredStatusBarStyle: UIStatusBarStyle");
    expect(controller).toContain("setNeedsStatusBarAppearanceUpdate()");
  });

  it("compiles the native plugin as part of the iOS application target", () => {
    const project = readProjectFile("ios/App/App.xcodeproj/project.pbxproj");

    expect(project).toContain("StatusBarStylePlugin.swift in Sources");
    expect(project).toContain("StatusBarStylePlugin.swift");
  });
});
