package com.zenflow.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricAuthPlugin extends Plugin {
    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_STRONG;
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "zenflow_diary_biometric_key_v1";
    private static final String PREFS_NAME = "zenflow_diary_biometric";
    private static final String PREF_CIPHER_TEXT = "credential_cipher_text";
    private static final String PREF_IV = "credential_iv";

    @PluginMethod
    public void isAvailable(PluginCall call) {
        int status = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        JSObject result = new JSObject();
        result.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
        if (status == BiometricManager.BIOMETRIC_SUCCESS) {
            result.put("type", getBiometricType());
        } else {
            result.put("error", availabilityMessage(status));
        }
        call.resolve(result);
    }

    @PluginMethod
    public void enroll(PluginCall call) {
        if (!isStrongBiometricAvailable(call)) return;

        String secret = call.getString("secret", null);
        if (secret == null || secret.isEmpty()) {
            resolveFailure(call, "Journal vault key is required to enable biometric diary unlock.");
            return;
        }

        getBridge().executeOnMainThread(() -> {
            try {
                deleteCredential();
                generateSecretKey();
                Cipher cipher = getCipher();
                cipher.init(Cipher.ENCRYPT_MODE, getSecretKey());
                authenticateWithCipher(call, getReason(call, "Enable biometric diary unlock"), cipher, secret);
            } catch (Exception error) {
                resolveFailure(call, keychainErrorMessage(error));
            }
        });
    }

    @PluginMethod
    public void unenroll(PluginCall call) {
        try {
            deleteCredential();
            call.resolve(successResult());
        } catch (Exception error) {
            resolveFailure(call, keychainErrorMessage(error));
        }
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (!isStrongBiometricAvailable(call)) return;
        SharedPreferences prefs = getCredentialPrefs();
        String cipherText = prefs.getString(PREF_CIPHER_TEXT, null);
        String iv = prefs.getString(PREF_IV, null);
        if (cipherText == null || iv == null) {
            resolveFailure(call, "Biometric diary unlock is not enrolled. Unlock with your password and enable biometrics again.");
            return;
        }

        getBridge().executeOnMainThread(() -> {
            try {
                Cipher cipher = getCipher();
                byte[] decodedIv = Base64.decode(iv, Base64.NO_WRAP);
                cipher.init(Cipher.DECRYPT_MODE, getSecretKey(), new GCMParameterSpec(128, decodedIv));
                authenticateWithCipher(call, getReason(call, "Unlock your diary"), cipher, null);
            } catch (KeyPermanentlyInvalidatedException error) {
                deleteCredentialQuietly();
                resolveFailure(call, "Biometric credentials changed. Unlock with your password and enable biometrics again.");
            } catch (Exception error) {
                resolveFailure(call, keychainErrorMessage(error));
            }
        });
    }

    private void authenticateWithCipher(PluginCall call, String reason, Cipher cipher, String secretToStore) {
        Activity activity = getActivity();
        if (!(activity instanceof FragmentActivity)) {
            resolveFailure(call, "Biometric authentication requires an active Android activity.");
            return;
        }

        AtomicBoolean resolved = new AtomicBoolean(false);
        Executor executor = ContextCompat.getMainExecutor(getContext());
        BiometricPrompt biometricPrompt = new BiometricPrompt(
                (FragmentActivity) activity,
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        if (resolved.compareAndSet(false, true)) {
                            resolveFailure(call, errString.toString());
                        }
                    }

                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        if (!resolved.compareAndSet(false, true)) return;
                        try {
                            BiometricPrompt.CryptoObject cryptoObject = result.getCryptoObject();
                            Cipher authenticatedCipher = cryptoObject != null ? cryptoObject.getCipher() : null;
                            if (authenticatedCipher == null) {
                                resolveFailure(call, "Biometric authentication did not return an authenticated cipher.");
                                return;
                            }

                            if (secretToStore != null) {
                                byte[] encrypted = authenticatedCipher.doFinal(secretToStore.getBytes(StandardCharsets.UTF_8));
                                storeCredential(encrypted, authenticatedCipher.getIV());
                                call.resolve(successResult());
                                return;
                            }

                            SharedPreferences prefs = getCredentialPrefs();
                            byte[] encrypted = Base64.decode(prefs.getString(PREF_CIPHER_TEXT, ""), Base64.NO_WRAP);
                            byte[] decrypted = authenticatedCipher.doFinal(encrypted);
                            String decryptedSecret = new String(decrypted, StandardCharsets.UTF_8);
                            if (decryptedSecret.isEmpty()) {
                                resolveFailure(call, "Biometric authentication failed.");
                            } else {
                                call.resolve(successResult(decryptedSecret));
                            }
                        } catch (Exception error) {
                            resolveFailure(call, keychainErrorMessage(error));
                        }
                    }
                }
        );

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("ZenFlow diary")
                .setSubtitle(reason)
                .setNegativeButtonText("Use password")
                .setAllowedAuthenticators(AUTHENTICATORS)
                .build();

        biometricPrompt.authenticate(promptInfo, new BiometricPrompt.CryptoObject(cipher));
    }

    private boolean isStrongBiometricAvailable(PluginCall call) {
        int status = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        if (status == BiometricManager.BIOMETRIC_SUCCESS) return true;
        resolveFailure(call, availabilityMessage(status));
        return false;
    }

    @SuppressWarnings("deprecation")
    private void generateSecretKey() throws Exception {
        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        } else {
            builder.setUserAuthenticationValidityDurationSeconds(-1);
        }

        keyGenerator.init(builder.build());
        keyGenerator.generateKey();
    }

    private SecretKey getSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        SecretKey key = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (key == null) throw new IllegalStateException("Biometric diary unlock is not enrolled.");
        return key;
    }

    private Cipher getCipher() throws Exception {
        return Cipher.getInstance("AES/GCM/NoPadding");
    }

    private void storeCredential(byte[] cipherText, byte[] iv) {
        getCredentialPrefs()
                .edit()
                .putString(PREF_CIPHER_TEXT, Base64.encodeToString(cipherText, Base64.NO_WRAP))
                .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .apply();
    }

    private SharedPreferences getCredentialPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private void deleteCredential() throws Exception {
        getCredentialPrefs().edit().clear().apply();
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            keyStore.deleteEntry(KEY_ALIAS);
        }
    }

    private void deleteCredentialQuietly() {
        try {
            deleteCredential();
        } catch (Exception ignored) {
            // Best-effort cleanup after the platform invalidates the key.
        }
    }

    private String getReason(PluginCall call, String fallback) {
        String reason = call.getString("reason");
        return reason == null || reason.trim().isEmpty() ? fallback : reason;
    }

    private JSObject successResult() {
        return successResult(null);
    }

    private JSObject successResult(String secret) {
        JSObject result = new JSObject();
        result.put("success", true);
        if (secret != null) {
            result.put("secret", secret);
        }
        return result;
    }

    private void resolveFailure(PluginCall call, String message) {
        JSObject result = new JSObject();
        result.put("success", false);
        result.put("error", message);
        call.resolve(result);
    }

    private String getBiometricType() {
        PackageManager packageManager = getContext().getPackageManager();
        boolean hasFingerprint = packageManager.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT);
        boolean hasFace = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && packageManager.hasSystemFeature(PackageManager.FEATURE_FACE);
        boolean hasIris = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && packageManager.hasSystemFeature(PackageManager.FEATURE_IRIS);
        int count = (hasFingerprint ? 1 : 0) + (hasFace ? 1 : 0) + (hasIris ? 1 : 0);
        if (count > 1) return "multiple";
        if (hasFace) return "face";
        if (hasIris) return "iris";
        return "fingerprint";
    }

    private String availabilityMessage(int status) {
        switch (status) {
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "Biometric authentication is not available on this device.";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "Biometric authentication is temporarily unavailable.";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "No biometric credentials are enrolled on this device.";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "A security update is required before biometric authentication can be used.";
            case BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED:
                return "Strong biometric authentication is not supported on this device.";
            case BiometricManager.BIOMETRIC_STATUS_UNKNOWN:
                return "Biometric authentication status is unknown.";
            default:
                return "Biometric authentication is not available.";
        }
    }

    private String keychainErrorMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? "Biometric authentication failed." : message;
    }
}
