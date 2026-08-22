import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Android diary biometric unlock bridge", () => {
  it("backs the diary biometric lock with a registered native Android keystore plugin", () => {
    const pluginPath = "android/app/src/main/java/com/zenflow/app/BiometricAuthPlugin.java";

    expect(existsSync(resolve(process.cwd(), pluginPath))).toBe(true);

    const pluginSource = readSource(pluginPath);
    const activitySource = readSource(
      "android/app/src/main/java/com/zenflow/app/MainActivity.java"
    );
    const manifest = readSource("android/app/src/main/AndroidManifest.xml");
    const gradle = readSource("android/app/build.gradle");
    const pluginBridgeSource = readSource("src/plugins/BiometricPlugin.ts");
    const journalSecuritySource = readSource("src/features/journal/useJournalSecurity.ts");
    const credentialCleanupSource = readSource("src/lib/journalBiometricCredentials.ts");

    expect(pluginSource).toContain('@CapacitorPlugin(name = "BiometricAuth")');
    expect(pluginSource).toContain("BiometricManager.Authenticators.BIOMETRIC_STRONG");
    expect(pluginSource).toContain("BiometricPrompt.CryptoObject");
    expect(pluginSource).toContain("KeyGenParameterSpec");
    expect(pluginSource).toContain("KeyProperties.AUTH_BIOMETRIC_STRONG");
    expect(pluginSource).toContain("setUserAuthenticationParameters(0");
    expect(pluginSource).toContain("setInvalidatedByBiometricEnrollment(true)");
    expect(pluginSource).toContain(
      'private static final String ANDROID_KEYSTORE = "AndroidKeyStore"'
    );
    expect(pluginSource).toContain("KeyStore.getInstance(ANDROID_KEYSTORE)");
    expect(pluginSource).toContain("successResult(decryptedSecret)");
    expect(pluginSource).not.toContain("Arrays.equals");
    expect(pluginSource).toContain("@PluginMethod");
    expect(pluginSource).toContain("public void isAvailable(PluginCall call)");
    expect(pluginSource).toContain("public void enroll(PluginCall call)");
    expect(pluginSource).toContain("public void unenroll(PluginCall call)");
    expect(pluginSource).toContain("getCredentialPrefs().edit().clear().apply()");
    expect(pluginSource).toContain("keyStore.deleteEntry(KEY_ALIAS)");
    expect(pluginSource).toContain("public void authenticate(PluginCall call)");
    expect(pluginSource).not.toContain("setDeviceCredentialAllowed");

    expect(activitySource).toContain("registerPlugin(BiometricAuthPlugin.class);");
    expect(manifest).toContain("android.permission.USE_BIOMETRIC");
    expect(gradle).toContain("androidx.biometric:biometric");
    expect(pluginBridgeSource).toContain("enroll(options: { reason: string; secret?: string })");
    expect(pluginBridgeSource).toContain("unenroll(): Promise<BiometricAuthResult>");
    expect(journalSecuritySource).toContain("enrollNativeJournalBiometricCredential");
    expect(journalSecuritySource).toContain("await clearNativeJournalBiometricCredential()");
    expect(credentialCleanupSource).toContain("const result = await BiometricAuth.enroll(input)");
    expect(credentialCleanupSource).toContain("const result = await BiometricAuth.unenroll()");
    expect(credentialCleanupSource).toContain("if (!result?.success)");
  });

  it("returns the enrolled journal vault secret after biometric authentication", () => {
    const pluginSource = readSource(
      "android/app/src/main/java/com/zenflow/app/BiometricAuthPlugin.java"
    );

    expect(pluginSource).toContain('String secret = call.getString("secret", null);');
    expect(pluginSource).toContain("if (secret == null || secret.isEmpty())");
    expect(pluginSource).toContain(
      "authenticatedCipher.doFinal(secretToStore.getBytes(StandardCharsets.UTF_8))"
    );
    expect(pluginSource).toContain("new String(decrypted, StandardCharsets.UTF_8)");
    expect(pluginSource).toContain("successResult(decryptedSecret)");
    expect(pluginSource).not.toContain("CREDENTIAL_PAYLOAD");
  });
});
