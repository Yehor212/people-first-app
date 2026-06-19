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
    const pluginBridgeSource = readSource("src/plugins/BiometricPlugin.ts");
    const journalSecuritySource = readSource("src/features/journal/useJournalSecurity.ts");
    const storyboard = readSource("ios/App/App/Base.lproj/Main.storyboard");
    const project = readSource("ios/App/App.xcodeproj/project.pbxproj");

    expect(pluginSource).toContain("import LocalAuthentication");
    expect(pluginSource).toContain("import Security");
    expect(pluginSource).toContain("public class BiometricAuthPlugin: CAPPlugin, CAPBridgedPlugin");
    expect(pluginSource).toContain('public let jsName = "BiometricAuth"');
    expect(pluginSource).toContain('CAPPluginMethod(name: "isAvailable"');
    expect(pluginSource).toContain('CAPPluginMethod(name: "enroll"');
    expect(pluginSource).toContain('CAPPluginMethod(name: "unenroll"');
    expect(pluginSource).toContain('CAPPluginMethod(name: "authenticate"');
    expect(pluginSource).toContain(".deviceOwnerAuthenticationWithBiometrics");
    expect(pluginSource).toContain(".faceID");
    expect(pluginSource).toContain(".touchID");
    expect(pluginSource).toContain("kSecAttrAccessControl");
    expect(pluginSource).toContain("kSecUseAuthenticationContext");
    expect(pluginSource).toContain("localizedReason");
    expect(pluginSource).not.toContain("kSecUseOperationPrompt");
    expect(pluginSource).toContain(".biometryCurrentSet");
    expect(pluginSource).toContain("SecItemAdd");
    expect(pluginSource).toContain("SecItemCopyMatching");
    expect(pluginSource).toContain("SecItemDelete");
    expect(pluginSource).toContain('call.getString("secret")');
    expect(pluginSource).toContain("Data(secret.utf8)");
    expect(pluginSource).toContain('"secret": secret');
    expect(pluginSource).not.toContain("credentialPayload");
    expect(pluginSource).not.toContain("evaluatePolicy");

    expect(pluginBridgeSource).toContain("secret?: string");
    expect(pluginBridgeSource).toContain("enroll(options: { reason: string; secret?: string })");
    expect(pluginBridgeSource).toContain("unenroll(): Promise<BiometricAuthResult>");
    expect(journalSecuritySource).toContain("const result = await BiometricAuth.enroll");
    expect(journalSecuritySource).toContain("secret: vaultKey");
    expect(journalSecuritySource).toContain("if (!result.success || !result.secret)");
    expect(journalSecuritySource).toContain("setVaultKey(result.secret)");
    expect(journalSecuritySource).toContain("await BiometricAuth.unenroll()");
    expect(journalSecuritySource).toContain("await unenrollNativeBiometrics()");
    expect(journalSecuritySource).toContain("if (!result.success)");
    expect(journalSecuritySource).toContain("setBiometricEnabledState(true)");
    expect(journalSecuritySource).toContain("setBiometricEnabledState(false)");

    expect(bridgeSource).toContain("class BridgeViewController: CAPBridgeViewController");
    expect(bridgeSource).toContain("bridge?.registerPluginInstance(BiometricAuthPlugin())");
    expect(storyboard).toContain('customClass="BridgeViewController"');
    expect(storyboard).toContain('customModule="App"');
    expect(project).toContain("BiometricAuthPlugin.swift in Sources");
    expect(project).toContain("BridgeViewController.swift in Sources");
  });
});
