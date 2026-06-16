import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("iOS diary biometric unlock bridge", () => {
  it("backs the diary biometric lock with a registered native iOS Face ID plugin", () => {
    const pluginPath = "ios/App/App/BiometricAuthPlugin.swift";
    const bridgePath = "ios/App/App/BridgeViewController.swift";

    expect(existsSync(resolve(process.cwd(), pluginPath))).toBe(true);
    expect(existsSync(resolve(process.cwd(), bridgePath))).toBe(true);

    const pluginSource = readSource(pluginPath);
    const bridgeSource = readSource(bridgePath);
    const storyboard = readSource("ios/App/App/Base.lproj/Main.storyboard");
    const project = readSource("ios/App/App.xcodeproj/project.pbxproj");

    expect(pluginSource).toContain("import LocalAuthentication");
    expect(pluginSource).toContain("public class BiometricAuthPlugin: CAPPlugin, CAPBridgedPlugin");
    expect(pluginSource).toContain('public let jsName = "BiometricAuth"');
    expect(pluginSource).toContain('CAPPluginMethod(name: "isAvailable"');
    expect(pluginSource).toContain('CAPPluginMethod(name: "authenticate"');
    expect(pluginSource).toContain(".deviceOwnerAuthenticationWithBiometrics");
    expect(pluginSource).toContain(".faceID");
    expect(pluginSource).toContain(".touchID");

    expect(bridgeSource).toContain("class BridgeViewController: CAPBridgeViewController");
    expect(bridgeSource).toContain("bridge?.registerPluginInstance(BiometricAuthPlugin())");
    expect(storyboard).toContain('customClass="BridgeViewController"');
    expect(storyboard).toContain('customModule="App"');
    expect(project).toContain("BiometricAuthPlugin.swift in Sources");
    expect(project).toContain("BridgeViewController.swift in Sources");
  });
});
