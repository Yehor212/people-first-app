package com.zenflow.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Health Connect Plugin for ZenFlow
 *
 * Placeholder implementation that checks for Health Connect availability.
 * Full Health Connect integration requires Kotlin for proper coroutine support.
 *
 * This plugin:
 * - Checks if Health Connect is available
 * - Opens Health Connect app for manual data viewing
 * - Returns "not_supported" for data operations (requires Kotlin implementation)
 *
 * For full Health Connect support, consider migrating to Kotlin or using
 * the official Health Connect Capacitor plugin when available.
 */
@CapacitorPlugin(name = "HealthConnect")
public class HealthConnectPlugin extends Plugin {
    private static final String TAG = "HealthConnectPlugin";
    private static final String HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";

    /**
     * Check if Health Connect is available on this device
     */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();

        try {
            // Check if Health Connect app is installed
            Context context = getContext();
            Intent intent = context.getPackageManager().getLaunchIntentForPackage(HEALTH_CONNECT_PACKAGE);

            if (intent != null) {
                // Health Connect app is installed
                result.put("available", true);
                Log.d(TAG, "Health Connect is available");
            } else {
                // Check for system Health Connect (Android 14+)
                if (android.os.Build.VERSION.SDK_INT >= 34) {
                    result.put("available", true);
                    Log.d(TAG, "Health Connect available via system (Android 14+)");
                } else {
                    result.put("available", false);
                    result.put("reason", "not_supported");
                    Log.d(TAG, "Health Connect not available - app not installed");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking Health Connect availability", e);
            result.put("available", false);
            result.put("reason", "not_supported");
        }

        call.resolve(result);
    }

    /**
     * Check current permission status
     * Note: Returns placeholder values - full implementation requires Kotlin
     */
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        // Placeholder - actual permission check requires Health Connect SDK with Kotlin coroutines
        JSObject result = new JSObject();
        result.put("mindfulness", false);
        result.put("sleep", false);
        result.put("steps", false);
        result.put("allGranted", false);
        call.resolve(result);
    }

    /**
     * Request Health Connect permissions
     * Opens Health Connect settings for user to grant permissions manually
     */
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        try {
            // Open Health Connect settings where user can grant permissions
            Intent intent = new Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            // Return current permissions (will be false until Kotlin implementation)
            checkPermissions(call);
        } catch (Exception e) {
            Log.e(TAG, "Error opening Health Connect settings", e);
            // Try opening Play Store as fallback
            openHealthConnect(call);
        }
    }

    /**
     * Write a mindfulness session
     * Note: Placeholder - requires Kotlin for actual implementation
     */
    @PluginMethod
    public void writeMindfulnessSession(PluginCall call) {
        // Placeholder - writing data requires Kotlin coroutines
        JSObject result = new JSObject();
        result.put("success", false);
        result.put("sessionId", "");
        result.put("error", "Health Connect write requires Kotlin implementation");
        Log.w(TAG, "writeMindfulnessSession called but requires Kotlin implementation");
        call.resolve(result);
    }

    /**
     * Read sleep sessions
     * Note: Placeholder - requires Kotlin for actual implementation
     */
    @PluginMethod
    public void readSleepSessions(PluginCall call) {
        // Placeholder - reading data requires Kotlin coroutines
        JSObject result = new JSObject();
        result.put("sessions", new JSArray());
        result.put("count", 0);
        Log.w(TAG, "readSleepSessions called but requires Kotlin implementation");
        call.resolve(result);
    }

    /**
     * Read step count
     * Note: Placeholder - requires Kotlin for actual implementation
     */
    @PluginMethod
    public void readSteps(PluginCall call) {
        // Placeholder - reading data requires Kotlin coroutines
        JSObject result = new JSObject();
        result.put("totalSteps", 0);
        result.put("records", new JSArray());
        result.put("recordCount", 0);
        Log.w(TAG, "readSteps called but requires Kotlin implementation");
        call.resolve(result);
    }

    /**
     * Open Health Connect app or Play Store listing
     */
    @PluginMethod
    public void openHealthConnect(PluginCall call) {
        try {
            // Try to open Health Connect settings
            Intent intent = new Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // Fallback: Try to open Health Connect app
            try {
                Intent launchIntent = getContext().getPackageManager()
                    .getLaunchIntentForPackage(HEALTH_CONNECT_PACKAGE);
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(launchIntent);
                    call.resolve();
                } else {
                    // Open Play Store
                    openPlayStore(call);
                }
            } catch (Exception e2) {
                openPlayStore(call);
            }
        }
    }

    /**
     * Open Health Connect in Play Store
     */
    private void openPlayStore(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("market://details?id=" + HEALTH_CONNECT_PACKAGE));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // Fallback to web browser
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse("https://play.google.com/store/apps/details?id=" + HEALTH_CONNECT_PACKAGE));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e2) {
                Log.e(TAG, "Could not open Play Store", e2);
                call.reject("Could not open Health Connect");
            }
        }
    }
}
